import { describe, expect, it } from "vitest";
import {
  agentGuardPilotReadinessReportToText,
  AGENT_GUARD_PILOT_READINESS_COPY,
  buildAgentGuardPilotReadinessReport,
  type AgentGuardPilotReadinessPolicy,
} from "../pilot-readiness-report";
import {
  buildAgentGuardProductionRolloutGuardrails,
  type AgentGuardProductionRolloutExportDestination,
  type AgentGuardProductionRolloutSource,
} from "../production-rollout";
import type { AgentGuardRolloutAcknowledgement } from "../rollout-acknowledgements";
import type {
  AgentGuardSourcePolicyCoverage,
  AgentGuardSourcePolicyCoverageRow,
} from "../source-policy-coverage";

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
    latestOutcomeAt: "2026-05-16T12:05:00.000Z",
    latestSignalAt: "2026-05-16T12:05:00.000Z",
    topTools: ["ChatGPT"],
    ...overrides,
  };
}

function coverage(rows: AgentGuardSourcePolicyCoverageRow[]): AgentGuardSourcePolicyCoverage {
  return {
    rows,
    summary: {
      configuredSourceCount: rows.filter((row) => row.isConfiguredSource).length,
      activeSourceCount: rows.filter((row) => row.sourceStatus === "active").length,
      recentActivitySourceCount: rows.filter((row) => row.recentActivityCount > 0)
        .length,
      policyOutcomeSourceCount: rows.filter((row) => row.policyOutcomeCount > 0)
        .length,
      needsPolicyScopeCount: rows.filter(
        (row) => row.coverageStatus === "needs_policy_scope"
      ).length,
      needsActionReviewCount: rows.reduce(
        (total, row) => total + row.needsActionReviewCount,
        0
      ),
      testOrDemoSourceCount: rows.filter(
        (row) => row.coverageStatus === "test_or_demo"
      ).length,
      revokedSourceCount: rows.filter((row) => row.coverageStatus === "revoked")
        .length,
      unknownSourceCount: rows.filter(
        (row) => row.coverageStatus === "unknown_source"
      ).length,
      unattributedReviewOutcomeCount: 0,
    },
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
    healthStatus: "dry_run",
    healthLabel: "Dry-run",
    ...overrides,
  };
}

function acknowledgement(
  overrides: Partial<AgentGuardRolloutAcknowledgement> = {}
): AgentGuardRolloutAcknowledgement {
  return {
    id: "ack-1",
    sourceId: "source-1",
    sourceName: "Production wrapper",
    sourceEnvironment: "production",
    sourceStatus: "active",
    sourceRolloutStatus: "ready_for_pilot",
    sourceRolloutLabel: "Ready for pilot",
    sourceNextStep: "Ready for a controlled pilot.",
    overallRolloutStatus: "ready_for_pilot",
    overallRolloutLabel: "Ready for pilot",
    exportPostureLabel: "Dry-run export",
    exportWarning: null,
    checklistSnapshot: [],
    metricsSnapshot: {
      activeSourceCount: 1,
      activeProductionSourceCount: 1,
      recentActivitySourceCount: 1,
      policyOutcomeSourceCount: 1,
      needsReviewSourceCount: 0,
      needsActionReviewCount: 0,
      liveExportDestinationCount: 0,
      failingExportDestinationCount: 0,
    },
    note: "Reviewed for pilot.",
    acknowledgedByUserId: "user-1",
    acknowledgedByEmail: "operator@example.com",
    createdAt: "2026-05-16T18:00:00.000Z",
    ...overrides,
  };
}

const policies: AgentGuardPilotReadinessPolicy[] = [
  { id: "policy-1", name: "Credential block", enabled: true, action: "block" },
  { id: "policy-2", name: "Regulated data review", enabled: false, action: "warn" },
];

