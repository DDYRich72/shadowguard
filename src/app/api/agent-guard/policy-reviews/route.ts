import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import {
  AGENT_POLICY_REVIEW_ACTION_OPTIONS,
  AGENT_POLICY_REVIEW_STATUS_OPTIONS,
  summarizePolicyDecisionReviews,
  type AgentPolicyDecisionReviewStatus,
  type ReviewablePolicyAction,
} from "@/lib/agent-guard/policy-reviews";

type PolicyReviewRow = {
  id: string;
  activity_id: string | null;
  policy_id: string | null;
  policy_name: string;
  policy_action: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  tool_name: string;
  user_email: string;
  activity_type: string;
  risk_level: string;
  data_sensitivity: string;
  data_categories: string[] | null;
  assigned_to: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_VALUES = new Set(
  AGENT_POLICY_REVIEW_STATUS_OPTIONS.map((option) => option.value)
);
const ACTION_VALUES = new Set(
  AGENT_POLICY_REVIEW_ACTION_OPTIONS.map((option) => option.value)
);

function isMissingPolicyReviewTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_policy_decision_reviews")
  );
}

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
      reviews: [],
      summary: summarizePolicyDecisionReviews([]),
    },
    { status: 503 }
  );
}

function rowToApi(row: PolicyReviewRow) {
  return {
    id: row.id,
    activityId: row.activity_id,
    policyId: row.policy_id,
    policyName: row.policy_name,
    policyAction: row.policy_action,
    status: row.status,
    toolName: row.tool_name,
    userEmail: row.user_email,
    activityType: row.activity_type,
    riskLevel: row.risk_level,
    dataSensitivity: row.data_sensitivity,
    dataCategories: row.data_categories ?? [],
    assignedTo: row.assigned_to ?? "",
    reviewNote: row.review_note ?? "",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = await rateLimit(`get:policy-reviews:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const action = url.searchParams.get("action");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  const supabase = await createServerSupabase();
  let query = supabase
    .from("agent_policy_decision_reviews")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && STATUS_VALUES.has(status as AgentPolicyDecisionReviewStatus)) {
    query = query.eq("status", status);
  }
  if (action && ACTION_VALUES.has(action as ReviewablePolicyAction)) {
    query = query.eq("policy_action", action);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPolicyReviewTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  const reviews = ((data ?? []) as PolicyReviewRow[]).map(rowToApi);
  return NextResponse.json({
    reviews,
    summary: summarizePolicyDecisionReviews(reviews),
    timestamp: new Date().toISOString(),
  });
}
