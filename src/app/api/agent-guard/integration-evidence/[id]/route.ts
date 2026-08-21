import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentIntegrationEvidencePatchSchema } from "@/lib/api/schemas";
import { isUuid } from "@/lib/validate";
import {
  AGENT_GUARD_INTEGRATION_EVIDENCE_COPY,
  agentGuardIntegrationEvidenceRowToApi,
  isMissingAgentGuardIntegrationEvidenceTable,
  type AgentGuardIntegrationEvidenceRow,
} from "@/lib/agent-guard/integration-evidence";

type Ctx = { params: Promise<{ id: string }> };

const EVIDENCE_SELECT = `
  id,
  source_id,
  status,
  title,
  implementation_owner,
  wrapper_location,
  evidence_url,
  checklist_snapshot,
  note,
  created_by_user_id,
  created_by_email,
  updated_by_user_id,
  updated_by_email,
  created_at,
  updated_at,
  agent_ingest_sources(name, environment, status)
`;

async function requireIntegrationEvidenceManager() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
  }
  return { ctx };
}

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message: AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.migrationWarning,
    },
    { status: 503 }
  );
}

export async function PATCH(request: NextRequest, routeCtx: Ctx) {
  const gate = await requireIntegrationEvidenceManager();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`patch:agent-integration-evidence:${ctx.orgId}`, 30, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await routeCtx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await parseBody(request, agentIntegrationEvidencePatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_integration_evidence")
    .select(EVIDENCE_SELECT)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) {
    if (isMissingAgentGuardIntegrationEvidenceTable(beforeError)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(beforeError);
  }
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.sourceId) {
    const { data: sourceRow, error: sourceError } = await supabase
      .from("agent_ingest_sources")
      .select("id")
      .eq("id", body.sourceId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (sourceError) return dbErrorResponse(sourceError);
    if (!sourceRow) {
      return NextResponse.json({ error: "source_not_found" }, { status: 404 });
    }
  }

  const patch: Record<string, unknown> = {
    updated_by_user_id: ctx.userId,
    updated_by_email: ctx.email,
  };
  if (body.sourceId !== undefined) patch.source_id = body.sourceId;
  if (body.status !== undefined) patch.status = body.status;
  if (body.title !== undefined) patch.title = body.title;
  if (body.implementationOwner !== undefined) {
    patch.implementation_owner = body.implementationOwner;
  }
  if (body.wrapperLocation !== undefined) patch.wrapper_location = body.wrapperLocation;
  if (body.evidenceUrl !== undefined) patch.evidence_url = body.evidenceUrl;
  if (body.checklistSnapshot !== undefined) {
    patch.checklist_snapshot = body.checklistSnapshot;
  }
  if (body.note !== undefined) patch.note = body.note;

  const { data, error } = await supabase
    .from("agent_integration_evidence")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select(EVIDENCE_SELECT)
    .single();

  if (error) {
    if (isMissingAgentGuardIntegrationEvidenceTable(error)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_integration_evidence.update",
    target_type: "agent_integration_evidence",
    target_id: id,
    summary: `Updated AgentGuard integration evidence "${data?.title}"`,
    before: {
      id,
      status: (before as AgentGuardIntegrationEvidenceRow).status,
      title: (before as AgentGuardIntegrationEvidenceRow).title,
      source_id: (before as AgentGuardIntegrationEvidenceRow).source_id,
    },
    after: {
      ...patch,
      note_present: typeof body.note === "string" ? body.note.length > 0 : undefined,
      note_length: typeof body.note === "string" ? body.note.length : undefined,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    evidence: agentGuardIntegrationEvidenceRowToApi(
      data as AgentGuardIntegrationEvidenceRow
    ),
  });
}
