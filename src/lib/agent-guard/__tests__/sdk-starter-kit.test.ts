import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SDK_BOUNDARY,
  AGENT_GUARD_SDK_ENV_VARS,
  AGENT_GUARD_SDK_EXAMPLES,
  AGENT_GUARD_SDK_REQUEST_FIELDS,
  AGENT_GUARD_SDK_RESPONSE_FIELDS,
  buildAgentGuardSdkReadmeText,
} from "../sdk-starter-kit";

describe("AgentGuard SDK starter kit", () => {
  it("defines the expected starter examples", () => {
    expect(AGENT_GUARD_SDK_EXAMPLES.map((example) => example.id)).toEqual([
      "typescript-helper",
      "python-requests",
      "curl-smoke-test",
      "ai-proxy-wrapper",
    ]);

    for (const example of AGENT_GUARD_SDK_EXAMPLES) {
      expect(example.label.length).toBeGreaterThan(3);
      expect(example.runtime.length).toBeGreaterThan(2);
      expect(example.summary.length).toBeGreaterThan(10);
      expect(example.code).toContain("/api/agent-guard/activity");
    }
  });

  it("keeps source keys server-side in examples", () => {
    const text = JSON.stringify(AGENT_GUARD_SDK_EXAMPLES);
    expect(text).toContain("AGENTGUARD_INGEST_TOKEN");
    expect(text).toContain("authorization");
    expect(text).not.toContain("sgag_");
    expect(text).not.toContain("localStorage");
    expect(text).not.toContain("sessionStorage");
    expect(text).not.toContain("document.cookie");
    expect(text).not.toContain("window.");
  });

  it("documents the current request and response fields", () => {
    expect(AGENT_GUARD_SDK_REQUEST_FIELDS.map((field) => field.name)).toEqual([
      "toolName",
      "userEmail",
      "activityType",
      "content",
      "metadata",
    ]);

    expect(AGENT_GUARD_SDK_RESPONSE_FIELDS.map((field) => field.name)).toEqual([
      "id",
      "blocked",
      "reason",
      "riskLevel",
      "policyId",
      "policyActions",
    ]);
  });

  it("builds a README-style setup handoff", () => {
    const readme = buildAgentGuardSdkReadmeText();
    for (const envVar of AGENT_GUARD_SDK_ENV_VARS) {
      expect(readme).toContain(envVar.name);
    }
    expect(readme).toContain("POST /api/agent-guard/activity");
    expect(readme).toContain("Authorization: Bearer");
    expect(readme).toContain("Request fields");
    expect(readme).toContain("Decision response fields");
    expect(readme).toContain("server-side secrets");
    expect(readme).toContain(AGENT_GUARD_SDK_BOUNDARY);
  });

  it("does not overclaim published SDKs or automatic monitoring", () => {
    const text = `${AGENT_GUARD_SDK_BOUNDARY}\n${buildAgentGuardSdkReadmeText()}\n${JSON.stringify(
      AGENT_GUARD_SDK_EXAMPLES
    )}`;
    expect(text).toContain("not published SDK packages");
    expect(text).toContain("not");
    expect(text).not.toContain("universal collector");
    expect(text).not.toContain("automatically monitors");
    expect(text).not.toContain("monitors every AI tool");
    expect(text).not.toContain("managed SIEM connector");
  });
});
