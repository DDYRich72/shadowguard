import { describe, expect, it } from "vitest";
import {
  buildAIInventoryImportPreview,
  duplicateKeyForAISystem,
  parseCsvText,
} from "../csv-import";

describe("manual AI inventory CSV import", () => {
  it("parses quoted fields with commas and semicolons", () => {
    const parsed = parseCsvText(
      [
        "system_name,use_case,data_types",
        '"Support Assistant","Draft replies, summarize tickets","customer tickets; account notes"',
      ].join("\n")
    );

    expect(parsed.globalErrors).toEqual([]);
    expect(parsed.headers).toEqual(["system_name", "use_case", "data_types"]);
    expect(parsed.records[0]?.values).toEqual([
      "Support Assistant",
      "Draft replies, summarize tickets",
      "customer tickets; account notes",
    ]);
  });

  it("enforces required fields", () => {
    const preview = buildAIInventoryImportPreview({
      csvText: "system_name,use_case\n,Review customer records",
    });

    expect(preview.summary.errorRows).toBe(1);
    expect(preview.rows[0]?.errors).toContain("system_name is required.");
  });

  it("flags duplicate existing systems", () => {
    const preview = buildAIInventoryImportPreview({
      csvText: "system_name,use_case\nSupport Assistant,Draft ticket replies",
      existingSystems: [
        {
          id: "system_1",
          name: "support assistant",
          use_case: "Draft ticket replies",
        },
      ],
    });

    expect(preview.summary.duplicateRows).toBe(1);
    expect(preview.rows[0]?.status).toBe("duplicate");
    expect(preview.rows[0]?.duplicateOf?.source).toBe("existing");
  });

  it("flags duplicate rows inside the same CSV after the first ready row", () => {
    const preview = buildAIInventoryImportPreview({
      csvText: [
        "system_name,use_case",
        "Support Assistant,Draft ticket replies",
        " support assistant , Draft ticket replies ",
      ].join("\n"),
    });

    expect(preview.summary.readyRows).toBe(1);
    expect(preview.summary.duplicateRows).toBe(1);
    expect(preview.rows[1]?.duplicateOf?.source).toBe("import");
  });

  it("validates email, boolean, and enum fields", () => {
    const preview = buildAIInventoryImportPreview({
      csvText: [
        "system_name,use_case,owner_email,customer_facing,data_sensitivity,training_data_use,approval_status,next_review_date",
        "Support Assistant,Draft replies,not-email,maybe,secret,forever,queued,06/30/2026",
      ].join("\n"),
    });

    expect(preview.summary.errorRows).toBe(1);
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        "owner_email must be a valid email address.",
        "customer_facing must be yes/no or true/false.",
        "data_sensitivity must be public, internal, confidential, or restricted.",
        "training_data_use must be unknown, none, opt_out, or allowed.",
        "approval_status must be discovered, under_review, approved, blocked, or retired.",
        "next_review_date must be YYYY-MM-DD.",
      ])
    );
  });

  it("normalizes header aliases and maps a ready payload", () => {
    const preview = buildAIInventoryImportPreview({
      csvText: [
        "name,usecase,owner,model,sensitivity,customer,human_review,approval,next_review",
        "Support Assistant,Draft replies,Casey,ChatGPT,Confidential,yes,no,Approved,2026-09-30",
      ].join("\n"),
    });

    expect(preview.summary.readyRows).toBe(1);
    expect(preview.rows[0]?.payload).toMatchObject({
      name: "Support Assistant",
      useCase: "Draft replies",
      ownerName: "Casey",
      modelName: "ChatGPT",
      dataSensitivity: "confidential",
      customerFacing: true,
      humanReviewRequired: false,
      approvalStatus: "approved",
      nextReviewDate: "2026-09-30",
      source: "import",
    });
  });

  it("uses normalized name and use case as the duplicate key", () => {
    expect(duplicateKeyForAISystem(" Support   Assistant ", " Draft Replies ")).toBe(
      "support assistant::draft replies"
    );
  });
});
