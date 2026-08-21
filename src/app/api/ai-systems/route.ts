import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  parseBody,
  aiSystemCreateSchema,
  type AISystemCreateBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";

function toRow(body: AISystemCreateBody, orgId: string, userId: string) {
  return {
    org_id: orgId,
    name: body.name,
    description: body.description,
    owner_name: body.ownerName,
    owner_email: body.ownerEmail || null,
    department: body.department,
    vendor_name: body.vendorName,
    model_name: body.modelName,
    use_case: body.useCase,
    business_process: body.businessProcess,
    data_types: body.dataTypes,
    data_sensitivity: body.dataSensitivity,
    customer_facing: body.customerFacing,
    employee_facing: body.employeeFacing,
    automated_decisions: body.automatedDecisions,
    human_review_required: body.humanReviewRequired,
    training_data_use: body.trainingDataUse,
    approval_status: body.approvalStatus,
    next_review_date: body.nextReviewDate || null,
    source: body.source,
    connected_app_id: body.connectedAppId,
    created_by: userId,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const approval = url.searchParams.get("approval");
  const risk = url.searchParams.get("risk");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("ai_systems")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (approval) query = query.eq("approval_status", approval);
  if (risk) query = query.eq("risk_tier", risk);

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);

  return NextResponse.json({
    systems: data ?? [],
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

  const body = await parseBody(request, aiSystemCreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_systems")
    .insert(toRow(body, ctx.orgId, ctx.userId))
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "ai_system.create",
    target_type: "ai_system",
    target_id: data.id,
    summary: `Created AI system ${data.name}`,
    after: {
      name: data.name,
      approval_status: data.approval_status,
      source: data.source,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, system: data }, { status: 201 });
}
