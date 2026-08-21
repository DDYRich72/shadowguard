import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, aiRiskAssessmentSchema } from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { assessAIRisk, type RiskAssessmentInput } from "@/lib/ai-governance/risk-assessment";
import { buildControlTaskSeeds } from "@/lib/ai-governance/controls";

const QUESTION_TEXT: Record<keyof RiskAssessmentInput, string> = {
  dataSensitivity: "Highest sensitivity of data processed",
  processesPersonalData: "Processes personal data",
  processesCustomerData: "Processes customer data",
  processesEmployeeData: "Processes employee data",
  regulatedDecisionArea: "Regulated or high-impact decision area",
  customerFacing: "Customer-facing system",
  employeeFacing: "Employee-facing system",
  autonomousActions: "Can take autonomous actions",
  humanReviewRequired: "Human review required",
  vendorApproved: "Vendor approved",
  hasSoc2: "SOC 2 or equivalent reviewed",
  hasDpa: "DPA or privacy terms reviewed",
  loggingEnabled: "Usage logging enabled",
  businessCriticality: "Business criticality",
  usesDataForTraining: "Vendor can use data for model training",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, aiRiskAssessmentSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: system, error: systemError } = await supabase
    .from("ai_systems")
    .select("id, name, risk_tier")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (systemError) return dbErrorResponse(systemError);
  if (!system) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const input: RiskAssessmentInput = {
    dataSensitivity: body.dataSensitivity,
    processesPersonalData: body.processesPersonalData,
    processesCustomerData: body.processesCustomerData,
    processesEmployeeData: body.processesEmployeeData,
    regulatedDecisionArea: body.regulatedDecisionArea,
    customerFacing: body.customerFacing,
    employeeFacing: body.employeeFacing,
    autonomousActions: body.autonomousActions,
    humanReviewRequired: body.humanReviewRequired,
    vendorApproved: body.vendorApproved,
    hasSoc2: body.hasSoc2,
    hasDpa: body.hasDpa,
    loggingEnabled: body.loggingEnabled,
    businessCriticality: body.businessCriticality,
    usesDataForTraining: body.usesDataForTraining,
  };
  const result = assessAIRisk(input);

  const { data: latest } = await supabase
    .from("ai_risk_assessments")
    .select("version")
    .eq("org_id", ctx.orgId)
    .eq("ai_system_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version ?? 0) + 1;

  const completed = body.status === "completed";
  const { data: assessment, error } = await supabase
    .from("ai_risk_assessments")
    .insert({
      org_id: ctx.orgId,
      ai_system_id: id,
      version,
      status: body.status,
      data_risk_score: result.dataRiskScore,
      security_risk_score: result.securityRiskScore,
      regulatory_risk_score: result.regulatoryRiskScore,
      business_impact_score: result.businessImpactScore,
      overall_score: result.overallScore,
      risk_tier: result.riskTier,
      summary: result.summary,
      recommended_controls: result.recommendedControls,
      completed_by: completed ? ctx.userId : null,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return dbErrorResponse(error);

  const answerRows = (Object.keys(input) as (keyof RiskAssessmentInput)[]).map((key) => ({
    org_id: ctx.orgId,
    assessment_id: assessment.id,
    question_key: key,
    question_text: QUESTION_TEXT[key],
    answer_value: input[key],
    risk_points: result.questionRiskPoints[key],
  }));
  const { error: answersError } = await supabase
    .from("ai_risk_assessment_answers")
    .insert(answerRows);
  if (answersError) return dbErrorResponse(answersError);

  if (completed) {
    const controlSeeds = buildControlTaskSeeds({
      orgId: ctx.orgId,
      aiSystemId: id,
      assessmentId: assessment.id,
      controls: result.recommendedControls,
    });

    if (controlSeeds.length > 0) {
      const { error: controlsError } = await supabase
        .from("ai_system_controls")
        .upsert(controlSeeds, {
          onConflict: "org_id,ai_system_id,control_key",
        });
      if (controlsError) return dbErrorResponse(controlsError);
    }

    await supabase
      .from("ai_systems")
      .update({
        risk_tier: result.riskTier,
        data_sensitivity: body.dataSensitivity,
        customer_facing: body.customerFacing,
        employee_facing: body.employeeFacing,
        automated_decisions: body.autonomousActions,
        human_review_required: body.humanReviewRequired,
      })
      .eq("id", id)
      .eq("org_id", ctx.orgId);
  }

  await recordAudit(ctx, {
    action: "ai_assessment.create",
    target_type: "ai_risk_assessment",
    target_id: assessment.id,
    summary: `Completed AI risk assessment for ${system.name}`,
    after: {
      ai_system_id: id,
      version,
      risk_tier: result.riskTier,
      overall_score: result.overallScore,
      controls_materialized: completed ? result.recommendedControls.length : 0,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    assessment,
    result,
  }, { status: 201 });
}
