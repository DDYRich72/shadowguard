import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { getSessionOrgId } from "@/lib/tokens";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { parseBody, alertPatchSchema } from "@/lib/api/schemas";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

export async function GET(request: NextRequest) {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = await rateLimit(`get:alerts:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const params = request.nextUrl.searchParams;
  const onlyUnacked = params.get("acknowledged") === "false";

  const supabase = await createServerSupabase();
  let q = supabase
    .from("alerts")
    .select("id, type, severity, title, message, app_name, user_email, acknowledged, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (onlyUnacked) q = q.eq("acknowledged", false);

  const { data, error } = await q;
  if (error) {
    return dbErrorResponse(error);
  }
  return NextResponse.json({ alerts: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }

  const body = await parseBody(request, alertPatchSchema);
  if (body instanceof NextResponse) return body;
  const { id, acknowledged } = body;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("alerts")
    .update({
      acknowledged,
      acknowledged_by: acknowledged ? user?.email ?? null : null,
      acknowledged_at: acknowledged ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) {
    return dbErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}
