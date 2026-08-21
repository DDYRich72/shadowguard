import type {
  AgentGuardProductionRollout,
  AgentGuardProductionRolloutExportDestination,
  AgentGuardProductionRolloutStatus,
} from "./production-rollout";
import type { AgentGuardRolloutAcknowledgement } from "./rollout-acknowledgements";
import type { AgentGuardSourcePolicyCoverage } from "./source-policy-coverage";

export type AgentGuardPilotReadinessStatus =
  | "setup_required"
  | "ready_for_pilot"
  | "needs_review"
  | "live_caution";

export type AgentGuardPilotReadinessTone =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "slate";

export type AgentGuardPilotReadinessConcernSeverity =
  | "attention"
  | "blocked"
  | "live_caution";

export type AgentGuardPilotReadinessPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  action: string;
};

export type AgentGuardPilotReadinessMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AgentGuardPilotReadinessTone;
};

export type AgentGuardPilotReadinessConcern = {
  id: string;
  label: string;
  severity: AgentGuardPilotReadinessConcernSeverity;
  summary: string;
  nextAction: string;
};

export type AgentGuardPilotReadinessNextAction = {
  id: string;
  label: string;
  detail: string;
};

export type AgentGuardPilotReadinessAcknowledgementEvidence = {
  sourceId: string | null;
  sourceName: string;
  sourceRolloutLabel: string;
  overallRolloutLabel: string;
  exportPostureLabel: string;
  acknowledgedByEmail: string | null;
  createdAt: string;
  note: string;
  stale: boolean;
};

export type AgentGuardPilotReadinessReport = {
  generatedAt: string;
  status: AgentGuardPilotReadinessStatus;
  label: string;
  summary: string;
  boundary: string;
  metrics: {
    configuredSourceCount: number;
    activeSourceCount: number;
    recentActivitySourceCount: number;
    policyOutcomeSourceCount: number;
    needsPolicyScopeCount: number;
    needsActionReviewCount: number;
    policyCount: number;
    enabledPolicyCount: number;
    exportDestinationCount: number;
    liveExportDestinationCount: number;
    acknowledgementCount: number;
    acknowledgedSourceCount: number;
    staleAcknowledgementCount: number;
    missingProductionAcknowledgementCount: number;
  };
  evidenceMetrics: AgentGuardPilotReadinessMetric[];
  concerns: AgentGuardPilotReadinessConcern[];
  nextActions: AgentGuardPilotReadinessNextAction[];
  acknowledgementEvidence: AgentGuardPilotReadinessAcknowledgementEvidence[];
  loadWarnings: string[];
};

export const AGENT_GUARD_PILOT_READINESS_COPY = {
  overview:
    "Read-only pilot readiness evidence from AgentGuard source setup, submitted activity, policy coverage, review load, export posture, and rollout acknowledgements.",
  boundary:
    "This report is metadata-only operator evidence. It is not legal advice, not a certification, and not a compliance determination. It does not monitor every AI tool automatically, promote sources, change policies, switch export modes, or expand enforcement.",
  copyHeader: "AgentGuard pilot readiness evidence packet",
} as const;

const STATUS_LABELS: Record<AgentGuardPilotReadinessStatus, string> = {
  setup_required: "Setup required",
  ready_for_pilot: "Ready for pilot",
  needs_review: "Needs review",
  live_caution: "Live caution",
};

function rolloutStatusToReadiness(
  status: AgentGuardProductionRolloutStatus
): AgentGuardPilotReadinessStatus {
  if (status === "live_caution") return "live_caution";
  if (status === "ready_for_pilot") return "ready_for_pilot";
  if (status === "needs_review") return "needs_review";
  return "setup_required";
}

