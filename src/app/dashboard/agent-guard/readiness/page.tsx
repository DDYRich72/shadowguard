"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileCheck2,
  History,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentGuardNav } from "../agent-guard-nav";
import {
  AGENT_GUARD_EVIDENCE_PACKET_COPY,
  type AgentGuardEvidencePacket,
} from "@/lib/agent-guard/evidence-packets";
import {
  agentGuardPilotReadinessReportToText,
  AGENT_GUARD_PILOT_READINESS_COPY,
  buildAgentGuardPilotReadinessReport,
  type AgentGuardPilotReadinessConcernSeverity,
  type AgentGuardPilotReadinessMetric,
  type AgentGuardPilotReadinessPolicy,
  type AgentGuardPilotReadinessReport,
  type AgentGuardPilotReadinessStatus,
  type AgentGuardPilotReadinessTone,
} from "@/lib/agent-guard/pilot-readiness-report";
import {
  buildAgentGuardProductionRolloutGuardrails,
  type AgentGuardProductionRolloutExportDestination,
} from "@/lib/agent-guard/production-rollout";
import type { AgentGuardRolloutAcknowledgement } from "@/lib/agent-guard/rollout-acknowledgements";
import {
  AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY,
  buildAgentGuardSourcePolicyCoverage,
  type AgentGuardSourceCoverageActivity,
  type AgentGuardSourceCoverageReview,
  type AgentGuardSourceCoverageSource,
} from "@/lib/agent-guard/source-policy-coverage";
import {
  AGENT_GUARD_CONCERN_SEVERITY_TONES,
  AGENT_GUARD_PILOT_STATUS_TONES,
  AGENT_GUARD_STATUS_BADGE_CLASSES,
  AGENT_GUARD_STATUS_LABEL_CLASSES,
  AGENT_GUARD_STATUS_SURFACE_CLASSES,
} from "@/lib/agent-guard/status-theme";

type IngestSourceApiItem = {
  id: string;
  name: string;
  environment: string;
  status: string;
  allowedToolNames: string[];
};

type PolicyApiItem = {
  id: string;
  name: string;
  enabled: boolean;
  action: string;
};

type PolicyReviewApiItem = {
  id: string;
  activityId: string | null;
  policyId: string | null;
  policyName: string;
  policyAction: AgentGuardSourceCoverageReview["policyAction"];
  status: AgentGuardSourceCoverageReview["status"];
  riskLevel: string;
  createdAt: string;
};

type ExportDestinationApiItem = {
  id: string;
  name: string;
  status: string;
  automaticDeliveryEnabled: boolean;
  dryRunEnabled: boolean;
  healthStatus: string;
  healthLabel: string;
};

type ReportLoadResult = {
  report: AgentGuardPilotReadinessReport;
  copiedText: string;
};

type PacketLoadResult = {
  packets: AgentGuardEvidencePacket[];
  warning: string | null;
};

const STATUS_CLASSES: Record<AgentGuardPilotReadinessStatus, string> = {
  setup_required:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_PILOT_STATUS_TONES.setup_required
    ],
  ready_for_pilot:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_PILOT_STATUS_TONES.ready_for_pilot
    ],
  needs_review:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_PILOT_STATUS_TONES.needs_review
    ],
  live_caution:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_PILOT_STATUS_TONES.live_caution
    ],
};

const TONE_CLASSES: Record<AgentGuardPilotReadinessTone, string> = {
  green: AGENT_GUARD_STATUS_SURFACE_CLASSES.green,
  amber: AGENT_GUARD_STATUS_SURFACE_CLASSES.amber,
  red: AGENT_GUARD_STATUS_SURFACE_CLASSES.red,
  blue: AGENT_GUARD_STATUS_SURFACE_CLASSES.blue,
  slate: AGENT_GUARD_STATUS_SURFACE_CLASSES.slate,
};

const CONCERN_CLASSES: Record<AgentGuardPilotReadinessConcernSeverity, string> = {
  attention:
    AGENT_GUARD_STATUS_SURFACE_CLASSES[
      AGENT_GUARD_CONCERN_SEVERITY_TONES.attention
    ],
  blocked:
    AGENT_GUARD_STATUS_SURFACE_CLASSES[
      AGENT_GUARD_CONCERN_SEVERITY_TONES.blocked
    ],
  live_caution:
    AGENT_GUARD_STATUS_SURFACE_CLASSES[
      AGENT_GUARD_CONCERN_SEVERITY_TONES.live_caution
    ],
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "AgentGuard data could not load.");
  }
  return data;
}

