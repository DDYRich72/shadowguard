"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_TYPE_OPTIONS,
  DEFAULT_POLICY_TEST_SAMPLE,
  EMPTY_POLICY_DRAFT,
  POLICY_ACTION_OPTIONS,
  POLICY_FIELD_OPTIONS,
  POLICY_OPERATOR_OPTIONS,
  RISK_LEVEL_OPTIONS,
  SENSITIVITY_OPTIONS,
  clonePolicyDraft,
  draftToPolicyBody,
  evaluatePolicyDraft,
  formatDraftCondition,
  formatPolicyCondition,
  type PolicyDraft,
  type PolicyDraftCondition,
  type PolicyTestSample,
} from "@/lib/agent-guard/policy-builder";
import {
  AGENT_GUARD_POLICY_ACTION_GUIDE,
  policyTemplateToDraft,
  policyTemplatesByCategory,
  type AgentGuardPolicyTemplate,
} from "@/lib/agent-guard/policy-templates";
import {
  buildPolicyOutcomeAnalytics,
  type PolicyOutcomeAnalytics,
  type PolicyOutcomeAnalyticsActivity,
  type PolicyOutcomeAnalyticsReview,
} from "@/lib/agent-guard/policy-analytics";
import type {
  AgentPolicyDecisionReviewStatus,
  ReviewablePolicyAction,
} from "@/lib/agent-guard/policy-reviews";
import type {
  ActivityType,
  DataSensitivity,
  PolicyAction,
  PolicyCondition,
  RiskLevel,
} from "@/lib/agent-guard/engine";
import { AgentGuardNav } from "../agent-guard-nav";
import { AgentGuardWorkflowAssistPanel } from "../workflow-assist-panel";

interface Policy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  action: PolicyAction;
}

type ActivityApiItem = {
  id: string;
  toolName: string;
  userEmail: string;
  riskLevel: RiskLevel | string;
  blocked: boolean;
  blockedByPolicyId?: string | null;
  timestamp: string;
};

type PolicyReviewApiItem = {
  id: string;
  policyId: string | null;
  policyName: string;
  policyAction: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  toolName: string;
  userEmail: string;
  riskLevel: RiskLevel | string;
  createdAt: string;
};

const ACTION_COLORS: Record<PolicyAction, string> = {
  block: "bg-red-100 text-red-700 border-red-200",
  warn: "bg-yellow-100 text-yellow-700 border-yellow-200",
  quarantine: "bg-orange-100 text-orange-700 border-orange-200",
  allow: "bg-green-100 text-green-700 border-green-200",
};

const EMPTY_ANALYTICS = buildPolicyOutcomeAnalytics({
  policies: [],
  activities: [],
  reviews: [],
});

const DEFAULT_CONDITION: PolicyDraftCondition = {
  field: "sensitivity",
  operator: "equals",
  value: "restricted",
};

async function fetchPolicies(): Promise<Policy[]> {
  const response = await fetch("/api/agent-guard/policies");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Could not load policies.");
  }
  return (data.policies ?? []).map((policy: Policy) => ({
    id: policy.id,
    name: policy.name,
    description: policy.description ?? "",
    enabled: policy.enabled,
    priority: policy.priority,
    conditions: policy.conditions ?? [],
    action: policy.action,
  }));
}

async function fetchActivitiesForAnalytics(): Promise<PolicyOutcomeAnalyticsActivity[]> {
  const response = await fetch("/api/agent-guard/activity?limit=500");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Could not load recent activity.");
  }
  return ((data.activities ?? []) as ActivityApiItem[]).map((activity) => ({
    id: activity.id,
    blocked: activity.blocked,
    blockedByPolicyId: activity.blockedByPolicyId ?? null,
    toolName: activity.toolName,
    userEmail: activity.userEmail,
    riskLevel: activity.riskLevel,
    timestamp: activity.timestamp,
  }));
}

