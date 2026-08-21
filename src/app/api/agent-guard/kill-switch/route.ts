import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { parseBody, killSwitchSchema } from "@/lib/api/schemas";
import { markSensitive, unwrapForClassification } from "@/lib/sensitive";
import {
  classifyData,
  assessActivityRisk,
  shouldKillSwitch,
  type AgentActivity,
  type AgentPolicy,
} from "@/lib/agent-guard/engine";

/**
 * Evaluate an activity against the org's enabled policies WITHOUT recording
 * it. Returns whether it would be blocked and why — use /api/agent-guard/
 * activity POST to actually log.
 *
 * Body: { toolName, userEmail, activityType, content }
 */
export async function POST(request: NextRequest) {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Evaluation endpoint. Customer-side wrappers may poll this before
  // deciding whether to forward submitted activity to an AI tool.
  // 600/min/org = 10/sec, plenty for real traffic, cap for abuse.
  const limit = await rateLimit(`killswitch:${orgId}`, 600, 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const body = await parseBody(request, killSwitchSchema);
  if (body instanceof NextResponse) return body;
  const { toolName, activityType } = body;
  const userEmail = body.userEmail ?? "system@killswitch";
  const content = markSensitive(body.content);

  const classification = classifyData(unwrapForClassification(content));
  const { riskLevel } = assessActivityRisk({
    activityType,
    dataClassification: classification,
  });

  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("agent_policies")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  // Also honor an org-level "pause everything" kill switch from settings.
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();

  const globalPause = (org?.settings as { kill_switch_active?: boolean } | null)
    ?.kill_switch_active === true;

  if (globalPause) {
    return NextResponse.json({
      toolName,
      blocked: true,
      reason: "Global kill switch is active",
      riskLevel,
      timestamp: new Date().toISOString(),
    });
  }

  const policies: AgentPolicy[] = (rows ?? []).map((p) => ({
    id: p.id,
    orgId: p.org_id,
    name: p.name,
    description: p.description ?? "",
    enabled: p.enabled,
    priority: p.priority,
    conditions: p.conditions ?? [],
    action: p.action,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  const activity: AgentActivity = {
    id: "tmp",
    orgId,
    toolName,
    toolId: "",
    userId: "",
    userEmail,
    activityType,
    timestamp: new Date().toISOString(),
    dataClassification: classification,
    riskLevel,
    metadata: {},
    blocked: false,
  };

  const decision = shouldKillSwitch(activity, policies);

  return NextResponse.json({
    toolName,
    blocked: decision.blocked,
    reason: decision.reason,
    riskLevel,
    timestamp: decision.timestamp,
  });
}
