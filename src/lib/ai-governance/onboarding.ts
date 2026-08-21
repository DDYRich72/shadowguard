export type OnboardingStepId =
  | "intake"
  | "inventory"
  | "assessment"
  | "controls"
  | "report"
  | "delivery";

export type OnboardingStepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "needs_attention";

export type OnboardingMetrics = {
  googleConnected: boolean;
  microsoftConnected: boolean;
  aiSystemsCount: number;
  completedAssessmentsCount: number;
  controlsCount: number;
  completedOrWaivedControlsCount: number;
  evidenceCount: number;
  snapshotsCount: number;
  finalSnapshotsCount: number;
  pdfSnapshotsCount: number;
  deliveryLinksCount: number;
  firstSystemId?: string | null;
};

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  complete: boolean;
  status: OnboardingStepStatus;
  detail: string;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  nextStep: OnboardingStep;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  warnings: string[];
};

function assessmentHref(metrics: OnboardingMetrics): string {
  return metrics.firstSystemId
    ? `/dashboard/ai-systems/${metrics.firstSystemId}/assessment`
    : "/dashboard/ai-systems/new";
}

function systemDetailHref(metrics: OnboardingMetrics): string {
  return metrics.firstSystemId
    ? `/dashboard/ai-systems/${metrics.firstSystemId}`
    : "/dashboard/ai-systems";
}

function reportHref(metrics: OnboardingMetrics): string {
  if (metrics.snapshotsCount > 0) return "/dashboard/report-snapshots";
  return metrics.firstSystemId
    ? `/dashboard/ai-systems/${metrics.firstSystemId}/report`
    : "/dashboard/governance-report";
}

export function buildOnboardingProgress(
  metrics: OnboardingMetrics
): OnboardingProgress {
  const hasInventorySource =
    metrics.googleConnected || metrics.microsoftConnected || metrics.aiSystemsCount > 0;
  const hasInventory = metrics.aiSystemsCount > 0;
  const hasAssessment = metrics.completedAssessmentsCount > 0;
  const hasControlEvidence =
    metrics.evidenceCount > 0 || metrics.completedOrWaivedControlsCount > 0;
  const hasSnapshot = metrics.snapshotsCount > 0;
  const hasDelivery =
    metrics.finalSnapshotsCount > 0 ||
    metrics.pdfSnapshotsCount > 0 ||
    metrics.deliveryLinksCount > 0;

  const baseSteps: Array<Omit<OnboardingStep, "status">> = [
    {
      id: "intake",
      title: "Start intake",
      description: "Connect a provider or import the manual AI inventory CSV.",
      href: hasInventorySource ? "/dashboard/ai-systems" : "/dashboard/ai-systems/import",
      actionLabel: hasInventorySource ? "Review intake" : "Import inventory",
      complete: hasInventorySource,
      detail: hasInventorySource
        ? "An inventory source is available."
        : "Use Google, Microsoft, CSV import, or manual entry.",
    },
    {
      id: "inventory",
      title: "Build AI inventory",
      description: "Create or confirm at least one governed AI System.",
      href: hasInventory ? "/dashboard/ai-systems" : "/dashboard/ai-systems/new",
      actionLabel: hasInventory ? "Open inventory" : "Create AI System",
      complete: hasInventory,
      detail: `${metrics.aiSystemsCount} AI system${metrics.aiSystemsCount === 1 ? "" : "s"} on file.`,
    },
    {
      id: "assessment",
      title: "Run first assessment",
      description: "Complete the risk scorecard for the first AI System.",
      href: hasAssessment ? systemDetailHref(metrics) : assessmentHref(metrics),
      actionLabel: hasAssessment ? "Review assessment" : "Run assessment",
      complete: hasAssessment,
      detail: `${metrics.completedAssessmentsCount} completed assessment${metrics.completedAssessmentsCount === 1 ? "" : "s"}.`,
    },
    {
      id: "controls",
      title: "Add controls and evidence",
      description: "Track recommended controls and attach evidence metadata.",
      href: systemDetailHref(metrics),
      actionLabel: hasControlEvidence ? "Review evidence" : "Add evidence",
      complete: hasControlEvidence,
      detail:
        metrics.controlsCount > 0
          ? `${metrics.completedOrWaivedControlsCount} of ${metrics.controlsCount} controls completed or waived; ${metrics.evidenceCount} evidence records.`
          : "Controls appear after the first assessment.",
    },
    {
      id: "report",
      title: "Save report snapshot",
      description: "Freeze the readiness or organization report as a deliverable.",
      href: reportHref(metrics),
      actionLabel: hasSnapshot ? "Open snapshots" : "Generate report",
      complete: hasSnapshot,
      detail: `${metrics.snapshotsCount} saved report snapshot${metrics.snapshotsCount === 1 ? "" : "s"}.`,
    },
    {
      id: "delivery",
      title: "Prepare client delivery",
      description: "Finalize, export PDF, or create a secure client report link.",
      href: "/dashboard/report-snapshots",
      actionLabel: hasDelivery ? "Review delivery" : "Prepare delivery",
      complete: hasDelivery,
      detail: `${metrics.finalSnapshotsCount} final, ${metrics.pdfSnapshotsCount} PDF-ready, ${metrics.deliveryLinksCount} delivery link${metrics.deliveryLinksCount === 1 ? "" : "s"}.`,
    },
  ];

  const firstIncompleteIndex = baseSteps.findIndex((step) => !step.complete);
  const nextIndex = firstIncompleteIndex === -1 ? baseSteps.length - 1 : firstIncompleteIndex;
  const steps = baseSteps.map((step, index): OnboardingStep => {
    let status: OnboardingStepStatus = "upcoming";
    if (step.complete) status = "complete";
    if (!step.complete && index === nextIndex) status = "current";
    return { ...step, status };
  });

  const completedSteps = steps.filter((step) => step.complete).length;
  return {
    steps,
    nextStep: steps[nextIndex],
    completedSteps,
    totalSteps: steps.length,
    percentComplete: Math.round((completedSteps / steps.length) * 100),
    warnings: [],
  };
}
