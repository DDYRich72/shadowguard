import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

/**
 * Returns one row per monitored tool with live 24h rollups computed from
 * agent_activities. The monitoring page consumes the shape expected by
 * dashboard/agent-guard/monitoring/page.tsx (AgentTool interface).
 */
export async function GET() {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:tools:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: toolRows }, { data: activityRows }] = await Promise.all([
    supabase
      .from("agent_tools")
      .select("tool_name, status, users_count, total_requests_24h, pii_exposures_24h, data_flows, last_activity_at")
      .eq("org_id", orgId),
    supabase
      .from("agent_activities")
      .select("tool_name, user_email, risk_level, pii_detected, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since),
  ]);

  type Rollup = {
    users: Set<string>;
    requests: number;
    pii: number;
    maxRisk: string;
    latest: string;
  };
  const rollups = new Map<string, Rollup>();
  const riskOrder: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const riskLabel: Record<number, string> = { 0: "low", 1: "low", 2: "medium", 3: "high", 4: "critical" };

  for (const a of activityRows ?? []) {
    const r =
      rollups.get(a.tool_name) ??
      ({ users: new Set<string>(), requests: 0, pii: 0, maxRisk: "low", latest: "" } as Rollup);
    r.users.add(a.user_email);
    r.requests++;
    if (a.pii_detected) r.pii++;
    if ((riskOrder[a.risk_level] ?? 0) > (riskOrder[r.maxRisk] ?? 0)) {
      r.maxRisk = a.risk_level;
    }
    if (a.created_at > r.latest) r.latest = a.created_at;
    rollups.set(a.tool_name, r);
  }

  type ToolRow = NonNullable<typeof toolRows>[number];
  const toolsByName = new Map<string, ToolRow>();
  for (const t of toolRows ?? []) toolsByName.set(t.tool_name, t);

  const allToolNames = new Set<string>([...(toolRows ?? []).map((t) => t.tool_name), ...rollups.keys()]);

  const tools = [...allToolNames].map((name) => {
    const t = toolsByName.get(name);
    const r = rollups.get(name);
    const latestTs = r?.latest ?? t?.last_activity_at ?? new Date().toISOString();
    const maxRiskIdx = r ? riskOrder[r.maxRisk] ?? 0 : 0;
    return {
      name,
      status: (t?.status ?? "active") as "active" | "paused" | "blocked",
      users: r ? r.users.size : (t?.users_count ?? 0),
      totalRequests24h: r ? r.requests : (t?.total_requests_24h ?? 0),
      piiExposed: r ? r.pii : (t?.pii_exposures_24h ?? 0),
      lastActivity: latestTs,
      dataFlows:
        (t?.data_flows as Array<{ inbound: string; outbound: string; riskLevel: string }>) ?? [
          { inbound: "Prompts", outbound: "Responses", riskLevel: riskLabel[maxRiskIdx] ?? "low" },
        ],
    };
  });

  return NextResponse.json({ tools });
}
