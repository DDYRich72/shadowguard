import { agentGuardPilotReadinessReportToText } from "./pilot-readiness-report";
import type {
  AgentGuardPilotReadinessReport,
  AgentGuardPilotReadinessStatus,
} from "./pilot-readiness-report";
import type { AgentGuardOperatorCommandCenter } from "./operator-command-center";

export type AgentGuardEvidencePacketType = "pilot_readiness";

export type AgentGuardEvidencePacketSummaryMetrics = {
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  primaryActionLabel: string;
  primaryActionCta: string;
  configuredSourceCount: number;
  activeSourceCount: number;
  recentActivitySourceCount: number;
  policyOutcomeSourceCount: number;
  needsPolicyScopeCount: number;
  needsActionReviewCount: number;
  liveExportDestinationCount: number;
  acknowledgementCount: number;
  concernCount: number;
  loadWarningCount: number;
};

export type AgentGuardEvidencePacketEvidenceCounts = {
  readinessMetricCount: number;
  commandSignalCount: number;
  concernCount: number;
  nextActionCount: number;
  acknowledgementEvidenceCount: number;
  secondaryActionCount: number;
};

export type AgentGuardEvidencePacket = {
  id: string;
  packetType: AgentGuardEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  summary: string;
  readinessReport: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
  summaryMetrics: AgentGuardEvidencePacketSummaryMetrics;
  evidenceCounts: AgentGuardEvidencePacketEvidenceCounts;
  loadWarnings: string[];
  packetText: string;
  generatedByUserId: string | null;
  generatedByEmail: string | null;
  generatedAt: string;
  createdAt: string;
};

export type AgentGuardEvidencePacketRow = {
  id: string;
  packet_type: AgentGuardEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  status_label: string;
  summary: string;
  readiness_report: AgentGuardPilotReadinessReport;
  command_center: AgentGuardOperatorCommandCenter;
  summary_metrics: AgentGuardEvidencePacketSummaryMetrics | null;
  evidence_counts: AgentGuardEvidencePacketEvidenceCounts | null;
  load_warnings: string[] | null;
  packet_text: string;
  generated_by_user_id: string | null;
  generated_by_email: string | null;
  generated_at: string;
  created_at: string;
};

export type AgentGuardEvidencePacketDraft = {
  packetType: AgentGuardEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  summary: string;
  readinessReport: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
  summaryMetrics: AgentGuardEvidencePacketSummaryMetrics;
  evidenceCounts: AgentGuardEvidencePacketEvidenceCounts;
  loadWarnings: string[];
  packetText: string;
  generatedAt: string;
};

export const AGENT_GUARD_EVIDENCE_PACKET_COPY = {
  overview:
    "Saved AgentGuard evidence packets preserve metadata-only readiness and command-center output for point-in-time enterprise-readiness review.",
  boundary:
    "Saved packets are read-only operational evidence. They are not legal advice, not a certification, not a compliance determination, and not an auditor attestation. Saving a packet does not change source keys, policies, reviews, export settings, acknowledgements, or enforcement.",
  migrationWarning:
    "AgentGuard evidence packet history is unavailable. Verify that the current initial schema is installed before saving point-in-time evidence packets.",
} as const;

const EMPTY_SUMMARY_METRICS: AgentGuardEvidencePacketSummaryMetrics = {
  status: "setup_required",
  statusLabel: "Setup required",
  primaryActionLabel: "No saved primary action",
  primaryActionCta: "Review readiness",
  configuredSourceCount: 0,
  activeSourceCount: 0,
  recentActivitySourceCount: 0,
  policyOutcomeSourceCount: 0,
  needsPolicyScopeCount: 0,
  needsActionReviewCount: 0,
  liveExportDestinationCount: 0,
  acknowledgementCount: 0,
  concernCount: 0,
  loadWarningCount: 0,
};

const EMPTY_EVIDENCE_COUNTS: AgentGuardEvidencePacketEvidenceCounts = {
  readinessMetricCount: 0,
  commandSignalCount: 0,
  concernCount: 0,
  nextActionCount: 0,
  acknowledgementEvidenceCount: 0,
  secondaryActionCount: 0,
};

function formatPacketDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function defaultAgentGuardEvidencePacketTitle(input: {
  statusLabel: string;
  generatedAt: string;
}): string {
  return `AgentGuard evidence packet - ${input.statusLabel} - ${formatPacketDate(input.generatedAt)}`;
}

