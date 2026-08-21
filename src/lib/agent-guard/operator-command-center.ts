import type {
  AgentGuardPilotReadinessConcern,
  AgentGuardPilotReadinessConcernSeverity,
  AgentGuardPilotReadinessReport,
  AgentGuardPilotReadinessStatus,
  AgentGuardPilotReadinessTone,
} from "./pilot-readiness-report";

export type AgentGuardOperatorCommandCenterAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  cta: string;
  tone: AgentGuardPilotReadinessTone;
};

export type AgentGuardOperatorCommandCenterSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AgentGuardPilotReadinessTone;
};

export type AgentGuardOperatorCommandCenter = {
  generatedAt: string;
  status: AgentGuardPilotReadinessStatus;
  label: string;
  summary: string;
  boundary: string;
  primaryAction: AgentGuardOperatorCommandCenterAction;
  secondaryActions: AgentGuardOperatorCommandCenterAction[];
  signals: AgentGuardOperatorCommandCenterSignal[];
};

export const AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY = {
  title: "Operator command center",
  overview:
    "Deterministic next-action guidance from AgentGuard submitted activity, source posture, policy coverage, review load, export posture, and rollout acknowledgement metadata.",
  boundary:
    "This command center is read-only guidance. It does not create source keys, change policies, mutate reviews, change export settings, create acknowledgements, or expand enforcement.",
} as const;

const ACTION_PRIORITY: Record<string, number> = {
  active_source: 10,
  recent_activity: 20,
  policy_coverage: 30,
  source_policy_scope: 35,
  review_capacity: 40,
  export_mode: 50,
  missing_acknowledgements: 60,
  stale_acknowledgements: 65,
};

const SEVERITY_TONE: Record<
  AgentGuardPilotReadinessConcernSeverity,
  AgentGuardPilotReadinessTone
> = {
  attention: "amber",
  blocked: "red",
  live_caution: "red",
};

function toneForConcern(
  concern: AgentGuardPilotReadinessConcern
): AgentGuardPilotReadinessTone {
  return SEVERITY_TONE[concern.severity];
}

function concernPriority(concern: AgentGuardPilotReadinessConcern): number {
  if (concern.id.startsWith("load_warning:")) return 80;
  return ACTION_PRIORITY[concern.id] ?? 90;
}

function sortedConcerns(
  concerns: AgentGuardPilotReadinessConcern[]
): AgentGuardPilotReadinessConcern[] {
  return [...concerns].sort(
    (left, right) =>
      concernPriority(left) - concernPriority(right) ||
      left.label.localeCompare(right.label)
  );
}

function actionFromConcern(
  concern: AgentGuardPilotReadinessConcern
): AgentGuardOperatorCommandCenterAction {
  const base = {
    id: concern.id,
    detail: concern.nextAction,
    tone: toneForConcern(concern),
  };

  if (concern.id === "active_source") {
    return {
      ...base,
      label: "Create and test a source key",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Create source",
    };
  }

  if (concern.id === "recent_activity") {
    return {
      ...base,
      label: "Prove recent submitted activity",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Send test event",
    };
  }

  if (concern.id === "policy_coverage" || concern.id === "source_policy_scope") {
    return {
      ...base,
      label: "Review policy coverage",
      href: "/dashboard/agent-guard/policies",
      cta: "Review policies",
    };
  }

  if (concern.id === "review_capacity") {
    return {
      ...base,
      label: "Work the review queue",
      href: "/dashboard/agent-guard/reviews",
      cta: "Work reviews",
    };
  }

  if (concern.id === "export_mode") {
    return {
      ...base,
      label: "Check export posture",
      href: "/dashboard/agent-guard/settings",
      cta: "Check exports",
    };
  }

  if (
    concern.id === "missing_acknowledgements" ||
    concern.id === "stale_acknowledgements"
  ) {
    return {
      ...base,
      label: "Refresh rollout acknowledgement evidence",
      href: "/dashboard/agent-guard/ingestion",
      cta: "Record review",
    };
  }

  if (concern.id.startsWith("load_warning:")) {
    return {
      ...base,
      label: "Review incomplete evidence",
      href: "/dashboard/agent-guard/readiness",
      cta: "Review evidence",
    };
  }

  return {
    ...base,
    label: concern.label,
    href: "/dashboard/agent-guard/readiness",
    cta: "Open readiness",
  };
}

