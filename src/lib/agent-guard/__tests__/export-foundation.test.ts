import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_EXPORT_GUARDRAILS,
  AGENT_GUARD_EXPORT_PAYLOAD_FIELDS,
  AGENT_GUARD_EXPORT_SIGNING_HEADERS,
  agentGuardSampleExportEvent,
  buildAgentGuardExportEvent,
  canonicalizeAgentGuardExportPayload,
  isAgentGuardExportEvent,
  prettyAgentGuardExportPayload,
} from "../export-foundation";
import { signAgentGuardExportPayload } from "../export-signing";

describe("AgentGuard export foundation", () => {
  it("builds metadata-only activity export events", () => {
    const event = buildAgentGuardExportEvent({
      id: "activity-1",
      orgId: "org-1",
      toolName: "ChatGPT",
      userEmail: "analyst@example.com",
      activityType: "prompt_sent",
      riskLevel: "high",
      blocked: true,
      reason: "Blocked by policy",
      policyId: "policy-1",
      dataClassification: {
        sensitivity: "restricted",
        categories: ["credentials"],
        piiDetected: false,
        credentialsDetected: true,
        proprietaryDetected: false,
      },
      source: {
        id: "source-1",
        name: "Production wrapper",
        environment: "production",
      },
      contentLength: 72,
      occurredAt: "2026-05-16T12:00:00.000Z",
    });

    expect(event.eventId).toBe("agevt_activity-1");
    expect(event.eventType).toBe("agentguard.policy.blocked");
    expect(event.activity.policyId).toBe("policy-1");
    expect(event.activity.source?.id).toBe("source-1");
    expect(event.activity.contentLength).toBe(72);
  });

  it("builds generic review-required alert routing events", () => {
    const event = buildAgentGuardExportEvent({
      id: "activity-2",
      orgId: "org-1",
      toolName: "Claude",
      userEmail: "reviewer@example.com",
      activityType: "file_upload",
      riskLevel: "medium",
      blocked: false,
      dataClassification: {
        sensitivity: "confidential",
        categories: ["customer_context"],
        piiDetected: true,
        credentialsDetected: false,
        proprietaryDetected: false,
      },
      contentLength: 140,
      eventType: "agentguard.review.required",
      alert: {
        category: "review_required",
        severity: "warning",
        title: "AgentGuard review required",
        summary: "1 warn/quarantine policy outcome created for Claude.",
        policyActions: ["warn"],
      },
    });

    expect(event.eventId).toBe("agevt_activity-2_required");
    expect(event.eventType).toBe("agentguard.review.required");
    expect(event.alert?.category).toBe("review_required");
    expect(event.activity.contentLength).toBe(140);
    expect(isAgentGuardExportEvent(event)).toBe(true);
  });

  it("does not include raw prompt, response, file, or message content in sample payloads", () => {
    const serialized = prettyAgentGuardExportPayload(agentGuardSampleExportEvent());

    expect(serialized).toContain("contentLength");
    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("raw prompt");
    expect(serialized).not.toContain("response text");
    expect(serialized).not.toContain("file content");
    expect(serialized).not.toContain("message content");
  });

  it("canonicalizes payloads deterministically", () => {
    const event = agentGuardSampleExportEvent();
    const canonical = canonicalizeAgentGuardExportPayload(event);

    expect(canonical).toBe(canonicalizeAgentGuardExportPayload(event));
    expect(canonical.indexOf('"activity"')).toBeLessThan(canonical.indexOf('"eventId"'));
    expect(canonical).not.toContain("\n");
  });

  it("signs payloads with deterministic HMAC-SHA256", () => {
    const event = agentGuardSampleExportEvent();
    const first = signAgentGuardExportPayload(event, "demo-secret");
    const second = signAgentGuardExportPayload(event, "demo-secret");
    const differentSecret = signAgentGuardExportPayload(event, "other-secret");

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
    expect(first).not.toBe(differentSecret);
  });

  it("documents payload fields and signing headers", () => {
    expect(AGENT_GUARD_EXPORT_PAYLOAD_FIELDS.map((field) => field.path)).toContain(
      "activity.contentLength"
    );
    expect(AGENT_GUARD_EXPORT_PAYLOAD_FIELDS.map((field) => field.path)).toContain(
      "activity.source"
    );
    expect(AGENT_GUARD_EXPORT_PAYLOAD_FIELDS.map((field) => field.path)).toContain(
      "alert"
    );
    expect(AGENT_GUARD_EXPORT_SIGNING_HEADERS.map((header) => header.name)).toEqual([
      "x-shadowguard-event-id",
      "x-shadowguard-timestamp",
      "x-shadowguard-signature",
    ]);
  });

  it("recognizes replayable AgentGuard export payloads", () => {
    const event = agentGuardSampleExportEvent();

    expect(isAgentGuardExportEvent(event)).toBe(true);
    expect(isAgentGuardExportEvent({ ...event, eventType: "not-real" })).toBe(false);
    expect(
      isAgentGuardExportEvent({
        ...event,
        eventType: "agentguard.review.required",
      })
    ).toBe(true);
    expect(isAgentGuardExportEvent({ ...event, activity: { ...event.activity, contentLength: "184" } })).toBe(false);
  });

  it("keeps guardrails clear that automatic export is gated", () => {
    const text = AGENT_GUARD_EXPORT_GUARDRAILS.join(" ");

    expect(text).toContain("Automatic delivery only runs");
    expect(text).toContain("Generic alert routing reuses export destinations");
    expect(text).toContain("Dry-run mode logs");
    expect(text).toContain("not raw prompts");
    expect(text).toContain("replayed manually");
    expect(text).toContain("Background retries are not shipped");
    expect(text).toContain("Customer middleware owns Slack");
    expect(text).not.toContain("SIEM export is active");
  });
});
