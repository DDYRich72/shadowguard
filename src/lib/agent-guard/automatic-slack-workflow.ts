import type { AgentGuardExportEvent } from "./export-foundation";
import {
  buildAgentGuardSlackMessagePayload,
  decryptAgentGuardSlackWebhookUrl,
  normalizeAgentGuardSlackWorkflowEventTypes,
  sendAgentGuardSlackWorkflowMessage,
  slackTargetAllowsAutomaticDelivery,
  type AgentGuardSlackWorkflowCustomerApprovalStatus,
  type AgentGuardSlackWorkflowDeliveryResult,
  type AgentGuardSlackWorkflowEventType,
  type AgentGuardSlackWorkflowTargetStatus,
  type AgentGuardSlackWorkflowTargetType,
  type AgentGuardSlackWorkflowUserIdentifierMode,
} from "./slack-workflow-targets";

type SlackTargetRow = {
  id: string;
  org_id: string;
  name: string;
  target_type: AgentGuardSlackWorkflowTargetType;
  status: AgentGuardSlackWorkflowTargetStatus;
  webhook_url_encrypted: string;
  webhook_url_hint: string;
  event_types: string[] | null;
  dry_run_enabled: boolean;
  live_send_enabled: boolean;
  owner_name: string | null;
  owner_email: string | null;
  customer_approval_status: AgentGuardSlackWorkflowCustomerApprovalStatus | null;
  user_identifier_mode: AgentGuardSlackWorkflowUserIdentifierMode | null;
  last_successful_test_at: string | null;
};

type QueryChain<T> = {
  select(columns: string): QueryChain<T>;
  eq(column: string, value: unknown): QueryChain<T>;
  order?: (column: string, options?: { ascending?: boolean }) => QueryChain<T>;
  insert?: (values: Record<string, unknown>) => QueryChain<T>;
  update?: (values: Record<string, unknown>) => QueryChain<T>;
  then: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>["then"];
};

export type AgentGuardSlackWorkflowDatabase = {
  from(table: "agent_slack_workflow_targets"): QueryChain<SlackTargetRow[]>;
  from(table: "agent_slack_workflow_delivery_attempts"): QueryChain<unknown>;
  from(table: string): QueryChain<unknown>;
};

async function logSlackAttempt(
  supabase: AgentGuardSlackWorkflowDatabase,
  target: SlackTargetRow,
  result: AgentGuardSlackWorkflowDeliveryResult
) {
  await supabase.from("agent_slack_workflow_delivery_attempts").insert?.({
    org_id: target.org_id,
    target_id: target.id,
    event_id: result.eventId,
    event_type: result.eventType,
    status: result.status,
    delivery_mode: result.deliveryMode,
    http_status: result.httpStatus,
    duration_ms: result.durationMs,
    error_message: result.errorMessage,
    payload: result.payload,
    created_by_user_id: null,
    created_by_email: null,
  });

  await supabase
    .from("agent_slack_workflow_targets")
    .update?.({ last_live_attempt_at: new Date().toISOString() })
    .eq("id", target.id)
    .eq("org_id", target.org_id);
}

export async function processAgentGuardAutomaticSlackWorkflowSends(
  supabase: AgentGuardSlackWorkflowDatabase,
  orgId: string,
  event: AgentGuardExportEvent,
  options: {
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardSlackWorkflowDeliveryResult[]> {
  if (
    event.eventType !== "agentguard.policy.blocked" &&
    event.eventType !== "agentguard.review.required"
  ) {
    return [];
  }

  const { data, error } = await supabase
    .from("agent_slack_workflow_targets")
    .select(
      "id, org_id, name, target_type, status, webhook_url_encrypted, webhook_url_hint, event_types, dry_run_enabled, live_send_enabled, owner_name, owner_email, customer_approval_status, user_identifier_mode, last_successful_test_at"
    )
    .eq("org_id", orgId)
    .eq("status", "enabled")
    .eq("live_send_enabled", true);

  if (error || !data) {
    return [];
  }

  const results: AgentGuardSlackWorkflowDeliveryResult[] = [];
  for (const target of data) {
    const eventType = event.eventType as AgentGuardSlackWorkflowEventType;
    if (!normalizeAgentGuardSlackWorkflowEventTypes(target.event_types).includes(eventType)) {
      continue;
    }
    if (!slackTargetAllowsAutomaticDelivery(target, eventType)) {
      continue;
    }

    const payload = buildAgentGuardSlackMessagePayload(event, {
      targetName: target.name,
      userIdentifierMode: target.user_identifier_mode ?? "redacted",
    });

    let result: AgentGuardSlackWorkflowDeliveryResult;
    if (target.dry_run_enabled) {
      result = await sendAgentGuardSlackWorkflowMessage(
        { url: "", dryRunEnabled: true },
        {
          eventId: event.eventId,
          eventType,
          payload,
        },
        "automatic",
        { timeoutMs: options.timeoutMs ?? 8_000 }
      );
    } else {
      try {
        const url = decryptAgentGuardSlackWebhookUrl(target.webhook_url_encrypted);
        result = await sendAgentGuardSlackWorkflowMessage(
          { url, dryRunEnabled: false },
          {
            eventId: event.eventId,
            eventType,
            payload,
          },
          "automatic",
          { timeoutMs: options.timeoutMs ?? 8_000 }
        );
      } catch {
        result = {
          eventId: event.eventId,
          eventType,
          status: "failed",
          deliveryMode: "automatic",
          httpStatus: null,
          durationMs: 0,
          errorMessage: "Slack target URL could not be decrypted.",
          payload,
        };
      }
    }

    await logSlackAttempt(supabase, target, result);
    results.push(result);
  }

  return results;
}