async function loadSources(): Promise<AgentGuardSourceCoverageSource[]> {
  const data = await readJson(await fetch("/api/agent-guard/ingest-sources"));
  return ((data.sources ?? []) as IngestSourceApiItem[]).map((source) => ({
    id: source.id,
    name: source.name,
    environment: source.environment,
    status: source.status,
    allowedToolNames: source.allowedToolNames ?? [],
  }));
}

async function loadRecentActivity(): Promise<AgentGuardSourceCoverageActivity[]> {
  const data = await readJson(await fetch("/api/agent-guard/activity?limit=500"));
  return data.activities ?? [];
}

async function loadPolicies(): Promise<AgentGuardPilotReadinessPolicy[]> {
  const data = await readJson(await fetch("/api/agent-guard/policies"));
  return ((data.policies ?? []) as PolicyApiItem[]).map((policy) => ({
    id: policy.id,
    name: policy.name,
    enabled: policy.enabled,
    action: policy.action,
  }));
}

async function loadPolicyReviews(): Promise<{
  reviews: AgentGuardSourceCoverageReview[];
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/policy-reviews?limit=500");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        reviews: [],
        warning: AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY.reviewMigrationWarning,
      };
    }
    return {
      reviews: [],
      warning: data.message ?? data.error ?? "Policy review rows could not load.",
    };
  }
  return {
    reviews: ((data.reviews ?? []) as PolicyReviewApiItem[]).map((review) => ({
      id: review.id,
      activityId: review.activityId,
      policyId: review.policyId,
      policyName: review.policyName,
      policyAction: review.policyAction,
      status: review.status,
      riskLevel: review.riskLevel,
      createdAt: review.createdAt,
    })),
    warning: null,
  };
}

async function loadExportDestinations(): Promise<{
  destinations: AgentGuardProductionRolloutExportDestination[];
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/export-destinations");
  const data = await response.json();
  if (!response.ok) {
    return {
      destinations: [],
      warning:
        data.message ??
        data.error ??
        "Export destination posture could not be loaded.",
    };
  }
  return {
    destinations: ((data.destinations ?? []) as ExportDestinationApiItem[]).map(
      (destination) => ({
        id: destination.id,
        name: destination.name,
        status: destination.status,
        automaticDeliveryEnabled: destination.automaticDeliveryEnabled,
        dryRunEnabled: destination.dryRunEnabled,
        healthStatus: destination.healthStatus,
        healthLabel: destination.healthLabel,
      })
    ),
    warning: null,
  };
}

async function loadAcknowledgements(): Promise<{
  acknowledgements: AgentGuardRolloutAcknowledgement[];
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/rollout-acknowledgements");
  const data = await response.json();
  if (!response.ok) {
    return {
      acknowledgements: [],
      warning:
        data.message ??
        data.error ??
        "Rollout acknowledgement evidence could not be loaded.",
    };
  }
  return {
    acknowledgements: data.acknowledgements ?? [],
    warning: null,
  };
}

async function loadReadinessReport(): Promise<ReportLoadResult> {
  const [
    sources,
    activities,
    policies,
    reviewResult,
    exportResult,
    acknowledgementResult,
  ] = await Promise.all([
    loadSources(),
    loadRecentActivity(),
    loadPolicies(),
    loadPolicyReviews(),
    loadExportDestinations(),
    loadAcknowledgements(),
  ]);

  const coverage = buildAgentGuardSourcePolicyCoverage({
    sources,
    activities,
    reviews: reviewResult.reviews,
  });
  const rollout = buildAgentGuardProductionRolloutGuardrails({
    sources,
    coverageRows: coverage.rows,
    exportDestinations: exportResult.destinations,
  });
  const loadWarnings = [
    reviewResult.warning,
    exportResult.warning,
    acknowledgementResult.warning,
  ].filter((warning): warning is string => Boolean(warning));
  const report = buildAgentGuardPilotReadinessReport({
    coverage,
    rollout,
    policies,
    exportDestinations: exportResult.destinations,
    acknowledgements: acknowledgementResult.acknowledgements,
    loadWarnings,
  });

  return {
    report,
    copiedText: agentGuardPilotReadinessReportToText(report),
  };
}

