"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  History,
  KeyRound,
  PlugZap,
  RotateCcw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentGuardNav } from "../agent-guard-nav";
import { AgentGuardWorkflowAssistPanel } from "../workflow-assist-panel";
import { IntegrationDiagnosticsPanel } from "./integration-diagnostics-panel";
import { IntegrationEvidencePanel } from "./integration-evidence-panel";
import { SdkStarterKitPanel } from "./sdk-starter-kit-panel";
import { SourceKeyLifecyclePanel } from "./source-key-lifecycle-panel";
import {
  AGENT_GUARD_INTEGRATION_EXAMPLES,
  agentGuardSourceHealth,
  deriveAgentGuardChecklistState,
  type AgentGuardIntegrationExampleId,
  type AgentGuardSourceHealth,
  type AgentGuardTestResultStatus,
} from "@/lib/agent-guard/integration-kit";
import {
  AGENT_GUARD_QUIET_SOURCE_NOTES,
  groupAgentGuardActivityBySource,
  type AgentGuardSourceActivity,
  type AgentGuardSourceRiskLevel,
} from "@/lib/agent-guard/source-activity";
import { agentIngestSourceRotationPosture } from "@/lib/agent-guard/source-key-posture";
import {
  AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY,
  buildAgentGuardSourcePolicyCoverage,
  type AgentGuardSourceCoverageReview,
  type AgentGuardSourceCoverageStatus,
} from "@/lib/agent-guard/source-policy-coverage";
import {
  AGENT_GUARD_PRODUCTION_ROLLOUT_COPY,
  buildAgentGuardProductionRolloutGuardrails,
  type AgentGuardProductionRolloutChecklistStatus,
  type AgentGuardProductionRolloutExportDestination,
  type AgentGuardProductionRolloutSourceRow,
  type AgentGuardProductionRolloutStatus,
} from "@/lib/agent-guard/production-rollout";
import {
  AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY,
  latestRolloutAcknowledgementBySource,
  type AgentGuardRolloutAcknowledgement,
} from "@/lib/agent-guard/rollout-acknowledgements";

type IngestSource = {
  id: string;
  name: string;
  environment: "production" | "staging" | "development" | "other";
  status: "active" | "revoked";
  tokenHint: string;
  allowedToolNames: string[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
};

const STATUS_CLASSES: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  revoked: "border-slate-200 bg-slate-100 text-slate-600",
};

const HEALTH_CLASSES: Record<AgentGuardSourceHealth["tone"], string> = {
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
};

