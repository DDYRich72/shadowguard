import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { agentGuardSampleExportEvent } from "@/lib/agent-guard/export-foundation";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getSessionContext: vi.fn(),
  hasRole: vi.fn(),
  getMfaSnapshot: vi.fn(),
  adminNeedsAal2: vi.fn(),
  rateLimit: vi.fn(),
  recordAudit: vi.fn(),
  decryptAgentExportSigningSecret: vi.fn(),
  sendAgentGuardExportReplay: vi.fn(),
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

vi.mock("@/lib/agent-guard/export-destinations", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/agent-guard/export-destinations")>();
  return {
    ...original,
    decryptAgentExportSigningSecret: mocks.decryptAgentExportSigningSecret,
  };
});

vi.mock("@/lib/agent-guard/export-delivery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/agent-guard/export-delivery")>();
  return {
    ...original,
    sendAgentGuardExportReplay: mocks.sendAgentGuardExportReplay,
  };
});

import { POST } from "../[id]/attempts/[attemptId]/replay/route";

const destinationId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const replayId = "33333333-3333-4333-8333-333333333333";

function request() {
  return new NextRequest(
    `https://shadowguard.test/api/agent-guard/export-destinations/${destinationId}/attempts/${attemptId}/replay`,
    { method: "POST" }
  );
}

function chain<T>(result: T) {
  const item = {
    eq: vi.fn(() => item),
    select: vi.fn(() => item),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return item;
}

function supabaseFor({
  destination,
  sourceAttempt,
  replayAttempt,
  inserts,
}: {
  destination: unknown;
  sourceAttempt: unknown;
  replayAttempt?: unknown;
  inserts?: Record<string, unknown>[];
}) {
  let attemptSelectCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "agent_export_destinations") {
        return {
          select: vi.fn(() => chain({ data: destination, error: null })),
        };
      }
      if (table === "agent_export_delivery_attempts") {
        return {
          select: vi.fn(() => {
            attemptSelectCount += 1;
            return chain({
              data: attemptSelectCount === 1 ? sourceAttempt : replayAttempt,
              error: null,
            });
          }),
          insert: vi.fn((values: Record<string, unknown>) => {
            inserts?.push(values);
            return chain({ data: replayAttempt, error: null });
          }),
        };
      }
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
  mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 9, reset: Date.now() + 60_000 });
  mocks.decryptAgentExportSigningSecret.mockReturnValue("receiver-secret");
  mocks.recordAudit.mockResolvedValue(undefined);
});

