import { describe, expect, it } from "vitest";
import { evaluateApiMutationOrigin } from "../security";

function headers(init: Record<string, string> = {}) {
  return new Headers(init);
}

describe("API mutation origin guard", () => {
  it("allows safe methods without an origin check", () => {
    expect(
      evaluateApiMutationOrigin({
        method: "GET",
        url: "https://guard.example/api/agent-guard/activity",
        headers: headers({ origin: "https://evil.example" }),
      })
    ).toEqual({ allowed: true, reason: "safe_method" });
  });

  it("allows same-origin browser mutations", () => {
    expect(
      evaluateApiMutationOrigin({
        method: "POST",
        url: "https://guard.example/api/agent-guard/ingest-sources",
        headers: headers({
          origin: "https://guard.example",
          "sec-fetch-site": "same-origin",
        }),
      })
    ).toEqual({ allowed: true, reason: "same_origin" });
  });

  it("allows server-to-server mutations with no browser origin", () => {
    expect(
      evaluateApiMutationOrigin({
        method: "POST",
        url: "https://guard.example/api/agent-guard/activity",
        headers: headers({ "user-agent": "CustomerIntegration/1.0" }),
      })
    ).toEqual({ allowed: true, reason: "server_to_server" });
  });

  it("rejects cross-site browser fetch mutations", () => {
    expect(
      evaluateApiMutationOrigin({
        method: "POST",
        url: "https://guard.example/api/agent-guard/activity",
        headers: headers({ "sec-fetch-site": "cross-site" }),
      })
    ).toEqual({ allowed: false, reason: "cross_site_fetch" });
  });

  it("rejects origin mismatches and null origins", () => {
    expect(
      evaluateApiMutationOrigin({
        method: "PATCH",
        url: "https://guard.example/api/alerts",
        headers: headers({ origin: "https://attacker.example" }),
      })
    ).toEqual({ allowed: false, reason: "origin_mismatch" });

    expect(
      evaluateApiMutationOrigin({
        method: "DELETE",
        url: "https://guard.example/api/agent-guard/policies/pol-1",
        headers: headers({ origin: "null" }),
      })
    ).toEqual({ allowed: false, reason: "invalid_origin" });
  });
});
