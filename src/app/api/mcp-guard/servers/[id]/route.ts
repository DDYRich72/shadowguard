import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  mcpServerPatchSchema,
  parseBody,
  type MCPServerPatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { isUuid } from "@/lib/validate";

function patchToRow(body: MCPServerPatchBody) {
  const row: Record<string, unknown> = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.description !== undefined) row.description = body.description;
  if (body.serverUrl !== undefined) row.server_url = body.serverUrl;
  if (body.transport !== undefined) row.transport = body.transport;
  if (body.ownerName !== undefined) row.owner_name = body.ownerName;
  if (body.ownerEmail !== undefined) row.owner_email = body.ownerEmail || null;
  if (body.department !== undefined) row.department = body.department;
  if (body.environment !== undefined) row.environment = body.environment;
  if (body.status !== undefined) {
    row.status = body.status;
    row.archived_at = body.status === "archived" ? new Date().toISOString() : null;
  }
  if (body.approvalStatus !== undefined) row.approval_status = body.approvalStatus;
  if (body.aiSystemId !== undefined) row.ai_system_id = body.aiSystemId;
  return row;
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-server:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ server: data });
}

export async function PATCH(
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

  const body = await parseBody(request, mcpServerPatchSchema);
  if (body instanceof NextResponse) return body;

  if (!(await aiSystemBelongsToOrg(body.aiSystemId ?? null, ctx.orgId))) {
    return NextResponse.json({ error: "invalid_ai_system" }, { status: 400 });
  }

  const patch = patchToRow(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("mcp_servers")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase
    .from("mcp_servers")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "mcp_server.update",
    target_type: "mcp_server",
    target_id: data.id,
    summary: `Updated MCP server ${data.name}`,
    before: {
      name: before.name,
      status: before.status,
      approval_status: before.approval_status,
      ai_system_id: before.ai_system_id,
    },
    after: {
      name: data.name,
      status: data.status,
      approval_status: data.approval_status,
      ai_system_id: data.ai_system_id,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, server: data });
}

export async function DELETE(
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

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_servers")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id, name, status")
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordAudit(ctx, {
    action: "mcp_server.archive",
    target_type: "mcp_server",
    target_id: data.id,
    summary: `Archived MCP server ${data.name}`,
    after: { status: data.status },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, server: data });
}
