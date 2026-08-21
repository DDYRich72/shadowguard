import { randomUUID } from "node:crypto";
import {
  AGENT_GUARD_EXPORT_SIGNING_HEADERS,
  agentGuardSampleExportEvent,
  type AgentGuardExportEvent,
} from "./export-foundation";
import { signAgentGuardExportPayload } from "./export-signing";

export type AgentGuardExportHeaders = Record<string, string>;
export type AgentGuardExportDeliveryStatus = "succeeded" | "failed" | "dry_run";
export type AgentGuardExportDeliveryMode =
  | "manual_test"
  | "automatic"
  | "dry_run"
  | "manual_replay";

export type AgentGuardExportDeliveryTarget = {
  url: string;
  signingSecret: string;
  dryRunEnabled?: boolean;
};

export type AgentGuardExportDeliveryResult = {
  eventId: string;
  eventType: AgentGuardExportEvent["eventType"];
  status: AgentGuardExportDeliveryStatus;
  deliveryMode: AgentGuardExportDeliveryMode;
  httpStatus: number | null;
  durationMs: number;
  errorMessage: string | null;
  payload: AgentGuardExportEvent;
};

export type AgentGuardExportFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>;

const EVENT_ID_HEADER = AGENT_GUARD_EXPORT_SIGNING_HEADERS[0].name;
const TIMESTAMP_HEADER = AGENT_GUARD_EXPORT_SIGNING_HEADERS[1].name;
const SIGNATURE_HEADER = AGENT_GUARD_EXPORT_SIGNING_HEADERS[2].name;

export function buildAgentGuardExportHeaders(
  payload: AgentGuardExportEvent,
  signingSecret: string,
  timestamp = Math.floor(Date.now() / 1000)
): AgentGuardExportHeaders {
  return {
    "content-type": "application/json",
    "user-agent": "ShadowGuard-AgentGuard-Export/1.0",
    [EVENT_ID_HEADER]: payload.eventId,
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: signAgentGuardExportPayload(payload, signingSecret),
  };
}

export function buildAgentGuardTestExportPayload(
  orgId: string,
  now = new Date()
): AgentGuardExportEvent {
  return {
    ...agentGuardSampleExportEvent(),
    eventId: `agevt_test_${randomUUID()}`,
    eventType: "agentguard.activity.evaluated",
    occurredAt: now.toISOString(),
    orgId,
  };
}

async function sendAgentGuardExportEvent(
  target: AgentGuardExportDeliveryTarget,
  payload: AgentGuardExportEvent,
  deliveryMode: AgentGuardExportDeliveryMode,
  options: {
    fetchImpl?: AgentGuardExportFetch;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardExportDeliveryResult> {
  if (target.dryRunEnabled) {
    return {
      eventId: payload.eventId,
      eventType: payload.eventType,
      status: "dry_run",
      deliveryMode: "dry_run",
      httpStatus: null,
      durationMs: 0,
      errorMessage: null,
      payload,
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 8_000
  );
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(target.url, {
      method: "POST",
      headers: buildAgentGuardExportHeaders(payload, target.signingSecret),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const succeeded = response.status >= 200 && response.status <= 299;
    return {
      eventId: payload.eventId,
      eventType: payload.eventType,
      status: succeeded ? "succeeded" : "failed",
      deliveryMode,
      httpStatus: response.status,
      durationMs,
      errorMessage: succeeded
        ? null
        : `Destination returned HTTP ${response.status}.`,
      payload,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      eventId: payload.eventId,
      eventType: payload.eventType,
      status: "failed",
      deliveryMode,
      httpStatus: null,
      durationMs,
      errorMessage: aborted
        ? "Destination test timed out."
        : error instanceof Error
          ? error.message
          : "Destination test failed.",
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendAgentGuardExportTest(
  target: AgentGuardExportDeliveryTarget,
  orgId: string,
  options: {
    fetchImpl?: AgentGuardExportFetch;
    now?: Date;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardExportDeliveryResult> {
  return sendAgentGuardExportEvent(
    target,
    buildAgentGuardTestExportPayload(orgId, options.now),
    "manual_test",
    options
  );
}

export async function sendAgentGuardAutomaticExport(
  target: AgentGuardExportDeliveryTarget,
  payload: AgentGuardExportEvent,
  options: {
    fetchImpl?: AgentGuardExportFetch;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardExportDeliveryResult> {
  return sendAgentGuardExportEvent(
    target,
    payload,
    "automatic",
    options
  );
}

export async function sendAgentGuardExportReplay(
  target: AgentGuardExportDeliveryTarget,
  payload: AgentGuardExportEvent,
  options: {
    fetchImpl?: AgentGuardExportFetch;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardExportDeliveryResult> {
  return sendAgentGuardExportEvent(
    target,
    payload,
    "manual_replay",
    options
  );
}
