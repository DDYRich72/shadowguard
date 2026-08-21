import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportDeliveryLinkPatchSchema,
  parseBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import type { GovernanceReportDeliveryLink } from "@/lib/ai-governance/types";

function isMissingDeliveryLinksTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("governance_report_delivery_links") ||
    message.includes("revoked_at") ||
    message.includes("revoked_by")
  );
}

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
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
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id, linkId } = await params;
  if (!isUuid(id) || !isUuid(linkId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, governanceReportDeliveryLinkPatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: linkData, error: linkError } = await supabase
    .from("governance_report_delivery_links")
    .select("*")
    .eq("id", linkId)
    .eq("snapshot_id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (linkError) {
    if (isMissingDeliveryLinksTable(linkError)) return migrationRequiredResponse();
    return dbErrorResponse(linkError);
  }
  if (!linkData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const before = linkData as GovernanceReportDeliveryLink;
  if (before.status === "revoked") {
    return NextResponse.json(
      { error: "already_revoked", message: "This delivery link is already revoked." },
      { status: 409 }
    );
  }

  const revokedAt = new Date().toISOString();
  const { data: link, error } = await supabase
    .from("governance_report_delivery_links")
    .update({
      status: body.status,
      revoked_at: revokedAt,
      revoked_by: ctx.userId,
    })
    .eq("id", linkId)
    .eq("snapshot_id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingDeliveryLinksTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_delivery_link.revoke",
    target_type: "governance_report_delivery_link",
    target_id: link.id,
    summary: "Revoked client delivery link",
    before: {
      status: before.status,
      revoked_at: before.revoked_at,
      revoked_by: before.revoked_by,
    },
    after: {
      status: link.status,
      revoked_at: link.revoked_at,
      revoked_by: link.revoked_by,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, link });
}
