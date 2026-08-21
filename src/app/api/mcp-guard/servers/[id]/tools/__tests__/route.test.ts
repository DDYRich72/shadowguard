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

import { POST } from "../route";

const serverId = "11111111-1111-4111-8111-111111111111";

function request(body: Record<string, unknown>) {
  return new NextRequest(`https://shadowguard.test/api/mcp-guard/servers/${serverId}/tools`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    name: "filesystem.read_file.smoke",
    capabilityCategories: ["read", "file_access", "data_export"],
    dataSensitivity: "restricted",
    externalAccess: false,
    writeAccess: false,
    credentialAccess: false,
    approvalStatus: "pending_review",
  };
}

function supabaseForCreateTool(options?: {
  insertError?: Record<string, unknown> | null;
}) {
  const serverChain = {
    select: vi.fn(() => serverChain),
    eq: vi.fn(() => serverChain),
    maybeSingle: vi.fn(async () => ({
      data: { id: serverId, name: "Smoke MCP Server" },
      error: null,
    })),
  };
  const toolChain = {
    insert: vi.fn(() => toolChain),
    select: vi.fn(() => toolChain),
    single: vi.fn(async () => ({
      data: null,
      error: options?.insertError ?? null,
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "mcp_servers") return serverChain;
      if (table === "mcp_tools") return toolChain;
      throw new Error(`Unexpected table: ${table}`);
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
    limit: 60,
    remaining: 59,
    retryAfterSeconds: 0,
  });
  mocks.recordAudit.mockResolvedValue(undefined);
});

describe("MCP server tool route", () => {
  it("returns a friendly conflict when the tool already exists under the server", async () => {
    mocks.createServerSupabase.mockResolvedValue(
      supabaseForCreateTool({
        insertError: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      })
    );

    const response = (await POST(request(validBody()), {
      params: Promise.resolve({ id: serverId }),
    })) as Response;
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toMatchObject({
      error: "mcp_tool_already_exists",
    });
    expect(data.message).toContain("already exists");
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