async function fetchReviewsForAnalytics(): Promise<{
  reviews: PolicyOutcomeAnalyticsReview[];
  warning: string | null;
}> {
  const response = await fetch("/api/agent-guard/policy-reviews?limit=500");
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "migration_required") {
      return {
        reviews: [],
        warning:
          "Policy review analytics are unavailable because the required schema objects could not be loaded. Block analytics can still load from activity rows.",
      };
    }
    throw new Error(data.message ?? data.error ?? "Could not load policy reviews.");
  }

  return {
    reviews: ((data.reviews ?? []) as PolicyReviewApiItem[]).map((review) => ({
      id: review.id,
      policyId: review.policyId,
      policyName: review.policyName,
      policyAction: review.policyAction,
      status: review.status,
      toolName: review.toolName,
      userEmail: review.userEmail,
      riskLevel: review.riskLevel,
      createdAt: review.createdAt,
    })),
    warning: null,
  };
}

async function fetchPolicyOutcomeAnalytics(policies: Policy[]): Promise<{
  analytics: PolicyOutcomeAnalytics;
  warning: string | null;
}> {
  const [activities, reviewResult] = await Promise.all([
    fetchActivitiesForAnalytics(),
    fetchReviewsForAnalytics(),
  ]);

  return {
    analytics: buildPolicyOutcomeAnalytics({
      policies: policies.map((policy) => ({
        id: policy.id,
        name: policy.name,
        action: policy.action,
        enabled: policy.enabled,
        priority: policy.priority,
      })),
      activities,
      reviews: reviewResult.reviews,
    }),
    warning: reviewResult.warning,
  };
}

function policyToDraft(policy: Policy): PolicyDraft {
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? "",
    enabled: policy.enabled,
    priority: policy.priority,
    action: policy.action,
    conditions: policy.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: Array.isArray(condition.value)
        ? condition.value.join(", ")
        : String(condition.value),
    })),
  };
}

