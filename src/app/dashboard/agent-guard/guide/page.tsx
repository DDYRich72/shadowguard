import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  LifeBuoy,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentGuardNav } from "../agent-guard-nav";
import {
  AGENT_GUARD_OPERATOR_GUIDE_COPY,
  AGENT_GUARD_OPERATOR_GUIDE_PHASES,
  AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS,
  AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING,
  agentGuardOperatorGuideCounts,
} from "@/lib/agent-guard/operator-guide";
import {
  AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY,
  AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS,
  agentGuardEnterpriseSmokeTestCounts,
} from "@/lib/agent-guard/enterprise-smoke-test";
import {
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
  AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP,
  AGENT_GUARD_INGEST_REQUEST_FIELDS,
  AGENT_GUARD_INGEST_RESPONSE_FIELDS,
  SHADOWGUARD_PRODUCTION_OPERATIONS_COPY,
} from "@/lib/agent-guard/production-operations";
import {
  AGENT_GUARD_ENTERPRISE_PILOT_COPY,
  buildAgentGuardEnterprisePilotPackage,
  agentGuardEnterprisePilotCounts,
} from "@/lib/agent-guard/enterprise-pilot-package";
import { buildAgentGuardIntegrationDiagnostics } from "@/lib/agent-guard/integration-diagnostics";
import { AgentGuardIntegrationContractPanel } from "./integration-contract-panel";

