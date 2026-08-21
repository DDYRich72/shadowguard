import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  MessageSquareWarning,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getSessionContext } from "@/lib/authz";
import { buildReportReviewQueue } from "@/lib/ai-governance/review-queue";
import { snapshotReportTypeLabels } from "@/lib/ai-governance/snapshots";
import type {
  GovernanceReportSnapshot,
  GovernanceReportSnapshotRemediation,
} from "@/lib/ai-governance/types";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function isMissingRemediationTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("governance_report_snapshot_remediations") ||
    message.includes("snapshot_id") ||
    message.includes("resolved_at")
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;

  return `${month}/${day}/${year}`;
}

const statusClass = {
  remediation_blocked: "border-orange-200 bg-orange-50 text-orange-700",
  needs_review: "border-blue-200 bg-blue-50 text-blue-700",
  changes_requested: "border-amber-200 bg-amber-50 text-amber-700",
  ready_to_finalize: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function ReportReviewQueuePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/report-review-queue");

  const supabase = await createServerSupabase();
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (snapshotError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Unable to load report snapshots. Apply the current initial schema, then refresh.
      </div>
    );
  }

  const { data: remediationData, error: remediationError } = await supabase
    .from("governance_report_snapshot_remediations")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  const remediationWarning = remediationError
    ? isMissingRemediationTable(remediationError)
      ? "Remediation storage is unavailable. The queue can show review status, but remediation counts require the current initial schema."
      : "Unable to load review remediation items. The queue can show review status, but remediation counts may be incomplete."
    : "";

  const snapshots = (snapshotData ?? []) as GovernanceReportSnapshot[];
  const remediations = remediationError
    ? []
    : ((remediationData ?? []) as GovernanceReportSnapshotRemediation[]);
  const queue = buildReportReviewQueue({
    snapshots,
    remediations,
    now: new Date(),
  });

  const summaryCards = [
    {
      label: "Needs Review",
      value: queue.summary.needsReview,
      icon: ClipboardCheck,
      tone: "text-blue-700 bg-blue-50",
    },
    {
      label: "Changes Requested",
      value: queue.summary.changesRequested,
      icon: MessageSquareWarning,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      label: "Open Remediation",
      value: queue.summary.openRemediations,
      icon: ListChecks,
      tone: "text-orange-700 bg-orange-50",
    },
    {
      label: "Overdue",
      value: queue.summary.overdueRemediations,
      icon: AlertTriangle,
      tone: "text-red-700 bg-red-50",
    },
    {
      label: "Ready To Finalize",
      value: queue.summary.readyToFinalize,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">Report Review Queue</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Internal work queue for saved governance reports that need review, changes,
            remediation, or finalization.
          </p>
        </div>
        <Link
          href="/dashboard/report-snapshots"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          Report Snapshots
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {remediationWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {remediationWarning}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", card.tone)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-950">{card.value}</p>
                <p className="text-sm text-slate-500">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Actionable Reports</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {queue.summary.actionableSnapshots} of {queue.summary.totalSnapshots} saved
                snapshots currently need internal action.
              </p>
            </div>
            {queue.summary.finalSnapshots > 0 && (
              <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                {queue.summary.finalSnapshots} Final
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {queue.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-sm font-medium text-slate-800">
                No report review work is waiting.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Submit a Draft snapshot for review or request changes to create queue items.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {queue.rows.map((row) => (
                <div
                  key={row.snapshotId}
                  className={cn(
                    "grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.7fr)_minmax(180px,0.7fr)_auto]",
                    row.overdueRemediationCount > 0
                      ? "bg-red-50/40"
                      : row.dueSoonRemediationCount > 0
                        ? "bg-amber-50/40"
                        : ""
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusClass[row.status]}>{row.statusLabel}</Badge>
                      <Badge variant="outline">
                        {snapshotReportTypeLabels[row.reportType]}
                      </Badge>
                    </div>
                    <h3 className="mt-3 truncate text-sm font-semibold text-slate-950">
                      {row.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved {formatDate(row.createdAt)}
                      {row.generatedByEmail ? ` by ${row.generatedByEmail}` : ""}
                    </p>
                    {row.clientName && (
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        Client: {row.clientName}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                      Review State
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {row.reviewStatus.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                      Remediation
                    </p>
                    {row.openRemediationCount > 0 ? (
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <p>
                          {row.openRemediationCount} open
                          {row.overdueRemediationCount > 0
                            ? `, ${row.overdueRemediationCount} overdue`
                            : row.dueSoonRemediationCount > 0
                              ? `, ${row.dueSoonRemediationCount} due soon`
                            : ""}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {row.overdueRemediationCount > 0 && (
                            <Badge className="border-red-200 bg-red-50 text-red-700">
                              Overdue
                            </Badge>
                          )}
                          {row.dueSoonRemediationCount > 0 && row.overdueRemediationCount === 0 && (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                              Due soon
                            </Badge>
                          )}
                        </div>
                        {row.nextDueDate && (
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            Due {formatDateOnly(row.nextDueDate)}
                          </p>
                        )}
                        {row.remediationOwners.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Owner: {row.remediationOwners.join(", ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No open items</p>
                    )}
                  </div>

                  <div className="flex items-center lg:justify-end">
                    <Link
                      href={`/dashboard/report-snapshots/${row.snapshotId}`}
                      className={cn(buttonVariants({ variant: "default" }), "gap-2")}
                    >
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
