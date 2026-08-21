import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportDeliveryLinkCreateSchema,
  parseBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import {
  clientReportUrl,
  expirationDateToTimestamp,
  generateDeliveryLinkToken,
} from "@/lib/ai-governance/delivery-links";
import type { GovernanceReportSnapshot } from "@/lib/ai-governance/types";

function isMissingDeliveryLinksTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("governance_report_delivery_links") ||
    message.includes("url_token") ||
    message.includes("public_url") ||
    message.includes("expires_at") ||
    message.includes("open_count")
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

  const body = await parseBody(request, governanceReportDeliveryLinkCreateSchema);
  if (body instanceof NextResponse) return body;

  const expiresAt = expirationDateToTimestamp(body.expiresAt);
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return NextResponse.json(
      {
        error: "invalid_expiration",
        message: "Expiration date must be today or later.",
      },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (snapshotError) return dbErrorResponse(snapshotError);
  if (!snapshotData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = snapshotData as GovernanceReportSnapshot;
  if (snapshot.delivery_status !== "final") {
    return NextResponse.json(
      {
        error: "snapshot_not_final",
        message: "Client delivery links are only available after marking a snapshot Final.",
      },
      { status: 409 }
    );
  }

  const token = generateDeliveryLinkToken();
  const publicUrl = clientReportUrl(token, request.nextUrl.origin);

  const { data: link, error } = await supabase
    .from("governance_report_delivery_links")
    .insert({
      org_id: ctx.orgId,
      snapshot_id: snapshot.id,
      url_token: token,
      public_url: publicUrl,
      status: "active",
      expires_at: expiresAt,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingDeliveryLinksTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_delivery_link.create",
    target_type: "governance_report_delivery_link",
    target_id: link.id,
    summary: `Created client delivery link for ${snapshot.title}`,
    after: {
      snapshot_id: snapshot.id,
      public_url: publicUrl,
      status: link.status,
      expires_at: link.expires_at,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, link }, { status: 201 });
}
