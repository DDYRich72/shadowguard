import { describe, expect, it } from "vitest";
import type {
  GovernanceReadinessReport,
} from "../report";
import type {
  PortfolioGovernanceReport,
} from "../portfolio-report";
import {
  defaultSnapshotTitle,
  summaryForPortfolioReport,
  summaryForReadinessReport,
} from "../snapshots";

describe("governance report snapshots", () => {
  it("extracts summary metrics for single-system readiness reports", () => {
    const report = {
      system: {
        name: "Support Assistant",
        risk_tier: "medium",
      },
      latestAssessment: {
        risk_tier: "high",
      },
      readiness: {
        readinessPercent: 67,
        total: 3,
        open: 1,
      },
      evidence: {
        evidenceGaps: [{ id: "gap-1" }],
      },
    } as unknown as GovernanceReadinessReport;

    expect(summaryForReadinessReport(report)).toEqual({
      systemName: "Support Assistant",
      riskTier: "high",
      readinessPercent: 67,
      totalControls: 3,
      openControls: 1,
      evidenceGaps: 1,
    });
  });

  it("extracts summary metrics for organization reports", () => {
    const report = {
      totals: {
        totalSystems: 4,
        assessedSystems: 3,
        readinessPercent: 75,
        highRiskSystems: 1,
        openRequiredControls: 2,
        evidenceGaps: 5,
      },
      mcpPosture: {
        totalTools: 3,
        highRiskTools: [{ id: "mcp-high" }],
        pendingReviewTools: [{ id: "mcp-pending" }],
        blockedTools: [],
        unlinkedTools: [{ id: "mcp-unlinked" }],
      },
    } as unknown as PortfolioGovernanceReport;

    expect(summaryForPortfolioReport(report)).toEqual({
      totalSystems: 4,
      assessedSystems: 3,
      readinessPercent: 75,
      highRiskSystems: 1,
      openRequiredControls: 2,
      evidenceGaps: 5,
      mcpTools: 3,
      mcpHighRiskTools: 1,
      mcpPendingReviewTools: 1,
      mcpBlockedTools: 0,
      mcpUnlinkedTools: 1,
    });
  });

  it("adds scan-delta headline metrics only when the report carries a delta", () => {
    const base = {
      totals: {
        totalSystems: 1,
        assessedSystems: 1,
        readinessPercent: 100,
        highRiskSystems: 0,
        openRequiredControls: 0,
        evidenceGaps: 0,
      },
      mcpPosture: {
        totalTools: 0,
        highRiskTools: [],
        pendingReviewTools: [],
        blockedTools: [],
        unlinkedTools: [],
      },
    };

    expect(
      summaryForPortfolioReport(base as unknown as PortfolioGovernanceReport)
    ).not.toHaveProperty("newAiToolsSinceLastScan");

    const withDelta = {
      ...base,
      reviewCadence: { overdue: 2, dueSoon: 1, scheduled: 0, unscheduled: 0 },
      scanDelta: {
        fromScannedAt: "2026-03-01T00:00:00.000Z",
        toScannedAt: "2026-06-01T00:00:00.000Z",
        summary: {
          newApps: 3,
          newAiTools: 2,
          removedApps: 0,
          riskIncreased: 1,
          riskDecreased: 0,
          scopeExpansions: 4,
          netUserChange: 6,
        },
        newApps: [],
        riskIncreases: [],
        scopeAdditions: [],
      },
    };

    const summary = summaryForPortfolioReport(
      withDelta as unknown as PortfolioGovernanceReport
    );
    expect(summary.newAiToolsSinceLastScan).toBe(2);
    expect(summary.riskIncreasesSinceLastScan).toBe(1);
    expect(summary.scopeExpansionsSinceLastScan).toBe(4);
    expect(summary.overdueReviews).toBe(2);
  });

  it("creates sensible default titles", () => {
    expect(
      defaultSnapshotTitle({
        reportType: "ai_system_readiness",
        systemName: "Support Assistant",
        generatedAt: "2026-05-13T12:00:00.000Z",
      })
    ).toContain("Support Assistant Readiness Report");

    expect(
      defaultSnapshotTitle({
        reportType: "organization_governance",
        generatedAt: "2026-05-13T12:00:00.000Z",
      })
    ).toContain("AI Governance Portfolio Report");
  });
});
