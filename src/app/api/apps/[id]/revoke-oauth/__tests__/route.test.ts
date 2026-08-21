import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getSessionContext: vi.fn(),
  hasRole: vi.fn(),
  getMfaSnapshot: vi.fn(),
  adminNeedsAal2: vi.fn(),
  rateLimit: vi.fn(),
  recordAudit: vi.fn(),
  evaluateApiMutationOrigin: vi.fn(),
  getGoogleAccessToken: vi.fn(),
  getMicrosoftAccessToken: vi.fn(),
  revokeProviderTargets: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

vi.mock("@/lib/authz", () => ({
  getSessionContext: mocks.getSessionContext,
  hasRole: mocks.hasRole,
}));

vi.mock("@/lib/mfa", () => ({
  getMfaSnapshot: mocks.getMfaSnapshot,
  adminNeedsAal2: mocks.adminNeedsAal2,
  mfaRequiredError: { error: "mfa_required", message: "MFA required" },
}));

vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: mocks.rateLimit,
  rateLimited: () => Response.json({ error: "rate_limited" }, { status: 429 }),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: mocks.recordAudit,
}));

vi.mock("@/lib/security", () => ({
  evaluateApiMutationOrigin: mocks.evaluateApiMutationOrigin,
}));

vi.mock("@/lib/tokens", () => ({
  getGoogleAccessToken: mocks.getGoogleAccessToken,
  getMicrosoftAccessToken: mocks.getMicrosoftAccessToken,
}));

vi.mock("@/lib/errors", () => ({
  dbErrorResponse: () => Response.json({ error: "database_error" }, { status: 500 }),
}));

vi.mock("@/lib/oauth-revocation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth-revocation")>();
  return {
    ...actual,
    revokeProviderTargets: mocks.revokeProviderTargets,
  };
});

import { POST } from "../route";

const ctx = {
  orgId: "org-1",
  role: "admin",
  userId: "user-1",
  email: "admin@example.com",
};

const googleTarget = {
  provider: "google",
  kind: "google_workspace_token",
  userKey: "user@example.com",
  clientId: "google-client-1",
};

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "https://shadowguard.test/api/apps/app-1/revoke-oauth",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function params(id = "app-1") {
  return { params: Promise.resolve({ id }) };
}

function selectChain<T>(data: T | null, error: Record<string, unknown> | null = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  return chain;
}

function updateChain(updates: Record<string, unknown>[]) {
  const chain = {
    update: vi.fn((values: Record<string, unknown>) => {
      updates.push(values);
      return chain;
    }),
    eq: vi.fn(() => chain),
  };
  return chain;
}

function upsertChain(upserts: Record<string, unknown>[]) {
  return {
    upsert: vi.fn((values: Record<string, unknown>) => {
      upserts.push(values);
      return { error: null };
    }),
  };
}