describe("AgentGuard pilot readiness report", () => {
  it("keeps empty setup in setup required posture", () => {
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [],
      coverageRows: [],
      exportDestinations: [],
    });

    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage([]),
      rollout,
      policies: [],
      exportDestinations: [],
      acknowledgements: [],
      generatedAt: "2026-05-16T19:00:00.000Z",
    });

    expect(report.status).toBe("setup_required");
    expect(report.concerns.find((concern) => concern.id === "active_source")).toBeTruthy();
    expect(report.metrics.activeSourceCount).toBe(0);
  });

  it("builds pilot-ready evidence for covered production source with acknowledgement", () => {
    const rows = [coverageRow()];
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: rows,
      exportDestinations: [destination()],
    });

    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage(rows),
      rollout,
      policies,
      exportDestinations: [destination()],
      acknowledgements: [acknowledgement()],
      generatedAt: "2026-05-16T19:00:00.000Z",
    });

    expect(report.status).toBe("ready_for_pilot");
    expect(report.concerns).toEqual([]);
    expect(report.metrics.acknowledgedSourceCount).toBe(1);
    expect(report.nextActions[0]?.id).toBe("controlled_pilot");
  });

  it("surfaces activity without policy outcomes as needs review", () => {
    const rows = [
      coverageRow({
        coverageStatus: "needs_policy_scope",
        coverageLabel: "Needs policy scope",
        policyOutcomeCount: 0,
        blockOutcomeCount: 0,
        reviewOutcomeCount: 0,
      }),
    ];
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: rows,
      exportDestinations: [],
    });

    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage(rows),
      rollout,
      policies,
      exportDestinations: [],
      acknowledgements: [],
    });

    expect(report.status).toBe("needs_review");
    expect(report.concerns.map((concern) => concern.id)).toContain(
      "source_policy_scope"
    );
    expect(report.metrics.missingProductionAcknowledgementCount).toBe(1);
  });

  it("surfaces live automatic export as live caution", () => {
    const rows = [coverageRow()];
    const liveDestination = destination({
      status: "enabled",
      automaticDeliveryEnabled: true,
      dryRunEnabled: false,
      healthStatus: "live",
      healthLabel: "Live sends",
    });
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: rows,
      exportDestinations: [liveDestination],
    });

    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage(rows),
      rollout,
      policies,
      exportDestinations: [liveDestination],
      acknowledgements: [acknowledgement({ overallRolloutStatus: "live_caution" })],
    });

    expect(report.status).toBe("live_caution");
    expect(report.concerns.find((concern) => concern.id === "export_mode")?.severity).toBe(
      "live_caution"
    );
  });

  it("flags acknowledgement evidence that no longer matches current posture", () => {
    const rows = [
      coverageRow({
        coverageStatus: "needs_policy_scope",
        coverageLabel: "Needs policy scope",
        policyOutcomeCount: 0,
        blockOutcomeCount: 0,
        reviewOutcomeCount: 0,
      }),
    ];
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: rows,
      exportDestinations: [],
    });

    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage(rows),
      rollout,
      policies,
      exportDestinations: [],
      acknowledgements: [acknowledgement()],
    });

    expect(report.metrics.staleAcknowledgementCount).toBe(1);
    expect(report.acknowledgementEvidence[0]?.stale).toBe(true);
    expect(report.concerns.map((concern) => concern.id)).toContain(
      "stale_acknowledgements"
    );
  });

  it("generates conservative copyable report text", () => {
    const rows = [coverageRow()];
    const rollout = buildAgentGuardProductionRolloutGuardrails({
      sources: [source()],
      coverageRows: rows,
      exportDestinations: [destination()],
    });
    const report = buildAgentGuardPilotReadinessReport({
      coverage: coverage(rows),
      rollout,
      policies,
      exportDestinations: [destination()],
      acknowledgements: [acknowledgement()],
      generatedAt: "2026-05-16T19:00:00.000Z",
    });

    const text = agentGuardPilotReadinessReportToText(report);

    expect(text).toContain("AgentGuard pilot readiness evidence packet");
    expect(text).toContain("Posture: Ready for pilot");
    expect(text).toContain("Sources with recent submitted activity");
    expect(text).toContain("metadata-only operator evidence");
    expect(text).toContain("not a certification");
    expect(text).not.toContain("certify compliance");
  });

  it("keeps report copy read-only and non-compliance-oriented", () => {
    const text = Object.values(AGENT_GUARD_PILOT_READINESS_COPY).join(" ");

    expect(text).toContain("Read-only pilot readiness evidence");
    expect(text).toContain("submitted activity");
    expect(text).toContain("metadata-only operator evidence");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("does not");
    expect(text).toContain("change policies");
  });
});
