import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS,
  AGENT_GUARD_SLACK_PREVIEW_COPY,
  AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES,
  AGENT_GUARD_SLACK_PREVIEW_FIELDS,
  AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS,
  AGENT_GUARD_SLACK_PREVIEW_GATES,
  AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS,
  agentGuardSlackPreviewGateCounts,
  renderSlackWorkflowPreviewSpecMarkdown,
} from "../slack-workflow-preview";

const UNSAFE_HANDOFF_PATTERNS = [
  /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/i,
  /https:\/\/hooks\.slack\.com\/triggers\/T[A-Z0-9]+\/[A-Za-z0-9/]+/i,
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  /xox[baprs]-[A-Za-z0-9-]+/i,
  /sgae_[A-Za-z0-9_-]{8,}/,
  /promptText/i,
  /raw_prompt/i,
  /raw_response/i,
];

describe("AgentGuard Slack workflow preview spec", () => {
  it("keeps the capability bounded to the guarded preview", () => {
    expect(AGENT_GUARD_SLACK_PREVIEW_COPY.overview).toContain(
      "encrypted URL storage"
    );
    expect(AGENT_GUARD_SLACK_PREVIEW_COPY.overview).toContain(
      "guarded manual tests"
    );
    expect(AGENT_GUARD_SLACK_PREVIEW_COPY.boundary).toContain(
      "not a shipped Slack app"
    );
    expect(AGENT_GUARD_SLACK_PREVIEW_COPY.boundary).toContain(
      "not automatic escalation"
    );
  });

  it("records official Slack planning notes with source URLs", () => {
    expect(AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES).toHaveLength(3);
    expect(AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES.map((note) => note.url)).toEqual([
      "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks",
      "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks",
      "https://docs.slack.dev/workflows/workflow-builder/",
    ]);
    expect(AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES[1]?.note).toContain(
      "webhook URLs as secrets"
    );
  });

  it("defines required implementation gates before Slack delivery", () => {
    const ids = AGENT_GUARD_SLACK_PREVIEW_GATES.map((gate) => gate.id);

    expect(ids).toEqual([
      "credential_model",
      "storage_model",
      "role_mfa_gates",
      "event_scope",
      "message_fields",
      "manual_test",
      "live_send_gate",
      "failure_behavior",
      "rate_limits",
      "slack_app_oauth",
    ]);
    expect(
      AGENT_GUARD_SLACK_PREVIEW_GATES.find((gate) => gate.id === "storage_model")
        ?.decision
    ).toContain("Do not reuse the existing plaintext export destination endpoint_url");
  });

  it("counts gate posture deterministically", () => {
    expect(agentGuardSlackPreviewGateCounts()).toEqual({
      decided_for_preview: 8,
      requires_future_build: 1,
      out_of_scope: 1,
    });
  });

  it("limits first preview events to manual tests and alert-worthy events", () => {
    expect(AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS).toEqual([
      "manual test event",
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ]);
    expect(AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS).not.toContain(
      "agentguard.activity.evaluated"
    );
  });

  it("keeps Slack fields metadata-only and customer-approved", () => {
    const fields = AGENT_GUARD_SLACK_PREVIEW_FIELDS.map(
      (field) => field.sourceField
    );

    expect(fields).toContain("eventId");
    expect(fields).toContain("activity.toolName");
    expect(fields).toContain("activity.userEmail");
    expect(fields).toContain("alert.summary");
    expect(
      AGENT_GUARD_SLACK_PREVIEW_FIELDS.find(
        (field) => field.sourceField === "activity.userEmail"
      )?.redaction
    ).toContain("customer-approved");
    expect(fields).not.toContain("activity.rawContent");
  });

  it("defines rollout and customer ownership before implementation", () => {
    expect(AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS).toHaveLength(5);
    expect(AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS[0]?.owner).toContain(
      "Customer Slack admin"
    );
  });

  it("renders copyable markdown with boundaries and no secrets", () => {
    const markdown = renderSlackWorkflowPreviewSpecMarkdown();

    expect(markdown).toContain("# AgentGuard Slack Workflow URL Preview");
    expect(markdown).toContain("stores Slack URLs only in encrypted form");
    expect(markdown).toContain("## Implementation Gates");
    expect(markdown).toContain("Do not reuse the existing plaintext export destination endpoint_url");
    expect(markdown).toContain("## Allowed Message Fields");
    expect(markdown).toContain("## Forbidden Claims");
    expect(markdown).toContain(AGENT_GUARD_SLACK_PREVIEW_COPY.boundary);

    for (const pattern of UNSAFE_HANDOFF_PATTERNS) {
      expect(markdown).not.toMatch(pattern);
    }
  });

  it("keeps forbidden claims explicit", () => {
    expect(AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS).toContain(
      "Do not claim a shipped Slack app."
    );
    expect(AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS).toContain(
      "Do not claim background retry for Slack failures."
    );
  });
});
