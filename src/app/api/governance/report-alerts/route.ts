import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { buildGovernanceReportAlerts } from "@/lib/ai-governance/review-alerts";
import type {
  GovernanceReportSnapshot,
  GovernanceReportSnapshotRemediation,
} from "@/lib/ai-governance/types";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

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

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:governance-report-alerts:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("governance_report_snapshots")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (snapshotError) return dbErrorResponse(snapshotError);

  const { data: remediationData, error: remediationError } = await supabase
    .from("governance_report_snapshot_remediations")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  const remediationWarning = remediationError
    ? isMissingRemediationTable(remediationError)
      ? "Required remediation schema is unavailable. Apply the bundled initial migration and retry."
      : "Unable to load review remediation items. Governance report due-date alerts may be incomplete."
    : "";
  const result = buildGovernanceReportAlerts({
    snapshots: (snapshotData ?? []) as GovernanceReportSnapshot[],
    remediations: remediationError
      ? []
      : ((remediationData ?? []) as GovernanceReportSnapshotRemediation[]),
    now: new Date(),
  });

  return NextResponse.json({
    ...result,
    remediationWarning,
  });
}
