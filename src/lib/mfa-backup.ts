/**
 * MFA backup recovery codes — pure utilities.
 *
 * Server-only persistence (rotateBackupCodes / consumeBackupCode /
 * countUnusedBackupCodes) lives in `mfa-backup.server.ts` so the
 * pure code generation + hashing can be unit-tested in a Node test
 * environment without tripping the `server-only` import guard.
 */

import { randomBytes, createHash } from "node:crypto";

// Crockford-base32 alphabet minus I/L/O/U to avoid look-alikes.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LEN = 10; // 30^10 ≈ 49 bits per code, ample for short-term recovery
const CODE_COUNT = 10;

export type GeneratedBackupCode = {
  /** Plain-text code, formatted XXXXX-XXXXX. Show once, never persist. */
  code: string;
  /** Hex SHA-256 of the unformatted code. Persisted to mfa_backup_codes. */
  hash: string;
};

/** Strip whitespace + dashes + lowercase, then uppercase for hashing. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function hashCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function randomCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/**
 * Generate a fresh batch of 10 codes. Pure: caller persists the
 * hashes via the admin client (see mfa-backup.server.ts).
 */
export function generateBackupCodes(): GeneratedBackupCode[] {
  const out: GeneratedBackupCode[] = [];
  const seen = new Set<string>();
  while (out.length < CODE_COUNT) {
    const code = randomCode();
    const hash = hashCode(code);
    if (seen.has(hash)) continue; // collision is astronomically unlikely; belt-and-braces
    seen.add(hash);
    out.push({ code, hash });
  }
  return out;
}
