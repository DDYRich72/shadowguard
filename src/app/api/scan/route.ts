import { NextRequest, NextResponse } from "next/server";
import {
  listConnectedApps,
  type DiscoveredApp as GoogleApp,
} from "@/lib/google-workspace";
import {
  listMicrosoftConnectedApps,
  listOAuth2Grants,
  type DiscoveredApp as MsApp,
} from "@/lib/microsoft-365";
import { matchAITool } from "@/lib/ai-tools-database";
import { calculateRiskScore } from "@/lib/risk-scoring";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  getGoogleAccessToken,
  getMicrosoftAccessToken,
} from "@/lib/tokens";
import { getSessionContext, hasRole } from "@/lib/authz";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { parseBody, scanRequestSchema } from "@/lib/api/schemas";
import {
  mergeRevocationTargets,
  type OAuthRevocationTarget,
} from "@/lib/oauth-revocation";

type Normalized = {
  canonicalName: string;
  displayName: string;
  scopes: string[];
  users: string[];
  lastActive: string;
  source: "google" | "microsoft";
  source_platforms: ("google" | "microsoft")[];
  revocationTargets: OAuthRevocationTarget[];
};

type ScanApp = {
  appName: string;
  category: string;
  isAITool: boolean;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskFactors: string[];
  connectedUsers: string[];
  lastActive: string;
  status: "active" | "blocked" | "approved" | "pending";
  securityInfo: {
    hasSOC2: boolean;
    hasGDPR: boolean;
    hasHIPAA: boolean;
    dataResidency: string;
  };
};

function normalizeGoogle(apps: GoogleApp[]): Normalized[] {
  return apps.map((a) => {
    const matched = matchAITool(a.appName);
    return {
      canonicalName: (matched?.name ?? a.appName).toLowerCase().trim(),
      displayName: matched?.name ?? a.appName,
      scopes: a.scopes,
      users: a.users,
      lastActive: a.lastActive,
      source: "google",
      source_platforms: ["google"],
      revocationTargets: a.revocationTargets ?? [],
    };
  });
}

function normalizeMicrosoft(apps: MsApp[]): Normalized[] {
  return apps.map((a) => {
    const matched = matchAITool(a.appName);
    return {
      canonicalName: (matched?.name ?? a.appName).toLowerCase().trim(),
      displayName: matched?.name ?? a.appName,
      scopes: a.scopes,
      users: a.users,
      lastActive: a.lastActive,
      source: "microsoft",
      source_platforms: ["microsoft"],
      revocationTargets: a.revocationTargets ?? [],
    };
  });
}

