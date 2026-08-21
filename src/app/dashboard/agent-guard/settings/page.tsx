"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentGuardNav } from "../agent-guard-nav";
import { ConnectorReadinessPanel } from "./connector-readiness-panel";
import {
  AGENT_GUARD_ALERT_ROUTING_BOUNDARY,
  AGENT_GUARD_ALERT_ROUTING_DECISION,
  AGENT_GUARD_ALERT_ROUTING_EVENTS,
} from "@/lib/agent-guard/alert-routing";
import {
  AGENT_GUARD_EXPORT_GUARDRAILS,
  AGENT_GUARD_EXPORT_PAYLOAD_FIELDS,
  AGENT_GUARD_EXPORT_SIGNING_HEADERS,
  agentGuardSampleExportEvent,
  prettyAgentGuardExportPayload,
} from "@/lib/agent-guard/export-foundation";
import { ExportDestinationsPanel } from "./export-destinations-panel";
import { NativeConnectorGroundworkPanel } from "./native-connector-groundwork-panel";
import { ReceiverFieldMappingPanel } from "./receiver-field-mapping-panel";
import { ReceiverIntegrationKitPanel } from "./receiver-integration-kit-panel";
import { ReceiverValidationPanel } from "./receiver-validation-panel";
import { SlackWorkflowPreviewPanel } from "./slack-workflow-preview-panel";

type Settings = {
  kill_switch_active?: boolean;
  auto_block_threshold?: number;
  alert_threshold?: number;
  pii_sensitivity?: "low" | "medium" | "high";
};

const SETTINGS_SECTIONS = [
  { id: "operating-model", label: "Operating model" },
  { id: "status-kill-switch", label: "Status & kill switch" },
  { id: "risk-thresholds", label: "Risk thresholds" },
  { id: "export-foundation", label: "Export foundation" },
  { id: "receiver-kit", label: "Receiver kit" },
  { id: "receiver-validation", label: "Receiver validation" },
  { id: "field-mapping", label: "Field mapping" },
  { id: "connector-readiness", label: "Connector readiness" },
  { id: "connector-groundwork", label: "Connector groundwork" },
  { id: "slack-preview", label: "Slack preview" },
  { id: "export-destinations", label: "Export destinations" },
] as const;

const SETTINGS_INDEX_ID = "agentguard-settings-index";

