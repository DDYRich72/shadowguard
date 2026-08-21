import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  aiSystemControlPatchSchema,
  parseBody,
  type AISystemControlPatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

function patchToRow(body: AISystemControlPatchBody) {
  const row: Record<string, unknown> = {};
  if (body.owner !== undefined) row.owner = body.owner;
  if (body.status !== undefined) row.status = body.status;
  if (body.dueDate !== undefined) {
    row.due_date = body.dueDate === "" ? null : body.dueDate;
  }
  if (body.notes !== undefined) row.notes = body.notes;
  if (body.evidenceUrl !== undefined) row.evidence_url = body.evidenceUrl;
  if (body.evidenceText !== undefined) row.evidence_text = body.evidenceText;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; controlId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id, controlId } = await params;
  if (!isUuid(id) || !isUuid(controlId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, aiSystemControlPatchSchema);
  if (body instanceof NextResponse) return body;
  const patch = patchToRow(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("ai_system_controls")
    .select("*")
    .eq("id", controlId)
    .eq("org_id", ctx.orgId)
    .eq("ai_system_id", id)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: control, error } = await supabase
    .from("ai_system_controls")
    .update(patch)
    .eq("id", controlId)
    .eq("org_id", ctx.orgId)
    .eq("ai_system_id", id)
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "ai_control.update",
    target_type: "ai_system_control",
    target_id: control.id,
    summary: `Updated control ${control.title}`,
    before: {
      status: before.status,
      owner: before.owner,
      due_date: before.due_date,
      notes: before.notes,
      evidence_url: before.evidence_url,
      evidence_text: before.evidence_text,
    },
    after: {
      status: control.status,
      owner: control.owner,
      due_date: control.due_date,
      notes: control.notes,
      evidence_url: control.evidence_url,
      evidence_text: control.evidence_text,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, control });
}
