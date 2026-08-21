"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildReviewCycleSummary,
  reviewableFromRow,
  type ReviewCycleEntry,
  type ReviewCycleSummary,
} from "@/lib/ai-governance/review-cycle";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; summary: ReviewCycleSummary };

/**
 * "AI risk reviews due" panel. Drives the recurring review ritual off
 * ai_systems.next_review_date. Hidden while the registry is empty.
 */
export function ReviewCycleCard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch("/api/ai-systems?status=active");
        if (!active) return;
        if (!response.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = await response.json();
        if (!active) return;
        const rows = Array.isArray(data.systems) ? data.systems : [];
        setState({
          kind: "ready",
          summary: buildReviewCycleSummary(rows.map(reviewableFromRow), new Date()),
        });
      } catch {
        if (active) setState({ kind: "error" });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Empty registry or load failure: stay out of the way. The dashboard
  // already guides registry setup; this card only matters once systems exist.
  if (state.kind === "loading" || state.kind === "error") return null;
  if (state.summary.counts.total === 0) return null;

  const { counts, overdue, dueSoon } = state.summary;
  const actionable = [...overdue, ...dueSoon].slice(0, 5);
  const allClear = counts.overdue === 0 && counts.dueSoon === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-[color:var(--brand)]" />
            <p className="sg-mono text-[color:var(--brand)]">Review cycle</p>
          </div>
          <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
            AI risk reviews due
          </h3>
        </div>
        <Button
          render={<Link href="/dashboard/ai-systems" />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="rounded-md"
        >
          AI Systems
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </header>

      {allClear ? (
        <div className="flex items-center gap-3 p-6 text-sm text-foreground/85">
          {counts.scheduled > 0 ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--approved)]" />
              No reviews due in the next 30 days. {counts.scheduled} scheduled,{" "}
              {counts.unscheduled} without a review date.
            </>
          ) : (
            <>
              <CalendarClock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>
                None of your {counts.total} AI system{counts.total !== 1 ? "s have" : " has"} a
                next review date. Set review dates to establish a defensible quarterly cadence.
              </span>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="sg-mono-sm text-muted-foreground">Overdue</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--risk)]/12 text-[color:var(--risk)]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </div>
              <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-[color:var(--risk)]">
                {counts.overdue}
              </p>
            </div>
            <div className="bg-card px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="sg-mono-sm text-muted-foreground">Due in 30 days</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--warning)]/15 text-[color:var(--warning-ink)]">
                  <CalendarClock className="h-4 w-4" />
                </span>
              </div>
              <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {counts.dueSoon}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border px-6 py-4">
            {actionable.map((entry) => (
              <ReviewLine key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewLine({ entry }: { entry: ReviewCycleEntry }) {
  const days = entry.daysUntilDue ?? 0;
  const dueText =
    entry.reviewStatus === "overdue"
      ? `overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`
      : days === 0
        ? "due today"
        : `due in ${days} day${days !== 1 ? "s" : ""}`;

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      {entry.reviewStatus === "overdue" ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[color:var(--risk)]" />
      ) : (
        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning-ink)]" />
      )}
      <Link
        href={`/dashboard/ai-systems/${entry.id}`}
        className="font-semibold text-foreground hover:underline"
      >
        {entry.name}
      </Link>
      <span>
        {dueText}
        {entry.ownerName ? ` · ${entry.ownerName}` : ""} · {entry.riskTier} risk
      </span>
    </p>
  );
}
