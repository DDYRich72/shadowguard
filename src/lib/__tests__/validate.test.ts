import { describe, it, expect } from "vitest";
import { clip, clipArray, clampInt, isUuid, LIMITS } from "../validate";

describe("clip", () => {
  it("coerces non-strings to empty string when null/undefined", () => {
    expect(clip(null, 10)).toBe("");
    expect(clip(undefined, 10)).toBe("");
  });

  it("stringifies non-strings", () => {
    expect(clip(42, 10)).toBe("42");
    expect(clip(true, 10)).toBe("true");
    expect(clip({ a: 1 }, 100)).toBe("[object Object]");
  });

  it("clips to maxLen", () => {
    expect(clip("abcdefghij", 5)).toBe("abcde");
    expect(clip("ab", 5)).toBe("ab");
  });
});

describe("clipArray", () => {
  it("returns [] for non-arrays", () => {
    expect(clipArray("not an array", 10)).toEqual([]);
    expect(clipArray(null, 10)).toEqual([]);
    expect(clipArray({ length: 5 }, 10)).toEqual([]);
  });

  it("clips length to maxItems", () => {
    expect(clipArray([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
    expect(clipArray([1, 2], 5)).toEqual([1, 2]);
  });

  it("preserves item identity", () => {
    const obj = { x: 1 };
    const out = clipArray<{ x: number }>([obj, obj], 5);
    expect(out[0]).toBe(obj);
  });
});

describe("isUuid", () => {
  it("accepts canonical v4 UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("550e8400-e29b-41d4-a716")).toBe(false); // truncated
    expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false); // no dashes
    expect(isUuid("")).toBe(false);
    expect(isUuid("'; DROP TABLE users; --")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});

describe("clampInt", () => {
  it("clamps to range", () => {
    expect(clampInt(5, 0, 10, 0)).toBe(5);
    expect(clampInt(-1, 0, 10, 0)).toBe(0);
    expect(clampInt(99, 0, 10, 0)).toBe(10);
  });

  it("returns fallback for non-finite", () => {
    expect(clampInt("not a number", 0, 10, 7)).toBe(7);
    expect(clampInt(NaN, 0, 10, 7)).toBe(7);
    expect(clampInt(Infinity, 0, 10, 7)).toBe(7);
    expect(clampInt(null, 0, 10, 7)).toBe(7);
  });

  it("truncates floats", () => {
    expect(clampInt(5.9, 0, 10, 0)).toBe(5);
    expect(clampInt(-2.5, 0, 10, 0)).toBe(0);
  });

  it("coerces stringified numbers", () => {
    expect(clampInt("5", 0, 10, 0)).toBe(5);
  });
});

describe("LIMITS", () => {
  it("exposes the documented budgets", () => {
    expect(LIMITS.toolName).toBe(200);
    expect(LIMITS.userEmail).toBe(320);
    expect(LIMITS.activityContent).toBe(100_000);
  });
});
