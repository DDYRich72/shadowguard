// One-off schema presence check against the live Supabase project.
// Prints only table names + ok/missing — never credentials or row data.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tables = [
  "organizations",
  "ai_systems",
  "ai_system_controls",
  "ai_system_evidence",
  "governance_report_snapshots",
  "governance_report_delivery_links",
  "governance_report_snapshot_remediations",
  "mcp_servers",
  "scan_history",
  "risk_scores",
  "connected_apps",
  "scan_app_results",
];

for (const t of tables) {
  const { error } = await supabase.from(t).select("*", { count: "exact", head: true }).limit(0);
  console.log(`${t}: ${error ? `MISSING/ERROR (${error.message})` : "ok"}`);
}

// Column-level checks for recent migrations.
const colChecks = [
  ["ai_systems", "next_review_date"],
  ["ai_system_controls", "framework_mappings"],
  ["risk_scores", "scan_id"],
  ["connected_apps", "oauth_revocation_targets"],
  ["connected_apps", "oauth_revocation_last_result"],
];
for (const [t, c] of colChecks) {
  const { error } = await supabase.from(t).select(c).limit(0);
  console.log(`${t}.${c}: ${error ? `MISSING/ERROR (${error.message})` : "ok"}`);
}
