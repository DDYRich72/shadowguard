import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import {
  getSessionContext,
  hasRole,
} from "@/lib/authz";
import { buildAgentGuardIntegrationContract } from "@/lib/agent-guard/integration-contract";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

function filenameForContract(generatedAt: string): string {
  const date = generatedAt.slice(0, 10);
  return `agentguard-integration-contract-${date}.md`;
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(
    `download:agent-integration-contract:${ctx.orgId}`,
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

  const contract = buildAgentGuardIntegrationContract({
    organizationName: org?.name ?? null,
    baseUrl: request.nextUrl.origin,
  });
  const filename = filenameForContract(contract.generatedAt);

  await recordAudit(ctx, {
    action: "agentguard.integration_contract.download",
    target_type: "agentguard_integration_contract",
    target_id: ctx.orgId,
    summary: "Downloaded AgentGuard integration contract",
    after: {
      filename,
      version: contract.version,
      examples: contract.examples.length,
      samplePayloads: contract.samplePayloads.length,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return new Response(contract.contractMarkdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