function categoriesFromText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatLatestSignal(timestamp: string | null): string {
  if (!timestamp) return "No recent signal";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<PolicyOutcomeAnalytics>(EMPTY_ANALYTICS);
  const [analyticsWarning, setAnalyticsWarning] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState<PolicyDraft>(() =>
    clonePolicyDraft(EMPTY_POLICY_DRAFT)
  );
  const [sample, setSample] = useState<PolicyTestSample>(DEFAULT_POLICY_TEST_SAMPLE);
  const [sampleCategories, setSampleCategories] = useState(
    DEFAULT_POLICY_TEST_SAMPLE.categories.join(", ")
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPolicies() {
    setLoading(true);
    setAnalyticsLoading(true);
    try {
      const nextPolicies = await fetchPolicies();
      setPolicies(nextPolicies);
      setError(null);
      try {
        const result = await fetchPolicyOutcomeAnalytics(nextPolicies);
        setAnalytics(result.analytics);
        setAnalyticsWarning(result.warning);
        setAnalyticsError(null);
      } catch (err) {
        setAnalytics(buildPolicyOutcomeAnalytics({
          policies: nextPolicies.map((policy) => ({
            id: policy.id,
            name: policy.name,
            action: policy.action,
            enabled: policy.enabled,
            priority: policy.priority,
          })),
          activities: [],
          reviews: [],
        }));
        setAnalyticsWarning(null);
        setAnalyticsError(
          err instanceof Error ? err.message : "Could not load policy analytics."
        );
      } finally {
        setAnalyticsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load policies.");
      setAnalytics(EMPTY_ANALYTICS);
      setAnalyticsLoading(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchPolicies()
      .then(async (nextPolicies) => {
        if (!active) return;
        setPolicies(nextPolicies);
        setError(null);
        try {
          const result = await fetchPolicyOutcomeAnalytics(nextPolicies);
          if (!active) return;
          setAnalytics(result.analytics);
          setAnalyticsWarning(result.warning);
          setAnalyticsError(null);
        } catch (err) {
          if (!active) return;
          setAnalytics(buildPolicyOutcomeAnalytics({
            policies: nextPolicies.map((policy) => ({
              id: policy.id,
              name: policy.name,
              action: policy.action,
              enabled: policy.enabled,
              priority: policy.priority,
            })),
            activities: [],
            reviews: [],
          }));
          setAnalyticsWarning(null);
          setAnalyticsError(
            err instanceof Error ? err.message : "Could not load policy analytics."
          );
        } finally {
          if (active) setAnalyticsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load policies.");
          setAnalytics(EMPTY_ANALYTICS);
          setAnalyticsLoading(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const testResult = useMemo(
    () =>
      evaluatePolicyDraft(draft, {
        ...sample,
        categories: categoriesFromText(sampleCategories),
      }),
    [draft, sample, sampleCategories]
  );

  const analyticsCards = useMemo(
    () => [
      { label: "Recent outcomes", value: analytics.summary.totalOutcomes },
      { label: "Block outcomes", value: analytics.summary.blockOutcomes },
      { label: "Review outcomes", value: analytics.summary.reviewOutcomes },
      { label: "Needs action", value: analytics.summary.needsActionReviews },
    ],
    [analytics]
  );

  function resetBuilder() {
    setMode("create");
    setDraft(clonePolicyDraft(EMPTY_POLICY_DRAFT));
    setNotice(null);
    setError(null);
  }

  function editPolicy(policy: Policy) {
    setMode("edit");
    setDraft(policyToDraft(policy));
    setNotice(null);
    setError(null);
  }

  function applyTemplate(template: AgentGuardPolicyTemplate) {
    if (
      mode === "edit" &&
      !window.confirm("Replace the current edit draft with this template?")
    ) {
      return;
    }
    setMode("create");
    setDraft(policyTemplateToDraft(template));
    setNotice(
      `Loaded "${template.name}" into the policy builder. Review the draft before saving.`
    );
    setError(null);
  }

  function updateCondition(index: number, patch: Partial<PolicyDraftCondition>) {
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition, i) =>
        i === index ? { ...condition, ...patch } : condition
      ),
    }));
  }

  function addCondition() {
    setDraft((current) => ({
      ...current,
      conditions: [...current.conditions, { ...DEFAULT_CONDITION }],
    }));
  }

  function removeCondition(index: number) {
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.filter((_, i) => i !== index),
    }));
  }

  async function savePolicy() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const body = draftToPolicyBody(draft);
      if (!body.name) {
        setError("Policy name is required.");
        return;
      }
      if (body.conditions.some((condition) => {
        if (Array.isArray(condition.value)) return condition.value.length === 0;
        return String(condition.value).trim() === "";
      })) {
        setError("Every condition needs a value.");
        return;
      }
      const response = await fetch(
        mode === "edit" && draft.id
          ? `/api/agent-guard/policies/${draft.id}`
          : "/api/agent-guard/policies",
        {
          method: mode === "edit" && draft.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Policy could not be saved.");
        return;
      }
      setNotice(`Saved policy "${data.policy?.name ?? body.name}".`);
      await loadPolicies();
      if (mode === "create") {
        setDraft(clonePolicyDraft(EMPTY_POLICY_DRAFT));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Policy could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePolicy(policy: Policy) {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/agent-guard/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Policy status could not be changed.");
        return;
      }
      setNotice(`${policy.enabled ? "Disabled" : "Enabled"} "${policy.name}".`);
      await loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Policy status could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePolicy(policy: Policy) {
    if (!window.confirm(`Delete policy "${policy.name}"?`)) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/agent-guard/policies/${policy.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Policy could not be deleted.");
        return;
      }
      setNotice(`Deleted "${policy.name}".`);
      if (draft.id === policy.id) resetBuilder();
      await loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Policy could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">AgentGuard Policies</h2>
          <p className="text-sm text-slate-500">
            Build rules for submitted activity. Block decisions are returned to
            the caller today; warn and quarantine create review items for
            controlled workflows.
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={resetBuilder}>
          New policy
        </Button>
      </div>

      <AgentGuardNav />

      <AgentGuardWorkflowAssistPanel page="policies" />

      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-background/80 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Policy Outcome Analytics
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Deterministic rollup from the latest 500 submitted activity rows
              and latest 500 policy review rows. These are operator tuning
              signals, not AI-generated policy recommendations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={analyticsLoading}
            onClick={loadPolicies}
          >
            Refresh analytics
          </Button>
        </div>

        {analyticsWarning && (
          <div className="sg-status-surface sg-status-surface-amber mt-4 rounded-lg border px-4 py-3 text-sm text-foreground/85">
            {analyticsWarning}
          </div>
        )}
        {analyticsError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {analyticsError}
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {analyticsCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-card/80 p-4">
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>

        {analyticsLoading ? (
          <div className="mt-5 flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          </div>
        ) : analytics.rows.length === 0 ? (
          <p className="mt-5 rounded-lg border border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
            No policies are available for analytics yet.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {analytics.rows.map((row) => (
              <div
                key={row.policyId}
                className="rounded-lg border border-border bg-card/80 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {row.policyName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${ACTION_COLORS[row.action as PolicyAction]}`}
                      >
                        {row.action.toUpperCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          row.enabled
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {row.enabled ? "ON" : "OFF"}
                      </Badge>
                      {row.isLegacyPolicy && (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-100 text-xs text-slate-600"
                        >
                          LEGACY
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {row.tuningSignal}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1">
                        Latest: {formatLatestSignal(row.latestSignalAt)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        Tools: {row.uniqueTools}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        Users: {row.uniqueUsers}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        High/Critical: {row.highOrCriticalRiskMatches}
                      </span>
                      {row.topTools.length > 0 && (
                        <span className="rounded-full bg-muted px-2 py-1">
                          Top tools: {row.topTools.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:w-[460px]">
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="text-lg font-bold text-foreground">
                        {row.totalOutcomes}
                      </p>
                      <p className="text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-lg font-bold text-red-700">
                        {row.blockMatches}
                      </p>
                      <p className="text-red-700/80">Blocks</p>
                    </div>
                    <div className="sg-status-surface sg-status-surface-amber rounded-lg border px-3 py-2">
                      <p className="text-lg font-bold text-foreground">
                        {row.reviewMatches}
                      </p>
                      <p className="text-muted-foreground">Reviews</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <p className="text-lg font-bold text-blue-700">
                        {row.needsActionReviews}
                      </p>
                      <p className="text-blue-700/80">Needs action</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background/80 p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Policy Templates</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Start from conservative starter policies, then tune the fields,
              priority, and enabled state before saving.
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-[color:var(--brand)] text-[color:var(--brand)]">
            Draft only
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {policyTemplatesByCategory().flatMap((group) =>
            group.templates.map((template) => (
              <div
                key={template.id}
                className="flex min-h-full flex-col justify-between rounded-lg border border-border bg-card/80 p-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.categoryLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ACTION_COLORS[template.action]}`}
                    >
                      {template.action.toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        template.enabled
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {template.enabled ? "DEFAULT ON" : "DEFAULT OFF"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {template.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {template.summary}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      When
                    </p>
                    {template.conditions.map((condition, index) => (
                      <p key={`${template.id}-${index}`} className="text-xs text-muted-foreground">
                        {index > 0 && <span className="text-muted-foreground/70">AND </span>}
                        {formatDraftCondition(condition)}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {template.guidance}
                  </p>
                  <p className="sg-status-surface sg-status-surface-amber rounded-lg border px-3 py-2 text-xs leading-5 text-foreground/85">
                    {template.safetyNote}
                  </p>
                </div>
                <Button
                  className="mt-4 w-fit"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                >
                  Use template
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {AGENT_GUARD_POLICY_ACTION_GUIDE.map((item) => (
            <div
              key={item.action}
              className="rounded-lg border border-border bg-muted/20 p-3"
            >
              <Badge
                variant="outline"
                className={`text-xs ${ACTION_COLORS[item.action]}`}
              >
                {item.label}
              </Badge>
              <p className="mt-2 text-xs font-medium text-foreground">
                {item.summary}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {item.shippedBehavior}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {item.safetyNote}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {mode === "edit" ? "Edit Policy" : "Create Policy"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Name</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Block credentials to AI tools"
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Priority</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={0}
                    max={1000}
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        priority: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Description</span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Explain what this policy is meant to catch."
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Action</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={draft.action}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        action: event.target.value as PolicyAction,
                      }))
                    }
                  >
                    {POLICY_ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  <span className="font-medium text-slate-700">Policy enabled</span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Conditions</p>
                  <Button variant="outline" size="sm" onClick={addCondition}>
                    Add condition
                  </Button>
                </div>
                {draft.conditions.map((condition, index) => (
                  <div
                    key={`${condition.field}-${index}`}
                    className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1.3fr_auto]"
                  >
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={condition.field}
                      onChange={(event) =>
                        updateCondition(index, {
                          field: event.target.value as PolicyDraftCondition["field"],
                        })
                      }
                    >
                      {POLICY_FIELD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(index, {
                          operator: event.target.value as PolicyDraftCondition["operator"],
                        })
                      }
                    >
                      {POLICY_OPERATOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={condition.value}
                      onChange={(event) =>
                        updateCondition(index, { value: event.target.value })
                      }
                      placeholder={condition.operator === "in" ? "ChatGPT, Claude" : "restricted"}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCondition(index)}
                      disabled={draft.conditions.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="brand" disabled={saving} onClick={savePolicy}>
                  {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create policy"}
                </Button>
                {mode === "edit" && (
                  <Button variant="outline" disabled={saving} onClick={resetBuilder}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dry Run Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                Test the current draft against sample submitted activity. This
                does not save anything or send activity to the API.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Tool</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sample.toolName}
                    onChange={(event) =>
                      setSample((current) => ({
                        ...current,
                        toolName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">User email</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sample.userEmail}
                    onChange={(event) =>
                      setSample((current) => ({
                        ...current,
                        userEmail: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Activity</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sample.activityType}
                    onChange={(event) =>
                      setSample((current) => ({
                        ...current,
                        activityType: event.target.value as ActivityType,
                      }))
                    }
                  >
                    {ACTIVITY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Sensitivity</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sample.sensitivity}
                    onChange={(event) =>
                      setSample((current) => ({
                        ...current,
                        sensitivity: event.target.value as DataSensitivity,
                      }))
                    }
                  >
                    {SENSITIVITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Risk</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sample.riskLevel}
                    onChange={(event) =>
                      setSample((current) => ({
                        ...current,
                        riskLevel: event.target.value as RiskLevel,
                      }))
                    }
                  >
                    {RISK_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Categories</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sampleCategories}
                    onChange={(event) => setSampleCategories(event.target.value)}
                    placeholder="API Key, Proprietary Content"
                  />
                </label>
              </div>
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  testResult.matched
                    ? "sg-status-surface sg-status-surface-amber text-foreground/85"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <p className="font-semibold">
                  {testResult.matched ? "Sample matched" : "No match"}
                </p>
                <p className="mt-1">{testResult.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Existing Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : policies.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No policies yet. Create the first policy above or reload this page
              after defaults are seeded.
            </p>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {policy.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${ACTION_COLORS[policy.action]}`}
                        >
                          {policy.action.toUpperCase()}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            policy.enabled
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {policy.enabled ? "ON" : "OFF"}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          Priority {policy.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {policy.description || "No description."}
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          When
                        </p>
                        {policy.conditions.length === 0 ? (
                          <p className="pl-2 text-xs text-slate-600">
                            No conditions. This policy matches all submitted activity.
                          </p>
                        ) : (
                          policy.conditions.map((condition, i) => (
                            <p key={i} className="pl-2 text-xs text-slate-600">
                              {i > 0 && <span className="text-slate-400">AND </span>}
                              {formatPolicyCondition(condition)}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => editPolicy(policy)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => togglePolicy(policy)}
                      >
                        {policy.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => deletePolicy(policy)}
                      >
                        Delete
                      </Button>
                    </div>
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
