import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import { parseBody, agentSlackWorkflowTargetCreateSchema } from "@/lib/api/schemas";
import { classifyAgentExportFailure } from "@/lib/agent-guard/export-hardening";
import {
  AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV,
  encryptAgentGuardSlackWebhookUrl,
  hashAgentGuardSlackWebhookUrl,
  normalizeAgentGuardSlackWorkflowEventTypes,
  slackTargetAllowsAutomaticDelivery,
  validateAgentGuardSlackWebhookUrl,
  type AgentGuardSlackWorkflowCustomerApprovalStatus,
  type AgentGuardSlackWorkflowDeliveryEventType,
  type AgentGuardSlackWorkflowDeliveryMode,
  type AgentGuardSlackWorkflowDeliveryStatus,
  type AgentGuardSlackWorkflowTargetStatus,
  type AgentGuardSlackWorkflowTargetType,
  type AgentGuardSlackWorkflowUserIdentifierMode,
} from "@/lib/agent-guard/slack-workflow-targets";

const TARGET_SELECT =
  "id, name, target_type, status, webhook_url_hint, event_types, dry_run_enabled, live_send_enabled, owner_name, owner_email, customer_approval_status, customer_approval_note, customer_approved_at, customer_approved_by_email, user_identifier_mode, created_by_email, updated_by_email, last_tested_at, last_successful_test_at, last_live_attempt_at, created_at, updated_at";

const ATTEMPT_SELECT =
  "id, target_id, event_id, event_type, status, delivery_mode, http_status, duration_ms, error_message, created_by_email, created_at";

