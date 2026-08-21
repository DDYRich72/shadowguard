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
  mfaRequiredError: { error: "mfa_required" },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  rateLimited: () => Response.json({ error: "rate_limited" }, { status: 429 }),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: mocks.recordAudit,
}));

vi.mock("@/lib/security", () => ({
  evaluateApiMutationOrigin: mocks.evaluateApiMutationOrigin,
}));

import { POST } from "../route";

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "https://shadowguard.test/api/agent-guard/slack-workflow-targets",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function supabaseForCreate({
  inserted,
  result,
}: {
  inserted: Record<string, unknown>[];
  result: Record<string, unknown>;
}) {
  const chain = {
    insert: vi.fn((values: Record<string, unknown>) => {
      inserted.push(values);
      return chain;
    }),
    select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: result, error: null })),
  };
  return {
    from: vi.fn((table: string) => {
      if (table !== "agent_slack_workflow_targets") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return chain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AGENT_GUARD_EXPORT_SECRET_KEY = "test-slack-target-route-key";
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
    remaining: 7,
    reset: Date.now() + 60_000,
  });
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.evaluateApiMutationOrigin.mockReturnValue({ allowed: true });
});

describe("AgentGuard Slack workflow target create route", () => {
  it("stores encrypted Slack URLs and returns only URL hints", async () => {
    const inserted: Record<string, unknown>[] = [];
    const result = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Security Slack preview",
      target_type: "incoming_webhook",
      status: "disabled",
      webhook_url_hint: "hooks.slack.com/services/...cret",
      event_types: ["agentguard.policy.blocked"],
      dry_run_enabled: true,
      live_send_enabled: false,
      owner_name: "Security",
      owner_email: "security@example.com",
      customer_approval_status: "requested",
      customer_approval_note: "",
      customer_approved_at: null,
      customer_approved_by_email: null,
      user_identifier_mode: "redacted",
      created_by_email: "admin@example.com",
      updated_by_email: "admin@example.com",
      last_tested_at: null,
      last_successful_test_at: null,
      last_live_attempt_at: null,
      created_at: "2026-05-20T12:00:00.000Z",
      updated_at: "2026-05-20T12:00:00.000Z",
    };
    mocks.createServerSupabase.mockResolvedValue(
      supabaseForCreate({ inserted, result })
    );

    const response = (await POST(
      request({
        name: "Security Slack preview",
        targetType: "incoming_webhook",
        webhookUrl: "https://hooks.slack.com/services/T000/B000/secret",
        eventTypes: ["agentguard.policy.blocked"],
        ownerName: "Security",
        ownerEmail: "security@example.com",
        customerApprovalStatus: "requested",
      })
    )) as Response;

    expect(response.status).toBe(200);
    const data = await response.json();
    const responseText = JSON.stringify(data);

    expect(data.target).toMatchObject({
      name: "Security Slack preview",
      targetType: "incoming_webhook",
      status: "disabled",
      webhookUrlHint: "hooks.slack.com/services/...cret",
      dryRunEnabled: true,
      liveSendEnabled: false,
    });
    expect(responseText).not.toContain("https://hooks.slack.com/services/T000");
    expect(responseText).not.toContain("webhook_url_encrypted");
    expect(inserted[0]?.webhook_url_encrypted).toEqual(expect.stringMatching(/^v1:/));
    expect(String(inserted[0]?.webhook_url_encrypted)).not.toContain("secret");
    expect(inserted[0]).toMatchObject({
      target_type: "incoming_webhook",
      status: "disabled",
      dry_run_enabled: true,
      live_send_enabled: false,
      webhook_url_hint: "hooks.slack.com/services/...cret",
    });
  });

  it("rejects target type and URL path mismatches before storing secrets", async () => {
    const response = (await POST(
      request({
        name: "Mismatched Slack preview",
        targetType: "workflow_webhook",
        webhookUrl: "https://hooks.slack.com/services/T000/B000/secret",
      })
    )) as Response;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "slack_target_type_mismatch",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });
});
