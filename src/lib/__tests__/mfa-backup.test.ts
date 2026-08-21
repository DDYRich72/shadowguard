import { describe, it, expect } from "vitest";
import {
  generateBackupCodes,
  hashCode,
  normalizeCode,
} from "../mfa-backup";

describe("normalizeCode", () => {
  it("strips dashes and whitespace and uppercases", () => {
    expect(normalizeCode("abcde-fghij")).toBe("ABCDEFGHIJ");
    expect(normalizeCode(" ab cd-ef ")).toBe("ABCDEF");
    expect(normalizeCode("XYZ-123")).toBe("XYZ123");
  });
});

describe("hashCode", () => {
  it("is deterministic for the same code", () => {
    expect(hashCode("ABCDE-FGHIJ")).toBe(hashCode("ABCDE-FGHIJ"));
  });

  it("treats formatting variations as the same code", () => {
    // User might type with or without dashes, in any case.
    expect(hashCode("abcde-fghij")).toBe(hashCode("ABCDEFGHIJ"));
    expect(hashCode("ABCDE FGHIJ")).toBe(hashCode("ABCDE-FGHIJ"));
  });

  it("produces different hashes for different codes", () => {
    expect(hashCode("ABCDE-FGHIJ")).not.toBe(hashCode("ABCDE-FGHIK"));
  });

  it("returns hex digest of expected length", () => {
    expect(hashCode("ABCDE-FGHIJ")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateBackupCodes", () => {
  it("returns 10 codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
  });

  it("formats codes as XXXXX-XXXXX", () => {
    const codes = generateBackupCodes();
    for (const c of codes) {
      expect(c.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("excludes look-alike characters (I, L, O, U, 0, 1)", () => {
    // Generate a large batch to make the absence of look-alikes statistically robust.
    for (let i = 0; i < 50; i++) {
      const codes = generateBackupCodes();
      for (const c of codes) {
        expect(c.code).not.toMatch(/[ILOU01]/);
      }
    }
  });

  it("returns unique codes within a batch", () => {
    const codes = generateBackupCodes();
    const unique = new Set(codes.map((c) => c.code));
    expect(unique.size).toBe(10);
  });

  it("hash matches the code's hashCode()", () => {
    const codes = generateBackupCodes();
    for (const c of codes) {
      expect(c.hash).toBe(hashCode(c.code));
    }
  });

  it("returns different batches across calls", () => {
    const a = generateBackupCodes();
    const b = generateBackupCodes();
    const aSet = new Set(a.map((c) => c.code));
    for (const c of b) {
      expect(aSet.has(c.code)).toBe(false);
    }
  });
});