type SlackTargetRow = {
  id: string;
  name: string;
  target_type: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhook_url_hint: string;
  event_types: string[] | null;
  dry_run_enabled: boolean;
  live_send_enabled: boolean;
  owner_name: string | null;
  owner_email: string | null;
  customer_approval_status: AgentGuardSlackWorkflowCustomerApprovalStatus | null;
  customer_approval_note: string | null;
  customer_approved_at: string | null;
  customer_approved_by_email: string | null;
  user_identifier_mode: AgentGuardSlackWorkflowUserIdentifierMode | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  last_tested_at: string | null;
  last_successful_test_at: string | null;
  last_live_attempt_at: string | null;
  created_at: string;
  updated_at: string;
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
      message: `${AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV} must be configured before Slack target URLs can be stored.`,
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

async function requireSlackTargetAccess(options: { requireMfa: boolean }) {
  const ctx = await getSessionContext();
  if (!ctx) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (options.requireMfa) {
    const mfa = await getMfaSnapshot();
    if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
      return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
    }
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

function targetToApi(row: SlackTargetRow, latestAttempt: SlackAttemptRow | null = null) {
  return {
    id: row.id,
    name: row.name,
    targetType: row.target_type,
    status: row.status,
    webhookUrlHint: row.webhook_url_hint,
    eventTypes: normalizeAgentGuardSlackWorkflowEventTypes(row.event_types),
    dryRunEnabled: row.dry_run_enabled,
    liveSendEnabled: row.live_send_enabled,
    liveEligible: slackTargetAllowsAutomaticDelivery(
      {
        status: row.status,
        live_send_enabled: row.live_send_enabled,
        event_types: row.event_types,
        customer_approval_status: row.customer_approval_status,
        last_successful_test_at: row.last_successful_test_at,
      },
      "agentguard.policy.blocked"
    ) || slackTargetAllowsAutomaticDelivery(
      {
        status: row.status,
        live_send_enabled: row.live_send_enabled,
        event_types: row.event_types,
        customer_approval_status: row.customer_approval_status,
        last_successful_test_at: row.last_successful_test_at,
      },
      "agentguard.review.required"
    ),
    ownerName: row.owner_name ?? "",
    ownerEmail: row.owner_email ?? "",
    customerApprovalStatus: row.customer_approval_status ?? "not_requested",
    customerApprovalNote: row.customer_approval_note ?? "",
    customerApprovedAt: row.customer_approved_at,
    customerApprovedByEmail: row.customer_approved_by_email,
    userIdentifierMode: row.user_identifier_mode ?? "redacted",
    createdByEmail: row.created_by_email,
    updatedByEmail: row.updated_by_email,
    lastTestedAt: row.last_tested_at,
    lastSuccessfulTestAt: row.last_successful_test_at,
    lastLiveAttemptAt: row.last_live_attempt_at,
    latestAttempt: latestAttempt ? attemptToApi(latestAttempt) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const gate = await requireSlackTargetAccess({ requireMfa: false });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-slack-targets:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data: targetRows, error: targetError } = await supabase
    .from("agent_slack_workflow_targets")
    .select(TARGET_SELECT)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (targetError) {
    return migrationRequired(targetError) ? migrationResponse() : dbErrorResponse(targetError);
  }

  const { data: attemptRows, error: attemptError } = await supabase
    .from("agent_slack_workflow_delivery_attempts")
    .select(ATTEMPT_SELECT)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (attemptError) {
    return migrationRequired(attemptError) ? migrationResponse() : dbErrorResponse(attemptError);
  }

  const attempts = (attemptRows ?? []).map((row) => row as SlackAttemptRow);
  const latestAttemptByTarget = new Map<string, SlackAttemptRow>();
  for (const attempt of attempts) {
    if (!attempt.target_id) continue;
    if (!latestAttemptByTarget.has(attempt.target_id)) {
      latestAttemptByTarget.set(attempt.target_id, attempt);
    }
  }

  return NextResponse.json({
    targets: (targetRows ?? []).map((row) =>
      targetToApi(
        row as SlackTargetRow,
        latestAttemptByTarget.get(row.id) ?? null
      )
    ),
    attempts: attempts.map((row) => attemptToApi(row)),
    total: targetRows?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireSlackTargetAccess({ requireMfa: true });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-slack-target:${ctx.orgId}`, 8, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentSlackWorkflowTargetCreateSchema);
  if (body instanceof NextResponse) return body;

  const slackUrl = validateAgentGuardSlackWebhookUrl(body.webhookUrl);
  if (!slackUrl.ok) {
    return NextResponse.json(
      { error: "invalid_slack_url", message: slackUrl.reason },
      { status: 400 }
    );
  }
  if (body.targetType && body.targetType !== slackUrl.targetType) {
    return NextResponse.json(
      {
        error: "slack_target_type_mismatch",
        message:
          "Slack target type must match the provided URL path: /triggers/... for workflow webhooks or /services/... for incoming webhooks.",
      },
      { status: 400 }
    );
  }

  let encryptedUrl: string;
  try {
    encryptedUrl = encryptAgentGuardSlackWebhookUrl(slackUrl.url);
  } catch {
    return secretConfigError();
  }

  const now = new Date().toISOString();
  const approved = body.customerApprovalStatus === "approved";
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_slack_workflow_targets")
    .insert({
      org_id: ctx.orgId,
      name: body.name,
      target_type: slackUrl.targetType,
      status: "disabled",
      webhook_url_encrypted: encryptedUrl,
      webhook_url_hash: hashAgentGuardSlackWebhookUrl(slackUrl.url),
      webhook_url_hint: slackUrl.hint,
      event_types: body.eventTypes,
      dry_run_enabled: body.dryRunEnabled,
      live_send_enabled: false,
      owner_name: body.ownerName,
      owner_email: body.ownerEmail,
      customer_approval_status: body.customerApprovalStatus,
      customer_approval_note: body.customerApprovalNote,
      customer_approved_at: approved ? now : null,
      customer_approved_by_email: approved ? ctx.email : null,
      user_identifier_mode: body.userIdentifierMode,
      created_by_user_id: ctx.userId,
      created_by_email: ctx.email,
      updated_by_user_id: ctx.userId,
      updated_by_email: ctx.email,
    })
    .select(TARGET_SELECT)
    .single();

  if (error) {
    if (migrationRequired(error)) return migrationResponse();
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "duplicate_slack_target",
          message: "A Slack preview target with this URL already exists.",
        },
        { status: 409 }
      );
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_slack_workflow_target.create",
    target_type: "agent_slack_workflow_target",
    target_id: data?.id,
    summary: `Created AgentGuard Slack preview target "${data?.name}"`,
    after: {
      id: data?.id,
      name: data?.name,
      target_type: data?.target_type,
      status: data?.status,
      webhook_url_hint: data?.webhook_url_hint,
      event_types: data?.event_types,
      dry_run_enabled: data?.dry_run_enabled,
      live_send_enabled: data?.live_send_enabled,
      owner_name: data?.owner_name,
      owner_email: data?.owner_email,
      customer_approval_status: data?.customer_approval_status,
      user_identifier_mode: data?.user_identifier_mode,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    target: targetToApi(data as SlackTargetRow),
  });
}
