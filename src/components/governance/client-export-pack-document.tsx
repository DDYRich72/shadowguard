import {
  Archive,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  ListChecks,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ClientExportPack, ClientExportPackMetric } from "@/lib/ai-governance/export-pack";

const metricToneClass: Record<ClientExportPackMetric["tone"], string> = {
  default: "border-slate-200 bg-white text-slate-900",
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  risk: "border-red-200 bg-red-50 text-red-800",
};

const statusClass = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ClientExportPackDocument({
  exportPack,
  snapshotId,
}: {
  exportPack: ClientExportPack;
  snapshotId: string;
}) {
  return (
    <article className="sg-print-document overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <section className="min-h-[620px] border-b border-slate-200 bg-slate-950 px-8 py-12 text-white print:min-h-[760px] print:break-after-page">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
          <BrandMark className="h-10 w-10" imageClassName="h-[72%] w-[72%]" />
          ShadowGuard
        </div>
        <div className="mt-24 max-w-4xl">
          <Badge className="border-slate-700 bg-white/10 text-slate-100">
            {exportPack.reportTypeLabel}
          </Badge>
          <Badge className={cn("ml-2", statusClass[exportPack.deliveryStatus])}>
            {exportPack.deliveryStatus === "final" ? "Final" : "Draft"}
          </Badge>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-normal text-white md:text-5xl">
            {exportPack.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Client Export Pack prepared from a saved point-in-time governance snapshot.
          </p>
        </div>
        <div className="mt-24 grid gap-4 text-sm text-slate-300 md:grid-cols-3">
          <CoverFact label="Prepared for" value={exportPack.clientName} />
          <CoverFact label="Generated" value={formatDate(exportPack.generatedAt)} />
          <CoverFact label="Prepared by" value={exportPack.generatedBy} />
        </div>
      </section>

      <div className="px-8 py-8 print:px-0">
        <ExportSection
          icon={BriefcaseBusiness}
          title="Executive Summary"
          description="High-level governance posture from the saved report snapshot."
        >
          <div className="max-w-4xl space-y-4 text-base leading-8 text-slate-700">
            {exportPack.executiveSummaryNote && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Executive Note</p>
                <p className="mt-1">{exportPack.executiveSummaryNote}</p>
              </div>
            )}
            <p>{exportPack.executiveSummary}</p>
            {exportPack.preparedByNote && (
              <div className="rounded-md border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Prepared By Note</p>
                <p className="mt-1">{exportPack.preparedByNote}</p>
              </div>
            )}
          </div>
        </ExportSection>

        <ExportSection
          icon={CalendarDays}
          title="Risk And Readiness Metrics"
          description="Snapshot metrics captured when the report was saved."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {exportPack.metrics.map((metric) => (
              <div
                key={metric.label}
                className={cn("rounded-md border px-4 py-3", metricToneClass[metric.tone])}
              >
                <p className="text-xs font-semibold uppercase tracking-normal opacity-80">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        </ExportSection>

        <ExportSection
          icon={ShieldCheck}
          title="Framework Alignment"
          description="Practical alignment only. This is not a certification or legal compliance claim."
        >
          <PlainList items={exportPack.frameworkAlignment} />
        </ExportSection>

        <ExportSection
          icon={CheckCircle2}
          title="Key Findings"
          description="What an executive stakeholder or accountable owner should notice first."
        >
          <NumberedList items={exportPack.keyFindings} />
        </ExportSection>

        <ExportSection
          icon={TriangleAlert}
          title="Evidence Gaps"
          description="Controls or systems that need stronger proof before governance is complete."
        >
          <PlainList items={exportPack.evidenceGaps} />
        </ExportSection>

        <ExportSection
          icon={ListChecks}
          title="Next Actions"
          description="Recommended follow-up work based on the frozen report state."
        >
          <NumberedList items={exportPack.nextActions} />
        </ExportSection>

        <ExportSection
          icon={Archive}
          title="Appendix"
          description="Supporting details included for client review."
        >
          <div className="space-y-5">
            {exportPack.appendix.map((section) => (
              <div
                key={section.title}
                className="sg-print-card sg-print-flow rounded-md border border-slate-200 px-4 py-4 print:break-inside-avoid"
              >
                <h4 className="text-sm font-semibold text-slate-950">{section.title}</h4>
                <PlainList items={section.items} compact />
              </div>
            ))}
          </div>
        </ExportSection>

        <Separator className="my-6" />

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Prepared from saved snapshot {snapshotId}</span>
          <span>Detailed internal records are retained in ShadowGuard for review.</span>
        </footer>
      </div>
    </article>
  );
}

function CoverFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/20 pt-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

function ExportSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sg-report-section border-b border-slate-200 py-8 last:border-b-0">
      <div className="sg-report-section-heading mb-5 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="rounded-md border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700"
        >
          <span className="mr-2 font-semibold text-slate-950">{index + 1}.</span>
          {item}
        </li>
      ))}
    </ol>
  );
}

function PlainList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  return (
    <ul className={compact ? "mt-3 space-y-2" : "space-y-3"}>
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className={cn(
            "text-sm leading-6 text-slate-700",
            compact ? "" : "rounded-md border border-slate-200 px-4 py-3"
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
