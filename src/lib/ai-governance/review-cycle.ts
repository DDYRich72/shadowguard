/**
 * Recurring AI risk review cycle (approved roadmap item #4, in-app only).
 *
 * Uses the existing ai_systems.next_review_date field — no schema
 * changes. Pure functions; callers fetch the systems.
 */

export type ReviewStatus = "overdue" | "due_soon" | "scheduled" | "unscheduled";

/** Days ahead that count as "due soon". One month of runway. */
export const DUE_SOON_WINDOW_DAYS = 30;

export type ReviewableSystem = {
  id: string;
  name: string;
  ownerName: string | null;
  nextReviewDate: string | null; // YYYY-MM-DD or ISO
  riskTier: string;
};

export type ReviewCycleEntry = ReviewableSystem & {
  reviewStatus: ReviewStatus;
  /** Negative = overdue by N days; positive = due in N days; null = unscheduled. */
  daysUntilDue: number | null;
};

export type ReviewCycleSummary = {
  overdue: ReviewCycleEntry[];
  dueSoon: ReviewCycleEntry[];
  scheduled: ReviewCycleEntry[];
  unscheduled: ReviewCycleEntry[];
  counts: {
    overdue: number;
    dueSoon: number;
    scheduled: number;
    unscheduled: number;
    total: number;
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Whole days between `now` and the review date, comparing calendar days
 * in UTC so "due today" is 0, not a fraction.
 */
export function daysUntil(reviewDate: string, now: Date): number | null {
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(reviewDate) ? `${reviewDate}T00:00:00Z` : reviewDate
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((startOfUtcDay(parsed) - startOfUtcDay(now)) / MS_PER_DAY);
}

export function classifyReviewStatus(
  nextReviewDate: string | null | undefined,
  now: Date
): { reviewStatus: ReviewStatus; daysUntilDue: number | null } {
  if (!nextReviewDate) return { reviewStatus: "unscheduled", daysUntilDue: null };
  const days = daysUntil(nextReviewDate, now);
  if (days === null) return { reviewStatus: "unscheduled", daysUntilDue: null };
  if (days < 0) return { reviewStatus: "overdue", daysUntilDue: days };
  if (days <= DUE_SOON_WINDOW_DAYS) return { reviewStatus: "due_soon", daysUntilDue: days };
  return { reviewStatus: "scheduled", daysUntilDue: days };
}

export function buildReviewCycleSummary(
  systems: ReviewableSystem[],
  now: Date
): ReviewCycleSummary {
  const entries: ReviewCycleEntry[] = systems.map((system) => ({
    ...system,
    ...classifyReviewStatus(system.nextReviewDate, now),
  }));

  const byDueDate = (a: ReviewCycleEntry, b: ReviewCycleEntry) =>
    (a.daysUntilDue ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilDue ?? Number.MAX_SAFE_INTEGER);

  const overdue = entries.filter((e) => e.reviewStatus === "overdue").sort(byDueDate);
  const dueSoon = entries.filter((e) => e.reviewStatus === "due_soon").sort(byDueDate);
  const scheduled = entries.filter((e) => e.reviewStatus === "scheduled").sort(byDueDate);
  const unscheduled = entries.filter((e) => e.reviewStatus === "unscheduled");

  return {
    overdue,
    dueSoon,
    scheduled,
    unscheduled,
    counts: {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      scheduled: scheduled.length,
      unscheduled: unscheduled.length,
      total: entries.length,
    },
  };
}

/** Map an ai_systems DB/API row to the reviewable shape. */
export function reviewableFromRow(row: {
  id: string;
  name: string;
  owner_name: string | null;
  next_review_date: string | null;
  risk_tier: string;
}): ReviewableSystem {
  return {
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    nextReviewDate: row.next_review_date,
    riskTier: row.risk_tier,
  };
}
