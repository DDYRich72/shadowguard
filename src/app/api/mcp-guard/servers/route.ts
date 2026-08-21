import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  mcpServerCreateSchema,
  parseBody,
  type MCPServerCreateBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

function createToRow(body: MCPServerCreateBody, orgId: string, userId: string) {
  return {
    org_id: orgId,
    ai_system_id: body.aiSystemId,
    name: body.name,
    description: body.description,
    server_url: body.serverUrl,
    transport: body.transport,
    owner_name: body.ownerName,
    owner_email: body.ownerEmail || null,
    department: body.department,
    environment: body.environment,
    status: body.status,
    approval_status: body.approvalStatus,
    created_by: userId,
    archived_at: body.status === "archived" ? new Date().toISOString() : null,
  };
}

async function requireMutation() {
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

async function aiSystemBelongsToOrg(aiSystemId: string | null, orgId: string): Promise<boolean> {
  if (!aiSystemId) return true;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_systems")
    .select("id")
    .eq("id", aiSystemId)
    .eq("org_id", orgId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-servers:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
  const supabase = await createServerSupabase();
  let query = supabase
    .from("mcp_servers")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (!includeArchived) query = query.neq("status", "archived");

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    servers: data ?? [],
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const body = await parseBody(request, mcpServerCreateSchema);
  if (body instanceof NextResponse) return body;

  if (!(await aiSystemBelongsToOrg(body.aiSystemId, ctx.orgId))) {
    return NextResponse.json({ error: "invalid_ai_system" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_servers")
    .insert(createToRow(body, ctx.orgId, ctx.userId))
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "mcp_server.create",
    target_type: "mcp_server",
    target_id: data.id,
    summary: `Created MCP server ${data.name}`,
    after: {
      name: data.name,
      approval_status: data.approval_status,
      status: data.status,
      ai_system_id: data.ai_system_id,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, server: data }, { status: 201 });
}
