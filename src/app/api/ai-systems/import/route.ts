import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  aiSystemImportSchema,
  parseBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import {
  buildAIInventoryImportPreview,
  markCreatedRows,
  type AISystemImportPayload,
  type ExistingAISystemForImport,
} from "@/lib/ai-governance/csv-import";

function toRow(body: AISystemImportPayload, orgId: string, userId: string) {
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

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasRole(ctx.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await parseBody(request, aiSystemImportSchema);
  if (body instanceof NextResponse) return body;

  if (!body.dryRun) {
    const mfa = await getMfaSnapshot();
    if (adminNeedsAal2(ctx.role, mfa?.currentLevel ?? "aal1")) {
      return NextResponse.json(mfaRequiredError, { status: 403 });
    }
  }

  const supabase = await createServerSupabase();
  const { data: existingSystems, error: existingError } = await supabase
    .from("ai_systems")
    .select("id,name,use_case")
    .eq("org_id", ctx.orgId);

  if (existingError) return dbErrorResponse(existingError);

  const preview = buildAIInventoryImportPreview({
    csvText: body.csvText,
    existingSystems: (existingSystems ?? []) as ExistingAISystemForImport[],
  });

  if (body.dryRun || preview.globalErrors.length > 0) {
    return NextResponse.json({
      success: true,
      dryRun: body.dryRun,
      ...preview,
      createdSystems: [],
    });
  }

  const readyRows = preview.rows.filter((row) => row.status === "ready");
  if (readyRows.length === 0) {
    return NextResponse.json({
      success: true,
      dryRun: false,
      ...preview,
      createdSystems: [],
    });
  }

  const { data: createdSystems, error: createError } = await supabase
    .from("ai_systems")
    .insert(readyRows.map((row) => toRow(row.payload, ctx.orgId, ctx.userId)))
    .select("*");

  if (createError) return dbErrorResponse(createError);

  const created = createdSystems ?? [];
  const createdIdsByRowNumber = new Map<number, string>();
  readyRows.forEach((row, index) => {
    const createdSystem = created[index];
    if (createdSystem?.id) createdIdsByRowNumber.set(row.rowNumber, createdSystem.id);
  });

  await Promise.all(
    created.map((system, index) =>
      recordAudit(ctx, {
        action: "ai_system.import",
        target_type: "ai_system",
        target_id: system.id,
        summary: `Imported AI system ${system.name}`,
        after: {
          name: system.name,
          use_case: system.use_case,
          approval_status: system.approval_status,
          source: system.source,
          row_number: readyRows[index]?.rowNumber,
        },
        ip: clientIp(request),
        user_agent: request.headers.get("user-agent"),
      })
    )
  );

  const result = markCreatedRows(preview, createdIdsByRowNumber);

  return NextResponse.json(
    {
      success: true,
      dryRun: false,
      ...result,
      createdSystems: created,
    },
    { status: 201 }
  );
}
