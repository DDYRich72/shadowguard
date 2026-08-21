import type { AgentGuardSourcePolicyCoverageRow } from "./source-policy-coverage";

export type AgentGuardProductionRolloutStatus =
  | "testing"
  | "ready_for_pilot"
  | "needs_review"
  | "live_caution";

export type AgentGuardProductionRolloutChecklistStatus =
  | "pass"
  | "attention"
  | "blocked";

export type AgentGuardProductionRolloutSource = {
  id: string;
  name: string;
  environment: string;
  status: string;
  allowedToolNames?: string[] | null;
};

export type AgentGuardProductionRolloutExportDestination = {
  id: string;
  name: string;
  status: string;
  automaticDeliveryEnabled: boolean;
  dryRunEnabled: boolean;
  healthStatus: string;
  healthLabel: string;
};

export type AgentGuardProductionRolloutChecklistItem = {
  id:
    | "active_source"
    | "recent_activity"
    | "source_scope"
    | "policy_coverage"
    | "review_capacity"
    | "export_mode";
  label: string;
  status: AgentGuardProductionRolloutChecklistStatus;
  summary: string;
};

export type AgentGuardProductionRolloutSourceRow = {
  sourceId: string;
  sourceName: string;
  environment: string;
  status: AgentGuardProductionRolloutStatus;
  label: string;
  nextStep: string;
};

export type AgentGuardProductionRollout = {
  status: AgentGuardProductionRolloutStatus;
  label: string;
  summary: string;
  checklist: AgentGuardProductionRolloutChecklistItem[];
  sourceRows: AgentGuardProductionRolloutSourceRow[];
  metrics: {
    activeSourceCount: number;
    activeProductionSourceCount: number;
    recentActivitySourceCount: number;
    policyOutcomeSourceCount: number;
    needsReviewSourceCount: number;
    needsActionReviewCount: number;
    liveExportDestinationCount: number;
    failingExportDestinationCount: number;
  };
  exportPostureLabel: string;
  exportWarning: string | null;
};

const HIGH_REVIEW_LOAD_THRESHOLD = 5;

const ROLLOUT_LABELS: Record<AgentGuardProductionRolloutStatus, string> = {
  testing: "Testing",
  ready_for_pilot: "Ready for pilot",
  needs_review: "Needs review",
  live_caution: "Live caution",
};

export const AGENT_GUARD_PRODUCTION_ROLLOUT_COPY = {
  overview:
    "Advisory rollout guardrails from source health, submitted activity, policy coverage, review load, and export posture. They do not change enforcement, policies, source keys, or export settings.",
  noAutomaticPromotion:
    "Production readiness is an operator decision. ShadowGuard does not automatically promote sources, tune policies, or switch export modes.",
} as const;

function rolloutSummary(status: AgentGuardProductionRolloutStatus): string {
  if (status === "live_caution") {
    return "Live automatic export is armed. Confirm receivers, policy coverage, and review ownership before leaving production sends on.";
  }
  if (status === "needs_review") {
    return "One or more rollout checks need operator review before expanding production use.";
  }
  if (status === "ready_for_pilot") {
    return "Core signals are present for a controlled pilot. Keep scope narrow and continue spot-checking outcomes.";
  }
  return "AgentGuard is still in setup or testing. Prove source activity and policy coverage before production rollout.";
}

function exportPosture(input: {
  destinations: AgentGuardProductionRolloutExportDestination[];
  liveCount: number;
  failingCount: number;
}): { label: string; warning: string | null } {
  const dryRunCount = input.destinations.filter(
    (destination) => destination.healthStatus === "dry_run"
  ).length;
  const readyCount = input.destinations.filter(
    (destination) => destination.healthStatus === "ready"
  ).length;

  if (input.liveCount > 0) {
    return {
      label: "Live sends armed",
      warning:
        "At least one export destination can send live metadata-only events from submitted AgentGuard activity.",
    };
  }
  if (input.failingCount > 0) {
    return {
      label: "Export failing",
      warning:
        "At least one export destination is failing. Fix the receiver or disable the destination before expanding rollout.",
    };
  }
  if (dryRunCount > 0) {
    return {
      label: "Dry-run export",
      warning: null,
    };
  }
  if (readyCount > 0) {
    return {
      label: "Tested export off",
      warning: null,
    };
  }
  if (input.destinations.length === 0) {
    return {
      label: "No destinations",
      warning: null,
    };
  }
  return {
    label: "Disabled or untested",
    warning: null,
  };
}

