import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

export async function GET() {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = await rateLimit(`get:policy-docs:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("policy_documents")
    .select("id, version, industry, risk_tolerance, markdown, created_at")
    .eq("org_id", orgId)
    .order("version", { ascending: false });
  if (error) {
    return dbErrorResponse(error);
  }
  return NextResponse.json({ documents: data ?? [] });
}