describe("AgentGuard export replay route", () => {
  it("rejects disabled destinations before replaying failed attempts", async () => {
    mocks.createServerSupabase.mockResolvedValue(
      supabaseFor({
        destination: {
          id: destinationId,
          org_id: "org-1",
          name: "Disabled receiver",
          destination_type: "webhook",
          status: "disabled",
          endpoint_url: "https://example.com/hook",
          signing_secret_encrypted: "encrypted",
          signing_secret_hint: "sgae_...test",
          dry_run_enabled: false,
        },
        sourceAttempt: null,
      })
    );

    const response = (await POST(request(), {
      params: Promise.resolve({ id: destinationId, attemptId }),
    })) as Response;

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "destination_disabled",
    });
    expect(mocks.sendAgentGuardExportReplay).not.toHaveBeenCalled();
  });

  it("rejects dry-run destinations before replaying failed attempts", async () => {
    mocks.createServerSupabase.mockResolvedValue(
      supabaseFor({
        destination: {
          id: destinationId,
          org_id: "org-1",
          name: "Dry-run receiver",
          destination_type: "webhook",
          status: "enabled",
          endpoint_url: "https://example.com/hook",
          signing_secret_encrypted: "encrypted",
          signing_secret_hint: "sgae_...test",
          dry_run_enabled: true,
        },
        sourceAttempt: null,
      })
    );

    const response = (await POST(request(), {
      params: Promise.resolve({ id: destinationId, attemptId }),
    })) as Response;

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "destination_dry_run",
    });
    expect(mocks.sendAgentGuardExportReplay).not.toHaveBeenCalled();
  });

  it("rejects non-failed attempts and invalid stored payloads", async () => {
    const destination = {
      id: destinationId,
      org_id: "org-1",
      name: "Live receiver",
      destination_type: "webhook",
      status: "enabled",
      endpoint_url: "https://example.com/hook",
      signing_secret_encrypted: "encrypted",
      signing_secret_hint: "sgae_...test",
      dry_run_enabled: false,
    };
    mocks.createServerSupabase.mockResolvedValueOnce(
      supabaseFor({
        destination,
        sourceAttempt: {
          id: attemptId,
          destination_id: destinationId,
          event_id: "agevt_ok",
          event_type: "agentguard.activity.evaluated",
          status: "succeeded",
          delivery_mode: "automatic",
          replayed_attempt_id: null,
          http_status: 200,
          duration_ms: 10,
          error_message: null,
          payload: agentGuardSampleExportEvent(),
          created_by_email: null,
          created_at: "2026-05-16T12:00:00.000Z",
        },
      })
    );

    const nonFailedResponse = (await POST(request(), {
      params: Promise.resolve({ id: destinationId, attemptId }),
    })) as Response;

    expect(nonFailedResponse.status).toBe(409);
    await expect(nonFailedResponse.json()).resolves.toMatchObject({
      error: "attempt_not_failed",
    });

    mocks.createServerSupabase.mockResolvedValueOnce(
      supabaseFor({
        destination,
        sourceAttempt: {
          id: attemptId,
          destination_id: destinationId,
          event_id: "agevt_bad",
          event_type: "agentguard.activity.evaluated",
          status: "failed",
          delivery_mode: "automatic",
          replayed_attempt_id: null,
          http_status: 500,
          duration_ms: 10,
          error_message: "failed",
          payload: { not: "replayable" },
          created_by_email: null,
          created_at: "2026-05-16T12:00:00.000Z",
        },
      })
    );

    const invalidPayloadResponse = (await POST(request(), {
      params: Promise.resolve({ id: destinationId, attemptId }),
    })) as Response;

    expect(invalidPayloadResponse.status).toBe(409);
    await expect(invalidPayloadResponse.json()).resolves.toMatchObject({
      error: "payload_unavailable",
    });
    expect(mocks.sendAgentGuardExportReplay).not.toHaveBeenCalled();
  });

  it("replays failed attempts and logs manual replay linkage", async () => {
    const payload = agentGuardSampleExportEvent();
    const inserts: Record<string, unknown>[] = [];
    const replayAttempt = {
      id: replayId,
      destination_id: destinationId,
      event_id: payload.eventId,
      event_type: payload.eventType,
      status: "succeeded",
      delivery_mode: "manual_replay",
      replayed_attempt_id: attemptId,
      http_status: 200,
      duration_ms: 120,
      error_message: null,
      created_by_email: "admin@example.com",
      created_at: "2026-05-16T12:00:00.000Z",
    };
    mocks.sendAgentGuardExportReplay.mockResolvedValue({
      eventId: payload.eventId,
      eventType: payload.eventType,
      status: "succeeded",
      deliveryMode: "manual_replay",
      httpStatus: 200,
      durationMs: 120,
      errorMessage: null,
      payload,
    });
    mocks.createServerSupabase.mockResolvedValue(
      supabaseFor({
        destination: {
          id: destinationId,
          org_id: "org-1",
          name: "Live receiver",
          destination_type: "webhook",
          status: "enabled",
          endpoint_url: "https://example.com/hook",
          signing_secret_encrypted: "encrypted",
          signing_secret_hint: "sgae_...test",
          dry_run_enabled: false,
        },
        sourceAttempt: {
          ...replayAttempt,
          id: attemptId,
          status: "failed",
          delivery_mode: "automatic",
          replayed_attempt_id: null,
          http_status: 500,
          payload,
        },
        replayAttempt,
        inserts,
      })
    );

    const response = (await POST(request(), {
      params: Promise.resolve({ id: destinationId, attemptId }),
    })) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      attempt: {
        id: replayId,
        deliveryMode: "manual_replay",
        replayedAttemptId: attemptId,
      },
    });
    expect(inserts[0]).toMatchObject({
      delivery_mode: "manual_replay",
      replayed_attempt_id: attemptId,
      payload,
    });
    expect(mocks.sendAgentGuardExportReplay).toHaveBeenCalledWith(
      { url: "https://example.com/hook", signingSecret: "receiver-secret" },
      payload,
      { timeoutMs: 8_000 }
    );
  });
});
