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

import { POST } from "../route";

const TARGET_ID = "11111111-1111-4111-8111-111111111111";

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "https://shadowguard.test/api/agent-guard/slack-evidence-packets",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function targetRow() {
  return {
    id: TARGET_ID,
    name: "Security Slack preview",
    target_type: "incoming_webhook",
    status: "enabled",
    webhook_url_hint: "hooks.slack.com/services/...cret",
    event_types: ["agentguard.policy.blocked"],
    dry_run_enabled: false,
    live_send_enabled: false,
    owner_name: "Security",
    owner_email: "security@example.com",
    customer_approval_status: "requested",
    customer_approval_note: "Manual smoke only.",
    customer_approved_at: null,
    customer_approved_by_email: null,
    user_identifier_mode: "redacted",
    last_tested_at: "2026-05-20T18:22:58.822Z",
    last_successful_test_at: "2026-05-20T18:22:58.822Z",
    last_live_attempt_at: null,
    created_at: "2026-05-20T18:00:00.000Z",
    updated_at: "2026-05-20T18:23:00.000Z",
  };
}

function attemptRows() {
  return [
    {
      id: "attempt-1",
      event_id: "agslack_test_0635887f613778bf566a4a30",
      event_type: "manual_test",
      status: "succeeded",
      delivery_mode: "manual_test",
      http_status: 200,
      duration_ms: 80,
      error_message: null,
      created_by_email: "admin@example.com",
      created_at: "2026-05-20T18:22:58.822Z",
    },
  ];
}

function supabaseForSave(inserted: Record<string, unknown>[]) {
  const targetChain = {
    select: vi.fn(() => targetChain),
    eq: vi.fn(() => targetChain),
    maybeSingle: vi.fn(async () => ({ data: targetRow(), error: null })),
  };
  const attemptsChain = {
    select: vi.fn(() => attemptsChain),
    eq: vi.fn(() => attemptsChain),
    order: vi.fn(() => attemptsChain),
    limit: vi.fn(async () => ({ data: attemptRows(), error: null })),
  };
  const insertChain = {
    insert: vi.fn((values: Record<string, unknown>) => {
      inserted.push(values);
      return insertChain;
    }),
    select: vi.fn(() => insertChain),
    single: vi.fn(async () => {
      const draft = inserted[0] ?? {};
      return {
        data: {
          id: "packet-1",
          packet_type: draft.packet_type,
          title: draft.title,
          status: draft.status,
          status_label: draft.status_label,
          summary: draft.summary,
          readiness_report: draft.readiness_report,
          command_center: draft.command_center,
          summary_metrics: draft.summary_metrics,
          evidence_counts: draft.evidence_counts,
          load_warnings: draft.load_warnings,
          packet_text: draft.packet_text,
          generated_by_user_id: draft.generated_by_user_id,
          generated_by_email: draft.generated_by_email,
          generated_at: draft.generated_at,
          created_at: "2026-05-20T18:31:00.000Z",
        },
        error: null,
      };
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "agent_slack_workflow_targets") return targetChain;
      if (table === "agent_slack_workflow_delivery_attempts") return attemptsChain;
      if (table === "agent_evidence_packets") return insertChain;
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
    remaining: 9,
    reset: Date.now() + 60_000,
  });
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.evaluateApiMutationOrigin.mockReturnValue({ allowed: true });
});

describe("AgentGuard Slack evidence packet route", () => {
  it("saves Slack preview evidence without secret material", async () => {
    const inserted: Record<string, unknown>[] = [];
    mocks.createServerSupabase.mockResolvedValue(supabaseForSave(inserted));

    const response = (await POST(request({ targetId: TARGET_ID }))) as Response;
    const data = await response.json();
    const responseText = JSON.stringify(data);
    const insertedText = JSON.stringify(inserted[0]);

    expect(response.status).toBe(201);
    expect(data.packet).toMatchObject({
      packetType: "slack_preview",
      status: "ready_for_pilot",
      statusLabel: "Manual delivery verified",
    });
    expect(inserted[0]).toMatchObject({
      packet_type: "slack_preview",
      status: "ready_for_pilot",
      generated_by_email: "admin@example.com",
    });
    expect(insertedText).toContain("hooks.slack.com/services/...cret");
    expect(responseText).not.toContain("https://hooks.slack.com/services/");
    expect(responseText).not.toContain("webhook_url_encrypted");
    expect(responseText).not.toContain("webhook_url_hash");
    expect(insertedText).not.toContain("https://hooks.slack.com/services/");
    expect(mocks.recordAudit).toHaveBeenCalledOnce();
  });

  it("rejects cross-site mutation attempts before reading target data", async () => {
    mocks.evaluateApiMutationOrigin.mockReturnValue({
      allowed: false,
      reason: "origin_mismatch",
    });

    const response = (await POST(request({ targetId: TARGET_ID }))) as Response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_origin",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });
});
