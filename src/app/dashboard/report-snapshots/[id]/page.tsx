import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileJson,
  FileText,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";
import {
  humanizeSnapshotMetric,
  riskTierFromSnapshotMetric,
  snapshotReportTypeLabels,
} from "@/lib/ai-governance/snapshots";
import {
  isRemediationDueSoon,
  isRemediationOverdue,
} from "@/lib/ai-governance/review-queue";
import type {
  AIGovernanceRiskTier,
  GovernanceReportDeliveryLink,
  GovernanceReportReviewStatus,
  GovernanceReportSnapshot,
  GovernanceReportSnapshotRemediation,
  GovernanceReportSnapshotType,
} from "@/lib/ai-governance/types";
import { cn } from "@/lib/utils";
import { PrintSnapshotButton } from "./print-snapshot-button";
import { SnapshotDeliveryPanel } from "./snapshot-delivery-panel";
import { SnapshotRemediationPanel } from "./snapshot-remediation-panel";

type JsonObject = Record<string, unknown>;

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isMissingDeliveryLinksTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("governance_report_delivery_links") ||
    message.includes("url_token") ||
    message.includes("public_url")
  );
}

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

function isOpenRemediation(item: GovernanceReportSnapshotRemediation): boolean {
  return item.status === "open" || item.status === "in_progress";
}

function metricEntries(metrics: Record<string, unknown>) {
  return Object.entries(metrics).filter(([, value]) =>
    typeof value === "string" || typeof value === "number"
  );
}

