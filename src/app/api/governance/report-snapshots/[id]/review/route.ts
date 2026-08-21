import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  governanceReportSnapshotReviewDecisionSchema,
  governanceReportSnapshotReviewSubmitSchema,
  parseBody,
  type GovernanceReportSnapshotReviewDecisionBody,
  type GovernanceReportSnapshotReviewSubmitBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import type {
  GovernanceReportReviewStatus,
  GovernanceReportSnapshot,
} from "@/lib/ai-governance/types";

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

function reviewStatus(snapshot: GovernanceReportSnapshot): GovernanceReportReviewStatus {
  return snapshot.review_status ?? "not_submitted";
}

function reviewAuditState(snapshot: GovernanceReportSnapshot) {
  return {
    review_status: reviewStatus(snapshot),
    reviewer_name: snapshot.reviewer_name ?? "",
    reviewer_email: snapshot.reviewer_email ?? "",
    review_note: snapshot.review_note ?? "",
    reviewed_at: snapshot.reviewed_at,
    reviewed_by: snapshot.reviewed_by,
  };
}

function submitPatch(body: GovernanceReportSnapshotReviewSubmitBody) {
  return {
    review_status: "needs_review",
    reviewer_name: body.reviewerName,
    reviewer_email: body.reviewerEmail,
    review_note: body.reviewNote,
    reviewed_at: null,
    reviewed_by: null,
  };
}

function decisionPatch(body: GovernanceReportSnapshotReviewDecisionBody, ctx: { userId: string; email?: string | null }) {
  return {
    review_status: body.action === "approve" ? "approved" : "changes_requested",
    reviewer_name: body.reviewerName || ctx.email || "",
    reviewer_email: body.reviewerEmail || ctx.email || "",
    review_note: body.reviewNote,
    reviewed_at: new Date().toISOString(),
    reviewed_by: ctx.userId,
  };
}

async function getSnapshot(id: string, orgId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return { supabase, error };
  if (!data) return { supabase, notFound: true };
  if (!("review_status" in data)) return { supabase, migrationRequired: true };
  return { supabase, snapshot: data as GovernanceReportSnapshot };
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

  const body = await parseBody(request, governanceReportSnapshotReviewSubmitSchema);
  if (body instanceof NextResponse) return body;

  const loaded = await getSnapshot(id, ctx.orgId);
  if ("error" in loaded && loaded.error) {
    if (isMissingReviewColumns(loaded.error)) return migrationRequiredResponse();
    return dbErrorResponse(loaded.error);
  }
  if ("migrationRequired" in loaded) return migrationRequiredResponse();
  if ("notFound" in loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { supabase, snapshot: before } = loaded;
  if (before.delivery_status === "final") {
    return NextResponse.json(
      { error: "snapshot_final", message: "Final snapshots are locked. Duplicate this snapshot to request another review." },
      { status: 409 }
    );
  }

  const currentReviewStatus = reviewStatus(before);
  if (currentReviewStatus === "needs_review") {
    return NextResponse.json(
      { error: "already_needs_review", message: "This snapshot is already waiting for review." },
      { status: 409 }
    );
  }
  if (currentReviewStatus === "approved") {
    return NextResponse.json(
      { error: "already_approved", message: "This snapshot is already approved and can be marked Final." },
      { status: 409 }
    );
  }

  const { data: snapshot, error } = await supabase
    .from("governance_report_snapshots")
    .update(submitPatch(body))
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingReviewColumns(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.review_submit",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Submitted report snapshot ${snapshot.title} for review`,
    before: reviewAuditState(before),
    after: reviewAuditState(snapshot as GovernanceReportSnapshot),
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot });
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

  const body = await parseBody(request, governanceReportSnapshotReviewDecisionSchema);
  if (body instanceof NextResponse) return body;

  const loaded = await getSnapshot(id, ctx.orgId);
  if ("error" in loaded && loaded.error) {
    if (isMissingReviewColumns(loaded.error)) return migrationRequiredResponse();
    return dbErrorResponse(loaded.error);
  }
  if ("migrationRequired" in loaded) return migrationRequiredResponse();
  if ("notFound" in loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { supabase, snapshot: before } = loaded;
  if (before.delivery_status === "final") {
    return NextResponse.json(
      { error: "snapshot_final", message: "Final snapshots are locked. Duplicate this snapshot to request another review." },
      { status: 409 }
    );
  }
  if (reviewStatus(before) !== "needs_review") {
    return NextResponse.json(
      { error: "not_needs_review", message: "This snapshot must be submitted for review before a review decision can be recorded." },
      { status: 409 }
    );
  }
  if (body.action === "approve") {
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
            "Resolve or waive all review remediation items before approving this snapshot.",
          openRemediationCount: openRemediations.count,
        },
        { status: 409 }
      );
    }
  }

  const { data: snapshot, error } = await supabase
    .from("governance_report_snapshots")
    .update(decisionPatch(body, ctx))
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingReviewColumns(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  const approved = body.action === "approve";
  await recordAudit(ctx, {
    action: approved
      ? "governance_report_snapshot.review_approve"
      : "governance_report_snapshot.review_changes_requested",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `${approved ? "Approved" : "Requested changes for"} report snapshot ${snapshot.title}`,
    before: reviewAuditState(before),
    after: reviewAuditState(snapshot as GovernanceReportSnapshot),
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot });
}
