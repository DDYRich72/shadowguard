"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY,
  buildAgentGuardSourceKeyLifecycleHandoff,
  type AgentGuardSourceKeyLifecycleSourceInput,
  type AgentGuardSourceKeyLifecycleTone,
} from "@/lib/agent-guard/source-key-lifecycle";

type SourceKeyLifecyclePanelProps = {
  sources: readonly AgentGuardSourceKeyLifecycleSourceInput[];
};

const TONE_CLASSES: Record<AgentGuardSourceKeyLifecycleTone, string> = {
  green: "border-green-200 bg-green-50 text-green-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
};

export function SourceKeyLifecyclePanel({ sources }: SourceKeyLifecyclePanelProps) {
  const handoff = useMemo(
    () => buildAgentGuardSourceKeyLifecycleHandoff({ sources }),
    [sources]
  );
  const [copied, setCopied] = useState(false);

  async function copyHandoff() {
    await navigator.clipboard.writeText(handoff.handoffText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const metricCards = [
    { label: "Total sources", value: handoff.metrics.totalSources },
    { label: "Active", value: handoff.metrics.activeSources },
    { label: "Never used", value: handoff.metrics.neverUsedSources },
    { label: "Rotation attention", value: handoff.metrics.rotationAttentionSources },
  ];

  return (
    <Card className="overflow-hidden border-[color:var(--brand)]/30">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4 text-[color:var(--brand)]" />
              {handoff.title}
            </CardTitle>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              {handoff.overview}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyHandoff}>
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy handoff"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">
              Source next actions
            </p>
          </div>
          {handoff.sources.length === 0 ? (
            <div className="sg-status-surface sg-status-surface-amber rounded-lg border p-4 text-sm leading-6 text-foreground/85">
              No source keys loaded yet. Create a scoped source, store the one-time key server-side,
              send a safe test event, and confirm source attribution before pilot traffic.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {handoff.sources.map((source) => (
                <article
                  key={source.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {source.name}
                        </h3>
                        <Badge variant="outline" className={`text-xs ${TONE_CLASSES[source.tone]}`}>
                          {source.lifecycleLabel}
                        </Badge>
                        <Badge variant="outline" className="bg-background text-xs text-muted-foreground">
                          {source.environment}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Key hint {source.tokenHint} · {source.activityLabel}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Scope: {source.scopeLabel}
                      </p>
                    </div>
                    <Badge variant="outline" className={`w-fit text-xs ${TONE_CLASSES[source.rotation.tone]}`}>
                      {source.rotation.label}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                        Next action
                      </p>
                      <p className="mt-2 text-xs leading-5 text-foreground">
                        {source.nextAction}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Evidence
                      </p>
                      <p className="mt-2 text-xs leading-5 text-foreground">
                        {source.evidenceLine}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">
              Lifecycle stages
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {handoff.stages.map((stage, index) => (
              <div
                key={stage.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  {stage.label}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {stage.operatorAction}
                </p>
                <p className="mt-3 text-xs leading-5 text-foreground">
                  {stage.evidence}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.noSecrets}
          </p>
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-3.5 w-3.5 text-[color:var(--brand)]" />
            {handoff.boundary}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
