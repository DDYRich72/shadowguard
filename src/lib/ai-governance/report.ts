import { calculateControlReadiness, isClosedControl } from "./controls";
import { calculateFrameworkCoverage } from "./frameworks";
import {
  buildControlEvidenceGroups,
  evidenceGapsForControls,
  hasControlEvidence,
  sortEvidenceForDisplay,
  type ControlEvidenceGroup,
} from "./evidence";
import type {
  AIRiskAssessment,
  AIGovernanceRiskTier,
  AIFrameworkCoverageItem,
  AISystem,
  AISystemApprovalStatus,
  AISystemControl,
  AISystemEvidence,
  ControlReadinessSummary,
} from "./types";

export type EvidenceSummary = {
  controlsWithEvidence: AISystemControl[];
  controlEvidenceGroups: ControlEvidenceGroup[];
  standaloneEvidence: AISystemEvidence[];
  evidenceGaps: AISystemControl[];
};

export type GovernanceReadinessReport = {
  generatedAt: string;
  system: AISystem;
  latestAssessment: AIRiskAssessment | null;
  readiness: ControlReadinessSummary;
  openControls: AISystemControl[];
  closedControls: AISystemControl[];
  evidenceRecords: AISystemEvidence[];
  evidence: EvidenceSummary;
  frameworkCoverage: AIFrameworkCoverageItem[];
  nextActions: string[];
};

const priorityRank: Record<AISystemControl["priority"], number> = {
  required: 0,
  recommended: 1,
};

const statusRank: Record<AISystemControl["status"], number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
  waived: 3,
};

const elevatedRisks = new Set<AIGovernanceRiskTier>(["critical", "high"]);
const closedApprovalStatuses = new Set<AISystemApprovalStatus>(["approved", "blocked", "retired"]);

export function sortControlsForReport(controls: AISystemControl[]): AISystemControl[] {
  return [...controls].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) return statusDelta;

    return a.title.localeCompare(b.title);
  });
}

function buildEvidenceSummary(
  controls: AISystemControl[],
  evidenceRecords: AISystemEvidence[]
): EvidenceSummary {
  const controlsWithEvidence = sortControlsForReport(
    controls.filter((control) => hasControlEvidence(control, evidenceRecords))
  );

  return {
    controlsWithEvidence,
    controlEvidenceGroups: buildControlEvidenceGroups(controlsWithEvidence, evidenceRecords),
    standaloneEvidence: sortEvidenceForDisplay(
      evidenceRecords.filter((evidence) => !evidence.control_id)
    ),
    evidenceGaps: sortControlsForReport(evidenceGapsForControls(controls, evidenceRecords)),
  };
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function buildNextActions(params: {
  system: AISystem;
  latestAssessment: AIRiskAssessment | null;
  controls: AISystemControl[];
  readiness: ControlReadinessSummary;
  evidenceGaps: AISystemControl[];
}): string[] {
  const { system, latestAssessment, controls, readiness, evidenceGaps } = params;
  const actions: string[] = [];

  if (!latestAssessment) {
    actions.push("Complete the AI risk assessment so ShadowGuard can score risk and generate required controls.");
  }

  if (latestAssessment && controls.length === 0) {
    actions.push("Re-run the latest assessment to materialize the recommended controls into trackable tasks.");
  }

  const requiredOpen = controls.filter(
    (control) => control.priority === "required" && !isClosedControl(control.status)
  ).length;

  if (requiredOpen > 0) {
    actions.push(
      `Close or waive ${requiredOpen} required ${pluralize(requiredOpen, "control")} before treating this system as governance-ready.`
    );
  } else if (readiness.open > 0) {
    actions.push(
      `Resolve ${readiness.open} open ${pluralize(readiness.open, "control")} to improve readiness.`
    );
  }

  const reportRisk = latestAssessment?.risk_tier ?? system.risk_tier;
  if (elevatedRisks.has(reportRisk) && !closedApprovalStatuses.has(system.approval_status)) {
    actions.push("Review approval status with the accountable owner before expanding this AI use case.");
  }

  if (evidenceGaps.length > 0) {
    actions.push(
      `Add evidence metadata for ${evidenceGaps.length} closed ${pluralize(evidenceGaps.length, "control")} that currently lack proof.`
    );
  }

  if (actions.length === 0) {
    actions.push("Maintain periodic review and update evidence when the system, vendor, or use case changes.");
  }

  return actions;
}

export function buildGovernanceReadinessReport(params: {
  system: AISystem;
  latestAssessment: AIRiskAssessment | null;
  controls: AISystemControl[];
  evidenceRecords?: AISystemEvidence[];
  generatedAt: string;
}): GovernanceReadinessReport {
  const { system, latestAssessment, controls, evidenceRecords = [], generatedAt } = params;
  const sortedControls = sortControlsForReport(controls);
  const readiness = calculateControlReadiness(sortedControls);
  const evidence = buildEvidenceSummary(sortedControls, evidenceRecords);

  return {
    generatedAt,
    system,
    latestAssessment,
    readiness,
    openControls: sortedControls.filter((control) => !isClosedControl(control.status)),
    closedControls: sortedControls.filter((control) => isClosedControl(control.status)),
    evidenceRecords,
    evidence,
    frameworkCoverage: calculateFrameworkCoverage(sortedControls),
    nextActions: buildNextActions({
      system,
      latestAssessment,
      controls: sortedControls,
      readiness,
      evidenceGaps: evidence.evidenceGaps,
    }),
  };
}

export { hasControlEvidence };