function mergeByCanonical(lists: Normalized[][]): Normalized[] {
  const byName = new Map<
    string,
    Omit<Normalized, "source_platforms"> & {
      source_platforms: Set<"google" | "microsoft">;
    }
  >();
  for (const list of lists) {
    for (const n of list) {
      const existing = byName.get(n.canonicalName);
      if (!existing) {
        byName.set(n.canonicalName, {
          ...n,
          users: [...new Set(n.users)],
          scopes: [...new Set(n.scopes)],
          source_platforms: new Set([n.source]),
          revocationTargets: mergeRevocationTargets(n.revocationTargets),
        });
      } else {
        existing.users = [...new Set([...existing.users, ...n.users])];
        existing.scopes = [...new Set([...existing.scopes, ...n.scopes])];
        existing.source_platforms.add(n.source);
        existing.revocationTargets = mergeRevocationTargets([
          ...existing.revocationTargets,
          ...n.revocationTargets,
        ]);
        if (n.lastActive > existing.lastActive) existing.lastActive = n.lastActive;
      }
    }
  }
  return [...byName.values()].map((v) => ({
    ...v,
    source_platforms: [...v.source_platforms],
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return NextResponse.json(mfaRequiredError, { status: 403 });
  }
  const orgId = ctx.orgId;

  // Scans are expensive (enumerate every OAuth grant in two tenants).
  // 5 scans per org per hour is plenty for legitimate re-scans.
  const limit = await rateLimit(`scan:${orgId}`, 5, 60 * 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const t0 = Date.now();

  const supabase = await createServerSupabase();
  const { data: org } = await supabase
    .from("organizations")
    .select("domain, google_connected, microsoft_connected")
    .eq("id", orgId)
    .single();

  if (!org?.google_connected && !org?.microsoft_connected) {
    return NextResponse.json(
      { error: "Connect Google Workspace or Microsoft 365 first." },
      { status: 400 }
    );
  }

  const body = await parseBody(request, scanRequestSchema);
  if (body instanceof NextResponse) return body;
  const domain = body.domain ?? org?.domain ?? "";
  // Estimate total org users to anchor adoption-breadth scoring.
  const estimatedUsers = Math.max(body.totalUsers ?? 50, 50);

  // Known canonical names that already existed before this scan — drives
  // new_app alerts.
  const { data: existingRows } = await supabase
    .from("connected_apps")
    .select("canonical_name")
    .eq("org_id", orgId);
  const existingCanon = new Set((existingRows ?? []).map((r) => r.canonical_name));

  const results = await Promise.allSettled([
    org?.google_connected
      ? (async () => {
          const token = await getGoogleAccessToken(orgId);
          return normalizeGoogle(await listConnectedApps(token, domain));
        })()
      : Promise.resolve([] as Normalized[]),
    org?.microsoft_connected
      ? (async () => {
          const token = await getMicrosoftAccessToken(orgId);
          const [apps, grants] = await Promise.all([
            listMicrosoftConnectedApps(token),
            listOAuth2Grants(token),
          ]);
          return normalizeMicrosoft([...apps, ...grants]);
        })()
      : Promise.resolve([] as Normalized[]),
  ]);

  const perProviderLists: Normalized[][] = results.map((r) =>
    r.status === "fulfilled" ? r.value : []
  );
  const merged = mergeByCanonical(perProviderLists);

  // Upsert connected_apps + create alerts + per-app risk score history.
  const admin = createAdminSupabase();

  // Create the scan_history row up front so per-app writes can carry its
  // id (scan deltas diff scan_app_results between two scan ids). The
  // aggregate counts are patched in at the end.
  const { data: scanRow } = await admin
    .from("scan_history")
    .insert({ org_id: orgId })
    .select("id")
    .single();
  const scanId: string | null = scanRow?.id ?? null;

  const summary = { total: merged.length, ai: 0, critical: 0, high: 0, medium: 0, low: 0 };
  const apps: ScanApp[] = [];

  for (const m of merged) {
    const matched = matchAITool(m.displayName);
    const scoreResult = calculateRiskScore(
      matched ?? {
        name: m.displayName,
        aliases: [],
        category: "Third-Party App",
        data_access_scope: "low",
        has_soc2: false,
        has_gdpr: false,
        has_hipaa: false,
        data_residency: "unknown",
        risk_base_score: 20,
      },
      m.scopes,
      m.users.length,
      estimatedUsers
    );
    const isAi = matched !== null;
    apps.push({
      appName: m.displayName,
      category: matched?.category ?? "Third-Party App",
      isAITool: isAi,
      riskScore: scoreResult.overall,
      riskLevel: scoreResult.risk_level,
      riskFactors: scoreResult.factors,
      connectedUsers: m.users,
      lastActive: m.lastActive,
      status: "active",
      securityInfo: {
        hasSOC2: matched?.has_soc2 ?? false,
        hasGDPR: matched?.has_gdpr ?? false,
        hasHIPAA: matched?.has_hipaa ?? false,
        dataResidency: matched?.data_residency ?? "unknown",
      },
    });
    if (isAi) {
      summary.ai++;
      if (scoreResult.risk_level === "critical") summary.critical++;
      else if (scoreResult.risk_level === "high") summary.high++;
      else if (scoreResult.risk_level === "medium") summary.medium++;
      else summary.low++;
    }

    const { data: upserted } = await admin
      .from("connected_apps")
      .upsert(
        {
          org_id: orgId,
          app_name: m.displayName,
          canonical_name: m.canonicalName,
          aliases: matched?.aliases ?? [],
          app_category: matched?.category ?? "Third-Party App",
          is_ai_tool: isAi,
          risk_score: scoreResult.overall,
          risk_level: scoreResult.risk_level,
          permissions: m.scopes,
          connected_users: m.users,
          source_platforms: m.source_platforms,
          oauth_revocation_targets: m.revocationTargets,
          has_soc2: matched?.has_soc2 ?? false,
          has_gdpr: matched?.has_gdpr ?? false,
          has_hipaa: matched?.has_hipaa ?? false,
          data_residency: matched?.data_residency ?? "unknown",
          last_active: m.lastActive,
        },
        { onConflict: "org_id,canonical_name" }
      )
      .select("id")
      .single();

    if (upserted) {
      await admin.from("risk_scores").insert({
        app_id: upserted.id,
        scan_id: scanId,
        overall: scoreResult.overall,
        data_access: scoreResult.data_access,
        security_posture: scoreResult.security_posture,
        compliance_flags: scoreResult.compliance_flags,
        adoption_breadth: scoreResult.adoption_breadth,
        factors: scoreResult.factors,
      });
    }

    // Point-in-time record for scan deltas. Best-effort: a failed write
    // here must not fail the scan.
    if (scanId) {
      const { error: sarError } = await admin.from("scan_app_results").insert({
        org_id: orgId,
        scan_id: scanId,
        app_id: upserted?.id ?? null,
        canonical_name: m.canonicalName,
        app_name: m.displayName,
        is_ai_tool: isAi,
        risk_score: scoreResult.overall,
        risk_level: scoreResult.risk_level,
        scopes: m.scopes,
        user_count: m.users.length,
        source_platforms: m.source_platforms,
      });
      if (sarError) {
        console.error("scan_app_results insert failed:", sarError.message);
      }
    }

    // Alerts.
    const alerts: Record<string, unknown>[] = [];
    if (!existingCanon.has(m.canonicalName) && isAi) {
      alerts.push({
        org_id: orgId,
        type: "new_app",
        severity: scoreResult.risk_level === "critical" ? "critical" : "medium",
        title: `New AI tool detected: ${m.displayName}`,
        message: `${m.displayName} was discovered on ${m.source_platforms.join(", ")}. ${m.users.length} user(s) connected.`,
        app_name: m.displayName,
      });
    }
    if (scoreResult.overall >= 60 && isAi) {
      alerts.push({
        org_id: orgId,
        type: "risk_threshold",
        severity: scoreResult.risk_level === "critical" ? "critical" : "high",
        title: `${m.displayName} exceeded risk threshold`,
        message: `Risk score ${scoreResult.overall} (${scoreResult.risk_level}).`,
        app_name: m.displayName,
      });
    }
    if (m.users.length >= 3 && isAi) {
      alerts.push({
        org_id: orgId,
        type: "bulk_adoption",
        severity: "medium",
        title: `Bulk adoption: ${m.displayName}`,
        message: `${m.users.length} users are using ${m.displayName}.`,
        app_name: m.displayName,
      });
    }
    if (alerts.length > 0) {
      await admin.from("alerts").insert(alerts);
    }
  }

  const scanAggregates = {
    total_apps: summary.total,
    ai_tools_found: summary.ai,
    critical_count: summary.critical,
    high_count: summary.high,
    medium_count: summary.medium,
    low_count: summary.low,
    scan_duration_ms: Date.now() - t0,
  };
  if (scanId) {
    await admin.from("scan_history").update(scanAggregates).eq("id", scanId);
  } else {
    // The up-front insert failed (shouldn't happen) — fall back to the
    // old end-of-scan insert so history is never silently dropped.
    await admin.from("scan_history").insert({ org_id: orgId, ...scanAggregates });
  }

  // Surface per-provider failures so the UI can show a partial-success banner.
  const errors = results
    .map((r, i) => (r.status === "rejected" ? { provider: i === 0 ? "google" : "microsoft", message: String(r.reason) } : null))
    .filter(Boolean);

  return NextResponse.json({
    success: true,
    summary: {
      totalApps: summary.total,
      aiTools: summary.ai,
      criticalRisk: summary.critical,
      highRisk: summary.high,
      mediumRisk: summary.medium,
      lowRisk: summary.low,
    },
    apps,
    errors,
    scannedAt: new Date().toISOString(),
  });
}

// Scans are POST-only: they mutate state (writes connected_apps,
// scan_history, alerts) and consume Google/Microsoft API quota, so
// exposing them to GET would let an <img src> or link prefetch
// trigger work the caller didn't intend.
