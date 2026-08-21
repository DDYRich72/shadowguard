import { describe, expect, it } from "vitest";
import {
  agentGuardEvidencePacketRowToApi,
  agentGuardEvidencePacketToText,
  AGENT_GUARD_EVIDENCE_PACKET_COPY,
  buildAgentGuardEvidencePacketDraft,
  defaultAgentGuardEvidencePacketTitle,
  isMissingAgentGuardEvidencePacketTable,
  type AgentGuardEvidencePacketRow,
} from "../evidence-packets";
import type { AgentGuardOperatorCommandCenter } from "../operator-command-center";
import type { AgentGuardPilotReadinessReport } from "../pilot-readiness-report";

function readinessReport(): AgentGuardPilotReadinessReport {
  return {
    generatedAt: "2026-05-16T20:30:00.000Z",
    status: "needs_review",
    label: "Needs review",
    summary: "AgentGuard has useful setup evidence, but review is needed.",
    boundary:
      "This report is metadata-only operator evidence. It is not legal advice, not a certification, and not a compliance determination.",
    metrics: {
      configuredSourceCount: 2,
      activeSourceCount: 1,
      recentActivitySourceCount: 1,
      policyOutcomeSourceCount: 1,
      needsPolicyScopeCount: 1,
      needsActionReviewCount: 2,
      policyCount: 3,
      enabledPolicyCount: 2,
      exportDestinationCount: 1,
      liveExportDestinationCount: 0,
      acknowledgementCount: 1,
      acknowledgedSourceCount: 1,
      staleAcknowledgementCount: 0,
      missingProductionAcknowledgementCount: 1,
    },
    evidenceMetrics: [
      {
        id: "sources",
        label: "Active sources",
        value: "1",
        detail: "2 configured sources.",
        tone: "green",
      },
    ],
    concerns: [
      {
        id: "source_policy_scope",
        label: "Source activity without outcomes",
        severity: "blocked",
        summary: "One source has activity without policy outcomes.",
        nextAction: "Tune policy conditions or source scope.",
      },
    ],
    nextActions: [
      {
        id: "source_policy_scope",
        label: "Source activity without outcomes",
        detail: "Tune policy conditions or source scope.",
      },
    ],
    acknowledgementEvidence: [
      {
        sourceId: "source-1",
        sourceName: "Production wrapper",
        sourceRolloutLabel: "Needs review",
        overallRolloutLabel: "Needs review",
        exportPostureLabel: "Dry-run export",
        acknowledgedByEmail: "operator@example.com",
        createdAt: "2026-05-16T20:00:00.000Z",
        note: "Reviewed before pilot.",
        stale: false,
      },
    ],
    loadWarnings: ["Export destination posture could not be loaded."],
  };
}

function commandCenter(): AgentGuardOperatorCommandCenter {
  return {
    generatedAt: "2026-05-16T20:30:00.000Z",
    status: "needs_review",
    label: "Needs review",
    summary: "AgentGuard has useful setup evidence, but review is needed.",
    boundary:
      "This command center is read-only guidance and does not expand enforcement.",
    primaryAction: {
      id: "source_policy_scope",
      label: "Review policy coverage",
      detail: "Tune policy conditions or source allowed-tool scope.",
      href: "/dashboard/agent-guard/policies",
      cta: "Review policies",
      tone: "red",
    },
    secondaryActions: [
      {
        id: "missing_acknowledgements",
        label: "Refresh rollout acknowledgement evidence",
        detail: "Record source-level rollout acknowledgement.",
        href: "/dashboard/agent-guard/ingestion",
        cta: "Record review",
        tone: "amber",
      },
    ],
    signals: [
      {
        id: "posture",
        label: "Posture",
        value: "Needs review",
        detail: "Review needed before expanding pilot.",
        tone: "amber",
      },
    ],
  };
}

describe("AgentGuard evidence packets", () => {
  it("builds deterministic default packet titles from posture and timestamp", () => {
    expect(
      defaultAgentGuardEvidencePacketTitle({
        statusLabel: "Needs review",
        generatedAt: "2026-05-16T20:30:00.000Z",
      })
    ).toBe("AgentGuard evidence packet - Needs review - 2026-05-16 20:30 UTC");
  });

  it("builds a metadata-only packet draft from readiness and command center output", () => {
    const draft = buildAgentGuardEvidencePacketDraft({
      report: readinessReport(),
      commandCenter: commandCenter(),
      generatedByEmail: "operator@example.com",
    });

    expect(draft.packetType).toBe("pilot_readiness");
    expect(draft.title).toContain("Needs review");
    expect(draft.status).toBe("needs_review");
    expect(draft.summaryMetrics.primaryActionLabel).toBe("Review policy coverage");
    expect(draft.summaryMetrics.activeSourceCount).toBe(1);
    expect(draft.summaryMetrics.loadWarningCount).toBe(1);
    expect(draft.evidenceCounts.acknowledgementEvidenceCount).toBe(1);
    expect(draft.packetText).toContain("Operator command center");
    expect(draft.packetText).toContain("metadata-only");
  });

  it("generates conservative packet text for enterprise-readiness review", () => {
    const text = agentGuardEvidencePacketToText({
      title: "Readiness review packet",
      report: readinessReport(),
      commandCenter: commandCenter(),
      generatedByEmail: "operator@example.com",
    });

    expect(text).toContain("Readiness review packet");
    expect(text).toContain("Generated by: operator@example.com");
    expect(text).toContain("Primary action: Review policy coverage");
    expect(text).toContain("Evidence load warnings");
    expect(text).toContain("read-only operational evidence");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not a compliance determination");
    expect(text).not.toContain("certify compliance");
  });

  it("maps saved database rows to API shape", () => {
    const draft = buildAgentGuardEvidencePacketDraft({
      report: readinessReport(),
      commandCenter: commandCenter(),
      generatedByEmail: "operator@example.com",
      title: "Saved packet",
    });
    const row: AgentGuardEvidencePacketRow = {
      id: "packet-1",
      packet_type: draft.packetType,
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      summary: draft.summary,
      readiness_report: draft.readinessReport,
      command_center: draft.commandCenter,
      summary_metrics: draft.summaryMetrics,
      evidence_counts: draft.evidenceCounts,
      load_warnings: draft.loadWarnings,
      packet_text: draft.packetText,
      generated_by_user_id: "user-1",
      generated_by_email: "operator@example.com",
      generated_at: draft.generatedAt,
      created_at: "2026-05-16T20:31:00.000Z",
    };

    const api = agentGuardEvidencePacketRowToApi(row);

    expect(api.id).toBe("packet-1");
    expect(api.packetType).toBe("pilot_readiness");
    expect(api.generatedByEmail).toBe("operator@example.com");
    expect(api.summaryMetrics.primaryActionCta).toBe("Review policies");
  });

  it("detects missing evidence packet table errors", () => {
    expect(
      isMissingAgentGuardEvidencePacketTable({
        code: "PGRST205",
        message: "Could not find agent_evidence_packets",
      })
    ).toBe(true);
    expect(
      isMissingAgentGuardEvidencePacketTable({
        code: "XX000",
        message: "some other error",
      })
    ).toBe(false);
  });

  it("keeps public copy bounded and non-mutating", () => {
    const text = Object.values(AGENT_GUARD_EVIDENCE_PACKET_COPY).join(" ");

    expect(text).toContain("metadata-only readiness");
    expect(text).toContain("point-in-time enterprise-readiness review");
    expect(text).toContain("read-only operational evidence");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not a compliance determination");
    expect(text).toContain("Saving a packet does not change source keys");
    expect(text).toContain("enforcement");
  });
});
