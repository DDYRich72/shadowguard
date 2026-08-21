import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY,
  buildAgentGuardSlackAutomaticReadiness,
  type AgentGuardSlackAutomaticAttemptInput,
  type AgentGuardSlackAutomaticTargetInput,
} from "../slack-automatic-readiness";

function target(
  overrides: Partial<AgentGuardSlackAutomaticTargetInput> = {}
): AgentGuardSlackAutomaticTargetInput {
  return {
    id: "target-1",
    name: "Security Slack",
    targetType: "incoming_webhook",
    status: "enabled",
    webhookUrlHint: "hooks.slack.com/services/...cret",
    eventTypes: ["agentguard.policy.blocked", "agentguard.review.required"],
    dryRunEnabled: true,
    liveSendEnabled: false,
    ownerName: "Security",
    ownerEmail: "security@example.com",
    customerApprovalStatus: "approved",
    lastSuccessfulTestAt: "2026-05-20T18:22:58.000Z",
    lastLiveAttemptAt: null,
    ...overrides,
  };
}

function attempts(): AgentGuardSlackAutomaticAttemptInput[] {
  return [
    {
      targetId: "target-1",
      eventType: "agentguard.policy.blocked",
      status: "dry_run",
      deliveryMode: "dry_run",
      httpStatus: null,
      durationMs: 0,
      createdAt: "2026-05-20T18:30:00.000Z",
    },
    {
      targetId: "target-1",
      eventType: "manual_test",
      status: "succeeded",
      deliveryMode: "manual_test",
      httpStatus: 200,
      durationMs: 80,
      createdAt: "2026-05-20T18:22:58.000Z",
    },
  ];
}

describe("AgentGuard Slack automatic preview readiness", () => {
  it("keeps verified targets in auto-off posture by default", () => {
    const readiness = buildAgentGuardSlackAutomaticReadiness({
      target: target(),
      attempts: attempts(),
    });

    expect(readiness.status).toBe("manual_verified_auto_off");
    expect(readiness.statusLabel).toBe("Auto off");
    expect(readiness.automaticAttemptCount).toBe(1);
    expect(readiness.gates.every((gate) => gate.ready)).toBe(true);
    expect(readiness.copyText).toContain("Automatic posture: off");
  });

  it("distinguishes automatic dry-run rehearsal from outbound delivery", () => {
    const readiness = buildAgentGuardSlackAutomaticReadiness({
      target: target({ liveSendEnabled: true, dryRunEnabled: true }),
      attempts: attempts(),
    });

    expect(readiness.status).toBe("automatic_dry_run_ready");
    expect(readiness.summary).toContain("dry-runs without outbound requests");
    expect(readiness.copyText).toContain(
      "matching automatic events are logged without outbound Slack requests"
    );
  });

  it("marks outbound automatic preview as a caution posture", () => {
    const readiness = buildAgentGuardSlackAutomaticReadiness({
      target: target({
        liveSendEnabled: true,
        dryRunEnabled: false,
        lastLiveAttemptAt: "2026-05-20T18:40:00.000Z",
      }),
      attempts: [
        {
          targetId: "target-1",
          eventType: "agentguard.review.required",
          status: "succeeded",
          deliveryMode: "automatic",
          httpStatus: 200,
          durationMs: 120,
          createdAt: "2026-05-20T18:40:00.000Z",
        },
      ],
    });

    expect(readiness.status).toBe("automatic_outbound_ready");
    expect(readiness.statusLabel).toBe("Outbound caution");
    expect(readiness.latestAutomaticAttempt?.httpStatus).toBe(200);
    expect(readiness.nextAction).toContain("disable path");
  });

  it("shows missing gates without exposing Slack secrets", () => {
    const readiness = buildAgentGuardSlackAutomaticReadiness({
      target: target({
        status: "disabled",
        webhookUrlHint: "hooks.slack.com/triggers/...cret",
        eventTypes: [],
        customerApprovalStatus: "requested",
        lastSuccessfulTestAt: null,
      }),
      attempts: [],
    });
    const text = `${readiness.copyText}\n${AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY.boundary}`;

    expect(readiness.status).toBe("needs_setup");
    expect(readiness.gates.filter((gate) => !gate.ready)).toHaveLength(4);
    expect(text).toContain("URL hint: hooks.slack.com/triggers/...cret");
    expect(text).not.toContain("https://hooks.slack.com/");
    expect(text).not.toContain("Bearer ");
    expect(text).toContain("does not send Slack messages");
    expect(text).toContain("install a Slack app");
    expect(text).toContain("use Slack OAuth");
  });
});
