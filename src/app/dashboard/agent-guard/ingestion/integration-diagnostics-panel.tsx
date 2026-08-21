"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ListChecks,
  Terminal,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAgentGuardIntegrationDiagnostics } from "@/lib/agent-guard/integration-diagnostics";

export function IntegrationDiagnosticsPanel() {
  const diagnostics = useMemo(() => buildAgentGuardIntegrationDiagnostics(), []);
  const [activeCommandId, setActiveCommandId] = useState(
    diagnostics.commands[0]?.id
  );
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  const activeCommand =
    diagnostics.commands.find((command) => command.id === activeCommandId) ??
    diagnostics.commands[0]!;

  async function copyCommand() {
    await navigator.clipboard.writeText(activeCommand.code);
    setCopiedCommand(true);
    window.setTimeout(() => setCopiedCommand(false), 2000);
  }

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(diagnostics.diagnosticsText);
    setCopiedDiagnostics(true);
    window.setTimeout(() => setCopiedDiagnostics(false), 2000);
  }

  return (
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
            <Button variant="outline" size="sm" onClick={copyDiagnostics}>
              {copiedDiagnostics ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedDiagnostics ? "Copied" : "Copy diagnostics"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
            Diagnostic endpoint
          </p>
          <code className="mt-3 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
            {diagnostics.endpoint.method} {diagnostics.endpoint.url}
          </code>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Use one safe placeholder event first. Do not paste source keys,
            raw prompts, responses, files, messages, real credentials, or
            customer data into shared diagnostics.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">
              Operator next checks
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {diagnostics.checks.map((check, index) => (
              <div
                key={check.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand)]/40 bg-[color:var(--brand)]/10 text-xs font-bold text-[color:var(--brand)]">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {check.label}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--approved-ink)]" />
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {check.detail}
                </p>
                <Link
                  href={check.href}
                  className="mt-3 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]"
                >
                  {check.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">
              Failure paths
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {diagnostics.failures.map((failure) => (
              <div
                key={failure.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[color:var(--brand)]/40 text-[color:var(--brand)]"
                  >
                    HTTP {failure.status}
                  </Badge>
                  <code className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-foreground">
                    {failure.code}
                  </code>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {failure.label}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {failure.signal}
                </p>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  {failure.likelyCause}
                </p>
                <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
                  {failure.checkNext.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[color:var(--brand)]" />
              <p className="text-sm font-semibold text-foreground">
                Copyable diagnostic commands
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyCommand}>
              {copiedCommand ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedCommand ? "Copied" : "Copy command"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnostics.commands.map((command) => (
              <button
                key={command.id}
                type="button"
                onClick={() => {
                  setActiveCommandId(command.id);
                  setCopiedCommand(false);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeCommand.id === command.id
                    ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {command.label}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeCommand.label}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {activeCommand.summary}
                </p>
              </div>
              <Badge variant="outline">{activeCommand.runtime}</Badge>
            </div>
            <pre className="max-h-[420px] overflow-x-auto rounded-lg border border-border bg-[#050505] p-4 text-xs leading-5 text-slate-100">
              <code>{activeCommand.code}</code>
            </pre>
          </div>
        </section>

        <p className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
          {diagnostics.boundary}
        </p>
      </CardContent>
    </Card>
  );
}
