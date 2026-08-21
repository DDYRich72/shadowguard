import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  mcpToolCreateSchema,
  parseBody,
  type MCPToolCreateBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { isUuid } from "@/lib/validate";
import { calculateMCPToolRisk } from "@/lib/mcp-governance/risk";
import {
  MCP_TOOL_DUPLICATE_ERROR,
  MCP_TOOL_DUPLICATE_MESSAGE,
  isMCPToolNameConflict,
} from "@/lib/mcp-governance/api-errors";

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

function createToRow(body: MCPToolCreateBody, serverId: string, orgId: string, userId: string) {
  const risk = calculateMCPToolRisk({
    capabilityCategories: body.capabilityCategories,
    dataSensitivity: body.dataSensitivity,
    externalAccess: body.externalAccess,
    writeAccess: body.writeAccess,
    credentialAccess: body.credentialAccess,
    approvalStatus: body.approvalStatus,
  });

  return {
    org_id: orgId,
    mcp_server_id: serverId,
    ai_system_id: body.aiSystemId,
    name: body.name,
    description: body.description,
    capability_categories: body.capabilityCategories,
    data_sensitivity: body.dataSensitivity,
    external_access: body.externalAccess,
    write_access: body.writeAccess,
    credential_access: body.credentialAccess,
    approval_status: body.approvalStatus,
    risk_tier: risk.tier,
    risk_score: risk.score,
    owner_name: body.ownerName,
    owner_email: body.ownerEmail || null,
    status: body.status,
    created_by: userId,
    archived_at: body.status === "archived" ? new Date().toISOString() : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-server-tools:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
  const supabase = await createServerSupabase();
  const { data: server, error: serverError } = await supabase
    .from("mcp_servers")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (serverError) return dbErrorResponse(serverError);
  if (!server) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let query = supabase
    .from("mcp_tools")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("mcp_server_id", id)
    .order("risk_score", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!includeArchived) query = query.neq("status", "archived");

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    tools: data ?? [],
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, mcpToolCreateSchema);
  if (body instanceof NextResponse) return body;

  if (!(await aiSystemBelongsToOrg(body.aiSystemId, ctx.orgId))) {
    return NextResponse.json({ error: "invalid_ai_system" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: server, error: serverError } = await supabase
    .from("mcp_servers")
    .select("id, name")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (serverError) return dbErrorResponse(serverError);
  if (!server) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase
    .from("mcp_tools")
    .insert(createToRow(body, id, ctx.orgId, ctx.userId))
    .select("*")
    .single();

  if (error) {
    if (isMCPToolNameConflict(error)) {
      return NextResponse.json(
        {
          error: MCP_TOOL_DUPLICATE_ERROR,
          message: MCP_TOOL_DUPLICATE_MESSAGE,
        },
        { status: 409 }
      );
    }
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "mcp_tool.create",
    target_type: "mcp_tool",
    target_id: data.id,
    summary: `Created MCP tool ${data.name}`,
    after: {
      name: data.name,
      mcp_server_id: data.mcp_server_id,
      risk_tier: data.risk_tier,
      approval_status: data.approval_status,
      ai_system_id: data.ai_system_id,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, tool: data }, { status: 201 });
}
