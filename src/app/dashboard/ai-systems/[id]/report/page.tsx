import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  FileText,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";
import {
  buildGovernanceReadinessReport,
  hasControlEvidence,
} from "@/lib/ai-governance/report";
import type {
  AIRiskAssessment,
  AIFrameworkCoverageGroup,
  AIGovernanceRiskTier,
  AIFrameworkCoverageItem,
  AIFrameworkMapping,
  AISystem,
  AISystemApprovalStatus,
  AISystemControl,
  AISystemControlStatus,
  AIEvidenceStatus,
} from "@/lib/ai-governance/types";
import type { ControlEvidenceGroup } from "@/lib/ai-governance/evidence";
import {
  frameworkMappingsForControl,
  groupFrameworkCoverage,
} from "@/lib/ai-governance/frameworks";
import { PrintReportButton } from "./print-report-button";
import { SaveReportSnapshotButton } from "@/components/dashboard/save-report-snapshot-button";

const riskClass: Record<AIGovernanceRiskTier, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const approvalClass: Record<AISystemApprovalStatus, string> = {
  discovered: "bg-slate-50 text-slate-700 border-slate-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  retired: "bg-slate-50 text-slate-500 border-slate-200",
};

const statusClass: Record<AISystemControlStatus, string> = {
  not_started: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waived: "bg-violet-50 text-violet-700 border-violet-200",
};

