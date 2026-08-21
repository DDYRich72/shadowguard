import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ACTIVITY_SNIPPET,
  AGENT_GUARD_CURRENT_CAPABILITIES,
  AGENT_GUARD_DEMO_ACTIVITIES,
  AGENT_GUARD_NOT_SHIPPED_YET,
  AGENT_GUARD_SOURCE_KEY_SNIPPET,
  prepareAgentActivity,
  sanitizeAgentActivityMetadata,
} from "../activity";
import type { AgentPolicy } from "../engine";

function blockPolicy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
  return {
    id: "policy-block-restricted",
    orgId: "org-1",
    name: "Block restricted data",
    description: "",
    enabled: true,
    priority: 1,
    conditions: [{ field: "sensitivity", operator: "equals", value: "restricted" }],
    action: "block",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("sanitizeAgentActivityMetadata", () => {
  it("strips obvious raw-content keys recursively", () => {
    const sanitized = sanitizeAgentActivityMetadata({
      content: "top-level",
      prompt: "top-level",
      source: "test",
      nested: {
        message: "nested",
        safe: "kept",
        deeper: {
          raw: "hidden",
          label: "visible",
        },
      },
    });

    expect(sanitized).toEqual({
      source: "test",
      nested: {
        safe: "kept",
        deeper: {
          label: "visible",
        },
      },
    });
  });

  it("redacts metadata values that repeat the submitted raw content", () => {
    const raw = "customer secret payload";
    const sanitized = sanitizeAgentActivityMetadata(
      {
        safeLabel: "demo",
        transcriptCopy: `prefix ${raw} suffix`,
      },
      raw
    );

    expect(sanitized.safeLabel).toBe("demo");
    expect(sanitized.transcriptCopy).toBe("<redacted>");
  });
});

describe("prepareAgentActivity", () => {
  it("builds a persistence shape without raw submitted content", () => {
    const raw = "api_key = demo-super-secret";
    const prepared = prepareAgentActivity(
      {
        orgId: "org-1",
        toolName: "Unknown AI Assistant",
        userEmail: "ops@example.com",
        activityType: "prompt_sent",
        content: raw,
        metadata: {
          source: "unit-test",
          prompt: raw,
          nested: { message: raw },
          copiedIntoAllowedKey: raw,
        },
      },
      []
    );

    const serialized = JSON.stringify(prepared.insert);
    expect(serialized).not.toContain(raw);
    expect(prepared.insert.raw_payload).toEqual({ content_length: raw.length });
    expect(prepared.insert.metadata).toEqual({
      source: "unit-test",
      nested: {},
      copiedIntoAllowedKey: "<redacted>",
    });
    expect(prepared.insert.credentials_detected).toBe(true);
  });

  it("returns blocking policy metadata when a block policy matches", () => {
    const prepared = prepareAgentActivity(
      {
        orgId: "org-1",
        toolName: "ChatGPT",
        userEmail: "analyst@example.com",
        activityType: "prompt_sent",
        content: "password: demo-only",
      },
      [blockPolicy()]
    );

    expect(prepared.blocked).toBe(true);
    expect(prepared.reason).toContain("Block restricted data");
    expect(prepared.blockedByPolicyId).toBe("policy-block-restricted");
    expect(prepared.insert.blocked).toBe(true);
    expect(prepared.insert.blocked_by_policy_id).toBe("policy-block-restricted");
  });

  it("keeps warn and quarantine matches available without blocking", () => {
    const prepared = prepareAgentActivity(
      {
        orgId: "org-1",
        toolName: "ChatGPT",
        userEmail: "analyst@example.com",
        activityType: "file_upload",
        content: "Customer email is alex@example.com",
      },
      [
        blockPolicy({
          id: "warn-pii",
          name: "Warn on email",
          action: "warn",
          priority: 2,
          conditions: [{ field: "dataCategory", operator: "contains", value: "Email" }],
        }),
        blockPolicy({
          id: "quarantine-upload",
          name: "Quarantine uploads",
          action: "quarantine",
          priority: 3,
          conditions: [{ field: "activityType", operator: "equals", value: "file_upload" }],
        }),
      ]
    );

    expect(prepared.blocked).toBe(false);
    expect(prepared.reason).toBe("No blocking policy matched");
    expect(prepared.policyMatches.map((match) => match.policyAction)).toEqual([
      "warn",
      "quarantine",
    ]);
  });
});

describe("AgentGuard beta guidance constants", () => {
  it("provides a snippet for the shipped activity ingest route", () => {
    expect(AGENT_GUARD_ACTIVITY_SNIPPET).toContain("/api/agent-guard/activity");
    expect(AGENT_GUARD_ACTIVITY_SNIPPET).toContain("credentials: \"include\"");
    expect(AGENT_GUARD_ACTIVITY_SNIPPET).toContain("content: promptText");
  });

  it("provides a source-key snippet without embedding a real key", () => {
    expect(AGENT_GUARD_SOURCE_KEY_SNIPPET).toContain("AGENTGUARD_INGEST_TOKEN");
    expect(AGENT_GUARD_SOURCE_KEY_SNIPPET).toContain("authorization");
    expect(AGENT_GUARD_SOURCE_KEY_SNIPPET).not.toContain("sgag_");
  });

  it("moves scoped source keys into shipped capabilities", () => {
    expect(AGENT_GUARD_CURRENT_CAPABILITIES.join(" ")).toContain("scoped source keys");
    expect(AGENT_GUARD_NOT_SHIPPED_YET.join(" ")).not.toContain("scoped ingest tokens");
  });

  it("marks demo activities as safe dashboard demo data", () => {
    expect(AGENT_GUARD_DEMO_ACTIVITIES.length).toBeGreaterThan(0);
    for (const sample of AGENT_GUARD_DEMO_ACTIVITIES) {
      expect(sample.metadata.source).toBe("agentguard_demo");
      expect(sample.metadata.demo).toBe(true);
      expect(sample.userEmail).toContain("@example.com");
    }
  });
});
