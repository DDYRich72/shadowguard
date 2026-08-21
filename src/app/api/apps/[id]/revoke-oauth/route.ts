import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { dbErrorResponse } from "@/lib/errors";
import { getMfaSnapshot, adminNeedsAal2, mfaRequiredError } from "@/lib/mfa";
import { parseBody, oauthRevokeSchema } from "@/lib/api/schemas";
import { clientIp, rateLimit, rateLimited } from "@/lib/rate-limit";
import { evaluateApiMutationOrigin } from "@/lib/security";
import {
  normalizeRevocationTargets,
  revocationSucceeded,
  revokeProviderTargets,
  type OAuthProvider,
  type OAuthProviderRevocationResult,
  type OAuthRevocationStatus,
} from "@/lib/oauth-revocation";
import {
  getGoogleAccessToken,
  getMicrosoftAccessToken,
} from "@/lib/tokens";

type ConnectedAppRow = {
  id: string;
  app_name: string;
  status: string;
  source_platforms: string[] | null;
  oauth_revocation_targets: unknown;
};

type OrgConnectionRow = {
  google_connected: boolean | null;
  microsoft_connected: boolean | null;
};

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
      message: "Cross-site OAuth revocation requests are not allowed.",
      reason: origin.reason,
    },
    { status: 403 }
  );
}

