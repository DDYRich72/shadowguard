import { describe, expect, it } from "vitest";
import { buildSafeMCPRawPayload, sanitizeMCPEventMetadata } from "../events";

describe("MCP event metadata sanitization", () => {
  it("removes raw content and secret-like metadata keys recursively", () => {
    const sanitized = sanitizeMCPEventMetadata({
      resource: "customer-records",
      prompt: "send the customer list",
      nested: {
        token: "secret",
        region: "us",
        payload: "raw",
      },
      tags: ["approved", { password: "hidden", label: "kept" }],
    });

    expect(sanitized.resource).toBe("customer-records");
    expect(sanitized.prompt).toBeUndefined();
    expect((sanitized.nested as Record<string, unknown>).token).toBeUndefined();
    expect((sanitized.nested as Record<string, unknown>).region).toBe("us");
    expect((sanitized.tags as unknown[])[1]).toEqual({ label: "kept" });
  });

  it("limits string size and stores lengths separately", () => {
    const sanitized = sanitizeMCPEventMetadata({ label: "a".repeat(700) });

    expect((sanitized.label as string).length).toBe(500);
    expect(
      buildSafeMCPRawPayload({
        content: "abc",
        inputContent: "input",
        outputContent: "output",
      })
    ).toEqual({
      content_length: 3,
      input_length: 5,
      output_length: 6,
    });
  });

  it("redacts secret-looking values and strips query result metadata keys", () => {
    const sanitized = sanitizeMCPEventMetadata({
      label: "github token ghp_abcdefghijklmnopqrstuvwxyz123456",
      queryResult: [{ customer: "raw database row" }],
      fileContent: "raw file body",
      safe: "workspace label",
    });

    expect(sanitized.label).toBe("[redacted-sensitive-value]");
    expect(sanitized.queryResult).toBeUndefined();
    expect(sanitized.fileContent).toBeUndefined();
    expect(sanitized.safe).toBe("workspace label");
  });
});
