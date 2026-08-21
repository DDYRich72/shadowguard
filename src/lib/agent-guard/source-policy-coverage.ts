import type {
  AgentPolicyDecisionReviewStatus,
  ReviewablePolicyAction,
} from "./policy-reviews";

export type AgentGuardSourceCoverageStatus =
  | "needs_policy_scope"
  | "covered"
  | "test_or_demo"
  | "quiet"
  | "revoked"
  | "unknown_source";

export type AgentGuardSourceCoverageSource = {
  id: string;
  name: string;
  environment: string;
  status: string;
  allowedToolNames?: string[] | null;
};

export type AgentGuardSourceCoverageActivity = {
  id: string;
  toolName: string;
  userEmail: string;
  activityType: string;
  timestamp: string;
  riskLevel: string;
  blocked: boolean;
  blockedByPolicyId?: string | null;
  source: {
    id: string;
    name?: string;
    environment?: string;
  } | null;
};

export type AgentGuardSourceCoverageReview = {
  id: string;
  activityId: string | null;
  policyId: string | null;
  policyName: string;
  policyAction: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  riskLevel: string;
  createdAt: string;
};

export type AgentGuardSourcePolicyCoverageRow = {
  sourceId: string;
  sourceName: string;
  sourceEnvironment: string;
  sourceStatus: string;
  isConfiguredSource: boolean;
  coverageStatus: AgentGuardSourceCoverageStatus;
  coverageLabel: string;
  guidance: string;
  recentActivityCount: number;
  policyOutcomeCount: number;
  blockOutcomeCount: number;
  reviewOutcomeCount: number;
  needsActionReviewCount: number;
  highOrCriticalRiskCount: number;
  uniqueToolCount: number;
  uniqueUserCount: number;
  latestActivityAt: string | null;
  latestOutcomeAt: string | null;
  latestSignalAt: string | null;
  topTools: string[];
};

export type AgentGuardSourcePolicyCoverageSummary = {
  configuredSourceCount: number;
  activeSourceCount: number;
  recentActivitySourceCount: number;
  policyOutcomeSourceCount: number;
  needsPolicyScopeCount: number;
  needsActionReviewCount: number;
  testOrDemoSourceCount: number;
  revokedSourceCount: number;
  unknownSourceCount: number;
  unattributedReviewOutcomeCount: number;
};

export type AgentGuardSourcePolicyCoverage = {
  rows: AgentGuardSourcePolicyCoverageRow[];
  summary: AgentGuardSourcePolicyCoverageSummary;
};

type MutableCoverageRow = Omit<
  AgentGuardSourcePolicyCoverageRow,
  | "coverageStatus"
  | "coverageLabel"
  | "guidance"
  | "uniqueToolCount"
  | "uniqueUserCount"
  | "topTools"
> & {
  toolCounts: Map<string, number>;
  userEmails: Set<string>;
  sourceLooksLikeTest: boolean;
};

const STATUS_LABELS: Record<AgentGuardSourceCoverageStatus, string> = {
  needs_policy_scope: "Needs policy scope",
  covered: "Policy outcomes present",
  test_or_demo: "Test or non-production",
  quiet: "No recent activity",
  revoked: "Revoked source",
  unknown_source: "Unknown source",
};

const STATUS_PRIORITY: Record<AgentGuardSourceCoverageStatus, number> = {
  needs_policy_scope: 0,
  unknown_source: 1,
  covered: 2,
  test_or_demo: 3,
  quiet: 4,
  revoked: 5,
};

export const AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY = {
  overview:
    "Deterministic coverage guidance from submitted source activity and policy outcomes. It does not automatically monitor tools, change policies, or generate AI recommendations.",
  reviewMigrationWarning:
    "Policy review rows could not be loaded. Source activity and block coverage can still be shown, but warn/quarantine review coverage may be incomplete.",
} as const;

function sourceLooksLikeTestOrDemo(source: {
  name: string;
  environment: string;
}): boolean {
  const label = `${source.name} ${source.environment}`.toLowerCase();
  return (
    source.environment !== "production" ||
    /\b(demo|test|smoke|sample|sandbox)\b/.test(label)
  );
}

function isHighOrCritical(value: string): boolean {
  return value === "high" || value === "critical";
}

