export type AgentGuardSourceRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentGuardSourceActivity = {
  id: string;
  toolName: string;
  userEmail: string;
  activityType: string;
  timestamp: string;
  riskLevel: AgentGuardSourceRiskLevel | string;
  blocked: boolean;
  dataClassification?: {
    sensitivity?: string;
    categories?: string[];
  };
  source: {
    id: string;
    name?: string;
    environment?: string;
  } | null;
};

export type AgentGuardSourceActivitySummary = {
  sourceId: string;
  eventCount: number;
  uniqueUserCount: number;
  blockedCount: number;
  highestRisk: AgentGuardSourceRiskLevel;
  lastActivityAt: string | null;
  recentActivities: AgentGuardSourceActivity[];
};

export type AgentGuardSourceActivityGroup = {
  sourceId: string;
  activities: AgentGuardSourceActivity[];
  summary: AgentGuardSourceActivitySummary;
};

const RISK_WEIGHT: Record<AgentGuardSourceRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const AGENT_GUARD_SOURCE_ROTATION_STEPS = [
  "Create a new source key for the same server-side system.",
  "Update the server environment variable or secret manager with the new key.",
  "Send a safe test event and confirm the new source shows recent activity.",
  "Revoke the old source after the replacement is working.",
  "Keep both source rows for attribution history and audit context.",
] as const;

export const AGENT_GUARD_QUIET_SOURCE_NOTES = [
  "Confirm the server is using the current source key in a server-side environment variable.",
  "Check that the integration sends Authorization: Bearer <source key> to POST /api/agent-guard/activity.",
  "If allowed tools are scoped, confirm the submitted toolName exactly matches one of the allowed names.",
  "Send a dashboard test event after creating the source to verify the bearer-token path.",
] as const;

function normalizeRiskLevel(value: string): AgentGuardSourceRiskLevel {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical" ||
    value === "none"
    ? value
    : "none";
}

function compareActivityTime(
  left: AgentGuardSourceActivity,
  right: AgentGuardSourceActivity
): number {
  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
}

export function highestAgentGuardSourceRisk(
  activities: AgentGuardSourceActivity[]
): AgentGuardSourceRiskLevel {
  return activities.reduce<AgentGuardSourceRiskLevel>((highest, activity) => {
    const current = normalizeRiskLevel(activity.riskLevel);
    return RISK_WEIGHT[current] > RISK_WEIGHT[highest] ? current : highest;
  }, "none");
}

export function summarizeAgentGuardSourceActivity(
  sourceId: string,
  activities: AgentGuardSourceActivity[],
  recentLimit = 5
): AgentGuardSourceActivitySummary {
  const sorted = [...activities].sort(compareActivityTime);
  const users = new Set(
    sorted
      .map((activity) => activity.userEmail.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    sourceId,
    eventCount: sorted.length,
    uniqueUserCount: users.size,
    blockedCount: sorted.filter((activity) => activity.blocked).length,
    highestRisk: highestAgentGuardSourceRisk(sorted),
    lastActivityAt: sorted[0]?.timestamp ?? null,
    recentActivities: sorted.slice(0, recentLimit),
  };
}

export function groupAgentGuardActivityBySource(
  activities: AgentGuardSourceActivity[],
  recentLimit = 5
): Map<string, AgentGuardSourceActivityGroup> {
  const grouped = new Map<string, AgentGuardSourceActivity[]>();

  for (const activity of activities) {
    const sourceId = activity.source?.id?.trim();
    if (!sourceId) continue;
    grouped.set(sourceId, [...(grouped.get(sourceId) ?? []), activity]);
  }

  const output = new Map<string, AgentGuardSourceActivityGroup>();
  for (const [sourceId, sourceActivities] of grouped) {
    output.set(sourceId, {
      sourceId,
      activities: sourceActivities,
      summary: summarizeAgentGuardSourceActivity(
        sourceId,
        sourceActivities,
        recentLimit
      ),
    });
  }

  return output;
}
