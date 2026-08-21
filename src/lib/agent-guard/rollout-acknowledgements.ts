import type {
  AgentGuardProductionRolloutChecklistItem,
  AgentGuardProductionRolloutStatus,
} from "./production-rollout";

export type AgentGuardRolloutAcknowledgementMetrics = {
  activeSourceCount: number;
  activeProductionSourceCount: number;
  recentActivitySourceCount: number;
  policyOutcomeSourceCount: number;
  needsReviewSourceCount: number;
  needsActionReviewCount: number;
  liveExportDestinationCount: number;
  failingExportDestinationCount: number;
};

export type AgentGuardRolloutAcknowledgementRow = {
  id: string;
  source_id: string | null;
  source_name: string;
  source_environment: string;
  source_status: string;
  source_rollout_status: AgentGuardProductionRolloutStatus;
  source_rollout_label: string;
  source_next_step: string;
  overall_rollout_status: AgentGuardProductionRolloutStatus;
  overall_rollout_label: string;
  export_posture_label: string;
  export_warning: string | null;
  checklist_snapshot: AgentGuardProductionRolloutChecklistItem[] | null;
  metrics_snapshot: AgentGuardRolloutAcknowledgementMetrics | null;
  note: string | null;
  acknowledged_by_user_id: string | null;
  acknowledged_by_email: string | null;
  created_at: string;
};

export type AgentGuardRolloutAcknowledgement = {
  id: string;
  sourceId: string | null;
  sourceName: string;
  sourceEnvironment: string;
  sourceStatus: string;
  sourceRolloutStatus: AgentGuardProductionRolloutStatus;
  sourceRolloutLabel: string;
  sourceNextStep: string;
  overallRolloutStatus: AgentGuardProductionRolloutStatus;
  overallRolloutLabel: string;
  exportPostureLabel: string;
  exportWarning: string | null;
  checklistSnapshot: AgentGuardProductionRolloutChecklistItem[];
  metricsSnapshot: AgentGuardRolloutAcknowledgementMetrics;
  note: string;
  acknowledgedByUserId: string | null;
  acknowledgedByEmail: string | null;
  createdAt: string;
};

const EMPTY_METRICS: AgentGuardRolloutAcknowledgementMetrics = {
  activeSourceCount: 0,
  activeProductionSourceCount: 0,
  recentActivitySourceCount: 0,
  policyOutcomeSourceCount: 0,
  needsReviewSourceCount: 0,
  needsActionReviewCount: 0,
  liveExportDestinationCount: 0,
  failingExportDestinationCount: 0,
};

export const AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY = {
  overview:
    "Rollout acknowledgements record who reviewed a source posture and what was visible at that time. They are advisory evidence only.",
  noAutomaticChange:
    "Acknowledging a source does not promote it, change policies, switch export modes, or expand enforcement.",
  migrationWarning:
    "Rollout acknowledgement storage is unavailable. Verify that the current initial schema is installed before recording source rollout review evidence.",
} as const;

export function isMissingRolloutAcknowledgementsTable(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_rollout_acknowledgements")
  );
}

export function rolloutAcknowledgementRowToApi(
  row: AgentGuardRolloutAcknowledgementRow
): AgentGuardRolloutAcknowledgement {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceEnvironment: row.source_environment,
    sourceStatus: row.source_status,
    sourceRolloutStatus: row.source_rollout_status,
    sourceRolloutLabel: row.source_rollout_label,
    sourceNextStep: row.source_next_step,
    overallRolloutStatus: row.overall_rollout_status,
    overallRolloutLabel: row.overall_rollout_label,
    exportPostureLabel: row.export_posture_label,
    exportWarning: row.export_warning,
    checklistSnapshot: row.checklist_snapshot ?? [],
    metricsSnapshot: row.metrics_snapshot ?? EMPTY_METRICS,
    note: row.note ?? "",
    acknowledgedByUserId: row.acknowledged_by_user_id,
    acknowledgedByEmail: row.acknowledged_by_email,
    createdAt: row.created_at,
  };
}

export function latestRolloutAcknowledgementBySource(
  acknowledgements: AgentGuardRolloutAcknowledgement[]
): Map<string, AgentGuardRolloutAcknowledgement> {
  const latest = new Map<string, AgentGuardRolloutAcknowledgement>();
  for (const acknowledgement of acknowledgements) {
    if (!acknowledgement.sourceId) continue;
    const existing = latest.get(acknowledgement.sourceId);
    if (
      !existing ||
      Date.parse(acknowledgement.createdAt) > Date.parse(existing.createdAt)
    ) {
      latest.set(acknowledgement.sourceId, acknowledgement);
    }
  }
  return latest;
}
