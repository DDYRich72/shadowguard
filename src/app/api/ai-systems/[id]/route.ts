import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  parseBody,
  aiSystemPatchSchema,
  type AISystemPatchBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { calculateControlReadiness } from "@/lib/ai-governance/controls";

function isMissingControlsTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("ai_system_controls");
}

function isMissingEvidenceTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("ai_system_evidence");
}

function controlsMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
}

function evidenceMigrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
}

function patchToRow(body: AISystemPatchBody) {
  const row: Record<string, unknown> = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.description !== undefined) row.description = body.description;
  if (body.ownerName !== undefined) row.owner_name = body.ownerName;
  if (body.ownerEmail !== undefined) row.owner_email = body.ownerEmail || null;
  if (body.department !== undefined) row.department = body.department;
  if (body.vendorName !== undefined) row.vendor_name = body.vendorName;
  if (body.modelName !== undefined) row.model_name = body.modelName;
  if (body.useCase !== undefined) row.use_case = body.useCase;
  if (body.businessProcess !== undefined) row.business_process = body.businessProcess;
  if (body.dataTypes !== undefined) row.data_types = body.dataTypes;
  if (body.dataSensitivity !== undefined) row.data_sensitivity = body.dataSensitivity;
  if (body.customerFacing !== undefined) row.customer_facing = body.customerFacing;
  if (body.employeeFacing !== undefined) row.employee_facing = body.employeeFacing;
  if (body.automatedDecisions !== undefined) row.automated_decisions = body.automatedDecisions;
  if (body.humanReviewRequired !== undefined) row.human_review_required = body.humanReviewRequired;
  if (body.trainingDataUse !== undefined) row.training_data_use = body.trainingDataUse;
  if (body.approvalStatus !== undefined) row.approval_status = body.approvalStatus;
  if (body.nextReviewDate !== undefined) row.next_review_date = body.nextReviewDate || null;
  if (body.source !== undefined) row.source = body.source;
  if (body.connectedAppId !== undefined) row.connected_app_id = body.connectedAppId;
  if (body.status !== undefined) row.status = body.status;
  if (body.riskTier !== undefined) row.risk_tier = body.riskTier;
  return row;
}

async function requireMutation() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const mfa = await getMfaSnapshot();
  if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
    return { response: NextResponse.json(mfaRequiredError, { status: 403 }) };
  }
  return { ctx };
}

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
  const { data: system, error } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!system) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: latestAssessment, error: assessmentError } = await supabase
    .from("ai_risk_assessments")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) return dbErrorResponse(assessmentError);

  const { data: controls, error: controlsError } = await supabase
    .from("ai_system_controls")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("status", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (controlsError) {
    if (isMissingControlsTable(controlsError)) return controlsMigrationRequiredResponse();
    return dbErrorResponse(controlsError);
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("ai_system_evidence")
    .select("*")
    .eq("ai_system_id", id)
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (evidenceError) {
    if (isMissingEvidenceTable(evidenceError)) return evidenceMigrationRequiredResponse();
    return dbErrorResponse(evidenceError);
  }

  return NextResponse.json({
    system,
    latestAssessment,
    controls: controls ?? [],
    evidence: evidence ?? [],
    readiness: calculateControlReadiness(controls ?? []),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, aiSystemPatchSchema);
  if (body instanceof NextResponse) return body;
  const patch = patchToRow(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("ai_systems")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) return dbErrorResponse(beforeError);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase
    .from("ai_systems")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  await recordAudit(ctx, {
    action: "ai_system.update",
    target_type: "ai_system",
    target_id: data.id,
    summary: `Updated AI system ${data.name}`,
    before: {
      name: before.name,
      approval_status: before.approval_status,
      risk_tier: before.risk_tier,
      status: before.status,
    },
    after: {
      name: data.name,
      approval_status: data.approval_status,
      risk_tier: data.risk_tier,
      status: data.status,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, system: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_systems")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id, name, status")
    .maybeSingle();

  if (error) return dbErrorResponse(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordAudit(ctx, {
    action: "ai_system.archive",
    target_type: "ai_system",
    target_id: data.id,
    summary: `Archived AI system ${data.name}`,
    after: { status: data.status },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, system: data });
}
