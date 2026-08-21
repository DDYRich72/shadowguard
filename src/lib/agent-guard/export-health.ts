import type {
  AgentExportDestinationRecord,
  AgentExportDestinationStatus,
} from "./export-destinations";
import type {
  AgentGuardExportDeliveryMode,
  AgentGuardExportDeliveryStatus,
} from "./export-delivery";

export type AgentExportHealthStatus =
  | "disabled"
  | "not_tested"
  | "ready"
  | "dry_run"
  | "live"
  | "failing";

export type AgentExportHealthAttempt = {
  status: AgentGuardExportDeliveryStatus;
  delivery_mode: AgentGuardExportDeliveryMode;
  http_status?: number | null;
  created_at?: string | null;
} | null;

export type AgentExportHealthDestination = Pick<
  AgentExportDestinationRecord,
  "automatic_delivery_enabled" | "dry_run_enabled"
> & {
  status: AgentExportDestinationStatus;
  last_tested_at?: string | null;
};

export type AgentExportHealth = {
  status: AgentExportHealthStatus;
  label: string;
  summary: string;
};

export function agentExportDestinationHealth(
  destination: AgentExportHealthDestination,
  latestAttempt: AgentExportHealthAttempt = null
): AgentExportHealth {
  if (destination.status === "disabled") {
    return {
      status: "disabled",
      label: "Disabled",
      summary: "Destination is saved but cannot receive tests, replays, or automatic sends.",
    };
  }

  if (latestAttempt?.status === "failed") {
    return {
      status: "failing",
      label: "Failing",
      summary: "Latest delivery attempt failed. Review the error and replay manually after fixing the receiver.",
    };
  }

  if (destination.automatic_delivery_enabled && destination.dry_run_enabled) {
    return {
      status: "dry_run",
      label: "Dry-run",
      summary: "Automatic export is armed but logs attempts without outbound delivery.",
    };
  }

  if (destination.automatic_delivery_enabled && !destination.dry_run_enabled) {
    return {
      status: "live",
      label: "Live sends",
      summary: "Automatic export can send signed metadata-only events to this destination.",
    };
  }

  if (latestAttempt?.status === "succeeded" || destination.last_tested_at) {
    return {
      status: "ready",
      label: "Ready",
      summary: "Destination has a successful test or replay, but automatic export is off.",
    };
  }

  return {
    status: "not_tested",
    label: "Not tested",
    summary: "Destination has not recorded a successful delivery attempt yet.",
  };
}
