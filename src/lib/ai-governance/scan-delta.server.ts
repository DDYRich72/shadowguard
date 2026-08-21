import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildScanDelta,
  recordFromRow,
  toScanDeltaSection,
  type ScanDeltaSection,
  type ScanAppRecord,
} from "./scan-delta";

/**
 * Fetch the delta between the org's two most recent scans (those with
 * per-app results) as a snapshot-embeddable section. Returns null when
 * fewer than two scans exist or on any query failure — callers treat
 * the section as optional, so a missing delta must never block a
 * report.
 */
export async function fetchLatestScanDeltaSection(
  supabase: SupabaseClient,
  orgId: string
): Promise<ScanDeltaSection | null> {
  const { data: resultRows, error: scanIdsError } = await supabase
    .from("scan_app_results")
    .select("scan_id")
    .eq("org_id", orgId)
    .order("recorded_at", { ascending: false })
    .limit(2000);
  if (scanIdsError) return null;

  const seen: string[] = [];
  for (const r of resultRows ?? []) {
    const id = r.scan_id as string;
    if (!seen.includes(id)) seen.push(id);
    if (seen.length === 2) break;
  }
  if (seen.length < 2) return null;

  const { data: scans, error: scansError } = await supabase
    .from("scan_history")
    .select("id, scanned_at")
    .eq("org_id", orgId)
    .in("id", seen);
  if (scansError || !scans || scans.length < 2) return null;

  const ordered = [...scans].sort((a, b) =>
    (a.scanned_at as string).localeCompare(b.scanned_at as string)
  );
  const [fromScan, toScan] = ordered;

  async function appsForScan(scanId: string): Promise<ScanAppRecord[] | null> {
    const { data, error } = await supabase
      .from("scan_app_results")
      .select(
        "canonical_name, app_name, is_ai_tool, risk_score, risk_level, scopes, user_count, source_platforms"
      )
      .eq("org_id", orgId)
      .eq("scan_id", scanId)
      .limit(5000);
    if (error) return null;
    return (data ?? []).map(recordFromRow);
  }

  const [fromApps, toApps] = await Promise.all([
    appsForScan(fromScan.id as string),
    appsForScan(toScan.id as string),
  ]);
  if (!fromApps || !toApps) return null;

  const delta = buildScanDelta(fromApps, toApps);
  return toScanDeltaSection(
    delta,
    fromScan.scanned_at as string,
    toScan.scanned_at as string
  );
}
