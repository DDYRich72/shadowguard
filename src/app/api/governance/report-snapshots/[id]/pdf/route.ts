import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { generateSnapshotPdf } from "@/lib/ai-governance/pdf-export";
import type { GovernanceReportSnapshot } from "@/lib/ai-governance/types";

function isMissingPdfColumns(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("pdf_generated_at") ||
    message.includes("pdf_generated_by") ||
    message.includes("pdf_filename") ||
    message.includes("pdf_content_hash") ||
    message.includes("pdf_size_bytes")
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

  const supabase = await createServerSupabase();
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (snapshotError) {
    if (isMissingPdfColumns(snapshotError)) return migrationRequiredResponse();
    return dbErrorResponse(snapshotError);
  }
  if (!snapshotData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = snapshotData as GovernanceReportSnapshot;
  if (snapshot.delivery_status !== "final") {
    return NextResponse.json(
      {
        error: "snapshot_not_final",
        message: "PDF generation is only available after marking a snapshot Final.",
      },
      { status: 409 }
    );
  }

  const generated = generateSnapshotPdf(snapshot);
  const generatedAt = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("governance_report_snapshots")
    .update({
      pdf_generated_at: generatedAt,
      pdf_generated_by: ctx.userId,
      pdf_filename: generated.filename,
      pdf_content_hash: generated.contentHash,
      pdf_size_bytes: generated.sizeBytes,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingPdfColumns(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "governance_report_snapshot.pdf_generate",
    target_type: "governance_report_snapshot",
    target_id: updated.id,
    summary: `Generated PDF for report snapshot ${updated.title}`,
    before: {
      pdf_generated_at: snapshot.pdf_generated_at,
      pdf_content_hash: snapshot.pdf_content_hash,
      pdf_size_bytes: snapshot.pdf_size_bytes,
    },
    after: {
      pdf_generated_at: updated.pdf_generated_at,
      pdf_filename: updated.pdf_filename,
      pdf_content_hash: updated.pdf_content_hash,
      pdf_size_bytes: updated.pdf_size_bytes,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    pdf: {
      generatedAt: updated.pdf_generated_at,
      filename: updated.pdf_filename,
      contentHash: updated.pdf_content_hash,
      sizeBytes: updated.pdf_size_bytes,
      downloadUrl: `/api/governance/report-snapshots/${updated.id}/pdf/download`,
    },
  });
}
