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
    message.includes("client_name") ||
    message.includes("prepared_by_note") ||
    message.includes("executive_summary_note") ||
    message.includes("delivery_status") ||
    message.includes("finalized_at") ||
    message.includes("duplicated_from_snapshot_id")
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

function duplicateTitle(title: string): string {
  const suffix = " Copy";
  if (title.endsWith(suffix)) return title;
  return `${title}${suffix}`;
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
  const { data: sourceData, error: sourceError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (sourceError) {
    if (isMissingDeliveryColumns(sourceError)) return migrationRequiredResponse();
    if (isMissingReviewColumns(sourceError)) return reviewMigrationRequiredResponse();
    return dbErrorResponse(sourceError);
  }
  if (!sourceData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const source = sourceData as GovernanceReportSnapshot;
  const { data: duplicate, error } = await supabase
    .from("governance_report_snapshots")
    .insert({
      org_id: ctx.orgId,
      report_type: source.report_type,
      ai_system_id: source.ai_system_id,
      title: duplicateTitle(source.title),
      summary_metrics: source.summary_metrics,
      snapshot: source.snapshot,
      generated_by: ctx.userId,
      generated_by_email: ctx.email ?? "",
      client_name: source.client_name ?? "",
      prepared_by_note: source.prepared_by_note ?? "",
      executive_summary_note: source.executive_summary_note ?? "",
      delivery_status: "draft",
      finalized_at: null,
      finalized_by: null,
      duplicated_from_snapshot_id: source.id,
      review_status: "not_submitted",
      reviewer_name: "",
      reviewer_email: "",
      review_note: "",
      reviewed_at: null,
      reviewed_by: null,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingDeliveryColumns(error)) return migrationRequiredResponse();
    if (isMissingReviewColumns(error)) return reviewMigrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.duplicate",
    target_type: "governance_report_snapshot",
    target_id: duplicate.id,
    summary: `Duplicated report snapshot ${source.title}`,
    before: {
      source_snapshot_id: source.id,
      source_delivery_status: source.delivery_status ?? "draft",
      source_review_status: source.review_status ?? "not_submitted",
    },
    after: {
      duplicate_snapshot_id: duplicate.id,
      title: duplicate.title,
      delivery_status: duplicate.delivery_status,
      review_status: duplicate.review_status,
      duplicated_from_snapshot_id: duplicate.duplicated_from_snapshot_id,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, snapshot: duplicate }, { status: 201 });
}
