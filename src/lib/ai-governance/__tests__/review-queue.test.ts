import { describe, expect, it } from "vitest";
import {
  buildReportReviewQueue,
  isRemediationOverdue,
} from "../review-queue";
import type {
  ReportReviewQueueRemediation,
  ReportReviewQueueSnapshot,
} from "../review-queue";

function snapshot(
  overrides: Partial<ReportReviewQueueSnapshot>
): ReportReviewQueueSnapshot {
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
    ...overrides,
  };
}

describe("report review queue", () => {
  it("summarizes review and finalization states", () => {
    const snapshots = [
      snapshot({ id: "review", review_status: "needs_review" }),
      snapshot({ id: "changes", review_status: "changes_requested" }),
      snapshot({ id: "approved", review_status: "approved" }),
      snapshot({ id: "final", delivery_status: "final", review_status: "approved" }),
    ];

    const queue = buildReportReviewQueue({
      snapshots,
      remediations: [],
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(queue.summary).toMatchObject({
      totalSnapshots: 4,
      finalSnapshots: 1,
      actionableSnapshots: 3,
      needsReview: 1,
      changesRequested: 1,
      readyToFinalize: 1,
    });
    expect(queue.rows.map((row) => row.status)).toEqual([
      "needs_review",
      "changes_requested",
      "ready_to_finalize",
    ]);
  });

  it("prioritizes open remediation over approved review status", () => {
    const snapshots = [
      snapshot({
        id: "approved-with-remediation",
        review_status: "approved",
        created_at: "2026-05-12T12:00:00.000Z",
      }),
      snapshot({
        id: "needs-review",
        review_status: "needs_review",
        created_at: "2026-05-13T12:00:00.000Z",
      }),
    ];
    const remediations = [
      remediation({
        id: "remediation-1",
        snapshot_id: "approved-with-remediation",
        owner: "Jane Reviewer",
        due_date: "2026-05-20",
        status: "in_progress",
      }),
    ];

    const queue = buildReportReviewQueue({
      snapshots,
      remediations,
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(queue.rows[0]).toMatchObject({
      snapshotId: "approved-with-remediation",
      status: "remediation_blocked",
      openRemediationCount: 1,
      remediationOwners: ["Jane Reviewer"],
      nextDueDate: "2026-05-20",
    });
  });

  it("detects overdue open remediation items only", () => {
    expect(
      isRemediationOverdue(
        { status: "open", due_date: "2026-05-12" },
        "2026-05-13"
      )
    ).toBe(true);
    expect(
      isRemediationOverdue(
        { status: "resolved", due_date: "2026-05-12" },
        "2026-05-13"
      )
    ).toBe(false);
    expect(
      isRemediationOverdue(
        { status: "open", due_date: "2026-05-13" },
        "2026-05-13"
      )
    ).toBe(false);
  });

  it("excludes final snapshots and resolved remediation from actionable rows", () => {
    const snapshots = [
      snapshot({ id: "final", delivery_status: "final", review_status: "approved" }),
      snapshot({ id: "draft", review_status: "not_submitted" }),
      snapshot({ id: "approved", review_status: "approved" }),
    ];
    const remediations = [
      remediation({
        snapshot_id: "approved",
        status: "resolved",
        due_date: "2026-05-01",
      }),
    ];

    const queue = buildReportReviewQueue({
      snapshots,
      remediations,
      now: "2026-05-13T12:00:00.000Z",
    });

    expect(queue.rows).toHaveLength(1);
    expect(queue.rows[0].status).toBe("ready_to_finalize");
    expect(queue.summary.openRemediations).toBe(0);
    expect(queue.summary.overdueRemediations).toBe(0);
  });
});
