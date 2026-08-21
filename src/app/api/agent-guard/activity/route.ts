import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { dbErrorResponse } from "@/lib/errors";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { getSessionContext, hasRole } from "@/lib/authz";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { parseBody, activityIngestSchema } from "@/lib/api/schemas";
import { prepareAgentActivity } from "@/lib/agent-guard/activity";
import { buildPolicyDecisionReviewInsert } from "@/lib/agent-guard/policy-reviews";
import {
  hashAgentIngestToken,
  mergeSourceMetadata,
  parseBearerToken,
  sourceCanSubmitTool,
  type AgentIngestSourceEnvironment,
  type AgentIngestSourceRecord,
} from "@/lib/agent-guard/ingest-sources";
import type { AgentPolicy } from "@/lib/agent-guard/engine";
import { buildAgentGuardExportEvent } from "@/lib/agent-guard/export-foundation";
import {
  processAgentGuardAutomaticExports,
  type AgentGuardAutomaticExportDatabase,
} from "@/lib/agent-guard/automatic-export";
import {
  processAgentGuardAutomaticSlackWorkflowSends,
  type AgentGuardSlackWorkflowDatabase,
} from "@/lib/agent-guard/automatic-slack-workflow";
import { logger } from "@/lib/logger";

type ActivityRow = {
  id: string;
  tool_name: string;
  user_email: string;
  activity_type: string;
  created_at: string;
  risk_level: string;
  blocked: boolean;
  blocked_by_policy_id: string | null;
  data_sensitivity: string;
  data_categories: string[];
  pii_detected: boolean;
  credentials_detected: boolean;
  metadata: {
    agentGuardSource?: {
      id?: string;
      name?: string;
      environment?: string;
    };
  } | null;
};

function rowToApi(row: ActivityRow) {
  return {
    id: row.id,
    toolName: row.tool_name,
    userEmail: row.user_email,
    activityType: row.activity_type,
    timestamp: row.created_at,
    riskLevel: row.risk_level,
    blocked: row.blocked,
    blockedByPolicyId: row.blocked_by_policy_id,
    dataClassification: {
      sensitivity: row.data_sensitivity,
      categories: row.data_categories ?? [],
      piiDetected: row.pii_detected,
      credentialsDetected: row.credentials_detected,
    },
    source: row.metadata?.agentGuardSource
      ? {
          id: row.metadata.agentGuardSource.id ?? "",
          name: row.metadata.agentGuardSource.name ?? "Unknown source",
          environment: row.metadata.agentGuardSource.environment ?? "unknown",
        }
      : null,
  };
}

function isMissingPolicyReviewTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_policy_decision_reviews")
  );
}

async function resolveSourceAuth(request: NextRequest): Promise<
  | { source: AgentIngestSourceRecord }
  | { response: NextResponse }
  | null
> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const token = parseBearerToken(authorization);
  if (!token) {
    const response = await invalidSourceTokenResponse(request, "malformed_authorization");
    return {
      response,
    };
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("agent_ingest_sources")
    .select("id, org_id, name, environment, status, allowed_tool_names")
    .eq("token_hash", hashAgentIngestToken(token))
    .maybeSingle();

  if (error) return { response: dbErrorResponse(error) };
  if (!data || data.status !== "active") {
    const response = await invalidSourceTokenResponse(
      request,
      data ? "revoked_source" : "unknown_token"
    );
    return {
      response,
    };
  }

  return {
    source: {
      id: data.id,
      org_id: data.org_id,
      name: data.name,
      environment: data.environment as AgentIngestSourceEnvironment,
      status: data.status,
      allowed_tool_names: data.allowed_tool_names ?? [],
    },
  };
}

