import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { normalizeRevocationTargets, type OAuthProvider } from "@/lib/oauth-revocation";

type AppRow = {
  id: string;
  app_name: string;
  app_category: string;
  is_ai_tool: boolean;
  risk_score: number;
  risk_level: string;
  permissions: string[];
  connected_users: string[];
  source_platforms: string[] | null;
  oauth_revocation_targets: unknown;
  oauth_revocation_last_result: unknown;
  status: string;
  has_soc2: boolean;
  has_gdpr: boolean;
  has_hipaa: boolean;
  data_residency: string;
  last_active: string;
  first_detected: string;
};

function rowToApi(row: AppRow) {
  const sourcePlatforms = (row.source_platforms ?? []).filter(
    (provider): provider is OAuthProvider =>
      provider === "google" || provider === "microsoft"
  );
  const targets = normalizeRevocationTargets(row.oauth_revocation_targets);
  return {
    id: row.id,
    appName: row.app_name,
    category: row.app_category,
    isAITool: row.is_ai_tool,
    riskScore: row.risk_score,
    riskLevel: row.risk_level as "critical" | "high" | "medium" | "low",
    riskFactors: [] as string[],
    permissions: row.permissions ?? [],
    connectedUsers: row.connected_users ?? [],
    sourcePlatforms,
    oauthRevocation: {
      targetCounts: {
        google: targets.filter((target) => target.provider === "google").length,
        microsoft: targets.filter((target) => target.provider === "microsoft").length,
      },
      lastResult: row.oauth_revocation_last_result ?? null,
    },
    lastActive: row.last_active,
    status: row.status as "active" | "blocked" | "approved" | "pending",
    securityInfo: {
      hasSOC2: row.has_soc2,
      hasGDPR: row.has_gdpr,
      hasHIPAA: row.has_hipaa,
      dataResidency: row.data_residency,
    },
    createdAt: row.first_detected,
  };
}

export async function GET(request: NextRequest) {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:apps:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const params = request.nextUrl.searchParams;
  const filter = params.get("filter");
  const status = params.get("status");
  const search = params.get("search");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("connected_apps")
    .select(
      "id, app_name, app_category, is_ai_tool, risk_score, risk_level, permissions, connected_users, source_platforms, oauth_revocation_targets, oauth_revocation_last_result, status, has_soc2, has_gdpr, has_hipaa, data_residency, last_active, first_detected"
    )
    .eq("org_id", orgId)
    .order("risk_score", { ascending: false });

  if (filter === "ai_only") query = query.eq("is_ai_tool", true);
  if (filter && ["critical", "high", "medium", "low"].includes(filter)) {
    query = query.eq("risk_level", filter);
  }
  if (status) query = query.eq("status", status);
  if (search) {
    // Escape LIKE wildcards and backslash so a user typing "%" or "_"
    // doesn't trick ilike into matching rows they shouldn't see.
    const safe = search.replace(/[\\%_]/g, "\\$&");
    query = query.ilike("app_name", `%${safe}%`);
  }

  const { data, error } = await query;
  if (error) {
    return dbErrorResponse(error);
  }

  const apps = (data ?? []).map(rowToApi);
  return NextResponse.json({ apps, total: apps.length });
}
