import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  aiSystemEvidenceCreateSchema,
  parseBody,
  type AISystemEvidenceCreateBody,
} from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

function isMissingEvidenceTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST205" || message.includes("ai_system_evidence");
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

function toRow(body: AISystemEvidenceCreateBody, orgId: string, systemId: string, userId: string) {
  return {
    org_id: orgId,
    ai_system_id: systemId,
    control_id: body.controlId,
    title: body.title,
    category: body.category,
    owner: body.owner,
    status: body.status,
    evidence_url: body.evidenceUrl || "",
    notes: body.notes,
    created_by: userId,
  };
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

async function verifySystem(supabase: Awaited<ReturnType<typeof createServerSupabase>>, id: string, orgId: string) {
  const { data: system, error } = await supabase
    .from("ai_systems")
    .select("id,name")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  return { system, error };
}

async function controlBelongsToSystem(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  controlId: string;
  systemId: string;
  orgId: string;
}) {
  const { supabase, controlId, systemId, orgId } = params;
  const { data, error } = await supabase
    .from("ai_system_controls")
    .select("id,title")
    .eq("id", controlId)
    .eq("ai_system_id", systemId)
    .eq("org_id", orgId)
    .maybeSingle();

  return { control: data, error };
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
  const { system, error: systemError } = await verifySystem(supabase, id, ctx.orgId);
  if (systemError) return dbErrorResponse(systemError);
  if (!system) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: evidence, error } = await supabase
    .from("ai_system_evidence")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("ai_system_id", id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingEvidenceTable(error)) return evidenceMigrationRequiredResponse();
    return dbErrorResponse(error);
  }

  return NextResponse.json({ evidence: evidence ?? [] });
}

export async function POST(
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

  const body = await parseBody(request, aiSystemEvidenceCreateSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { system, error: systemError } = await verifySystem(supabase, id, ctx.orgId);
  if (systemError) return dbErrorResponse(systemError);
  if (!system) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.controlId) {
    const { control, error: controlError } = await controlBelongsToSystem({
      supabase,
      controlId: body.controlId,
      systemId: id,
      orgId: ctx.orgId,
    });
    if (controlError) return dbErrorResponse(controlError);
    if (!control) {
      return NextResponse.json({ error: "invalid_control" }, { status: 400 });
    }
  }

  const { data: evidence, error } = await supabase
    .from("ai_system_evidence")
    .insert(toRow(body, ctx.orgId, id, ctx.userId))
    .select("*")
    .single();

  if (error) {
    if (isMissingEvidenceTable(error)) return evidenceMigrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "ai_evidence.create",
    target_type: "ai_system_evidence",
    target_id: evidence.id,
    summary: `Created evidence ${evidence.title}`,
    after: {
      ai_system_id: evidence.ai_system_id,
      control_id: evidence.control_id,
      title: evidence.title,
      category: evidence.category,
      status: evidence.status,
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, evidence }, { status: 201 });
}