function fallbackAction(
  report: AgentGuardPilotReadinessReport
): AgentGuardOperatorCommandCenterAction {
  if (report.status === "ready_for_pilot") {
    return {
      id: "controlled_pilot",
      label: "Run a controlled pilot",
      detail:
        "Keep source scope narrow, continue spot-checking submitted activity, and use the readiness report as the evidence packet.",
      href: "/dashboard/agent-guard/readiness",
      cta: "Open readiness report",
      tone: "green",
    };
  }

  return {
    id: "setup_agentguard",
    label: "Set up AgentGuard source evidence",
    detail:
      "Create a scoped server-side source key or send a safe test event before relying on pilot guidance.",
    href: "/dashboard/agent-guard/ingestion",
    cta: "Open ingestion",
    tone: "blue",
  };
}

function compactSignals(
  report: AgentGuardPilotReadinessReport
): AgentGuardOperatorCommandCenterSignal[] {
  return [
    {
      id: "posture",
      label: "Posture",
      value: report.label,
      detail: report.summary,
      tone:
        report.status === "ready_for_pilot"
          ? "green"
          : report.status === "live_caution"
            ? "red"
            : report.status === "needs_review"
              ? "amber"
              : "blue",
    },
    {
      id: "sources",
      label: "Active sources",
      value: `${report.metrics.activeSourceCount}/${report.metrics.configuredSourceCount}`,
      detail: "Configured source keys that are active in the loaded metadata.",
      tone: report.metrics.activeSourceCount > 0 ? "green" : "amber",
    },
    {
      id: "activity",
      label: "Sources with activity",
      value: String(report.metrics.recentActivitySourceCount),
      detail: "Sources with recent submitted activity.",
      tone: report.metrics.recentActivitySourceCount > 0 ? "green" : "amber",
    },
    {
      id: "policy_coverage",
      label: "Policy-covered sources",
      value: String(report.metrics.policyOutcomeSourceCount),
      detail: `${report.metrics.needsPolicyScopeCount} source${report.metrics.needsPolicyScopeCount === 1 ? "" : "s"} need policy scope review.`,
      tone: report.metrics.needsPolicyScopeCount === 0 ? "green" : "amber",
    },
    {
      id: "reviews",
      label: "Reviews needing action",
      value: String(report.metrics.needsActionReviewCount),
      detail: "Open or investigating review rows in the loaded window.",
      tone: report.metrics.needsActionReviewCount === 0 ? "green" : "amber",
    },
    {
      id: "exports",
      label: "Live exports",
      value: String(report.metrics.liveExportDestinationCount),
      detail: "Enabled automatic destinations with dry-run off.",
      tone: report.metrics.liveExportDestinationCount > 0 ? "red" : "green",
    },
  ];
}

export function buildAgentGuardOperatorCommandCenter(
  report: AgentGuardPilotReadinessReport
): AgentGuardOperatorCommandCenter {
  const orderedActions = sortedConcerns(report.concerns).map(actionFromConcern);
  const primaryAction = orderedActions[0] ?? fallbackAction(report);

  return {
    generatedAt: report.generatedAt,
    status: report.status,
    label: report.label,
    summary: report.summary,
    boundary: AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY.boundary,
    primaryAction,
    secondaryActions: orderedActions
      .filter((action) => action.id !== primaryAction.id)
      .slice(0, 3),
    signals: compactSignals(report),
  };
}
