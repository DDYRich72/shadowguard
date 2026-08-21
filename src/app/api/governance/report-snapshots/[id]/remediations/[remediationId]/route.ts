import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportSnapshotRemediationPatchSchema,
  parseBody,
  type GovernanceReportSnapshotRemediationPatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import type {
  GovernanceReportSnapshot,
  GovernanceReportSnapshotRemediation,
} from "@/lib/ai-governance/types";

function isMissingRemediationTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("governance_report_snapshot_remediations") ||
    message.includes("snapshot_id") ||
    message.includes("resolved_at")
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

function patchToRow(
  body: GovernanceReportSnapshotRemediationPatchBody,
  before: GovernanceReportSnapshotRemediation,
  ctx: { userId: string }
) {
  const row: Record<string, unknown> = {};
  if (body.title !== undefined) row.title = body.title;
  if (body.owner !== undefined) row.owner = body.owner;
  if (body.dueDate !== undefined) row.due_date = body.dueDate ? body.dueDate : null;
  if (body.notes !== undefined) row.notes = body.notes;
  if (body.status !== undefined) {
    row.status = body.status;
    if (body.status === "resolved" || body.status === "waived") {
      row.resolved_at = before.resolved_at ?? new Date().toISOString();
      row.resolved_by = before.resolved_by ?? ctx.userId;
    } else {
      row.resolved_at = null;
      row.resolved_by = null;
    }
  }
  return row;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; remediationId: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id, remediationId } = await params;
  if (!isUuid(id) || !isUuid(remediationId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, governanceReportSnapshotRemediationPatchSchema);
  if (body instanceof NextResponse) return body;

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
  if (snapshot.delivery_status === "final") {
    return NextResponse.json(
      {
        error: "snapshot_final",
        message: "Final snapshots are locked. Duplicate this snapshot to update remediation items.",
      },
      { status: 409 }
    );
  }

  const { data: beforeData, error: beforeError } = await supabase
    .from("governance_report_snapshot_remediations")
    .select("*")
    .eq("id", remediationId)
    .eq("snapshot_id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) {
    if (isMissingRemediationTable(beforeError)) return migrationRequiredResponse();
    return dbErrorResponse(beforeError);
  }
  if (!beforeData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const before = beforeData as GovernanceReportSnapshotRemediation;
  const patch = patchToRow(body, before, ctx);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const { data: remediation, error } = await supabase
    .from("governance_report_snapshot_remediations")
    .update(patch)
    .eq("id", remediationId)
    .eq("snapshot_id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingRemediationTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot_remediation.update",
    target_type: "governance_report_snapshot_remediation",
    target_id: remediation.id,
    summary: `Updated remediation item for ${snapshot.title}`,
    before,
    after: remediation,
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, remediation });
}
