import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import {
  getSessionContext,
  hasRole,
} from "@/lib/authz";
import { buildAgentGuardImplementationChecklist } from "@/lib/agent-guard/implementation-checklist";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

function filenameForChecklist(generatedAt: string): string {
  const date = generatedAt.slice(0, 10);
  return `agentguard-implementation-checklist-${date}.md`;
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(
    `download:agent-implementation-checklist:${ctx.orgId}`,
    30,
    60_000
  );
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const checklist = buildAgentGuardImplementationChecklist({
    organizationName: org?.name ?? null,
    baseUrl: request.nextUrl.origin,
  });
  const filename = filenameForChecklist(checklist.generatedAt);

  await recordAudit(ctx, {
    action: "agentguard.implementation_checklist.download",
    target_type: "agentguard_implementation_checklist",
    target_id: ctx.orgId,
    summary: "Downloaded AgentGuard implementation checklist",
    after: {
      filename,
      sections: checklist.sections.length,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return new Response(checklist.checklistText, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
