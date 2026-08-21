"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Compass, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentGuardNav } from "./agent-guard-nav";
import {
  AGENT_GUARD_ACTIVITY_SNIPPET,
  AGENT_GUARD_CURRENT_CAPABILITIES,
  AGENT_GUARD_NOT_SHIPPED_YET,
} from "@/lib/agent-guard/activity";
import {
  AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY,
  buildAgentGuardOperatorCommandCenter,
  type AgentGuardOperatorCommandCenter,
} from "@/lib/agent-guard/operator-command-center";
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
  AGENT_GUARD_PILOT_STATUS_TONES,
  AGENT_GUARD_STATUS_BADGE_CLASSES,
  AGENT_GUARD_STATUS_HOVER_CLASSES,
  AGENT_GUARD_STATUS_LABEL_CLASSES,
  AGENT_GUARD_STATUS_SURFACE_CLASSES,
} from "@/lib/agent-guard/status-theme";

interface Activity {
  id: string;
  toolName: string;
  userEmail: string;
  activityType: string;
  timestamp: string;
  riskLevel: string;
  blocked: boolean;
  dataClassification: {
    sensitivity: string;
    categories: string[];
    piiDetected: boolean;
    credentialsDetected: boolean;
  };
  source: {
    id: string;
    name: string;
    environment: string;
  } | null;
}

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

const RISK_COLORS: Record<string, string> = {
  critical: AGENT_GUARD_STATUS_BADGE_CLASSES.red,
  high: AGENT_GUARD_STATUS_BADGE_CLASSES.brand,
  medium: AGENT_GUARD_STATUS_BADGE_CLASSES.amber,
  low: AGENT_GUARD_STATUS_BADGE_CLASSES.green,
  none: AGENT_GUARD_STATUS_BADGE_CLASSES.slate,
};

