import { describe, expect, it } from "vitest";
import type { AIRiskAssessment, AISystem, AISystemControl, AISystemEvidence } from "../types";
import type { MCPTool } from "../../mcp-governance/types";
import {
  buildPortfolioGovernanceReport,
  latestAssessmentBySystem,
} from "../portfolio-report";

function system(overrides: Partial<AISystem>): AISystem {
  return {
    id: overrides.id ?? "system-1",
    org_id: "org-1",
    name: overrides.name ?? "Customer Support Assistant",
    description: null,
    owner_name: null,
    owner_email: null,
    department: "Support Ops",
    vendor_name: "OpenAI",
    model_name: null,
    use_case: "Draft support replies.",
    business_process: null,
    data_types: null,
    data_sensitivity: "confidential",
    customer_facing: true,
    employee_facing: true,
    automated_decisions: false,
    human_review_required: true,
    training_data_use: "opt_out",
    status: "active",
    approval_status: "under_review",
    risk_tier: overrides.risk_tier ?? "medium",
    next_review_date: overrides.next_review_date ?? null,
    source: "manual",
    connected_app_id: null,
    created_by: null,
    created_at: "2026-05-12T12:00:00.000Z",
    updated_at: "2026-05-12T12:00:00.000Z",
    ...overrides,
  };
}

function assessment(overrides: Partial<AIRiskAssessment>): AIRiskAssessment {
  return {
    id: overrides.id ?? "assessment-1",
    org_id: "org-1",
    ai_system_id: overrides.ai_system_id ?? "system-1",
    version: overrides.version ?? 1,
    status: overrides.status ?? "completed",
    data_risk_score: 10,
    security_risk_score: 10,
    regulatory_risk_score: 10,
    business_impact_score: 10,
    overall_score: 40,
    risk_tier: overrides.risk_tier ?? "medium",
    summary: null,
    recommended_controls: [],
    completed_by: null,
    completed_at: "2026-05-12T12:30:00.000Z",
    created_at: "2026-05-12T12:30:00.000Z",
    updated_at: "2026-05-12T12:30:00.000Z",
    ...overrides,
  };
}

function control(overrides: Partial<AISystemControl>): AISystemControl {
  return {
    id: overrides.id ?? "control-1",
    org_id: "org-1",
    ai_system_id: overrides.ai_system_id ?? "system-1",
    control_key: overrides.control_key ?? "owner-assigned",
    title: overrides.title ?? "Assign owner",
    category: "Governance",
    priority: overrides.priority ?? "required",
    reason: null,
    owner: null,
    status: overrides.status ?? "not_started",
    due_date: null,
    notes: null,
    evidence_url: overrides.evidence_url ?? null,
    evidence_text: overrides.evidence_text ?? null,
    framework_mappings: overrides.framework_mappings ?? [],
    source_assessment_id: null,
    created_at: "2026-05-12T12:30:00.000Z",
    updated_at: "2026-05-12T12:30:00.000Z",
    ...overrides,
  };
}

function evidence(overrides: Partial<AISystemEvidence>): AISystemEvidence {
  return {
    id: overrides.id ?? "evidence-1",
    org_id: "org-1",
    ai_system_id: overrides.ai_system_id ?? "system-1",
    control_id: overrides.control_id ?? "control-1",
    title: overrides.title ?? "Vendor review",
    category: overrides.category ?? "vendor_review",
    owner: null,
    status: "current",
    evidence_url: "https://example.com",
    notes: null,
    created_by: null,
    created_at: "2026-05-12T12:30:00.000Z",
    updated_at: "2026-05-12T12:30:00.000Z",
    ...overrides,
  };
}

