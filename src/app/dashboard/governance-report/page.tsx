import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  ListChecks,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildPortfolioGovernanceReport,
  riskTiers,
} from "@/lib/ai-governance/portfolio-report";
import type {
  AIRiskAssessment,
  AIFrameworkCoverageGroup,
  AIFrameworkCoverageItem,
  AIFrameworkMapping,
  AIGovernanceRiskTier,
  AISystem,
  AISystemControl,
  AISystemEvidence,
  AISystemControlStatus,
} from "@/lib/ai-governance/types";
import type { MCPTool } from "@/lib/mcp-governance/types";
import {
  frameworkMappingsForControl,
  groupFrameworkCoverage,
} from "@/lib/ai-governance/frameworks";
import { fetchLatestScanDeltaSection } from "@/lib/ai-governance/scan-delta.server";
import { PrintReportButton } from "./print-report-button";
import { SaveReportSnapshotButton } from "@/components/dashboard/save-report-snapshot-button";

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusClass: Record<AISystemControlStatus, string> = {
  not_started: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waived: "bg-violet-50 text-violet-700 border-violet-200",
};

const mcpApprovalClass: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  deprecated: "bg-slate-50 text-slate-500 border-slate-200",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function valueOrFallback(value: string | null | undefined, fallback = "Unassigned"): string {
  return value?.trim() || fallback;
}

function mappingsForControl(control: AISystemControl): AIFrameworkMapping[] {
  return control.framework_mappings?.length
    ? control.framework_mappings
    : frameworkMappingsForControl({
        key: control.control_key,
        category: control.category,
      });
}

function isMissingMcpTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("mcp_tools");
}

