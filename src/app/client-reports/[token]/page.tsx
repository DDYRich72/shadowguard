import { headers } from "next/headers";
import { AlertTriangle } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { ClientExportPackDocument } from "@/components/governance/client-export-pack-document";
import { PrintClientExportPackButton } from "@/components/governance/print-client-export-pack-button";
import { recordSystemAudit } from "@/lib/audit";
import { buildClientExportPack } from "@/lib/ai-governance/export-pack";
import { canOpenDeliveryLink } from "@/lib/ai-governance/delivery-links";
import type {
  GovernanceReportDeliveryLink,
  GovernanceReportSnapshot,
} from "@/lib/ai-governance/types";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function ipFromHeaders(headerStore: Headers): string {
  const cf = headerStore.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

function UnavailableReport() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
          <AlertTriangle className="h-6 w-6 text-slate-700" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">Report link unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This ShadowGuard client report link may have expired, been revoked, or is no
          longer available. Please ask the report owner for a fresh delivery link.
        </p>
      </section>
    </main>
  );
}

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminSupabase();

  const { data: linkData, error: linkError } = await admin
    .from("governance_report_delivery_links")
    .select("*")
    .eq("url_token", token)
    .maybeSingle();

  if (linkError || !linkData) return <UnavailableReport />;

  const link = linkData as GovernanceReportDeliveryLink;
  if (!canOpenDeliveryLink(link)) return <UnavailableReport />;

  const { data: snapshotData, error: snapshotError } = await admin
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", link.snapshot_id)
    .eq("org_id", link.org_id)
    .maybeSingle();

  if (snapshotError || !snapshotData) return <UnavailableReport />;

  const snapshot = snapshotData as GovernanceReportSnapshot;
  if (snapshot.delivery_status !== "final") return <UnavailableReport />;

  const openedAt = new Date().toISOString();
  const headerStore = await headers();
  const ip = ipFromHeaders(headerStore);
  const userAgent = headerStore.get("user-agent");

  await admin
    .from("governance_report_delivery_links")
    .update({
      last_opened_at: openedAt,
      open_count: (link.open_count ?? 0) + 1,
    })
    .eq("id", link.id);

  await recordSystemAudit(link.org_id, {
    action: "governance_report_delivery_link.open",
    target_type: "governance_report_delivery_link",
    target_id: link.id,
    summary: `Opened client delivery link for ${snapshot.title}`,
    after: {
      snapshot_id: snapshot.id,
      report_type: snapshot.report_type,
      public_url: link.public_url,
      opened_at: openedAt,
    },
    ip,
    user_agent: userAgent,
  });

  const exportPack = buildClientExportPack(snapshot);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-0">
        <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
            <BrandMark className="h-9 w-9" />
            ShadowGuard Client Report
          </div>
          <PrintClientExportPackButton />
        </header>

        <ClientExportPackDocument exportPack={exportPack} snapshotId={snapshot.id} />
      </div>
    </main>
  );
}
