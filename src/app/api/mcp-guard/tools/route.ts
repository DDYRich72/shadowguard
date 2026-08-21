import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:mcp-tools:${ctx.orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
  const supabase = await createServerSupabase();
  let query = supabase
    .from("mcp_tools")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("risk_score", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!includeArchived) query = query.neq("status", "archived");

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    tools: data ?? [],
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
}