function sourceStatus(input: {
  row: AgentGuardSourcePolicyCoverageRow;
  liveExportDestinationCount: number;
}): AgentGuardProductionRolloutStatus {
  if (input.liveExportDestinationCount > 0) return "live_caution";
  if (
    input.row.coverageStatus === "needs_policy_scope" ||
    input.row.coverageStatus === "unknown_source" ||
    input.row.coverageStatus === "revoked" ||
    input.row.needsActionReviewCount >= HIGH_REVIEW_LOAD_THRESHOLD
  ) {
    return "needs_review";
  }
  if (input.row.coverageStatus === "covered") return "ready_for_pilot";
  return "testing";
}

function sourceNextStep(input: {
  row: AgentGuardSourcePolicyCoverageRow;
  status: AgentGuardProductionRolloutStatus;
}): string {
  const { row, status } = input;
  if (status === "live_caution") {
    return "Live export is armed. Confirm receiver behavior and review ownership before leaving this source in production.";
  }
  if (row.coverageStatus === "revoked") {
    return "Use this row for history only. Prove a replacement active source before production rollout.";
  }
  if (row.coverageStatus === "unknown_source") {
    return "Activity references a source outside the loaded catalog. Refresh source data before rollout decisions.";
  }
  if (row.coverageStatus === "needs_policy_scope") {
    return "Activity is flowing without recent policy outcomes. Review policy conditions and source tool scope.";
  }
  if (row.needsActionReviewCount >= HIGH_REVIEW_LOAD_THRESHOLD) {
    return "Review load is high. Work open and investigating items before broadening this source.";
  }
  if (row.coverageStatus === "test_or_demo") {
    return "Keep this signal separate from production readiness and prove a production source separately.";
  }
  if (row.coverageStatus === "quiet") {
    return "Send a safe test event or verify the server-side wrapper before judging readiness.";
  }
  return "Ready for a controlled pilot. Keep scope narrow and continue spot-checking outcomes.";
}

function checklistItem(
  item: AgentGuardProductionRolloutChecklistItem
): AgentGuardProductionRolloutChecklistItem {
  return item;
}

