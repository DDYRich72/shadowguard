import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY,
  buildAgentGuardOperatorCommandCenter,
} from "../operator-command-center";
import type {
  AgentGuardPilotReadinessConcern,
  AgentGuardPilotReadinessReport,
} from "../pilot-readiness-report";

function concern(
  overrides: Partial<AgentGuardPilotReadinessConcern>
): AgentGuardPilotReadinessConcern {
  return {
    id: "active_source",
    label: "No active source",
    severity: "blocked",
    summary: "Create and prove at least one active source before rollout.",
    nextAction: "Create and test a scoped server-side source key.",
    ...overrides,
  };
}

function report(
  overrides: Partial<AgentGuardPilotReadinessReport> = {}
): AgentGuardPilotReadinessReport {
  return {
    generatedAt: "2026-05-16T19:00:00.000Z",
    status: "setup_required",
    label: "Setup required",
    summary: "AgentGuard still needs setup or proof activity.",
    boundary: "Read-only metadata evidence.",
    metrics: {
      configuredSourceCount: 0,
      activeSourceCount: 0,
      recentActivitySourceCount: 0,
      policyOutcomeSourceCount: 0,
      needsPolicyScopeCount: 0,
      needsActionReviewCount: 0,
      policyCount: 0,
      enabledPolicyCount: 0,
      exportDestinationCount: 0,
      liveExportDestinationCount: 0,
      acknowledgementCount: 0,
      acknowledgedSourceCount: 0,
      staleAcknowledgementCount: 0,
      missingProductionAcknowledgementCount: 0,
    },
    evidenceMetrics: [],
    concerns: [],
    nextActions: [],
    acknowledgementEvidence: [],
    loadWarnings: [],
    ...overrides,
  };
}

describe("AgentGuard operator command center", () => {
  it("selects Ingestion when a source still needs to be created", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({ concerns: [concern({ id: "active_source" })] })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/ingestion");
    expect(commandCenter.primaryAction.cta).toBe("Create source");
    expect(commandCenter.primaryAction.label).toContain("source key");
  });

  it("selects Ingestion when recent activity still needs proof", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        concerns: [
          concern({
            id: "recent_activity",
            label: "Recent activity not proven",
            severity: "attention",
            nextAction: "Send a safe test event and verify source attribution.",
          }),
        ],
      })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/ingestion");
    expect(commandCenter.primaryAction.cta).toBe("Send test event");
  });

  it("selects Policies for policy coverage concerns", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        concerns: [
          concern({
            id: "source_policy_scope",
            label: "Source activity without outcomes",
            severity: "blocked",
            nextAction: "Tune policy conditions or source allowed-tool scope.",
          }),
        ],
      })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/policies");
    expect(commandCenter.primaryAction.cta).toBe("Review policies");
  });

  it("selects Reviews for review queue ownership concerns", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        status: "needs_review",
        label: "Needs review",
        concerns: [
          concern({
            id: "review_capacity",
            label: "Review queue needs ownership",
            severity: "attention",
            nextAction: "Work open and investigating policy reviews.",
          }),
        ],
      })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/reviews");
    expect(commandCenter.primaryAction.cta).toBe("Work reviews");
  });

  it("selects Settings for live export posture concerns", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        status: "live_caution",
        label: "Live caution",
        metrics: {
          ...report().metrics,
          liveExportDestinationCount: 1,
        },
        concerns: [
          concern({
            id: "export_mode",
            label: "Live export is armed",
            severity: "live_caution",
            nextAction: "Confirm receiver behavior before live sends stay armed.",
          }),
        ],
      })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/settings");
    expect(commandCenter.primaryAction.cta).toBe("Check exports");
    expect(commandCenter.signals.find((signal) => signal.id === "exports")?.tone).toBe(
      "red"
    );
  });

  it("selects Ingestion for stale rollout acknowledgement evidence", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        concerns: [
          concern({
            id: "stale_acknowledgements",
            label: "Acknowledgement may be stale",
            severity: "attention",
            nextAction: "Record a fresh acknowledgement after review.",
          }),
        ],
      })
    );

    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/ingestion");
    expect(commandCenter.primaryAction.cta).toBe("Record review");
  });

  it("selects Readiness when the pilot posture is ready with no open concerns", () => {
    const commandCenter = buildAgentGuardOperatorCommandCenter(
      report({
        status: "ready_for_pilot",
        label: "Ready for pilot",
        summary: "Core signals support a controlled pilot.",
        metrics: {
          ...report().metrics,
          configuredSourceCount: 1,
          activeSourceCount: 1,
          recentActivitySourceCount: 1,
          policyOutcomeSourceCount: 1,
        },
      })
    );

    expect(commandCenter.primaryAction.id).toBe("controlled_pilot");
    expect(commandCenter.primaryAction.href).toBe("/dashboard/agent-guard/readiness");
    expect(commandCenter.primaryAction.cta).toBe("Open readiness report");
  });

  it("keeps command-center copy read-only and non-mutating", () => {
    const text = Object.values(AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY).join(" ");

    expect(text).toContain("Deterministic next-action guidance");
    expect(text).toContain("submitted activity");
    expect(text).toContain("read-only guidance");
    expect(text).toContain("does not create source keys");
    expect(text).toContain("change policies");
    expect(text).toContain("mutate reviews");
    expect(text).toContain("change export settings");
    expect(text).toContain("create acknowledgements");
    expect(text).toContain("expand enforcement");
  });
});
