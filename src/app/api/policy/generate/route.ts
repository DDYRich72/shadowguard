import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { parseBody, policyGenerateSchema } from "@/lib/api/schemas";
import { dbErrorResponse, serverErrorResponse } from "@/lib/errors";
import { adminNeedsAal2, getMfaSnapshot, mfaRequiredError } from "@/lib/mfa";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import { generatePolicyDraft } from "@/lib/policy-generator";

async function requirePolicyDocumentMutation() {
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

function mutationOriginResponse(request: NextRequest) {
  const origin = evaluateApiMutationOrigin({
    method: request.method,
    url: request.url,
    headers: request.headers,
  });
  if (origin.allowed) return null;

  return NextResponse.json(
    {
      error: "invalid_origin",
      message: "Cross-site policy document mutations are not allowed.",
      reason: origin.reason,
    },
    { status: 403 }
  );
}

/**
 * Generate an editable AI usage policy draft and persist a versioned copy.
 *
 * This remains a truthful draft generator. It
 * does not auto-load scan results, approvals, blocklists, AI Systems,
 * AgentGuard activity, governance reports, or evidence records yet.
 */
export async function POST(request: NextRequest) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  try {
    const gate = await requirePolicyDocumentMutation();
    if ("response" in gate) return gate.response;
    const { ctx } = gate;

    const limit = await rateLimit(`create:policy-document:${ctx.orgId}`, 10, 60_000);
    if (!limit.allowed) return rateLimited(limit);

    const body = await parseBody(request, policyGenerateSchema);
    if (body instanceof NextResponse) return body;

    const generatedAt = new Date();
    const draft = generatePolicyDraft(body, generatedAt);

    const supabase = await createServerSupabase();
    const { data: latest, error: latestError } = await supabase
      .from("policy_documents")
      .select("version")
      .eq("org_id", ctx.orgId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) return dbErrorResponse(latestError);

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data: inserted, error: insertError } = await supabase
      .from("policy_documents")
      .insert({
        org_id: ctx.orgId,
        version: nextVersion,
        markdown: draft.markdown,
        industry: body.industry,
        risk_tolerance: body.riskTolerance,
        created_by: ctx.userId,
      })
      .select("id, version, created_at")
      .single();

    if (insertError) return dbErrorResponse(insertError);
    if (!inserted) {
      return serverErrorResponse(
        new Error("Policy document insert returned no row")
      );
    }

    await recordAudit(ctx, {
      action: "policy_document.create",
      target_type: "policy_document",
      target_id: inserted.id,
      summary: `Generated AI usage policy draft v${inserted.version}`,
      after: {
        id: inserted.id,
        version: inserted.version,
        industry: body.industry,
        risk_tolerance: body.riskTolerance,
        source_mode: draft.sourceSummary.inputMode,
        approved_tool_count: draft.sourceSummary.approvedToolCount,
        blocked_tool_count: draft.sourceSummary.blockedToolCount,
      },
      ip: clientIp(request),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      policy: draft.markdown,
      document: inserted,
      generatedAt: generatedAt.toISOString(),
      industry: body.industry,
      sourceSummary: draft.sourceSummary,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
