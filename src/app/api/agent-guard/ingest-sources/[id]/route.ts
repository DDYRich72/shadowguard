import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentIngestSourcePatchSchema } from "@/lib/api/schemas";
import { normalizeAllowedToolNames } from "@/lib/agent-guard/ingest-sources";
import { isUuid } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

type AgentIngestSourceRow = {
  id: string;
  name: string;
  environment: string;
  status: string;
  token_hint: string;
  allowed_tool_names: string[] | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
};

function sourceToApi(row: AgentIngestSourceRow) {
  return {
    id: row.id,
    name: row.name,
    environment: row.environment,
    status: row.status,
    tokenHint: row.token_hint,
    allowedToolNames: row.allowed_tool_names ?? [],
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    lastUsedIp: row.last_used_ip,
  };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(session.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(`patch:agent-ingest-source:${session.orgId}`, 30, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(session.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await parseBody(request, agentIngestSourcePatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_ingest_sources")
    .select(
      "id, name, environment, status, token_hint, allowed_tool_names, created_by_email, created_at, updated_at, revoked_at, last_used_at, last_used_ip"
    )
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.environment !== undefined) patch.environment = body.environment;
  if (body.allowedToolNames !== undefined) {
    patch.allowed_tool_names = normalizeAllowedToolNames(body.allowedToolNames);
  }
  if (body.status === "revoked" && before.status !== "revoked") {
    patch.status = "revoked";
    patch.revoked_at = new Date().toISOString();
    patch.revoked_by_user_id = session.userId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      source: sourceToApi(before as AgentIngestSourceRow),
    });
  }

  const { data, error } = await supabase
    .from("agent_ingest_sources")
    .update(patch)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .select(
      "id, name, environment, status, token_hint, allowed_tool_names, created_by_email, created_at, updated_at, revoked_at, last_used_at, last_used_ip"
    )
    .single();

  if (error) return dbErrorResponse(error);

  const revoked = patch.status === "revoked";
  await recordAudit(session, {
    action: revoked ? "agent_ingest_source.revoke" : "agent_ingest_source.update",
    target_type: "agent_ingest_source",
    target_id: id,
    summary: `${revoked ? "Revoked" : "Updated"} AgentGuard ingest source "${data?.name}"`,
    before: before as Record<string, unknown>,
    after: patch,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ source: sourceToApi(data as AgentIngestSourceRow) });
}
