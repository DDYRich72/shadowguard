import { redirect } from "next/navigation";
import { CheckCircle2, CircleHelp, FileText, MinusCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildPortfolioGovernanceReport } from "@/lib/ai-governance/portfolio-report";
import {
  buildInsurancePacket,
  type InsuranceAnswerStatus,
} from "@/lib/ai-governance/insurance-packet";
import type {
  AIRiskAssessment,
  AISystem,
  AISystemControl,
} from "@/lib/ai-governance/types";
import { PrintInsurancePacketButton } from "./print-insurance-packet-button";

type QueryResult = { error?: { message?: string | null } | null };

const statusMeta: Record<
  InsuranceAnswerStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  yes: {
    label: "Yes",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: MinusCircle,
  },
  no: {
    label: "No",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  no_data: {
    label: "No data",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: CircleHelp,
  },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function assertQueryOk(label: string, result: QueryResult): void {
  if (result.error) {
    throw new Error(`Insurance packet data query failed: ${label}`);
  }
}

export default async function InsurancePacketPage() {
  // Auth-only, matching the governance-report page on this branch.
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/insurance-packet");

  const supabase = await createServerSupabase();
  const orgId = ctx.orgId;

  const [
    orgResult,
    systemsResult,
    policyResult,
    scansResult,
    aiToolResult,
    approvedResult,
    blockedResult,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("google_connected, microsoft_connected")
      .eq("id", orgId)
      .maybeSingle(),
    supabase
      .from("ai_systems")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active"),
    supabase
      .from("policy_documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("scan_history")
      .select("scanned_at", { count: "exact" })
      .eq("org_id", orgId)
      .order("scanned_at", { ascending: false })
      .limit(1),
    supabase
      .from("connected_apps")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_ai_tool", true),
    supabase
      .from("approved_tools")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("blocklist")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);
  assertQueryOk("organization", orgResult);
  assertQueryOk("ai systems", systemsResult);
  assertQueryOk("policy documents", policyResult);
  assertQueryOk("scan history", scansResult);
  assertQueryOk("connected AI tools", aiToolResult);
  assertQueryOk("approved tools", approvedResult);
  assertQueryOk("blocked tools", blockedResult);

  const systemRows = (systemsResult.data ?? []) as AISystem[];
  const systemIds = systemRows.map((s) => s.id);

  let assessmentRows: AIRiskAssessment[] = [];
  let controlRows: AISystemControl[] = [];
  if (systemIds.length > 0) {
    const [assessmentsResult, controlsResult] = await Promise.all([
      supabase
        .from("ai_risk_assessments")
        .select("*")
        .eq("org_id", orgId)
        .in("ai_system_id", systemIds),
      supabase
        .from("ai_system_controls")
        .select("*")
        .eq("org_id", orgId)
        .in("ai_system_id", systemIds),
    ]);
    assertQueryOk("risk assessments", assessmentsResult);
    assertQueryOk("controls", controlsResult);
    assessmentRows = (assessmentsResult.data ?? []) as AIRiskAssessment[];
    controlRows = (controlsResult.data ?? []) as AISystemControl[];
  }

  const generatedAt = new Date().toISOString();
  const report = buildPortfolioGovernanceReport({
    systems: systemRows,
    assessments: assessmentRows,
    controls: controlRows,
    generatedAt,
  });

  const packet = buildInsurancePacket({
    report,
    stats: {
      policyDocumentCount: policyResult.count ?? 0,
      scanCount: scansResult.count ?? 0,
      lastScannedAt: (scansResult.data?.[0]?.scanned_at as string | undefined) ?? null,
      aiToolsDetected: aiToolResult.count ?? 0,
      approvedToolsCount: approvedResult.count ?? 0,
      blockedToolsCount: blockedResult.count ?? 0,
      googleConnected: Boolean(orgResult.data?.google_connected),
      microsoftConnected: Boolean(orgResult.data?.microsoft_connected),
    },
    generatedAt,
  });

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cyber Insurance AI Risk Packet</h2>
          <p className="text-sm text-slate-500">
            Answers to the AI governance questions insurers ask, backed by your
            ShadowGuard records.
          </p>
        </div>
        <PrintInsurancePacketButton />
      </div>

      <article className="sg-print-document rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
              <FileText className="h-4 w-4" />
              ShadowGuard Cyber Insurance AI Risk Packet
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              AI Governance Posture for Underwriting
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              A point-in-time summary of AI inventory, discovery, policy, risk
              assessment, and evidence practices, mapped to the questions that
              commonly appear on cyber insurance applications and renewals.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated</p>
            <p className="mt-1 font-medium text-slate-800">{formatDate(packet.generatedAt)}</p>
            <p className="mt-3">Posture</p>
            <p className="mt-1 font-medium text-slate-800">{packet.summary.readinessLabel}</p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-4">
          <PacketMetric label="Answered Yes" value={packet.summary.yes} />
          <PacketMetric label="Partial" value={packet.summary.partial} />
          <PacketMetric label="No" value={packet.summary.no} />
          <PacketMetric label="No Data" value={packet.summary.noData} />
        </section>

        <section className="space-y-4">
          {packet.items.map((item, index) => {
            const meta = statusMeta[item.status];
            const Icon = meta.icon;
            return (
              <div
                key={item.key}
                className="sg-print-card sg-print-flow rounded-md border border-slate-200 p-5 print:break-inside-avoid"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-3xl text-sm font-semibold text-slate-900">
                    {index + 1}. {item.question}
                  </p>
                  <Badge className={meta.className}>
                    <Icon className="mr-1 h-3.5 w-3.5" />
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Evidence in ShadowGuard:</span>{" "}
                  {item.evidence.join(" · ")}
                </p>
              </div>
            );
          })}
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-5">
          <p className="text-xs leading-5 text-slate-500">{packet.disclaimer}</p>
        </footer>
      </article>
    </div>
  );
}

function PacketMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
