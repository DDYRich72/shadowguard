import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportSnapshotDeliveryPatchSchema,
  parseBody,
  type GovernanceReportSnapshotDeliveryPatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import type { GovernanceReportSnapshot } from "@/lib/ai-governance/types";

function isMissingDeliveryColumns(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("client_name") ||
    message.includes("prepared_by_note") ||
    message.includes("executive_summary_note") ||
    message.includes("delivery_status") ||
    message.includes("finalized_at") ||
    message.includes("duplicated_from_snapshot_id")
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

function patchToRow(body: GovernanceReportSnapshotDeliveryPatchBody) {
  const row: Record<string, unknown> = {};
  if (body.clientName !== undefined) row.client_name = body.clientName;
  if (body.preparedByNote !== undefined) row.prepared_by_note = body.preparedByNote;
  if (body.executiveSummaryNote !== undefined) {
    row.executive_summary_note = body.executiveSummaryNote;
  }
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
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, governanceReportSnapshotDeliveryPatchSchema);
  if (body instanceof NextResponse) return body;
  const patch = patchToRow(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: beforeData, error: beforeError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) {
    if (isMissingDeliveryColumns(beforeError)) return migrationRequiredResponse();
    return dbErrorResponse(beforeError);
  }
  if (!beforeData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const before = beforeData as GovernanceReportSnapshot;
  if (before.delivery_status === "final") {
    return NextResponse.json(
      {
        error: "snapshot_final",
        message: "Final snapshots are locked. Duplicate this snapshot to create an editable draft.",
      },
      { status: 409 }
    );
  }

  const { data: snapshot, error } = await supabase
    .from("governance_report_snapshots")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingDeliveryColumns(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.delivery_update",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Updated delivery fields for ${snapshot.title}`,
    before: {
      client_name: before.client_name ?? "",
      prepared_by_note: before.prepared_by_note ?? "",
      executive_summary_note: before.executive_summary_note ?? "",
    },
    after: {
      client_name: snapshot.client_name ?? "",
      prepared_by_note: snapshot.prepared_by_note ?? "",
      executive_summary_note: snapshot.executive_summary_note ?? "",
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot });
}
