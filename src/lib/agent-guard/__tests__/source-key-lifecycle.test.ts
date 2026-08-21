import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES,
  buildAgentGuardSourceKeyLifecycleHandoff,
  summarizeAgentGuardSourceKeyLifecycleSource,
  type AgentGuardSourceKeyLifecycleSourceInput,
} from "../source-key-lifecycle";

function source(
  overrides: Partial<AgentGuardSourceKeyLifecycleSourceInput> = {}
): AgentGuardSourceKeyLifecycleSourceInput {
  return {
    id: "source-1",
    name: "Production wrapper",
    environment: "production",
    status: "active",
    tokenHint: "sgag_abcd...wxyz",
    allowedToolNames: ["ChatGPT"],
    createdAt: "2026-05-01T00:00:00.000Z",
    lastUsedAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("AgentGuard source-key lifecycle handoff", () => {
  it("defines a replacement-first source-key lifecycle", () => {
    expect(AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES.map((stage) => stage.id)).toEqual([
      "create",
      "store",
      "test",
      "confirm",
      "rotate",
      "revoke",
      "document",
    ]);

    const text = AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES.map((stage) =>
      [
        stage.label,
        stage.operatorAction,
        stage.customerAction,
        stage.evidence,
        stage.boundary,
      ].join(" ")
    ).join(" ");

    expect(text).toContain("Create a replacement source before touching the old source");
    expect(text).toContain("Revoke the old source only after the replacement source is proven");
    expect(text).toContain("server-side");
    expect(text).not.toContain("automatic monitoring");
  });

  it("produces deterministic next actions for source lifecycle states", () => {
    const now = new Date("2026-05-18T00:00:00.000Z");

    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(source(), now).nextActionId
    ).toBe("keep_operating");
    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(
        source({ lastUsedAt: null }),
        now
      ).nextActionId
    ).toBe("send_test_event");
    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(
        source({ createdAt: "2026-02-25T00:00:00.000Z" }),
        now
      ).nextActionId
    ).toBe("plan_rotation");
    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(
        source({ createdAt: "2026-01-01T00:00:00.000Z" }),
        now
      ).nextActionId
    ).toBe("rotate_now");
    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(
        source({ createdAt: null }),
        now
      ).nextActionId
    ).toBe("confirm_created_date");
    expect(
      summarizeAgentGuardSourceKeyLifecycleSource(
        source({ status: "revoked", lastUsedAt: null }),
        now
      ).nextActionId
    ).toBe("retain_history");
  });

  it("summarizes metrics and source scope for the lifecycle panel", () => {
    const handoff = buildAgentGuardSourceKeyLifecycleHandoff({
      now: new Date("2026-05-18T00:00:00.000Z"),
      generatedAt: "2026-05-18T00:00:00.000Z",
      sources: [
        source({ id: "active-1" }),
        source({
          id: "never-used",
          name: "New staging wrapper",
          environment: "staging",
          lastUsedAt: null,
          allowedToolNames: [],
        }),
        source({
          id: "old-source",
          createdAt: "2026-01-01T00:00:00.000Z",
          tokenHint: "sgag_old1...old2",
        }),
        source({ id: "revoked", status: "revoked", lastUsedAt: null }),
      ],
    });

    expect(handoff.metrics).toEqual({
      totalSources: 4,
      activeSources: 3,
      revokedSources: 1,
      neverUsedSources: 1,
      scopedSources: 3,
      rotationAttentionSources: 1,
    });
    expect(handoff.sources.find((item) => item.id === "never-used")?.scopeLabel).toBe(
      "Any submitted tool name"
    );
    expect(handoff.sources.find((item) => item.id === "old-source")?.lifecycleLabel).toBe(
      "Rotate now"
    );
  });

  it("builds a copyable handoff without raw secrets or behavior claims", () => {
    const handoff = buildAgentGuardSourceKeyLifecycleHandoff({
      now: new Date("2026-05-18T00:00:00.000Z"),
      generatedAt: "2026-05-18T00:00:00.000Z",
      sources: [source()],
    });

    expect(handoff.handoffText).toContain("Source next actions");
    expect(handoff.handoffText).toContain("Key hint only");
    expect(handoff.handoffText).toContain("Use source-key hints only");
    expect(handoff.handoffText).toContain("No automatic rotation or automatic expiry");
    expect(handoff.handoffText).toContain("No source-key recovery");
    expect(handoff.handoffText).toContain("No source, policy, review, export");
    expect(handoff.handoffText).not.toContain("AGENTGUARD_INGEST_TOKEN=");
    expect(handoff.handoffText).not.toContain("localStorage");
    expect(handoff.handoffText).not.toContain("document.cookie");
    expect(handoff.handoffText).not.toContain("certify compliance");
    expect(handoff.handoffText).not.toContain("managed connector is included");
  });

  it("keeps empty source handoffs useful", () => {
    const handoff = buildAgentGuardSourceKeyLifecycleHandoff({
      now: new Date("2026-05-18T00:00:00.000Z"),
      generatedAt: "2026-05-18T00:00:00.000Z",
      sources: [],
    });

    expect(handoff.metrics.totalSources).toBe(0);
    expect(handoff.handoffText).toContain("No sources loaded yet");
    expect(handoff.handoffText).toContain("Create a scoped source");
    expect(handoff.handoffText).toContain("send a safe test event");
  });
});
