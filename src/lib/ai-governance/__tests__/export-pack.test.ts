import { describe, expect, it } from "vitest";
import { buildClientExportPack } from "../export-pack";
import type { GovernanceReportSnapshot } from "../types";

describe("client export packs", () => {
  it("builds a client-ready export pack for readiness snapshots", () => {
    const snapshot = {
      id: "snapshot-1",
      org_id: "org-1",
      report_type: "ai_system_readiness",
      ai_system_id: "system-1",
      title: "Support Assistant Readiness Report",
      summary_metrics: {
        systemName: "Support Assistant",
        riskTier: "high",
        readinessPercent: 50,
        totalControls: 4,
        openControls: 2,
        evidenceGaps: 1,
      },
      snapshot: {
        system: {
          name: "Support Assistant",
          use_case: "Draft support replies",
          owner_name: "Support Ops",
          department: "Support",
          vendor_name: "OpenAI",
          data_sensitivity: "confidential",
          approval_status: "under_review",
          risk_tier: "medium",
        },
        latestAssessment: {
          risk_tier: "high",
        },
        readiness: {
          readinessPercent: 50,
          total: 4,
        },
        openControls: [
          {
            title: "Complete vendor security review",
            category: "Vendor Review",
            priority: "required",
            status: "not_started",
            owner: "Security",
          },
          {
            title: "Assign accountable AI system owner",
            category: "Governance",
            priority: "recommended",
            status: "in_progress",
          },
        ],
        closedControls: [
          {
            title: "Document approved use case",
            category: "Policy",
            priority: "required",
            status: "completed",
          },
          {
            title: "Legacy review",
            category: "Security",
            priority: "recommended",
            status: "waived",
          },
        ],
        evidenceRecords: [
          {
            title: "Vendor SOC 2",
            category: "vendor_review",
            status: "current",
            owner: "Security",
            evidence_url: "https://example.com/soc2",
          },
        ],
        evidence: {
          evidenceGaps: [
            {
              title: "Document approved use case",
              category: "Policy",
              priority: "required",
              status: "completed",
            },
          ],
          controlEvidenceGroups: [
            {
              control: {
                title: "Complete vendor security review",
              },
              evidence: [
                {
                  title: "Vendor SOC 2",
                  category: "vendor_review",
                  status: "current",
                },
              ],
              hasLegacyEvidence: false,
            },
          ],
          standaloneEvidence: [],
        },
        frameworkCoverage: [
          {
            framework: "nist_ai_rmf",
            framework_label: "NIST AI RMF-style",
            code: "MANAGE",
            title: "Third-party AI risk treatment",
            category: "Manage",
            totalControls: 1,
            openControls: 1,
            closedControls: 0,
            readinessPercent: 0,
          },
        ],
        nextActions: ["Close or waive 1 required control before client rollout."],
      },
      generated_by: "user-1",
      generated_by_email: "admin@example.com",
      client_name: "Acme Health",
      prepared_by_note: "Prepared by Example Organization.",
      executive_summary_note: "Vendor review should be completed before rollout.",
      delivery_status: "final",
      finalized_at: "2026-05-13T13:00:00.000Z",
      finalized_by: "user-1",
      duplicated_from_snapshot_id: null,
      created_at: "2026-05-13T12:00:00.000Z",
    } as unknown as GovernanceReportSnapshot;

    const pack = buildClientExportPack(snapshot);

    expect(pack.title).toBe("Support Assistant Readiness Report");
    expect(pack.clientName).toBe("Acme Health");
    expect(pack.preparedByNote).toBe("Prepared by Example Organization.");
    expect(pack.executiveSummaryNote).toContain("Vendor review");
    expect(pack.deliveryStatus).toBe("final");
    expect(pack.executiveSummary).toContain("Support Assistant");
    expect(pack.executiveSummary).toContain("50% readiness");
    expect(pack.metrics.map((metric) => metric.label)).toContain("Readiness Percent");
    expect(pack.frameworkAlignment).toEqual(
      expect.arrayContaining([
        "AI Governance crosswalks:",
        expect.stringContaining("NIST AI RMF-style MANAGE"),
      ])
    );
    expect(pack.keyFindings).toContain("Risk tier: High.");
    expect(pack.evidenceGaps[0]).toContain("Document approved use case");
    expect(pack.nextActions).toEqual([
      "Close or waive 1 required control before client rollout.",
    ]);
    expect(pack.appendix.some((section) => section.title === "Linked Evidence")).toBe(true);
    expect(Object.hasOwn(pack as object, "snapshot")).toBe(false);
    expect(Object.hasOwn(pack as object, "review_status")).toBe(false);
  });

  it("builds a client-ready export pack for organization snapshots", () => {
    const snapshot = {
      id: "snapshot-2",
      org_id: "org-1",
      report_type: "organization_governance",
      ai_system_id: null,
      title: "AI Governance Portfolio Report",
      summary_metrics: {
        totalSystems: 3,
        assessedSystems: 2,
        readinessPercent: 67,
        highRiskSystems: 1,
        openRequiredControls: 2,
        evidenceGaps: 1,
      },
      snapshot: {
        totals: {
          totalSystems: 3,
          assessedSystems: 2,
          readinessPercent: 67,
        },
        riskPosture: {
          critical: 0,
          high: 1,
          medium: 1,
          low: 1,
        },
        highRiskSystems: [
          {
            system: {
              name: "Customer Assistant",
            },
          },
        ],
        unassessedSystems: [
          {
            system: {
              name: "Marketing Writer",
            },
          },
        ],
        openRequiredControls: [
          {
            system: {
              name: "Customer Assistant",
            },
            control: {
              title: "Assign owner",
              category: "Governance",
              priority: "required",
              status: "not_started",
            },
          },
        ],
        evidenceGaps: [
          {
            system: {
              name: "Support Assistant",
            },
            control: {
              title: "Vendor review complete",
              category: "Vendor Review",
              priority: "required",
              status: "completed",
            },
          },
        ],
        frameworkCoverage: [
          {
            framework: "iso_42001",
            framework_label: "ISO 42001-style",
            code: "GOV",
            title: "AI governance responsibilities",
            category: "Governance",
            totalControls: 2,
            openControls: 1,
            closedControls: 1,
            readinessPercent: 50,
          },
        ],
        nextActions: ["Assign and close 2 open required controls."],
      },
      generated_by: "user-1",
      generated_by_email: "admin@example.com",
      client_name: "",
      prepared_by_note: "",
      executive_summary_note: "",
      delivery_status: "draft",
      finalized_at: null,
      finalized_by: null,
      duplicated_from_snapshot_id: null,
      created_at: "2026-05-13T12:00:00.000Z",
    } as unknown as GovernanceReportSnapshot;

    const pack = buildClientExportPack(snapshot);

    expect(pack.reportTypeLabel).toBe("Organization Governance");
    expect(pack.clientName).toBe("Client review");
    expect(pack.deliveryStatus).toBe("draft");
    expect(pack.executiveSummary).toContain("3 active AI systems");
    expect(pack.keyFindings).toContain(
      "2 of 3 systems have completed assessments."
    );
    expect(pack.frameworkAlignment).toEqual(
      expect.arrayContaining([
        "AI Governance crosswalks:",
        expect.stringContaining("ISO 42001-style GOV"),
      ])
    );
    expect(pack.evidenceGaps[0]).toContain("Support Assistant");
    expect(pack.appendix.map((section) => section.title)).toContain(
      "Open Required Controls"
    );
    expect(Object.hasOwn(pack as object, "snapshot")).toBe(false);
  });
});
