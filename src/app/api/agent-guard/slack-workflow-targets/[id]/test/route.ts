import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import { isUuid } from "@/lib/validate";
import { classifyAgentExportFailure } from "@/lib/agent-guard/export-hardening";
import {
  AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV,
  buildAgentGuardSlackManualTestPayload,
  decryptAgentGuardSlackWebhookUrl,
  sendAgentGuardSlackWorkflowMessage,
  type AgentGuardSlackWorkflowCustomerApprovalStatus,
  type AgentGuardSlackWorkflowDeliveryEventType,
  type AgentGuardSlackWorkflowDeliveryMode,
  type AgentGuardSlackWorkflowDeliveryStatus,
  type AgentGuardSlackWorkflowTargetStatus,
  type AgentGuardSlackWorkflowTargetType,
  type AgentGuardSlackWorkflowUserIdentifierMode,
} from "@/lib/agent-guard/slack-workflow-targets";

type Ctx = { params: Promise<{ id: string }> };

type SlackTargetRow = {
  id: string;
  org_id: string;
  name: string;
  target_type: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhook_url_encrypted: string;
  webhook_url_hint: string;
  dry_run_enabled: boolean;
  user_identifier_mode: AgentGuardSlackWorkflowUserIdentifierMode | null;
  customer_approval_status: AgentGuardSlackWorkflowCustomerApprovalStatus | null;
};

type SlackAttemptRow = {
  id: string;
  target_id: string | null;
  event_id: string;
  event_type: AgentGuardSlackWorkflowDeliveryEventType;
  status: AgentGuardSlackWorkflowDeliveryStatus;
  delivery_mode: AgentGuardSlackWorkflowDeliveryMode;
  http_status: number | null;
  duration_ms: number;
  error_message: string | null;
  created_by_email: string | null;
  created_at: string;
};

function migrationRequired(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || message.includes("agent_slack_workflow");
}

function migrationResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 409 }
  );
}

function secretConfigError() {
  return NextResponse.json(
    {
      error: "slack_url_secret_key_missing",
      message: `${AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV} must be configured before Slack preview targets can send test events.`,
    },
    { status: 500 }
  );
}

function mutationOriginResponse(request: NextRequest) {
  const origin = evaluateApiMutationOrigin({
    method: request.method,
    url: request.url,
    headers: request.headers,
  });
  if (origin.allowed) return null;
  return NextResponse.json(
    {
      error: "invalid_origin",
      message: "Cross-site AgentGuard Slack preview mutations are not allowed.",
      reason: origin.reason,
    },
    { status: 403 }
  );
}

async function requireSlackTargetManager() {
  const ctx = await getSessionContext();
  if (!ctx) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
  }
  return { ctx };
}

function attemptToApi(row: SlackAttemptRow) {
  const failure = classifyAgentExportFailure({
    status: row.status,
    deliveryMode: row.delivery_mode,
    delivery_mode: row.delivery_mode,
    httpStatus: row.http_status,
    http_status: row.http_status,
    errorMessage: row.error_message,
    error_message: row.error_message,
  });
  return {
    id: row.id,
    targetId: row.target_id,
    eventId: row.event_id,
    eventType: row.event_type,
    status: row.status,
    deliveryMode: row.delivery_mode,
    httpStatus: row.http_status,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    failureCategory: failure.category,
    failureLabel: failure.label,
    failureSummary: failure.summary,
    failureNextAction: failure.nextAction,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireSlackTargetManager();
  if ("response" in gate) return gate.response;
  const { ctx: session } = gate;

  const rl = await rateLimit(`test:agent-slack-target:${session.orgId}`, 8, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: target, error: targetError } = await supabase
    .from("agent_slack_workflow_targets")
    .select(
      "id, org_id, name, target_type, status, webhook_url_encrypted, webhook_url_hint, dry_run_enabled, user_identifier_mode, customer_approval_status"
    )
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (targetError) {
    return migrationRequired(targetError) ? migrationResponse() : dbErrorResponse(targetError);
  }
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const slackTarget = target as SlackTargetRow;
  if (slackTarget.status !== "enabled") {
    return NextResponse.json(
      {
        error: "target_disabled",
        message: "Enable this Slack preview target before sending a manual test.",
      },
      { status: 409 }
    );
  }

  const event = buildAgentGuardSlackManualTestPayload({
    orgId: session.orgId,
    targetName: slackTarget.name,
    userIdentifierMode: slackTarget.user_identifier_mode ?? "redacted",
  });
  let url = "";
  if (!slackTarget.dry_run_enabled) {
    try {
      url = decryptAgentGuardSlackWebhookUrl(slackTarget.webhook_url_encrypted);
    } catch {
      return secretConfigError();
    }
  }
  const result = await sendAgentGuardSlackWorkflowMessage(
    {
      url,
      dryRunEnabled: slackTarget.dry_run_enabled,
    },
    event,
    "manual_test"
  );

  const { data: attempt, error: attemptError } = await supabase
    .from("agent_slack_workflow_delivery_attempts")
    .insert({
      org_id: session.orgId,
      target_id: id,
      event_id: result.eventId,
      event_type: result.eventType,
      status: result.status,
      delivery_mode: result.deliveryMode,
      http_status: result.httpStatus,
      duration_ms: result.durationMs,
      error_message: result.errorMessage,
      payload: result.payload,
      created_by_user_id: session.userId,
      created_by_email: session.email,
    })
    .select(
      "id, target_id, event_id, event_type, status, delivery_mode, http_status, duration_ms, error_message, created_by_email, created_at"
    )
    .single();

  if (attemptError) {
    return migrationRequired(attemptError) ? migrationResponse() : dbErrorResponse(attemptError);
  }

  const now = new Date().toISOString();
  const targetPatch: Record<string, unknown> = {
    last_tested_at: now,
    updated_by_user_id: session.userId,
    updated_by_email: session.email,
  };
  if (result.status === "succeeded") {
    targetPatch.last_successful_test_at = now;
  }

  await supabase
    .from("agent_slack_workflow_targets")
    .update(targetPatch)
    .eq("id", id)
    .eq("org_id", session.orgId);

  await recordAudit(session, {
    action: "agent_slack_workflow_target.test",
    target_type: "agent_slack_workflow_target",
    target_id: id,
    summary: `Sent AgentGuard Slack preview test to "${slackTarget.name}" (${result.status})`,
    after: {
      event_id: result.eventId,
      event_type: result.eventType,
      status: result.status,
      delivery_mode: result.deliveryMode,
      http_status: result.httpStatus,
      duration_ms: result.durationMs,
      error_message: result.errorMessage,
      webhook_url_hint: slackTarget.webhook_url_hint,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    attempt: attemptToApi(attempt as SlackAttemptRow),
    result,
  });
}
