import { describe, expect, it } from "vitest";
import {
  generateSnapshotPdf,
  hashPdfBytes,
  pdfFilenameForSnapshot,
} from "../pdf-export";
import type { GovernanceReportSnapshot } from "../types";

function snapshotFixture(): GovernanceReportSnapshot {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    org_id: "org-1",
    report_type: "ai_system_readiness",
    ai_system_id: "system-1",
    title: "Support Assistant Readiness Report",
    summary_metrics: {
      systemName: "Support Assistant",
      riskTier: "high",
      readinessPercent: 82,
      totalControls: 4,
      openControls: 1,
      evidenceGaps: 0,
    },
    snapshot: {
      system: {
        name: "Support Assistant",
        use_case: "Draft support replies",
        owner_name: "Support Ops",
        vendor_name: "OpenAI",
        data_sensitivity: "confidential",
        approval_status: "approved",
      },
      latestAssessment: {
        risk_tier: "high",
      },
      readiness: {
        readinessPercent: 82,
        total: 4,
      },
      openControls: [
        {
          title: "Refresh vendor review",
          category: "Vendor Review",
          priority: "recommended",
          status: "in_progress",
        },
      ],
      closedControls: [
        {
          title: "Assign accountable owner",
          category: "Governance",
          priority: "required",
          status: "completed",
        },
      ],
      evidenceRecords: [],
      evidence: {
        evidenceGaps: [],
        controlEvidenceGroups: [],
        standaloneEvidence: [],
      },
      frameworkCoverage: [
        {
          framework: "nist_ai_rmf",
          framework_label: "NIST AI RMF-style",
          code: "GOVERN",
          title: "Governance and accountability",
          category: "Govern",
          totalControls: 1,
          openControls: 0,
          closedControls: 1,
          readinessPercent: 100,
        },
      ],
      nextActions: ["Maintain periodic review."],
    },
    generated_by: "user-1",
    generated_by_email: "admin@example.com",
    client_name: "Acme Health",
    prepared_by_note: "Prepared by Example Organization.",
    executive_summary_note: "Ready for pilot review.",
    delivery_status: "final",
    finalized_at: "2026-05-13T13:00:00.000Z",
    finalized_by: "user-1",
    duplicated_from_snapshot_id: null,
    review_status: "approved",
    reviewer_name: "Security Reviewer",
    reviewer_email: "reviewer@example.com",
    review_note: "Approved for client delivery.",
    reviewed_at: "2026-05-13T12:45:00.000Z",
    reviewed_by: "user-1",
    pdf_generated_at: null,
    pdf_generated_by: null,
    pdf_filename: null,
    pdf_content_hash: null,
    pdf_size_bytes: null,
    created_at: "2026-05-13T12:00:00.000Z",
  };
}

describe("snapshot PDF export", () => {
  it("generates a valid PDF with client export pack content", () => {
    const generated = generateSnapshotPdf(snapshotFixture());
    const text = new TextDecoder().decode(generated.bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Client Export Pack");
    expect(text).toContain("Support Assistant Readiness Report");
    expect(text).toContain("Prepared for: Acme Health");
    expect(text).toContain("Framework Alignment");
    expect(text).toContain("NIST AI RMF-style GOVERN");
    expect(text).toContain("Status: Final");
    expect(text).not.toContain("Approved for client delivery");
    expect(text).not.toContain("Review Status");
    expect(generated.sizeBytes).toBe(generated.bytes.byteLength);
    expect(generated.contentHash).toHaveLength(64);
  });

  it("creates a safe stable filename", () => {
    expect(pdfFilenameForSnapshot(snapshotFixture())).toBe(
      "shadowguard-support-assistant-readiness-report-550e8400.pdf"
    );
  });

  it("hashes PDF bytes deterministically", () => {
    const generated = generateSnapshotPdf(snapshotFixture());

    expect(hashPdfBytes(generated.bytes)).toBe(generated.contentHash);
  });
});
