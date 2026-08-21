import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  LifeBuoy,
  Network,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MCP_GUARD_FIELD_GROUPS,
  MCP_GUARD_GUIDE_SHORTCUTS,
  MCP_GUARD_OPERATOR_GUIDE_COPY,
  MCP_GUARD_OPERATOR_STEPS,
  MCP_GUARD_SAFE_EVENT_SAMPLE,
  MCP_GUARD_TROUBLESHOOTING,
  mcpGuardOperatorGuideCounts,
} from "@/lib/mcp-governance/operator-guide";

export default function MCPGuardGuidePage() {
  const counts = mcpGuardOperatorGuideCounts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          MCPGuard Guide
          <Badge variant="outline" className="border-[color:var(--brand)]/40 text-[color:var(--brand)]">
            Operator path
          </Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          A practical path for registering MCP exposure, testing safe event intake, and proving posture.
        </p>
      </div>

      <Card className="overflow-hidden border-[color:var(--brand)]/30">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BookOpen className="h-4 w-4 text-[color:var(--brand)]" />
                {MCP_GUARD_OPERATOR_GUIDE_COPY.title}
              </CardTitle>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                {MCP_GUARD_OPERATOR_GUIDE_COPY.overview}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{counts.shortcuts} shortcuts</Badge>
              <Badge variant="outline">{counts.steps} steps</Badge>
              <Badge variant="outline">{counts.fieldGroups} field groups</Badge>
              <Badge variant="outline">{counts.troubleshootingNotes} fixes</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 px-4 py-3 text-sm leading-6 text-foreground">
            {MCP_GUARD_OPERATOR_GUIDE_COPY.safeEventRule}
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {MCP_GUARD_OPERATOR_GUIDE_COPY.boundary}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {MCP_GUARD_GUIDE_SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.id}
            href={shortcut.href}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-[color:var(--brand)]/50 hover:bg-[color:var(--brand)]/8"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              <Network className="h-3.5 w-3.5" />
              Start here
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
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[color:var(--brand)]" />
          <h3 className="text-base font-semibold text-foreground">
            Recommended operating path
          </h3>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {MCP_GUARD_OPERATOR_STEPS.map((step, index) => (
            <section
              key={step.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                    Step {index + 1}
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    {step.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.goal}
                  </p>
                </div>
                <Link
                  href={step.pageHref}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
                >
                  {step.pageLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                    Action
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {step.operatorAction}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--approved-ink)]" />
                    Evidence
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {step.evidence}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                    Guardrail
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {step.guardrail}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[color:var(--brand)]" />
          <h3 className="text-base font-semibold text-foreground">
            Form field guide
          </h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {MCP_GUARD_FIELD_GROUPS.map((group) => (
            <section
              key={group.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <h4 className="text-sm font-semibold text-foreground">
                {group.label}
              </h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {group.whenToUse}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.fields.map((field) => (
                  <Badge key={field} variant="outline">
                    {field}
                  </Badge>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <Card className="border-[color:var(--brand)]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-[color:var(--warning-ink)]" />
            Safe event examples
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Known tool smoke
            </p>
            <code className="mt-3 block whitespace-pre-wrap rounded-md border border-border bg-card px-3 py-2 font-mono text-xs leading-5 text-foreground">
              Input: {MCP_GUARD_SAFE_EVENT_SAMPLE.knownToolInput}
              {"\n"}Output: {MCP_GUARD_SAFE_EVENT_SAMPLE.knownToolOutput}
              {"\n"}Resource: {MCP_GUARD_SAFE_EVENT_SAMPLE.resourceLabel}
            </code>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Unknown tool smoke
            </p>
            <code className="mt-3 block whitespace-pre-wrap rounded-md border border-border bg-card px-3 py-2 font-mono text-xs leading-5 text-foreground">
              Input: {MCP_GUARD_SAFE_EVENT_SAMPLE.unknownToolInput}
              {"\n"}Server: Unknown or unregistered server
              {"\n"}Tool: Unknown or unregistered tool
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <LifeBuoy className="h-4 w-4 text-[color:var(--brand)]" />
            Troubleshooting map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {MCP_GUARD_TROUBLESHOOTING.map((note) => (
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
                  {note.hrefLabel}
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
