import { calculateControlReadiness, isClosedControl } from "./controls";
import { calculateFrameworkCoverage } from "./frameworks";
import { evidenceGapsForControls } from "./evidence";
import { sortControlsForReport } from "./report";
import { buildMCPPostureSummary } from "../mcp-governance/risk";
import type {
  AIRiskAssessment,
  AIFrameworkCoverageItem,
  AIGovernanceRiskTier,
  AISystem,
  AISystemControl,
  AISystemEvidence,
  ControlReadinessSummary,
} from "./types";
import type { MCPPostureSummary, MCPTool } from "../mcp-governance/types";
import type { ScanDeltaSection } from "./scan-delta";
import { buildReviewCycleSummary, reviewableFromRow } from "./review-cycle";

export type PortfolioSystemReport = {
  system: AISystem;
  latestAssessment: AIRiskAssessment | null;
  controls: AISystemControl[];
  evidenceRecords: AISystemEvidence[];
  readiness: ControlReadinessSummary;
  riskTier: AIGovernanceRiskTier;
  openRequiredControls: AISystemControl[];
  evidenceGaps: AISystemControl[];
};

export type PortfolioReportTotals = {
  totalSystems: number;
  assessedSystems: number;
  unassessedSystems: number;
  highRiskSystems: number;
  totalControls: number;
  openControls: number;
  openRequiredControls: number;
  evidenceGaps: number;
  readinessPercent: number;
};

export type PortfolioGovernanceReport = {
  generatedAt: string;
  systems: PortfolioSystemReport[];
  totals: PortfolioReportTotals;
  riskPosture: Record<AIGovernanceRiskTier, number>;
  highRiskSystems: PortfolioSystemReport[];
  unassessedSystems: PortfolioSystemReport[];
  openRequiredControls: Array<{ system: AISystem; control: AISystemControl }>;
  evidenceGaps: Array<{ system: AISystem; control: AISystemControl }>;
  frameworkCoverage: AIFrameworkCoverageItem[];
  mcpPosture: MCPPostureSummary;
  /** Period-over-period scan changes. Absent when fewer than two scans exist. */
  scanDelta?: ScanDeltaSection;
  /** Recurring review cadence derived from ai_systems.next_review_date. */
  reviewCadence: {
    overdue: number;
    dueSoon: number;
    scheduled: number;
    unscheduled: number;
  };
  nextActions: string[];
};

const riskTiers: AIGovernanceRiskTier[] = ["critical", "high", "medium", "low"];
const riskRank: Record<AIGovernanceRiskTier, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function latestAssessmentBySystem(
  assessments: AIRiskAssessment[]
): Map<string, AIRiskAssessment> {
  const latest = new Map<string, AIRiskAssessment>();

  for (const assessment of assessments) {
    if (assessment.status !== "completed") continue;
    const current = latest.get(assessment.ai_system_id);
    if (!current || assessment.version > current.version) {
      latest.set(assessment.ai_system_id, assessment);
    }
  }

  return latest;
}

function groupControlsBySystem(controls: AISystemControl[]): Map<string, AISystemControl[]> {
  const grouped = new Map<string, AISystemControl[]>();

  for (const control of controls) {
    const existing = grouped.get(control.ai_system_id) ?? [];
    existing.push(control);
    grouped.set(control.ai_system_id, existing);
  }

  return grouped;
}

function groupEvidenceBySystem(evidenceRecords: AISystemEvidence[]): Map<string, AISystemEvidence[]> {
  const grouped = new Map<string, AISystemEvidence[]>();

  for (const evidence of evidenceRecords) {
    const existing = grouped.get(evidence.ai_system_id) ?? [];
    existing.push(evidence);
    grouped.set(evidence.ai_system_id, existing);
  }

  return grouped;
}

