import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import {
  agentSlackEvidencePacketCreateSchema,
  parseBody,
} from "@/lib/api/schemas";
import {
  AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY,
  agentGuardSlackEvidencePacketRowToApi,
  buildAgentGuardSlackEvidencePacketDraft,
  isMissingAgentGuardSlackEvidencePacketStorage,
  isMissingAgentGuardSlackWorkflowTables,
  type AgentGuardSlackEvidenceAttemptInput,
  type AgentGuardSlackEvidencePacketRow,
  type AgentGuardSlackEvidenceTargetInput,
} from "@/lib/agent-guard/slack-evidence-packets";
import {
  normalizeAgentGuardSlackWorkflowEventTypes,
  type AgentGuardSlackWorkflowCustomerApprovalStatus,
  type AgentGuardSlackWorkflowTargetStatus,
  type AgentGuardSlackWorkflowTargetType,
  type AgentGuardSlackWorkflowUserIdentifierMode,
} from "@/lib/agent-guard/slack-workflow-targets";

const TARGET_SELECT =
  "id, name, target_type, status, webhook_url_hint, event_types, dry_run_enabled, live_send_enabled, owner_name, owner_email, customer_approval_status, customer_approval_note, customer_approved_at, customer_approved_by_email, user_identifier_mode, last_tested_at, last_successful_test_at, last_live_attempt_at, created_at, updated_at";

const ATTEMPT_SELECT =
  "id, event_id, event_type, status, delivery_mode, http_status, duration_ms, error_message, created_by_email, created_at";

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
  last_tested_at: string | null;
  last_successful_test_at: string | null;
  last_live_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};

async function requireSlackEvidenceAccess(options: {
  mutate: boolean;
  requireMfa: boolean;
}) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (options.mutate && options.requireMfa) {
    const mfa = await getMfaSnapshot();
    if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
      return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
    }
  }
  return { ctx };
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
      message: "Cross-site AgentGuard Slack evidence mutations are not allowed.",
      reason: origin.reason,
    },
    { status: 403 }
  );
}

function evidenceMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message: AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY.migrationWarning,
      packets: [],
    },
    { status: 409 }
  );
}

function slackMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
      packets: [],
    },
    { status: 409 }
  );
}

function targetRowToSnapshot(row: SlackTargetRow): AgentGuardSlackEvidenceTargetInput {
  return {
    id: row.id,
    name: row.name,
    targetType: row.target_type,
    status: row.status,
    webhookUrlHint: row.webhook_url_hint,
    eventTypes: normalizeAgentGuardSlackWorkflowEventTypes(row.event_types),
    dryRunEnabled: row.dry_run_enabled,
    liveSendEnabled: row.live_send_enabled,
    ownerName: row.owner_name ?? "",
    ownerEmail: row.owner_email ?? "",
    customerApprovalStatus: row.customer_approval_status ?? "not_requested",
    customerApprovalNote: row.customer_approval_note ?? "",
    customerApprovedAt: row.customer_approved_at,
    customerApprovedByEmail: row.customer_approved_by_email,
    userIdentifierMode: row.user_identifier_mode ?? "redacted",
    lastTestedAt: row.last_tested_at,
    lastSuccessfulTestAt: row.last_successful_test_at,
    lastLiveAttemptAt: row.last_live_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadSlackEvidenceDraft(input: {
  orgId: string;
  targetId: string;
  title?: string | null;
  generatedByEmail: string | null;
}) {
  const supabase = await createServerSupabase();
  const { data: target, error: targetError } = await supabase
    .from("agent_slack_workflow_targets")
    .select(TARGET_SELECT)
    .eq("id", input.targetId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (targetError) {
    return {
      response: isMissingAgentGuardSlackWorkflowTables(targetError)
        ? slackMigrationRequiredResponse()
        : dbErrorResponse(targetError),
    };
  }
  if (!target) {
    return { response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }

  const { data: attempts, error: attemptError } = await supabase
    .from("agent_slack_workflow_delivery_attempts")
    .select(ATTEMPT_SELECT)
    .eq("org_id", input.orgId)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (attemptError) {
    return {
      response: isMissingAgentGuardSlackWorkflowTables(attemptError)
        ? slackMigrationRequiredResponse()
        : dbErrorResponse(attemptError),
    };
  }

  return {
    draft: buildAgentGuardSlackEvidencePacketDraft({
      target: targetRowToSnapshot(target as SlackTargetRow),
      attempts: (attempts ?? []) as AgentGuardSlackEvidenceAttemptInput[],
      generatedByEmail: input.generatedByEmail,
      title: input.title,
    }),
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireSlackEvidenceAccess({
    mutate: false,
    requireMfa: false,
  });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-slack-evidence-packets:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10), 1),
    50
  );

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_evidence_packets")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("packet_type", "slack_preview")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return isMissingAgentGuardSlackEvidencePacketStorage(error)
      ? evidenceMigrationRequiredResponse()
      : dbErrorResponse(error);
  }

  return NextResponse.json({
    packets: ((data ?? []) as AgentGuardSlackEvidencePacketRow[]).map(
      agentGuardSlackEvidencePacketRowToApi
    ),
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireSlackEvidenceAccess({
    mutate: true,
    requireMfa: true,
  });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-slack-evidence-packet:${ctx.orgId}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentSlackEvidencePacketCreateSchema);
  if (body instanceof NextResponse) return body;

  const built = await loadSlackEvidenceDraft({
    orgId: ctx.orgId,
    targetId: body.targetId,
    generatedByEmail: ctx.email,
    title: body.title,
  });
  if ("response" in built) return built.response;

  const draft = built.draft;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_evidence_packets")
    .insert({
      org_id: ctx.orgId,
      packet_type: draft.packetType,
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      summary: draft.summary,
      readiness_report: draft.snapshot,
      command_center: draft.commandCenter,
      summary_metrics: draft.summaryMetrics,
      evidence_counts: draft.evidenceCounts,
      load_warnings: draft.loadWarnings,
      packet_text: draft.packetText,
      generated_by_user_id: ctx.userId,
      generated_by_email: ctx.email,
      generated_at: draft.generatedAt,
    })
    .select("*")
    .single();

  if (error) {
    return isMissingAgentGuardSlackEvidencePacketStorage(error)
      ? evidenceMigrationRequiredResponse()
      : dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_slack_evidence_packet.create",
    target_type: "agent_evidence_packet",
    target_id: data?.id,
    summary: `Saved AgentGuard Slack evidence packet "${draft.title}"`,
    after: {
      id: data?.id,
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      slack_target_id: draft.snapshot.target.id,
      slack_target_name: draft.snapshot.target.name,
      webhook_url_hint: draft.snapshot.target.webhookUrlHint,
      total_attempt_count: draft.summaryMetrics.totalAttemptCount,
      has_manual_success: draft.summaryMetrics.hasManualSuccess,
      live_posture_on: draft.summaryMetrics.livePostureOn,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      packet: agentGuardSlackEvidencePacketRowToApi(
        data as AgentGuardSlackEvidencePacketRow
      ),
    },
    { status: 201 }
  );
}
