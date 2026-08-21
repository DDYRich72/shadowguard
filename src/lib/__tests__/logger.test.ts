import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, logError } from "../logger";

let calls: string[] = [];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  calls = [];
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((line) => {
    calls.push(String(line));
  });
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((line) => {
    calls.push(String(line));
  });
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation((line) => {
    calls.push(String(line));
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleLogSpy.mockRestore();
});

describe("logger.error redaction", () => {
  it("redacts Google access tokens in messages", () => {
    logger.error("token issue: ya29.A0ARrdaM_FAKE_TOKEN_DATA");
    expect(calls[0]).toContain("<google_token>");
    expect(calls[0]).not.toContain("ya29.A0ARrdaM");
  });

  it("redacts JWT-shaped strings", () => {
    logger.error(
      "rejected: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.x9b1FAKE"
    );
    expect(calls[0]).toContain("<jwt>");
    expect(calls[0]).not.toContain("eyJhbGciOi");
  });

  it("redacts AWS access keys", () => {
    logger.error("user pasted AKIAIOSFODNN7EXAMPLE");
    expect(calls[0]).toContain("<aws_key>");
    expect(calls[0]).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts api_key=value patterns", () => {
    const fixture = ["abcdef", "1234567890"].join("");
    logger.error(`config: api_key=${fixture}`);
    expect(calls[0]).toContain("api_key=<redacted>");
    expect(calls[0]).not.toContain(fixture);
  });

  it("redacts Bearer tokens in any case", () => {
    logger.error("Authorization: Bearer abc123def456ghi789jkl012");
    expect(calls[0]).toContain("<redacted>");
    expect(calls[0]).not.toContain("abc123def456");
  });

  it("redacts secrets in URL query strings", () => {
    logger.error("upstream call to /api?access_token=secretvalue&id=123");
    expect(calls[0]).toContain("access_token=<redacted>");
    expect(calls[0]).toContain("id=123"); // non-secret param survives
  });
});

describe("logger context redaction", () => {
  it("strips forbidden field names from context objects", () => {
    logger.warn("auth check", {
      user: "alice",
      access_token: "ya29.SECRET",
      api_key: "sk_live_FAKE",
      password: "hunter2",
    });
    const line = calls[0];
    expect(line).toContain('"access_token":"<redacted>"');
    expect(line).toContain('"api_key":"<redacted>"');
    expect(line).toContain('"password":"<redacted>"');
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("sk_live_FAKE");
    expect(line).toContain('"user":"alice"');
  });

  it("recursively redacts nested objects and arrays", () => {
    logger.error("nested", {
      payload: {
        outer: "ok",
        creds: { password: "hunter2", note: "fine" },
      },
      events: [
        { name: "ok" },
        { token: "ya29.NESTED_TOKEN" },
      ],
    });
    const line = calls[0];
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("ya29.NESTED_TOKEN");
    expect(line).toContain('"outer":"ok"');
    expect(line).toContain('"note":"fine"');
  });

  it("includes the ref id in the emitted line", () => {
    const ref = logger.info("hello");
    expect(ref).toMatch(/^ref_[0-9a-f]{8}$/);
    expect(calls[0]).toContain(ref);
  });
});

describe("logError", () => {
  it("redacts message content from a thrown Error", () => {
    const err = new Error("MS Graph 401: Bearer ya29.LEAKED_TOKEN_VALUE");
    logError(err, { route: "/api/scan" });
    const line = calls[0];
    expect(line).not.toContain("ya29.LEAKED");
    expect(line).toContain('"route":"/api/scan"');
    expect(line).toContain('"name":"Error"');
  });

  it("returns the ref so callers can echo it back to the user", () => {
    const ref = logError(new Error("boom"));
    expect(ref).toMatch(/^ref_[0-9a-f]{8}$/);
  });

  it("handles non-Error thrown values safely", () => {
    expect(() => logError("string error")).not.toThrow();
    expect(() => logError(undefined)).not.toThrow();
    expect(() => logError({ weird: true })).not.toThrow();
  });
});