function buildRiskPosture(systems: PortfolioSystemReport[]) {
  return systems.reduce<Record<AIGovernanceRiskTier, number>>(
    (counts, item) => {
      counts[item.riskTier] += 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function sortSystemReports(items: PortfolioSystemReport[]): PortfolioSystemReport[] {
  return [...items].sort((a, b) => {
    const riskDelta = riskRank[a.riskTier] - riskRank[b.riskTier];
    if (riskDelta !== 0) return riskDelta;

    const requiredDelta = b.openRequiredControls.length - a.openRequiredControls.length;
    if (requiredDelta !== 0) return requiredDelta;

    const gapDelta = b.evidenceGaps.length - a.evidenceGaps.length;
    if (gapDelta !== 0) return gapDelta;

    return a.system.name.localeCompare(b.system.name);
  });
}

function buildPortfolioNextActions(report: Omit<PortfolioGovernanceReport, "nextActions">): string[] {
  const actions: string[] = [];

  if (report.totals.totalSystems === 0) {
    actions.push("Register the first AI systems or import the manual inventory template before running governance reporting.");
    if (report.mcpPosture.unlinkedTools.length > 0) {
      actions.push(
        `Link ${report.mcpPosture.unlinkedTools.length} ${pluralize(report.mcpPosture.unlinkedTools.length, "MCP tool")} to accountable AI System records.`
      );
    }
    return actions;
  }

  if (report.totals.unassessedSystems > 0) {
    actions.push(
      `Complete risk assessments for ${report.totals.unassessedSystems} ${pluralize(report.totals.unassessedSystems, "system")} without a completed assessment.`
    );
  }

  if (report.totals.highRiskSystems > 0) {
    actions.push(
      `Review ${report.totals.highRiskSystems} high or critical risk ${pluralize(report.totals.highRiskSystems, "system")} with accountable owners.`
    );
  }

  if (report.totals.openRequiredControls > 0) {
    actions.push(
      `Assign and close ${report.totals.openRequiredControls} open required ${pluralize(report.totals.openRequiredControls, "control")} before treating the portfolio as governance-ready.`
    );
  }

  if (report.totals.evidenceGaps > 0) {
    actions.push(
      `Add evidence metadata for ${report.totals.evidenceGaps} closed ${pluralize(report.totals.evidenceGaps, "control")} that currently lack proof.`
    );
  }

  if (report.reviewCadence.overdue > 0) {
    actions.push(
      `Complete ${report.reviewCadence.overdue} overdue AI risk ${pluralize(report.reviewCadence.overdue, "review")} and set the next review date.`
    );
  }

  if (
    report.reviewCadence.overdue === 0 &&
    report.reviewCadence.scheduled === 0 &&
    report.reviewCadence.dueSoon === 0 &&
    report.reviewCadence.unscheduled > 0
  ) {
    actions.push(
      `Schedule next review dates for ${report.reviewCadence.unscheduled} AI ${pluralize(report.reviewCadence.unscheduled, "system")} to establish a recurring review cadence.`
    );
  }

  if (report.mcpPosture.highRiskTools.length > 0) {
    actions.push(
      `Review ${report.mcpPosture.highRiskTools.length} high or critical risk ${pluralize(report.mcpPosture.highRiskTools.length, "MCP tool")} before expanding agent access.`
    );
  }

  if (report.mcpPosture.blockedTools.length > 0) {
    actions.push(
      `Confirm remediation ownership for ${report.mcpPosture.blockedTools.length} blocked ${pluralize(report.mcpPosture.blockedTools.length, "MCP tool")}.`
    );
  }

  if (report.mcpPosture.pendingReviewTools.length > 0) {
    actions.push(
      `Complete approval review for ${report.mcpPosture.pendingReviewTools.length} pending MCP ${pluralize(report.mcpPosture.pendingReviewTools.length, "tool")}.`
    );
  }

  if (report.mcpPosture.unlinkedTools.length > 0) {
    actions.push(
      `Link ${report.mcpPosture.unlinkedTools.length} ${pluralize(report.mcpPosture.unlinkedTools.length, "MCP tool")} to AI Systems so MCP activity rolls into board-ready evidence.`
    );
  }

  if (actions.length === 0) {
    actions.push("Maintain periodic review and re-run assessments when AI systems, vendors, or data use materially change.");
  }

  return actions;
}

export function buildPortfolioGovernanceReport(params: {
  systems: AISystem[];
  assessments: AIRiskAssessment[];
  controls: AISystemControl[];
  evidenceRecords?: AISystemEvidence[];
  mcpTools?: MCPTool[];
  scanDelta?: ScanDeltaSection;
  generatedAt: string;
}): PortfolioGovernanceReport {
  const {
    systems,
    assessments,
    controls,
    evidenceRecords = [],
    mcpTools = [],
    scanDelta,
    generatedAt,
  } = params;
  const latestAssessments = latestAssessmentBySystem(assessments);
  const controlsBySystem = groupControlsBySystem(controls);
  const evidenceBySystem = groupEvidenceBySystem(evidenceRecords);
  const mcpPosture = buildMCPPostureSummary(
    mcpTools.filter((tool) => tool.status !== "archived")
  );

  const systemReports = systems.map<PortfolioSystemReport>((system) => {
    const latestAssessment = latestAssessments.get(system.id) ?? null;
    const systemControls = sortControlsForReport(controlsBySystem.get(system.id) ?? []);
    const systemEvidence = evidenceBySystem.get(system.id) ?? [];
    const readiness = calculateControlReadiness(systemControls);
    const openRequiredControls = systemControls.filter(
      (control) => control.priority === "required" && !isClosedControl(control.status)
    );
    const evidenceGaps = evidenceGapsForControls(systemControls, systemEvidence);

    return {
      system,
      latestAssessment,
      controls: systemControls,
      evidenceRecords: systemEvidence,
      readiness,
      riskTier: latestAssessment?.risk_tier ?? system.risk_tier,
      openRequiredControls,
      evidenceGaps,
    };
  });

  const sortedSystems = sortSystemReports(systemReports);
  const allControls = sortedSystems.flatMap((item) => item.controls);
  const portfolioReadiness = calculateControlReadiness(allControls);
  const highRiskSystems = sortedSystems.filter(
    (item) => item.riskTier === "critical" || item.riskTier === "high"
  );
  const unassessedSystems = sortedSystems.filter((item) => !item.latestAssessment);
  const openRequiredControls = sortedSystems.flatMap((item) =>
    item.openRequiredControls.map((control) => ({ system: item.system, control }))
  );
  const evidenceGaps = sortedSystems.flatMap((item) =>
    item.evidenceGaps.map((control) => ({ system: item.system, control }))
  );

  const reportWithoutActions = {
    generatedAt,
    systems: sortedSystems,
    totals: {
      totalSystems: sortedSystems.length,
      assessedSystems: sortedSystems.length - unassessedSystems.length,
      unassessedSystems: unassessedSystems.length,
      highRiskSystems: highRiskSystems.length,
      totalControls: portfolioReadiness.total,
      openControls: portfolioReadiness.open,
      openRequiredControls: openRequiredControls.length,
      evidenceGaps: evidenceGaps.length,
      readinessPercent: portfolioReadiness.readinessPercent,
    },
    riskPosture: buildRiskPosture(sortedSystems),
    highRiskSystems,
    unassessedSystems,
    openRequiredControls,
    evidenceGaps,
    frameworkCoverage: calculateFrameworkCoverage(allControls),
    mcpPosture,
    ...(scanDelta ? { scanDelta } : {}),
    reviewCadence: (() => {
      const summary = buildReviewCycleSummary(
        systems.map((system) => reviewableFromRow(system)),
        new Date(generatedAt)
      );
      return {
        overdue: summary.counts.overdue,
        dueSoon: summary.counts.dueSoon,
        scheduled: summary.counts.scheduled,
        unscheduled: summary.counts.unscheduled,
      };
    })(),
  };

  return {
    ...reportWithoutActions,
    nextActions: buildPortfolioNextActions(reportWithoutActions),
  };
}

export { riskTiers };
