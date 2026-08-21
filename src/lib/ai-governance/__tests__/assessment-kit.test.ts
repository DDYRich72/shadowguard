import { describe, expect, it } from "vitest";
import {
  assessmentKit,
  buildManualInventoryCsv,
  manualInventoryCsvColumns,
} from "../assessment-kit";

describe("self-service assessment kit", () => {
  it("includes required manual inventory columns", () => {
    expect(manualInventoryCsvColumns).toContain("system_name");
    expect(manualInventoryCsvColumns).toContain("use_case");
    expect(manualInventoryCsvColumns).toContain("data_sensitivity");
    expect(manualInventoryCsvColumns).toContain("human_review_required");
    expect(manualInventoryCsvColumns).toContain("next_review_date");
    expect(manualInventoryCsvColumns).toContain("evidence_notes");
  });

  it("generates a CSV template with a header and sample row", () => {
    const csv = buildManualInventoryCsv();
    const rows = csv.split("\n");

    expect(rows).toHaveLength(2);
    expect(rows[0].startsWith("system_name,department,owner_name")).toBe(true);
    expect(rows[1]).toContain("Customer Support Assistant");
  });

  it("includes the required self-service sections", () => {
    expect(assessmentKit.offer.deliverables).toContain("Leadership-ready readiness report.");
    expect(assessmentKit.packages.map((pkg) => pkg.name)).toEqual([
      "AI Governance Readiness Assessment",
      "Family Office AI Risk Review",
      "Leadership AI Governance Pack",
    ]);
    expect(assessmentKit.intakeChecklist.map((section) => section.title)).toEqual([
      "Inventory",
      "Data And Impact",
      "Governance",
    ]);
    expect(assessmentKit.workflow.some((step) => step.title === "Generate Report")).toBe(true);
    expect(assessmentKit.kickoffAgenda.length).toBeGreaterThan(0);
    expect(assessmentKit.materialsRequest.length).toBeGreaterThan(0);
    expect(assessmentKit.deliveryChecklist).toContain("Secure delivery link created only after final approval.");
    expect(assessmentKit.executiveReadout.some((item) => item.includes("readiness"))).toBe(true);
    expect(assessmentKit.successMetrics).toContain("All material AI systems inventoried.");
  });
});
