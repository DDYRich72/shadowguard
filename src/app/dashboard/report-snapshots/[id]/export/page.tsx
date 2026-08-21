import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClientExportPackDocument } from "@/components/governance/client-export-pack-document";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { recordAudit } from "@/lib/audit";
import { getSessionContext } from "@/lib/authz";
import { buildClientExportPack } from "@/lib/ai-governance/export-pack";
import type {
  GovernanceReportReviewStatus,
  GovernanceReportSnapshot,
} from "@/lib/ai-governance/types";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { isUuid } from "@/lib/validate";
import { PrintExportPackButton } from "./print-export-pack-button";

const reviewStatusClass: Record<GovernanceReportReviewStatus, string> = {
  not_submitted: "border-slate-200 bg-slate-100 text-slate-700",
  needs_review: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  changes_requested: "border-amber-200 bg-amber-50 text-amber-700",
};

function reviewStatusLabel(status: GovernanceReportReviewStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ClientExportPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSessionContext();
  const { id } = await params;

  if (!ctx) redirect(`/login?next=/dashboard/report-snapshots/${id}/export`);
  if (!isUuid(id)) notFound();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Unable to load this client export pack. Confirm the current initial schema is applied.
      </div>
    );
  }
  if (!data) notFound();

  const snapshot = data as GovernanceReportSnapshot;
  const exportPack = buildClientExportPack(snapshot);
  const reviewStatus =
    (snapshot.review_status ?? "not_submitted") as GovernanceReportReviewStatus;

  await recordAudit(ctx, {
    action: "client_export_pack.open",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Opened client export pack for ${snapshot.title}`,
    after: {
      report_type: snapshot.report_type,
      title: snapshot.title,
    },
  });

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/report-snapshots/${snapshot.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          Internal Snapshot
        </Link>
        <PrintExportPackButton />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-950">Internal review status</span>
          <Badge className={cn(reviewStatusClass[reviewStatus])}>
            {reviewStatusLabel(reviewStatus)}
          </Badge>
        </div>
        <p className="mt-1">
          This workflow marker is for internal review only and is not printed as a client-facing compliance claim.
        </p>
      </div>

      <ClientExportPackDocument exportPack={exportPack} snapshotId={snapshot.id} />
    </div>
  );
}
