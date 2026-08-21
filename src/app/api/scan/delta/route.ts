import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { getSessionContext } from "@/lib/authz";
import { isUuid } from "@/lib/validate";
import {
  buildScanDelta,
  recordFromRow,
  type ScanAppRecord,
} from "@/lib/ai-governance/scan-delta";

type ScanRef = { id: string; scanned_at: string };

/**
 * GET /api/scan/delta — diff two scans' app results.
 *
 * Defaults to the two most recent scans that have per-app results
 * (scans predating the scan_app_results table are skipped — they have
 * nothing to diff). Optional ?from=&to= scan ids override the choice.
 */
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = ctx.orgId;

  const rl = await rateLimit(`get:scan-delta:${orgId}`, 30, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const params = request.nextUrl.searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  if ((fromParam && !isUuid(fromParam)) || (toParam && !isUuid(toParam))) {
    return NextResponse.json({ error: "invalid_scan_id" }, { status: 400 });
  }
  // from/to must come as a pair — a lone endpoint is ambiguous.
  if (Boolean(fromParam) !== Boolean(toParam)) {
    return NextResponse.json(
      { error: "from_and_to_required_together" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();

  let fromScan: ScanRef | null = null;
  let toScan: ScanRef | null = null;

  if (fromParam && toParam) {
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, scanned_at")
      .eq("org_id", orgId)
      .in("id", [fromParam, toParam]);
    if (error) return dbErrorResponse(error);
    const byId = new Map((data ?? []).map((r) => [r.id as string, r as ScanRef]));
    fromScan = byId.get(fromParam) ?? null;
    toScan = byId.get(toParam) ?? null;
    if (!fromScan || !toScan) {
      return NextResponse.json({ error: "scan_not_found" }, { status: 404 });
    }
  } else {
    // Two most recent scans that actually carry per-app results.
    const { data, error } = await supabase
      .from("scan_app_results")
      .select("scan_id")
      .eq("org_id", orgId)
      .order("recorded_at", { ascending: false })
      .limit(2000);
    if (error) return dbErrorResponse(error);
    const seen: string[] = [];
    for (const r of data ?? []) {
      const id = r.scan_id as string;
      if (!seen.includes(id)) seen.push(id);
      if (seen.length === 2) break;
    }
    if (seen.length < 2) {
      return NextResponse.json({
        delta: null,
        reason: "insufficient_scans",
        message: "Run at least two scans to see what changed.",
      });
    }
    const { data: scans, error: scansError } = await supabase
      .from("scan_history")
      .select("id, scanned_at")
      .eq("org_id", orgId)
      .in("id", seen);
    if (scansError) return dbErrorResponse(scansError);
    const byId = new Map((scans ?? []).map((r) => [r.id as string, r as ScanRef]));
    const ordered = seen
      .map((id) => byId.get(id))
      .filter((s): s is ScanRef => Boolean(s))
      .sort((a, b) => a.scanned_at.localeCompare(b.scanned_at));
    if (ordered.length < 2) {
      return NextResponse.json({
        delta: null,
        reason: "insufficient_scans",
        message: "Run at least two scans to see what changed.",
      });
    }
    [fromScan, toScan] = ordered;
  }

  async function appsForScan(scanId: string): Promise<ScanAppRecord[]> {
    const { data, error } = await supabase
      .from("scan_app_results")
      .select(
        "canonical_name, app_name, is_ai_tool, risk_score, risk_level, scopes, user_count, source_platforms"
      )
      .eq("org_id", orgId)
      .eq("scan_id", scanId)
      .limit(5000);
    if (error) throw error;
    return (data ?? []).map(recordFromRow);
  }

  let fromApps: ScanAppRecord[];
  let toApps: ScanAppRecord[];
  try {
    [fromApps, toApps] = await Promise.all([
      appsForScan(fromScan.id),
      appsForScan(toScan.id),
    ]);
  } catch (error) {
    return dbErrorResponse(error as { message?: string; code?: string });
  }

  const delta = buildScanDelta(fromApps, toApps);

  return NextResponse.json({
    from: { scanId: fromScan.id, scannedAt: fromScan.scanned_at },
    to: { scanId: toScan.id, scannedAt: toScan.scanned_at },
    delta,
  });
}
