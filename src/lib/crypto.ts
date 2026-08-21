/**
 * AES-256-GCM encryption for OAuth tokens stored in Supabase.
 *
 * Envelope formats:
 *   v1:<iv_b64>:<ciphertext_b64>:<tag_b64>
 *     Legacy, single key. Decryption assumes key version 1
 *     (TOKEN_ENCRYPTION_KEY).
 *   v2:<keyVersion>:<iv_b64>:<ciphertext_b64>:<tag_b64>
 *     Carries the key version in the envelope so we can rotate keys
 *     without rewriting every row at once. Encryption always emits v2
 *     with the current key.
 *
 * Key rotation:
 *   1. Generate a new 32-byte key, base64-encode it.
 *   2. Set the new key + bump TOKEN_ENCRYPTION_KEY_VERSION in the
 *      application environment. Move the OLD key to TOKEN_ENCRYPTION_KEY_PREVIOUS
 *      (and TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION).
 *   3. Deploy. New writes use the new key; reads of old ciphertext
 *      transparently use the previous key.
 *   4. Run scripts/rotate-token-keys.ts to walk every row and rewrite
 *      it with the current key.
 *   5. After the job finishes, drop the *_PREVIOUS env vars.
 *
 * Without rotation configured (single key): everything still works,
 * v1 envelope is read transparently, v2 is written with version 1.
 */

import { webcrypto } from "node:crypto";

const IV_BYTES = 12;

type KeySlot = {
  version: number;
  key: CryptoKey;
};

let cachedCurrent: KeySlot | null = null;
let cachedPrevious: KeySlot | null = null;
let cachedKeysInitialized = false;

async function importKeyFromBase64(raw: string): Promise<CryptoKey> {
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${bytes.length}).`
    );
  }
  return webcrypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function loadKeys(): Promise<void> {
  if (cachedKeysInitialized) return;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate a 32-byte base64 key (see .env.example)."
    );
  }
  const version = parseInt(process.env.TOKEN_ENCRYPTION_KEY_VERSION ?? "1", 10) || 1;
  cachedCurrent = { version, key: await importKeyFromBase64(raw) };

  const prevRaw = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  if (prevRaw) {
    const prevVersion = parseInt(
      process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION ?? "1",
      10
    ) || 1;
    if (prevVersion === version) {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION must differ from TOKEN_ENCRYPTION_KEY_VERSION."
      );
    }
    cachedPrevious = {
      version: prevVersion,
      key: await importKeyFromBase64(prevRaw),
    };
  }
  cachedKeysInitialized = true;
}

/**
 * Test-only: drop the in-process key cache so a test that mutates
 * env vars can re-import. Safe to call from any context — never
 * exposed in production paths.
 */
export function _resetKeysForTest(): void {
  cachedCurrent = null;
  cachedPrevious = null;
  cachedKeysInitialized = false;
}

/** Returns the integer version of the currently-active encryption key. */
export async function currentKeyVersion(): Promise<number> {
  await loadKeys();
  return cachedCurrent!.version;
}

function pickKey(version: number): CryptoKey {
  if (cachedCurrent && cachedCurrent.version === version) return cachedCurrent.key;
  if (cachedPrevious && cachedPrevious.version === version) return cachedPrevious.key;
  throw new Error(
    `No key available for ciphertext version ${version}. Set TOKEN_ENCRYPTION_KEY_PREVIOUS to allow reading legacy data.`
  );
}

export async function encrypt(plaintext: string): Promise<string> {
  await loadKeys();
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cachedCurrent!.key,
    new TextEncoder().encode(plaintext)
  );
  const ctBytes = new Uint8Array(ciphertext);
  // AES-GCM output = ciphertext || tag (16 bytes)
  const tag = ctBytes.slice(ctBytes.length - 16);
  const ct = ctBytes.slice(0, ctBytes.length - 16);
  return [
    "v2",
    String(cachedCurrent!.version),
    Buffer.from(iv).toString("base64"),
    Buffer.from(ct).toString("base64"),
    Buffer.from(tag).toString("base64"),
  ].join(":");
}

export async function decrypt(envelope: string): Promise<string> {
  await loadKeys();
  const parts = envelope.split(":");
  let version: number;
  let ivB64: string;
  let ctB64: string;
  let tagB64: string;

  if (parts[0] === "v1" && parts.length === 4) {
    // Legacy envelope, written before key rotation existed. Always
    // decrypts with key version 1.
    version = 1;
    [, ivB64, ctB64, tagB64] = parts;
  } else if (parts[0] === "v2" && parts.length === 5) {
    version = parseInt(parts[1], 10);
    if (!Number.isInteger(version)) {
      throw new Error(`v2 envelope has non-integer key version: ${parts[1]}`);
    }
    [, , ivB64, ctB64, tagB64] = parts;
  } else {
    throw new Error(`Unsupported encryption envelope: ${parts[0]}`);
  }

  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const joined = new Uint8Array(ct.length + tag.length);
  joined.set(ct);
  joined.set(tag, ct.length);

  const key = pickKey(version);
  const plaintext = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    joined
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Re-encrypt an existing envelope under the current key. Caller is
 * expected to wrap the four token columns of an org and write back
 * `encryption_key_version = currentKeyVersion()` after all four
 * succeed (atomic-by-row, see scripts/rotate-token-keys.ts).
 */
export async function reencrypt(envelope: string): Promise<string> {
  const plain = await decrypt(envelope);
  return encrypt(plain);
}