export function buildAgentGuardEvidencePacketSummaryMetrics(input: {
  report: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
}): AgentGuardEvidencePacketSummaryMetrics {
  return {
    status: input.report.status,
    statusLabel: input.report.label,
    primaryActionLabel: input.commandCenter.primaryAction.label,
    primaryActionCta: input.commandCenter.primaryAction.cta,
    configuredSourceCount: input.report.metrics.configuredSourceCount,
    activeSourceCount: input.report.metrics.activeSourceCount,
    recentActivitySourceCount: input.report.metrics.recentActivitySourceCount,
    policyOutcomeSourceCount: input.report.metrics.policyOutcomeSourceCount,
    needsPolicyScopeCount: input.report.metrics.needsPolicyScopeCount,
    needsActionReviewCount: input.report.metrics.needsActionReviewCount,
    liveExportDestinationCount: input.report.metrics.liveExportDestinationCount,
    acknowledgementCount: input.report.metrics.acknowledgementCount,
    concernCount: input.report.concerns.length,
    loadWarningCount: input.report.loadWarnings.length,
  };
}

export function buildAgentGuardEvidencePacketEvidenceCounts(input: {
  report: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
}): AgentGuardEvidencePacketEvidenceCounts {
  return {
    readinessMetricCount: input.report.evidenceMetrics.length,
    commandSignalCount: input.commandCenter.signals.length,
    concernCount: input.report.concerns.length,
    nextActionCount: input.report.nextActions.length,
    acknowledgementEvidenceCount: input.report.acknowledgementEvidence.length,
    secondaryActionCount: input.commandCenter.secondaryActions.length,
  };
}

export function agentGuardEvidencePacketToText(input: {
  title: string;
  report: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
  generatedByEmail?: string | null;
}): string {
  const reportText = agentGuardPilotReadinessReportToText(input.report);
  const secondaryActions =
    input.commandCenter.secondaryActions.length > 0
      ? input.commandCenter.secondaryActions
          .map((action) => `- ${action.label}: ${action.detail} (${action.cta})`)
          .join("\n")
      : "- No supporting command-center actions were saved.";
  const signals = input.commandCenter.signals
    .map((signal) => `- ${signal.label}: ${signal.value}. ${signal.detail}`)
    .join("\n");
  const warnings =
    input.report.loadWarnings.length > 0
      ? input.report.loadWarnings.map((warning) => `- ${warning}`).join("\n")
      : "- No evidence load warnings were saved.";

  return [
    input.title,
    `Generated: ${input.report.generatedAt}`,
    `Generated by: ${input.generatedByEmail ?? "unknown"}`,
    `Posture: ${input.report.label}`,
    `Summary: ${input.report.summary}`,
    "",
    "Operator command center:",
    `- Primary action: ${input.commandCenter.primaryAction.label}`,
    `- CTA: ${input.commandCenter.primaryAction.cta}`,
    `- Detail: ${input.commandCenter.primaryAction.detail}`,
    "",
    "Command signals:",
    signals,
    "",
    "Supporting actions:",
    secondaryActions,
    "",
    "Readiness packet:",
    reportText,
    "",
    "Evidence load warnings:",
    warnings,
    "",
    `Boundary: ${AGENT_GUARD_EVIDENCE_PACKET_COPY.boundary}`,
  ].join("\n");
}

export function buildAgentGuardEvidencePacketDraft(input: {
  report: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
  generatedByEmail?: string | null;
  title?: string | null;
}): AgentGuardEvidencePacketDraft {
  const title =
    input.title?.trim() ||
    defaultAgentGuardEvidencePacketTitle({
      statusLabel: input.report.label,
      generatedAt: input.report.generatedAt,
    });

  return {
    packetType: "pilot_readiness",
    title,
    status: input.report.status,
    statusLabel: input.report.label,
    summary: input.report.summary,
    readinessReport: input.report,
    commandCenter: input.commandCenter,
    summaryMetrics: buildAgentGuardEvidencePacketSummaryMetrics(input),
    evidenceCounts: buildAgentGuardEvidencePacketEvidenceCounts(input),
    loadWarnings: input.report.loadWarnings,
    generatedAt: input.report.generatedAt,
    packetText: agentGuardEvidencePacketToText({
      title,
      report: input.report,
      commandCenter: input.commandCenter,
      generatedByEmail: input.generatedByEmail,
    }),
  };
}

export function isMissingAgentGuardEvidencePacketTable(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_evidence_packets")
  );
}

export function agentGuardEvidencePacketRowToApi(
  row: AgentGuardEvidencePacketRow
): AgentGuardEvidencePacket {
  return {
    id: row.id,
    packetType: row.packet_type,
    title: row.title,
    status: row.status,
    statusLabel: row.status_label,
    summary: row.summary,
    readinessReport: row.readiness_report,
    commandCenter: row.command_center,
    summaryMetrics: row.summary_metrics ?? EMPTY_SUMMARY_METRICS,
    evidenceCounts: row.evidence_counts ?? EMPTY_EVIDENCE_COUNTS,
    loadWarnings: row.load_warnings ?? [],
    packetText: row.packet_text,
    generatedByUserId: row.generated_by_user_id,
    generatedByEmail: row.generated_by_email,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}
