import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { webcrypto } from "node:crypto";
import { encrypt, decrypt, reencrypt, currentKeyVersion, _resetKeysForTest } from "../crypto";

function freshKey(): string {
  const bytes = new Uint8Array(32);
  webcrypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

const KEY_A = freshKey();
const KEY_B = freshKey();

beforeEach(() => {
  _resetKeysForTest();
  delete process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY_VERSION;
  delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION;
});

afterEach(() => {
  _resetKeysForTest();
});

describe("encrypt + decrypt round-trip", () => {
  it("round-trips arbitrary strings under a single key", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    const cipher = await encrypt("hello world");
    expect(cipher).toMatch(/^v2:1:/);
    expect(await decrypt(cipher)).toBe("hello world");
  });

  it("emits unique ciphertext for the same plaintext (random IV)", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    const a = await encrypt("hello");
    const b = await encrypt("hello");
    expect(a).not.toBe(b);
    expect(await decrypt(a)).toBe("hello");
    expect(await decrypt(b)).toBe("hello");
  });

  it("includes the current key version in the v2 envelope", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "7";
    const cipher = await encrypt("x");
    expect(cipher).toMatch(/^v2:7:/);
    expect(await currentKeyVersion()).toBe(7);
  });
});

describe("legacy v1 envelope", () => {
  it("decrypts a v1 envelope under the current key (assumed key version 1)", async () => {
    // Simulate a v1 ciphertext written by the prior implementation.
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    const v2cipher = await encrypt("legacy data");
    // Strip the v2 + keyVersion prefix to fake a v1 envelope.
    const parts = v2cipher.split(":");
    const v1 = ["v1", parts[2], parts[3], parts[4]].join(":");
    expect(await decrypt(v1)).toBe("legacy data");
  });

  it("rejects unsupported envelope versions", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    await expect(decrypt("v9:nonsense:...")).rejects.toThrow(
      /Unsupported encryption envelope/
    );
  });
});

describe("multi-key (rotation in progress)", () => {
  it("decrypts ciphertext written under the previous key", async () => {
    // First, write a value under KEY_A as version 1.
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "1";
    const oldCipher = await encrypt("pre-rotation");
    expect(oldCipher).toMatch(/^v2:1:/);

    // Rotate: KEY_B is now current (version 2), KEY_A is previous (version 1).
    _resetKeysForTest();
    process.env.TOKEN_ENCRYPTION_KEY = KEY_B;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "2";
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION = "1";

    expect(await decrypt(oldCipher)).toBe("pre-rotation");

    const newCipher = await encrypt("post-rotation");
    expect(newCipher).toMatch(/^v2:2:/);
    expect(await decrypt(newCipher)).toBe("post-rotation");
  });

  it("rejects ciphertext from an unknown key version", async () => {
    // Cipher written under KEY_A (v=1).
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "1";
    const oldCipher = await encrypt("orphan");

    // App now only knows KEY_B (v=2). No previous key configured.
    _resetKeysForTest();
    process.env.TOKEN_ENCRYPTION_KEY = KEY_B;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "2";
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;

    await expect(decrypt(oldCipher)).rejects.toThrow(/No key available/);
  });

  it("refuses identical current and previous key versions", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "3";
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = KEY_B;
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION = "3";

    await expect(encrypt("anything")).rejects.toThrow(
      /must differ from TOKEN_ENCRYPTION_KEY_VERSION/
    );
  });
});

describe("reencrypt", () => {
  it("converts old-key ciphertext to current-key ciphertext", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "1";
    const oldCipher = await encrypt("rotate me");

    _resetKeysForTest();
    process.env.TOKEN_ENCRYPTION_KEY = KEY_B;
    process.env.TOKEN_ENCRYPTION_KEY_VERSION = "2";
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = KEY_A;
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION = "1";

    const newCipher = await reencrypt(oldCipher);
    expect(newCipher).toMatch(/^v2:2:/);
    expect(await decrypt(newCipher)).toBe("rotate me");
  });
});

describe("env validation", () => {
  it("throws when no key is set", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    await expect(encrypt("x")).rejects.toThrow(
      /TOKEN_ENCRYPTION_KEY is not set/
    );
  });

  it("throws when key isn't 32 bytes", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    await expect(encrypt("x")).rejects.toThrow(/must decode to 32 bytes/);
  });
});
