import { describe, expect, it } from "vitest";
import {
  calculateFrameworkCoverage,
  frameworkCatalog,
  frameworkMappingSummary,
  frameworkMappingsForControl,
  groupFrameworkCoverage,
} from "../frameworks";
import type { AISystemControl } from "../types";

function control(overrides: Partial<AISystemControl>): AISystemControl {
  return {
    id: "control-1",
    org_id: "org-1",
    ai_system_id: "system-1",
    control_key: "owner-assigned",
    title: "Assign accountable AI system owner",
    category: "Ownership",
    priority: "required",
    reason: "",
    owner: null,
    status: "not_started",
    due_date: null,
    notes: null,
    evidence_url: null,
    evidence_text: null,
    framework_mappings: [],
    source_assessment_id: null,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("AI governance framework mappings", () => {
  it("catalogs all crosswalk profiles with guardrails and categories", () => {
    expect(frameworkCatalog.map((profile) => profile.id)).toEqual([
      "nist_ai_rmf",
      "iso_42001",
      "eu_ai_act_readiness",
      "soc2_readiness",
      "iso_27001",
      "nist_csf",
      "hipaa_aware",
      "gdpr_aware",
      "ccpa_cpra_aware",
      "glba_ftc_safeguards",
      "ferpa_aware",
      "pci_dss_aware",
    ]);

    for (const profile of frameworkCatalog) {
      expect(profile.label).toBeTruthy();
      expect(profile.shortLabel).toBeTruthy();
      expect(profile.type).toMatch(/ai_governance|security|privacy|regulated_data|audit_readiness/);
      expect(profile.status).toMatch(/active|preview/);
      expect(profile.displayGroup).toMatch(/ai_governance|audit_security_readiness|regulated_data_privacy/);
      expect(profile.guardrail).toBeTruthy();
      expect(profile.categories.length).toBeGreaterThan(0);
    }
  });

  it("maps known controls to NIST AI RMF-style and ISO 42001-style categories", () => {
    const mappings = frameworkMappingsForControl({
      key: "vendor-review",
      category: "Vendor",
    });

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          framework: "nist_ai_rmf",
          framework_label: "NIST AI RMF-style",
          code: "MANAGE",
        }),
        expect.objectContaining({
          framework: "iso_42001",
          framework_label: "ISO 42001-style",
          code: "SUPPLIER",
        }),
      ])
    );
  });

  it("maps vendor review to SOC 2 and regulated-data readiness profiles", () => {
    const mappingIds = frameworkMappingsForControl({
      key: "vendor-review",
      category: "Vendor",
    }).map((mapping) => mapping.framework);

    expect(mappingIds).toEqual(
      expect.arrayContaining([
        "soc2_readiness",
        "hipaa_aware",
        "gdpr_aware",
        "ccpa_cpra_aware",
        "glba_ftc_safeguards",
        "ferpa_aware",
        "pci_dss_aware",
        "iso_27001",
        "nist_csf",
      ])
    );
  });

  it("maps data and regulated-use controls to privacy and AI Act readiness where appropriate", () => {
    const dataMappings = frameworkMappingsForControl({
      key: "data-handling-rules",
      category: "Data",
    }).map((mapping) => mapping.framework);
    const regulatedUseMappings = frameworkMappingsForControl({
      key: "regulated-use-review",
      category: "Compliance",
    }).map((mapping) => mapping.framework);

    expect(dataMappings).toEqual(
      expect.arrayContaining([
        "hipaa_aware",
        "gdpr_aware",
        "ccpa_cpra_aware",
        "glba_ftc_safeguards",
        "ferpa_aware",
        "pci_dss_aware",
      ])
    );
    expect(regulatedUseMappings).toEqual(
      expect.arrayContaining(["eu_ai_act_readiness", "gdpr_aware", "soc2_readiness"])
    );
  });

  it("falls back to practical governance mappings for unknown controls", () => {
    const mappings = frameworkMappingsForControl({
      key: "custom-control",
      category: "Custom",
    });

    expect(mappings).toHaveLength(2);
    expect(frameworkMappingSummary(mappings)).toContain("NIST AI RMF-style");
    expect(frameworkMappingSummary(mappings)).toContain("ISO 42001-style");
  });

  it("calculates coverage by framework category", () => {
    const controls = [
      control({
        id: "control-1",
        control_key: "vendor-review",
        category: "Vendor",
        status: "completed",
        framework_mappings: frameworkMappingsForControl({
          key: "vendor-review",
          category: "Vendor",
        }),
      }),
      control({
        id: "control-2",
        control_key: "training-data-opt-out",
        category: "Vendor",
        status: "not_started",
        framework_mappings: frameworkMappingsForControl({
          key: "training-data-opt-out",
          category: "Vendor",
        }),
      }),
    ];

    const coverage = calculateFrameworkCoverage(controls);
    const supplier = coverage.find(
      (item) => item.framework === "iso_42001" && item.code === "SUPPLIER"
    );

    expect(supplier).toMatchObject({
      totalControls: 2,
      closedControls: 1,
      openControls: 1,
      readinessPercent: 50,
    });
  });

  it("groups coverage into stakeholder-facing crosswalk families", () => {
    const coverage = calculateFrameworkCoverage([
      control({
        id: "control-1",
        control_key: "vendor-review",
        category: "Vendor",
        framework_mappings: frameworkMappingsForControl({
          key: "vendor-review",
          category: "Vendor",
        }),
      }),
    ]);
    const groups = groupFrameworkCoverage(coverage);

    expect(groups.map((group) => group.label)).toEqual([
      "AI Governance",
      "Audit / Security Readiness",
      "Regulated Data / Privacy",
    ]);
    expect(groups.find((group) => group.id === "audit_security_readiness")?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ framework: "soc2_readiness" }),
      ])
    );
  });
});
