import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { parseBody, appActionSchema } from "@/lib/api/schemas";

const STATUS_MAP: Record<string, "approved" | "blocked" | "pending"> = {
  approve: "approved",
  block: "blocked",
  revoke: "blocked",
  pending: "pending",
};

/**
 * Approve / block / revoke / unset (pending) a discovered app.
 *
 * Requires the caller to be signed in with admin or manager role on the
 * app's org. Org-ownership on the app row is enforced at the SQL level
 * via `.eq("id", id).eq("org_id", ctx.orgId)` so an admin in one org
 * can't guess UUIDs belonging to another org.
 *
 * NOTE: "revoke" currently updates local state only. Actually revoking
 * the upstream OAuth grant (Google Admin SDK `tokens.delete` or MS
 * Graph service-principal permission revocation) is a follow-up —
 * tracked in the next phase. Caller is told via `revokedUpstream:
 * false` on the response so they know what happened.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Admin and manager roles require AAL2 before mutations land.
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }

  const { id } = await params;
  const body = await parseBody(request, appActionSchema);
  if (body instanceof NextResponse) return body;
  const { action } = body;
  const newStatus = STATUS_MAP[action];
  const supabase = await createServerSupabase();

  // Update + org-ownership check in one shot. If the id doesn't belong
  // to this org (or doesn't exist), the update affects zero rows and
  // .single() returns no row.
  const { data, error } = await supabase
    .from("connected_apps")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id, app_name, status")
    .maybeSingle();

  if (error) {
    return dbErrorResponse(error);
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Sync the logical approved_tools / blocklist entry so policy
  // generation and future scans honor the decision.
  if (action === "block" || action === "revoke") {
    await supabase.from("blocklist").upsert(
      {
        org_id: ctx.orgId,
        app_name: data.app_name,
        blocked_by: ctx.email ?? "system",
        reason:
          action === "revoke"
            ? "Admin revoked OAuth access"
            : "Admin blocked tool",
      },
      { onConflict: "org_id,app_name" }
    );
  } else if (action === "approve") {
    await supabase.from("approved_tools").upsert(
      {
        org_id: ctx.orgId,
        app_name: data.app_name,
        approved_by: ctx.email ?? "system",
      },
      { onConflict: "org_id,app_name" }
    );
  }

  await recordAudit(ctx, {
    action: `app.${action}`,
    target_type: "connected_app",
    target_id: data.id,
    summary: `${action}d ${data.app_name}`,
    after: { status: data.status },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    appId: data.id,
    action,
    newStatus: data.status,
    revokedUpstream: false,
    timestamp: new Date().toISOString(),
  });
}
