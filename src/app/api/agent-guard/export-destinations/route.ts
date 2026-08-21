import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentExportDestinationCreateSchema } from "@/lib/api/schemas";
import {
  AGENT_GUARD_EXPORT_SECRET_KEY_ENV,
  encryptAgentExportSigningSecret,
  generateAgentExportSigningSecret,
  hashAgentExportSigningSecret,
  normalizeAgentExportEventTypes,
  signingSecretHint,
  validateAgentExportDestinationUrl,
  type AgentExportDestinationStatus,
  type AgentExportDestinationType,
} from "@/lib/agent-guard/export-destinations";
import { agentExportDestinationHealth } from "@/lib/agent-guard/export-health";
import {
  classifyAgentExportFailure,
  type AgentExportReceiverAcknowledgementStatus,
} from "@/lib/agent-guard/export-hardening";

const DESTINATION_SELECT =
  "id, name, destination_type, status, endpoint_url, signing_secret_hint, automatic_delivery_enabled, dry_run_enabled, event_types, owner_name, owner_email, escalation_path, receiver_acknowledgement_status, receiver_acknowledgement_note, receiver_acknowledged_at, receiver_acknowledged_by_email, created_by_email, last_tested_at, last_automatic_attempt_at, created_at, updated_at";

type AgentExportDestinationRow = {
  id: string;
  name: string;
  destination_type: AgentExportDestinationType;
  status: AgentExportDestinationStatus;
  endpoint_url: string;
  signing_secret_hint: string;
  automatic_delivery_enabled: boolean;
  dry_run_enabled: boolean;
  event_types: string[] | null;
  owner_name: string | null;
  owner_email: string | null;
  escalation_path: string | null;
  receiver_acknowledgement_status: AgentExportReceiverAcknowledgementStatus | null;
  receiver_acknowledgement_note: string | null;
  receiver_acknowledged_at: string | null;
  receiver_acknowledged_by_email: string | null;
  created_by_email: string | null;
  last_tested_at: string | null;
  last_automatic_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentExportAttemptRow = {
  id: string;
  destination_id: string | null;
  event_id: string;
  event_type: string;
  status: "succeeded" | "failed" | "dry_run";
  delivery_mode: "manual_test" | "automatic" | "dry_run" | "manual_replay";
  replayed_attempt_id: string | null;
  http_status: number | null;
  duration_ms: number;
  error_message: string | null;
  created_by_email: string | null;
  created_at: string;
};

function destinationToApi(
  row: AgentExportDestinationRow,
  latestAttempt: AgentExportAttemptRow | null = null
) {
  const health = agentExportDestinationHealth(row, latestAttempt);
  return {
    id: row.id,
    name: row.name,
    destinationType: row.destination_type,
    status: row.status,
    endpointUrl: row.endpoint_url,
    signingSecretHint: row.signing_secret_hint,
    automaticDeliveryEnabled: row.automatic_delivery_enabled,
    dryRunEnabled: row.dry_run_enabled,
    eventTypes: normalizeAgentExportEventTypes(row.event_types),
    ownerName: row.owner_name ?? "",
    ownerEmail: row.owner_email ?? "",
    escalationPath: row.escalation_path ?? "",
    receiverAcknowledgementStatus:
      row.receiver_acknowledgement_status ?? "not_requested",
    receiverAcknowledgementNote: row.receiver_acknowledgement_note ?? "",
    receiverAcknowledgedAt: row.receiver_acknowledged_at,
    receiverAcknowledgedByEmail: row.receiver_acknowledged_by_email,
    createdByEmail: row.created_by_email,
    lastTestedAt: row.last_tested_at,
    lastAutomaticAttemptAt: row.last_automatic_attempt_at,
    healthStatus: health.status,
    healthLabel: health.label,
    healthSummary: health.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptToApi(row: AgentExportAttemptRow) {
  const failure = classifyAgentExportFailure(row);
  return {
    id: row.id,
    destinationId: row.destination_id,
    eventId: row.event_id,
    eventType: row.event_type,
    status: row.status,
    deliveryMode: row.delivery_mode,
    replayedAttemptId: row.replayed_attempt_id,
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

function secretConfigError() {
  return NextResponse.json(
    {
      error: "export_secret_key_missing",
      message: `${AGENT_GUARD_EXPORT_SECRET_KEY_ENV} must be configured before export destinations can store signing secrets.`,
    },
    { status: 500 }
  );
}

async function requireExportManager(options: { requireMfa: boolean }) {
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

export async function GET() {
  const gate = await requireExportManager({ requireMfa: false });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-export-destinations:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data: destinationRows, error: destinationError } = await supabase
    .from("agent_export_destinations")
    .select(DESTINATION_SELECT)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (destinationError) return dbErrorResponse(destinationError);

  const { data: attemptRows, error: attemptError } = await supabase
    .from("agent_export_delivery_attempts")
    .select(
      "id, destination_id, event_id, event_type, status, delivery_mode, replayed_attempt_id, http_status, duration_ms, error_message, created_by_email, created_at"
    )
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (attemptError) return dbErrorResponse(attemptError);

  const attempts = (attemptRows ?? []).map((row) =>
    row as AgentExportAttemptRow
  );
  const latestAttemptByDestination = new Map<string, AgentExportAttemptRow>();
  for (const attempt of attempts) {
    if (!attempt.destination_id) continue;
    if (!latestAttemptByDestination.has(attempt.destination_id)) {
      latestAttemptByDestination.set(attempt.destination_id, attempt);
    }
  }

  return NextResponse.json({
    destinations: (destinationRows ?? []).map((row) =>
      destinationToApi(
        row as AgentExportDestinationRow,
        latestAttemptByDestination.get(row.id) ?? null
      )
    ),
    attempts: attempts.map((row) => attemptToApi(row)),
    total: destinationRows?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireExportManager({ requireMfa: true });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-export-destination:${ctx.orgId}`, 12, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentExportDestinationCreateSchema);
  if (body instanceof NextResponse) return body;

  const destinationUrl = validateAgentExportDestinationUrl(body.endpointUrl);
  if (!destinationUrl.ok) {
    return NextResponse.json(
      { error: "invalid_destination_url", message: destinationUrl.reason },
      { status: 400 }
    );
  }

  const signingSecret = generateAgentExportSigningSecret();
  let encryptedSecret: string;
  try {
    encryptedSecret = encryptAgentExportSigningSecret(signingSecret);
  } catch {
    return secretConfigError();
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_export_destinations")
    .insert({
      org_id: ctx.orgId,
      name: body.name,
      destination_type: body.destinationType,
      status: "disabled",
      endpoint_url: destinationUrl.url,
      signing_secret_encrypted: encryptedSecret,
      signing_secret_hash: hashAgentExportSigningSecret(signingSecret),
      signing_secret_hint: signingSecretHint(signingSecret),
      automatic_delivery_enabled: body.automaticDeliveryEnabled,
      dry_run_enabled: body.dryRunEnabled,
      event_types: body.eventTypes,
      created_by_user_id: ctx.userId,
      created_by_email: ctx.email,
    })
    .select(DESTINATION_SELECT)
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "agent_export_destination.create",
    target_type: "agent_export_destination",
    target_id: data?.id,
    summary: `Created AgentGuard export destination "${data?.name}"`,
    after: {
      id: data?.id,
      name: data?.name,
      destination_type: data?.destination_type,
      status: data?.status,
      endpoint_url: data?.endpoint_url,
      signing_secret_hint: data?.signing_secret_hint,
      automatic_delivery_enabled: data?.automatic_delivery_enabled,
      dry_run_enabled: data?.dry_run_enabled,
      event_types: data?.event_types,
      owner_name: data?.owner_name,
      owner_email: data?.owner_email,
      escalation_path: data?.escalation_path,
      receiver_acknowledgement_status:
        data?.receiver_acknowledgement_status,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    destination: destinationToApi(data as AgentExportDestinationRow),
    signingSecret,
  });
}
