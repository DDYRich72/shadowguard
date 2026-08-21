import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { parseBody, agentGuardSettingsSchema } from "@/lib/api/schemas";

export async function GET() {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();
  if (error) {
    return dbErrorResponse(error);
  }
  return NextResponse.json({ settings: data?.settings ?? {} });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Kill switch + threshold tuning is admin/manager territory.
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }
  const body = await parseBody(request, agentGuardSettingsSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.orgId)
    .single();

  const merged = { ...(current?.settings ?? {}), ...body };

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("organizations")
    .update({ settings: merged })
    .eq("id", ctx.orgId);

  if (error) {
    return dbErrorResponse(error);
  }

  // Kill switch toggles are the most important audit event on settings.
  const killFlipped =
    typeof body.kill_switch_active === "boolean" &&
    body.kill_switch_active !== (current?.settings as { kill_switch_active?: boolean } | null)?.kill_switch_active;

  await recordAudit(ctx, {
    action: killFlipped
      ? body.kill_switch_active
        ? "killswitch.engage"
        : "killswitch.release"
      : "settings.update",
    target_type: "organization",
    target_id: ctx.orgId,
    summary: killFlipped
      ? body.kill_switch_active
        ? "Engaged the global kill switch"
        : "Released the global kill switch"
      : "Updated Agent Guard settings",
    before: current?.settings ?? null,
    after: merged,
  });

  return NextResponse.json({ settings: merged });
}