async function invalidSourceTokenResponse(
  request: NextRequest,
  reason: "malformed_authorization" | "unknown_token" | "revoked_source"
): Promise<NextResponse> {
  const ip = clientIp(request);
  const rl = await rateLimit(`invalid-agent-ingest-token:${ip}`, 20, 60_000);
  logger.warn("agentguard: invalid ingest token attempt", {
    reason,
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  if (!rl.allowed) return rateLimited(rl);
  return NextResponse.json({ error: "invalid_ingest_token" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 60 reads/min/org. Generous for normal dashboard polling; an
  // authenticated enumeration script hits the wall.
  const rl = await rateLimit(`get:activity:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const url = request.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const tool = url.searchParams.get("tool");
  const risk = url.searchParams.get("risk");
  const sensitivity = url.searchParams.get("sensitivity");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("agent_activities")
    .select(
      "id, tool_name, user_email, activity_type, created_at, risk_level, blocked, blocked_by_policy_id, data_sensitivity, data_categories, pii_detected, credentials_detected, metadata"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tool) query = query.eq("tool_name", tool);
  if (risk) query = query.eq("risk_level", risk);
  if (sensitivity) query = query.eq("data_sensitivity", sensitivity);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) {
    return dbErrorResponse(error);
  }

  const activities = (data ?? []).map(rowToApi);
  return NextResponse.json({
    activities,
    total: activities.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Ingest endpoint. Classifies the prompt/content, evaluates policies,
 * and records the activity. Returns the block decision synchronously so
 * a customer-side wrapper or server-side logger can honor it.
 *
 * Body: { toolName, userEmail, activityType, content, metadata? }
 */
export async function POST(request: NextRequest) {
  const sourceAuth = await resolveSourceAuth(request);
  if (sourceAuth && "response" in sourceAuth) return sourceAuth.response;

  let orgId: string | null = null;
  let source: AgentIngestSourceRecord | null = null;
  let useAdminClient = false;

  if (sourceAuth?.source) {
    orgId = sourceAuth.source.org_id;
    source = sourceAuth.source;
    useAdminClient = true;
  } else {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!hasRole(ctx.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const mfa = await getMfaSnapshot();
    if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
      return NextResponse.json(mfaRequiredError, { status: 403 });
    }
    orgId = ctx.orgId;
  }

  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 300 ingests/minute. Session calls are org-scoped; source-key calls
  // are source-scoped so one busy wrapper does not starve every source.
  const rateKey = source ? `ingest:${orgId}:${source.id}` : `ingest:${orgId}`;
  const limit = await rateLimit(rateKey, 300, 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const body = await parseBody(request, activityIngestSchema);
  if (body instanceof NextResponse) return body;
  const { toolName, userEmail, activityType } = body;

  if (source && !sourceCanSubmitTool(source.allowed_tool_names, toolName)) {
    return NextResponse.json(
      {
        error: "tool_not_allowed_for_source",
        message: "This ingest source is not scoped for the submitted tool.",
      },
      { status: 403 }
    );
  }

  const supabase = useAdminClient
    ? createAdminSupabase()
    : await createServerSupabase();
  const { data: policyRows } = await supabase
    .from("agent_policies")
    .select("*")
    .eq("org_id", orgId)
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

  const prepared = prepareAgentActivity(
    {
      orgId,
      toolName,
      userEmail,
      activityType,
      content: body.content,
      metadata: source
        ? mergeSourceMetadata(body.metadata, {
            id: source.id,
            name: source.name,
            environment: source.environment,
          })
        : body.metadata,
    },
    policies
  );

  const { data: inserted, error } = await supabase
    .from("agent_activities")
    .insert(prepared.insert)
    .select("id, created_at")
    .single();

  if (error) {
    return dbErrorResponse(error);
  }

  if (prepared.blocked) {
    await supabase.from("alerts").insert({
      org_id: orgId,
      type: "policy_violation",
      severity: "critical",
      title: `${toolName}: ${prepared.reason}`,
      message: `Blocked ${activityType} from ${userEmail}.`,
      app_name: toolName,
      user_email: userEmail,
    });
  }

  const reviewRows = inserted?.id
    ? prepared.policyMatches
      .map((match) =>
        buildPolicyDecisionReviewInsert({
          orgId,
          activityId: inserted.id,
          match,
          toolName,
          userEmail,
          activityType,
          riskLevel: prepared.riskLevel,
          dataSensitivity: prepared.classification.sensitivity,
          dataCategories: prepared.classification.categories,
        })
      )
      .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];
  let reviewRowsCreated = false;

  if (inserted?.id) {
    if (reviewRows.length > 0) {
      const { error: reviewError } = await supabase
        .from("agent_policy_decision_reviews")
        .insert(reviewRows);
      if (reviewError && !isMissingPolicyReviewTable(reviewError)) {
        logger.warn("agentguard: policy review creation failed", {
          orgId,
          activityId: inserted.id,
          code: reviewError.code,
        });
      }
      reviewRowsCreated = !reviewError;
    }
  }

  if (source) {
    await supabase
      .from("agent_ingest_sources")
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIp(request),
      })
      .eq("id", source.id)
      .eq("org_id", orgId);
  }

  if (inserted?.id) {
    const exportEvent = buildAgentGuardExportEvent({
      id: inserted.id,
      orgId,
      toolName,
      userEmail,
      activityType,
      riskLevel: prepared.riskLevel,
      blocked: prepared.blocked,
      reason: prepared.reason,
      policyId: prepared.blockedByPolicyId,
      dataClassification: prepared.classification,
      source: source
        ? {
            id: source.id,
            name: source.name,
            environment: source.environment,
          }
        : null,
      contentLength: prepared.insert.raw_payload.content_length,
      occurredAt: inserted.created_at,
    });
    try {
      await processAgentGuardAutomaticExports(
        supabase as unknown as AgentGuardAutomaticExportDatabase,
        orgId,
        exportEvent
      );
      await processAgentGuardAutomaticSlackWorkflowSends(
        supabase as unknown as AgentGuardSlackWorkflowDatabase,
        orgId,
        exportEvent
      );
      if (reviewRowsCreated) {
        const reviewRequiredEvent = buildAgentGuardExportEvent({
          id: inserted.id,
          orgId,
          toolName,
          userEmail,
          activityType,
          riskLevel: prepared.riskLevel,
          blocked: prepared.blocked,
          reason: prepared.reason,
          policyId: prepared.blockedByPolicyId,
          dataClassification: prepared.classification,
          source: source
            ? {
                id: source.id,
                name: source.name,
                environment: source.environment,
              }
            : null,
          contentLength: prepared.insert.raw_payload.content_length,
          occurredAt: inserted.created_at,
          eventType: "agentguard.review.required",
          alert: {
            category: "review_required",
            severity: reviewRows.some((row) => row.policy_action === "quarantine")
              ? "critical"
              : "warning",
            title: "AgentGuard review required",
            summary: `${reviewRows.length} warn/quarantine policy outcome${reviewRows.length === 1 ? "" : "s"} created for ${toolName}.`,
            policyActions: Array.from(
              new Set(reviewRows.map((row) => row.policy_action))
            ),
          },
        });
        await processAgentGuardAutomaticExports(
          supabase as unknown as AgentGuardAutomaticExportDatabase,
          orgId,
          reviewRequiredEvent
        );
        await processAgentGuardAutomaticSlackWorkflowSends(
          supabase as unknown as AgentGuardSlackWorkflowDatabase,
          orgId,
          reviewRequiredEvent
        );
      }
    } catch {
      // Export is best-effort and must not break the ingest response.
    }
  }

  return NextResponse.json({
    id: inserted?.id,
    blocked: prepared.blocked,
    reason: prepared.reason,
    riskLevel: prepared.riskLevel,
    policyId: prepared.blockedByPolicyId,
    policyActions: prepared.policyMatches.map((match) => ({
      policyId: match.policyId,
      policyName: match.policyName,
      action: match.policyAction,
      priority: match.priority,
    })),
  });
}
