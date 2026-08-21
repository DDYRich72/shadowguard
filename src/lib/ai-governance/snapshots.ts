import type {
  GovernanceReadinessReport,
} from "./report";
import type {
  PortfolioGovernanceReport,
} from "./portfolio-report";
import type {
  AIGovernanceRiskTier,
  GovernanceReportSnapshotType,
} from "./types";

export type SnapshotSummaryMetrics = Record<string, string | number | null>;

export const snapshotReportTypeLabels: Record<GovernanceReportSnapshotType, string> = {
  ai_system_readiness: "AI System Readiness",
  organization_governance: "Organization Governance",
};

export function summaryForReadinessReport(
  report: GovernanceReadinessReport
): SnapshotSummaryMetrics {
  const riskTier = report.latestAssessment?.risk_tier ?? report.system.risk_tier;

  return {
    systemName: report.system.name,
    riskTier,
    readinessPercent: report.readiness.readinessPercent,
    totalControls: report.readiness.total,
    openControls: report.readiness.open,
    evidenceGaps: report.evidence.evidenceGaps.length,
  };
}

export function summaryForPortfolioReport(
  report: PortfolioGovernanceReport
): SnapshotSummaryMetrics {
  return {
    totalSystems: report.totals.totalSystems,
    assessedSystems: report.totals.assessedSystems,
    readinessPercent: report.totals.readinessPercent,
    highRiskSystems: report.totals.highRiskSystems,
    openRequiredControls: report.totals.openRequiredControls,
    evidenceGaps: report.totals.evidenceGaps,
    mcpTools: report.mcpPosture?.totalTools ?? 0,
    mcpHighRiskTools: report.mcpPosture?.highRiskTools.length ?? 0,
    mcpPendingReviewTools: report.mcpPosture?.pendingReviewTools.length ?? 0,
    mcpBlockedTools: report.mcpPosture?.blockedTools.length ?? 0,
    mcpUnlinkedTools: report.mcpPosture?.unlinkedTools.length ?? 0,
    ...(report.reviewCadence
      ? { overdueReviews: report.reviewCadence.overdue }
      : {}),
    // Scan-delta headline (omit when fewer than two scans exist so older
    // snapshots and delta-less orgs don't render zero-noise).
    ...(report.scanDelta
      ? {
          newAiToolsSinceLastScan: report.scanDelta.summary.newAiTools,
          riskIncreasesSinceLastScan: report.scanDelta.summary.riskIncreased,
          scopeExpansionsSinceLastScan: report.scanDelta.summary.scopeExpansions,
        }
      : {}),
  };
}

export function defaultSnapshotTitle(params: {
  reportType: GovernanceReportSnapshotType;
  systemName?: string | null;
  generatedAt: string;
}): string {
  const date = new Date(params.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (params.reportType === "ai_system_readiness") {
    return `${params.systemName ?? "AI System"} Readiness Report - ${date}`;
  }

  return `AI Governance Portfolio Report - ${date}`;
}

export function humanizeSnapshotMetric(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function riskTierFromSnapshotMetric(value: unknown): AIGovernanceRiskTier | null {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }
  return null;
}
