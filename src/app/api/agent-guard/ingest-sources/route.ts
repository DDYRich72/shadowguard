import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, agentIngestSourceCreateSchema } from "@/lib/api/schemas";
import {
  generateAgentIngestToken,
  hashAgentIngestToken,
  normalizeAllowedToolNames,
  tokenHint,
} from "@/lib/agent-guard/ingest-sources";

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

async function requireSourceManager() {
  const ctx = await getSessionContext();
  if (!ctx) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ctx };
}

export async function GET() {
  const gate = await requireSourceManager();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`get:agent-ingest-sources:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_ingest_sources")
    .select(
      "id, name, environment, status, token_hint, allowed_tool_names, created_by_email, created_at, updated_at, revoked_at, last_used_at, last_used_ip"
    )
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    sources: (data ?? []).map((row) => sourceToApi(row as AgentIngestSourceRow)),
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireSourceManager();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const rl = await rateLimit(`create:agent-ingest-source:${ctx.orgId}`, 20, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }

  const body = await parseBody(request, agentIngestSourceCreateSchema);
  if (body instanceof NextResponse) return body;

  const sourceKey = generateAgentIngestToken();
  const allowedToolNames = normalizeAllowedToolNames(body.allowedToolNames);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_ingest_sources")
    .insert({
      org_id: ctx.orgId,
      name: body.name,
      environment: body.environment,
      token_hash: hashAgentIngestToken(sourceKey),
      token_hint: tokenHint(sourceKey),
      allowed_tool_names: allowedToolNames,
      created_by_user_id: ctx.userId,
      created_by_email: ctx.email,
    })
    .select(
      "id, name, environment, status, token_hint, allowed_tool_names, created_by_email, created_at, updated_at, revoked_at, last_used_at, last_used_ip"
    )
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "agent_ingest_source.create",
    target_type: "agent_ingest_source",
    target_id: data?.id,
    summary: `Created AgentGuard ingest source "${data?.name}"`,
    after: {
      id: data?.id,
      name: data?.name,
      environment: data?.environment,
      allowed_tool_names: data?.allowed_tool_names ?? [],
    },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    source: sourceToApi(data as AgentIngestSourceRow),
    sourceKey,
  });
}
