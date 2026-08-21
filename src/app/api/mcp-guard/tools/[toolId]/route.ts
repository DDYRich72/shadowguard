import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  mcpToolPatchSchema,
  parseBody,
  type MCPToolPatchBody,
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
import type { MCPCapabilityCategory, MCPApprovalStatus } from "@/lib/mcp-governance/types";
import type { AIDataSensitivity } from "@/lib/ai-governance/types";

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

function patchToRow(body: MCPToolPatchBody, before: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.description !== undefined) row.description = body.description;
  if (body.capabilityCategories !== undefined) row.capability_categories = body.capabilityCategories;
  if (body.dataSensitivity !== undefined) row.data_sensitivity = body.dataSensitivity;
  if (body.externalAccess !== undefined) row.external_access = body.externalAccess;
  if (body.writeAccess !== undefined) row.write_access = body.writeAccess;
  if (body.credentialAccess !== undefined) row.credential_access = body.credentialAccess;
  if (body.approvalStatus !== undefined) row.approval_status = body.approvalStatus;
  if (body.ownerName !== undefined) row.owner_name = body.ownerName;
  if (body.ownerEmail !== undefined) row.owner_email = body.ownerEmail || null;
  if (body.status !== undefined) {
    row.status = body.status;
    row.archived_at = body.status === "archived" ? new Date().toISOString() : null;
  }
  if (body.aiSystemId !== undefined) row.ai_system_id = body.aiSystemId;

  const risk = calculateMCPToolRisk({
    capabilityCategories:
      (body.capabilityCategories as MCPCapabilityCategory[] | undefined) ??
      (before.capability_categories as MCPCapabilityCategory[] | null) ??
      [],
    dataSensitivity:
      (body.dataSensitivity as AIDataSensitivity | undefined) ??
      (before.data_sensitivity as AIDataSensitivity),
    externalAccess:
      body.externalAccess ?? Boolean(before.external_access),
    writeAccess:
      body.writeAccess ?? Boolean(before.write_access),
    credentialAccess:
      body.credentialAccess ?? Boolean(before.credential_access),
    approvalStatus:
      (body.approvalStatus as MCPApprovalStatus | undefined) ??
      (before.approval_status as MCPApprovalStatus),
  });
  row.risk_tier = risk.tier;
  row.risk_score = risk.score;
  return row;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-tool:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const { toolId } = await params;
  if (!isUuid(toolId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("id", toolId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ tool: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { toolId } = await params;
  if (!isUuid(toolId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, mcpToolPatchSchema);
  if (body instanceof NextResponse) return body;

  if (!(await aiSystemBelongsToOrg(body.aiSystemId ?? null, ctx.orgId))) {
    return NextResponse.json({ error: "invalid_ai_system" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("id", toolId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch = patchToRow(body, before);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mcp_tools")
    .update(patch)
    .eq("id", toolId)
    .eq("org_id", ctx.orgId)
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
    action: "mcp_tool.update",
    target_type: "mcp_tool",
    target_id: data.id,
    summary: `Updated MCP tool ${data.name}`,
    before: {
      name: before.name,
      status: before.status,
      approval_status: before.approval_status,
      risk_tier: before.risk_tier,
      ai_system_id: before.ai_system_id,
    },
    after: {
      name: data.name,
      status: data.status,
      approval_status: data.approval_status,
      risk_tier: data.risk_tier,
      ai_system_id: data.ai_system_id,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, tool: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { toolId } = await params;
  if (!isUuid(toolId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mcp_tools")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", toolId)
    .eq("org_id", ctx.orgId)
    .select("id, name, status")
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordAudit(ctx, {
    action: "mcp_tool.archive",
    target_type: "mcp_tool",
    target_id: data.id,
    summary: `Archived MCP tool ${data.name}`,
    after: { status: data.status },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, tool: data });
}
