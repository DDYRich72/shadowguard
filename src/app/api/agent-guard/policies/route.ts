import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getSessionOrgId } from "@/lib/tokens";
import { getSessionContext, hasRole } from "@/lib/authz";
import { dbErrorResponse } from "@/lib/errors";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { parseBody, policyBodySchema } from "@/lib/api/schemas";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { DEFAULT_POLICIES } from "@/lib/agent-guard/engine";

async function seedDefaults(orgId: string) {
  // Use admin client for the seed — avoids RLS insert checks on a brand-new
  // org. Data is still org-scoped via the inserted org_id.
  const admin = createAdminSupabase();
  await admin.from("agent_policies").insert(
    DEFAULT_POLICIES.map((p) => ({
      org_id: orgId,
      name: p.name,
      description: p.description,
      enabled: p.enabled,
      priority: p.priority,
      conditions: p.conditions,
      action: p.action,
    }))
  );
}

export async function GET() {
  const orgId = await getSessionOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`get:policies:${orgId}`, 60, 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const supabase = await createServerSupabase();
  const { error, data: initialData } = await supabase
    .from("agent_policies")
    .select("id, name, description, enabled, priority, conditions, action, created_at, updated_at")
    .eq("org_id", orgId)
    .order("priority", { ascending: true });
  let data = initialData;

  if (error) {
    return dbErrorResponse(error);
  }

  if (!data || data.length === 0) {
    await seedDefaults(orgId);
    ({ data } = await supabase
      .from("agent_policies")
      .select("id, name, description, enabled, priority, conditions, action, created_at, updated_at")
      .eq("org_id", orgId)
      .order("priority", { ascending: true }));
  }

  return NextResponse.json({
    policies: data ?? [],
    total: data?.length ?? 0,
    timestamp: new Date().toISOString(),
  });
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

  const body = await parseBody(request, policyBodySchema);
  if (body instanceof NextResponse) return body;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("agent_policies")
    .insert({
      org_id: ctx.orgId,
      name: body.name,
      description: body.description,
      enabled: body.enabled,
      priority: body.priority,
      conditions: body.conditions,
      action: body.action,
      created_by: ctx.email,
    })
    .select()
    .single();

  if (error) {
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "policy.create",
    target_type: "agent_policy",
    target_id: data?.id,
    summary: `Created policy "${data?.name}" (${data?.action})`,
    after: data,
  });

  return NextResponse.json({ policy: data });
}