function latestTimestamp(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function baseRow(
  source: AgentGuardSourceCoverageSource,
  isConfiguredSource: boolean
): MutableCoverageRow {
  const sourceLooksLikeTest = sourceLooksLikeTestOrDemo(source);
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceEnvironment: source.environment,
    sourceStatus: source.status,
    isConfiguredSource,
    recentActivityCount: 0,
    policyOutcomeCount: 0,
    blockOutcomeCount: 0,
    reviewOutcomeCount: 0,
    needsActionReviewCount: 0,
    highOrCriticalRiskCount: 0,
    latestActivityAt: null,
    latestOutcomeAt: null,
    latestSignalAt: null,
    toolCounts: new Map(),
    userEmails: new Set(),
    sourceLooksLikeTest,
  };
}

function noteActivity(
  row: MutableCoverageRow,
  activity: AgentGuardSourceCoverageActivity
) {
  row.recentActivityCount += 1;
  row.toolCounts.set(
    activity.toolName,
    (row.toolCounts.get(activity.toolName) ?? 0) + 1
  );
  if (activity.userEmail.trim()) {
    row.userEmails.add(activity.userEmail.trim().toLowerCase());
  }
  if (isHighOrCritical(activity.riskLevel)) {
    row.highOrCriticalRiskCount += 1;
  }
  row.latestActivityAt = latestTimestamp(row.latestActivityAt, activity.timestamp);
  row.latestSignalAt = latestTimestamp(row.latestSignalAt, activity.timestamp);

  if (activity.blocked) {
    row.blockOutcomeCount += 1;
    row.policyOutcomeCount += 1;
    row.latestOutcomeAt = latestTimestamp(row.latestOutcomeAt, activity.timestamp);
    row.latestSignalAt = latestTimestamp(row.latestSignalAt, activity.timestamp);
  }
}

function noteReview(row: MutableCoverageRow, review: AgentGuardSourceCoverageReview) {
  row.reviewOutcomeCount += 1;
  row.policyOutcomeCount += 1;
  if (review.status === "open" || review.status === "investigating") {
    row.needsActionReviewCount += 1;
  }
  row.latestOutcomeAt = latestTimestamp(row.latestOutcomeAt, review.createdAt);
  row.latestSignalAt = latestTimestamp(row.latestSignalAt, review.createdAt);
}

function deriveCoverageStatus(row: MutableCoverageRow): AgentGuardSourceCoverageStatus {
  if (row.sourceStatus === "revoked") return "revoked";
  if (!row.isConfiguredSource) return "unknown_source";
  if (row.sourceLooksLikeTest) return "test_or_demo";
  if (row.recentActivityCount === 0) return "quiet";
  if (row.policyOutcomeCount === 0) return "needs_policy_scope";
  return "covered";
}

function guidanceForStatus(
  row: MutableCoverageRow,
  status: AgentGuardSourceCoverageStatus
): string {
  if (status === "revoked") {
    return "This source is revoked. Keep historical attribution for review, but future ingest should come from a replacement active source.";
  }
  if (status === "unknown_source") {
    return "Recent activity references a source id that is not in the loaded source catalog. Refresh sources or verify historical source retention before tuning policies.";
  }
  if (status === "test_or_demo") {
    return row.policyOutcomeCount > 0
      ? "This looks like a test or non-production source with policy outcomes. Keep its signal separate from production coverage decisions."
      : "This looks like a test or non-production source. Use it to prove the path, then confirm production sources separately.";
  }
  if (status === "quiet") {
    return "No recent source-attributed activity is loaded. Confirm the server-side wrapper is still sending events before judging policy coverage.";
  }
  if (status === "needs_policy_scope") {
    return "This source is sending activity but no recent policy outcomes were recorded. Review policy conditions, source tool scope, and expected data categories before expanding enforcement.";
  }
  if (row.needsActionReviewCount > 0) {
    return "Policy outcomes are recorded for this source. Work needs-action reviews and spot-check block decisions before broadening source scope.";
  }
  return "Policy outcomes are recorded for this source. Continue spot-checking outcomes before broadening source scope or enforcement.";
}

