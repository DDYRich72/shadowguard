import type { AgentGuardOperatorCommandCenter } from "./operator-command-center";
import type { AgentGuardPilotReadinessReport } from "./pilot-readiness-report";

export type AgentGuardEnterpriseSetupStatus =
  | "setup_required"
  | "in_progress"
  | "needs_review"
  | "live_caution"
  | "enterprise_ready";

export type AgentGuardEnterpriseSetupStepStatus =
  | "done"
  | "next"
  | "attention"
  | "locked";

export type AgentGuardEnterpriseSetupStep = {
  id:
    | "source_setup"
    | "test_activity"
    | "policy_baseline"
    | "policy_coverage"
    | "review_queue"
    | "readiness_packet"
    | "saved_evidence"
    | "export_receiver";
  label: string;
  status: AgentGuardEnterpriseSetupStepStatus;
  detail: string;
  href: string;
  cta: string;
  evidence: string;
};

export type AgentGuardEnterpriseSetupGuide = {
  status: AgentGuardEnterpriseSetupStatus;
  label: string;
  summary: string;
  boundary: string;
  progress: {
    completedSteps: number;
    totalSteps: number;
    percent: number;
  };
  nextStep: AgentGuardEnterpriseSetupStep;
  steps: AgentGuardEnterpriseSetupStep[];
  loadWarnings: string[];
};

export const AGENT_GUARD_ENTERPRISE_SETUP_COPY = {
  title: "Enterprise setup wizard",
  overview:
    "Read-only AgentGuard enterprise-readiness setup guidance from submitted activity, source posture, policy coverage, review load, readiness evidence, saved packets, and export posture.",
  boundary:
    "This wizard is read-only setup guidance. It does not create source keys, send test events, change policies, mutate reviews, change export settings, save packets, create acknowledgements, or expand enforcement.",
} as const;

type StepDraft = Omit<AgentGuardEnterpriseSetupStep, "status"> & {
  complete: boolean;
  available: boolean;
  attention?: boolean;
};

const STATUS_LABELS: Record<AgentGuardEnterpriseSetupStatus, string> = {
  setup_required: "Setup required",
  in_progress: "In progress",
  needs_review: "Needs review",
  live_caution: "Live caution",
  enterprise_ready: "Enterprise ready",
};

function statusSummary(status: AgentGuardEnterpriseSetupStatus): string {
  if (status === "enterprise_ready") {
    return "Core AgentGuard setup evidence is present for enterprise-readiness conversations. Continue periodic review before broader rollout.";
  }
  if (status === "live_caution") {
    return "Live export posture is armed. Confirm receivers, review ownership, and saved evidence before treating the setup as enterprise-ready.";
  }
  if (status === "needs_review") {
    return "AgentGuard has setup evidence, but review or evidence gaps should be handled before enterprise rollout.";
  }
  if (status === "in_progress") {
    return "AgentGuard setup is underway. Complete the highlighted next step before expanding the pilot.";
  }
  return "AgentGuard needs a proven server-side source before enterprise-readiness evidence can be supported.";
}

function applyStepStatuses(drafts: StepDraft[]): AgentGuardEnterpriseSetupStep[] {
  const nextIndex = drafts.findIndex((step) => !step.complete && step.available);

  return drafts.map((step, index) => {
    let status: AgentGuardEnterpriseSetupStepStatus = "locked";
    if (step.complete) {
      status = step.attention ? "attention" : "done";
    } else if (index === nextIndex) {
      status = "next";
    } else if (step.available && step.attention) {
      status = "attention";
    }

    return {
      id: step.id,
      label: step.label,
      detail: step.detail,
      href: step.href,
      cta: step.cta,
      evidence: step.evidence,
      status,
    };
  });
}

function deriveStatus(input: {
  report: AgentGuardPilotReadinessReport;
  completedSteps: number;
  totalSteps: number;
  steps: AgentGuardEnterpriseSetupStep[];
}): AgentGuardEnterpriseSetupStatus {
  if (input.report.status === "live_caution") return "live_caution";
  if (input.completedSteps === input.totalSteps) return "enterprise_ready";
  if (input.report.metrics.activeSourceCount === 0) return "setup_required";
  if (
    input.report.status === "needs_review" ||
    input.steps.some((step) => step.status === "attention")
  ) {
    return "needs_review";
  }
  return "in_progress";
}

