import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import {
  agentIntegrationEvidenceCreateSchema,
  parseBody,
} from "@/lib/api/schemas";
import {
  AGENT_GUARD_INTEGRATION_EVIDENCE_COPY,
  agentGuardIntegrationEvidenceRowToApi,
  isMissingAgentGuardIntegrationEvidenceTable,
  type AgentGuardIntegrationEvidenceRow,
} from "@/lib/agent-guard/integration-evidence";

type SourceIdentityRow = {
  id: string;
  name: string;
};

async function requireIntegrationEvidenceAccess(options: { requireMfa: boolean }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
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
      message: AGENT_GUARD_INTEGRATION_EVIDENCE_COPY.migrationWarning,
      evidence: [],
    },
    { status: 503 }
  );
}

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

async function sourceExists(input: {
  sourceId: string;
  orgId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
}): Promise<{ source: SourceIdentityRow } | { response: NextResponse }> {
  const { data, error } = await input.supabase
    .from("agent_ingest_sources")
    .select("id, name")
    .eq("id", input.sourceId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (error) return { response: dbErrorResponse(error) };
  if (!data) {
    return {
      response: NextResponse.json({ error: "source_not_found" }, { status: 404 }),
    };
  }
  return { source: data as SourceIdentityRow };
}

export async function GET(request: NextRequest) {
  const gate = await requireIntegrationEvidenceAccess({ requireMfa: false });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-integration-evidence:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10), 1),
    100
  );

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_integration_evidence")
    .select(EVIDENCE_SELECT)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAgentGuardIntegrationEvidenceTable(error)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  return NextResponse.json({
    evidence: ((data ?? []) as AgentGuardIntegrationEvidenceRow[]).map(
      agentGuardIntegrationEvidenceRowToApi
    ),
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireIntegrationEvidenceAccess({ requireMfa: true });
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-integration-evidence:${ctx.orgId}`, 20, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const body = await parseBody(request, agentIntegrationEvidenceCreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  if (body.sourceId) {
    const sourceResult = await sourceExists({
      sourceId: body.sourceId,
      orgId: ctx.orgId,
      supabase,
    });
    if ("response" in sourceResult) return sourceResult.response;
  }

  const insertRow = {
    org_id: ctx.orgId,
    source_id: body.sourceId,
    status: body.status,
    title: body.title,
    implementation_owner: body.implementationOwner,
    wrapper_location: body.wrapperLocation,
    evidence_url: body.evidenceUrl,
    checklist_snapshot: body.checklistSnapshot,
    note: body.note,
    created_by_user_id: ctx.userId,
    created_by_email: ctx.email,
    updated_by_user_id: ctx.userId,
    updated_by_email: ctx.email,
  };

  const { data, error } = await supabase
    .from("agent_integration_evidence")
    .insert(insertRow)
    .select(EVIDENCE_SELECT)
    .single();

  if (error) {
    if (isMissingAgentGuardIntegrationEvidenceTable(error)) {
      return migrationRequiredResponse();
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_integration_evidence.create",
    target_type: "agent_integration_evidence",
    target_id: data?.id,
    summary: `Created AgentGuard integration evidence "${body.title}"`,
    after: {
      id: data?.id,
      source_id: body.sourceId,
      status: body.status,
      title: body.title,
      implementation_owner_present: body.implementationOwner.length > 0,
      wrapper_location_present: body.wrapperLocation.length > 0,
      evidence_url_present: body.evidenceUrl.length > 0,
      note_present: body.note.length > 0,
      note_length: body.note.length,
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      evidence: agentGuardIntegrationEvidenceRowToApi(
        data as AgentGuardIntegrationEvidenceRow
      ),
    },
    { status: 201 }
  );
}
