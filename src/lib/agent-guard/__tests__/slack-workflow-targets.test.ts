import { describe, expect, it, vi } from "vitest";
import { agentGuardSampleExportEvent } from "../export-foundation";
import {
  processAgentGuardAutomaticSlackWorkflowSends,
  type AgentGuardSlackWorkflowDatabase,
} from "../automatic-slack-workflow";
import {
  buildAgentGuardSlackManualTestPayload,
  buildAgentGuardSlackMessagePayload,
  decryptAgentGuardSlackWebhookUrl,
  encryptAgentGuardSlackWebhookUrl,
  hashAgentGuardSlackWebhookUrl,
  normalizeAgentGuardSlackWorkflowEventTypes,
  sendAgentGuardSlackWorkflowMessage,
  slackTargetAllowsAutomaticDelivery,
  slackWebhookUrlHint,
  validateAgentGuardSlackWebhookUrl,
} from "../slack-workflow-targets";

const TEST_KEY = "test-slack-workflow-url-key";

type TestQueryChain<T> = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: { data: T; error: null }) => unknown
  ) => Promise<unknown>;
};

function query<T>(result: T) {
  const chain = {} as TestQueryChain<T>;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.then = (resolve: (value: { data: T; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: result, error: null }));
  return chain;
}

function dbWithTargets(
  targets: unknown[],
  inserts: Record<string, unknown>[] = []
): AgentGuardSlackWorkflowDatabase {
  const database = {
    from: vi.fn((table: string) => {
      if (table === "agent_slack_workflow_targets") {
        return query(targets);
      }
      if (table === "agent_slack_workflow_delivery_attempts") {
        const chain = query({});
        chain.insert = vi.fn((values: Record<string, unknown>) => {
          inserts.push(values);
          return chain;
        });
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  return database as unknown as AgentGuardSlackWorkflowDatabase;
}

describe("AgentGuard Slack workflow targets", () => {
  it("validates only Slack webhook and workflow trigger URLs", () => {
    expect(
      validateAgentGuardSlackWebhookUrl(
        "https://hooks.slack.com/services/T000/B000/secret"
      )
    ).toMatchObject({
      ok: true,
      targetType: "incoming_webhook",
    });
    expect(
      validateAgentGuardSlackWebhookUrl(
        "https://hooks.slack.com/triggers/T000/ABCDEF/secret"
      )
    ).toMatchObject({
      ok: true,
      targetType: "workflow_webhook",
    });
    expect(
      validateAgentGuardSlackWebhookUrl(
        "https://hooks.slack-gov.com/services/T000/B000/secret"
      )
    ).toMatchObject({ ok: true });

    expect(validateAgentGuardSlackWebhookUrl("http://hooks.slack.com/services/T/B/x").ok).toBe(false);
    expect(validateAgentGuardSlackWebhookUrl("https://example.com/services/T/B/x").ok).toBe(false);
    expect(validateAgentGuardSlackWebhookUrl("https://hooks.slack.com/api/chat.postMessage").ok).toBe(false);
    expect(validateAgentGuardSlackWebhookUrl("https://hooks.slack.com/services/T/B/x?token=1").ok).toBe(false);
  });

  it("encrypts Slack URLs and exposes only hints and hashes", () => {
    const url = "https://hooks.slack.com/services/T000/B000/secret";
    const encrypted = encryptAgentGuardSlackWebhookUrl(url, TEST_KEY);
    const hash = hashAgentGuardSlackWebhookUrl(url);
    const hint = slackWebhookUrlHint(url);

    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain("secret");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("secret");
    expect(hint).toBe("hooks.slack.com/services/...cret");
    expect(decryptAgentGuardSlackWebhookUrl(encrypted, TEST_KEY)).toBe(url);
  });

  it("normalizes event scope to blocked policy and review required", () => {
    expect(
      normalizeAgentGuardSlackWorkflowEventTypes([
        "agentguard.policy.blocked",
        "agentguard.activity.evaluated",
        "agentguard.policy.blocked",
        "agentguard.review.required",
      ])
    ).toEqual(["agentguard.policy.blocked", "agentguard.review.required"]);
  });

  it("builds metadata-only Slack messages with redacted user identifiers", () => {
    const payload = buildAgentGuardSlackMessagePayload(agentGuardSampleExportEvent(), {
      targetName: "Security Alerts",
      userIdentifierMode: "redacted",
    });
    const text = JSON.stringify(payload);

    expect(text).toContain("Security Alerts");
    expect(text).toContain("e***@example.com");
    expect(text).not.toContain("employee@example.com");
    expect(text).not.toContain("hooks.slack.com");
    expect(text).not.toContain("Bearer");
  });

  it("sends dry-run attempts without outbound requests", async () => {
    const event = buildAgentGuardSlackManualTestPayload({
      orgId: "org-1",
      targetName: "Security Alerts",
      now: new Date("2026-05-20T12:00:00.000Z"),
    });
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

    const result = await sendAgentGuardSlackWorkflowMessage(
      { url: "https://hooks.slack.com/services/T000/B000/secret", dryRunEnabled: true },
      event,
      "manual_test",
      { fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("dry_run");
    expect(result.deliveryMode).toBe("dry_run");
  });

  it("posts JSON payloads to Slack and reports failures", async () => {
    const event = buildAgentGuardSlackManualTestPayload({
      orgId: "org-1",
      targetName: "Security Alerts",
    });
    const fetchImpl = vi.fn(async () => new Response("invalid_payload", { status: 400 }));

    const result = await sendAgentGuardSlackWorkflowMessage(
      { url: "https://hooks.slack.com/services/T000/B000/secret", dryRunEnabled: false },
      event,
      "manual_test",
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.status).toBe("failed");
    expect(result.httpStatus).toBe(400);
    expect(result.errorMessage).toContain("invalid_payload");
    expect(JSON.stringify(result.payload)).not.toContain(
      "https://hooks.slack.com/services/T000/B000/secret"
    );
  });

  it("requires live targets to be enabled, approved, tested, and event-selected", () => {
    const target = {
      status: "enabled" as const,
      live_send_enabled: true,
      customer_approval_status: "approved" as const,
      last_successful_test_at: "2026-05-20T12:00:00.000Z",
      event_types: ["agentguard.policy.blocked"],
    };

    expect(slackTargetAllowsAutomaticDelivery(target, "agentguard.policy.blocked")).toBe(true);
    expect(slackTargetAllowsAutomaticDelivery({ ...target, status: "disabled" }, "agentguard.policy.blocked")).toBe(false);
    expect(slackTargetAllowsAutomaticDelivery({ ...target, customer_approval_status: "requested" }, "agentguard.policy.blocked")).toBe(false);
    expect(slackTargetAllowsAutomaticDelivery({ ...target, last_successful_test_at: null }, "agentguard.policy.blocked")).toBe(false);
    expect(slackTargetAllowsAutomaticDelivery(target, "agentguard.review.required")).toBe(false);
  });

  it("processes automatic Slack preview sends only for gated targets", async () => {
    const encrypted = encryptAgentGuardSlackWebhookUrl(
      "https://hooks.slack.com/services/T000/B000/secret",
      TEST_KEY
    );
    const inserts: Record<string, unknown>[] = [];
    const db = dbWithTargets(
      [
        {
          id: "target-1",
          org_id: "org_demo",
          name: "Security Alerts",
          target_type: "incoming_webhook",
          status: "enabled",
          webhook_url_encrypted: encrypted,
          webhook_url_hint: "hooks.slack.com/services/...cret",
          event_types: ["agentguard.policy.blocked"],
          dry_run_enabled: true,
          live_send_enabled: true,
          owner_name: "SecOps",
          owner_email: "secops@example.com",
          customer_approval_status: "approved",
          user_identifier_mode: "redacted",
          last_successful_test_at: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "target-2",
          org_id: "org_demo",
          name: "No approval",
          target_type: "incoming_webhook",
          status: "enabled",
          webhook_url_encrypted: encrypted,
          webhook_url_hint: "hooks.slack.com/services/...cret",
          event_types: ["agentguard.policy.blocked"],
          dry_run_enabled: true,
          live_send_enabled: true,
          owner_name: "",
          owner_email: "",
          customer_approval_status: "requested",
          user_identifier_mode: "redacted",
          last_successful_test_at: "2026-05-20T12:00:00.000Z",
        },
      ],
      inserts
    );

    const event = {
      ...agentGuardSampleExportEvent(),
      eventType: "agentguard.policy.blocked" as const,
    };
    const results = await processAgentGuardAutomaticSlackWorkflowSends(
      db,
      "org_demo",
      event
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("dry_run");
    expect(inserts).toHaveLength(1);
    expect(JSON.stringify(inserts[0])).not.toContain("hooks.slack.com/services/T000");
  });
});