async function requireRevocationMutation() {
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

function providerConnected(
  provider: OAuthProvider,
  org: OrgConnectionRow | null
): boolean {
  return provider === "google"
    ? org?.google_connected === true
    : org?.microsoft_connected === true;
}

async function getProviderAccessToken(
  orgId: string,
  provider: OAuthProvider
): Promise<string | null> {
  try {
    return provider === "google"
      ? await getGoogleAccessToken(orgId)
      : await getMicrosoftAccessToken(orgId);
  } catch {
    return null;
  }
}

function emptyProviderResult(
  provider: OAuthProvider,
  status: OAuthRevocationStatus,
  providerErrorCategory?: string
): OAuthProviderRevocationResult {
  return {
    provider,
    status,
    targetCount: 0,
    revokedTargetCount: 0,
    alreadyRevokedTargetCount: 0,
    targetResults: [],
    providerErrorCategory,
  };
}

function clientMessage(params: {
  appName: string;
  provider: OAuthProvider;
  status: OAuthRevocationStatus;
  targetCount: number;
}): string {
  const providerLabel = params.provider === "google" ? "Google Workspace" : "Microsoft 365";
  switch (params.status) {
    case "success":
      return `${providerLabel} revoked OAuth access for ${params.appName}. Run a new scan to verify the provider state.`;
    case "already_revoked":
    case "not_found":
      return `${providerLabel} reports that the recorded grant for ${params.appName} is already gone. Run a new scan to refresh ShadowGuard.`;
    case "missing_provider_connection":
      return `${providerLabel} is not connected for this organization. Reconnect the provider before revoking grants.`;
    case "missing_provider_permission":
      return params.targetCount === 0
        ? `ShadowGuard does not have recorded ${providerLabel} grant targets for ${params.appName}. Reconnect with revocation permissions and run a new scan.`
        : `${providerLabel} rejected the revocation permission. Reconnect with the required admin consent and try again.`;
    case "provider_rate_limited":
      return `${providerLabel} rate-limited the revocation request. Try again after the provider retry window.`;
    case "unsupported_provider":
      return `${params.appName} does not have a supported OAuth revocation target for ${providerLabel}.`;
    default:
      return `${providerLabel} returned an error while revoking ${params.appName}. No success is claimed; review provider permissions and try again.`;
  }
}

function lastResultPayload(params: {
  provider: OAuthProvider;
  result: OAuthProviderRevocationResult;
  actorUserId: string;
}) {
  return {
    provider: params.provider,
    result: params.result.status,
    targetCount: params.result.targetCount,
    revokedTargetCount: params.result.revokedTargetCount,
    alreadyRevokedTargetCount: params.result.alreadyRevokedTargetCount,
    providerErrorCategory: params.result.providerErrorCategory ?? null,
    actorUserId: params.actorUserId,
    attemptedAt: new Date().toISOString(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originResponse = mutationOriginResponse(request);
  if (originResponse) return originResponse;

  const gate = await requireRevocationMutation();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const limit = await rateLimit(`revoke-oauth:${ctx.orgId}:${ctx.userId}`, 10, 60_000);
  if (!limit.allowed) return rateLimited(limit);

  const body = await parseBody(request, oauthRevokeSchema);
  if (body instanceof NextResponse) return body;
  const provider = body.provider as OAuthProvider;
  const { id } = await params;

  const supabase = await createServerSupabase();
  const { data: app, error: appError } = await supabase
    .from("connected_apps")
    .select("id, app_name, status, source_platforms, oauth_revocation_targets")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle<ConnectedAppRow>();

  if (appError) return dbErrorResponse(appError);
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("google_connected, microsoft_connected")
    .eq("id", ctx.orgId)
    .maybeSingle<OrgConnectionRow>();
  if (orgError) return dbErrorResponse(orgError);

  const sourcePlatforms = app.source_platforms ?? [];
  const allTargets = normalizeRevocationTargets(app.oauth_revocation_targets);
  const providerTargets = allTargets.filter((target) => target.provider === provider);

  let result: OAuthProviderRevocationResult;
  if (!sourcePlatforms.includes(provider)) {
    result = emptyProviderResult(provider, "unsupported_provider");
  } else if (!providerConnected(provider, org ?? null)) {
    result = emptyProviderResult(provider, "missing_provider_connection");
  } else if (providerTargets.length === 0) {
    result = emptyProviderResult(
      provider,
      "missing_provider_permission",
      "missing_recorded_grant_target"
    );
  } else {
    const accessToken = await getProviderAccessToken(ctx.orgId, provider);
    result = accessToken
      ? await revokeProviderTargets({
          provider,
          accessToken,
          targets: providerTargets,
        })
      : emptyProviderResult(provider, "missing_provider_connection");
  }

  const finalStatus = revocationSucceeded(result.status) ? "blocked" : app.status;
  const lastResult = lastResultPayload({
    provider,
    result,
    actorUserId: ctx.userId,
  });
  const message = clientMessage({
    appName: app.app_name,
    provider,
    status: result.status,
    targetCount: result.targetCount,
  });

  await recordAudit(ctx, {
    action: "app.oauth_revoke",
    target_type: "connected_app",
    target_id: app.id,
    summary: `${provider} OAuth revocation for ${app.app_name}: ${result.status}`,
    after: {
      app_id: app.id,
      app_name: app.app_name,
      provider,
      result: result.status,
      target_count: result.targetCount,
      revoked_target_count: result.revokedTargetCount,
      already_revoked_target_count: result.alreadyRevokedTargetCount,
      provider_error_category: result.providerErrorCategory ?? null,
      target_results: result.targetResults.map((targetResult) => ({
        target_key: targetResult.targetKey,
        status: targetResult.status,
        provider_status: targetResult.providerStatus ?? null,
        provider_error_category: targetResult.providerErrorCategory ?? null,
      })),
    },
    ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  const updatePatch: Record<string, unknown> = {
    oauth_revocation_last_result: lastResult,
  };
  if (finalStatus !== app.status) {
    updatePatch.status = finalStatus;
  }

  const { error: updateError } = await supabase
    .from("connected_apps")
    .update(updatePatch)
    .eq("id", app.id)
    .eq("org_id", ctx.orgId);
  if (updateError) return dbErrorResponse(updateError);

  if (revocationSucceeded(result.status)) {
    await supabase.from("blocklist").upsert(
      {
        org_id: ctx.orgId,
        app_name: app.app_name,
        blocked_by: ctx.email ?? "system",
        reason: `Admin revoked ${provider} OAuth access`,
      },
      { onConflict: "org_id,app_name" }
    );
  }

  return NextResponse.json({
    success: revocationSucceeded(result.status),
    appId: app.id,
    appName: app.app_name,
    provider,
    result: result.status,
    errorCode: revocationSucceeded(result.status) ? null : result.status,
    message,
    rescanRecommended: revocationSucceeded(result.status),
    targetCount: result.targetCount,
    revokedTargetCount: result.revokedTargetCount,
    alreadyRevokedTargetCount: result.alreadyRevokedTargetCount,
    providerErrorCategory: result.providerErrorCategory ?? null,
    newStatus: finalStatus,
    timestamp: lastResult.attemptedAt,
  });
}