function mcpTool(overrides: Partial<MCPTool>): MCPTool {
  return {
    id: overrides.id ?? "mcp-tool-1",
    org_id: "org-1",
    mcp_server_id: "mcp-server-1",
    ai_system_id: overrides.ai_system_id ?? null,
    name: overrides.name ?? "Repository Reader",
    description: null,
    capability_categories: overrides.capability_categories ?? ["read"],
    data_sensitivity: overrides.data_sensitivity ?? "internal",
    external_access: overrides.external_access ?? false,
    write_access: overrides.write_access ?? false,
    credential_access: overrides.credential_access ?? false,
    approval_status: overrides.approval_status ?? "pending_review",
    risk_tier: overrides.risk_tier ?? "medium",
    risk_score: overrides.risk_score ?? 40,
    owner_name: null,
    owner_email: null,
    status: overrides.status ?? "active",
    last_activity_at: null,
    created_by: null,
    created_at: "2026-05-22T12:00:00.000Z",
    updated_at: "2026-05-22T12:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("portfolio governance report", () => {
  it("selects the latest completed assessment by version", () => {
    const latest = latestAssessmentBySystem([
      assessment({ id: "v1", version: 1, risk_tier: "low" }),
      assessment({ id: "draft-v3", version: 3, status: "draft", risk_tier: "critical" }),
      assessment({ id: "v2", version: 2, risk_tier: "high" }),
    ]);

    expect(latest.get("system-1")?.id).toBe("v2");
  });

  it("calculates risk posture, readiness, open required controls, and evidence gaps", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-05-12T14:00:00.000Z",
      systems: [
        system({ id: "system-1", name: "Support Assistant" }),
        system({ id: "system-2", name: "Hiring Screener", risk_tier: "high" }),
      ],
      assessments: [
        assessment({ ai_system_id: "system-1", risk_tier: "medium" }),
        assessment({ ai_system_id: "system-2", risk_tier: "critical" }),
      ],
      controls: [
        control({ id: "open-required", ai_system_id: "system-2", status: "in_progress" }),
        control({ id: "closed-no-proof", ai_system_id: "system-2", status: "completed" }),
        control({ id: "closed-with-proof", ai_system_id: "system-1", status: "completed", evidence_text: "Policy reviewed." }),
      ],
    });

    expect(report.totals.totalSystems).toBe(2);
    expect(report.totals.assessedSystems).toBe(2);
    expect(report.totals.highRiskSystems).toBe(1);
    expect(report.totals.readinessPercent).toBe(67);
    expect(report.riskPosture.critical).toBe(1);
    expect(report.riskPosture.medium).toBe(1);
    expect(report.openRequiredControls.map((item) => item.control.id)).toEqual(["open-required"]);
    expect(report.evidenceGaps.map((item) => item.control.id)).toEqual(["closed-no-proof"]);
    expect(report.frameworkCoverage.length).toBeGreaterThan(0);
  });

  it("creates next actions for unassessed systems and missing proof", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-05-12T14:00:00.000Z",
      systems: [system({ id: "system-1" })],
      assessments: [],
      controls: [control({ id: "closed-no-proof", status: "waived" })],
    });

    expect(report.totals.unassessedSystems).toBe(1);
    expect(report.nextActions.some((action) => action.includes("without a completed assessment"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("lack proof"))).toBe(true);
  });

  it("does not count linked evidence records as evidence gaps", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-05-12T14:00:00.000Z",
      systems: [system({ id: "system-1" })],
      assessments: [assessment({ ai_system_id: "system-1" })],
      controls: [control({ id: "closed", status: "completed" })],
      evidenceRecords: [evidence({ control_id: "closed" })],
    });

    expect(report.totals.evidenceGaps).toBe(0);
    expect(report.systems[0]?.evidenceRecords.map((item) => item.id)).toEqual(["evidence-1"]);
  });

  it("adds MCP posture gaps and next actions to the portfolio report", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-05-22T14:00:00.000Z",
      systems: [system({ id: "system-1" })],
      assessments: [assessment({ ai_system_id: "system-1" })],
      controls: [],
      mcpTools: [
        mcpTool({
          id: "high-risk-unlinked",
          name: "Database Admin",
          approval_status: "pending_review",
          risk_tier: "critical",
          risk_score: 90,
          ai_system_id: null,
        }),
        mcpTool({
          id: "blocked-linked",
          name: "Filesystem Write",
          approval_status: "blocked",
          risk_tier: "high",
          risk_score: 78,
          ai_system_id: "system-1",
        }),
      ],
    });

    expect(report.mcpPosture.totalTools).toBe(2);
    expect(report.mcpPosture.highRiskTools.map((tool) => tool.id)).toEqual([
      "high-risk-unlinked",
      "blocked-linked",
    ]);
    expect(report.mcpPosture.pendingReviewTools.map((tool) => tool.id)).toEqual([
      "high-risk-unlinked",
    ]);
    expect(report.mcpPosture.blockedTools.map((tool) => tool.id)).toEqual([
      "blocked-linked",
    ]);
    expect(report.mcpPosture.unlinkedTools.map((tool) => tool.id)).toEqual([
      "high-risk-unlinked",
    ]);
    expect(report.nextActions.some((action) => action.includes("high or critical risk MCP"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("blocked MCP"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("pending MCP"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("Link 1 MCP tool"))).toBe(true);
  });

  it("starts with registration when the organization has no systems", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-05-12T14:00:00.000Z",
      systems: [],
      assessments: [],
      controls: [],
    });

    expect(report.nextActions).toEqual([
      "Register the first AI systems or import the manual inventory template before running governance reporting.",
    ]);
  });

  it("computes review cadence from next_review_date and flags overdue reviews", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-06-10T14:00:00.000Z",
      systems: [
        system({ id: "overdue", next_review_date: "2026-05-01" }),
        system({ id: "soon", next_review_date: "2026-06-20" }),
        system({ id: "later", next_review_date: "2026-12-01" }),
        system({ id: "none", next_review_date: null }),
      ],
      assessments: [],
      controls: [],
    });

    expect(report.reviewCadence).toEqual({
      overdue: 1,
      dueSoon: 1,
      scheduled: 1,
      unscheduled: 1,
    });
    expect(
      report.nextActions.some((action) => action.includes("overdue AI risk review"))
    ).toBe(true);
  });

  it("prompts to schedule review dates when no system has one", () => {
    const report = buildPortfolioGovernanceReport({
      generatedAt: "2026-06-10T14:00:00.000Z",
      systems: [system({ id: "a", next_review_date: null })],
      assessments: [assessment({ ai_system_id: "a" })],
      controls: [],
    });
    expect(
      report.nextActions.some((action) => action.includes("Schedule next review dates"))
    ).toBe(true);
  });

  it("omits scanDelta when not provided and embeds it when supplied", () => {
    const without = buildPortfolioGovernanceReport({
      generatedAt: "2026-06-10T14:00:00.000Z",
      systems: [system({ id: "system-1" })],
      assessments: [],
      controls: [],
    });
    expect(without.scanDelta).toBeUndefined();
    expect(JSON.parse(JSON.stringify(without))).not.toHaveProperty("scanDelta");

    const section = {
      fromScannedAt: "2026-03-01T00:00:00.000Z",
      toScannedAt: "2026-06-01T00:00:00.000Z",
      summary: {
        newApps: 2,
        newAiTools: 1,
        removedApps: 0,
        riskIncreased: 1,
        riskDecreased: 0,
        scopeExpansions: 1,
        netUserChange: 4,
      },
      newApps: [{ appName: "ChatGPT", isAiTool: true, riskLevel: "high", userCount: 3 }],
      riskIncreases: [{ appName: "Grammarly", previousScore: 40, currentScore: 55 }],
      scopeAdditions: [{ appName: "Zapier", addedScopes: ["mail.read"] }],
    };
    const withDelta = buildPortfolioGovernanceReport({
      generatedAt: "2026-06-10T14:00:00.000Z",
      systems: [system({ id: "system-1" })],
      assessments: [],
      controls: [],
      scanDelta: section,
    });
    expect(withDelta.scanDelta).toEqual(section);
  });
});
