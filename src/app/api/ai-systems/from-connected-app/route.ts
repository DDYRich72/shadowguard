import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, aiSystemFromConnectedAppSchema } from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";

function approvalFromStatus(status: string): "approved" | "blocked" | "under_review" {
  if (status === "approved") return "approved";
  if (status === "blocked") return "blocked";
  return "under_review";
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

  const body = await parseBody(request, aiSystemFromConnectedAppSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: app, error: appError } = await supabase
    .from("connected_apps")
    .select(
      "id, app_name, app_category, risk_level, status, permissions, connected_users, has_soc2, has_gdpr, has_hipaa"
    )
    .eq("id", body.connectedAppId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (appError) return dbErrorResponse(appError);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const defaultUseCase =
    body.useCase ||
    `Governed use of ${app.app_name} for ${app.app_category || "AI-enabled work"}`;

  const { data, error } = await supabase
    .from("ai_systems")
    .insert({
      org_id: ctx.orgId,
      name: app.app_name,
      description: `Created from discovered app ${app.app_name}.`,
      owner_name: body.ownerName,
      owner_email: body.ownerEmail || null,
      department: body.department,
      vendor_name: app.app_name,
      model_name: "",
      use_case: defaultUseCase,
      business_process: app.app_category ?? "",
      data_types: [],
      data_sensitivity:
        app.risk_level === "critical" || app.risk_level === "high"
          ? "confidential"
          : "internal",
      customer_facing: false,
      employee_facing: true,
      automated_decisions: false,
      human_review_required: true,
      training_data_use: "unknown",
      approval_status: approvalFromStatus(app.status),
      risk_tier: app.risk_level,
      source: "discovered",
      connected_app_id: app.id,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "ai_system.convert_from_app",
    target_type: "ai_system",
    target_id: data.id,
    summary: `Converted ${app.app_name} into an AI system`,
    after: {
      connected_app_id: app.id,
      name: data.name,
      risk_tier: data.risk_tier,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, system: data }, { status: 201 });
}

