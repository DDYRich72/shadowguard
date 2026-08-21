import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { generateSnapshotPdf } from "@/lib/ai-governance/pdf-export";
import type { GovernanceReportSnapshot } from "@/lib/ai-governance/types";

function isMissingPdfColumns(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("pdf_generated_at") ||
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: snapshotData, error } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) {
    if (isMissingPdfColumns(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }
  if (!snapshotData) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = snapshotData as GovernanceReportSnapshot;
  if (snapshot.delivery_status !== "final") {
    return NextResponse.json(
      { error: "snapshot_not_final", message: "PDF download requires a Final snapshot." },
      { status: 409 }
    );
  }
  if (!snapshot.pdf_generated_at) {
    return NextResponse.json(
      { error: "pdf_not_generated", message: "Generate the PDF before downloading it." },
      { status: 409 }
    );
  }

  const generated = generateSnapshotPdf(snapshot);
  const filename = snapshot.pdf_filename || generated.filename;

  await recordAudit(ctx, {
    action: "governance_report_snapshot.pdf_download",
    target_type: "governance_report_snapshot",
    target_id: snapshot.id,
    summary: `Downloaded PDF for report snapshot ${snapshot.title}`,
    after: {
      pdf_filename: filename,
      pdf_content_hash: generated.contentHash,
      pdf_size_bytes: generated.sizeBytes,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  const body = generated.bytes.buffer.slice(
    generated.bytes.byteOffset,
    generated.bytes.byteOffset + generated.bytes.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "content-length": String(generated.sizeBytes),
    },
  });
}
