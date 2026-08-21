import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportSnapshotRemediationCreateSchema,
  parseBody,
  type GovernanceReportSnapshotRemediationCreateBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import type { GovernanceReportSnapshot } from "@/lib/ai-governance/types";

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

function dueDateToRow(value: GovernanceReportSnapshotRemediationCreateBody["dueDate"]) {
  return value ? value : null;
}

function createRow(body: GovernanceReportSnapshotRemediationCreateBody, ctx: { orgId: string; userId: string }, snapshotId: string) {
  return {
    org_id: ctx.orgId,
    snapshot_id: snapshotId,
    title: body.title,
    owner: body.owner,
    status: body.status,
    due_date: dueDateToRow(body.dueDate),
    notes: body.notes,
    created_by: ctx.userId,
    resolved_at: body.status === "resolved" || body.status === "waived" ? new Date().toISOString() : null,
    resolved_by: body.status === "resolved" || body.status === "waived" ? ctx.userId : null,
  };
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

  const body = await parseBody(request, governanceReportSnapshotRemediationCreateSchema);
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
        message: "Final snapshots are locked. Duplicate this snapshot to add remediation items.",
      },
      { status: 409 }
    );
  }

  const { data: remediation, error } = await supabase
    .from("governance_report_snapshot_remediations")
    .insert(createRow(body, ctx, id))
    .select("*")
    .single();

  if (error) {
    if (isMissingRemediationTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot_remediation.create",
    target_type: "governance_report_snapshot_remediation",
    target_id: remediation.id,
    summary: `Created remediation item for ${snapshot.title}`,
    after: remediation,
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, remediation }, { status: 201 });
}
