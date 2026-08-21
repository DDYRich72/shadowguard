import {
  decryptAgentExportSigningSecret,
  destinationAllowsAutomaticExport,
  type AgentExportDestinationRecord,
} from "./export-destinations";
import {
  sendAgentGuardAutomaticExport,
  type AgentGuardExportDeliveryResult,
  type AgentGuardExportFetch,
} from "./export-delivery";
import type { AgentGuardExportEvent } from "./export-foundation";

type QueryResult<T> = { data: T | null; error: unknown | null };

type DestinationQuery = PromiseLike<QueryResult<AgentExportDestinationRow[]>> & {
  eq(column: string, value: unknown): DestinationQuery;
  limit(count: number): PromiseLike<QueryResult<AgentExportDestinationRow[]>>;
};

type MutationQuery = PromiseLike<{ error: unknown | null }> & {
  eq(column: string, value: unknown): MutationQuery;
};

type AgentGuardAutomaticExportTable = {
  select(columns: string): DestinationQuery;
  insert(values: Record<string, unknown>): PromiseLike<{ error: unknown | null }>;
  update(values: Record<string, unknown>): MutationQuery;
};

export type AgentGuardAutomaticExportDatabase = {
  from(table: string): AgentGuardAutomaticExportTable;
};

export type AgentExportDestinationRow = AgentExportDestinationRecord & {
  automatic_delivery_enabled: boolean;
  dry_run_enabled: boolean;
  event_types: string[] | null;
};

export type AgentGuardAutomaticExportResult = AgentGuardExportDeliveryResult & {
  destinationId: string;
};

async function logAutomaticExportAttempt(
  supabase: AgentGuardAutomaticExportDatabase,
  orgId: string,
  destinationId: string,
  result: AgentGuardExportDeliveryResult
) {
  await supabase.from("agent_export_delivery_attempts").insert({
    org_id: orgId,
    destination_id: destinationId,
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
    .from("agent_export_destinations")
    .update({ last_automatic_attempt_at: new Date().toISOString() })
    .eq("id", destinationId)
    .eq("org_id", orgId);
}

export async function processAgentGuardAutomaticExports(
  supabase: AgentGuardAutomaticExportDatabase,
  orgId: string,
  event: AgentGuardExportEvent,
  options: {
    fetchImpl?: AgentGuardExportFetch;
    timeoutMs?: number;
  } = {}
): Promise<AgentGuardAutomaticExportResult[]> {
  const { data, error } = await supabase
    .from("agent_export_destinations")
    .select(
      "id, org_id, name, destination_type, status, endpoint_url, signing_secret_encrypted, signing_secret_hint, automatic_delivery_enabled, dry_run_enabled, event_types"
    )
    .eq("org_id", orgId)
    .eq("status", "enabled")
    .eq("automatic_delivery_enabled", true)
    .limit(5);

  if (error || !data) return [];

  const results: AgentGuardAutomaticExportResult[] = [];
  for (const destination of data) {
    if (!destinationAllowsAutomaticExport(destination, event.eventType)) continue;

    let result: AgentGuardExportDeliveryResult;
    try {
      const signingSecret = destination.dry_run_enabled
        ? "dry-run-signing-secret-not-used"
        : decryptAgentExportSigningSecret(destination.signing_secret_encrypted);
      result = await sendAgentGuardAutomaticExport(
        {
          url: destination.endpoint_url,
          signingSecret,
          dryRunEnabled: destination.dry_run_enabled,
        },
        event,
        { fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? 5_000 }
      );
    } catch (error) {
      result = {
        eventId: event.eventId,
        eventType: event.eventType,
        status: "failed",
        deliveryMode: destination.dry_run_enabled ? "dry_run" : "automatic",
        httpStatus: null,
        durationMs: 0,
        errorMessage: error instanceof Error ? error.message : "Automatic export failed.",
        payload: event,
      };
    }

    await logAutomaticExportAttempt(supabase, orgId, destination.id, result);
    results.push({ ...result, destinationId: destination.id });
  }

  return results;
}
