import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import { parseBody, agentSlackWorkflowTargetPatchSchema } from "@/lib/api/schemas";
import { isUuid } from "@/lib/validate";
import {
  AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV,
  encryptAgentGuardSlackWebhookUrl,
  hashAgentGuardSlackWebhookUrl,
  normalizeAgentGuardSlackWorkflowEventTypes,
  slackTargetAllowsAutomaticDelivery,
  validateAgentGuardSlackWebhookUrl,
  type AgentGuardSlackWorkflowCustomerApprovalStatus,
  type AgentGuardSlackWorkflowTargetStatus,
  type AgentGuardSlackWorkflowTargetType,
  type AgentGuardSlackWorkflowUserIdentifierMode,
} from "@/lib/agent-guard/slack-workflow-targets";

const TARGET_SELECT =
  "id, name, target_type, status, webhook_url_hint, event_types, dry_run_enabled, live_send_enabled, owner_name, owner_email, customer_approval_status, customer_approval_note, customer_approved_at, customer_approved_by_email, user_identifier_mode, created_by_email, updated_by_email, last_tested_at, last_successful_test_at, last_live_attempt_at, created_at, updated_at";

const TARGET_SELECT_WITH_SECRET = `${TARGET_SELECT}, webhook_url_hash`;

type Ctx = { params: Promise<{ id: string }> };