export default async function ReportSnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSessionContext();
  const { id } = await params;

  if (!ctx) redirect(`/login?next=/dashboard/report-snapshots/${id}`);
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
        Unable to load this report snapshot. Confirm the initial ShadowGuard schema is applied and current.
      </div>
    );
  }
  if (!data) notFound();

  const snapshot = data as GovernanceReportSnapshot;
  const reportType = snapshot.report_type as GovernanceReportSnapshotType;
  const deliveryStatus = snapshot.delivery_status ?? "draft";
  const reviewStatus =
    (snapshot.review_status ?? "not_submitted") as GovernanceReportReviewStatus;
  const { data: deliveryLinkData, error: deliveryLinkError } = await supabase
    .from("governance_report_delivery_links")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  let deliveryLinksError = "";
  if (deliveryLinkError) {
    deliveryLinksError = isMissingDeliveryLinksTable(deliveryLinkError)
      ? "Delivery link storage is unavailable. Apply the current initial schema, then refresh."
      : "Unable to load client delivery links.";
  }
  const { data: remediationData, error: remediationError } = await supabase
    .from("governance_report_snapshot_remediations")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .eq("org_id", ctx.orgId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  let remediationsError = "";
  if (remediationError) {
    remediationsError = isMissingRemediationTable(remediationError)
      ? "Remediation storage is unavailable. Apply the current initial schema, then refresh."
      : "Unable to load review remediation items.";
  }
  const remediations = (remediationData ?? []) as GovernanceReportSnapshotRemediation[];
  const openRemediationCount = remediations.filter(isOpenRemediation).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueRemediationCount = remediations.filter((item) =>
    isRemediationOverdue(item, today)
  ).length;
  const dueSoonRemediationCount = remediations.filter((item) =>
    isRemediationDueSoon(item, today)
  ).length;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/report-snapshots"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          Report Snapshots
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/report-snapshots/${snapshot.id}/export`}
            prefetch={false}
            className={cn(buttonVariants({ variant: "default" }), "gap-2")}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            Client Export Pack
          </Link>
          <PrintSnapshotButton />
        </div>
      </div>

      <SnapshotWorkflowBanners
        deliveryStatus={deliveryStatus}
        reviewStatus={reviewStatus}
        openRemediationCount={openRemediationCount}
        overdueRemediationCount={overdueRemediationCount}
        dueSoonRemediationCount={dueSoonRemediationCount}
      />

      <SnapshotDeliveryPanel
        snapshotId={snapshot.id}
        clientName={snapshot.client_name ?? ""}
        preparedByNote={snapshot.prepared_by_note ?? ""}
        executiveSummaryNote={snapshot.executive_summary_note ?? ""}
        deliveryStatus={deliveryStatus}
        finalizedAt={snapshot.finalized_at}
        reviewStatus={reviewStatus}
        reviewerName={snapshot.reviewer_name ?? ""}
        reviewerEmail={snapshot.reviewer_email ?? ""}
        reviewNote={snapshot.review_note ?? ""}
        reviewedAt={snapshot.reviewed_at}
        reviewedBy={snapshot.reviewed_by}
        pdfGeneratedAt={snapshot.pdf_generated_at}
        pdfFilename={snapshot.pdf_filename}
        pdfSizeBytes={snapshot.pdf_size_bytes}
        deliveryLinks={(deliveryLinkData ?? []) as GovernanceReportDeliveryLink[]}
        deliveryLinksError={deliveryLinksError}
        openRemediationCount={openRemediationCount}
        renderedAt={new Date().toISOString()}
        canMutate={hasRole(ctx.role, ["admin", "manager"])}
      />

      <SnapshotRemediationPanel
        snapshotId={snapshot.id}
        remediations={remediations}
        remediationsError={remediationsError}
        isFinal={deliveryStatus === "final"}
        canMutate={hasRole(ctx.role, ["admin", "manager"])}
      />

      <article className="sg-print-document rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
              <Archive className="h-4 w-4" />
              Saved ShadowGuard Report Snapshot
              <Badge
                className={
                  deliveryStatus === "final"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }
              >
                {deliveryStatus === "final" ? "Final" : "Draft"}
              </Badge>
              <Badge
                className={
                  reviewStatus === "approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : reviewStatus === "needs_review"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : reviewStatus === "changes_requested"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-100 text-slate-700"
                }
              >
                {humanize(reviewStatus)}
              </Badge>
            </div>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">{snapshot.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {snapshotReportTypeLabels[reportType]} - saved {formatDate(snapshot.created_at)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated by</p>
            <p className="mt-1 font-medium text-slate-800">
              {snapshot.generated_by_email || "Unknown"}
            </p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2 xl:grid-cols-6">
          {metricEntries(snapshot.summary_metrics).slice(0, 6).map(([key, value]) => (
            <SnapshotMetric key={key} label={humanizeSnapshotMetric(key)} value={value} />
          ))}
        </section>

        <Separator className="my-1" />

        {reportType === "ai_system_readiness" ? (
          <ReadinessSnapshot snapshot={snapshot.snapshot} />
        ) : (
          <PortfolioSnapshot snapshot={snapshot.snapshot} />
        )}

        <SnapshotSection
          icon={FileJson}
          title="Full Snapshot JSON"
          description="Frozen report payload stored when the snapshot was saved."
        >
          <pre className="max-h-[720px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100 print:max-h-none print:whitespace-pre-wrap">
            {JSON.stringify(snapshot.snapshot, null, 2)}
          </pre>
        </SnapshotSection>
      </article>
    </div>
  );
}

function SnapshotWorkflowBanners({
  deliveryStatus,
  reviewStatus,
  openRemediationCount,
  overdueRemediationCount,
  dueSoonRemediationCount,
}: {
  deliveryStatus: string;
  reviewStatus: GovernanceReportReviewStatus;
  openRemediationCount: number;
  overdueRemediationCount: number;
  dueSoonRemediationCount: number;
}) {
  if (deliveryStatus === "final") return null;

  const banners: Array<{
    key: string;
    icon: typeof AlertTriangle;
    title: string;
    message: string;
    className: string;
  }> = [];

  if (overdueRemediationCount > 0) {
    banners.push({
      key: "overdue",
      icon: AlertTriangle,
      title: "Overdue remediation",
      message: `${overdueRemediationCount} open remediation ${overdueRemediationCount === 1 ? "item is" : "items are"} past due.`,
      className: "border-red-200 bg-red-50 text-red-800",
    });
  }

  if (dueSoonRemediationCount > 0) {
    banners.push({
      key: "due-soon",
      icon: Clock3,
      title: "Remediation due soon",
      message: `${dueSoonRemediationCount} open remediation ${dueSoonRemediationCount === 1 ? "item is" : "items are"} due within 7 days.`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    });
  }

  if (reviewStatus === "needs_review") {
    banners.push({
      key: "needs-review",
      icon: ShieldAlert,
      title: "Review needed",
      message: "This snapshot has been submitted and is waiting for internal review.",
      className: "border-blue-200 bg-blue-50 text-blue-800",
    });
  }

  if (reviewStatus === "changes_requested") {
    banners.push({
      key: "changes-requested",
      icon: ShieldAlert,
      title: "Changes requested",
      message: "This snapshot needs changes before it can be approved.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    });
  }

  if (reviewStatus === "approved" && openRemediationCount === 0) {
    banners.push({
      key: "ready-final",
      icon: CheckCircle2,
      title: "Ready to finalize",
      message: "This snapshot is approved and has no open remediation blockers.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-3 print:hidden">
      {banners.map((banner) => (
        <div
          key={banner.key}
          className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", banner.className)}
        >
          <banner.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-1">{banner.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: unknown }) {
  const riskTier = riskTierFromSnapshotMetric(value);
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      {riskTier ? (
        <Badge className={`mt-2 ${riskClass[riskTier]}`}>{humanize(riskTier)}</Badge>
      ) : (
        <p className="mt-2 text-2xl font-semibold text-slate-950">{String(value)}</p>
      )}
    </div>
  );
}

function SnapshotSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="sg-report-section border-b border-slate-200 py-8 last:border-b-0">
      <div className="sg-report-section-heading mb-5 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ReadinessSnapshot({ snapshot }: { snapshot: unknown }) {
  const report = asObject(snapshot);
  const system = asObject(report.system);
  const readiness = asObject(report.readiness);
  const evidence = asObject(report.evidence);
  const nextActions = asArray(report.nextActions);
  const openControls = asArray(report.openControls);
  const closedControls = asArray(report.closedControls);

  return (
    <>
      <SnapshotSection icon={FileText} title="Frozen System Overview" description="System facts stored in this snapshot.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="System" value={String(system.name ?? "Unknown")} />
          <Field label="Use Case" value={String(system.use_case ?? "Not provided")} />
          <Field label="Owner" value={String(system.owner_name ?? "Unassigned")} />
          <Field label="Vendor" value={String(system.vendor_name ?? "Not provided")} />
          <Field label="Readiness" value={`${String(readiness.readinessPercent ?? 0)}%`} />
          <Field label="Evidence Gaps" value={String(asArray(evidence.evidenceGaps).length)} />
        </div>
      </SnapshotSection>
      <SnapshotSection icon={ListChecks} title="Frozen Controls" description="Control counts from the saved report.">
        <div className="grid gap-4 md:grid-cols-2">
          <ListBlock title="Open Controls" items={openControls} />
          <ListBlock title="Completed Or Waived Controls" items={closedControls} />
        </div>
      </SnapshotSection>
      <SnapshotSection icon={ShieldAlert} title="Frozen Next Actions" description="Recommended actions stored with the snapshot.">
        <OrderedTextList items={nextActions} />
      </SnapshotSection>
    </>
  );
}

function PortfolioSnapshot({ snapshot }: { snapshot: unknown }) {
  const report = asObject(snapshot);
  const totals = asObject(report.totals);
  const nextActions = asArray(report.nextActions);
  const highRiskSystems = asArray(report.highRiskSystems);
  const unassessedSystems = asArray(report.unassessedSystems);
  const openRequiredControls = asArray(report.openRequiredControls);
  const evidenceGaps = asArray(report.evidenceGaps);

  return (
    <>
      <SnapshotSection icon={FileText} title="Frozen Portfolio Summary" description="Organization-wide metrics stored in this snapshot.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="AI Systems" value={String(totals.totalSystems ?? 0)} />
          <Field label="Assessed" value={String(totals.assessedSystems ?? 0)} />
          <Field label="Readiness" value={`${String(totals.readinessPercent ?? 0)}%`} />
          <Field label="High Risk" value={String(totals.highRiskSystems ?? 0)} />
          <Field label="Open Required" value={String(totals.openRequiredControls ?? 0)} />
          <Field label="Evidence Gaps" value={String(totals.evidenceGaps ?? 0)} />
        </div>
      </SnapshotSection>
      <SnapshotSection icon={ListChecks} title="Frozen Attention Lists" description="Systems and controls needing action when saved.">
        <div className="grid gap-4 md:grid-cols-2">
          <ListBlock title="High Risk Systems" items={highRiskSystems} />
          <ListBlock title="Missing Assessments" items={unassessedSystems} />
          <ListBlock title="Open Required Controls" items={openRequiredControls} />
          <ListBlock title="Evidence Gaps" items={evidenceGaps} />
        </div>
      </SnapshotSection>
      <SnapshotSection icon={ShieldAlert} title="Frozen Next Actions" description="Recommended actions stored with the snapshot.">
        <OrderedTextList items={nextActions} />
      </SnapshotSection>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 8).map((item, index) => (
            <li key={index} className="text-sm leading-6 text-slate-700">
              {summarizeItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderedTextList({ items }: { items: unknown[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No next actions stored.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="rounded-md border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
          {String(item)}
        </li>
      ))}
    </ol>
  );
}

function summarizeItem(item: unknown): string {
  const object = asObject(item);
  const system = asObject(object.system);
  const control = asObject(object.control);
  if (control.title || system.name) {
    return `${String(control.title ?? "Control")} - ${String(system.name ?? "System")}`;
  }
  if (system.name) return String(system.name);
  if (object.title) return String(object.title);
  if (object.name) return String(object.name);
  return JSON.stringify(item);
}