const evidenceStatusClass: Record<AIEvidenceStatus, string> = {
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_review: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-red-50 text-red-700 border-red-200",
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

function formatShortDate(value: string | null): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function valueOrFallback(value: string | null | undefined, fallback = "Not provided"): string {
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

export default async function GovernanceReadinessReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSessionContext();
  const { id } = await params;

  if (!ctx) redirect(`/login?next=/dashboard/ai-systems/${id}/report`);
  if (!isUuid(id)) notFound();

  const supabase = await createServerSupabase();
  const { data: system, error: systemError } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (systemError) return <ReportLoadError />;
  if (!system) notFound();

  const { data: latestAssessment, error: assessmentError } = await supabase
    .from("ai_risk_assessments")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: controls, error: controlsError } = await supabase
    .from("ai_system_controls")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("status", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (assessmentError || controlsError) return <ReportLoadError />;

  const { data: evidence, error: evidenceError } = await supabase
    .from("ai_system_evidence")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (evidenceError) return <ReportLoadError />;

  const report = buildGovernanceReadinessReport({
    system: system as AISystem,
    latestAssessment: (latestAssessment as AIRiskAssessment | null) ?? null,
    controls: (controls ?? []) as AISystemControl[],
    evidenceRecords: evidence ?? [],
    generatedAt: new Date().toISOString(),
  });

  const dataTypes = report.system.data_types?.length
    ? report.system.data_types.join(", ")
    : "Not provided";
  const assessment = report.latestAssessment;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button
          render={<Link href={`/dashboard/ai-systems/${report.system.id}`} />}
          nativeButton={false}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to System
        </Button>
        <div className="flex flex-wrap gap-2">
          <SaveReportSnapshotButton
            reportType="ai_system_readiness"
            aiSystemId={report.system.id}
            title={`${report.system.name} Readiness Report`}
          />
          <PrintReportButton />
        </div>
      </div>

      <article className="sg-print-document mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              ShadowGuard Governance Readiness Report
            </div>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">{report.system.name}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{report.system.use_case}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated</p>
            <p className="mt-1 font-medium text-slate-800">{formatDate(report.generatedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <ReportMetric
            label="Readiness"
            value={`${report.readiness.readinessPercent}%`}
            detail={`${report.readiness.closed}/${report.readiness.total} controls closed`}
          />
          <ReportMetric
            label="Risk Tier"
            value={humanize(assessment?.risk_tier ?? report.system.risk_tier)}
            badgeClass={riskClass[assessment?.risk_tier ?? report.system.risk_tier]}
          />
          <ReportMetric
            label="Open Controls"
            value={String(report.readiness.open)}
            detail={`${report.readiness.inProgress} in progress`}
          />
          <ReportMetric
            label="Evidence Gaps"
            value={String(report.evidence.evidenceGaps.length)}
            detail="Closed controls without proof"
          />
        </section>

        <Separator className="my-1" />

        <ReportSection
          icon={FileText}
          title="System Overview"
          description="Core governance facts for this AI use case."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ReportField label="Owner" value={valueOrFallback(report.system.owner_name, "Unassigned")} />
            <ReportField label="Owner Email" value={valueOrFallback(report.system.owner_email)} />
            <ReportField label="Department" value={valueOrFallback(report.system.department)} />
            <ReportField label="Vendor" value={valueOrFallback(report.system.vendor_name)} />
            <ReportField label="Model / Product" value={valueOrFallback(report.system.model_name)} />
            <ReportField label="Business Process" value={valueOrFallback(report.system.business_process)} />
            <ReportField label="Data Sensitivity" value={humanize(report.system.data_sensitivity)} />
            <ReportField label="Data Types" value={dataTypes} />
            <ReportField label="Approval Status" value={humanize(report.system.approval_status)}>
              <Badge className={approvalClass[report.system.approval_status]}>
                {humanize(report.system.approval_status)}
              </Badge>
            </ReportField>
            <ReportField label="Human Review" value={report.system.human_review_required ? "Required" : "Not marked required"} />
          </div>
        </ReportSection>

        <ReportSection
          icon={ClipboardCheck}
          title="Risk Assessment Summary"
          description="Latest completed scoring snapshot for the system."
        >
          {!assessment ? (
            <EmptyReportState text="No risk assessment has been completed yet." />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={riskClass[assessment.risk_tier]}>
                  {humanize(assessment.risk_tier)}
                </Badge>
                <span className="text-sm text-slate-700">
                  Score {assessment.overall_score}/100
                </span>
                <span className="text-sm text-slate-500">
                  Version {assessment.version} - {formatDate(assessment.created_at)}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-700">
                {assessment.summary ?? "No assessment summary was recorded."}
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Data" value={assessment.data_risk_score} />
                <MiniMetric label="Security" value={assessment.security_risk_score} />
                <MiniMetric label="Regulatory" value={assessment.regulatory_risk_score} />
                <MiniMetric label="Business" value={assessment.business_impact_score} />
              </div>
            </div>
          )}
        </ReportSection>

        <ReportSection
          icon={ListChecks}
          title="Governance Controls"
          description="Open work and closed safeguards generated from the assessment."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <ControlGroup title="Open Controls" controls={report.openControls} emptyText="No open controls." />
            <ControlGroup
              title="Completed Or Waived Controls"
              controls={report.closedControls}
              emptyText="No controls have been completed or waived yet."
            />
          </div>
        </ReportSection>

        <ReportSection
          icon={ShieldCheck}
          title="Framework Coverage"
          description="Readiness crosswalks and evidence alignment only. This is not certification, legal advice, or a compliance determination."
        >
          <FrameworkCoverageTable coverage={report.frameworkCoverage} />
        </ReportSection>

        <ReportSection
          icon={ShieldAlert}
          title="Evidence"
          description="Evidence metadata captured against controls, plus closed controls that still need proof."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <EvidenceCapturedGroup
              groups={report.evidence.controlEvidenceGroups}
              standalone={report.evidence.standaloneEvidence}
            />
            <ControlGroup
              title="Evidence Gaps"
              controls={report.evidence.evidenceGaps}
              emptyText="No evidence gaps on closed controls."
            />
          </div>
        </ReportSection>

        <ReportSection
          icon={ShieldCheck}
          title="Recommended Next Actions"
          description="Deterministic follow-up based on the current governance state."
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
      Unable to load the readiness report. Refresh after confirming the current initial schema is applied.
    </div>
  );
}

function ReportMetric({
  label,
  value,
  detail,
  badgeClass,
}: {
  label: string;
  value: string;
  detail?: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      {badgeClass ? (
        <Badge className={`mt-2 ${badgeClass}`}>{value}</Badge>
      ) : (
        <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      )}
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
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

function ReportField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{children ?? value}</div>
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

function EmptyReportState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function ControlGroup({
  title,
  controls,
  emptyText,
  showEvidence = false,
}: {
  title: string;
  controls: AISystemControl[];
  emptyText: string;
  showEvidence?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {controls.length === 0 ? (
        <div className="mt-3 rounded-md border border-slate-200 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {controls.map((control) => (
            <ControlReportRow key={control.id} control={control} showEvidence={showEvidence} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceCapturedGroup({
  groups,
  standalone,
}: {
  groups: ControlEvidenceGroup[];
  standalone: Array<{
    id: string;
    title: string;
    category: string;
    owner: string | null;
    status: AIEvidenceStatus;
    evidence_url: string | null;
    notes: string | null;
  }>;
}) {
  const hasEvidence = groups.length > 0 || standalone.length > 0;

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">Evidence Captured</h4>
      {!hasEvidence ? (
        <div className="mt-3 rounded-md border border-slate-200 px-4 py-6 text-sm text-slate-500">
          No evidence metadata has been captured yet.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <div key={group.control.id} className="sg-print-card sg-print-flow rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
              <p className="text-sm font-semibold text-slate-950">{group.control.title}</p>
              {group.hasLegacyEvidence && (
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Legacy control evidence is captured on this control.
                </div>
              )}
              <EvidenceRecordList evidence={group.evidence} />
            </div>
          ))}
          {standalone.length > 0 && (
            <div className="sg-print-card sg-print-flow rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
              <p className="text-sm font-semibold text-slate-950">System-Level Evidence</p>
              <EvidenceRecordList evidence={standalone} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceRecordList({
  evidence,
}: {
  evidence: Array<{
    id: string;
    title: string;
    category: string;
    owner: string | null;
    status: AIEvidenceStatus;
    evidence_url: string | null;
    notes: string | null;
  }>;
}) {
  if (evidence.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {evidence.map((item) => (
        <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {humanize(item.category)} - {valueOrFallback(item.owner)}
              </p>
            </div>
            <Badge className={evidenceStatusClass[item.status]}>{humanize(item.status)}</Badge>
          </div>
          {item.evidence_url && (
            <a
              href={item.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-sm text-slate-900 underline"
            >
              Evidence URL
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
          {item.notes && <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</p>}
        </div>
      ))}
    </div>
  );
}

function ControlReportRow({
  control,
  showEvidence,
}: {
  control: AISystemControl;
  showEvidence: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950">{control.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {control.category} - {humanize(control.priority)}
          </p>
        </div>
        <Badge className={statusClass[control.status]}>{humanize(control.status)}</Badge>
      </div>
      {control.reason && <p className="mt-3 text-sm leading-6 text-slate-600">{control.reason}</p>}
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
        <span>Owner: {valueOrFallback(control.owner, "Unassigned")}</span>
        <span>Due: {formatShortDate(control.due_date)}</span>
        <span>Updated: {formatShortDate(control.updated_at)}</span>
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
      {control.notes && (
        <p className="mt-3 text-sm leading-6 text-slate-600">Notes: {control.notes}</p>
      )}
      {showEvidence && hasControlEvidence(control) && (
        <div className="mt-3 space-y-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {control.evidence_url && (
            <a
              href={control.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 break-all text-slate-900 underline"
            >
              Evidence URL
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
          {control.evidence_text && (
            <p className="break-words leading-6">{control.evidence_text}</p>
          )}
        </div>
      )}
    </div>
  );
}

function FrameworkCoverageTable({ coverage }: { coverage: AIFrameworkCoverageItem[] }) {
  if (coverage.length === 0) {
    return <EmptyReportState text="No framework mapping metadata was captured for these controls." />;
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
      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