const ROTATION_TONE_CLASSES = {
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

const TEST_RESULT_CLASSES: Record<AgentGuardTestResultStatus, string> = {
  accepted: "border-green-200 bg-green-50 text-green-900",
  blocked: "border-amber-200 bg-amber-50 text-amber-900",
  failed: "border-red-200 bg-red-50 text-red-900",
};

const COVERAGE_STATUS_CLASSES: Record<AgentGuardSourceCoverageStatus, string> = {
  covered: "border-green-200 bg-green-50 text-green-700",
  needs_policy_scope: "border-amber-200 bg-amber-50 text-amber-800",
  test_or_demo: "border-blue-200 bg-blue-50 text-blue-700",
  quiet: "border-slate-200 bg-slate-100 text-slate-600",
  revoked: "border-slate-200 bg-slate-100 text-slate-500",
  unknown_source: "border-red-200 bg-red-50 text-red-700",
};

const ROLLOUT_STATUS_CLASSES: Record<AgentGuardProductionRolloutStatus, string> = {
  testing: "border-blue-200 bg-blue-50 text-blue-700",
  ready_for_pilot: "border-green-200 bg-green-50 text-green-700",
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  live_caution: "border-red-200 bg-red-50 text-red-700",
};

const CHECKLIST_STATUS_CLASSES: Record<AgentGuardProductionRolloutChecklistStatus, string> = {
  pass: "border-green-200 bg-green-50 text-green-700",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

type TestEventResult = {
  status: AgentGuardTestResultStatus;
  sourceId: string | null;
  activityId: string | null;
  riskLevel: string | null;
  reason: string;
  httpStatus: number | null;
  timestamp: string;
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

type RolloutAcknowledgementLoadResult = {
  acknowledgements: AgentGuardRolloutAcknowledgement[];
  warning: string | null;
};

const RISK_CLASSES: Record<AgentGuardSourceRiskLevel, string> = {
  none: "border-slate-200 bg-slate-50 text-slate-600",
  low: "border-blue-200 bg-blue-50 text-blue-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  critical: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function riskClass(value: string): string {
  return value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
    ? RISK_CLASSES[value]
    : RISK_CLASSES.none;
}

async function loadSources(): Promise<IngestSource[]> {
  const response = await fetch("/api/agent-guard/ingest-sources");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Could not load ingest sources.");
  }
  return data.sources ?? [];
}

async function loadRecentActivity(): Promise<AgentGuardSourceActivity[]> {
  const response = await fetch("/api/agent-guard/activity?limit=500");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Could not load recent AgentGuard activity.");
  }
  return data.activities ?? [];
}

async function loadPolicyReviewsForCoverage(): Promise<{
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
    throw new Error(data.message ?? data.error ?? "Could not load policy review coverage.");
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

async function loadExportDestinationsForRollout(): Promise<{
  destinations: AgentGuardProductionRolloutExportDestination[];
  warning: string | null;
}> {
  try {
    const response = await fetch("/api/agent-guard/export-destinations");
    const data = await response.json();
    if (!response.ok) {
      return {
        destinations: [],
        warning:
          data.message ??
          data.error ??
          "Export destination posture could not be loaded for rollout guardrails.",
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
  } catch {
    return {
      destinations: [],
      warning: "Export destination posture could not be loaded for rollout guardrails.",
    };
  }
}

async function loadRolloutAcknowledgements(): Promise<RolloutAcknowledgementLoadResult> {
  const response = await fetch("/api/agent-guard/rollout-acknowledgements?limit=25");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        acknowledgements: [],
        warning:
          data.message ??
          AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.migrationWarning,
      };
    }
    throw new Error(
      data.message ?? data.error ?? "Could not load rollout acknowledgements."
    );
  }
  return {
    acknowledgements: data.acknowledgements ?? [],
    warning: null,
  };
}

export default function AgentGuardIngestionPage() {
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [recentActivity, setRecentActivity] = useState<AgentGuardSourceActivity[]>([]);
  const [policyReviews, setPolicyReviews] = useState<AgentGuardSourceCoverageReview[]>([]);
  const [exportDestinations, setExportDestinations] = useState<
    AgentGuardProductionRolloutExportDestination[]
  >([]);
  const [rolloutAcknowledgements, setRolloutAcknowledgements] = useState<
    AgentGuardRolloutAcknowledgement[]
  >([]);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [rolloutWarning, setRolloutWarning] = useState<string | null>(null);
  const [acknowledgementWarning, setAcknowledgementWarning] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acknowledgingSourceId, setAcknowledgingSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newSourceKey, setNewSourceKey] = useState<string | null>(null);
  const [newSourceId, setNewSourceId] = useState<string | null>(null);
  const [copiedSourceKey, setCopiedSourceKey] = useState(false);
  const [copiedExampleId, setCopiedExampleId] = useState<AgentGuardIntegrationExampleId | null>(null);
  const [testSourceKey, setTestSourceKey] = useState("");
  const [lastTestResult, setLastTestResult] = useState<TestEventResult | null>(null);
  const [sendingTestEvent, setSendingTestEvent] = useState(false);
  const [selectedExampleId, setSelectedExampleId] =
    useState<AgentGuardIntegrationExampleId>("generic-fetch");
  const [name, setName] = useState("Server-side wrapper");
  const [environment, setEnvironment] = useState<IngestSource["environment"]>("production");
  const [allowedTools, setAllowedTools] = useState("");
  const [acknowledgementNotes, setAcknowledgementNotes] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let active = true;
    Promise.all([
      loadSources(),
      loadRecentActivity(),
      loadPolicyReviewsForCoverage(),
      loadExportDestinationsForRollout(),
      loadRolloutAcknowledgements(),
    ])
      .then(([
        nextSources,
        nextActivity,
        reviewResult,
        exportResult,
        acknowledgementResult,
      ]) => {
        if (!active) return;
        setSources(nextSources);
        setRecentActivity(nextActivity);
        setPolicyReviews(reviewResult.reviews);
        setExportDestinations(exportResult.destinations);
        setRolloutAcknowledgements(acknowledgementResult.acknowledgements);
        setCoverageWarning(reviewResult.warning);
        setRolloutWarning(exportResult.warning);
        setAcknowledgementWarning(acknowledgementResult.warning);
      })
      .catch((err) => {
        if (active) {
          setNotice(
            err instanceof Error
              ? err.message
              : "Could not load AgentGuard ingestion data."
          );
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createSource() {
    setCreating(true);
    setNotice(null);
    setNewSourceKey(null);
    setNewSourceId(null);
    setCopiedSourceKey(false);
    const toolNames = allowedTools
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/agent-guard/ingest-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          environment,
          allowedToolNames: toolNames,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? data.error ?? "Could not create source key.");
        return;
      }
      setNewSourceKey(data.sourceKey);
      setNewSourceId(data.source?.id ?? null);
      setTestSourceKey(data.sourceKey);
      setNotice(`Created ${data.source?.name ?? "ingest source"}. Store the key now; it will not be shown again.`);
      setSources((current) => [data.source, ...current]);
      setName("Server-side wrapper");
      setAllowedTools("");
    } catch {
      setNotice("Could not create source key.");
    } finally {
      setCreating(false);
    }
  }

  async function copySourceKey() {
    if (!newSourceKey) return;
    try {
      await navigator.clipboard.writeText(newSourceKey);
      setCopiedSourceKey(true);
      setNotice("Source key copied. Store it in a server-side secret manager or environment variable.");
      window.setTimeout(() => setCopiedSourceKey(false), 2000);
    } catch {
      setNotice("Copy failed. Select the source key text and copy it manually.");
    }
  }

  async function copyExample(code: string, exampleId: AgentGuardIntegrationExampleId) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedExampleId(exampleId);
      setNotice("Integration example copied.");
      window.setTimeout(() => setCopiedExampleId(null), 2000);
    } catch {
      setNotice("Copy failed. Select the example text and copy it manually.");
    }
  }

  async function sendTestEvent() {
    const token = testSourceKey.trim();
    if (!token) {
      setNotice("Paste a source key or create a new source before sending a test event.");
      return;
    }

    setSendingTestEvent(true);
    setNotice(null);
    const resultSourceId = newSourceKey && token === newSourceKey ? newSourceId : null;
    try {
      const response = await fetch("/api/agent-guard/activity", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toolName: "ChatGPT",
          userEmail: "analyst@example.test",
          activityType: "prompt_sent",
          content: "This is a safe AgentGuard test event. No sensitive data.",
          metadata: {
            source: "dashboard-ingestion-test",
            requestId: `test-${Date.now()}`,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLastTestResult({
          status: "failed",
          sourceId: resultSourceId,
          activityId: null,
          riskLevel: null,
          reason: data.message ?? data.error ?? "Test event could not be sent.",
          httpStatus: response.status,
          timestamp: new Date().toISOString(),
        });
        setNotice(data.message ?? data.error ?? "Test event could not be sent.");
        return;
      }
      setLastTestResult({
        status: data.blocked ? "blocked" : "accepted",
        sourceId: resultSourceId,
        activityId: data.id ?? null,
        riskLevel: data.riskLevel ?? null,
        reason: data.reason ?? "No blocking policy matched.",
        httpStatus: response.status,
        timestamp: new Date().toISOString(),
      });
      setNotice(
        `Test event accepted. Activity ${data.id ?? "was saved"} returned risk ${data.riskLevel ?? "unknown"}.`
      );
      const [nextSources, nextActivity] = await Promise.all([
        loadSources(),
        loadRecentActivity(),
      ]);
      setSources(nextSources);
      setRecentActivity(nextActivity);
      try {
        const [reviewResult, exportResult] = await Promise.all([
          loadPolicyReviewsForCoverage(),
          loadExportDestinationsForRollout(),
        ]);
        setPolicyReviews(reviewResult.reviews);
        setExportDestinations(exportResult.destinations);
        setCoverageWarning(reviewResult.warning);
        setRolloutWarning(exportResult.warning);
      } catch {
        setCoverageWarning(AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY.reviewMigrationWarning);
      }
    } catch {
      setLastTestResult({
        status: "failed",
        sourceId: resultSourceId,
        activityId: null,
        riskLevel: null,
        reason: "Network or server error while sending the test event.",
        httpStatus: null,
        timestamp: new Date().toISOString(),
      });
      setNotice("Test event could not be sent.");
    } finally {
      setSendingTestEvent(false);
    }
  }

  async function revokeSource(source: IngestSource) {
    const ok = window.confirm(`Revoke ${source.name}? Existing integrations using this key will stop ingesting.`);
    if (!ok) return;
    setNotice(null);
    try {
      const response = await fetch(`/api/agent-guard/ingest-sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? data.error ?? "Could not revoke source key.");
        return;
      }
      setSources((current) =>
        current.map((item) => (item.id === source.id ? data.source : item))
      );
      setNotice(`Revoked ${data.source?.name ?? source.name}.`);
    } catch {
      setNotice("Could not revoke source key.");
    }
  }

  const activeSources = sources.filter((source) => source.status === "active").length;
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const selectedExample =
    AGENT_GUARD_INTEGRATION_EXAMPLES.find((example) => example.id === selectedExampleId) ??
    AGENT_GUARD_INTEGRATION_EXAMPLES[0];
  const sourceActivityGroups = groupAgentGuardActivityBySource(recentActivity, 4);
  const sourcePolicyCoverage = useMemo(
    () =>
      buildAgentGuardSourcePolicyCoverage({
        sources,
        activities: recentActivity,
        reviews: policyReviews,
      }),
    [sources, recentActivity, policyReviews]
  );
  const coverageCards = [
    {
      label: "Sources with activity",
      value: sourcePolicyCoverage.summary.recentActivitySourceCount,
    },
    {
      label: "Sources with outcomes",
      value: sourcePolicyCoverage.summary.policyOutcomeSourceCount,
    },
    {
      label: "Need policy scope",
      value: sourcePolicyCoverage.summary.needsPolicyScopeCount,
    },
    {
      label: "Needs-action reviews",
      value: sourcePolicyCoverage.summary.needsActionReviewCount,
    },
  ];
  const rolloutGuardrails = useMemo(
    () =>
      buildAgentGuardProductionRolloutGuardrails({
        sources,
        coverageRows: sourcePolicyCoverage.rows,
        exportDestinations,
      }),
    [sources, sourcePolicyCoverage.rows, exportDestinations]
  );
  const rolloutCards = [
    {
      label: "Rollout status",
      value: rolloutGuardrails.label,
    },
    {
      label: "Active sources",
      value: rolloutGuardrails.metrics.activeSourceCount,
    },
    {
      label: "Needs-review sources",
      value: rolloutGuardrails.metrics.needsReviewSourceCount,
    },
    {
      label: "Export posture",
      value: rolloutGuardrails.exportPostureLabel,
    },
  ];
  const latestAcknowledgementBySource = useMemo(
    () => latestRolloutAcknowledgementBySource(rolloutAcknowledgements),
    [rolloutAcknowledgements]
  );

  async function acknowledgeRolloutSource(
    row: AgentGuardProductionRolloutSourceRow
  ) {
    const source = sourceById.get(row.sourceId);
    if (!source) {
      setNotice("Only configured source rows can be acknowledged.");
      return;
    }

    setAcknowledgingSourceId(row.sourceId);
    setNotice(null);
    try {
      const response = await fetch("/api/agent-guard/rollout-acknowledgements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id,
          sourceName: source.name,
          sourceEnvironment: source.environment,
          sourceStatus: source.status,
          sourceRolloutStatus: row.status,
          sourceRolloutLabel: row.label,
          sourceNextStep: row.nextStep,
          overallRolloutStatus: rolloutGuardrails.status,
          overallRolloutLabel: rolloutGuardrails.label,
          exportPostureLabel: rolloutGuardrails.exportPostureLabel,
          exportWarning: rolloutWarning ?? rolloutGuardrails.exportWarning,
          checklistSnapshot: rolloutGuardrails.checklist,
          metricsSnapshot: rolloutGuardrails.metrics,
          note: acknowledgementNotes[row.sourceId] ?? "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "migration_required") {
          setAcknowledgementWarning(
            data.message ??
              AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.migrationWarning
          );
          setNotice(
            "Verify that the current initial schema is installed before recording acknowledgements."
          );
          return;
        }
        setNotice(
          data.message ?? data.error ?? "Could not record rollout acknowledgement."
        );
        return;
      }
      setRolloutAcknowledgements((current) => [
        data.acknowledgement,
        ...current.filter((item) => item.id !== data.acknowledgement.id),
      ]);
      setAcknowledgementNotes((current) => ({
        ...current,
        [row.sourceId]: "",
      }));
      setAcknowledgementWarning(null);
      setNotice(`Recorded rollout acknowledgement for ${source.name}.`);
    } catch {
      setNotice("Could not record rollout acknowledgement.");
    } finally {
      setAcknowledgingSourceId(null);
    }
  }

  const checklist = deriveAgentGuardChecklistState({
    sources,
    hasVisibleSourceKey: Boolean(newSourceKey),
    testResult: lastTestResult,
  });
  const completedChecklistItems = checklist.filter((item) => item.completed).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AgentGuard Ingestion</h2>
        <p className="text-sm text-slate-500">
          Create scoped source keys for customer-controlled systems that submit activity to AgentGuard.
        </p>
      </div>

      <AgentGuardNav />

      <AgentGuardWorkflowAssistPanel page="ingestion" />

      {notice && (
        <div className="sg-status-surface sg-status-surface-amber rounded-lg border px-4 py-3 text-sm text-foreground/85">
          {notice}
        </div>
      )}

      {newSourceKey && (
        <Card className="sg-status-surface sg-status-surface-green">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <KeyRound className="h-4 w-4" />
              New source key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm leading-6 text-foreground/85">
              This key is shown once. Store it in a server-side environment variable such as
              `AGENTGUARD_INGEST_TOKEN`; do not place it in browser code.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="brand" size="sm" onClick={copySourceKey}>
                {copiedSourceKey ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedSourceKey ? "Copied" : "Copy source key"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={sendingTestEvent}
                onClick={sendTestEvent}
              >
                {sendingTestEvent ? "Sending..." : "Send test event"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-green-200 bg-slate-950 p-4 text-xs text-slate-100">
              <code>{newSourceKey}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
            First source checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-6 text-slate-600">
              Connect one trusted server-side source, send a safe test event, then tighten the source to known tool names when practical.
            </p>
            <Badge variant="outline" className="bg-slate-50 text-xs text-slate-600">
              {completedChecklistItems}/{checklist.length} ready
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {checklist.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-slate-300" />
                  )}
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                </div>
                <p className="text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PlugZap className="h-4 w-4 text-[color:var(--brand)]" />
              Create source key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Source name</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Server-side wrapper"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Environment</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as IngestSource["environment"])
                  }
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">
                  Allowed tools, optional comma-separated scope
                </span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={allowedTools}
                  onChange={(event) => setAllowedTools(event.target.value)}
                  placeholder="ChatGPT, GitHub Copilot"
                />
                <span className="block text-xs text-slate-500">
                  Use exact tool names when this wrapper only handles known systems. Leave blank only for a trusted source that may submit any named AI tool.
                </span>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="brand"
                disabled={creating || name.trim().length === 0}
                onClick={createSource}
              >
                {creating ? "Creating..." : "Create source key"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Source posture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-2xl font-bold text-slate-900">{sources.length}</p>
                <p className="text-xs text-slate-500">Total sources</p>
              </div>
              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-700">{activeSources}</p>
                <p className="text-xs text-green-700">Active</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Source keys are for server-side systems only. Revocation is immediate for future ingest
              requests, and old activity rows keep their source attribution.
            </p>
            <div className="mt-4 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  Test source key
                </span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="password"
                  value={testSourceKey}
                  onChange={(event) => setTestSourceKey(event.target.value)}
                  placeholder="Paste a source key to test"
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={sendingTestEvent || testSourceKey.trim().length === 0}
                onClick={sendTestEvent}
              >
                {sendingTestEvent ? "Sending test..." : "Send test event"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                Sends a safe sample event through the bearer-token path and refreshes last-used metadata.
              </p>
            </div>
            {lastTestResult && (
              <div
                className={`mt-4 rounded-lg border p-3 text-sm ${TEST_RESULT_CLASSES[lastTestResult.status]}`}
              >
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  {lastTestResult.status === "failed" ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>
                    {lastTestResult.status === "blocked"
                      ? "Test accepted, policy blocked"
                      : lastTestResult.status === "accepted"
                        ? "Test accepted"
                        : "Test failed"}
                  </span>
                </div>
                <div className="space-y-1 text-xs leading-5">
                  {lastTestResult.activityId && (
                    <p>Activity ID: {lastTestResult.activityId}</p>
                  )}
                  {lastTestResult.riskLevel && (
                    <p>Risk: {lastTestResult.riskLevel}</p>
                  )}
                  {lastTestResult.httpStatus && (
                    <p>HTTP status: {lastTestResult.httpStatus}</p>
                  )}
                  <p>{lastTestResult.reason}</p>
                  <p className="opacity-75">Checked {formatDate(lastTestResult.timestamp)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <IntegrationDiagnosticsPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldAlert className="h-4 w-4 text-[color:var(--brand)]" />
            Source-to-policy coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY.overview}
            </p>
            <Badge variant="outline" className="w-fit bg-slate-50 text-xs text-slate-600">
              Latest loaded window
            </Badge>
          </div>

          {coverageWarning && (
            <div className="sg-status-surface sg-status-surface-amber mt-4 flex gap-2 rounded-lg border px-4 py-3 text-sm text-foreground/85">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{coverageWarning}</span>
            </div>
          )}

          {sourcePolicyCoverage.summary.unattributedReviewOutcomeCount > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {sourcePolicyCoverage.summary.unattributedReviewOutcomeCount} review outcome
              {sourcePolicyCoverage.summary.unattributedReviewOutcomeCount === 1 ? "" : "s"} could
              not be tied to a loaded source-attributed activity row, so they are not counted in source coverage.
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {coverageCards.map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            ))}
          </div>

          {loading || activityLoading ? (
            <div className="mt-5 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : sourcePolicyCoverage.rows.length === 0 ? (
            <p className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No source coverage yet. Create a source key and send a test event to begin coverage guidance.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {sourcePolicyCoverage.rows.map((row) => (
                <div key={row.sourceId} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {row.sourceName}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${COVERAGE_STATUS_CLASSES[row.coverageStatus]}`}
                        >
                          {row.coverageLabel}
                        </Badge>
                        <Badge variant="outline" className="bg-slate-50 text-xs text-slate-600">
                          {row.sourceEnvironment}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            row.sourceStatus === "active"
                              ? STATUS_CLASSES.active
                              : row.sourceStatus === "revoked"
                                ? STATUS_CLASSES.revoked
                                : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.sourceStatus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {row.guidance}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>Last signal {formatDate(row.latestSignalAt)}</span>
                        <span>Last activity {formatDate(row.latestActivityAt)}</span>
                        <span>Last outcome {formatDate(row.latestOutcomeAt)}</span>
                        {row.topTools.length > 0 && (
                          <span>Top tools: {row.topTools.join(", ")}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid min-w-full gap-2 sm:grid-cols-3 xl:min-w-[520px] xl:grid-cols-6">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.recentActivityCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Activity</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.policyOutcomeCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Outcomes</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.blockOutcomeCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Blocks</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.needsActionReviewCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Needs action</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.uniqueToolCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Tools</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-base font-bold text-slate-900">
                          {row.uniqueUserCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Users</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Rocket className="h-4 w-4 text-[color:var(--brand)]" />
            Production rollout guardrails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                {AGENT_GUARD_PRODUCTION_ROLLOUT_COPY.overview}
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                {AGENT_GUARD_PRODUCTION_ROLLOUT_COPY.noAutomaticPromotion}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`w-fit text-xs ${ROLLOUT_STATUS_CLASSES[rolloutGuardrails.status]}`}
            >
              {rolloutGuardrails.label}
            </Badge>
          </div>

          {(rolloutWarning || rolloutGuardrails.exportWarning) && (
            <div className="sg-status-surface sg-status-surface-amber mt-4 flex gap-2 rounded-lg border px-4 py-3 text-sm text-foreground/85">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{rolloutWarning ?? rolloutGuardrails.exportWarning}</span>
            </div>
          )}

          {acknowledgementWarning && (
            <div className="sg-status-surface sg-status-surface-amber mt-4 flex gap-2 rounded-lg border px-4 py-3 text-sm text-foreground/85">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{acknowledgementWarning}</span>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {rolloutCards.map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {rolloutGuardrails.summary}
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rolloutGuardrails.checklist.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2">
                  {item.status === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : item.status === "blocked" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[10px] ${CHECKLIST_STATUS_CLASSES[item.status]}`}
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-slate-500">{item.summary}</p>
              </div>
            ))}
          </div>

          {rolloutGuardrails.sourceRows.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Source rollout guidance
              </p>
              {rolloutGuardrails.sourceRows.map((row) => {
                const latestAcknowledgement =
                  latestAcknowledgementBySource.get(row.sourceId);
                const configuredSource = sourceById.get(row.sourceId);
                const postureChanged =
                  latestAcknowledgement &&
                  (latestAcknowledgement.sourceRolloutStatus !== row.status ||
                    latestAcknowledgement.overallRolloutStatus !==
                      rolloutGuardrails.status ||
                    latestAcknowledgement.exportPostureLabel !==
                      rolloutGuardrails.exportPostureLabel);
                return (
                  <div
                    key={row.sourceId}
                    className="rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {row.sourceName}
                          </p>
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-xs text-slate-600"
                          >
                            {row.environment}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${ROLLOUT_STATUS_CLASSES[row.status]}`}
                          >
                            {row.label}
                          </Badge>
                          {latestAcknowledgement && (
                            <Badge
                              variant="outline"
                              className="border-green-200 bg-green-50 text-xs text-green-700"
                            >
                              Acknowledged {formatDate(latestAcknowledgement.createdAt)}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {row.nextStep}
                        </p>
                      </div>
                    </div>

                    {latestAcknowledgement && (
                      <div className="sg-status-surface sg-status-surface-green mt-3 rounded-lg border px-3 py-2 text-xs leading-5 text-foreground/85">
                        <p className="font-semibold">
                          Reviewed by{" "}
                          {latestAcknowledgement.acknowledgedByEmail ?? "operator"} ·
                          accepted {latestAcknowledgement.sourceRolloutLabel} with{" "}
                          {latestAcknowledgement.exportPostureLabel}
                        </p>
                        {postureChanged && (
                          <p className="mt-1 text-muted-foreground">
                            Current posture has changed since this acknowledgement; use it
                            as historical evidence.
                          </p>
                        )}
                        {latestAcknowledgement.note && (
                          <p className="mt-1 text-muted-foreground">
                            Note: {latestAcknowledgement.note}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-end">
                      <label className="text-xs font-semibold text-slate-700">
                        Operator note
                        <textarea
                          value={acknowledgementNotes[row.sourceId] ?? ""}
                          maxLength={1500}
                          onChange={(event) =>
                            setAcknowledgementNotes((current) => ({
                              ...current,
                              [row.sourceId]: event.target.value,
                            }))
                          }
                          disabled={!configuredSource || Boolean(acknowledgementWarning)}
                          placeholder="Optional note before recording this rollout review."
                          className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-[color:var(--brand)] disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !configuredSource ||
                          Boolean(acknowledgementWarning) ||
                          acknowledgingSourceId === row.sourceId
                        }
                        onClick={() => acknowledgeRolloutSource(row)}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {acknowledgingSourceId === row.sourceId
                          ? "Recording"
                          : "Acknowledge"}
                      </Button>
                    </div>
                    {!configuredSource && (
                      <p className="mt-2 text-xs text-amber-700">
                        Historical or unknown source rows cannot be acknowledged until
                        they exist in the source catalog.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
              <p className="text-sm font-semibold text-slate-900">
                Rollout acknowledgements
              </p>
            </div>
            <p className="max-w-3xl text-xs leading-5 text-slate-500">
              {AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.overview}{" "}
              {AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.noAutomaticChange}
            </p>
            {rolloutAcknowledgements.length === 0 ? (
              <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No rollout acknowledgements recorded yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {rolloutAcknowledgements.slice(0, 5).map((acknowledgement) => (
                  <div
                    key={acknowledgement.id}
                    className="rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {acknowledgement.sourceName}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${ROLLOUT_STATUS_CLASSES[acknowledgement.sourceRolloutStatus]}`}
                      >
                        {acknowledgement.sourceRolloutLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-xs text-slate-600"
                      >
                        {acknowledgement.exportPostureLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Reviewed by{" "}
                      {acknowledgement.acknowledgedByEmail ?? "operator"} ·{" "}
                      {formatDate(acknowledgement.createdAt)}
                    </p>
                    {acknowledgement.note && (
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {acknowledgement.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No source keys yet. Create one for a trusted server-side wrapper or internal integration.
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const health = agentGuardSourceHealth(source, lastTestResult);
                const rotation = agentIngestSourceRotationPosture({
                  createdAt: source.createdAt,
                  status: source.status,
                });
                const sourceActivity = sourceActivityGroups.get(source.id);
                const summary = sourceActivity?.summary;
                return (
                  <div key={source.id} className="rounded-lg border border-slate-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{source.name}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_CLASSES[source.status]}`}
                          >
                            {source.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${HEALTH_CLASSES[health.tone]}`}
                          >
                            {health.label}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-50 text-xs text-slate-600">
                            {source.environment}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${ROTATION_TONE_CLASSES[rotation.tone]}`}
                          >
                            {rotation.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Key {source.tokenHint} · last used {formatDate(source.lastUsedAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Rotation:{" "}
                          {rotation.daysOld === null
                            ? "age unknown"
                            : `${rotation.daysOld} days old`}
                          {rotation.dueAt ? ` · advisory due ${formatDate(rotation.dueAt)}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Scope: {source.allowedToolNames.length > 0
                            ? source.allowedToolNames.join(", ")
                            : "any submitted tool name"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{health.description}</p>
                        <p className="mt-1 text-xs text-slate-500">{rotation.description}</p>
                      </div>
                      {source.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeSource(source)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-[color:var(--brand)]" />
                          <p className="text-sm font-semibold text-slate-900">
                            Recent submitted activity
                          </p>
                        </div>
                        {summary && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${riskClass(summary.highestRisk)}`}
                          >
                            Highest risk: {summary.highestRisk}
                          </Badge>
                        )}
                      </div>

                      {activityLoading ? (
                        <p className="text-sm text-slate-500">Loading recent activity...</p>
                      ) : summary ? (
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <p className="text-base font-bold text-slate-900">
                                {summary.eventCount}
                              </p>
                              <p className="text-[11px] text-slate-500">Recent events</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <p className="text-base font-bold text-slate-900">
                                {summary.uniqueUserCount}
                              </p>
                              <p className="text-[11px] text-slate-500">Users</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <p className="text-base font-bold text-slate-900">
                                {summary.blockedCount}
                              </p>
                              <p className="text-[11px] text-slate-500">Blocked</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <p className="text-base font-bold capitalize text-slate-900">
                                {summary.highestRisk}
                              </p>
                              <p className="text-[11px] text-slate-500">Highest risk</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <p className="text-base font-bold text-slate-900">
                                {formatDate(summary.lastActivityAt)}
                              </p>
                              <p className="text-[11px] text-slate-500">Last activity</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {summary.recentActivities.map((activity) => (
                              <div
                                key={activity.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-slate-900">
                                      {activity.toolName}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${riskClass(activity.riskLevel)}`}
                                    >
                                      {activity.riskLevel}
                                    </Badge>
                                    {activity.blocked && (
                                      <Badge
                                        variant="outline"
                                        className="border-red-200 bg-red-50 text-xs text-red-700"
                                      >
                                        blocked
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {activity.activityType} · {activity.userEmail} ·{" "}
                                    {formatDate(activity.timestamp)}
                                  </p>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {activity.id}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="sg-status-surface sg-status-surface-amber rounded-lg border p-3">
                          <p className="text-sm font-semibold text-foreground">
                            No recent activity attributed to this source.
                          </p>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-foreground/85">
                            {AGENT_GUARD_QUIET_SOURCE_NOTES.map((note) => (
                              <li key={note} className="flex gap-2">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--warning)]" />
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SourceKeyLifecyclePanel sources={sources} />

      <SdkStarterKitPanel />

      <IntegrationEvidencePanel sources={sources} />

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Code2 className="h-4 w-4 text-[color:var(--brand)]" />
              Integration examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm leading-6 text-slate-600">
              Use bearer source keys from trusted server-side code. Keep the key out of browser code and submit only the activity fields needed for classification and policy decisions.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {AGENT_GUARD_INTEGRATION_EXAMPLES.map((example) => (
                <Button
                  key={example.id}
                  variant={example.id === selectedExampleId ? "brand" : "outline"}
                  size="sm"
                  onClick={() => setSelectedExampleId(example.id)}
                >
                  {example.label}
                </Button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm leading-6 text-slate-600">{selectedExample.description}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyExample(selectedExample.code, selectedExample.id)}
              >
                {copiedExampleId === selectedExample.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedExampleId === selectedExample.id ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-[420px] overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{selectedExample.code}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
