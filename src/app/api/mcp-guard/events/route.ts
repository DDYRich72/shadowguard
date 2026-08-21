import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { mcpEventIngestSchema, parseBody } from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import {
  markSensitive,
  unwrapForClassification,
  lengthOf,
} from "@/lib/sensitive";
import {
  assessActivityRisk,
  classifyData,
  evaluatePolicy,
  type AgentActivity,
  type AgentPolicy,
  type PolicyAction,
} from "@/lib/agent-guard/engine";
import {
  buildSafeMCPRawPayload,
  sanitizeMCPEventMetadata,
} from "@/lib/mcp-governance/events";

type Decision = {
  action: PolicyAction;
  reason: string;
  policyId: string | null;
};

function actionBlocks(action: PolicyAction): boolean {
  return action === "block" || action === "quarantine";
}

function decideWithPolicies(activity: AgentActivity, policies: AgentPolicy[]): Decision {
  const sorted = [...policies]
    .filter((policy) => policy.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const policy of sorted) {
    const action = evaluatePolicy(policy, activity);
    if (action) {
      return {
        action,
        reason: `Matched policy: "${policy.name}"`,
        policyId: policy.id,
      };
    }
  }

  return {
    action: "allow",
    reason: "No policy matched",
    policyId: null,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-events:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10), 500);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_tool_events")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    events: data ?? [],
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`ingest:mcp-events:${ctx.orgId}`, 300, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, mcpEventIngestSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  let matchedServer: Record<string, unknown> | null = null;
  let matchedTool: Record<string, unknown> | null = null;

  if (body.serverId) {
    const { data } = await supabase
      .from("mcp_servers")
      .select("*")
      .eq("id", body.serverId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    matchedServer = data ?? null;
  } else if (body.serverName) {
    const { data } = await supabase
      .from("mcp_servers")
      .select("*")
      .eq("org_id", ctx.orgId)
      .ilike("name", body.serverName)
      .limit(1)
      .maybeSingle();
    matchedServer = data ?? null;
  }

  if (body.toolId) {
    const { data } = await supabase
      .from("mcp_tools")
      .select("*")
      .eq("id", body.toolId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    matchedTool = data ?? null;
  } else if (matchedServer?.id) {
    const { data } = await supabase
      .from("mcp_tools")
      .select("*")
      .eq("org_id", ctx.orgId)
      .eq("mcp_server_id", matchedServer.id as string)
      .ilike("name", body.toolName)
      .limit(1)
      .maybeSingle();
    matchedTool = data ?? null;
  }

  const combinedContent = [body.content, body.inputContent, body.outputContent]
    .filter(Boolean)
    .join("\n");
  const content = markSensitive(combinedContent);
  const classification = classifyData(unwrapForClassification(content));
  const { riskLevel } = assessActivityRisk({
    activityType: body.activityType,
    dataClassification: classification,
  });
  const persistedRiskLevel = riskLevel === "none" ? "low" : riskLevel;

  const metadata = sanitizeMCPEventMetadata({
    ...body.metadata,
    mcp: true,
    clientName: body.clientName,
    serverName: matchedServer?.name ?? body.serverName,
    serverId: matchedServer?.id ?? null,
    toolId: matchedTool?.id ?? null,
  });

  const { data: policyRows } = await supabase
    .from("agent_policies")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const policies: AgentPolicy[] = (policyRows ?? []).map((policy) => ({
    id: policy.id,
    orgId: policy.org_id,
    name: policy.name,
    description: policy.description ?? "",
    enabled: policy.enabled,
    priority: policy.priority,
    conditions: policy.conditions ?? [],
    action: policy.action,
    createdAt: policy.created_at,
    updatedAt: policy.updated_at,
  }));

  const agentToolName = `MCPGuard: ${body.toolName}`;
  const candidate: AgentActivity = {
    id: "tmp",
    orgId: ctx.orgId,
    toolName: agentToolName,
    toolId: (matchedTool?.id as string | undefined) ?? "",
    userId: ctx.userId,
    userEmail: body.userEmail,
    activityType: body.activityType,
    timestamp: new Date().toISOString(),
    dataClassification: classification,
    riskLevel: persistedRiskLevel,
    metadata,
    blocked: false,
  };

  let decision = decideWithPolicies(candidate, policies);
  if (
    matchedTool?.approval_status === "blocked" ||
    matchedTool?.status === "blocked" ||
    matchedServer?.approval_status === "blocked" ||
    matchedServer?.status === "blocked"
  ) {
    decision = {
      action: "block",
      reason: "Blocked MCP server or tool",
      policyId: decision.policyId,
    };
  }

  const rawPayload = {
    ...buildSafeMCPRawPayload({
      content: body.content,
      inputContent: body.inputContent,
      outputContent: body.outputContent,
    }),
    classified_content_length: lengthOf(content),
  };

  const now = new Date().toISOString();
  const { data: event, error: eventError } = await supabase
    .from("mcp_tool_events")
    .insert({
      org_id: ctx.orgId,
      mcp_server_id: (matchedServer?.id as string | undefined) ?? null,
      mcp_tool_id: (matchedTool?.id as string | undefined) ?? null,
      tool_name: body.toolName,
      server_name: (matchedServer?.name as string | undefined) ?? body.serverName,
      client_name: body.clientName,
      user_email: body.userEmail,
      activity_type: body.activityType,
      data_sensitivity: classification.sensitivity,
      data_categories: classification.categories,
      pii_detected: classification.piiDetected,
      credentials_detected: classification.credentialsDetected,
      proprietary_detected: classification.proprietaryDetected,
      risk_level: persistedRiskLevel,
      decision: decision.action,
      decision_reason: decision.reason,
      blocked_by_policy_id: decision.policyId,
      metadata,
      raw_payload: rawPayload,
      created_at: now,
    })
    .select("id")
    .single();

  if (eventError) return dbErrorResponse(eventError);

  await supabase.from("agent_activities").insert({
    org_id: ctx.orgId,
    tool_name: agentToolName,
    tool_id: (matchedTool?.id as string | undefined) ?? "",
    user_id: ctx.userId,
    user_email: body.userEmail,
    activity_type: body.activityType,
    data_sensitivity: classification.sensitivity,
    data_categories: classification.categories,
    pii_detected: classification.piiDetected,
    credentials_detected: classification.credentialsDetected,
    proprietary_detected: classification.proprietaryDetected,
    risk_level: persistedRiskLevel,
    blocked: actionBlocks(decision.action),
    block_reason: actionBlocks(decision.action) ? decision.reason : null,
    blocked_by_policy_id: decision.policyId,
    metadata,
    raw_payload: rawPayload,
    created_at: now,
  });

  await supabase.from("agent_tools").upsert(
    {
      org_id: ctx.orgId,
      tool_name: agentToolName,
      status: actionBlocks(decision.action) ? "blocked" : "active",
      last_activity_at: now,
    },
    { onConflict: "org_id,tool_name" }
  );

  if (matchedTool?.id) {
    await supabase
      .from("mcp_tools")
      .update({ last_activity_at: now })
      .eq("id", matchedTool.id as string)
      .eq("org_id", ctx.orgId);
  }

  if (actionBlocks(decision.action)) {
    await supabase.from("alerts").insert({
      org_id: ctx.orgId,
      type: "policy_violation",
      severity: decision.action === "block" ? "critical" : "high",
      title: `${agentToolName}: ${decision.reason}`,
      message: `${decision.action} decision for ${body.activityType} from ${body.userEmail}.`,
      app_name: agentToolName,
      user_email: body.userEmail,
    });
  }

  return NextResponse.json({
    id: event?.id,
    decision: decision.action,
    blocked: actionBlocks(decision.action),
    reason: decision.reason,
    riskLevel: persistedRiskLevel,
    policyId: decision.policyId,
    matchedToolId: (matchedTool?.id as string | undefined) ?? null,
  });
}