function statusSummary(status: AgentGuardPilotReadinessStatus): string {
  if (status === "live_caution") {
    return "Live export posture is armed or cautionary. Confirm receiver behavior, review ownership, and rollout acknowledgements before broadening use.";
  }
  if (status === "needs_review") {
    return "AgentGuard has useful setup evidence, but one or more concerns should be reviewed before expanding a pilot.";
  }
  if (status === "ready_for_pilot") {
    return "Core setup, submitted activity, and policy coverage signals support a controlled pilot with continued spot checks.";
  }
  return "AgentGuard still needs setup or proof activity before pilot readiness can be supported.";
}

function latestAcknowledgementMap(
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

function metricTone(value: number, expectedGood: "positive" | "zero"): AgentGuardPilotReadinessTone {
  if (expectedGood === "positive") return value > 0 ? "green" : "amber";
  return value === 0 ? "green" : "amber";
}

function activeProductionRows(input: AgentGuardSourcePolicyCoverage) {
  return input.rows.filter(
    (row) =>
      row.isConfiguredSource &&
      row.sourceStatus === "active" &&
      row.sourceEnvironment === "production"
  );
}

function buildAcknowledgementEvidence(input: {
  acknowledgements: AgentGuardRolloutAcknowledgement[];
  rollout: AgentGuardProductionRollout;
}): AgentGuardPilotReadinessAcknowledgementEvidence[] {
  const sourceStatusById = new Map(
    input.rollout.sourceRows.map((row) => [row.sourceId, row.status])
  );
  return input.acknowledgements.slice(0, 5).map((acknowledgement) => {
    const currentSourceStatus = acknowledgement.sourceId
      ? sourceStatusById.get(acknowledgement.sourceId)
      : undefined;
    const stale =
      Boolean(currentSourceStatus && currentSourceStatus !== acknowledgement.sourceRolloutStatus) ||
      acknowledgement.overallRolloutStatus !== input.rollout.status;
    return {
      sourceId: acknowledgement.sourceId,
      sourceName: acknowledgement.sourceName,
      sourceRolloutLabel: acknowledgement.sourceRolloutLabel,
      overallRolloutLabel: acknowledgement.overallRolloutLabel,
      exportPostureLabel: acknowledgement.exportPostureLabel,
      acknowledgedByEmail: acknowledgement.acknowledgedByEmail,
      createdAt: acknowledgement.createdAt,
      note: acknowledgement.note,
      stale,
    };
  });
}

function buildConcerns(input: {
  coverage: AgentGuardSourcePolicyCoverage;
  rollout: AgentGuardProductionRollout;
  missingProductionAcknowledgementCount: number;
  staleAcknowledgementCount: number;
  loadWarnings: string[];
}): AgentGuardPilotReadinessConcern[] {
  const concerns: AgentGuardPilotReadinessConcern[] = [];
  const activeSourceCheck = input.rollout.checklist.find(
    (item) => item.id === "active_source"
  );
  const recentActivityCheck = input.rollout.checklist.find(
    (item) => item.id === "recent_activity"
  );
  const policyCoverageCheck = input.rollout.checklist.find(
    (item) => item.id === "policy_coverage"
  );
  const reviewCapacityCheck = input.rollout.checklist.find(
    (item) => item.id === "review_capacity"
  );
  const exportModeCheck = input.rollout.checklist.find(
    (item) => item.id === "export_mode"
  );

  if (activeSourceCheck?.status === "blocked") {
    concerns.push({
      id: "active_source",
      label: "No active source",
      severity: "blocked",
      summary: activeSourceCheck.summary,
      nextAction: "Create and test a scoped server-side source key.",
    });
  }

  if (recentActivityCheck && recentActivityCheck.status !== "pass") {
    concerns.push({
      id: "recent_activity",
      label: "Recent activity not proven",
      severity: recentActivityCheck.status === "blocked" ? "blocked" : "attention",
      summary: recentActivityCheck.summary,
      nextAction: "Send a safe test event and verify source-attributed activity.",
    });
  }

  if (policyCoverageCheck && policyCoverageCheck.status !== "pass") {
    concerns.push({
      id: "policy_coverage",
      label: "Policy coverage needs review",
      severity: policyCoverageCheck.status === "blocked" ? "blocked" : "attention",
      summary: policyCoverageCheck.summary,
      nextAction:
        "Review policy conditions, source tool scope, and expected data categories.",
    });
  }

  if (reviewCapacityCheck && reviewCapacityCheck.status !== "pass") {
    concerns.push({
      id: "review_capacity",
      label: "Review queue needs ownership",
      severity: reviewCapacityCheck.status === "blocked" ? "blocked" : "attention",
      summary: reviewCapacityCheck.summary,
      nextAction: "Work open and investigating policy reviews before broadening rollout.",
    });
  }

  if (exportModeCheck && exportModeCheck.status !== "pass") {
    concerns.push({
      id: "export_mode",
      label:
        input.rollout.metrics.liveExportDestinationCount > 0
          ? "Live export is armed"
          : "Export posture needs review",
      severity:
        input.rollout.metrics.liveExportDestinationCount > 0
          ? "live_caution"
          : exportModeCheck.status === "blocked"
            ? "blocked"
            : "attention",
      summary: input.rollout.exportWarning ?? exportModeCheck.summary,
      nextAction:
        "Confirm receiver behavior, dry-run state, event selection, and owner before leaving live sends armed.",
    });
  }

  if (input.coverage.summary.needsPolicyScopeCount > 0) {
    concerns.push({
      id: "source_policy_scope",
      label: "Source activity without outcomes",
      severity: "blocked",
      summary: `${input.coverage.summary.needsPolicyScopeCount} source${input.coverage.summary.needsPolicyScopeCount === 1 ? "" : "s"} have recent activity without policy outcomes.`,
      nextAction:
        "Tune policy conditions or source allowed-tool scope before treating coverage as proven.",
    });
  }

  if (input.missingProductionAcknowledgementCount > 0) {
    concerns.push({
      id: "missing_acknowledgements",
      label: "Production source acknowledgement missing",
      severity: "attention",
      summary: `${input.missingProductionAcknowledgementCount} active production source${input.missingProductionAcknowledgementCount === 1 ? "" : "s"} with activity do not have latest rollout acknowledgement evidence.`,
      nextAction:
        "Record source-level rollout acknowledgement after reviewing the current guardrails.",
    });
  }

  if (input.staleAcknowledgementCount > 0) {
    concerns.push({
      id: "stale_acknowledgements",
      label: "Acknowledgement may be stale",
      severity: "attention",
      summary: `${input.staleAcknowledgementCount} recent acknowledgement${input.staleAcknowledgementCount === 1 ? "" : "s"} no longer match current rollout posture.`,
      nextAction:
        "Re-review the current posture and record a fresh acknowledgement if the decision still stands.",
    });
  }

  for (const warning of input.loadWarnings) {
    concerns.push({
      id: `load_warning:${warning}`,
      label: "Evidence source incomplete",
      severity: "attention",
      summary: warning,
      nextAction:
        "Confirm the current initial schema and related API are available, then refresh the report.",
    });
  }

  return concerns;
}

function buildNextActions(input: {
  status: AgentGuardPilotReadinessStatus;
  concerns: AgentGuardPilotReadinessConcern[];
}): AgentGuardPilotReadinessNextAction[] {
  if (input.concerns.length === 0 && input.status === "ready_for_pilot") {
    return [
      {
        id: "controlled_pilot",
        label: "Run a controlled pilot",
        detail:
          "Keep source scope narrow, leave dry-run where appropriate, and spot-check policy outcomes after fresh submitted activity.",
      },
      {
        id: "record_review",
        label: "Record operator review",
        detail:
          "Use rollout acknowledgements when a source posture is reviewed for board, client, or internal evidence.",
      },
    ];
  }

  return input.concerns.slice(0, 5).map((concern) => ({
    id: concern.id,
    label: concern.label,
    detail: concern.nextAction,
  }));
}

export function buildAgentGuardPilotReadinessReport(input: {
  coverage: AgentGuardSourcePolicyCoverage;
  rollout: AgentGuardProductionRollout;
  policies: AgentGuardPilotReadinessPolicy[];
  exportDestinations: AgentGuardProductionRolloutExportDestination[];
  acknowledgements: AgentGuardRolloutAcknowledgement[];
  generatedAt?: string;
  loadWarnings?: string[];
}): AgentGuardPilotReadinessReport {
  const latestBySource = latestAcknowledgementMap(input.acknowledgements);
  const productionRows = activeProductionRows(input.coverage);
  const activeProductionRowsWithActivity = productionRows.filter(
    (row) => row.recentActivityCount > 0
  );
  const missingProductionAcknowledgementCount =
    activeProductionRowsWithActivity.filter((row) => !latestBySource.has(row.sourceId))
      .length;
  const acknowledgementEvidence = buildAcknowledgementEvidence({
    acknowledgements: input.acknowledgements,
    rollout: input.rollout,
  });
  const staleAcknowledgementCount = acknowledgementEvidence.filter(
    (acknowledgement) => acknowledgement.stale
  ).length;
  const loadWarnings = input.loadWarnings ?? [];
  const concerns = buildConcerns({
    coverage: input.coverage,
    rollout: input.rollout,
    missingProductionAcknowledgementCount,
    staleAcknowledgementCount,
    loadWarnings,
  });
  let status = rolloutStatusToReadiness(input.rollout.status);
  if (
    status === "ready_for_pilot" &&
    concerns.some((concern) => concern.severity === "blocked")
  ) {
    status = "needs_review";
  }
  if (
    status === "ready_for_pilot" &&
    concerns.some((concern) => concern.severity === "live_caution")
  ) {
    status = "live_caution";
  }
  const enabledPolicyCount = input.policies.filter((policy) => policy.enabled).length;
  const acknowledgedSourceCount = new Set(
    input.acknowledgements
      .map((acknowledgement) => acknowledgement.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  ).size;

  const evidenceMetrics: AgentGuardPilotReadinessMetric[] = [
    {
      id: "sources",
      label: "Active sources",
      value: String(input.coverage.summary.activeSourceCount),
      detail: `${input.coverage.summary.configuredSourceCount} configured source${input.coverage.summary.configuredSourceCount === 1 ? "" : "s"}.`,
      tone: metricTone(input.coverage.summary.activeSourceCount, "positive"),
    },
    {
      id: "activity",
      label: "Sources with activity",
      value: String(input.coverage.summary.recentActivitySourceCount),
      detail: "Recent submitted activity loaded for source-level evidence.",
      tone: metricTone(input.coverage.summary.recentActivitySourceCount, "positive"),
    },
    {
      id: "policy_coverage",
      label: "Policy-covered sources",
      value: String(input.coverage.summary.policyOutcomeSourceCount),
      detail: `${input.coverage.summary.needsPolicyScopeCount} source${input.coverage.summary.needsPolicyScopeCount === 1 ? "" : "s"} need policy scope review.`,
      tone: metricTone(input.coverage.summary.needsPolicyScopeCount, "zero"),
    },
    {
      id: "reviews",
      label: "Needs-action reviews",
      value: String(input.coverage.summary.needsActionReviewCount),
      detail: "Open or investigating review items attributed to loaded source activity.",
      tone: metricTone(input.coverage.summary.needsActionReviewCount, "zero"),
    },
    {
      id: "exports",
      label: "Export posture",
      value: input.rollout.exportPostureLabel,
      detail: `${input.rollout.metrics.liveExportDestinationCount} live destination${input.rollout.metrics.liveExportDestinationCount === 1 ? "" : "s"} armed.`,
      tone:
        input.rollout.metrics.liveExportDestinationCount > 0
          ? "red"
          : input.rollout.metrics.failingExportDestinationCount > 0
            ? "amber"
            : "green",
    },
    {
      id: "acknowledgements",
      label: "Acknowledged sources",
      value: String(acknowledgedSourceCount),
      detail: `${staleAcknowledgementCount} acknowledgement${staleAcknowledgementCount === 1 ? "" : "s"} may be stale.`,
      tone: staleAcknowledgementCount > 0 ? "amber" : "green",
    },
  ];

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status,
    label: STATUS_LABELS[status],
    summary: statusSummary(status),
    boundary: AGENT_GUARD_PILOT_READINESS_COPY.boundary,
    metrics: {
      configuredSourceCount: input.coverage.summary.configuredSourceCount,
      activeSourceCount: input.coverage.summary.activeSourceCount,
      recentActivitySourceCount: input.coverage.summary.recentActivitySourceCount,
      policyOutcomeSourceCount: input.coverage.summary.policyOutcomeSourceCount,
      needsPolicyScopeCount: input.coverage.summary.needsPolicyScopeCount,
      needsActionReviewCount: input.coverage.summary.needsActionReviewCount,
      policyCount: input.policies.length,
      enabledPolicyCount,
      exportDestinationCount: input.exportDestinations.length,
      liveExportDestinationCount: input.rollout.metrics.liveExportDestinationCount,
      acknowledgementCount: input.acknowledgements.length,
      acknowledgedSourceCount,
      staleAcknowledgementCount,
      missingProductionAcknowledgementCount,
    },
    evidenceMetrics,
    concerns,
    nextActions: buildNextActions({ status, concerns }),
    acknowledgementEvidence,
    loadWarnings,
  };
}

export function agentGuardPilotReadinessReportToText(
  report: AgentGuardPilotReadinessReport
): string {
  const concerns =
    report.concerns.length > 0
      ? report.concerns
          .map(
            (concern) =>
              `- ${concern.label}: ${concern.summary} Next: ${concern.nextAction}`
          )
          .join("\n")
      : "- No blocking concerns in the loaded metadata window.";
  const nextActions =
    report.nextActions.length > 0
      ? report.nextActions
          .map((action) => `- ${action.label}: ${action.detail}`)
          .join("\n")
      : "- Continue periodic operator review.";
  const acknowledgements =
    report.acknowledgementEvidence.length > 0
      ? report.acknowledgementEvidence
          .map(
            (acknowledgement) =>
              `- ${acknowledgement.sourceName}: ${acknowledgement.sourceRolloutLabel}, ${acknowledgement.exportPostureLabel}, reviewed by ${acknowledgement.acknowledgedByEmail ?? "unknown"} on ${acknowledgement.createdAt}${acknowledgement.stale ? " (review current posture again)" : ""}`
          )
          .join("\n")
      : "- No rollout acknowledgements loaded.";

  return [
    AGENT_GUARD_PILOT_READINESS_COPY.copyHeader,
    `Generated: ${report.generatedAt}`,
    `Posture: ${report.label}`,
    `Summary: ${report.summary}`,
    "",
    "Core metrics:",
    `- Active sources: ${report.metrics.activeSourceCount}/${report.metrics.configuredSourceCount}`,
    `- Sources with recent submitted activity: ${report.metrics.recentActivitySourceCount}`,
    `- Sources with policy outcomes: ${report.metrics.policyOutcomeSourceCount}`,
    `- Needs-action reviews: ${report.metrics.needsActionReviewCount}`,
    `- Enabled policies: ${report.metrics.enabledPolicyCount}/${report.metrics.policyCount}`,
    `- Export destinations: ${report.metrics.exportDestinationCount}, live armed: ${report.metrics.liveExportDestinationCount}`,
    `- Rollout acknowledgements: ${report.metrics.acknowledgementCount}`,
    "",
    "Open concerns:",
    concerns,
    "",
    "Next operator actions:",
    nextActions,
    "",
    "Acknowledgement evidence:",
    acknowledgements,
    "",
    `Boundary: ${report.boundary}`,
  ].join("\n");
}
