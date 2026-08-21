import { describe, expect, it } from "vitest";
import { buildInsurancePacket, type InsurancePacketStats } from "../insurance-packet";
import type { PortfolioGovernanceReport } from "../portfolio-report";

function report(overrides: Partial<PortfolioGovernanceReport["totals"]> = {}, systems: PortfolioGovernanceReport["systems"] = []): PortfolioGovernanceReport {
  return {
    generatedAt: "2026-06-10T00:00:00.000Z",
    systems,
    totals: {
      totalSystems: 0,
      assessedSystems: 0,
      unassessedSystems: 0,
      highRiskSystems: 0,
      totalControls: 0,
      openControls: 0,
      openRequiredControls: 0,
      evidenceGaps: 0,
      readinessPercent: 0,
      ...overrides,
    },
    riskPosture: { critical: 0, high: 0, medium: 0, low: 0 },
    highRiskSystems: [],
    unassessedSystems: [],
    openRequiredControls: [],
    evidenceGaps: [],
    frameworkCoverage: [],
    mcpPosture: {
      totalTools: 0,
      highRiskTools: [],
      pendingReviewTools: [],
      blockedTools: [],
      unlinkedTools: [],
    } as unknown as PortfolioGovernanceReport["mcpPosture"],
    reviewCadence: { overdue: 0, dueSoon: 0, scheduled: 0, unscheduled: 0 },
    nextActions: [],
  };
}

function stats(overrides: Partial<InsurancePacketStats> = {}): InsurancePacketStats {
  return {
    policyDocumentCount: 0,
    scanCount: 0,
    lastScannedAt: null,
    aiToolsDetected: 0,
    approvedToolsCount: 0,
    blockedToolsCount: 0,
    googleConnected: false,
    microsoftConnected: false,
    ...overrides,
  };
}

describe("buildInsurancePacket", () => {
  it("answers honestly when the org has no data", () => {
    const packet = buildInsurancePacket({
      report: report(),
      stats: stats(),
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    expect(packet.items).toHaveLength(9);
    // Nothing should be "yes" with zero data.
    expect(packet.items.every((item) => item.status !== "yes")).toBe(true);
    expect(packet.summary.yes).toBe(0);
    expect(packet.summary.readinessLabel).toBe("Early");
    expect(packet.disclaimer).toContain("does not guarantee any coverage");
  });

  it("marks inventory, policy, and discovery yes when evidenced", () => {
    const packet = buildInsurancePacket({
      report: report({ totalSystems: 5, assessedSystems: 5 }),
      stats: stats({
        policyDocumentCount: 2,
        scanCount: 3,
        lastScannedAt: "2026-06-01T00:00:00.000Z",
        aiToolsDetected: 12,
        googleConnected: true,
      }),
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    const byKey = new Map(packet.items.map((item) => [item.key, item]));
    expect(byKey.get("ai-inventory")?.status).toBe("yes");
    expect(byKey.get("ai-usage-policy")?.status).toBe("yes");
    expect(byKey.get("shadow-ai-discovery")?.status).toBe("yes");
    expect(byKey.get("shadow-ai-discovery")?.answer).toContain("Google Workspace");
    expect(byKey.get("risk-assessments")?.status).toBe("yes");
    expect(byKey.get("review-cadence")?.status).toBe("yes");
  });

  it("answers partial for incomplete assessments and open required controls", () => {
    const packet = buildInsurancePacket({
      report: report({
        totalSystems: 4,
        assessedSystems: 2,
        totalControls: 10,
        openRequiredControls: 3,
        readinessPercent: 60,
      }),
      stats: stats(),
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    const byKey = new Map(packet.items.map((item) => [item.key, item]));
    expect(byKey.get("risk-assessments")?.status).toBe("partial");
    expect(byKey.get("risk-assessments")?.answer).toContain("2 of 4");
    expect(byKey.get("high-risk-controls")?.status).toBe("partial");
    expect(byKey.get("high-risk-controls")?.answer).toContain("3 required controls remain open");
  });

  it("evidences third-party access review from approve/block decisions", () => {
    const packet = buildInsurancePacket({
      report: report(),
      stats: stats({ approvedToolsCount: 4, blockedToolsCount: 2, googleConnected: true }),
      generatedAt: "2026-06-10T00:00:00.000Z",
    });

    const item = packet.items.find((i) => i.key === "third-party-access");
    expect(item?.status).toBe("yes");
    expect(item?.answer).toContain("4 tools explicitly approved");
    expect(item?.answer).toContain("2 blocked");
  });

  it("never returns yes for vendor diligence without closed vendor-review controls", () => {
    const packet = buildInsurancePacket({
      report: report({ totalSystems: 2 }),
      stats: stats(),
      generatedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(packet.items.find((i) => i.key === "vendor-diligence")?.status).toBe("no");
  });
});