function finalizeRow(row: MutableCoverageRow): AgentGuardSourcePolicyCoverageRow {
  const coverageStatus = deriveCoverageStatus(row);
  const topTools = [...row.toolCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([tool]) => tool);

  return {
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceEnvironment: row.sourceEnvironment,
    sourceStatus: row.sourceStatus,
    isConfiguredSource: row.isConfiguredSource,
    coverageStatus,
    coverageLabel: STATUS_LABELS[coverageStatus],
    guidance: guidanceForStatus(row, coverageStatus),
    recentActivityCount: row.recentActivityCount,
    policyOutcomeCount: row.policyOutcomeCount,
    blockOutcomeCount: row.blockOutcomeCount,
    reviewOutcomeCount: row.reviewOutcomeCount,
    needsActionReviewCount: row.needsActionReviewCount,
    highOrCriticalRiskCount: row.highOrCriticalRiskCount,
    uniqueToolCount: row.toolCounts.size,
    uniqueUserCount: row.userEmails.size,
    latestActivityAt: row.latestActivityAt,
    latestOutcomeAt: row.latestOutcomeAt,
    latestSignalAt: row.latestSignalAt,
    topTools,
  };
}

function sortCoverageRows(
  left: AgentGuardSourcePolicyCoverageRow,
  right: AgentGuardSourcePolicyCoverageRow
): number {
  const priorityDelta =
    STATUS_PRIORITY[left.coverageStatus] - STATUS_PRIORITY[right.coverageStatus];
  if (priorityDelta !== 0) return priorityDelta;
  const leftTime = left.latestSignalAt ? Date.parse(left.latestSignalAt) : 0;
  const rightTime = right.latestSignalAt ? Date.parse(right.latestSignalAt) : 0;
  if (rightTime !== leftTime) return rightTime - leftTime;
  return left.sourceName.localeCompare(right.sourceName);
}

export function buildAgentGuardSourcePolicyCoverage(input: {
  sources: AgentGuardSourceCoverageSource[];
  activities: AgentGuardSourceCoverageActivity[];
  reviews: AgentGuardSourceCoverageReview[];
}): AgentGuardSourcePolicyCoverage {
  const rows = new Map<string, MutableCoverageRow>();
  const activityToSource = new Map<string, string>();

  for (const source of input.sources) {
    rows.set(source.id, baseRow(source, true));
  }

  for (const activity of input.activities) {
    const source = activity.source;
    const sourceId = source?.id?.trim();
    if (!sourceId) continue;
    activityToSource.set(activity.id, sourceId);

    if (!rows.has(sourceId)) {
      rows.set(
        sourceId,
        baseRow(
          {
            id: sourceId,
            name: source?.name || "Unknown source",
            environment: source?.environment || "unknown",
            status: "unknown",
          },
          false
        )
      );
    }
    const row = rows.get(sourceId);
    if (row) noteActivity(row, activity);
  }

  let unattributedReviewOutcomeCount = 0;
  for (const review of input.reviews) {
    const activityId = review.activityId?.trim();
    const sourceId = activityId ? activityToSource.get(activityId) : null;
    if (!sourceId) {
      unattributedReviewOutcomeCount += 1;
      continue;
    }
    const row = rows.get(sourceId);
    if (!row) {
      unattributedReviewOutcomeCount += 1;
      continue;
    }
    noteReview(row, review);
  }

  const finalRows = [...rows.values()].map(finalizeRow).sort(sortCoverageRows);
  const summary: AgentGuardSourcePolicyCoverageSummary = {
    configuredSourceCount: input.sources.length,
    activeSourceCount: input.sources.filter((source) => source.status === "active").length,
    recentActivitySourceCount: 0,
    policyOutcomeSourceCount: 0,
    needsPolicyScopeCount: 0,
    needsActionReviewCount: 0,
    testOrDemoSourceCount: 0,
    revokedSourceCount: 0,
    unknownSourceCount: 0,
    unattributedReviewOutcomeCount,
  };

  for (const row of finalRows) {
    if (row.recentActivityCount > 0) summary.recentActivitySourceCount += 1;
    if (row.policyOutcomeCount > 0) summary.policyOutcomeSourceCount += 1;
    if (row.coverageStatus === "needs_policy_scope") {
      summary.needsPolicyScopeCount += 1;
    }
    if (row.coverageStatus === "test_or_demo") {
      summary.testOrDemoSourceCount += 1;
    }
    if (row.coverageStatus === "revoked") {
      summary.revokedSourceCount += 1;
    }
    if (row.coverageStatus === "unknown_source") {
      summary.unknownSourceCount += 1;
    }
    summary.needsActionReviewCount += row.needsActionReviewCount;
  }

  return {
    rows: finalRows,
    summary,
  };
}