export default function AgentGuardGuidePage() {
  const counts = agentGuardOperatorGuideCounts();
  const smokeTestCounts = agentGuardEnterpriseSmokeTestCounts();
  const pilotPackage = buildAgentGuardEnterprisePilotPackage();
  const pilotCounts = agentGuardEnterprisePilotCounts(pilotPackage);
  const diagnostics = buildAgentGuardIntegrationDiagnostics();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          AgentGuard Guide
          <Badge variant="outline" className="border-[color:var(--brand)]/40 text-[color:var(--brand)]">
            Operator path
          </Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          A practical guide for running AgentGuard from first source key to enterprise-readiness evidence.
        </p>
      </div>

      <AgentGuardNav />

      <Card className="overflow-hidden border-[color:var(--brand)]/30">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BookOpen className="h-4 w-4 text-[color:var(--brand)]" />
                {AGENT_GUARD_OPERATOR_GUIDE_COPY.title}
              </CardTitle>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                {AGENT_GUARD_OPERATOR_GUIDE_COPY.overview}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{counts.phases} phases</Badge>
              <Badge variant="outline">{counts.steps} steps</Badge>
              <Badge variant="outline">{counts.troubleshootingNotes} fixes</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 px-4 py-3 text-sm leading-6 text-foreground">
            {AGENT_GUARD_OPERATOR_GUIDE_COPY.streamlinedUx}
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_OPERATOR_GUIDE_COPY.boundary}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-[color:var(--brand)]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />
            Production endpoint
          </CardTitle>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            {SHADOWGUARD_PRODUCTION_OPERATIONS_COPY.endpointSummary}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Canonical source activity endpoint
            </p>
            <code className="mt-3 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
              {AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.method}{" "}
              {AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url}
            </code>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              {AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.auth}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wrapper env
              </p>
              <div className="mt-3 space-y-2">
                {AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP.variables.map((variable) => (
                  <code
                    key={variable}
                    className="block break-all font-mono text-xs text-foreground"
                  >
                    {variable}
                  </code>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request fields
              </p>
              <p className="mt-3 text-xs leading-5 text-foreground">
                {AGENT_GUARD_INGEST_REQUEST_FIELDS.join(", ")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Decision response
              </p>
              <p className="mt-3 text-xs leading-5 text-foreground">
                {AGENT_GUARD_INGEST_RESPONSE_FIELDS.join(", ")}
              </p>
            </div>
          </div>

          <p className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.boundary}
          </p>
        </CardContent>
      </Card>

      <AgentGuardIntegrationContractPanel />

      <Card className="overflow-hidden border-[color:var(--brand)]/30">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Wrench className="h-4 w-4 text-[color:var(--brand)]" />
                {diagnostics.title}
              </CardTitle>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                {diagnostics.overview}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{diagnostics.failures.length} failure paths</Badge>
              <Badge variant="outline">{diagnostics.commands.length} commands</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Troubleshoot source-wrapper tests
            </p>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-foreground">
              Use the Ingestion diagnostics panel when a customer-controlled wrapper gets a token, JSON,
              schema, tool-scope, authorization, or rate-limit response from the configured endpoint.
            </p>
            <Link
              href="/dashboard/agent-guard/ingestion"
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
            >
              Open diagnostics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {diagnostics.boundary}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[color:var(--brand)]" />
            <h3 className="text-base font-semibold text-foreground">
              {AGENT_GUARD_ENTERPRISE_PILOT_COPY.title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{pilotCounts.timelines} timelines</Badge>
            <Badge variant="outline">{pilotCounts.phases} phases</Badge>
            <Badge variant="outline">{pilotCounts.artifacts} artifacts</Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--brand)]/30 bg-[color:var(--brand)]/8 p-4">
          <p className="max-w-5xl text-sm leading-6 text-foreground">
            {pilotPackage.overview}
          </p>
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
            {AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.method} {pilotPackage.endpoint}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {pilotPackage.boundary}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {pilotPackage.timelines.map((timeline) => (
            <div
              key={timeline.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                    {timeline.duration}
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    {timeline.label}
                  </h4>
                </div>
                <Badge variant="outline">{timeline.cadence.length} steps</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {timeline.bestFor}
              </p>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-foreground">
                {timeline.cadence.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--approved-ink)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {pilotPackage.phases.map((phase) => (
            <div
              key={phase.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                    {phase.dayRange}
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    {phase.label}
                  </h4>
                </div>
                <Link
                  href={phase.dashboardHref}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
                >
                  {phase.dashboardLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Operator
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {phase.operatorAction}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {phase.customerAction}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-background p-3">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                  Evidence
                </p>
                <p className="mt-1 text-xs leading-5 text-foreground">
                  {phase.evidenceToCapture}
                </p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {phase.guardrail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.id}
            href={shortcut.href}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-[color:var(--brand)]/50 hover:bg-[color:var(--brand)]/8"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              <Compass className="h-3.5 w-3.5" />
              Quick start
            </div>
            <h3 className="mt-3 text-base font-semibold">{shortcut.label}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {shortcut.detail}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--brand)]">
              {shortcut.cta}
              <ArrowRight className="h-4 w-4" />
            </p>
          </Link>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
            <h3 className="text-base font-semibold text-foreground">
              {AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY.title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{smokeTestCounts.groups} groups</Badge>
            <Badge variant="outline">{smokeTestCounts.items} checks</Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--brand)]/30 bg-[color:var(--brand)]/8 p-4">
          <p className="max-w-5xl text-sm leading-6 text-foreground">
            {AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY.overview}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_ENTERPRISE_SMOKE_TEST_COPY.boundary}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {AGENT_GUARD_ENTERPRISE_SMOKE_TEST_GROUPS.map((group) => (
            <section
              key={group.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                    {group.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {group.summary}
                  </p>
                </div>
                <Badge variant="outline">{group.items.length} checks</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {item.label}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.action}
                        </p>
                      </div>
                      <Link
                        href={item.fixHref}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
                      >
                        {item.fixLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--approved-ink)]" />
                          Expected
                        </p>
                        <p className="mt-1 text-xs leading-5 text-foreground">
                          {item.expectedResult}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--warning-ink)]" />
                          Failure signal
                        </p>
                        <p className="mt-1 text-xs leading-5 text-foreground">
                          {item.failureSignal}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <Wrench className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                          Guardrail
                        </p>
                        <p className="mt-1 text-xs leading-5 text-foreground">
                          {item.guardrail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-[color:var(--brand)]" />
          <h3 className="text-base font-semibold text-foreground">
            Recommended operating path
          </h3>
        </div>

        {AGENT_GUARD_OPERATOR_GUIDE_PHASES.map((phase) => (
          <section
            key={phase.id}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                  {phase.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {phase.outcome}
                </p>
              </div>
              <Badge variant="outline">{phase.steps.length} steps</Badge>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {phase.steps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {step.label}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.goal}
                      </p>
                    </div>
                    <Link
                      href={step.href}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
                    >
                      {step.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--approved-ink)]" />
                        Evidence to see
                      </p>
                      <p className="mt-1 text-xs leading-5 text-foreground">
                        {step.evidence}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                        Boundary
                      </p>
                      <p className="mt-1 text-xs leading-5 text-foreground">
                        {step.guardrail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <LifeBuoy className="h-4 w-4 text-[color:var(--brand)]" />
            Troubleshooting map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING.map((note) => (
              <Link
                key={note.id}
                href={note.href}
                className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/60"
              >
                <p className="text-sm font-semibold text-foreground">
                  {note.symptom}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {note.check}
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                  Open related page
                  <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
