import { classifyAgentExportFailure } from "./export-hardening";
import type { AgentGuardPilotReadinessStatus } from "./pilot-readiness-report";
import type {
  AgentGuardSlackWorkflowCustomerApprovalStatus,
  AgentGuardSlackWorkflowDeliveryEventType,
  AgentGuardSlackWorkflowDeliveryMode,
  AgentGuardSlackWorkflowDeliveryStatus,
  AgentGuardSlackWorkflowTargetStatus,
  AgentGuardSlackWorkflowTargetType,
  AgentGuardSlackWorkflowUserIdentifierMode,
} from "./slack-workflow-targets";

export type AgentGuardSlackEvidencePacketType = "slack_preview";

export type AgentGuardSlackEvidenceTargetSnapshot = {
  id: string;
  name: string;
  targetType: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhookUrlHint: string;
  eventTypes: string[];
  dryRunEnabled: boolean;
  liveSendEnabled: boolean;
  ownerName: string;
  ownerEmail: string;
  customerApprovalStatus: AgentGuardSlackWorkflowCustomerApprovalStatus;
  customerApprovalNote: string;
  customerApprovedAt: string | null;
  customerApprovedByEmail: string | null;
  userIdentifierMode: AgentGuardSlackWorkflowUserIdentifierMode;
  lastTestedAt: string | null;
  lastSuccessfulTestAt: string | null;
  lastLiveAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentGuardSlackEvidenceAttemptSummary = {
  id: string;
  eventId: string;
  eventType: AgentGuardSlackWorkflowDeliveryEventType;
  status: AgentGuardSlackWorkflowDeliveryStatus;
  deliveryMode: AgentGuardSlackWorkflowDeliveryMode;
  httpStatus: number | null;
  durationMs: number;
  failureCategory: string;
  failureLabel: string;
  failureSummary: string;
  failureNextAction: string;
  createdByEmail: string | null;
  createdAt: string;
};

export type AgentGuardSlackEvidencePacketSummaryMetrics = {
  targetStatus: AgentGuardSlackWorkflowTargetStatus;
  targetType: AgentGuardSlackWorkflowTargetType;
  eventTypeCount: number;
  totalAttemptCount: number;
  dryRunAttemptCount: number;
  successfulManualAttemptCount: number;
  failedAttemptCount: number;
  automaticAttemptCount: number;
  hasDryRunEvidence: boolean;
  hasManualSuccess: boolean;
  livePostureOn: boolean;
  approvalRecorded: boolean;
};

export type AgentGuardSlackEvidencePacketEvidenceCounts = {
  targetMetadataFieldCount: number;
  attemptSummaryCount: number;
  postureSignalCount: number;
  boundaryCount: number;
};

export type AgentGuardSlackEvidenceSnapshot = {
  generatedAt: string;
  target: AgentGuardSlackEvidenceTargetSnapshot;
  latestAttempt: AgentGuardSlackEvidenceAttemptSummary | null;
  recentAttempts: AgentGuardSlackEvidenceAttemptSummary[];
  postureSignals: string[];
  boundary: string;
};

export type AgentGuardSlackEvidencePacketDraft = {
  packetType: AgentGuardSlackEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  summary: string;
  snapshot: AgentGuardSlackEvidenceSnapshot;
  commandCenter: {
    primaryActionLabel: string;
    primaryActionCta: string;
    nextAction: string;
  };
  summaryMetrics: AgentGuardSlackEvidencePacketSummaryMetrics;
  evidenceCounts: AgentGuardSlackEvidencePacketEvidenceCounts;
  loadWarnings: string[];
  packetText: string;
  generatedAt: string;
};

export type AgentGuardSlackEvidencePacket = {
  id: string;
  packetType: AgentGuardSlackEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  summary: string;
  snapshot: AgentGuardSlackEvidenceSnapshot;
  commandCenter: AgentGuardSlackEvidencePacketDraft["commandCenter"];
  summaryMetrics: AgentGuardSlackEvidencePacketSummaryMetrics;
  evidenceCounts: AgentGuardSlackEvidencePacketEvidenceCounts;
  loadWarnings: string[];
  packetText: string;
  generatedByUserId: string | null;
  generatedByEmail: string | null;
  generatedAt: string;
  createdAt: string;
};

export type AgentGuardSlackEvidencePacketRow = {
  id: string;
  packet_type: AgentGuardSlackEvidencePacketType;
  title: string;
  status: AgentGuardPilotReadinessStatus;
  status_label: string;
  summary: string;
  readiness_report: AgentGuardSlackEvidenceSnapshot;
  command_center: AgentGuardSlackEvidencePacketDraft["commandCenter"] | null;
  summary_metrics: AgentGuardSlackEvidencePacketSummaryMetrics | null;
  evidence_counts: AgentGuardSlackEvidencePacketEvidenceCounts | null;
  load_warnings: string[] | null;
  packet_text: string;
  generated_by_user_id: string | null;
  generated_by_email: string | null;
  generated_at: string;
  created_at: string;
};

export type AgentGuardSlackEvidenceTargetInput =
  AgentGuardSlackEvidenceTargetSnapshot;

export type AgentGuardSlackEvidenceAttemptInput = {
  id: string;
  event_id: string;
  event_type: AgentGuardSlackWorkflowDeliveryEventType;
  status: AgentGuardSlackWorkflowDeliveryStatus;
  delivery_mode: AgentGuardSlackWorkflowDeliveryMode;
  http_status: number | null;
  duration_ms: number;
  error_message?: string | null;
  created_by_email: string | null;
  created_at: string;
};

export const AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY = {
  overview:
    "Saved Slack preview evidence handoffs preserve metadata-only target posture, owner, approval, and delivery-attempt evidence for point-in-time enterprise pilot review.",
  boundary:
    "Saved Slack preview evidence is read-only operational support. It includes URL hints only and no plaintext Slack URL, encrypted URL, URL hash, source key, signing secret, bearer token, raw prompt, raw response, file, message, or delivery payload. Saving a packet does not send Slack messages, change target settings, enable live sends, create retries, escalate incidents, install a Slack app, use Slack OAuth, discover channels, guarantee delivery, provide legal advice, certify compliance, determine compliance, attest audit status, or warrant security.",
  migrationWarning:
    "Verify that the current initial schema is installed before saving Slack preview evidence handoffs.",
} as const;

const EMPTY_SUMMARY_METRICS: AgentGuardSlackEvidencePacketSummaryMetrics = {
  targetStatus: "disabled",
  targetType: "workflow_webhook",
  eventTypeCount: 0,
  totalAttemptCount: 0,
  dryRunAttemptCount: 0,
  successfulManualAttemptCount: 0,
  failedAttemptCount: 0,
  automaticAttemptCount: 0,
  hasDryRunEvidence: false,
  hasManualSuccess: false,
  livePostureOn: false,
  approvalRecorded: false,
};

const EMPTY_EVIDENCE_COUNTS: AgentGuardSlackEvidencePacketEvidenceCounts = {
  targetMetadataFieldCount: 0,
  attemptSummaryCount: 0,
  postureSignalCount: 0,
  boundaryCount: 1,
};

const EMPTY_COMMAND_CENTER: AgentGuardSlackEvidencePacketDraft["commandCenter"] = {
  primaryActionLabel: "Review Slack preview target",
  primaryActionCta: "Open AgentGuard Settings",
  nextAction:
    "Confirm target ownership, dry-run posture, manual delivery evidence, approval, and rollback ownership before treating Slack preview evidence as pilot-ready.",
};

function formatPacketDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function targetTypeLabel(type: AgentGuardSlackWorkflowTargetType): string {
  return type === "incoming_webhook" ? "Incoming webhook" : "Workflow webhook";
}

function approvalLabel(status: AgentGuardSlackWorkflowCustomerApprovalStatus): string {
  if (status === "not_requested") return "Not requested";
  if (status === "not_applicable") return "Not applicable";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function deliveryModeLabel(mode: AgentGuardSlackWorkflowDeliveryMode): string {
  if (mode === "manual_test") return "manual test";
  if (mode === "dry_run") return "dry-run";
  return "automatic";
}

function attemptToSummary(
  attempt: AgentGuardSlackEvidenceAttemptInput
): AgentGuardSlackEvidenceAttemptSummary {
  const failure = classifyAgentExportFailure({
    status: attempt.status,
    deliveryMode: attempt.delivery_mode,
    delivery_mode: attempt.delivery_mode,
    httpStatus: attempt.http_status,
    http_status: attempt.http_status,
    errorMessage: attempt.error_message ?? null,
    error_message: attempt.error_message ?? null,
  });
  return {
    id: attempt.id,
    eventId: attempt.event_id,
    eventType: attempt.event_type,
    status: attempt.status,
    deliveryMode: attempt.delivery_mode,
    httpStatus: attempt.http_status,
    durationMs: attempt.duration_ms,
    failureCategory: failure.category,
    failureLabel: failure.label,
    failureSummary: failure.summary,
    failureNextAction: failure.nextAction,
    createdByEmail: attempt.created_by_email,
    createdAt: attempt.created_at,
  };
}

function buildSummaryMetrics(input: {
  target: AgentGuardSlackEvidenceTargetInput;
  attempts: AgentGuardSlackEvidenceAttemptSummary[];
}): AgentGuardSlackEvidencePacketSummaryMetrics {
  const dryRunAttemptCount = input.attempts.filter(
    (attempt) => attempt.status === "dry_run" || attempt.deliveryMode === "dry_run"
  ).length;
  const successfulManualAttemptCount = input.attempts.filter(
    (attempt) =>
      attempt.status === "succeeded" && attempt.deliveryMode === "manual_test"
  ).length;

  return {
    targetStatus: input.target.status,
    targetType: input.target.targetType,
    eventTypeCount: input.target.eventTypes.length,
    totalAttemptCount: input.attempts.length,
    dryRunAttemptCount,
    successfulManualAttemptCount,
    failedAttemptCount: input.attempts.filter((attempt) => attempt.status === "failed")
      .length,
    automaticAttemptCount: input.attempts.filter(
      (attempt) => attempt.deliveryMode === "automatic"
    ).length,
    hasDryRunEvidence: dryRunAttemptCount > 0,
    hasManualSuccess:
      successfulManualAttemptCount > 0 || Boolean(input.target.lastSuccessfulTestAt),
    livePostureOn: input.target.liveSendEnabled,
    approvalRecorded: input.target.customerApprovalStatus === "approved",
  };
}

function postureForSlackEvidence(
  target: AgentGuardSlackEvidenceTargetInput,
  metrics: AgentGuardSlackEvidencePacketSummaryMetrics
): {
  status: AgentGuardPilotReadinessStatus;
  statusLabel: string;
  summary: string;
  nextAction: string;
} {
  if (target.liveSendEnabled) {
    return {
      status: "live_caution",
      statusLabel: "Live caution",
      summary:
        "Slack preview automatic live posture is on; keep customer approval, event scope, rollback ownership, and recent delivery evidence under review.",
      nextAction:
        "Confirm the customer still approves live Slack preview sends and that the owner can disable the target quickly if delivery or routing fails.",
    };
  }

  if (metrics.hasManualSuccess) {
    return {
      status: "ready_for_pilot",
      statusLabel: "Manual delivery verified",
      summary:
        "A metadata-only Slack preview manual delivery has succeeded and automatic live sends are off.",
      nextAction:
        "Keep automatic live posture off unless the pilot owner explicitly approves event scope, routing, rollback, and receiver ownership.",
    };
  }

  if (target.status === "enabled" || metrics.hasDryRunEvidence) {
    return {
      status: "needs_review",
      statusLabel: "Needs validation",
      summary:
        "Slack preview target metadata exists, but successful manual delivery evidence has not been captured yet.",
      nextAction:
        "Record dry-run evidence, allow outbound tests only for a controlled receiver, then save a fresh packet after a successful manual test.",
    };
  }

  return {
    status: "setup_required",
    statusLabel: "Setup required",
    summary:
      "Slack preview target metadata exists, but the target is still disabled and has no successful manual delivery evidence.",
    nextAction:
      "Enable the target only when the customer-owned receiver is ready, then capture dry-run and manual-test evidence.",
  };
}

function buildPostureSignals(
  target: AgentGuardSlackEvidenceTargetInput,
  metrics: AgentGuardSlackEvidencePacketSummaryMetrics
): string[] {
  return [
    `Target status: ${target.status}`,
    `Dry-run posture: ${
      target.dryRunEnabled
        ? "on; outbound Slack requests are skipped"
        : "off; manual tests can send outbound requests"
    }`,
    `Automatic live posture: ${
      target.liveSendEnabled ? "on; review approval and rollback" : "off"
    }`,
    `Manual success: ${metrics.hasManualSuccess ? "recorded" : "not recorded"}`,
    `Dry-run evidence: ${metrics.hasDryRunEvidence ? "recorded" : "not recorded"}`,
    `Customer approval: ${approvalLabel(target.customerApprovalStatus)}`,
  ];
}

export function defaultAgentGuardSlackEvidencePacketTitle(input: {
  targetName: string;
  statusLabel: string;
  generatedAt: string;
}): string {
  return `AgentGuard Slack evidence - ${input.targetName} - ${
    input.statusLabel
  } - ${formatPacketDate(input.generatedAt)}`;
}

export function buildAgentGuardSlackEvidencePacketDraft(input: {
  target: AgentGuardSlackEvidenceTargetInput;
  attempts: AgentGuardSlackEvidenceAttemptInput[];
  generatedByEmail?: string | null;
  generatedAt?: string;
  title?: string | null;
}): AgentGuardSlackEvidencePacketDraft {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const recentAttempts = input.attempts.map(attemptToSummary).slice(0, 10);
  const latestAttempt = recentAttempts[0] ?? null;
  const summaryMetrics = buildSummaryMetrics({
    target: input.target,
    attempts: recentAttempts,
  });
  const posture = postureForSlackEvidence(input.target, summaryMetrics);
  const title =
    input.title?.trim() ||
    defaultAgentGuardSlackEvidencePacketTitle({
      targetName: input.target.name,
      statusLabel: posture.statusLabel,
      generatedAt,
    });
  const postureSignals = buildPostureSignals(input.target, summaryMetrics);
  const snapshot: AgentGuardSlackEvidenceSnapshot = {
    generatedAt,
    target: input.target,
    latestAttempt,
    recentAttempts,
    postureSignals,
    boundary: AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY.boundary,
  };
  const commandCenter = {
    primaryActionLabel: posture.statusLabel,
    primaryActionCta: "Open AgentGuard Settings",
    nextAction: posture.nextAction,
  };

  return {
    packetType: "slack_preview",
    title,
    status: posture.status,
    statusLabel: posture.statusLabel,
    summary: posture.summary,
    snapshot,
    commandCenter,
    summaryMetrics,
    evidenceCounts: {
      targetMetadataFieldCount: 14,
      attemptSummaryCount: recentAttempts.length,
      postureSignalCount: postureSignals.length,
      boundaryCount: 1,
    },
    loadWarnings: [],
    packetText: agentGuardSlackEvidencePacketToText({
      title,
      statusLabel: posture.statusLabel,
      summary: posture.summary,
      snapshot,
      commandCenter,
      summaryMetrics,
      generatedByEmail: input.generatedByEmail,
    }),
    generatedAt,
  };
}

export function agentGuardSlackEvidencePacketToText(input: {
  title: string;
  statusLabel: string;
  summary: string;
  snapshot: AgentGuardSlackEvidenceSnapshot;
  commandCenter: AgentGuardSlackEvidencePacketDraft["commandCenter"];
  summaryMetrics: AgentGuardSlackEvidencePacketSummaryMetrics;
  generatedByEmail?: string | null;
}): string {
  const target = input.snapshot.target;
  const latestAttempt = input.snapshot.latestAttempt;
  const attempts =
    input.snapshot.recentAttempts.length > 0
      ? input.snapshot.recentAttempts
          .map((attempt) => {
            const http = attempt.httpStatus ? `HTTP ${attempt.httpStatus}` : "No HTTP";
            return `- ${attempt.status}; ${deliveryModeLabel(
              attempt.deliveryMode
            )}; ${http}; ${attempt.durationMs} ms; ${attempt.createdAt}; ${attempt.failureLabel}`;
          })
          .join("\n")
      : "- No Slack preview attempts were saved in this packet.";

  return [
    input.title,
    `Generated: ${input.snapshot.generatedAt}`,
    `Generated by: ${input.generatedByEmail ?? "unknown"}`,
    `Posture: ${input.statusLabel}`,
    `Summary: ${input.summary}`,
    "",
    "Slack preview target:",
    `- Target: ${target.name}`,
    `- Type: ${targetTypeLabel(target.targetType)}`,
    `- URL hint: ${target.webhookUrlHint}`,
    `- Status: ${target.status}`,
    `- Dry-run posture: ${
      target.dryRunEnabled
        ? "on; outbound Slack requests are skipped"
        : "off; manual tests can send outbound requests"
    }`,
    `- Automatic live posture: ${
      target.liveSendEnabled ? "on; still gated by eligibility and approval" : "off"
    }`,
    `- Event scope: ${target.eventTypes.join(", ") || "none selected"}`,
    `- Owner/team: ${target.ownerName || "-"}`,
    `- Owner email: ${target.ownerEmail || "-"}`,
    `- Customer approval: ${approvalLabel(target.customerApprovalStatus)}`,
    `- Customer approval note: ${target.customerApprovalNote || "-"}`,
    `- Last test: ${target.lastTestedAt ?? "Not yet"}`,
    `- Last successful manual test: ${target.lastSuccessfulTestAt ?? "Not yet"}`,
    `- Last live attempt: ${target.lastLiveAttemptAt ?? "Not yet"}`,
    "",
    "Evidence posture:",
    `- Dry-run evidence recorded: ${
      input.summaryMetrics.hasDryRunEvidence ? "yes" : "not captured"
    }`,
    `- Successful manual delivery recorded: ${
      input.summaryMetrics.hasManualSuccess ? "yes" : "not captured"
    }`,
    `- Total summarized attempts: ${input.summaryMetrics.totalAttemptCount}`,
    latestAttempt
      ? `- Latest attempt: ${latestAttempt.status}; ${deliveryModeLabel(
          latestAttempt.deliveryMode
        )}; ${
          latestAttempt.httpStatus ? `HTTP ${latestAttempt.httpStatus}` : "No HTTP"
        }; ${latestAttempt.durationMs} ms; ${latestAttempt.createdAt}`
      : "- Latest attempt: none",
    "",
    "Posture signals:",
    input.snapshot.postureSignals.map((signal) => `- ${signal}`).join("\n"),
    "",
    "Recent attempt summaries:",
    attempts,
    "",
    "Next action:",
    `- ${input.commandCenter.nextAction}`,
    "",
    `Boundary: ${AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY.boundary}`,
  ].join("\n");
}

export function isMissingAgentGuardSlackEvidencePacketStorage(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    (error.code === "23514" &&
      (message.includes("agent_evidence_packets_packet_type_check") ||
        message.includes("packet_type"))) ||
    message.includes("agent_evidence_packets") ||
    message.includes("agent_evidence_packets_packet_type_check") ||
    message.includes("packet_type")
  );
}

export function isMissingAgentGuardSlackWorkflowTables(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || message.includes("agent_slack_workflow");
}

export function agentGuardSlackEvidencePacketRowToApi(
  row: AgentGuardSlackEvidencePacketRow
): AgentGuardSlackEvidencePacket {
  return {
    id: row.id,
    packetType: "slack_preview",
    title: row.title,
    status: row.status,
    statusLabel: row.status_label,
    summary: row.summary,
    snapshot: row.readiness_report,
    commandCenter: row.command_center ?? EMPTY_COMMAND_CENTER,
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
