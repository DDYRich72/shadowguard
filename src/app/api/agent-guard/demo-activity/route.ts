import { NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import {
  AGENT_GUARD_DEMO_ACTIVITIES,
  prepareAgentActivity,
} from "@/lib/agent-guard/activity";
import { buildPolicyDecisionReviewInsert } from "@/lib/agent-guard/policy-reviews";
import type { AgentPolicy } from "@/lib/agent-guard/engine";
import { logger } from "@/lib/logger";

function isMissingPolicyReviewTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_policy_decision_reviews")
  );
}

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(`demo:agentguard:${ctx.orgId}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data: policyRows } = await supabase
    .from("agent_policies")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const policies: AgentPolicy[] = (policyRows ?? []).map((p) => ({
    id: p.id,
    orgId: p.org_id,
    name: p.name,
    description: p.description ?? "",
    enabled: p.enabled,
    priority: p.priority,
    conditions: p.conditions ?? [],
    action: p.action,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  const demoBatchId = crypto.randomUUID();
  const preparedActivities = AGENT_GUARD_DEMO_ACTIVITIES.map((sample) =>
    prepareAgentActivity(
      {
        ...sample,
        orgId: ctx.orgId,
        metadata: {
          ...sample.metadata,
          demoBatchId,
        },
      },
      policies
    )
  );
  const rows = preparedActivities.map((prepared) => prepared.insert);

  const { data, error } = await supabase
    .from("agent_activities")
    .insert(rows)
    .select("id, tool_name, risk_level, blocked, data_sensitivity");

  if (error) {
    return dbErrorResponse(error);
  }

  const reviewRows = (data ?? []).flatMap((row, index) => {
    const prepared = preparedActivities[index];
    if (!prepared) return [];
    return prepared.policyMatches.flatMap((match) => {
      const review = buildPolicyDecisionReviewInsert({
        orgId: ctx.orgId,
        activityId: row.id,
        match,
        toolName: prepared.insert.tool_name,
        userEmail: prepared.insert.user_email,
        activityType: prepared.insert.activity_type,
        riskLevel: prepared.riskLevel,
        dataSensitivity: prepared.classification.sensitivity,
        dataCategories: prepared.classification.categories,
      });
      return review ? [review] : [];
    });
  });

  if (reviewRows.length > 0) {
    const { error: reviewError } = await supabase
      .from("agent_policy_decision_reviews")
      .insert(reviewRows);
    if (reviewError && !isMissingPolicyReviewTable(reviewError)) {
      logger.warn("agentguard: demo policy review creation failed", {
        orgId: ctx.orgId,
        code: reviewError.code,
      });
    }
  }

  await recordAudit(ctx, {
    action: "agentguard.demo_activity.seed",
    target_type: "agent_activities",
    summary: `Seeded ${rows.length} safe AgentGuard demo activities`,
    after: {
      demoBatchId,
      count: rows.length,
      ids: (data ?? []).map((row) => row.id),
    },
  });

  return NextResponse.json({
    seeded: data?.length ?? 0,
    demoBatchId,
    activities: data ?? [],
  });
}
