import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";
import { agentPolicyReviewPatchSchema, parseBody } from "@/lib/api/schemas";
import { dbErrorResponse } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";

type Ctx = { params: Promise<{ id: string }> };

function isMissingPolicyReviewTable(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_policy_decision_reviews")
  );
}

function migrationRequiredResponse() {
  return NextResponse.json(
    {
      error: "migration_required",
      message:
        "Required database schema is unavailable. Apply the bundled initial migration and retry.",
    },
    { status: 503 }
  );
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

function patchToRow(
  body: {
    status?: "open" | "investigating" | "resolved" | "dismissed";
    assignedTo?: string;
    reviewNote?: string;
  },
  ctx: { userId: string }
) {
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    patch.status = body.status;
    if (body.status === "resolved" || body.status === "dismissed") {
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = ctx.userId;
    } else {
      patch.reviewed_at = null;
      patch.reviewed_by = null;
    }
  }
  if (body.assignedTo !== undefined) patch.assigned_to = body.assignedTo;
  if (body.reviewNote !== undefined) patch.review_note = body.reviewNote;
  return patch;
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireMutation();
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await parseBody(request, agentPolicyReviewPatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("agent_policy_decision_reviews")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (beforeError) {
    if (isMissingPolicyReviewTable(beforeError)) return migrationRequiredResponse();
    return dbErrorResponse(beforeError);
  }
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch = patchToRow(body, ctx);
  const { data, error } = await supabase
    .from("agent_policy_decision_reviews")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) {
    if (isMissingPolicyReviewTable(error)) return migrationRequiredResponse();
    return dbErrorResponse(error);
  }

  await recordAudit(ctx, {
    action: "agent_policy_decision_review.update",
    target_type: "agent_policy_decision_review",
    target_id: id,
    summary: `Updated AgentGuard policy review for ${data.tool_name}`,
    before: before as Record<string, unknown>,
    after: data as Record<string, unknown>,
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, review: data });
}
