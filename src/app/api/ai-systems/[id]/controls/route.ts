import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";
import { calculateControlReadiness } from "@/lib/ai-governance/controls";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: system, error: systemError } = await supabase
    .from("ai_systems")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (systemError) return dbErrorResponse(systemError);
  if (!system) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: controls, error } = await supabase
    .from("ai_system_controls")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("ai_system_id", id)
    .order("status", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    controls: controls ?? [],
    readiness: calculateControlReadiness(controls ?? []),
  });
}
