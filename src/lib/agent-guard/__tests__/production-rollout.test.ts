import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_PRODUCTION_ROLLOUT_COPY,
  buildAgentGuardProductionRolloutGuardrails,
  type AgentGuardProductionRolloutExportDestination,
  type AgentGuardProductionRolloutSource,
} from "../production-rollout";
import type { AgentGuardSourcePolicyCoverageRow } from "../source-policy-coverage";

function source(
  overrides: Partial<AgentGuardProductionRolloutSource> = {}
): AgentGuardProductionRolloutSource {
  return {
    id: "source-1",
    name: "Production wrapper",
    environment: "production",
    status: "active",
    allowedToolNames: ["ChatGPT"],
    ...overrides,
  };
}

function coverageRow(
  overrides: Partial<AgentGuardSourcePolicyCoverageRow> = {}
): AgentGuardSourcePolicyCoverageRow {
  return {
    sourceId: "source-1",
    sourceName: "Production wrapper",
    sourceEnvironment: "production",
    sourceStatus: "active",
    isConfiguredSource: true,
    coverageStatus: "covered",
    coverageLabel: "Policy outcomes present",
    guidance: "Policy outcomes are recorded for this source.",
    recentActivityCount: 3,
    policyOutcomeCount: 2,
    blockOutcomeCount: 1,
    reviewOutcomeCount: 1,
    needsActionReviewCount: 0,
    highOrCriticalRiskCount: 1,
    uniqueToolCount: 1,
    uniqueUserCount: 2,
    latestActivityAt: "2026-05-16T12:00:00.000Z",
    latestOutcomeAt: "2026-05-16T12:02:00.000Z",
    latestSignalAt: "2026-05-16T12:02:00.000Z",
    topTools: ["ChatGPT"],
    ...overrides,
  };
}

function destination(
  overrides: Partial<AgentGuardProductionRolloutExportDestination> = {}
): AgentGuardProductionRolloutExportDestination {
  return {
    id: "destination-1",
    name: "Webhook",
    status: "disabled",
    automaticDeliveryEnabled: false,
    dryRunEnabled: true,
    healthStatus: "disabled",
    healthLabel: "Disabled",
    ...overrides,
  };
}

describe("AgentGuard production rollout guardrails", () => {
  it("keeps empty posture in testing with blocked setup checks", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [],
      coverageRows: [],
      exportDestinations: [],
    });

    expect(rollout.status).toBe("testing");
    expect(rollout.label).toBe("Testing");
    expect(rollout.checklist.find((item) => item.id === "active_source")?.status).toBe(
      "blocked"
    );
    expect(rollout.exportPostureLabel).toBe("No destinations");
  });

  it("marks covered production source with manageable reviews ready for pilot", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: [coverageRow({ needsActionReviewCount: 1 })],
      exportDestinations: [destination({ healthStatus: "dry_run", healthLabel: "Dry-run" })],
    });

    expect(rollout.status).toBe("ready_for_pilot");
    expect(rollout.sourceRows[0]).toMatchObject({
      status: "ready_for_pilot",
      label: "Ready for pilot",
    });
    expect(rollout.checklist.find((item) => item.id === "review_capacity")?.status).toBe(
      "attention"
    );
  });

  it("marks production activity without policy outcomes as needs review", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: [
        coverageRow({
          coverageStatus: "needs_policy_scope",
          coverageLabel: "Needs policy scope",
          policyOutcomeCount: 0,
          blockOutcomeCount: 0,
          reviewOutcomeCount: 0,
        }),
      ],
      exportDestinations: [],
    });

    expect(rollout.status).toBe("needs_review");
    expect(rollout.checklist.find((item) => item.id === "policy_coverage")?.status).toBe(
      "blocked"
    );
    expect(rollout.sourceRows[0]?.nextStep).toContain("without recent policy outcomes");
  });

  it("marks high needs-action review load as needs review", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: [coverageRow({ needsActionReviewCount: 5 })],
      exportDestinations: [],
    });

    expect(rollout.status).toBe("needs_review");
    expect(rollout.metrics.needsActionReviewCount).toBe(5);
    expect(rollout.checklist.find((item) => item.id === "review_capacity")?.status).toBe(
      "blocked"
    );
  });

  it("marks live automatic export as live caution", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: [coverageRow()],
      exportDestinations: [
        destination({
          status: "enabled",
          automaticDeliveryEnabled: true,
          dryRunEnabled: false,
          healthStatus: "live",
          healthLabel: "Live sends",
        }),
      ],
    });

    expect(rollout.status).toBe("live_caution");
    expect(rollout.exportPostureLabel).toBe("Live sends armed");
    expect(rollout.exportWarning).toContain("live metadata-only events");
    expect(rollout.sourceRows[0]?.status).toBe("live_caution");
  });

  it("marks failing export destination as needs review when live sends are not armed", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: [coverageRow()],
      exportDestinations: [
        destination({
          status: "enabled",
          automaticDeliveryEnabled: false,
          dryRunEnabled: true,
          healthStatus: "failing",
          healthLabel: "Failing",
        }),
      ],
    });

    expect(rollout.status).toBe("needs_review");
    expect(rollout.exportPostureLabel).toBe("Export failing");
    expect(rollout.checklist.find((item) => item.id === "export_mode")?.status).toBe(
      "blocked"
    );
  });

  it("keeps test-only posture in testing", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [
        source({
          id: "source-test",
          name: "Smoke test",
          environment: "development",
        }),
      ],
      coverageRows: [
        coverageRow({
          sourceId: "source-test",
          sourceName: "Smoke test",
          sourceEnvironment: "development",
          coverageStatus: "test_or_demo",
          coverageLabel: "Test or non-production",
        }),
      ],
      exportDestinations: [],
    });

    expect(rollout.status).toBe("testing");
    expect(rollout.sourceRows[0]?.status).toBe("testing");
    expect(rollout.checklist.find((item) => item.id === "source_scope")?.status).toBe(
      "attention"
    );
  });

  it("keeps copy advisory and non-mutating", () => {
    const text = Object.values(AGENT_GUARD_PRODUCTION_ROLLOUT_COPY).join(" ");

    expect(text).toContain("Advisory rollout guardrails");
    expect(text).toContain("submitted activity");
    expect(text).toContain("They do not change enforcement");
    expect(text).toContain("does not automatically promote sources");
    expect(text).toContain("tune policies");
    expect(text).toContain("switch export modes");
  });
});
