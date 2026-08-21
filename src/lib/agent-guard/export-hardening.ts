import type {
  AgentGuardExportDeliveryMode,
  AgentGuardExportDeliveryStatus,
} from "./export-delivery";

export type AgentExportReceiverAcknowledgementStatus =
  | "not_requested"
  | "requested"
  | "confirmed"
  | "not_applicable";

export type AgentExportFailureCategory =
  | "none"
  | "dry_run"
  | "receiver_http_error"
  | "timeout"
  | "network_error"
  | "signing_or_configuration"
  | "unknown";

export type AgentExportFailureClassification = {
  category: AgentExportFailureCategory;
  label: string;
  summary: string;
  nextAction: string;
};

export type AgentExportFailureAttempt = {
  status: AgentGuardExportDeliveryStatus;
  deliveryMode?: AgentGuardExportDeliveryMode;
  delivery_mode?: AgentGuardExportDeliveryMode;
  httpStatus?: number | null;
  http_status?: number | null;
  errorMessage?: string | null;
  error_message?: string | null;
};

export const AGENT_EXPORT_ACKNOWLEDGEMENT_STATUS_OPTIONS: Array<{
  value: AgentExportReceiverAcknowledgementStatus;
  label: string;
  summary: string;
}> = [
  {
    value: "not_requested",
    label: "Not requested",
    summary: "Receiver-side acknowledgement has not been requested yet.",
  },
  {
    value: "requested",
    label: "Requested",
    summary: "Customer receiver owner has been asked to confirm signature verification and routing.",
  },
  {
    value: "confirmed",
    label: "Confirmed",
    summary: "Customer receiver owner confirmed receiver-side verification and handling.",
  },
  {
    value: "not_applicable",
    label: "Not applicable",
    summary: "Acknowledgement is not required for this destination or pilot stage.",
  },
];

export const AGENT_EXPORT_HARDENING_BOUNDARY =
  "HTTPS export hardening documents customer-owned receiver ownership, escalation, acknowledgement, and failure posture. It is not automatic retry, not automatic escalation, not managed connector delivery, not native Slack/Teams/email/SIEM/SOAR/ticketing integration, not hosted receiver operations, not legal advice, not certification, not compliance determination, not auditor attestation, not a security warranty, and not proof of receiver-side signature verification by itself.";

export function acknowledgementStatusLabel(
  status: AgentExportReceiverAcknowledgementStatus | string
): string {
  return (
    AGENT_EXPORT_ACKNOWLEDGEMENT_STATUS_OPTIONS.find(
      (option) => option.value === status
    )?.label ?? "Unknown"
  );
}

function normalizedAttempt(attempt: AgentExportFailureAttempt) {
  return {
    httpStatus: attempt.httpStatus ?? attempt.http_status ?? null,
    errorMessage: attempt.errorMessage ?? attempt.error_message ?? "",
  };
}

export function classifyAgentExportFailure(
  attempt: AgentExportFailureAttempt
): AgentExportFailureClassification {
  if (attempt.status === "succeeded") {
    return {
      category: "none",
      label: "Delivered",
      summary: "The destination returned a successful 2xx response.",
      nextAction:
        "Keep receiver ownership, acknowledgement, and replay expectations documented.",
    };
  }

  if (attempt.status === "dry_run") {
    return {
      category: "dry_run",
      label: "Dry-run logged",
      summary: "Dry-run mode recorded an attempt without an outbound request.",
      nextAction:
        "Keep dry-run on until receiver routing and escalation have been reviewed.",
    };
  }

  const { httpStatus, errorMessage } = normalizedAttempt(attempt);
  const error = errorMessage.toLowerCase();

  if (httpStatus !== null) {
    return {
      category: "receiver_http_error",
      label: "Receiver HTTP error",
      summary: `The receiver returned HTTP ${httpStatus}.`,
      nextAction:
        "Ask the receiver owner to review endpoint handling, signature verification, payload parsing, and response codes before replaying.",
    };
  }

  if (error.includes("timed out") || error.includes("abort")) {
    return {
      category: "timeout",
      label: "Receiver timeout",
      summary: "ShadowGuard did not receive a receiver response before timeout.",
      nextAction:
        "Ask the receiver owner to check endpoint latency, network path, and synchronous processing before replaying.",
    };
  }

  if (
    error.includes("signing secret") ||
    error.includes("export_secret_key") ||
    error.includes("secret key") ||
    error.includes("decrypt")
  ) {
    return {
      category: "signing_or_configuration",
      label: "Signing/configuration issue",
      summary:
        "Local signing secret or export configuration prevented delivery.",
      nextAction:
        "Review ShadowGuard export secret configuration and destination signing-secret storage before retrying.",
    };
  }

  if (
    error.includes("fetch failed") ||
    error.includes("failed to fetch") ||
    error.includes("network") ||
    error.includes("enotfound") ||
    error.includes("econnrefused") ||
    error.includes("getaddrinfo")
  ) {
    return {
      category: "network_error",
      label: "Network/request failure",
      summary: "The outbound request failed before a receiver HTTP response.",
      nextAction:
        "Ask the receiver owner to verify DNS, TLS, firewall, endpoint availability, and public reachability before replaying.",
    };
  }

  return {
    category: "unknown",
    label: "Unclassified failure",
    summary: errorMessage || "Delivery failed without a grouped reason.",
    nextAction:
      "Review the raw attempt error with the receiver owner, then replay manually after the issue is understood.",
  };
}