type SlackTargetRow = {
  id: string;
  name: string;
  target_type: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhook_url_hint: string;
  webhook_url_hash?: string | null;
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

function secretConfigError() {
  return NextResponse.json(
    {
      error: "slack_url_secret_key_missing",
      message: `${AGENT_GUARD_SLACK_URL_SECRET_KEY_ENV} must be configured before Slack target URLs can be replaced.`,
    },
    { status: 500 }
  );
}

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

function targetToApi(row: SlackTargetRow) {
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
      row,
      "agentguard.policy.blocked"
    ) || slackTargetAllowsAutomaticDelivery(row, "agentguard.review.required"),
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizedTarget(row: SlackTargetRow) {
  return {
    id: row.id,
    name: row.name,
    target_type: row.target_type,
    status: row.status,
    webhook_url_hint: row.webhook_url_hint,
    event_types: row.event_types,
    dry_run_enabled: row.dry_run_enabled,
    live_send_enabled: row.live_send_enabled,
    owner_name: row.owner_name,
    owner_email: row.owner_email,
    customer_approval_status: row.customer_approval_status,
    user_identifier_mode: row.user_identifier_mode,
  };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireSlackTargetManager();
  if ("response" in gate) return gate.response;
  const { ctx: session } = gate;

  const rl = await rateLimit(`patch:agent-slack-target:${session.orgId}`, 20, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await parseBody(request, agentSlackWorkflowTargetPatchSchema);
  if (body instanceof NextResponse) return body;
  if (body.targetType !== undefined && body.webhookUrl === undefined) {
    return NextResponse.json(
      {
        error: "slack_target_type_requires_url",
        message:
          "Replace the Slack URL when changing target type so the stored type matches the URL path.",
      },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_slack_workflow_targets")
    .select(TARGET_SELECT_WITH_SECRET)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (beforeError) {
    return migrationRequired(beforeError) ? migrationResponse() : dbErrorResponse(beforeError);
  }
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const typedBefore = before as SlackTargetRow;
  const patch: Record<string, unknown> = {
    updated_by_user_id: session.userId,
    updated_by_email: session.email,
  };
  const auditAfter: Record<string, unknown> = {};

  if (body.name !== undefined) {
    patch.name = body.name;
    auditAfter.name = body.name;
  }
  if (body.status !== undefined) {
    patch.status = body.status;
    auditAfter.status = body.status;
    if (body.status === "disabled") {
      patch.live_send_enabled = false;
      auditAfter.live_send_enabled = false;
    }
  }
  if (body.eventTypes !== undefined) {
    patch.event_types = body.eventTypes;
    auditAfter.event_types = body.eventTypes;
  }
  if (body.dryRunEnabled !== undefined) {
    patch.dry_run_enabled = body.dryRunEnabled;
    auditAfter.dry_run_enabled = body.dryRunEnabled;
  }
  if (body.liveSendEnabled !== undefined) {
    patch.live_send_enabled = body.liveSendEnabled;
    auditAfter.live_send_enabled = body.liveSendEnabled;
  }
  if (body.ownerName !== undefined) {
    patch.owner_name = body.ownerName;
    auditAfter.owner_name = body.ownerName;
  }
  if (body.ownerEmail !== undefined) {
    patch.owner_email = body.ownerEmail;
    auditAfter.owner_email = body.ownerEmail;
  }
  if (body.customerApprovalStatus !== undefined) {
    patch.customer_approval_status = body.customerApprovalStatus;
    auditAfter.customer_approval_status = body.customerApprovalStatus;
    if (
      body.customerApprovalStatus === "approved" &&
      typedBefore.customer_approval_status !== "approved"
    ) {
      patch.customer_approved_at = new Date().toISOString();
      patch.customer_approved_by_email = session.email;
    }
    if (
      body.customerApprovalStatus !== "approved" &&
      typedBefore.customer_approval_status === "approved"
    ) {
      patch.customer_approved_at = null;
      patch.customer_approved_by_email = null;
    }
  }
  if (body.customerApprovalNote !== undefined) {
    patch.customer_approval_note = body.customerApprovalNote;
    auditAfter.customer_approval_note = body.customerApprovalNote;
  }
  if (body.userIdentifierMode !== undefined) {
    patch.user_identifier_mode = body.userIdentifierMode;
    auditAfter.user_identifier_mode = body.userIdentifierMode;
  }
  if (body.webhookUrl !== undefined) {
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

    try {
      patch.webhook_url_encrypted = encryptAgentGuardSlackWebhookUrl(slackUrl.url);
    } catch {
      return secretConfigError();
    }
    patch.webhook_url_hash = hashAgentGuardSlackWebhookUrl(slackUrl.url);
    patch.webhook_url_hint = slackUrl.hint;
    patch.target_type = slackUrl.targetType;
    patch.last_tested_at = null;
    patch.last_successful_test_at = null;
    patch.live_send_enabled = false;
    auditAfter.target_type = slackUrl.targetType;
    auditAfter.webhook_url_hint = slackUrl.hint;
    auditAfter.webhook_url_replaced = true;
    auditAfter.live_send_enabled = false;
  }

  const finalStatus = (patch.status ?? typedBefore.status) as AgentGuardSlackWorkflowTargetStatus;
  const finalApproval = (patch.customer_approval_status ??
    typedBefore.customer_approval_status) as AgentGuardSlackWorkflowCustomerApprovalStatus | null;
  const finalLastSuccessfulTest =
    body.webhookUrl !== undefined ? null : typedBefore.last_successful_test_at;
  if (
    patch.live_send_enabled === true &&
    (finalStatus !== "enabled" ||
      finalApproval !== "approved" ||
      !finalLastSuccessfulTest)
  ) {
    return NextResponse.json(
      {
        error: "live_send_gate_not_ready",
        message:
          "Live Slack preview sends require an enabled target, customer approval, and a successful manual test after the current URL was saved.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("agent_slack_workflow_targets")
    .update(patch)
    .eq("id", id)
    .eq("org_id", session.orgId)
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

  await recordAudit(session, {
    action: "agent_slack_workflow_target.update",
    target_type: "agent_slack_workflow_target",
    target_id: id,
    summary: `Updated AgentGuard Slack preview target "${data?.name}"`,
    before: sanitizedTarget(typedBefore),
    after: auditAfter,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    target: targetToApi(data as SlackTargetRow),
  });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireSlackTargetManager();
  if ("response" in gate) return gate.response;
  const { ctx: session } = gate;

  const rl = await rateLimit(`delete:agent-slack-target:${session.orgId}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_slack_workflow_targets")
    .select(TARGET_SELECT_WITH_SECRET)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (beforeError) {
    return migrationRequired(beforeError) ? migrationResponse() : dbErrorResponse(beforeError);
  }
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await supabase
    .from("agent_slack_workflow_targets")
    .delete()
    .eq("id", id)
    .eq("org_id", session.orgId);

  if (error) return dbErrorResponse(error);

  await recordAudit(session, {
    action: "agent_slack_workflow_target.delete",
    target_type: "agent_slack_workflow_target",
    target_id: id,
    summary: `Deleted AgentGuard Slack preview target "${before.name}"`,
    before: sanitizedTarget(before as SlackTargetRow),
    after: { deleted: true },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