export function buildAgentGuardEnterpriseSetupGuide(input: {
  report: AgentGuardPilotReadinessReport;
  commandCenter: AgentGuardOperatorCommandCenter;
  evidencePacketCount: number;
  loadWarnings?: string[];
}): AgentGuardEnterpriseSetupGuide {
  const { report } = input;
  const sourceReady = report.metrics.activeSourceCount > 0;
  const activityReady = report.metrics.recentActivitySourceCount > 0;
  const policyBaselineReady = report.metrics.enabledPolicyCount > 0;
  const policyCoverageReady =
    report.metrics.policyOutcomeSourceCount > 0 &&
    report.metrics.needsPolicyScopeCount === 0;
  const reviewQueueReady = report.metrics.needsActionReviewCount === 0;
  const readinessReady = report.status === "ready_for_pilot";
  const packetReady = input.evidencePacketCount > 0;
  const exportReady =
    report.metrics.exportDestinationCount > 0 &&
    report.metrics.liveExportDestinationCount === 0;

  const drafts: StepDraft[] = [
    {
      id: "source_setup",
      label: "Create active source",
      complete: sourceReady,
      available: true,
      href: "/dashboard/agent-guard/ingestion",
      cta: "Open ingestion",
      detail:
        "Create or confirm a scoped server-side source key for customer-controlled activity submission.",
      evidence: `${report.metrics.activeSourceCount} active source${report.metrics.activeSourceCount === 1 ? "" : "s"} loaded.`,
    },
    {
      id: "test_activity",
      label: "Prove submitted activity",
      complete: activityReady,
      available: sourceReady,
      href: "/dashboard/agent-guard/ingestion",
      cta: "Send test event",
      detail:
        "Send a safe test event so source attribution and metadata-only classification can be verified.",
      evidence: `${report.metrics.recentActivitySourceCount} source${report.metrics.recentActivitySourceCount === 1 ? "" : "s"} have recent submitted activity.`,
    },
    {
      id: "policy_baseline",
      label: "Confirm policy baseline",
      complete: policyBaselineReady,
      available: activityReady,
      href: "/dashboard/agent-guard/policies",
      cta: "Review policies",
      detail:
        "Review enabled policies and confirm the starter baseline fits the pilot scope.",
      evidence: `${report.metrics.enabledPolicyCount}/${report.metrics.policyCount} polic${report.metrics.policyCount === 1 ? "y" : "ies"} enabled.`,
    },
    {
      id: "policy_coverage",
      label: "Prove policy coverage",
      complete: policyCoverageReady,
      available: policyBaselineReady,
      attention: report.metrics.needsPolicyScopeCount > 0,
      href: "/dashboard/agent-guard/policies",
      cta: "Tune coverage",
      detail:
        "Confirm source-attributed activity produces expected policy outcomes before broadening rollout.",
      evidence: `${report.metrics.policyOutcomeSourceCount} source${report.metrics.policyOutcomeSourceCount === 1 ? "" : "s"} have policy outcomes; ${report.metrics.needsPolicyScopeCount} need scope review.`,
    },
    {
      id: "review_queue",
      label: "Work review queue",
      complete: reviewQueueReady,
      available: policyBaselineReady,
      attention: report.metrics.needsActionReviewCount > 0,
      href: "/dashboard/agent-guard/reviews",
      cta: "Open reviews",
      detail:
        "Work open and investigating warn/quarantine reviews before expanding pilot coverage.",
      evidence: `${report.metrics.needsActionReviewCount} review${report.metrics.needsActionReviewCount === 1 ? "" : "s"} need action.`,
    },
    {
      id: "readiness_packet",
      label: "Review readiness packet",
      complete: readinessReady,
      available: policyCoverageReady && reviewQueueReady,
      attention: report.status === "needs_review" || report.status === "live_caution",
      href: "/dashboard/agent-guard/readiness",
      cta: "Open readiness",
      detail:
        "Review the current readiness report and command-center next action before saving point-in-time evidence.",
      evidence: `Current posture: ${report.label}. Primary action: ${input.commandCenter.primaryAction.label}.`,
    },
    {
      id: "saved_evidence",
      label: "Save evidence packet",
      complete: packetReady,
      available: readinessReady || report.concerns.length === 0,
      href: "/dashboard/agent-guard/readiness",
      cta: "Save packet",
      detail:
        "Save metadata-only readiness and command-center evidence for enterprise-readiness review history.",
      evidence: `${input.evidencePacketCount} saved evidence packet${input.evidencePacketCount === 1 ? "" : "s"} loaded.`,
    },
    {
      id: "export_receiver",
      label: "Review export receiver posture",
      complete: exportReady,
      available: packetReady,
      attention: report.metrics.liveExportDestinationCount > 0,
      href: "/dashboard/agent-guard/settings",
      cta: "Open settings",
      detail:
        "Confirm export destinations, receiver examples, dry-run state, and live-send posture before enterprise integration work.",
      evidence: `${report.metrics.exportDestinationCount} destination${report.metrics.exportDestinationCount === 1 ? "" : "s"} configured; ${report.metrics.liveExportDestinationCount} live.`,
    },
  ];

  const steps = applyStepStatuses(drafts);
  const completedSteps = steps.filter((step) => step.status === "done").length;
  const totalSteps = steps.length;
  const status = deriveStatus({
    report,
    completedSteps,
    totalSteps,
    steps,
  });

  return {
    status,
    label: STATUS_LABELS[status],
    summary: statusSummary(status),
    boundary: AGENT_GUARD_ENTERPRISE_SETUP_COPY.boundary,
    progress: {
      completedSteps,
      totalSteps,
      percent: Math.round((completedSteps / totalSteps) * 100),
    },
    nextStep:
      steps.find((step) => step.status === "next") ??
      steps.find((step) => step.status === "attention") ??
      steps[steps.length - 1],
    steps,
    loadWarnings: [...report.loadWarnings, ...(input.loadWarnings ?? [])],
  };
}
