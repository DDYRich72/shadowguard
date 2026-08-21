"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  Lock,
  Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentGuardNav } from "../agent-guard-nav";
import { AgentGuardWorkflowAssistPanel } from "../workflow-assist-panel";
import {
  AGENT_GUARD_ENTERPRISE_SETUP_COPY,
  buildAgentGuardEnterpriseSetupGuide,
  type AgentGuardEnterpriseSetupGuide,
  type AgentGuardEnterpriseSetupStatus,
  type AgentGuardEnterpriseSetupStepStatus,
} from "@/lib/agent-guard/enterprise-setup";
import {
  AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY,
  buildAgentGuardEnterpriseRunbook,
  type AgentGuardEnterpriseRunbook,
} from "@/lib/agent-guard/enterprise-runbook";
import {
  AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY,
  buildAgentGuardEvidenceHandoffPackage,
  type AgentGuardEvidenceHandoffArtifactStatus,
  type AgentGuardEvidenceHandoffPackage,
} from "@/lib/agent-guard/evidence-handoff-package";
import {
  AGENT_GUARD_INTEGRATION_EVIDENCE_COPY,
  type AgentGuardIntegrationEvidence,
} from "@/lib/agent-guard/integration-evidence";
import { buildAgentGuardOperatorCommandCenter } from "@/lib/agent-guard/operator-command-center";
import {
  buildAgentGuardPilotReadinessReport,
  type AgentGuardPilotReadinessPolicy,
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
  AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES,
  AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES,
  AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES,
  AGENT_GUARD_STATUS_BADGE_CLASSES,
  AGENT_GUARD_STATUS_HOVER_CLASSES,
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

type SetupLoadResult = {
  guide: AgentGuardEnterpriseSetupGuide;
  runbook: AgentGuardEnterpriseRunbook;
  handoffPackage: AgentGuardEvidenceHandoffPackage;
};

const STATUS_CLASSES: Record<AgentGuardEnterpriseSetupStatus, string> = {
  setup_required:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.setup_required
    ],
  in_progress:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.in_progress
    ],
  needs_review:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.needs_review
    ],
  live_caution:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.live_caution
    ],
  enterprise_ready:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.enterprise_ready
    ],
};

const STEP_CLASSES: Record<AgentGuardEnterpriseSetupStepStatus, string> = {
  done: AGENT_GUARD_STATUS_SURFACE_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.done],
  next: AGENT_GUARD_STATUS_SURFACE_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.next],
  attention:
    AGENT_GUARD_STATUS_SURFACE_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.attention
    ],
  locked:
    AGENT_GUARD_STATUS_SURFACE_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.locked
    ],
};

const STEP_LABEL_CLASSES: Record<AgentGuardEnterpriseSetupStepStatus, string> = {
  done: AGENT_GUARD_STATUS_LABEL_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.done],
  next: AGENT_GUARD_STATUS_LABEL_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.next],
  attention:
    AGENT_GUARD_STATUS_LABEL_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.attention
    ],
  locked:
    AGENT_GUARD_STATUS_LABEL_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.locked
    ],
};

const STEP_EVIDENCE_CLASSES: Record<AgentGuardEnterpriseSetupStepStatus, string> = {
  done: "text-muted-foreground",
  next: "text-muted-foreground",
  attention: "text-muted-foreground",
  locked: "text-muted-foreground",
};

const STEP_HOVER_CLASSES: Record<AgentGuardEnterpriseSetupStepStatus, string> = {
  done: AGENT_GUARD_STATUS_HOVER_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.done],
  next: AGENT_GUARD_STATUS_HOVER_CLASSES[AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.next],
  attention:
    AGENT_GUARD_STATUS_HOVER_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.attention
    ],
  locked:
    AGENT_GUARD_STATUS_HOVER_CLASSES[
      AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.locked
    ],
};

const HANDOFF_STATUS_CLASSES: Record<AgentGuardEvidenceHandoffArtifactStatus, string> = {
  ready:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES.ready
    ],
  available:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES.available
    ],
  gap:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES.gap
    ],
  caution:
    AGENT_GUARD_STATUS_BADGE_CLASSES[
      AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES.caution
    ],
};

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "AgentGuard setup data could not load.");
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

async function loadEvidencePacketCount(): Promise<{
  count: number;
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/evidence-packets?limit=25");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        count: 0,
        warning: data.message ?? "Evidence packet history could not be loaded.",
      };
    }
    return {
      count: 0,
      warning: data.message ?? data.error ?? "Evidence packet history could not load.",
    };
  }
  return {
    count: (data.packets ?? []).length,
    warning: null,
  };
}

