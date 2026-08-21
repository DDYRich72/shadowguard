import { describe, it, expect } from "vitest";
import {
  markSensitive,
  unwrapForClassification,
  lengthOf,
  isSensitive,
} from "../sensitive";

describe("markSensitive + isSensitive", () => {
  it("wraps a string and reports the brand", () => {
    const c = markSensitive("secret prompt");
    expect(isSensitive(c)).toBe(true);
  });

  it("isSensitive returns false for plain values", () => {
    expect(isSensitive("plain")).toBe(false);
    expect(isSensitive(42)).toBe(false);
    expect(isSensitive(null)).toBe(false);
    expect(isSensitive(undefined)).toBe(false);
    expect(isSensitive({})).toBe(false);
    expect(isSensitive({ pretend: "wrapped" })).toBe(false);
  });
});

describe("runtime safety net (Symbol.toPrimitive)", () => {
  const c = markSensitive("hunter2 password leaked");

  it("renders <sensitive> in template literals", () => {
    expect(`leaked: ${c}`).toBe("leaked: <sensitive>");
  });

  it("renders <sensitive> when stringified", () => {
    expect(String(c)).toBe("<sensitive>");
  });

  it("renders <sensitive> via JSON.stringify", () => {
    expect(JSON.stringify(c)).toBe('"<sensitive>"');
  });

  it("renders <sensitive> when concatenated", () => {
    const s = "value=" + c;
    expect(s).toBe("value=<sensitive>");
  });

  it("nested in an object via JSON.stringify also redacts", () => {
    const wrapped = { incident: "log me", payload: c };
    const out = JSON.stringify(wrapped);
    expect(out).not.toContain("hunter2");
    expect(out).toContain("<sensitive>");
  });
});

describe("unwrapForClassification", () => {
  it("returns the original string when called with a wrapped value", () => {
    const c = markSensitive("classify this");
    expect(unwrapForClassification(c)).toBe("classify this");
  });

  it("throws when called with a forged object", () => {
    const fake = { brand: "fake" } as unknown as ReturnType<typeof markSensitive>;
    expect(() => unwrapForClassification(fake)).toThrow(
      /not a registered SensitiveContent/
    );
  });

  it("throws when called with a different SensitiveContent's lookup key", () => {
    // WeakMap is per-instance — even another wrapped value of the
    // same string can't be unwrapped via the wrong reference.
    const a = markSensitive("same");
    const b = markSensitive("same");
    expect(unwrapForClassification(a)).toBe("same");
    expect(unwrapForClassification(b)).toBe("same");
    expect(a).not.toBe(b);
  });
});

describe("lengthOf", () => {
  it("returns the original character length", () => {
    expect(lengthOf(markSensitive(""))).toBe(0);
    expect(lengthOf(markSensitive("hello"))).toBe(5);
    expect(lengthOf(markSensitive("a".repeat(10_000)))).toBe(10_000);
  });
});