export default async function GovernancePortfolioReportPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/governance-report");

  const supabase = await createServerSupabase();
  const { data: systems, error: systemsError } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (systemsError) return <ReportLoadError />;

  const systemRows = (systems ?? []) as AISystem[];
  const systemIds = systemRows.map((system) => system.id);
  let assessmentRows: AIRiskAssessment[] = [];
  let controlRows: AISystemControl[] = [];
  let evidenceRows: AISystemEvidence[] = [];
  let mcpToolRows: MCPTool[] = [];

  if (systemIds.length > 0) {
    const { data: assessments, error: assessmentsError } = await supabase
      .from("ai_risk_assessments")
      .select("*")
      .eq("org_id", ctx.orgId)
      .in("ai_system_id", systemIds)
      .order("version", { ascending: false });

    if (assessmentsError) return <ReportLoadError />;
    assessmentRows = (assessments ?? []) as AIRiskAssessment[];

    const { data: controls, error: controlsError } = await supabase
      .from("ai_system_controls")
      .select("*")
      .eq("org_id", ctx.orgId)
      .in("ai_system_id", systemIds)
      .order("status", { ascending: false })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (controlsError) return <ReportLoadError />;
    controlRows = (controls ?? []) as AISystemControl[];

    const { data: evidence, error: evidenceError } = await supabase
      .from("ai_system_evidence")
      .select("*")
      .eq("org_id", ctx.orgId)
      .in("ai_system_id", systemIds)
      .order("updated_at", { ascending: false });

    if (evidenceError) return <ReportLoadError />;
    evidenceRows = (evidence ?? []) as AISystemEvidence[];
  }

  const { data: mcpTools, error: mcpToolsError } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("org_id", ctx.orgId)
    .neq("status", "archived")
    .order("risk_score", { ascending: false });

  if (mcpToolsError) {
    if (!isMissingMcpTable(mcpToolsError)) return <ReportLoadError />;
  } else {
    mcpToolRows = (mcpTools ?? []) as MCPTool[];
  }

  const scanDelta = await fetchLatestScanDeltaSection(supabase, ctx.orgId);

  const report = buildPortfolioGovernanceReport({
    systems: systemRows,
    assessments: assessmentRows,
    controls: controlRows,
    evidenceRecords: evidenceRows,
    mcpTools: mcpToolRows,
    scanDelta: scanDelta ?? undefined,
    generatedAt: new Date().toISOString(),
  });
  const mcpToolsNeedingReview = Array.from(
    new Map(
      [
        ...report.mcpPosture.highRiskTools,
        ...report.mcpPosture.blockedTools,
        ...report.mcpPosture.pendingReviewTools,
        ...report.mcpPosture.unlinkedTools,
      ].map((tool) => [tool.id, tool])
    ).values()
  ).slice(0, 8);

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Governance Report</h2>
          <p className="text-sm text-slate-500">
            Organization-wide AI inventory, risk, controls, evidence, and next actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/dashboard/assessment-kit" />}
            nativeButton={false}
            variant="outline"
            className="gap-2"
          >
            Assessment Kit
            <ArrowRight className="h-4 w-4" />
          </Button>
          <SaveReportSnapshotButton
            reportType="organization_governance"
            title="AI Governance Portfolio Report"
          />
          <PrintReportButton />
        </div>
      </div>

      <article className="sg-print-document rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              ShadowGuard Organization Governance Report
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">AI Governance Portfolio</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Live snapshot of active AI systems, latest assessments, control readiness, evidence gaps, and recommended governance actions.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated</p>
            <p className="mt-1 font-medium text-slate-800">{formatDate(report.generatedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2 xl:grid-cols-7">
          <ReportMetric label="AI Systems" value={String(report.totals.totalSystems)} detail="Active records" />
          <ReportMetric label="Assessed" value={String(report.totals.assessedSystems)} detail={`${report.totals.unassessedSystems} missing`} />
          <ReportMetric label="Readiness" value={`${report.totals.readinessPercent}%`} detail={`${report.totals.totalControls} controls`} />
          <ReportMetric label="High Risk" value={String(report.totals.highRiskSystems)} detail="High or critical" />
          <ReportMetric label="Open Required" value={String(report.totals.openRequiredControls)} detail="Controls" />
          <ReportMetric label="Evidence Gaps" value={String(report.totals.evidenceGaps)} detail="Closed without proof" />
          <ReportMetric label="MCP Tools" value={String(report.mcpPosture.totalTools)} detail={`${report.mcpPosture.highRiskTools.length} high risk`} />
        </section>

        <Separator className="my-1" />

        <ReportSection
          icon={ShieldAlert}
          title="Risk Posture"
          description="Active AI systems grouped by current risk tier."
        >
          {report.totals.totalSystems === 0 ? (
            <EmptyState text="No active AI systems yet. Add AI systems or use the inventory template before running this report." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              {riskTiers.map((tier) => (
                <div key={tier} className="rounded-md border border-slate-200 px-4 py-3">
                  <Badge className={riskClass[tier]}>{humanize(tier)}</Badge>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {report.riskPosture[tier]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">systems</p>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {report.scanDelta && (
          <ReportSection
            icon={Radar}
            title="Changes Since Previous Scan"
            description={`Workspace discovery changes between ${formatDate(report.scanDelta.fromScannedAt)} and ${formatDate(report.scanDelta.toScannedAt)}.`}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-slate-200 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">New AI tools</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {report.scanDelta.summary.newAiTools}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Risk increased</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {report.scanDelta.summary.riskIncreased}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scope expansions</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {report.scanDelta.summary.scopeExpansions}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Net user change</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {report.scanDelta.summary.netUserChange > 0 ? "+" : ""}
                  {report.scanDelta.summary.netUserChange}
                </p>
              </div>
            </div>
            {(report.scanDelta.newApps.length > 0 ||
              report.scanDelta.riskIncreases.length > 0 ||
              report.scanDelta.scopeAdditions.length > 0) && (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {report.scanDelta.newApps.map((a) => (
                  <li key={`new-${a.appName}`}>
                    <span className="font-medium text-slate-900">{a.appName}</span>{" "}
                    newly detected{a.isAiTool ? " (AI tool)" : ""} · {a.riskLevel} risk ·{" "}
                    {a.userCount} user{a.userCount !== 1 ? "s" : ""}
                  </li>
                ))}
                {report.scanDelta.riskIncreases.map((r) => (
                  <li key={`risk-${r.appName}`}>
                    <span className="font-medium text-slate-900">{r.appName}</span> risk score{" "}
                    {r.previousScore} → {r.currentScore}
                  </li>
                ))}
                {report.scanDelta.scopeAdditions.map((s) => (
                  <li key={`scope-${s.appName}`}>
                    <span className="font-medium text-slate-900">{s.appName}</span> gained{" "}
                    {s.addedScopes.length} permission scope{s.addedScopes.length !== 1 ? "s" : ""}
                  </li>
                ))}
              </ul>
            )}
          </ReportSection>
        )}

        <ReportSection
          icon={ListChecks}
          title="Readiness Summary"
          description="Control completion across all active AI systems."
        >
          <div className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${report.totals.readinessPercent}%` }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniMetric label="Total Controls" value={report.totals.totalControls} />
              <MiniMetric label="Open Controls" value={report.totals.openControls} />
              <MiniMetric label="Open Required" value={report.totals.openRequiredControls} />
              <MiniMetric label="Evidence Gaps" value={report.totals.evidenceGaps} />
            </div>
          </div>
        </ReportSection>

        <ReportSection
          icon={ShieldCheck}
          title="Framework Coverage"
          description="Readiness crosswalks and evidence alignment only. This is not certification, legal advice, or a compliance determination."
        >
          <FrameworkCoverageGrid coverage={report.frameworkCoverage} />
        </ReportSection>

        <ReportSection
          icon={Network}
          title="MCPGuard Posture"
          description="MCP tools that need ownership, approval, or linkage before their activity can be treated as governed evidence."
        >
          {report.mcpPosture.totalTools === 0 ? (
            <EmptyState text="No MCP tools are registered in the current portfolio." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-5">
                <MiniMetric label="MCP Tools" value={report.mcpPosture.totalTools} />
                <MiniMetric label="High Risk" value={report.mcpPosture.highRiskTools.length} />
                <MiniMetric label="Pending Review" value={report.mcpPosture.pendingReviewTools.length} />
                <MiniMetric label="Blocked" value={report.mcpPosture.blockedTools.length} />
                <MiniMetric label="Unlinked" value={report.mcpPosture.unlinkedTools.length} />
              </div>
              <MCPToolPostureList tools={mcpToolsNeedingReview} />
            </div>
          )}
        </ReportSection>

        <ReportSection
          icon={ShieldCheck}
          title="Systems Needing Attention"
          description="High-risk systems and systems without completed assessments."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <SystemGroup
              title="High Or Critical Risk"
              systems={report.highRiskSystems}
              emptyText="No high or critical risk systems in the active portfolio."
            />
            <SystemGroup
              title="Missing Assessment"
              systems={report.unassessedSystems}
              emptyText="Every active AI system has a completed assessment."
            />
          </div>
        </ReportSection>

        <ReportSection
          icon={ClipboardCheck}
          title="Open Required Controls"
          description="Required safeguards that are not completed or waived."
        >
          <IssueList
            items={report.openRequiredControls}
            emptyText="No open required controls."
          />
        </ReportSection>

        <ReportSection
          icon={FileText}
          title="Evidence Gaps"
          description="Closed controls that still need evidence metadata."
        >
          <IssueList
            items={report.evidenceGaps}
            emptyText="No evidence gaps on closed controls."
          />
        </ReportSection>

        <ReportSection
          icon={ShieldCheck}
          title="Recommended Next Actions"
          description="Deterministic portfolio-level follow-up."
        >
          <ol className="space-y-3">
            {report.nextActions.map((action) => (
              <li
                key={action}
                className="rounded-md border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 print:break-inside-avoid"
              >
                {action}
              </li>
            ))}
          </ol>
        </ReportSection>
      </article>
    </div>
  );
}

function ReportLoadError() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Unable to load the organization governance report. Refresh after confirming the governance schema is applied.
    </div>
  );
}

function ReportMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReportSection({
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function SystemGroup({
  title,
  systems,
  emptyText,
}: {
  title: string;
  systems: Array<{
    system: AISystem;
    riskTier: AIGovernanceRiskTier;
    readiness: { readinessPercent: number };
    openRequiredControls: AISystemControl[];
    evidenceGaps: AISystemControl[];
  }>;
  emptyText: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {systems.length === 0 ? (
        <div className="mt-3 rounded-md border border-slate-200 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {systems.map((item) => (
            <div key={item.system.id} className="rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/dashboard/ai-systems/${item.system.id}`}
                    className="text-sm font-semibold text-slate-950 underline"
                  >
                    {item.system.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {valueOrFallback(item.system.department, "No department")} - {valueOrFallback(item.system.owner_name)}
                  </p>
                </div>
                <Badge className={riskClass[item.riskTier]}>{humanize(item.riskTier)}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.system.use_case}</p>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <span>{item.readiness.readinessPercent}% ready</span>
                <span>{item.openRequiredControls.length} open required</span>
                <span>{item.evidenceGaps.length} evidence gaps</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueList({
  items,
  emptyText,
}: {
  items: Array<{ system: AISystem; control: AISystemControl }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="space-y-3">
      {items.map(({ system, control }) => (
        <div key={`${system.id}-${control.id}`} className="rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-950">{control.title}</p>
              <Link
                href={`/dashboard/ai-systems/${system.id}`}
                className="mt-1 block text-xs text-slate-500 underline"
              >
                {system.name}
              </Link>
            </div>
            <Badge className={statusClass[control.status]}>{humanize(control.status)}</Badge>
          </div>
          {control.reason && (
            <p className="mt-3 text-sm leading-6 text-slate-600">{control.reason}</p>
          )}
          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <span>Priority: {humanize(control.priority)}</span>
            <span>Owner: {valueOrFallback(control.owner)}</span>
            <span>Category: {control.category}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mappingsForControl(control).map((mapping) => (
              <Badge
                key={`${mapping.framework}-${mapping.code}-${mapping.category}`}
                className="border-slate-200 bg-slate-50 text-slate-700"
              >
                {mapping.framework_label} {mapping.code}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MCPToolPostureList({ tools }: { tools: MCPTool[] }) {
  if (tools.length === 0) {
    return <EmptyState text="No high-risk, blocked, pending-review, or unlinked MCP tools." />;
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div key={tool.id} className="rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href="/dashboard/mcp-guard/tools"
                className="text-sm font-semibold text-slate-950 underline"
              >
                {tool.name}
              </Link>
              <p className="mt-1 text-xs text-slate-500">
                {valueOrFallback(tool.owner_name)} - {tool.ai_system_id ? "Linked AI System" : "Unlinked"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge className={riskClass[tool.risk_tier]}>
                {humanize(tool.risk_tier)} {tool.risk_score}
              </Badge>
              <Badge className={mcpApprovalClass[tool.approval_status] ?? mcpApprovalClass.pending_review}>
                {humanize(tool.approval_status)}
              </Badge>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <span>Sensitivity: {humanize(tool.data_sensitivity)}</span>
            <span>{tool.write_access ? "Write access" : "Read only"}</span>
            <span>{tool.credential_access ? "Credential access" : "No credential access"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FrameworkCoverageGrid({ coverage }: { coverage: AIFrameworkCoverageItem[] }) {
  if (coverage.length === 0) {
    return <EmptyState text="No framework mapping metadata was captured for this portfolio." />;
  }

  const groups = groupFrameworkCoverage(coverage);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <FrameworkCoverageGroup key={group.id} group={group} />
      ))}
    </div>
  );
}

function FrameworkCoverageGroup({ group }: { group: AIFrameworkCoverageGroup }) {
  return (
    <div className="sg-print-flow">
      <h4 className="text-sm font-semibold text-slate-900">{group.label}</h4>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.items.map((item) => (
          <div
            key={`${item.framework}-${item.code}-${item.category}`}
            className="rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {item.framework_label} {item.code}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.title}</p>
              </div>
              <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                {item.category}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
              <span>{item.closedControls}/{item.totalControls} closed</span>
              <span>{item.openControls} open</span>
              <span>{item.readinessPercent}% ready</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