async function loadIntegrationEvidence(): Promise<{
  evidence: AgentGuardIntegrationEvidence[];
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/integration-evidence?limit=25");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        evidence: [],
        warning:
          data.message ?? AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.migrationWarning,
      };
    }
    return {
      evidence: [],
      warning:
        data.message ?? data.error ?? "Integration evidence could not load.",
    };
  }
  return {
    evidence: data.evidence ?? [],
    warning: null,
  };
}

async function loadSetupGuide(): Promise<SetupLoadResult> {
  const [
    sources,
    activities,
    policies,
    reviewResult,
    exportResult,
    acknowledgementResult,
    packetResult,
    integrationEvidenceResult,
  ] = await Promise.all([
    loadSources(),
    loadRecentActivity(),
    loadPolicies(),
    loadPolicyReviews(),
    loadExportDestinations(),
    loadAcknowledgements(),
    loadEvidencePacketCount(),
    loadIntegrationEvidence(),
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
  const commandCenter = buildAgentGuardOperatorCommandCenter(report);

  const guide = buildAgentGuardEnterpriseSetupGuide({
    report,
    commandCenter,
    evidencePacketCount: packetResult.count,
    loadWarnings: packetResult.warning ? [packetResult.warning] : [],
  });

  const runbook = buildAgentGuardEnterpriseRunbook({
    setupGuide: guide,
    integrationEvidence: integrationEvidenceResult.evidence,
    integrationEvidenceWarning: integrationEvidenceResult.warning,
  });

  return {
    guide,
    runbook,
    handoffPackage: buildAgentGuardEvidenceHandoffPackage({
      setupGuide: guide,
      integrationEvidence: integrationEvidenceResult.evidence,
      integrationEvidenceWarning: integrationEvidenceResult.warning,
      evidencePacketCount: packetResult.count,
      runbook,
    }),
  };
}

function StepIcon({ status }: { status: AgentGuardEnterpriseSetupStepStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "locked") return <Lock className="h-4 w-4" />;
  if (status === "attention") return <AlertTriangle className="h-4 w-4" />;
  return <ClipboardCheck className="h-4 w-4" />;
}

export default function AgentGuardSetupPage() {
  const [result, setResult] = useState<SetupLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedRunbook, setCopiedRunbook] = useState(false);
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  async function refreshSetup() {
    setLoading(true);
    setError(null);
    try {
      setResult(await loadSetupGuide());
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "AgentGuard setup wizard could not load."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadSetupGuide()
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "AgentGuard setup wizard could not load."
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

  const guide = result?.guide ?? null;
  const runbook = result?.runbook ?? null;
  const handoffPackage = result?.handoffPackage ?? null;

  async function copyRunbook() {
    if (!runbook) return;
    await navigator.clipboard.writeText(runbook.runbookText);
    setCopiedRunbook(true);
    window.setTimeout(() => setCopiedRunbook(false), 2000);
  }

  async function copyHandoffPackage() {
    if (!handoffPackage) return;
    await navigator.clipboard.writeText(handoffPackage.packageText);
    setCopiedHandoff(true);
    window.setTimeout(() => setCopiedHandoff(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            AgentGuard Enterprise Setup
          </h2>
          <p className="text-sm text-slate-500">
            Read-only setup path for enterprise-readiness work across sources,
            activity, policies, reviews, evidence, and export posture.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshSetup} disabled={loading}>
          Refresh
        </Button>
      </div>

      <AgentGuardNav />

      <AgentGuardWorkflowAssistPanel page="setup" />

      {error && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
        >
          {error}
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Building enterprise setup guidance...
          </CardContent>
        </Card>
      )}

      {guide && (
        <>
          <Card className="overflow-hidden border-[color:var(--brand)]/30">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Rocket className="h-4 w-4 text-[color:var(--brand)]" />
                    {AGENT_GUARD_ENTERPRISE_SETUP_COPY.title}
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {AGENT_GUARD_ENTERPRISE_SETUP_COPY.overview}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`w-fit ${STATUS_CLASSES[guide.status]}`}
                >
                  {guide.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-700">{guide.summary}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Setup progress
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    {guide.progress.completedSteps}/{guide.progress.totalSteps}
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-[color:var(--brand)]"
                    style={{ width: `${guide.progress.percent}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                {guide.boundary}
              </div>
            </CardContent>
          </Card>

          {handoffPackage && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <FileCheck2 className="h-4 w-4 text-[color:var(--brand)]" />
                      {AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.title}
                    </CardTitle>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {AGENT_GUARD_EVIDENCE_HANDOFF_PACKAGE_COPY.overview}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={HANDOFF_STATUS_CLASSES[handoffPackage.status]}
                    >
                      {handoffPackage.statusLabel}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={copyHandoffPackage}>
                      <Copy className="h-3.5 w-3.5" />
                      {copiedHandoff ? "Copied" : "Copy summary"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-700">
                  {handoffPackage.summary}
                </p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Artifacts
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {handoffPackage.metrics.totalArtifacts}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.green}`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES.green}`}
                    >
                      Ready
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {handoffPackage.metrics.readyArtifacts}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES.amber}`}
                    >
                      Caution
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {handoffPackage.metrics.cautionArtifacts}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES.red}`}
                    >
                      Gaps
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {handoffPackage.metrics.gapArtifacts}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {handoffPackage.artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {artifact.label}
                            </p>
                            <Badge
                              variant="outline"
                              className={HANDOFF_STATUS_CLASSES[artifact.status]}
                            >
                              {artifact.statusLabel}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {artifact.summary}
                          </p>
                        </div>
                        <Link
                          href={artifact.href}
                          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
                        >
                          {artifact.cta}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Evidence
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">
                            {artifact.evidence}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Guardrail
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">
                            {artifact.guardrail}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {handoffPackage.gaps.length > 0 && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm leading-6 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
                  >
                    {handoffPackage.gaps.slice(0, 5).map((gap) => (
                      <p key={gap}>{gap}</p>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  {handoffPackage.boundary}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
                Current next step
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`rounded-xl border p-4 ${STEP_CLASSES[guide.nextStep.status]}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${STEP_LABEL_CLASSES[guide.nextStep.status]}`}
                    >
                      <StepIcon status={guide.nextStep.status} />
                      {guide.nextStep.status.replace("_", " ")}
                    </div>
                    <h3 className="mt-3 text-lg font-bold">{guide.nextStep.label}</h3>
                    <p className="mt-2 text-sm leading-6">{guide.nextStep.detail}</p>
                    <p
                      className={`mt-2 text-xs leading-5 ${STEP_EVIDENCE_CLASSES[guide.nextStep.status]}`}
                    >
                      {guide.nextStep.evidence}
                    </p>
                  </div>
                  <Link
                    href={guide.nextStep.href}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--brand)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--focus)]"
                  >
                    {guide.nextStep.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {runbook && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
                      {AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.title}
                    </CardTitle>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {AGENT_GUARD_ENTERPRISE_RUNBOOK_COPY.overview}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_CLASSES[runbook.status]}
                    >
                      {runbook.statusLabel}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={copyRunbook}>
                      <Copy className="h-3.5 w-3.5" />
                      {copiedRunbook ? "Copied" : "Copy runbook"}
                    </Button>
                    <a
                      href="/api/agent-guard/implementation-checklist"
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] bg-[color:var(--brand)] px-2.5 text-[0.8rem] font-medium text-white transition-colors hover:bg-[color:var(--focus)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download checklist
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-700">
                  {runbook.summary}
                </p>
                <div className="rounded-lg border border-[color:var(--brand)]/40 bg-[color:var(--brand)]/10 px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Customer engineer checklist
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        Download a markdown handoff for customer-controlled
                        server-side source implementation. It uses placeholders
                        only and contains no source keys, signing secrets, raw
                        prompts, responses, files, messages, or customer data.
                      </p>
                    </div>
                    <a
                      href="/api/agent-guard/implementation-checklist"
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--brand)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--focus)]"
                    >
                      <Download className="h-4 w-4" />
                      Download checklist
                    </a>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Setup
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {runbook.metrics.setupCompletedSteps}/
                      {runbook.metrics.setupTotalSteps} steps
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Implementation
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {runbook.metrics.integrationEvidenceCount} records
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pilot ready
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {runbook.metrics.pilotReadyIntegrationEvidenceCount} records
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      SDK examples
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {runbook.metrics.sdkExampleCount}
                    </p>
                  </div>
                </div>
                {runbook.warnings.length > 0 && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm leading-6 ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
                  >
                    {runbook.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
                <pre className="max-h-[520px] overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  <code>{runbook.runbookText}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {guide.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className={`rounded-xl border p-4 transition-colors ${STEP_CLASSES[step.status]} ${STEP_HOVER_CLASSES[step.status]}`}
              >
                <div
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${STEP_LABEL_CLASSES[step.status]}`}
                >
                  <StepIcon status={step.status} />
                  {step.status.replace("_", " ")}
                </div>
                <h3 className="mt-3 font-semibold">{step.label}</h3>
                <p className="mt-2 text-sm leading-6">{step.detail}</p>
                <p className={`mt-2 text-xs leading-5 ${STEP_EVIDENCE_CLASSES[step.status]}`}>
                  {step.evidence}
                </p>
                <p
                  className={`mt-3 text-xs font-semibold uppercase tracking-wide ${STEP_LABEL_CLASSES[step.status]}`}
                >
                  {step.cta}
                </p>
              </Link>
            ))}
          </div>

          {guide.loadWarnings.length > 0 && (
            <Card className={AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}>
              <CardHeader>
                <CardTitle
                  className={`flex items-center gap-2 text-base font-semibold ${AGENT_GUARD_STATUS_LABEL_CLASSES.amber}`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Evidence loading notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm leading-6">
                  {guide.loadWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
