import type { AgentGuardExportEventType } from "./export-foundation";

export type AgentGuardAlertRoutingEvent = {
  eventType: AgentGuardExportEventType;
  label: string;
  category: "activity" | "alert";
  shipped: boolean;
  description: string;
  downstreamOwner: string;
};

export const AGENT_GUARD_ALERT_ROUTING_DECISION =
  "AgentGuard reuses export destinations as the generic alert-routing foundation. A separate alert destination model is deferred until destination ownership, escalation, or vendor-specific needs outgrow the existing HTTPS destination controls.";

export const AGENT_GUARD_ALERT_ROUTING_EVENTS: AgentGuardAlertRoutingEvent[] = [
  {
    eventType: "agentguard.activity.evaluated",
    label: "Evaluated activity",
    category: "activity",
    shipped: true,
    description:
      "Metadata-only activity evaluation event for customer-owned logging or middleware correlation.",
    downstreamOwner:
      "Customer receiver decides whether evaluated activity becomes a log, metric, or ignored event.",
  },
  {
    eventType: "agentguard.policy.blocked",
    label: "Blocked policy",
    category: "alert",
    shipped: true,
    description:
      "Alert-worthy event emitted when an enabled block policy returns a block decision.",
    downstreamOwner:
      "Customer middleware owns downstream notification, ticketing, escalation, and vendor field mapping.",
  },
  {
    eventType: "agentguard.review.required",
    label: "Review required",
    category: "alert",
    shipped: true,
    description:
      "Alert-worthy event emitted when warn or quarantine policy outcomes create review queue work.",
    downstreamOwner:
      "Customer middleware owns downstream notification, ticketing, escalation, and vendor field mapping.",
  },
];

export const AGENT_GUARD_ALERT_ROUTING_BOUNDARY =
  "Generic alert routing sends selected metadata-only events to customer-owned HTTPS receivers through existing guarded export destinations. It is not a native Slack app, Teams app, email service, managed SIEM connector, SOAR or ticketing integration, background retry queue, hosted receiver, legal advice, certification, compliance determination, auditor attestation, security warranty, automatic monitoring, or automatic enforcement expansion.";

export function alertRoutingEventLabel(eventType: string): string {
  return (
    AGENT_GUARD_ALERT_ROUTING_EVENTS.find((event) => event.eventType === eventType)
      ?.label ?? eventType
  );
}
