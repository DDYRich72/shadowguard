import { describe, expect, it, vi } from "vitest";
import {
  AGENT_GUARD_EXPORT_SECRET_PREFIX,
  decryptAgentExportSigningSecret,
  destinationAllowsAutomaticExport,
  encryptAgentExportSigningSecret,
  generateAgentExportSigningSecret,
  hashAgentExportSigningSecret,
  normalizeAgentExportEventTypes,
  signingSecretHint,
  validateAgentExportDestinationUrl,
} from "../export-destinations";
import {
  buildAgentGuardExportHeaders,
  sendAgentGuardAutomaticExport,
  sendAgentGuardExportTest,
  sendAgentGuardExportReplay,
} from "../export-delivery";
import { agentGuardSampleExportEvent } from "../export-foundation";

describe("AgentGuard export destinations", () => {
  it("validates external HTTPS destination URLs conservatively", () => {
    expect(validateAgentExportDestinationUrl("https://example.com/hook")).toEqual({
      ok: true,
      url: "https://example.com/hook",
    });

    expect(validateAgentExportDestinationUrl("http://example.com/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("https://localhost/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("https://127.0.0.1/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("https://10.0.0.2/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("https://192.168.1.2/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("https://service.internal/hook").ok).toBe(false);
    expect(validateAgentExportDestinationUrl("not a url").ok).toBe(false);
  });

  it("generates and hints export signing secrets without storing plaintext", () => {
    const secret = generateAgentExportSigningSecret();
    const hash = hashAgentExportSigningSecret(secret);

    expect(secret.startsWith(AGENT_GUARD_EXPORT_SECRET_PREFIX)).toBe(true);
    expect(secret.length).toBeGreaterThan(40);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(secret);
    expect(signingSecretHint(secret)).toContain("...");
  });

  it("encrypts and decrypts signing secrets with a server key", () => {
    const secret = generateAgentExportSigningSecret();
    const encrypted = encryptAgentExportSigningSecret(secret, "test-export-secret-key");

    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(secret);
    expect(decryptAgentExportSigningSecret(encrypted, "test-export-secret-key")).toBe(secret);
  });

  it("builds signing headers for export delivery", () => {
    const payload = agentGuardSampleExportEvent();
    const headers = buildAgentGuardExportHeaders(payload, "test-secret", 1_768_000_000);

    expect(headers["x-shadowguard-event-id"]).toBe(payload.eventId);
    expect(headers["x-shadowguard-timestamp"]).toBe("1768000000");
    expect(headers["x-shadowguard-signature"]).toHaveLength(64);
    expect(headers["content-type"]).toBe("application/json");
  });

  it("normalizes event type selections with safe defaults", () => {
    expect(normalizeAgentExportEventTypes(null)).toEqual([
      "agentguard.activity.evaluated",
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ]);
    expect(
      normalizeAgentExportEventTypes([
        "agentguard.policy.blocked",
        "agentguard.policy.blocked",
        "agentguard.review.required",
        "not-real",
      ])
    ).toEqual(["agentguard.policy.blocked", "agentguard.review.required"]);
  });

  it("requires all automatic export gates before live eligibility", () => {
    const eligible = {
      status: "enabled" as const,
      automatic_delivery_enabled: true,
      event_types: ["agentguard.activity.evaluated"],
    };

    expect(
      destinationAllowsAutomaticExport(eligible, "agentguard.activity.evaluated")
    ).toBe(true);
    expect(
      destinationAllowsAutomaticExport(
        { ...eligible, status: "disabled" },
        "agentguard.activity.evaluated"
      )
    ).toBe(false);
    expect(
      destinationAllowsAutomaticExport(
        { ...eligible, automatic_delivery_enabled: false },
        "agentguard.activity.evaluated"
      )
    ).toBe(false);
    expect(
      destinationAllowsAutomaticExport(eligible, "agentguard.policy.blocked")
    ).toBe(false);
  });

  it("sends a manual metadata-only test payload with signed headers", async () => {
    let deliveredBody = "";
    let deliveredHeaders: Record<string, string> = {};
    const fetchImpl = vi.fn(async (_input: string, init: RequestInit) => {
      deliveredBody = String(init.body);
      deliveredHeaders = init.headers as Record<string, string>;
      return new Response(null, { status: 204 });
    });

    const result = await sendAgentGuardExportTest(
      {
        url: "https://example.com/hook",
        signingSecret: "test-secret",
      },
      "org-1",
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.status).toBe("succeeded");
    expect(result.deliveryMode).toBe("manual_test");
    expect(result.httpStatus).toBe(204);
    expect(result.errorMessage).toBeNull();
    expect(result.payload.orgId).toBe("org-1");
    expect(deliveredBody).toContain("agentguard.activity.evaluated");
    expect(deliveredBody).not.toContain("raw prompt");
    expect(deliveredHeaders["x-shadowguard-signature"]).toHaveLength(64);
  });

  it("reports failed manual test delivery attempts", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));

    const result = await sendAgentGuardExportTest(
      {
        url: "https://example.com/hook",
        signingSecret: "test-secret",
      },
      "org-1",
      { fetchImpl }
    );

    expect(result.status).toBe("failed");
    expect(result.deliveryMode).toBe("manual_test");
    expect(result.httpStatus).toBe(500);
    expect(result.errorMessage).toContain("HTTP 500");
  });

  it("logs dry-run automatic export attempts without calling fetch", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    const result = await sendAgentGuardAutomaticExport(
      {
        url: "https://example.com/hook",
        signingSecret: "test-secret",
        dryRunEnabled: true,
      },
      agentGuardSampleExportEvent(),
      { fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("dry_run");
    expect(result.deliveryMode).toBe("dry_run");
    expect(result.httpStatus).toBeNull();
  });

  it("sends live automatic exports when dry-run is off", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    const result = await sendAgentGuardAutomaticExport(
      {
        url: "https://example.com/hook",
        signingSecret: "test-secret",
        dryRunEnabled: false,
      },
      agentGuardSampleExportEvent(),
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.status).toBe("succeeded");
    expect(result.deliveryMode).toBe("automatic");
  });

  it("sends explicit manual replays with the stored metadata-only payload", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const payload = agentGuardSampleExportEvent();

    const result = await sendAgentGuardExportReplay(
      {
        url: "https://example.com/hook",
        signingSecret: "test-secret",
      },
      payload,
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.eventId).toBe(payload.eventId);
    expect(result.status).toBe("succeeded");
    expect(result.deliveryMode).toBe("manual_replay");
    expect(result.payload.activity.contentLength).toBeGreaterThan(0);
    expect(JSON.stringify(result.payload)).not.toContain("raw prompt");
  });
});
