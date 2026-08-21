"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Copy, Radio, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_RECEIVER_VALIDATION_COPY,
  buildAgentGuardReceiverValidationReport,
  type AgentGuardReceiverAttempt,
  type AgentGuardReceiverDestination,
} from "@/lib/agent-guard/receiver-validation";
import {
  AGENT_GUARD_STATUS_BADGE_CLASSES,
  AGENT_GUARD_STATUS_LABEL_CLASSES,
  AGENT_GUARD_STATUS_SURFACE_CLASSES,
} from "@/lib/agent-guard/status-theme";

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function ReceiverValidationPanel() {
  const [destinations, setDestinations] = useState<AgentGuardReceiverDestination[]>(
    []
  );
  const [attempts, setAttempts] = useState<AgentGuardReceiverAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadValidation() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/agent-guard/export-destinations");
    const data = await readJson(response);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Receiver validation could not load.");
      setLoading(false);
      return;
    }
    setDestinations(data.destinations ?? []);
    setAttempts(data.attempts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/agent-guard/export-destinations")
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(data.message ?? data.error ?? "Receiver validation could not load.");
          setLoading(false);
          return;
        }
        setDestinations(data.destinations ?? []);
        setAttempts(data.attempts ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Receiver validation could not load.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const report = useMemo(
    () =>
      buildAgentGuardReceiverValidationReport({
        destinations,
        attempts,
      }),
    [destinations, attempts]
  );

  async function copyHandoff() {
    try {
      await navigator.clipboard.writeText(report.handoffText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Radio className="h-4 w-4 text-[color:var(--brand)]" />
              {AGENT_GUARD_RECEIVER_VALIDATION_COPY.title}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_RECEIVER_VALIDATION_COPY.overview}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={AGENT_GUARD_STATUS_BADGE_CLASSES[report.tone]}
            >
              {report.label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadValidation()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={copyHandoff}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy handoff"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
          >
            {error}
          </div>
        )}

        <div
          className={`rounded-lg border px-4 py-3 text-sm leading-6 ${AGENT_GUARD_STATUS_SURFACE_CLASSES[report.tone]}`}
        >
          <p className="font-semibold">{report.summary}</p>
          <p className="mt-1 text-muted-foreground">{report.boundary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {[
            ["Configured", report.metrics.totalDestinations],
            ["Enabled", report.metrics.enabledDestinations],
            ["Dry-run", report.metrics.dryRunDestinations],
            ["Live", report.metrics.liveDestinations],
            ["Successful", report.metrics.successfulReceivers],
            ["Ack", report.metrics.acknowledgedReceivers],
            ["Attention", report.metrics.needsAttention],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-card p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">
              Receiver validation checklist
            </p>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {report.checklist.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                  <p className="text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  {item.evidence}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Configured receiver posture
          </p>
          {loading ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Loading receiver validation.
            </p>
          ) : report.destinations.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No HTTPS export receiver is configured yet. Create an export
              destination below, store the one-time signing secret customer-side,
              and send a manual signed test event.
            </p>
          ) : (
            <div className="space-y-3">
              {report.destinations.map((destination) => (
                <div
                  key={destination.destinationId}
                  className={`rounded-xl border p-4 ${AGENT_GUARD_STATUS_SURFACE_CLASSES[destination.tone]}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{destination.name}</p>
                        <Badge
                          variant="outline"
                          className={AGENT_GUARD_STATUS_BADGE_CLASSES[destination.tone]}
                        >
                          {destination.label}
                        </Badge>
                        <Badge variant="outline">
                          {destination.destinationTypeLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                        {destination.endpointUrl}
                      </p>
                      <p className="mt-3 text-sm leading-6">{destination.summary}</p>
                    </div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[destination.tone]}`}
                    >
                      {destination.status.replace("_", " ")}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Event scope
                      </p>
                      <p className="mt-1 text-xs leading-5">{destination.eventScope}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Latest attempt
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        {destination.latestAttemptSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Owner/escalation
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        {destination.ownerSummary}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Acknowledgement
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        {destination.acknowledgementSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Next action
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        {destination.nextAction}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {destination.guardrail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
