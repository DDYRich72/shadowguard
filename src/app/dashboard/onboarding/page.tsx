import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Link2,
  ListChecks,
  Route,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/authz";
import {
  buildOnboardingProgress,
  type OnboardingMetrics,
  type OnboardingStep,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "@/lib/ai-governance/onboarding";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

type CountResult = {
  count: number;
  warning?: string;
};

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
};

const STEP_ICON: Record<OnboardingStepId, typeof Upload> = {
  intake: Upload,
  inventory: ListChecks,
  assessment: ShieldCheck,
  controls: CheckCircle2,
  report: FileText,
  delivery: Link2,
};

const STATUS_LABEL: Record<OnboardingStepStatus, string> = {
  complete: "Done",
  current: "Now",
  upcoming: "Next",
  needs_attention: "Check",
};

const STATUS_BADGE: Record<OnboardingStepStatus, string> = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  current: "border-orange-200 bg-orange-50 text-orange-700",
  upcoming: "border-slate-200 bg-slate-50 text-slate-600",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-700",
};

async function safeCount(
  supabase: SupabaseServerClient,
  table: string,
  orgId: string,
  label: string,
  refine?: (query: QueryBuilder) => QueryBuilder
): Promise<CountResult> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId) as unknown as QueryBuilder;

  if (refine) query = refine(query);

  const { count, error } = (await query) as unknown as {
    count: number | null;
    error: { message?: string } | null;
  };

  if (error) {
    return {
      count: 0,
      warning: `Unable to read ${label}. If this is production, confirm the related migration is applied.`,
    };
  }

  return { count: count ?? 0 };
}

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?next=/dashboard/onboarding");

  const supabase = await createServerSupabase();
  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "name, domain, google_connected, microsoft_connected"
    )
    .eq("id", ctx.orgId)
    .maybeSingle();

  const { data: firstSystem } = await supabase
    .from("ai_systems")
    .select("id, name")
    .eq("org_id", ctx.orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    systems,
    assessments,
    controls,
    completedControls,
    evidence,
    snapshots,
    finalSnapshots,
    pdfSnapshots,
    deliveryLinks,
  ] = await Promise.all([
    safeCount(supabase, "ai_systems", ctx.orgId, "AI Systems", (query) =>
      query.eq("status", "active")
    ),
    safeCount(supabase, "ai_risk_assessments", ctx.orgId, "risk assessments", (query) =>
      query.eq("status", "completed")
    ),
    safeCount(supabase, "ai_system_controls", ctx.orgId, "control tasks"),
    safeCount(supabase, "ai_system_controls", ctx.orgId, "completed controls", (query) =>
      query.in("status", ["completed", "waived"])
    ),
    safeCount(supabase, "ai_system_evidence", ctx.orgId, "evidence records"),
    safeCount(supabase, "governance_report_snapshots", ctx.orgId, "report snapshots"),
    safeCount(supabase, "governance_report_snapshots", ctx.orgId, "final snapshots", (query) =>
      query.eq("delivery_status", "final")
    ),
    safeCount(supabase, "governance_report_snapshots", ctx.orgId, "PDF exports", (query) =>
      query.not("pdf_generated_at", "is", null)
    ),
    safeCount(supabase, "governance_report_delivery_links", ctx.orgId, "delivery links", (query) =>
      query.eq("status", "active")
    ),
  ]);

  const metrics: OnboardingMetrics = {
    googleConnected: Boolean(organization?.google_connected),
    microsoftConnected: Boolean(organization?.microsoft_connected),
    aiSystemsCount: systems.count,
    completedAssessmentsCount: assessments.count,
    controlsCount: controls.count,
    completedOrWaivedControlsCount: completedControls.count,
    evidenceCount: evidence.count,
    snapshotsCount: snapshots.count,
    finalSnapshotsCount: finalSnapshots.count,
    pdfSnapshotsCount: pdfSnapshots.count,
    deliveryLinksCount: deliveryLinks.count,
    firstSystemId: firstSystem?.id ?? null,
  };
  const progress = buildOnboardingProgress(metrics);
  const readWarnings = [
    systems,
    assessments,
    controls,
    completedControls,
    evidence,
    snapshots,
    finalSnapshots,
    pdfSnapshots,
    deliveryLinks,
  ].flatMap((result) => (result.warning ? [result.warning] : []));
  const warnings = [...progress.warnings, ...readWarnings];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-6 w-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">
              First Assessment Onboarding
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Build a first AI governance deliverable in this self-hosted workspace.
          </p>
        </div>
        <Button
          render={<Link href={progress.nextStep.href} />}
          nativeButton={false}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {progress.nextStep.actionLabel}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-1">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-px bg-border lg:grid-cols-[1.25fr_1fr]">
          <div className="bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="sg-mono text-[color:var(--brand)]">
                  Assessment launch
                </p>
                <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {progress.completedSteps} of {progress.totalSteps} steps complete
                </h3>
              </div>
              <span className="font-display text-4xl font-semibold tracking-tight text-foreground">
                {progress.percentComplete}%
              </span>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[color:var(--brand)] transition-all"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
            <div className="mt-6 rounded-lg border border-border bg-background px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Next: {progress.nextStep.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {progress.nextStep.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0", STATUS_BADGE[progress.nextStep.status])}
                >
                  {STATUS_LABEL[progress.nextStep.status]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border">
            <MetricTile label="Access" value="All features" />
            <MetricTile label="AI systems" value={String(metrics.aiSystemsCount)} />
            <MetricTile
              label="Assessments"
              value={String(metrics.completedAssessmentsCount)}
            />
            <MetricTile label="Snapshots" value={String(metrics.snapshotsCount)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border px-5 py-4">
            <p className="sg-mono text-[color:var(--brand)]">Checklist</p>
            <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
              First deliverable path
            </h3>
          </header>
          <div className="divide-y divide-border">
            {progress.steps.map((step) => (
              <ChecklistRow key={step.id} step={step} />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="sg-mono text-[color:var(--brand)]">Operator focus</p>
            <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-foreground">
              Ship the first report
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Start with one real AI System, complete its risk scorecard, attach
                enough evidence to explain the control gaps, then save a snapshot.
              </p>
              <p>
                Once the snapshot is reviewed, finalize it and produce the PDF or
                secure client link from the Evidence Vault.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="sg-mono text-[color:var(--brand)]">Current org</p>
            <dl className="mt-4 space-y-3 text-sm">
              <FactRow label="Name" value={organization?.name ?? "Organization"} />
              <FactRow label="Domain" value={organization?.domain ?? "Not set"} />
              <FactRow
                label="Google"
                value={metrics.googleConnected ? "Connected" : "Not connected"}
              />
              <FactRow
                label="Microsoft"
                value={metrics.microsoftConnected ? "Connected" : "Not connected"}
              />
            </dl>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-5">
      <p className="sg-mono-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function ChecklistRow({ step }: { step: OnboardingStep }) {
  const Icon = STEP_ICON[step.id];
  const complete = step.status === "complete";

  return (
    <div className="grid gap-4 bg-card px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border",
          complete
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-border bg-background text-muted-foreground"
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
          <Badge
            variant="outline"
            className={cn("shrink-0", STATUS_BADGE[step.status])}
          >
            {STATUS_LABEL[step.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {step.description}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
      </div>
      <Button
        render={<Link href={step.href} />}
        nativeButton={false}
        variant={step.status === "current" || step.status === "needs_attention" ? "default" : "outline"}
        size="sm"
        className="w-full rounded-md sm:w-auto"
      >
        {step.actionLabel}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Circle className="h-2.5 w-2.5 fill-current" />
        {label}
      </dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
