import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_RECEIVER_VALIDATION_CHECKLIST,
  buildAgentGuardReceiverValidationReport,
  type AgentGuardReceiverAttempt,
  type AgentGuardReceiverDestination,
} from "../receiver-validation";

const NOW = new Date("2026-05-19T15:00:00.000Z");

function destination(
  patch: Partial<AgentGuardReceiverDestination> = {}
): AgentGuardReceiverDestination {
  return {
    id: "destination-1",
    name: "Customer webhook",
    destinationType: "webhook",
    status: "enabled",
    endpointUrl: "https://receiver.example.com/agentguard",
    signingSecretHint: "sgae_demo...1234",
    automaticDeliveryEnabled: false,
    dryRunEnabled: true,
    eventTypes: ["agentguard.activity.evaluated"],
    ownerName: "",
    ownerEmail: "",
    escalationPath: "",
    receiverAcknowledgementStatus: "not_requested",
    receiverAcknowledgementNote: "",
    receiverAcknowledgedAt: null,
    receiverAcknowledgedByEmail: null,
    healthStatus: "ready",
    healthLabel: "Ready",
    healthSummary: "Destination has a successful test.",
    lastTestedAt: "2026-05-19T14:00:00.000Z",
    lastAutomaticAttemptAt: null,
    ...patch,
  };
}

function attempt(
  patch: Partial<AgentGuardReceiverAttempt> = {}
): AgentGuardReceiverAttempt {
  return {
    id: "attempt-1",
    destinationId: "destination-1",
    eventId: "agevt_test_123",
    eventType: "agentguard.activity.evaluated",
    status: "succeeded",
    deliveryMode: "manual_test",
    httpStatus: 204,
    durationMs: 120,
    errorMessage: null,
    createdAt: "2026-05-19T14:00:00.000Z",
    ...patch,
  };
}

describe("AgentGuard receiver validation", () => {
  it("reports not configured when no export receivers exist", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [],
      attempts: [],
      generatedAt: NOW,
    });

    expect(report.status).toBe("not_configured");
    expect(report.metrics.totalDestinations).toBe(0);
    expect(report.handoffText).toContain("No HTTPS export receiver is configured yet.");
  });

  it("marks untested receivers as needing a manual signed test", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [destination({ lastTestedAt: null })],
      attempts: [],
      generatedAt: NOW,
    });

    expect(report.status).toBe("needs_manual_test");
    expect(report.destinations[0]?.label).toBe("Needs manual test");
    expect(report.destinations[0]?.nextAction).toContain("send a manual signed test");
  });

  it("marks failed latest attempts as failing", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [destination()],
      attempts: [
        attempt({
          status: "failed",
          httpStatus: 500,
          errorMessage: "Destination returned HTTP 500.",
        }),
      ],
      generatedAt: NOW,
    });

    expect(report.status).toBe("failing");
    expect(report.destinations[0]?.latestAttemptSummary).toContain("HTTP 500");
    expect(report.destinations[0]?.latestAttemptSummary).toContain(
      "Receiver HTTP error"
    );
    expect(report.metrics.needsAttention).toBe(1);
  });

  it("marks successfully tested guarded receivers as dry-run ready", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [destination()],
      attempts: [attempt()],
      generatedAt: NOW,
    });

    expect(report.status).toBe("dry_run_ready");
    expect(report.destinations[0]?.summary).toContain("live automatic sends are not active");
    expect(report.metrics.successfulReceivers).toBe(1);
  });

  it("marks live enabled receivers as live-ready only after successful evidence", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [
        destination({
          automaticDeliveryEnabled: true,
          dryRunEnabled: false,
        }),
      ],
      attempts: [attempt({ deliveryMode: "automatic" })],
      generatedAt: NOW,
    });

    expect(report.status).toBe("live_ready");
    expect(report.metrics.liveDestinations).toBe(1);
    expect(report.destinations[0]?.guardrail).toContain("customer engineers still own");
  });

  it("includes owner, escalation, and receiver acknowledgement evidence", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [
        destination({
          ownerName: "Security operations",
          ownerEmail: "security@example.com",
          escalationPath: "Use customer-owned incident channel.",
          receiverAcknowledgementStatus: "confirmed",
          receiverAcknowledgementNote: "Receiver owner confirmed HMAC checks.",
          receiverAcknowledgedAt: "2026-05-19T14:30:00.000Z",
          receiverAcknowledgedByEmail: "admin@example.com",
        }),
      ],
      attempts: [attempt()],
      generatedAt: NOW,
    });

    expect(report.metrics.acknowledgedReceivers).toBe(1);
    expect(report.destinations[0]?.ownerSummary).toContain("Security operations");
    expect(report.destinations[0]?.ownerSummary).toContain(
      "Use customer-owned incident channel"
    );
    expect(report.destinations[0]?.acknowledgementSummary).toContain(
      "Receiver acknowledgement: Confirmed"
    );
    expect(report.handoffText).toContain("Receiver acknowledgements confirmed: 1");
    expect(report.handoffText).toContain("Owner/escalation");
    expect(report.handoffText).toContain("Acknowledgement");
  });

  it("flags empty event scopes for review", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [destination({ eventTypes: [] })],
      attempts: [attempt()],
      generatedAt: NOW,
    });

    expect(report.status).toBe("review_scope");
    expect(report.destinations[0]?.eventScope).toBe("No event types selected");
  });

  it("keeps the validation checklist focused on receiver readiness", () => {
    const labels = AGENT_GUARD_RECEIVER_VALIDATION_CHECKLIST.map(
      (item) => item.label
    );

    expect(labels).toContain("Configure HTTPS receiver URL");
    expect(labels).toContain("Store one-time signing secret");
    expect(labels).toContain("Verify signing headers");
    expect(labels).toContain("Send manual signed test");
    expect(labels).toContain("Select event types deliberately");
    expect(labels).toContain("Document owner and escalation");
  });

  it("omits plaintext secrets and raw content from handoff text", () => {
    const report = buildAgentGuardReceiverValidationReport({
      destinations: [destination()],
      attempts: [attempt()],
      generatedAt: NOW,
    });

    expect(report.handoffText).toContain("Secret hint only");
    expect(report.handoffText).toContain("sgae_demo...1234");
    expect(report.handoffText).not.toContain("plaintext signing secret:");
    expect(report.handoffText).toContain("raw prompts, responses");
    expect(report.handoffText).not.toContain("raw prompt text");
    expect(report.handoffText).toContain("not proof of receiver-side signature verification");
  });
});