const SENSITIVITY_COLORS: Record<string, string> = {
  restricted: "bg-red-500",
  confidential: "bg-orange-500",
  internal: "bg-yellow-500",
  public: "bg-green-500",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function fetchActivities(): Promise<Activity[]> {
  const response = await fetch("/api/agent-guard/activity");
  const data = await response.json();
  return data.activities || [];
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

async function loadCommandCenter(): Promise<AgentGuardOperatorCommandCenter> {
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

  return buildAgentGuardOperatorCommandCenter(report);
}

export default function AgentGuardPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandCenter, setCommandCenter] =
    useState<AgentGuardOperatorCommandCenter | null>(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(true);
  const [commandCenterError, setCommandCenterError] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshActivities(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      setActivities(await fetchActivities());
    } catch {
      // Keep the existing activity list if a refresh fails.
    } finally {
      setLoading(false);
    }
  }

  async function refreshCommandCenter(showSpinner = true) {
    if (showSpinner) setCommandCenterLoading(true);
    setCommandCenterError(null);
    try {
      setCommandCenter(await loadCommandCenter());
    } catch (err) {
      setCommandCenter(null);
      setCommandCenterError(
        err instanceof Error
          ? err.message
          : "AgentGuard command center could not load."
      );
    } finally {
      setCommandCenterLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchActivities()
      .then((nextActivities) => {
        if (active) setActivities(nextActivities);
      })
      .catch(() => {
        // Empty state is enough here; the dashboard can be refreshed.
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
    loadCommandCenter()
      .then((nextCommandCenter) => {
        if (active) setCommandCenter(nextCommandCenter);
      })
      .catch((err) => {
        if (active) {
          setCommandCenterError(
            err instanceof Error
              ? err.message
              : "AgentGuard command center could not load."
          );
        }
      })
      .finally(() => {
        if (active) setCommandCenterLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function seedDemoActivity() {
    setSeedingDemo(true);
    setNotice(null);
    try {
      const res = await fetch("/api/agent-guard/demo-activity", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message ?? data.error ?? "Demo activity could not be added.");
        return;
      }
      setNotice(`${data.seeded ?? 0} safe demo activities added.`);
      await refreshActivities(false);
      await refreshCommandCenter(false);
    } catch {
      setNotice("Demo activity could not be added.");
    } finally {
      setSeedingDemo(false);
    }
  }

  const stats = {
    total: activities.length,
    blocked: activities.filter((a) => a.blocked).length,
    critical: activities.filter((a) => a.riskLevel === "critical").length,
    high: activities.filter((a) => a.riskLevel === "high").length,
    pii: activities.filter((a) => a.dataClassification.piiDetected).length,
    creds: activities.filter((a) => a.dataClassification.credentialsDetected).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          AgentGuard
          <Badge variant="outline" className="border-[color:var(--brand)]/40 bg-[color:var(--brand)]/10 text-xs text-[color:var(--brand)]">
            PILOT
          </Badge>
        </h2>
        <p className="text-sm text-slate-500">
          Customer-controlled activity evaluation and policy decisions for AI events you submit.
        </p>
      </div>

      <AgentGuardNav
        leading={
          <Button
            variant="brand"
            size="sm"
            disabled={seedingDemo}
            onClick={seedDemoActivity}
            className="h-9 px-4"
          >
            {seedingDemo ? "Adding demo..." : "Load demo activity"}
          </Button>
        }
      />

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.amber}`}
        >
          {notice}
        </div>
      )}

      {commandCenterError && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${AGENT_GUARD_STATUS_SURFACE_CLASSES.red}`}
        >
          {commandCenterError}
        </div>
      )}

      {commandCenterLoading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Building AgentGuard operator command center...
          </CardContent>
        </Card>
      )}

      {commandCenter && (
        <Card className="overflow-hidden border-[color:var(--brand)]/30">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Compass className="h-4 w-4 text-[color:var(--brand)]" />
                  {AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY.title}
                </CardTitle>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {AGENT_GUARD_OPERATOR_COMMAND_CENTER_COPY.overview}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`w-fit ${AGENT_GUARD_STATUS_BADGE_CLASSES[AGENT_GUARD_PILOT_STATUS_TONES[commandCenter.status]]}`}
              >
                {commandCenter.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div
                className={`rounded-xl border p-4 ${AGENT_GUARD_STATUS_SURFACE_CLASSES[commandCenter.primaryAction.tone]}`}
              >
                <div
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[commandCenter.primaryAction.tone]}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Next action
                </div>
                <h3 className="mt-3 text-lg font-bold">
                  {commandCenter.primaryAction.label}
                </h3>
                <p className="mt-2 text-sm leading-6">
                  {commandCenter.primaryAction.detail}
                </p>
                <Link
                  href={commandCenter.primaryAction.href}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--brand)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--focus)]"
                >
                  {commandCenter.primaryAction.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {commandCenter.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className={`rounded-xl border p-3 ${AGENT_GUARD_STATUS_SURFACE_CLASSES[signal.tone]}`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[signal.tone]}`}
                    >
                      {signal.label}
                    </p>
                    <p className="mt-2 text-xl font-bold">{signal.value}</p>
                    <p className="mt-2 text-xs leading-5 opacity-80">
                      {signal.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {commandCenter.secondaryActions.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3">
                {commandCenter.secondaryActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={`rounded-xl border p-3 transition-colors ${AGENT_GUARD_STATUS_SURFACE_CLASSES[action.tone]} ${AGENT_GUARD_STATUS_HOVER_CLASSES[action.tone]}`}
                  >
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {action.detail}
                    </p>
                    <p
                      className={`mt-2 text-xs font-semibold uppercase tracking-wide ${AGENT_GUARD_STATUS_LABEL_CLASSES[action.tone]}`}
                    >
                      {action.cta}
                    </p>
                  </Link>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              {commandCenter.boundary}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              What AgentGuard can back up today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              {AGENT_GUARD_CURRENT_CAPABILITIES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Current pilot boundaries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              {AGENT_GUARD_NOT_SHIPPED_YET.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Send activity to AgentGuard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600">
            Today, activity must be submitted by your app, wrapper, or internal
            integration. The endpoint classifies content in memory, stores
            metadata and content length, and returns the policy decision.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            <code>{AGENT_GUARD_ACTIVITY_SNIPPET}</code>
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Submitted Activities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
            <p className="text-xs text-slate-500">Policy Blocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            <p className="text-xs text-slate-500">Critical Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
            <p className="text-xs text-slate-500">High Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-600">{stats.pii}</p>
            <p className="text-xs text-slate-500">PII Signals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{stats.creds}</p>
            <p className="text-xs text-slate-500">Credential Signals</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : activities.length === 0 ? (
            <div className="space-y-3 py-8 text-center text-sm text-slate-500">
              <p>
                No activities recorded yet. Submit activity through the ingest
                API or load safe demo activity to review the pilot workflow.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={seedingDemo}
                onClick={seedDemoActivity}
              >
                {seedingDemo ? "Adding demo..." : "Load safe demo activity"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="mt-1 shrink-0">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${SENSITIVITY_COLORS[activity.dataClassification.sensitivity]}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {activity.toolName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${RISK_COLORS[activity.riskLevel]}`}
                      >
                        {activity.riskLevel}
                      </Badge>
                      {activity.blocked && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${AGENT_GUARD_STATUS_BADGE_CLASSES.red}`}
                        >
                          BLOCKED
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">
                        {activity.activityType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{activity.userEmail}</span>
                      <span>-</span>
                      <span>{timeAgo(activity.timestamp)}</span>
                      {activity.dataClassification.categories.length > 0 && (
                        <>
                          <span>-</span>
                          <span className="text-amber-600">
                            {activity.dataClassification.categories.join(", ")}
                          </span>
                        </>
                      )}
                      {activity.source && (
                        <>
                          <span>-</span>
                          <span>{activity.source.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {activity.dataClassification.piiDetected && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${AGENT_GUARD_STATUS_BADGE_CLASSES.amber}`}
                      >
                        PII
                      </Badge>
                    )}
                    {activity.dataClassification.credentialsDetected && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${AGENT_GUARD_STATUS_BADGE_CLASSES.red}`}
                      >
                        CREDS
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