export function buildAgentGuardProductionRolloutGuardrails(input: {
  sources: AgentGuardProductionRolloutSource[];
  coverageRows: AgentGuardSourcePolicyCoverageRow[];
  exportDestinations: AgentGuardProductionRolloutExportDestination[];
}): AgentGuardProductionRollout {
  const activeSources = input.sources.filter((source) => source.status === "active");
  const activeProductionSources = activeSources.filter(
    (source) => source.environment === "production"
  );
  const activeProductionUnscopedSources = activeProductionSources.filter(
    (source) => (source.allowedToolNames?.length ?? 0) === 0
  );
  const activeCoverageRows = input.coverageRows.filter(
    (row) => row.sourceStatus === "active" && row.isConfiguredSource
  );
  const productionCoverageRows = activeCoverageRows.filter(
    (row) => row.sourceEnvironment === "production"
  );
  const sourcesWithRecentActivity = activeCoverageRows.filter(
    (row) => row.recentActivityCount > 0
  );
  const productionNeedsPolicyScopeRows = productionCoverageRows.filter(
    (row) => row.coverageStatus === "needs_policy_scope"
  );
  const unknownSourceRows = input.coverageRows.filter(
    (row) => row.coverageStatus === "unknown_source"
  );
  const totalNeedsActionReviews = input.coverageRows.reduce(
    (total, row) => total + row.needsActionReviewCount,
    0
  );
  const liveExportDestinationCount = input.exportDestinations.filter(
    (destination) =>
      destination.status === "enabled" &&
      destination.automaticDeliveryEnabled &&
      !destination.dryRunEnabled
  ).length;
  const failingExportDestinationCount = input.exportDestinations.filter(
    (destination) => destination.healthStatus === "failing"
  ).length;
  const exportState = exportPosture({
    destinations: input.exportDestinations,
    liveCount: liveExportDestinationCount,
    failingCount: failingExportDestinationCount,
  });

  const checklist: AgentGuardProductionRolloutChecklistItem[] = [
    checklistItem({
      id: "active_source",
      label: "Active source",
      status: activeSources.length > 0 ? "pass" : "blocked",
      summary:
        activeSources.length > 0
          ? `${activeSources.length} active source${activeSources.length === 1 ? "" : "s"} configured.`
          : "Create and prove at least one active source before rollout.",
    }),
    checklistItem({
      id: "recent_activity",
      label: "Recent activity",
      status:
        sourcesWithRecentActivity.length > 0
          ? "pass"
          : activeSources.length > 0
            ? "attention"
            : "blocked",
      summary:
        sourcesWithRecentActivity.length > 0
          ? `${sourcesWithRecentActivity.length} source${sourcesWithRecentActivity.length === 1 ? "" : "s"} have recent submitted activity.`
          : "No active source has recent submitted activity in the loaded window.",
    }),
    checklistItem({
      id: "source_scope",
      label: "Source scope",
      status:
        activeProductionSources.length === 0 ||
        activeProductionUnscopedSources.length > 0
          ? "attention"
          : "pass",
      summary:
        activeProductionSources.length === 0
          ? "No active production source is configured yet."
          : activeProductionUnscopedSources.length > 0
            ? "One or more production sources accept any submitted tool name. Confirm that broad scope is intentional."
            : "Production source keys are scoped to named tools.",
    }),
    checklistItem({
      id: "policy_coverage",
      label: "Policy coverage",
      status:
        productionNeedsPolicyScopeRows.length > 0 || unknownSourceRows.length > 0
          ? "blocked"
          : productionCoverageRows.some((row) => row.policyOutcomeCount > 0)
            ? "pass"
            : "attention",
      summary:
        productionNeedsPolicyScopeRows.length > 0
          ? "Production source activity is flowing without recent policy outcomes."
          : unknownSourceRows.length > 0
            ? "Unknown source-attributed activity needs catalog review."
            : productionCoverageRows.some((row) => row.policyOutcomeCount > 0)
              ? "Production source activity has recent policy outcomes."
              : "Policy coverage is not proven for a production source yet.",
    }),
    checklistItem({
      id: "review_capacity",
      label: "Review capacity",
      status:
        totalNeedsActionReviews >= HIGH_REVIEW_LOAD_THRESHOLD
          ? "blocked"
          : totalNeedsActionReviews > 0
            ? "attention"
            : "pass",
      summary:
        totalNeedsActionReviews >= HIGH_REVIEW_LOAD_THRESHOLD
          ? `${totalNeedsActionReviews} reviews need action. Work the queue before broadening rollout.`
          : totalNeedsActionReviews > 0
            ? `${totalNeedsActionReviews} review${totalNeedsActionReviews === 1 ? "" : "s"} need action. Manageable for a narrow pilot.`
            : "No source-attributed policy reviews need action in the loaded window.",
    }),
    checklistItem({
      id: "export_mode",
      label: "Export mode",
      status:
        failingExportDestinationCount > 0
          ? "blocked"
          : liveExportDestinationCount > 0
            ? "attention"
            : "pass",
      summary:
        failingExportDestinationCount > 0
          ? "At least one export destination is failing."
          : liveExportDestinationCount > 0
            ? "Live automatic export is armed. Confirm receiver readiness before production rollout."
            : "No failing or live automatic export posture is loaded.",
    }),
  ];

  const blockedChecks = checklist.filter((item) => item.status === "blocked").length;
  const hasProductionCoverage = productionCoverageRows.some(
    (row) => row.policyOutcomeCount > 0
  );

  let status: AgentGuardProductionRolloutStatus = "testing";
  if (liveExportDestinationCount > 0) {
    status = "live_caution";
  } else if (failingExportDestinationCount > 0) {
    status = "needs_review";
  } else if (activeSources.length === 0 || sourcesWithRecentActivity.length === 0) {
    status = "testing";
  } else if (blockedChecks > 0) {
    status = "needs_review";
  } else if (
    activeSources.length > 0 &&
    sourcesWithRecentActivity.length > 0 &&
    hasProductionCoverage
  ) {
    status = "ready_for_pilot";
  }

  const sourceRows = input.coverageRows.map((row) => {
    const rowStatus = sourceStatus({
      row,
      liveExportDestinationCount,
    });
    return {
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      environment: row.sourceEnvironment,
      status: rowStatus,
      label: ROLLOUT_LABELS[rowStatus],
      nextStep: sourceNextStep({ row, status: rowStatus }),
    };
  });
  const needsReviewSourceCount = sourceRows.filter(
    (row) => row.status === "needs_review"
  ).length;

  return {
    status,
    label: ROLLOUT_LABELS[status],
    summary: rolloutSummary(status),
    checklist,
    sourceRows,
    metrics: {
      activeSourceCount: activeSources.length,
      activeProductionSourceCount: activeProductionSources.length,
      recentActivitySourceCount: sourcesWithRecentActivity.length,
      policyOutcomeSourceCount: activeCoverageRows.filter(
        (row) => row.policyOutcomeCount > 0
      ).length,
      needsReviewSourceCount,
      needsActionReviewCount: totalNeedsActionReviews,
      liveExportDestinationCount,
      failingExportDestinationCount,
    },
    exportPostureLabel: exportState.label,
    exportWarning: exportState.warning,
  };
}
