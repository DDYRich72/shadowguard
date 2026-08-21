import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/validate";
import { parseBody, policyPatchSchema } from "@/lib/api/schemas";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(session.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(session.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await parseBody(request, policyPatchSchema);
  if (body instanceof NextResponse) return body;

  // Only forward fields the caller actually provided. Zod's .partial()
  // makes every field optional; an undefined value means "don't touch".
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) patch[k] = v;
  }

  const supabase = await createServerSupabase();

  // Capture the before state for audit (best-effort — if select fails
  // we still proceed with the update).
  const { data: before } = await supabase
    .from("agent_policies")
    .select("id, name, enabled, priority, action, conditions")
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("agent_policies")
    .update(patch)
    .eq("id", id)
    .eq("org_id", session.orgId)
    .select()
    .single();

  if (error) {
    return dbErrorResponse(error);
  }

  await recordAudit(session, {
    action: "policy.update",
    target_type: "agent_policy",
    target_id: id,
    summary: `Updated policy "${data?.name}"`,
    before: before ?? null,
    after: patch,
  });

  return NextResponse.json({ policy: data });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(session.role, ["admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(session.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data: before } = await supabase
    .from("agent_policies")
    .select("id, name, enabled, action")
    .eq("id", id)
    .eq("org_id", session.orgId)
    .maybeSingle();

  const { error } = await supabase
    .from("agent_policies")
    .delete()
    .eq("id", id)
    .eq("org_id", session.orgId);

  if (error) {
    return dbErrorResponse(error);
  }

  await recordAudit(session, {
    action: "policy.delete",
    target_type: "agent_policy",
    target_id: id,
    summary: `Deleted policy "${before?.name ?? id}"`,
    before: before ?? null,
  });

  return NextResponse.json({ ok: true });
}
