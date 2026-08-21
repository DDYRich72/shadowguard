import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentRolloutAcknowledgementCreateSchema } from "@/lib/api/schemas";
import {
  AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY,
  isMissingRolloutAcknowledgementsTable,
  rolloutAcknowledgementRowToApi,
  type AgentGuardRolloutAcknowledgementRow,
} from "@/lib/agent-guard/rollout-acknowledgements";

type AgentIngestSourceIdentityRow = {
  id: string;
  name: string;
  environment: "production" | "staging" | "development" | "other";
  status: "active" | "revoked";
};

async function requireRolloutAcknowledgementManager(options: { requireMfa: boolean }) {
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

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message: AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY.migrationWarning,
      acknowledgements: [],
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const gate = await requireRolloutAcknowledgementManager({ requireMfa: false });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-rollout-acknowledgements:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10), 1),
    100
  );

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_rollout_acknowledgements")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRolloutAcknowledgementsTable(error)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  return NextResponse.json({
    acknowledgements: ((data ?? []) as AgentGuardRolloutAcknowledgementRow[]).map(
      rolloutAcknowledgementRowToApi
    ),
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireRolloutAcknowledgementManager({ requireMfa: true });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-rollout-acknowledgement:${ctx.orgId}`, 20, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentRolloutAcknowledgementCreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: sourceRow, error: sourceError } = await supabase
    .from("agent_ingest_sources")
    .select("id, name, environment, status")
    .eq("id", body.sourceId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (sourceError) return dbErrorResponse(sourceError);
  if (!sourceRow) {
    return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  }

  const source = sourceRow as AgentIngestSourceIdentityRow;
  const insertRow = {
    org_id: ctx.orgId,
    source_id: source.id,
    source_name: source.name,
    source_environment: source.environment,
    source_status: source.status,
    source_rollout_status: body.sourceRolloutStatus,
    source_rollout_label: body.sourceRolloutLabel,
    source_next_step: body.sourceNextStep,
    overall_rollout_status: body.overallRolloutStatus,
    overall_rollout_label: body.overallRolloutLabel,
    export_posture_label: body.exportPostureLabel,
    export_warning: body.exportWarning ?? null,
    checklist_snapshot: body.checklistSnapshot,
    metrics_snapshot: body.metricsSnapshot,
    note: body.note,
    acknowledged_by_user_id: ctx.userId,
    acknowledged_by_email: ctx.email,
  };

  const { data, error } = await supabase
    .from("agent_rollout_acknowledgements")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    if (isMissingRolloutAcknowledgementsTable(error)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_rollout_acknowledgement.create",
    target_type: "agent_rollout_acknowledgement",
    target_id: data?.id,
    summary: `Acknowledged AgentGuard rollout posture for "${source.name}"`,
    after: {
      id: data?.id,
      source_id: source.id,
      source_rollout_status: body.sourceRolloutStatus,
      overall_rollout_status: body.overallRolloutStatus,
      export_posture_label: body.exportPostureLabel,
      note_present: body.note.length > 0,
      note_length: body.note.length,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      acknowledgement: rolloutAcknowledgementRowToApi(
        data as AgentGuardRolloutAcknowledgementRow
      ),
    },
    { status: 201 }
  );
}