function supabaseForRevocation(options?: {
  app?: Record<string, unknown> | null;
  org?: Record<string, unknown> | null;
  updates?: Record<string, unknown>[];
  upserts?: Record<string, unknown>[];
}) {
  const updates = options?.updates ?? [];
  const upserts = options?.upserts ?? [];
  const appSelect = selectChain(
    options?.app ?? {
      id: "app-1",
      app_name: "Example AI",
      status: "active",
      source_platforms: ["google"],
      oauth_revocation_targets: [googleTarget],
    }
  );
  const orgSelect = selectChain(
    options?.org ?? {
      google_connected: true,
      microsoft_connected: false,
    }
  );
  const appUpdate = updateChain(updates);
  const blocklist = upsertChain(upserts);
  let connectedAppsCalls = 0;

  return {
    updates,
    upserts,
    client: {
      from: vi.fn((table: string) => {
        if (table === "connected_apps") {
          connectedAppsCalls += 1;
          return connectedAppsCalls === 1 ? appSelect : appUpdate;
        }
        if (table === "organizations") return orgSelect;
        if (table === "blocklist") return blocklist;
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionContext.mockResolvedValue(ctx);
  mocks.hasRole.mockReturnValue(true);
  mocks.getMfaSnapshot.mockResolvedValue({ currentLevel: "aal2" });
  mocks.adminNeedsAal2.mockReturnValue(false);
  mocks.rateLimit.mockResolvedValue({
    allowed: true,
    limit: 10,
    remaining: 9,
    retryAfterSeconds: 0,
  });
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.evaluateApiMutationOrigin.mockReturnValue({ allowed: true });
  mocks.getGoogleAccessToken.mockResolvedValue("google-token");
  mocks.getMicrosoftAccessToken.mockResolvedValue("ms-token");
  mocks.revokeProviderTargets.mockResolvedValue({
    provider: "google",
    status: "success",
    targetCount: 1,
    revokedTargetCount: 1,
    alreadyRevokedTargetCount: 0,
    targetResults: [
      {
        targetKey: "google:user@example.com:google-client-1",
        status: "success",
        providerStatus: 204,
      },
    ],
  });
});

describe("OAuth revocation route", () => {
  it("requires an admin or manager role before database access", async () => {
    mocks.hasRole.mockReturnValue(false);

    const response = (await POST(request({ provider: "google" }), params())) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden" });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("requires AAL2 when the privileged-role policy requires it", async () => {
    mocks.adminNeedsAal2.mockReturnValue(true);

    const response = (await POST(request({ provider: "google" }), params())) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "mfa_required" });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("validates the provider request body", async () => {
    const response = (await POST(request({ provider: "dropbox" }), params())) as Response;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "validation_failed",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("revokes provider targets, blocks the app, blocklists it, and audits the attempt", async () => {
    const updates: Record<string, unknown>[] = [];
    const upserts: Record<string, unknown>[] = [];
    const supabase = supabaseForRevocation({ updates, upserts });
    mocks.createServerSupabase.mockResolvedValue(supabase.client);

    const response = (await POST(request({ provider: "google" }), params())) as Response;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      appId: "app-1",
      appName: "Example AI",
      provider: "google",
      result: "success",
      newStatus: "blocked",
    });
    expect(mocks.getGoogleAccessToken).toHaveBeenCalledWith("org-1");
    expect(mocks.revokeProviderTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        accessToken: "google-token",
        targets: expect.arrayContaining([expect.objectContaining(googleTarget)]),
      })
    );
    expect(updates[0]).toMatchObject({
      status: "blocked",
      oauth_revocation_last_result: expect.objectContaining({
        provider: "google",
        result: "success",
      }),
    });
    expect(upserts[0]).toMatchObject({
      org_id: "org-1",
      app_name: "Example AI",
      blocked_by: "admin@example.com",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", userId: "user-1" }),
      expect.objectContaining({
        action: "app.oauth_revoke",
        target_type: "connected_app",
        target_id: "app-1",
        after: expect.objectContaining({
          provider: "google",
          result: "success",
          target_results: expect.arrayContaining([
            expect.objectContaining({
              target_key: "google:user@example.com:google-client-1",
              status: "success",
            }),
          ]),
        }),
      })
    );
  });

  it("returns missing_provider_permission when no recorded provider targets exist", async () => {
    const updates: Record<string, unknown>[] = [];
    const supabase = supabaseForRevocation({
      updates,
      app: {
        id: "app-1",
        app_name: "Old Scan App",
        status: "active",
        source_platforms: ["google"],
        oauth_revocation_targets: [],
      },
    });
    mocks.createServerSupabase.mockResolvedValue(supabase.client);

    const response = (await POST(request({ provider: "google" }), params())) as Response;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: false,
      result: "missing_provider_permission",
      errorCode: "missing_provider_permission",
      newStatus: "active",
    });
    expect(mocks.getGoogleAccessToken).not.toHaveBeenCalled();
    expect(mocks.revokeProviderTargets).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      oauth_revocation_last_result: expect.objectContaining({
        result: "missing_provider_permission",
        providerErrorCategory: "missing_recorded_grant_target",
      }),
    });
    expect(mocks.recordAudit).toHaveBeenCalledOnce();
  });

  it("treats already_revoked as idempotent success", async () => {
    const updates: Record<string, unknown>[] = [];
    const supabase = supabaseForRevocation({ updates });
    mocks.createServerSupabase.mockResolvedValue(supabase.client);
    mocks.revokeProviderTargets.mockResolvedValue({
      provider: "google",
      status: "already_revoked",
      targetCount: 1,
      revokedTargetCount: 0,
      alreadyRevokedTargetCount: 1,
      targetResults: [
        {
          targetKey: "google:user@example.com:google-client-1",
          status: "already_revoked",
          providerStatus: 404,
        },
      ],
    });

    const response = (await POST(request({ provider: "google" }), params())) as Response;
    const data = await response.json();

    expect(data).toMatchObject({
      success: true,
      result: "already_revoked",
      newStatus: "blocked",
    });
    expect(updates[0]).toMatchObject({ status: "blocked" });
  });
});