async function loadEvidencePackets(): Promise<PacketLoadResult> {
  const response = await fetch("/api/agent-guard/evidence-packets?limit=10");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        packets: [],
        warning: data.message ?? AGENT_GUARD_EVIDENCE_PACKET_COPY.migrationWarning,
      };
    }
    throw new Error(data.message ?? data.error ?? "Evidence packet history could not load.");
  }
  return {
    packets: data.packets ?? [],
    warning: null,
  };
}

function MetricCard({ metric }: { metric: AgentGuardPilotReadinessMetric }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE_CLASSES[metric.tone]}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[metric.tone]}`}
      >
        {metric.label}
      </p>
      <p className="mt-2 text-2xl font-bold">{metric.value}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{metric.detail}</p>
    </div>
  );
}

export default function AgentGuardReadinessPage() {
  const [result, setResult] = useState<ReportLoadResult | null>(null);
  const [packets, setPackets] = useState<AgentGuardEvidencePacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [packetsLoading, setPacketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packetError, setPacketError] = useState<string | null>(null);
  const [packetWarning, setPacketWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPacketId, setCopiedPacketId] = useState<string | null>(null);
  const [savingPacket, setSavingPacket] = useState(false);

  async function refreshReport() {
    setLoading(true);
    setError(null);
    try {
      setResult(await loadReadinessReport());
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Readiness report could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPackets(showSpinner = true) {
    if (showSpinner) setPacketsLoading(true);
    setPacketError(null);
    try {
      const nextPackets = await loadEvidencePackets();
      setPackets(nextPackets.packets);
      setPacketWarning(nextPackets.warning);
    } catch (err) {
      setPacketError(
        err instanceof Error ? err.message : "Evidence packet history could not load."
      );
    } finally {
      setPacketsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadReadinessReport()
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Readiness report could not load."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadEvidencePackets()
      .then((nextPackets) => {
        if (active) {
          setPackets(nextPackets.packets);
          setPacketWarning(nextPackets.warning);
        }
      })
      .catch((err) => {
        if (active) {
          setPacketError(
            err instanceof Error
              ? err.message
              : "Evidence packet history could not load."
          );
        }
      })
      .finally(() => {
        if (active) setPacketsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function copyReport() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.copiedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyPacket(packet: AgentGuardEvidencePacket) {
    try {
      await navigator.clipboard.writeText(packet.packetText);
      setCopiedPacketId(packet.id);
      window.setTimeout(() => setCopiedPacketId(null), 2000);
    } catch {
      setCopiedPacketId(null);
    }
  }

  async function saveEvidencePacket() {
    setSavingPacket(true);
    setPacketError(null);
    try {
      const response = await fetch("/api/agent-guard/evidence-packets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "migration_required") {
          setPacketWarning(
            data.message ?? AGENT_GUARD_EVIDENCE_PACKET_COPY.migrationWarning
          );
          return;
        }
        setPacketError(data.message ?? data.error ?? "Evidence packet could not be saved.");
        return;
      }
      setPacketWarning(null);
      setPackets((current) => [data.packet, ...current].slice(0, 10));
      await refreshReport();
    } catch {
      setPacketError("Evidence packet could not be saved.");
    } finally {
      setSavingPacket(false);
    }
  }

  const report = result?.report ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            AgentGuard Pilot Readiness
          </h2>
          <p className="text-sm text-slate-500">
            Read-only operator evidence from submitted activity, policy coverage,
            reviews, exports, and rollout acknowledgements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshReport}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={saveEvidencePacket}
            disabled={savingPacket}
          >
            <Save className="mr-2 h-4 w-4" />
            {savingPacket ? "Saving..." : "Save evidence packet"}
          </Button>
        </div>
      </div>

      <AgentGuardNav />

      {error && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
        >
          {error}
        </div>
      )}

      {packetError && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
        >
          {packetError}
        </div>
      )}

      {packetWarning && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
        >
          {packetWarning}
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Building AgentGuard readiness evidence...
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />
                    Readiness summary
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {AGENT_GUARD_PILOT_READINESS_COPY.overview}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`w-fit ${STATUS_CLASSES[report.status]}`}
                >
                  {report.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-700">{report.summary}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                {report.boundary}
              </div>
              <p className="text-xs text-slate-400">
                Generated {formatDate(report.generatedAt)}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.evidenceMetrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="h-4 w-4 text-[color:var(--brand)]" />
                  Open concerns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.concerns.length === 0 ? (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.green}`}
                  >
                    No blocking concerns in the loaded metadata window. Keep spot-checking
                    fresh submitted activity during the pilot.
                  </div>
                ) : (
                  report.concerns.map((concern) => (
                    <div
                      key={concern.id}
                      className={`rounded-xl border p-4 ${CONCERN_CLASSES[concern.severity]}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{concern.label}</p>
                        <Badge
                          variant="outline"
                          className={
                            AGENT_GUARD_STATUS_BADGE_CLASSES[
                              AGENT_GUARD_CONCERN_SEVERITY_TONES[concern.severity]
                            ]
                          }
                        >
                          {concern.severity.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6">{concern.summary}</p>
                      <p
                        className={`mt-2 text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[AGENT_GUARD_CONCERN_SEVERITY_TONES[concern.severity]]}`}
                      >
                        Next
                      </p>
                      <p className="text-sm leading-6">{concern.nextAction}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
                  Next operator actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.nextActions.map((action) => (
                  <div key={action.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {action.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {action.detail}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileCheck2 className="h-4 w-4 text-[color:var(--brand)]" />
                Acknowledgement evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.acknowledgementEvidence.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No rollout acknowledgement evidence loaded yet.
                </p>
              ) : (
                report.acknowledgementEvidence.map((acknowledgement) => (
                  <div
                    key={`${acknowledgement.sourceId ?? acknowledgement.sourceName}:${acknowledgement.createdAt}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {acknowledgement.sourceName}
                      </p>
                      <Badge variant="outline" className="bg-slate-50">
                        {acknowledgement.sourceRolloutLabel}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-50">
                        {acknowledgement.exportPostureLabel}
                      </Badge>
                      {acknowledgement.stale && (
                        <Badge
                          variant="outline"
                          className={AGENT_GUARD_STATUS_BADGE_CLASSES.amber}
                        >
                          Review current posture
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Reviewed by {acknowledgement.acknowledgedByEmail ?? "unknown"} ·{" "}
                      {formatDate(acknowledgement.createdAt)}
                    </p>
                    {acknowledgement.note && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Note: {acknowledgement.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--brand)]" />
                  Copyable evidence packet
                </CardTitle>
                <Button variant="outline" size="sm" onClick={copyReport}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? "Copied" : "Copy packet"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                <code>{result?.copiedText ?? ""}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <History className="h-4 w-4 text-[color:var(--brand)]" />
                    Saved evidence packet history
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {AGENT_GUARD_EVIDENCE_PACKET_COPY.overview}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshPackets()}
                  disabled={packetsLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh history
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                {AGENT_GUARD_EVIDENCE_PACKET_COPY.boundary}
              </div>

              {packetsLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Loading saved evidence packets...
                </div>
              ) : packets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  No saved AgentGuard evidence packets yet.
                </div>
              ) : (
                packets.map((packet) => (
                  <div
                    key={packet.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {packet.title}
                          </p>
                          <Badge
                            variant="outline"
                            className={`w-fit ${STATUS_CLASSES[packet.status]}`}
                          >
                            {packet.statusLabel}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {packet.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span>Saved {formatDate(packet.createdAt)}</span>
                          <span>
                            Generated by {packet.generatedByEmail ?? "unknown"}
                          </span>
                          <span>
                            Primary action:{" "}
                            {packet.summaryMetrics.primaryActionLabel}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Sources {packet.summaryMetrics.activeSourceCount}/
                            {packet.summaryMetrics.configuredSourceCount}
                          </span>
                          <span>
                            Activity sources{" "}
                            {packet.summaryMetrics.recentActivitySourceCount}
                          </span>
                          <span>
                            Reviews {packet.summaryMetrics.needsActionReviewCount}
                          </span>
                          <span>
                            Live exports{" "}
                            {packet.summaryMetrics.liveExportDestinationCount}
                          </span>
                          <span>Concerns {packet.summaryMetrics.concernCount}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyPacket(packet)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedPacketId === packet.id ? "Copied" : "Copy packet"}
                      </Button>
                    </div>
                    {packet.loadWarnings.length > 0 && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
                      >
                        Saved with {packet.loadWarnings.length} evidence load warning
                        {packet.loadWarnings.length === 1 ? "" : "s"}.
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
