import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  aiSystemEvidencePatchSchema,
  parseBody,
  type AISystemEvidencePatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

function patchToRow(body: AISystemEvidencePatchBody) {
  const row: Record<string, unknown> = {};
  if (body.title !== undefined) row.title = body.title;
  if (body.category !== undefined) row.category = body.category;
  if (body.owner !== undefined) row.owner = body.owner;
  if (body.status !== undefined) row.status = body.status;
  if (body.evidenceUrl !== undefined) row.evidence_url = body.evidenceUrl || "";
  if (body.notes !== undefined) row.notes = body.notes;
  if (body.controlId !== undefined) row.control_id = body.controlId;
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

async function controlBelongsToSystem(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  controlId: string;
  systemId: string;
  orgId: string;
}) {
  const { supabase, controlId, systemId, orgId } = params;
  const { data, error } = await supabase
    .from("ai_system_controls")
    .select("id")
    .eq("id", controlId)
    .eq("ai_system_id", systemId)
    .eq("org_id", orgId)
    .maybeSingle();

  return { control: data, error };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id, evidenceId } = await params;
  if (!isUuid(id) || !isUuid(evidenceId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, aiSystemEvidencePatchSchema);
  if (body instanceof NextResponse) return body;
  const patch = patchToRow(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("ai_system_evidence")
    .select("*")
    .eq("id", evidenceId)
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.controlId) {
    const { control, error: controlError } = await controlBelongsToSystem({
      supabase,
      controlId: body.controlId,
      systemId: id,
      orgId: ctx.orgId,
    });
    if (controlError) return dbErrorResponse(controlError);
    if (!control) {
      return NextResponse.json({ error: "invalid_control" }, { status: 400 });
    }
  }

  const { data: evidence, error } = await supabase
    .from("ai_system_evidence")
    .update(patch)
    .eq("id", evidenceId)
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "ai_evidence.update",
    target_type: "ai_system_evidence",
    target_id: evidence.id,
    summary: `Updated evidence ${evidence.title}`,
    before: {
      title: before.title,
      category: before.category,
      status: before.status,
      control_id: before.control_id,
      evidence_url: before.evidence_url,
    },
    after: {
      title: evidence.title,
      category: evidence.category,
      status: evidence.status,
      control_id: evidence.control_id,
      evidence_url: evidence.evidence_url,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, evidence });
}
