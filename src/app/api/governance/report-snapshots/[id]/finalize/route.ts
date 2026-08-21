import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
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
    message.includes("delivery_status") ||
    message.includes("finalized_at") ||
    message.includes("finalized_by")
  );
}

function isMissingReviewColumns(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("review_status") ||
    message.includes("reviewer_name") ||
    message.includes("reviewer_email") ||
    message.includes("review_note") ||
    message.includes("reviewed_at") ||
    message.includes("reviewed_by")
  );
}

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

function reviewMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
}

function remediationMigrationRequiredResponse() {
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

async function getOpenRemediationCount(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  id: string,
  orgId: string
) {
  const { count, error } = await supabase
    .from("governance_report_snapshot_remediations")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", id)
    .eq("org_id", orgId)
    .in("status", ["open", "in_progress"]);

  if (error) return { error };
  return { count: count ?? 0 };
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

  const supabase = await createServerSupabase();
  const { data: beforeData, error: beforeError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) {
    if (isMissingDeliveryColumns(beforeError)) return migrationRequiredResponse();
    if (isMissingReviewColumns(beforeError)) return reviewMigrationRequiredResponse();
    return dbErrorResponse(beforeError);
  }
  if (!beforeData) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!("review_status" in beforeData)) return reviewMigrationRequiredResponse();

  const before = beforeData as GovernanceReportSnapshot;
  if (before.delivery_status === "final") {
    return NextResponse.json(
      { error: "already_final", message: "This snapshot is already final." },
      { status: 409 }
    );
  }
  if (before.review_status !== "approved") {
    return NextResponse.json(
      {
        error: "snapshot_not_approved",
        message: "Final snapshots require Approved review status before finalization.",
      },
      { status: 409 }
    );
  }
  const openRemediations = await getOpenRemediationCount(supabase, id, ctx.orgId);
  if ("error" in openRemediations && openRemediations.error) {
    if (isMissingRemediationTable(openRemediations.error)) {
      return remediationMigrationRequiredResponse();
    }
    return dbErrorResponse(openRemediations.error);
  }
  if ((openRemediations.count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "open_remediations",
        message:
          "Resolve or waive all review remediation items before finalizing this snapshot.",
        openRemediationCount: openRemediations.count,
      },
      { status: 409 }
    );
  }

  const finalizedAt = new Date().toISOString();
  const { data: snapshot, error } = await supabase
    .from("governance_report_snapshots")
    .update({
      delivery_status: "final",
      finalized_at: finalizedAt,
      finalized_by: ctx.userId,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingDeliveryColumns(error)) return migrationRequiredResponse();
    if (isMissingReviewColumns(error)) return reviewMigrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.finalize",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Finalized report snapshot ${snapshot.title}`,
    before: {
      delivery_status: before.delivery_status ?? "draft",
      finalized_at: before.finalized_at,
      finalized_by: before.finalized_by,
      review_status: before.review_status ?? "not_submitted",
    },
    after: {
      delivery_status: snapshot.delivery_status,
      finalized_at: snapshot.finalized_at,
      finalized_by: snapshot.finalized_by,
      review_status: snapshot.review_status,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot });
}
