import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_QUIET_SOURCE_NOTES,
  AGENT_GUARD_SOURCE_ROTATION_STEPS,
  groupAgentGuardActivityBySource,
  highestAgentGuardSourceRisk,
  summarizeAgentGuardSourceActivity,
  type AgentGuardSourceActivity,
} from "../source-activity";

function activity(
  overrides: Partial<AgentGuardSourceActivity>
): AgentGuardSourceActivity {
  return {
    id: "activity-1",
    toolName: "ChatGPT",
    userEmail: "analyst@example.com",
    activityType: "prompt_sent",
    timestamp: "2026-05-16T12:00:00.000Z",
    riskLevel: "none",
    blocked: false,
    source: { id: "source-1", name: "Production wrapper" },
    ...overrides,
  };
}

describe("AgentGuard source activity helpers", () => {
  it("groups only source-attributed activity by source id", () => {
    const groups = groupAgentGuardActivityBySource([
      activity({ id: "a1", source: { id: "source-1" } }),
      activity({ id: "a2", source: { id: "source-2" } }),
      activity({ id: "a3", source: null }),
    ]);

    expect([...groups.keys()]).toEqual(["source-1", "source-2"]);
    expect(groups.get("source-1")?.activities.map((item) => item.id)).toEqual(["a1"]);
    expect(groups.get("source-2")?.activities.map((item) => item.id)).toEqual(["a2"]);
  });

  it("summarizes event count, users, blocked count, highest risk, and last activity", () => {
    const summary = summarizeAgentGuardSourceActivity("source-1", [
      activity({
        id: "a1",
        userEmail: "Analyst@Example.com",
        riskLevel: "low",
        timestamp: "2026-05-16T12:00:00.000Z",
      }),
      activity({
        id: "a2",
        userEmail: "analyst@example.com",
        blocked: true,
        riskLevel: "critical",
        timestamp: "2026-05-16T12:10:00.000Z",
      }),
      activity({
        id: "a3",
        userEmail: "ops@example.com",
        riskLevel: "medium",
        timestamp: "2026-05-16T11:00:00.000Z",
      }),
    ]);

    expect(summary.eventCount).toBe(3);
    expect(summary.uniqueUserCount).toBe(2);
    expect(summary.blockedCount).toBe(1);
    expect(summary.highestRisk).toBe("critical");
    expect(summary.lastActivityAt).toBe("2026-05-16T12:10:00.000Z");
    expect(summary.recentActivities.map((item) => item.id)).toEqual(["a2", "a1", "a3"]);
  });

  it("limits recent activity while preserving newest-first order", () => {
    const summary = summarizeAgentGuardSourceActivity(
      "source-1",
      [
        activity({ id: "a1", timestamp: "2026-05-16T12:00:00.000Z" }),
        activity({ id: "a2", timestamp: "2026-05-16T12:10:00.000Z" }),
        activity({ id: "a3", timestamp: "2026-05-16T12:20:00.000Z" }),
      ],
      2
    );

    expect(summary.recentActivities.map((item) => item.id)).toEqual(["a3", "a2"]);
  });

  it("orders supported risk levels conservatively", () => {
    expect(
      highestAgentGuardSourceRisk([
        activity({ riskLevel: "none" }),
        activity({ riskLevel: "medium" }),
        activity({ riskLevel: "high" }),
        activity({ riskLevel: "unknown" }),
      ])
    ).toBe("high");
  });

  it("provides quiet-source and rotation guidance without source-key reveal claims", () => {
    const text = [
      ...AGENT_GUARD_QUIET_SOURCE_NOTES,
      ...AGENT_GUARD_SOURCE_ROTATION_STEPS,
    ].join(" ");

    expect(text).toContain("Authorization: Bearer <source key>");
    expect(text).toContain("Revoke the old source");
    expect(text).not.toContain("reveal the old key");
    expect(text).not.toContain("automatic monitoring");
  });
});
