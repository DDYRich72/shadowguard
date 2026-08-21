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

vi.mock("@/lib/errors", () => ({
  dbErrorResponse: () => Response.json({ error: "database_error" }, { status: 500 }),
  serverErrorResponse: () => Response.json({ error: "server_error" }, { status: 500 }),
}));

import { POST } from "../route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://shadowguard.test/api/policy/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    orgName: "Example Organization",
    industry: "general",
    riskTolerance: "balanced",
    approvedTools: [],
    blockedTools: [],
  };
}

function supabaseForPolicy(options?: {
  latest?: Record<string, unknown> | null;
  latestError?: Record<string, unknown> | null;
  inserted?: Record<string, unknown> | null;
  insertError?: Record<string, unknown> | null;
  insertedValues?: Record<string, unknown>[];
}) {
  const insertedValues = options?.insertedValues ?? [];
  const latestChain = {
    select: vi.fn(() => latestChain),
    eq: vi.fn(() => latestChain),
    order: vi.fn(() => latestChain),
    limit: vi.fn(() => latestChain),
    maybeSingle: vi.fn(async () => ({
      data: options?.latest ?? { version: 2 },
      error: options?.latestError ?? null,
    })),
  };
  const insertChain = {
    insert: vi.fn((values: Record<string, unknown>) => {
      insertedValues.push(values);
      return insertChain;
    }),
    select: vi.fn(() => insertChain),
    single: vi.fn(async () => ({
      data:
        options?.inserted === undefined
          ? {
              id: "policy-doc-1",
              version: 3,
              created_at: "2026-05-22T12:00:00.000Z",
            }
          : options.inserted,
      error: options?.insertError ?? null,
    })),
  };

  let fromCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table !== "policy_documents") {
        throw new Error(`Unexpected table: ${table}`);
      }
      fromCount += 1;
      return fromCount === 1 ? latestChain : insertChain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionContext.mockResolvedValue({
    orgId: "org-1",
    role: "admin",
    userId: "user-1",
    email: "admin@example.com",
  });
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
});

describe("policy generate route", () => {
  it("saves a truthful draft and records an audit event", async () => {
    const insertedValues: Record<string, unknown>[] = [];
    mocks.createServerSupabase.mockResolvedValue(
      supabaseForPolicy({ insertedValues })
    );

    const response = (await POST(request(validBody()))) as Response;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.policy).toContain("# AI Usage Policy Draft");
    expect(data.policy).toContain("does not yet auto-load scan results");
    expect(data.policy).not.toContain("Complete a scan first");
    expect(data.sourceSummary).toMatchObject({
      inputMode: "manual_request",
      serverLoadedScanData: false,
      dataBackedGenerationReady: false,
    });
    expect(insertedValues[0]).toMatchObject({
      org_id: "org-1",
      version: 3,
      industry: "general",
      risk_tolerance: "balanced",
      created_by: "user-1",
    });
    expect(mocks.recordAudit).toHaveBeenCalledOnce();
  });

  it("rejects cross-site browser mutations before DB access", async () => {
    mocks.evaluateApiMutationOrigin.mockReturnValue({
      allowed: false,
      reason: "origin_mismatch",
    });

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_origin",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("requires admin or manager role", async () => {
    mocks.hasRole.mockReturnValue(false);

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden" });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("requires MFA when the privileged-role policy requires AAL2", async () => {
    mocks.adminNeedsAal2.mockReturnValue(true);

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "mfa_required" });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("rate-limits policy draft creation", async () => {
    mocks.rateLimit.mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 30,
    });

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "rate_limited" });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("returns sanitized database errors for latest-version lookup failures", async () => {
    mocks.createServerSupabase.mockResolvedValue(
      supabaseForPolicy({
        latestError: { code: "42501", message: "RLS rejected policy_documents" },
      })
    );

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "database_error",
    });
  });

  it("returns sanitized database errors for insert failures", async () => {
    mocks.createServerSupabase.mockResolvedValue(
      supabaseForPolicy({
        insertError: { code: "42501", message: "RLS rejected policy_documents" },
      })
    );

    const response = (await POST(request(validBody()))) as Response;

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "database_error",
    });
  });
});
