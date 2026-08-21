import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ENTERPRISE_SETUP_COPY,
  buildAgentGuardEnterpriseSetupGuide,
} from "../enterprise-setup";
import type { AgentGuardOperatorCommandCenter } from "../operator-command-center";
import type { AgentGuardPilotReadinessReport } from "../pilot-readiness-report";

function report(
  overrides: Partial<AgentGuardPilotReadinessReport> = {}
): AgentGuardPilotReadinessReport {
  return {
    generatedAt: "2026-05-16T21:00:00.000Z",
    status: "setup_required",
    label: "Setup required",
    summary: "AgentGuard still needs setup.",
    boundary: "Metadata-only readiness evidence.",
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

function commandCenter(
  overrides: Partial<AgentGuardOperatorCommandCenter> = {}
): AgentGuardOperatorCommandCenter {
  return {
    generatedAt: "2026-05-16T21:00:00.000Z",
    status: "setup_required",
    label: "Setup required",
    summary: "AgentGuard still needs setup.",
    boundary: "Read-only setup guidance.",
    primaryAction: {
      id: "active_source",
      label: "Create and test a source key",
      detail: "Create a source key.",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Create source",
      tone: "blue",
    },
    secondaryActions: [],
    signals: [],
    ...overrides,
  };
}

function readyReport(): AgentGuardPilotReadinessReport {
  return report({
    status: "ready_for_pilot",
    label: "Ready for pilot",
    summary: "Core signals support a controlled pilot.",
    metrics: {
      ...report().metrics,
      configuredSourceCount: 1,
      activeSourceCount: 1,
      recentActivitySourceCount: 1,
      policyOutcomeSourceCount: 1,
      needsPolicyScopeCount: 0,
      needsActionReviewCount: 0,
      policyCount: 2,
      enabledPolicyCount: 2,
      exportDestinationCount: 1,
      liveExportDestinationCount: 0,
      acknowledgementCount: 1,
      acknowledgedSourceCount: 1,
    },
  });
}

describe("AgentGuard enterprise setup guide", () => {
  it("selects source setup when no active source exists", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: report(),
      commandCenter: commandCenter(),
      evidencePacketCount: 0,
    });

    expect(guide.status).toBe("setup_required");
    expect(guide.nextStep.id).toBe("source_setup");
    expect(guide.nextStep.href).toBe("/dashboard/agent-guard/ingestion");
  });

  it("selects test activity when source exists but no activity is submitted", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: report({
        metrics: {
          ...report().metrics,
          configuredSourceCount: 1,
          activeSourceCount: 1,
        },
      }),
      commandCenter: commandCenter(),
      evidencePacketCount: 0,
    });

    expect(guide.nextStep.id).toBe("test_activity");
    expect(guide.nextStep.cta).toBe("Send test event");
  });

  it("selects policy coverage when activity lacks outcomes", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: report({
        status: "needs_review",
        label: "Needs review",
        metrics: {
          ...report().metrics,
          configuredSourceCount: 1,
          activeSourceCount: 1,
          recentActivitySourceCount: 1,
          policyCount: 2,
          enabledPolicyCount: 2,
          needsPolicyScopeCount: 1,
        },
      }),
      commandCenter: commandCenter(),
      evidencePacketCount: 0,
    });

    expect(guide.status).toBe("needs_review");
    expect(guide.nextStep.id).toBe("policy_coverage");
    expect(guide.nextStep.href).toBe("/dashboard/agent-guard/policies");
  });

  it("selects review queue when reviews still need action", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: report({
        status: "needs_review",
        label: "Needs review",
        metrics: {
          ...report().metrics,
          configuredSourceCount: 1,
          activeSourceCount: 1,
          recentActivitySourceCount: 1,
          policyOutcomeSourceCount: 1,
          policyCount: 2,
          enabledPolicyCount: 2,
          needsActionReviewCount: 3,
        },
      }),
      commandCenter: commandCenter(),
      evidencePacketCount: 0,
    });

    expect(guide.nextStep.id).toBe("review_queue");
    expect(guide.nextStep.href).toBe("/dashboard/agent-guard/reviews");
  });

  it("selects saved evidence when ready posture has no packet history", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: readyReport(),
      commandCenter: commandCenter({
        status: "ready_for_pilot",
        label: "Ready for pilot",
        primaryAction: {
          ...commandCenter().primaryAction,
          id: "controlled_pilot",
          label: "Run a controlled pilot",
        },
      }),
      evidencePacketCount: 0,
    });

    expect(guide.nextStep.id).toBe("saved_evidence");
    expect(guide.nextStep.href).toBe("/dashboard/agent-guard/readiness");
  });

  it("marks setup enterprise-ready when all phases have supporting evidence", () => {
    const guide = buildAgentGuardEnterpriseSetupGuide({
      report: readyReport(),
      commandCenter: commandCenter({
        status: "ready_for_pilot",
        label: "Ready for pilot",
      }),
      evidencePacketCount: 2,
    });

    expect(guide.status).toBe("enterprise_ready");
    expect(guide.progress.completedSteps).toBe(guide.progress.totalSteps);
  });

  it("keeps setup copy read-only and non-compliance-oriented", () => {
    const text = Object.values(AGENT_GUARD_ENTERPRISE_SETUP_COPY).join(" ");

    expect(text).toContain("enterprise-readiness setup guidance");
    expect(text).toContain("submitted activity");
    expect(text).toContain("read-only setup guidance");
    expect(text).toContain("does not create source keys");
    expect(text).toContain("change policies");
    expect(text).toContain("save packets");
    expect(text).toContain("create acknowledgements");
    expect(text).toContain("expand enforcement");
    expect(text).not.toContain("certify compliance");
  });
});
