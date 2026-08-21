import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/validate";
import {
  AGENT_GUARD_EXPORT_SECRET_KEY_ENV,
  decryptAgentExportSigningSecret,
  type AgentExportDestinationRecord,
} from "@/lib/agent-guard/export-destinations";
import { sendAgentGuardExportTest } from "@/lib/agent-guard/export-delivery";
import { classifyAgentExportFailure } from "@/lib/agent-guard/export-hardening";

type Ctx = { params: Promise<{ id: string }> };

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
      message: `${AGENT_GUARD_EXPORT_SECRET_KEY_ENV} must be configured before export destinations can send signed test events.`,
    },
    { status: 500 }
  );
}

async function requireExportManager() {
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

export async function POST(request: NextRequest, ctx: Ctx) {
  const gate = await requireExportManager();
  if ("response" in gate) return gate.response;
  const { ctx: session } = gate;

  const rl = await rateLimit(`test:agent-export-destination:${session.orgId}`, 10, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: destination, error: destinationError } = await supabase
    .from("agent_export_destinations")
    .select(
      "id, org_id, name, destination_type, status, endpoint_url, signing_secret_encrypted, signing_secret_hint"
    )
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (destinationError) return dbErrorResponse(destinationError);
  if (!destination) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let signingSecret: string;
  try {
    signingSecret = decryptAgentExportSigningSecret(
      (destination as AgentExportDestinationRecord).signing_secret_encrypted
    );
  } catch {
    return secretConfigError();
  }

  const result = await sendAgentGuardExportTest(
    {
      url: (destination as AgentExportDestinationRecord).endpoint_url,
      signingSecret,
    },
    session.orgId
  );

  const { data: attempt, error: attemptError } = await supabase
    .from("agent_export_delivery_attempts")
    .insert({
      org_id: session.orgId,
      destination_id: id,
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
      "id, destination_id, event_id, event_type, status, delivery_mode, replayed_attempt_id, http_status, duration_ms, error_message, created_by_email, created_at"
    )
    .single();

  if (attemptError) return dbErrorResponse(attemptError);

  await supabase
    .from("agent_export_destinations")
    .update({ last_tested_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", session.orgId);

  await recordAudit(session, {
    action: "agent_export_destination.test",
    target_type: "agent_export_destination",
    target_id: id,
    summary: `Sent AgentGuard export test to "${destination.name}" (${result.status})`,
    after: {
      event_id: result.eventId,
      event_type: result.eventType,
      status: result.status,
      http_status: result.httpStatus,
      duration_ms: result.durationMs,
      error_message: result.errorMessage,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    attempt: attemptToApi(attempt as AgentExportAttemptRow),
    result,
  });
}
