import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_FIRST_SOURCE_CHECKLIST,
  AGENT_GUARD_INTEGRATION_EXAMPLES,
  agentGuardSourceHealth,
  deriveAgentGuardChecklistState,
} from "../integration-kit";

describe("AgentGuard integration kit", () => {
  it("defines a complete first-source checklist", () => {
    expect(AGENT_GUARD_FIRST_SOURCE_CHECKLIST.map((item) => item.id)).toEqual([
      "create-source",
      "store-key",
      "send-test",
      "review-health",
      "tighten-scope",
    ]);

    for (const item of AGENT_GUARD_FIRST_SOURCE_CHECKLIST) {
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.description).toContain(".");
    }
  });

  it("derives onboarding progress from existing source state", () => {
    const state = deriveAgentGuardChecklistState({
      hasVisibleSourceKey: false,
      sources: [
        {
          id: "source-1",
          status: "active",
          lastUsedAt: "2026-05-16T12:00:00.000Z",
          allowedToolNames: ["ChatGPT"],
        },
      ],
    });

    expect(Object.fromEntries(state.map((item) => [item.id, item.completed]))).toEqual({
      "create-source": true,
      "store-key": true,
      "send-test": true,
      "review-health": true,
      "tighten-scope": true,
    });
  });

  it("does not mark scope complete for an unrestricted never-used source", () => {
    const state = deriveAgentGuardChecklistState({
      hasVisibleSourceKey: true,
      sources: [
        {
          id: "source-1",
          status: "active",
          lastUsedAt: null,
          allowedToolNames: [],
        },
      ],
      testResult: { status: "failed", sourceId: "source-1" },
    });

    expect(Object.fromEntries(state.map((item) => [item.id, item.completed]))).toMatchObject({
      "create-source": true,
      "store-key": true,
      "send-test": false,
      "review-health": false,
      "tighten-scope": false,
    });
  });

  it("derives source health labels conservatively", () => {
    expect(
      agentGuardSourceHealth({
        id: "source-1",
        status: "active",
        lastUsedAt: "2026-05-16T12:00:00.000Z",
      }).id
    ).toBe("working");

    expect(
      agentGuardSourceHealth({
        id: "source-2",
        status: "active",
        lastUsedAt: null,
      }).id
    ).toBe("never_used");

    expect(
      agentGuardSourceHealth({
        id: "source-3",
        status: "revoked",
        lastUsedAt: null,
      }).id
    ).toBe("revoked");

    expect(
      agentGuardSourceHealth(
        {
          id: "source-4",
          status: "active",
          lastUsedAt: null,
        },
        { status: "failed", sourceId: "source-4" }
      ).id
    ).toBe("test_failed");
  });

  it("provides server-side examples without embedding source keys", () => {
    expect(AGENT_GUARD_INTEGRATION_EXAMPLES.map((example) => example.id)).toEqual([
      "generic-fetch",
      "next-route-handler",
      "express-wrapper",
    ]);

    for (const example of AGENT_GUARD_INTEGRATION_EXAMPLES) {
      expect(example.code).toContain("/api/agent-guard/activity");
      expect(example.code).toContain("authorization");
      expect(example.code).toContain("AGENTGUARD_INGEST_TOKEN");
      expect(example.code).not.toContain("sgag_");
    }
  });

  it("avoids unsupported automatic monitoring claims", () => {
    const text = JSON.stringify({
      checklist: AGENT_GUARD_FIRST_SOURCE_CHECKLIST,
      examples: AGENT_GUARD_INTEGRATION_EXAMPLES,
    });

    expect(text).not.toContain("automatically monitors");
    expect(text).not.toContain("monitors all");
    expect(text).not.toContain("universal collector");
    expect(text).not.toContain("SIEM export");
  });
});
