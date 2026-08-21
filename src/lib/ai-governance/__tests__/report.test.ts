import { describe, expect, it } from "vitest";
import type {
  AIRiskAssessment,
  AISystem,
  AISystemControl,
  AISystemEvidence,
} from "../types";
import {
  buildGovernanceReadinessReport,
  hasControlEvidence,
  sortControlsForReport,
} from "../report";

const system: AISystem = {
  id: "system-1",
  org_id: "org-1",
  name: "Customer Support Assistant",
  description: "Drafts responses for support agents.",
  owner_name: "Casey Morgan",
  owner_email: "casey@example.com",
  department: "Support Ops",
  vendor_name: "OpenAI",
  model_name: "GPT",
  use_case: "Draft customer support replies.",
  business_process: "Customer support",
  data_types: ["ticket context"],
  data_sensitivity: "confidential",
  customer_facing: true,
  employee_facing: true,
  automated_decisions: false,
  human_review_required: true,
  training_data_use: "opt_out",
  status: "active",
  approval_status: "under_review",
  risk_tier: "medium",
  next_review_date: null,
  source: "manual",
  connected_app_id: null,
  created_by: "user-1",
  created_at: "2026-05-12T12:00:00.000Z",
  updated_at: "2026-05-12T12:00:00.000Z",
};

const assessment: AIRiskAssessment = {
  id: "assessment-1",
  org_id: "org-1",
  ai_system_id: "system-1",
  version: 2,
  status: "completed",
  data_risk_score: 18,
  security_risk_score: 12,
  regulatory_risk_score: 8,
  business_impact_score: 15,
  overall_score: 53,
  risk_tier: "high",
  summary: "This system is high risk because it is customer-facing and handles confidential data.",
  recommended_controls: [],
  completed_by: "user-1",
  completed_at: "2026-05-12T13:00:00.000Z",
  created_at: "2026-05-12T13:00:00.000Z",
  updated_at: "2026-05-12T13:00:00.000Z",
};

function control(overrides: Partial<AISystemControl>): AISystemControl {
  return {
    id: overrides.id ?? "control-1",
    org_id: "org-1",
    ai_system_id: "system-1",
    control_key: overrides.control_key ?? "owner-assigned",
    title: overrides.title ?? "Assign accountable AI system owner",
    category: overrides.category ?? "Governance",
    priority: overrides.priority ?? "required",
    reason: overrides.reason ?? "Every AI system needs a named owner.",
    owner: overrides.owner ?? null,
    status: overrides.status ?? "not_started",
    due_date: overrides.due_date ?? null,
    notes: overrides.notes ?? null,
    evidence_url: overrides.evidence_url ?? null,
    evidence_text: overrides.evidence_text ?? null,
    framework_mappings: overrides.framework_mappings ?? [],
    source_assessment_id: overrides.source_assessment_id ?? "assessment-1",
    created_at: overrides.created_at ?? "2026-05-12T13:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-05-12T13:00:00.000Z",
  };
}

function evidence(overrides: Partial<AISystemEvidence>): AISystemEvidence {
  return {
    id: overrides.id ?? "evidence-1",
    org_id: "org-1",
    ai_system_id: "system-1",
    control_id: overrides.control_id ?? "control-1",
    title: overrides.title ?? "Vendor SOC 2 review",
    category: overrides.category ?? "vendor_review",
    owner: overrides.owner ?? "Security Lead",
    status: overrides.status ?? "current",
    evidence_url: overrides.evidence_url ?? "https://example.com/soc2",
    notes: overrides.notes ?? null,
    created_by: "user-1",
    created_at: "2026-05-12T13:00:00.000Z",
    updated_at: "2026-05-12T13:00:00.000Z",
  };
}

describe("governance readiness report", () => {
  it("groups open and closed controls and calculates readiness", () => {
    const report = buildGovernanceReadinessReport({
      system,
      latestAssessment: assessment,
      generatedAt: "2026-05-12T14:00:00.000Z",
      controls: [
        control({ id: "open", title: "Open control", status: "in_progress" }),
        control({ id: "done", title: "Done control", status: "completed", evidence_text: "Policy reviewed." }),
        control({ id: "waived", title: "Waived control", status: "waived" }),
      ],
    });

    expect(report.readiness.readinessPercent).toBe(67);
    expect(report.openControls.map((item) => item.id)).toEqual(["open"]);
    expect(report.closedControls.map((item) => item.id)).toEqual(["done", "waived"]);
    expect(report.evidence.controlsWithEvidence.map((item) => item.id)).toEqual(["done"]);
    expect(report.evidence.evidenceGaps.map((item) => item.id)).toEqual(["waived"]);
    expect(report.frameworkCoverage.length).toBeGreaterThan(0);
  });

  it("creates next actions for missing assessment", () => {
    const report = buildGovernanceReadinessReport({
      system,
      latestAssessment: null,
      generatedAt: "2026-05-12T14:00:00.000Z",
      controls: [],
    });

    expect(report.nextActions[0]).toContain("Complete the AI risk assessment");
  });

  it("prioritizes required open controls and evidence gaps", () => {
    const report = buildGovernanceReadinessReport({
      system,
      latestAssessment: assessment,
      generatedAt: "2026-05-12T14:00:00.000Z",
      controls: [
        control({ id: "required-open", status: "not_started", priority: "required" }),
        control({ id: "closed-no-evidence", status: "completed", priority: "recommended" }),
      ],
    });

    expect(report.nextActions.some((action) => action.includes("1 required control"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("lack proof"))).toBe(true);
    expect(report.nextActions.some((action) => action.includes("approval status"))).toBe(true);
  });

  it("sorts required controls before recommended controls", () => {
    const sorted = sortControlsForReport([
      control({ id: "recommended", title: "Recommended", priority: "recommended" }),
      control({ id: "required", title: "Required", priority: "required" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["required", "recommended"]);
  });

  it("detects URL or text evidence", () => {
    expect(hasControlEvidence(control({ evidence_url: "https://example.com" }))).toBe(true);
    expect(hasControlEvidence(control({ evidence_text: "Reviewed." }))).toBe(true);
    expect(hasControlEvidence(control({ evidence_url: " ", evidence_text: "" }))).toBe(false);
  });

  it("groups linked evidence by control and removes the evidence gap", () => {
    const closedControl = control({
      id: "closed-with-linked-evidence",
      status: "completed",
      evidence_url: "",
      evidence_text: "",
    });
    const report = buildGovernanceReadinessReport({
      system,
      latestAssessment: assessment,
      generatedAt: "2026-05-12T14:00:00.000Z",
      controls: [closedControl],
      evidenceRecords: [
        evidence({
          id: "linked",
          control_id: "closed-with-linked-evidence",
          title: "Approved vendor review",
        }),
      ],
    });

    expect(report.evidence.evidenceGaps).toEqual([]);
    expect(report.evidence.controlEvidenceGroups[0]?.control.id).toBe("closed-with-linked-evidence");
    expect(report.evidence.controlEvidenceGroups[0]?.evidence[0]?.title).toBe("Approved vendor review");
  });
});
