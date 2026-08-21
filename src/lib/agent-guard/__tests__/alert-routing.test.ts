import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ALERT_ROUTING_BOUNDARY,
  AGENT_GUARD_ALERT_ROUTING_DECISION,
  AGENT_GUARD_ALERT_ROUTING_EVENTS,
  alertRoutingEventLabel,
} from "../alert-routing";

describe("AgentGuard generic alert routing", () => {
  it("documents the durable destination-model decision", () => {
    expect(AGENT_GUARD_ALERT_ROUTING_DECISION).toContain(
      "reuses export destinations"
    );
    expect(AGENT_GUARD_ALERT_ROUTING_DECISION).toContain(
      "separate alert destination model is deferred"
    );
  });

  it("defines shipped generic alert-worthy event types", () => {
    expect(AGENT_GUARD_ALERT_ROUTING_EVENTS.map((event) => event.eventType)).toEqual([
      "agentguard.activity.evaluated",
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ]);
    expect(
      AGENT_GUARD_ALERT_ROUTING_EVENTS.filter(
        (event) => event.category === "alert"
      ).map((event) => event.eventType)
    ).toEqual(["agentguard.policy.blocked", "agentguard.review.required"]);
  });

  it("keeps downstream vendor behavior customer-owned", () => {
    const text = [
      AGENT_GUARD_ALERT_ROUTING_BOUNDARY,
      ...AGENT_GUARD_ALERT_ROUTING_EVENTS.map((event) => event.downstreamOwner),
    ].join(" ");

    expect(text).toContain("customer-owned HTTPS receivers");
    expect(text).toContain("Customer middleware owns downstream notification");
    expect(text).toContain("not a native Slack app");
    expect(text).toContain("managed SIEM connector");
    expect(text).toContain("background retry queue");
    expect(text).toContain("automatic monitoring");
    expect(text).not.toContain("sends Slack alerts");
    expect(text).not.toContain("creates tickets automatically");
  });

  it("provides stable labels for UI surfaces", () => {
    expect(alertRoutingEventLabel("agentguard.review.required")).toBe(
      "Review required"
    );
    expect(alertRoutingEventLabel("future.event")).toBe("future.event");
  });
});
