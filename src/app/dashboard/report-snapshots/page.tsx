import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  humanizeSnapshotMetric,
  snapshotReportTypeLabels,
} from "@/lib/ai-governance/snapshots";
import type {
  GovernanceReportDeliveryStatus,
  GovernanceReportSnapshot,
  GovernanceReportSnapshotType,
} from "@/lib/ai-governance/types";
import { cn } from "@/lib/utils";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metricEntries(metrics: Record<string, unknown>) {
  return Object.entries(metrics).filter(([, value]) =>
    typeof value === "string" || typeof value === "number"
  );
}

const statusClass: Record<GovernanceReportDeliveryStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function ReportSnapshotsPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/report-snapshots");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Unable to load report snapshots. Apply the current initial schema, then refresh.
      </div>
    );
  }

  const snapshots = (data ?? []) as GovernanceReportSnapshot[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">Report Snapshots</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Frozen AI governance reports saved as point-in-time deliverables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/governance-report"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            Live Governance Report
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No saved reports yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Save a snapshot from a readiness report or the organization governance report.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshots.map((snapshot) => (
            <Card key={snapshot.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">{snapshot.title}</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved {formatDate(snapshot.created_at)} by{" "}
                      {snapshot.generated_by_email || "Unknown"}
                    </p>
                    {snapshot.client_name && (
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        Prepared for {snapshot.client_name}
                      </p>
                    )}
                    {snapshot.pdf_generated_at && (
                      <p className="mt-1 text-xs text-slate-500">
                        PDF generated {formatDate(snapshot.pdf_generated_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="outline">
                      {snapshotReportTypeLabels[snapshot.report_type as GovernanceReportSnapshotType]}
                    </Badge>
                    <Badge className={statusClass[snapshot.delivery_status ?? "draft"]}>
                      {(snapshot.delivery_status ?? "draft") === "final" ? "Final" : "Draft"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {metricEntries(snapshot.summary_metrics).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500">{humanizeSnapshotMetric(key)}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/dashboard/report-snapshots/${snapshot.id}`}
                  className={cn(buttonVariants({ variant: "default" }), "w-full gap-2")}
                >
                  Open Snapshot
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
