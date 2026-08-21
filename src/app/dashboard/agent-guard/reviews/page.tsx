"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_POLICY_REVIEW_ACTION_OPTIONS,
  AGENT_POLICY_REVIEW_STATUS_OPTIONS,
  policyReviewStatusLabel,
  type AgentPolicyDecisionReviewStatus,
  type ReviewablePolicyAction,
} from "@/lib/agent-guard/policy-reviews";
import { AgentGuardNav } from "../agent-guard-nav";

type PolicyReview = {
  id: string;
  activityId: string | null;
  policyId: string | null;
  policyName: string;
  policyAction: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  toolName: string;
  userEmail: string;
  activityType: string;
  riskLevel: string;
  dataSensitivity: string;
  dataCategories: string[];
  assignedTo: string;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
};

type ReviewDraft = {
  status: AgentPolicyDecisionReviewStatus;
  assignedTo: string;
  reviewNote: string;
};

type ReviewSummary = {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  warn: number;
  quarantine: number;
  needsAction: number;
};

const ACTION_COLORS: Record<ReviewablePolicyAction, string> = {
  warn: "border-yellow-200 bg-yellow-50 text-yellow-700",
  quarantine: "border-orange-200 bg-orange-50 text-orange-700",
};

const STATUS_COLORS: Record<AgentPolicyDecisionReviewStatus, string> = {
  open: "border-red-200 bg-red-50 text-red-700",
  investigating: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-green-200 bg-green-50 text-green-700",
  dismissed: "border-slate-200 bg-slate-100 text-slate-600",
};

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  open: 0,
  investigating: 0,
  resolved: 0,
  dismissed: 0,
  warn: 0,
  quarantine: 0,
  needsAction: 0,
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

async function fetchPolicyReviews(filters: {
  status: string;
  action: string;
}): Promise<{ reviews: PolicyReview[]; summary: ReviewSummary }> {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.action !== "all") params.set("action", filters.action);
  const response = await fetch(`/api/agent-guard/policy-reviews?${params}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Could not load policy reviews.");
  }
  return {
    reviews: data.reviews ?? [],
    summary: data.summary ?? EMPTY_SUMMARY,
  };
}

function draftFromReview(review: PolicyReview): ReviewDraft {
  return {
    status: review.status,
    assignedTo: review.assignedTo,
    reviewNote: review.reviewNote,
  };
}

export default function AgentGuardPolicyReviewsPage() {
  const [reviews, setReviews] = useState<PolicyReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReviews() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPolicyReviews({
        status: statusFilter,
        action: actionFilter,
      });
      setReviews(data.reviews);
      setSummary(data.summary);
      setDrafts(
        Object.fromEntries(data.reviews.map((review) => [review.id, draftFromReview(review)]))
      );
    } catch (err) {
      setReviews([]);
      setSummary(EMPTY_SUMMARY);
      setError(err instanceof Error ? err.message : "Could not load policy reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchPolicyReviews({
      status: statusFilter,
      action: actionFilter,
    })
      .then((data) => {
        if (!active) return;
        setReviews(data.reviews);
        setSummary(data.summary);
        setDrafts(
          Object.fromEntries(
            data.reviews.map((review) => [review.id, draftFromReview(review)])
          )
        );
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setReviews([]);
        setSummary(EMPTY_SUMMARY);
        setError(err instanceof Error ? err.message : "Could not load policy reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter, actionFilter]);

  const summaryCards = useMemo(
    () => [
      { label: "Needs action", value: summary.needsAction },
      { label: "Open", value: summary.open },
      { label: "Investigating", value: summary.investigating },
      { label: "Quarantine", value: summary.quarantine },
    ],
    [summary]
  );

  function updateDraft(id: string, patch: Partial<ReviewDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { status: "open", assignedTo: "", reviewNote: "" }),
        ...patch,
      },
    }));
  }

  async function saveReview(review: PolicyReview) {
    const draft = drafts[review.id] ?? draftFromReview(review);
    setSavingId(review.id);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/agent-guard/policy-reviews/${review.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? data.error ?? "Review could not be updated.");
        return;
      }
      setNotice("Policy review updated.");
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Policy Reviews</h2>
        <p className="text-sm text-slate-500">
          Triage warn and quarantine outcomes from submitted AgentGuard activity.
        </p>
      </div>

      <AgentGuardNav />

      <Card className="sg-status-surface sg-status-surface-amber">
        <CardContent className="pt-4">
          <p className="text-sm leading-6 text-foreground/85">
            Warn and quarantine create review items for operators. They do not
            automatically block activity, hold files, or change third-party tools
            unless your customer-controlled integration acts on a returned decision.
          </p>
        </CardContent>
      </Card>

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

      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Review Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>Status</span>
              <select
                className="block min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => {
                  setLoading(true);
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="all">All statuses</option>
                {AGENT_POLICY_REVIEW_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>Action</span>
              <select
                className="block min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={actionFilter}
                onChange={(event) => {
                  setLoading(true);
                  setActionFilter(event.target.value);
                }}
              >
                <option value="all">All actions</option>
                {AGENT_POLICY_REVIEW_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" size="sm" onClick={loadReviews} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No policy review items match these filters.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const draft = drafts[review.id] ?? draftFromReview(review);
                return (
                  <div key={review.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ACTION_COLORS[review.policyAction]}`}
                          >
                            {review.policyAction.toUpperCase()}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_COLORS[review.status]}`}
                          >
                            {policyReviewStatusLabel(review.status)}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {timeAgo(review.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {review.policyName}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {review.toolName} - {review.activityType} - {review.userEmail}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                            Risk: {review.riskLevel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                            Data: {review.dataSensitivity}
                          </span>
                          {review.dataCategories.slice(0, 3).map((category) => (
                            <span
                              key={category}
                              className="rounded-full bg-slate-100 px-2 py-1 text-slate-600"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid w-full gap-2 xl:w-[420px]">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>Status</span>
                            <select
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={draft.status}
                              onChange={(event) =>
                                updateDraft(review.id, {
                                  status: event.target.value as AgentPolicyDecisionReviewStatus,
                                })
                              }
                            >
                              {AGENT_POLICY_REVIEW_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>Owner</span>
                            <input
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={draft.assignedTo}
                              onChange={(event) =>
                                updateDraft(review.id, { assignedTo: event.target.value })
                              }
                              placeholder="Security owner"
                            />
                          </label>
                        </div>
                        <label className="space-y-1 text-xs font-medium text-slate-600">
                          <span>Note</span>
                          <textarea
                            className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={draft.reviewNote}
                            onChange={(event) =>
                              updateDraft(review.id, { reviewNote: event.target.value })
                            }
                            placeholder="What changed, who reviewed it, or why it was dismissed."
                          />
                        </label>
                        <div className="flex justify-end">
                          <Button
                            variant="brand"
                            size="sm"
                            disabled={savingId === review.id}
                            onClick={() => saveReview(review)}
                          >
                            {savingId === review.id ? "Saving..." : "Save review"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
