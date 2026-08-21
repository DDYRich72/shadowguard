import { describe, expect, it } from "vitest";
import { buildGovernanceReportAlerts } from "../review-alerts";
import type {
  ReportReviewQueueRemediation,
  ReportReviewQueueSnapshot,
} from "../review-queue";

function snapshot(overrides: Partial<ReportReviewQueueSnapshot>): ReportReviewQueueSnapshot {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "AI Governance Report",
    report_type: overrides.report_type ?? "ai_system_readiness",
    delivery_status: overrides.delivery_status ?? "draft",
    review_status: overrides.review_status ?? "not_submitted",
    created_at: overrides.created_at ?? "2026-05-13T12:00:00.000Z",
    ...overrides,
  };
}

function remediation(
  overrides: Partial<ReportReviewQueueRemediation>
): ReportReviewQueueRemediation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    snapshot_id: overrides.snapshot_id ?? "snapshot-1",
    status: overrides.status ?? "open",
    due_date: overrides.due_date ?? null,
    created_at: overrides.created_at ?? "2026-05-10T12:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-05-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("governance report alerts", () => {
  it("generates overdue and due-soon remediation alerts", () => {
    const snapshots = [
      snapshot({ id: "overdue", title: "Overdue Report" }),
      snapshot({ id: "soon", title: "Soon Report" }),
    ];
    const remediations = [
      remediation({
        id: "r1",
        snapshot_id: "overdue",
        due_date: "2026-05-12",
        owner: "Alex",
      }),
      remediation({
        id: "r2",
        snapshot_id: "soon",
        due_date: "2026-05-18",
        owner: "Sam",
      }),
    ];

    const result = buildGovernanceReportAlerts({
      snapshots,
      remediations,
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(result.summary.overdueRemediations).toBe(1);
    expect(result.summary.dueSoonRemediations).toBe(1);
    expect(result.alerts.map((alert) => alert.type)).toEqual([
      "overdue_remediation",
      "due_soon_remediation",
    ]);
    expect(result.alerts[0]).toMatchObject({
      severity: "critical",
      snapshotId: "overdue",
      owner: "Alex",
    });
  });

  it("generates review status alerts when remediation is not blocking", () => {
    const snapshots = [
      snapshot({ id: "review", review_status: "needs_review" }),
      snapshot({ id: "changes", review_status: "changes_requested" }),
      snapshot({ id: "approved", review_status: "approved" }),
    ];

    const result = buildGovernanceReportAlerts({
      snapshots,
      remediations: [],
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(result.alerts.map((alert) => alert.type)).toEqual([
      "changes_requested",
      "needs_review",
      "ready_to_finalize",
    ]);
    expect(result.summary).toMatchObject({
      needsReview: 1,
      changesRequested: 1,
      readyToFinalize: 1,
      totalAlerts: 3,
    });
  });

  it("does not generate review status alerts for remediation-blocked snapshots", () => {
    const snapshots = [
      snapshot({ id: "blocked", review_status: "changes_requested" }),
    ];
    const remediations = [
      remediation({
        snapshot_id: "blocked",
        due_date: "2026-05-20",
      }),
    ];

    const result = buildGovernanceReportAlerts({
      snapshots,
      remediations,
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].type).toBe("due_soon_remediation");
  });

  it("excludes final snapshots", () => {
    const snapshots = [
      snapshot({
        id: "final",
        delivery_status: "final",
        review_status: "approved",
      }),
    ];
    const remediations = [
      remediation({
        snapshot_id: "final",
        due_date: "2026-05-01",
      }),
    ];

    const result = buildGovernanceReportAlerts({
      snapshots,
      remediations,
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(result.alerts).toHaveLength(0);
    expect(result.summary.actionableSnapshots).toBe(0);
    expect(result.summary.overdueRemediations).toBe(0);
  });
});