export default function AgentGuardSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [copiedExportPayload, setCopiedExportPayload] = useState(false);

  useEffect(() => {
    fetch("/api/agent-guard/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}));
  }, []);

  async function patch(partial: Settings) {
    setSaving(true);
    const res = await fetch("/api/agent-guard/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    if (res.ok) setSettings(data.settings);
    setSaving(false);
  }

  const killSwitchActive = settings.kill_switch_active === true;
  const sampleExportPayload = prettyAgentGuardExportPayload(
    agentGuardSampleExportEvent()
  );

  async function copySampleExportPayload() {
    try {
      await navigator.clipboard.writeText(sampleExportPayload);
      setCopiedExportPayload(true);
      window.setTimeout(() => setCopiedExportPayload(false), 2000);
    } catch {
      setCopiedExportPayload(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AgentGuard Settings</h2>
        <p className="text-sm text-slate-500">
          Configure pilot policy evaluation for activity submitted to AgentGuard.
        </p>
      </div>

      <AgentGuardNav />

      <Card
        id={SETTINGS_INDEX_ID}
        size="sm"
        className="sticky top-20 z-20 scroll-mt-24 border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Settings index</CardTitle>
        </CardHeader>
        <CardContent>
          <nav aria-label="AgentGuard settings sections" className="flex flex-wrap gap-2">
            {SETTINGS_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-[color:var(--brand)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      <section id="operating-model" className="scroll-mt-28">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              AgentGuard operating model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              AgentGuard evaluates activity submitted by customer-controlled
              apps, server-side wrappers, or internal integrations. It does not
              install a collector or automatically monitor every AI tool.
              Current block decisions come from enabled policies and the global
              kill switch.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Submitted activity
              </Badge>
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                Customer-controlled integrations
              </Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                No automatic collector
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="status-kill-switch" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monitoring Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {killSwitchActive ? "Global Kill Switch Active" : "Agent Guard Active"}
                </p>
                <p className="text-xs text-slate-500">
                  {killSwitchActive
                    ? "Submitted activity receives a global block decision until you resume normal policy evaluation."
                    : "Submitted activity is evaluated against enabled policies and metadata-only classification output."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    killSwitchActive
                      ? "text-red-600 border-red-200 bg-red-50"
                      : "text-green-600 border-green-200 bg-green-50"
                  }
                >
                  {killSwitchActive ? "Blocked" : "Active"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => patch({ kill_switch_active: !killSwitchActive })}
                >
                  {killSwitchActive ? "Resume" : "Pause submitted activity"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="risk-thresholds" className="scroll-mt-28">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Risk Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Auto-Block Threshold</p>
                  <p className="text-xs text-slate-500">
                    Saved for threshold tuning. Current automatic blocks come from enabled block policies.
                  </p>
                </div>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={settings.auto_block_threshold ?? 60}
                  onChange={(e) =>
                    patch({ auto_block_threshold: Number(e.target.value) })
                  }
                >
                  <option value={90}>90 (Critical only)</option>
                  <option value={75}>75</option>
                  <option value={60}>60</option>
                  <option value={40}>40</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Alert Threshold</p>
                  <p className="text-xs text-slate-500">
                    Saved for alert tuning. Current internal alerts are created when submitted activity is blocked.
                  </p>
                </div>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={settings.alert_threshold ?? 75}
                  onChange={(e) => patch({ alert_threshold: Number(e.target.value) })}
                >
                  <option value={90}>90</option>
                  <option value={75}>75</option>
                  <option value={60}>60</option>
                  <option value={40}>40</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">PII Detection Sensitivity</p>
                  <p className="text-xs text-slate-500">
                    Stored for future classifier tuning. The current classifier uses deterministic pattern checks.
                  </p>
                </div>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={settings.pii_sensitivity ?? "medium"}
                  onChange={(e) =>
                    patch({ pii_sensitivity: e.target.value as "low" | "medium" | "high" })
                  }
                >
                  <option value="low">Low (SSN, credit cards only)</option>
                  <option value="medium">Medium (names, emails, phones)</option>
                  <option value="high">High (all PII categories)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card id="export-foundation" className="scroll-mt-28">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Export Foundation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm leading-6 text-slate-600">
                AgentGuard uses this metadata-only payload contract and HMAC signing model for
                manual tests, guarded automatic delivery, generic alert routing, and manual
                replay to opt-in customer-owned HTTPS webhook or SIEM destinations.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Payload contract ready
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Signed delivery available
                </Badge>
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                  Generic alert routing
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  Raw content excluded
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copySampleExportPayload}>
              {copiedExportPayload ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedExportPayload ? "Copied" : "Copy sample payload"}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Payload fields</p>
                <div className="space-y-2">
                  {AGENT_GUARD_EXPORT_PAYLOAD_FIELDS.map((field) => (
                    <div
                      key={field.path}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <p className="font-mono text-xs font-semibold text-slate-900">
                        {field.path}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {field.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Signing headers</p>
                <div className="space-y-2">
                  {AGENT_GUARD_EXPORT_SIGNING_HEADERS.map((header) => (
                    <div
                      key={header.name}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <p className="font-mono text-xs font-semibold text-slate-900">
                        {header.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {header.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Sample payload</p>
                <pre className="max-h-[430px] overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  <code>{sampleExportPayload}</code>
                </pre>
              </div>

              <div className="sg-status-surface sg-status-surface-amber rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">Delivery guardrails</p>
                <ul className="space-y-2 text-xs leading-5 text-foreground/85">
                  {AGENT_GUARD_EXPORT_GUARDRAILS.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--warning)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Generic alert routing
                </p>
                <p className="text-xs leading-5 text-slate-600">
                  {AGENT_GUARD_ALERT_ROUTING_DECISION}
                </p>
                <div className="mt-3 space-y-2">
                  {AGENT_GUARD_ALERT_ROUTING_EVENTS.map((event) => (
                    <div
                      key={event.eventType}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            event.category === "alert"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }
                        >
                          {event.category === "alert" ? "Alert-worthy" : "Activity"}
                        </Badge>
                        <p className="text-xs font-semibold text-slate-900">
                          {event.label}
                        </p>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500">
                        {event.eventType}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {event.description}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  {AGENT_GUARD_ALERT_ROUTING_BOUNDARY}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section id="receiver-kit" className="scroll-mt-28">
        <ReceiverIntegrationKitPanel />
      </section>

      <section id="receiver-validation" className="scroll-mt-28">
        <ReceiverValidationPanel />
      </section>

      <section id="field-mapping" className="scroll-mt-28">
        <ReceiverFieldMappingPanel />
      </section>

      <section id="connector-readiness" className="scroll-mt-28">
        <ConnectorReadinessPanel />
      </section>

      <section id="connector-groundwork" className="scroll-mt-28">
        <NativeConnectorGroundworkPanel />
      </section>

      <section id="slack-preview" className="scroll-mt-28">
        <SlackWorkflowPreviewPanel />
      </section>

      <section id="export-destinations" className="scroll-mt-28">
        <ExportDestinationsPanel />
      </section>
    </div>
  );
}
