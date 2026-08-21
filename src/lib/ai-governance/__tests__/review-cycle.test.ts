import { describe, expect, it } from "vitest";
import {
  buildReviewCycleSummary,
  classifyReviewStatus,
  daysUntil,
  reviewableFromRow,
  DUE_SOON_WINDOW_DAYS,
  type ReviewableSystem,
} from "../review-cycle";

const NOW = new Date("2026-06-10T15:30:00Z");

function system(overrides: Partial<ReviewableSystem> = {}): ReviewableSystem {
  return {
    id: "sys-1",
    name: "Support Assistant",
    ownerName: "Alice",
    nextReviewDate: null,
    riskTier: "medium",
    ...overrides,
  };
}

describe("daysUntil", () => {
  it("returns 0 for today regardless of time of day", () => {
    expect(daysUntil("2026-06-10", NOW)).toBe(0);
  });

  it("returns negative days for past dates and positive for future", () => {
    expect(daysUntil("2026-06-01", NOW)).toBe(-9);
    expect(daysUntil("2026-06-20", NOW)).toBe(10);
  });

  it("returns null for unparseable dates", () => {
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("classifyReviewStatus", () => {
  it("classifies missing dates as unscheduled", () => {
    expect(classifyReviewStatus(null, NOW).reviewStatus).toBe("unscheduled");
    expect(classifyReviewStatus("", NOW).reviewStatus).toBe("unscheduled");
  });

  it("classifies past dates as overdue", () => {
    const result = classifyReviewStatus("2026-05-01", NOW);
    expect(result.reviewStatus).toBe("overdue");
    expect(result.daysUntilDue).toBeLessThan(0);
  });

  it("classifies dates within the window as due_soon, inclusive of the boundary", () => {
    expect(classifyReviewStatus("2026-06-10", NOW).reviewStatus).toBe("due_soon");
    const boundary = new Date(NOW);
    boundary.setUTCDate(boundary.getUTCDate() + DUE_SOON_WINDOW_DAYS);
    expect(
      classifyReviewStatus(boundary.toISOString().slice(0, 10), NOW).reviewStatus
    ).toBe("due_soon");
  });

  it("classifies far-future dates as scheduled", () => {
    expect(classifyReviewStatus("2026-12-01", NOW).reviewStatus).toBe("scheduled");
  });
});

describe("buildReviewCycleSummary", () => {
  it("buckets and sorts systems by urgency", () => {
    const summary = buildReviewCycleSummary(
      [
        system({ id: "later", nextReviewDate: "2026-12-01" }),
        system({ id: "overdue-recent", nextReviewDate: "2026-06-05" }),
        system({ id: "overdue-old", nextReviewDate: "2026-01-15" }),
        system({ id: "soon", nextReviewDate: "2026-06-25" }),
        system({ id: "none" }),
      ],
      NOW
    );

    expect(summary.counts).toEqual({
      overdue: 2,
      dueSoon: 1,
      scheduled: 1,
      unscheduled: 1,
      total: 5,
    });
    // Most-overdue first.
    expect(summary.overdue.map((e) => e.id)).toEqual(["overdue-old", "overdue-recent"]);
    expect(summary.dueSoon[0].id).toBe("soon");
  });

  it("handles an empty registry", () => {
    const summary = buildReviewCycleSummary([], NOW);
    expect(summary.counts.total).toBe(0);
    expect(summary.overdue).toEqual([]);
  });
});

describe("reviewableFromRow", () => {
  it("maps DB rows to the reviewable shape", () => {
    expect(
      reviewableFromRow({
        id: "sys-9",
        name: "Hiring Screener",
        owner_name: null,
        next_review_date: "2026-07-01",
        risk_tier: "high",
      })
    ).toEqual({
      id: "sys-9",
      name: "Hiring Screener",
      ownerName: null,
      nextReviewDate: "2026-07-01",
      riskTier: "high",
    });
  });
});
