import type { PolicyAction, RiskLevel } from "./engine";
import type {
  AgentPolicyDecisionReviewStatus,
  ReviewablePolicyAction,
} from "./policy-reviews";

export type PolicyOutcomeAnalyticsPolicy = {
  id: string;
  name: string;
  action: PolicyAction;
  enabled: boolean;
  priority: number;
};

export type PolicyOutcomeAnalyticsActivity = {
  id: string;
  blocked: boolean;
  blockedByPolicyId?: string | null;
  toolName: string;
  userEmail: string;
  riskLevel: RiskLevel | string;
  timestamp: string;
};

export type PolicyOutcomeAnalyticsReview = {
  id: string;
  policyId: string | null;
  policyName: string;
  policyAction: ReviewablePolicyAction;
  status: AgentPolicyDecisionReviewStatus;
  toolName: string;
  userEmail: string;
  riskLevel: RiskLevel | string;
  createdAt: string;
};

export type PolicyTuningSignalKind =
  | "no_recent_signal"
  | "active_blocking"
  | "review_backlog"
  | "review_flow"
  | "legacy_policy"
  | "steady";

export type PolicyOutcomeAnalyticsRow = {
  policyId: string;
  policyName: string;
  action: PolicyAction | ReviewablePolicyAction;
  enabled: boolean;
  priority: number;
  isLegacyPolicy: boolean;
  blockMatches: number;
  reviewMatches: number;
  warnMatches: number;
  quarantineMatches: number;
  openReviews: number;
  investigatingReviews: number;
  resolvedReviews: number;
  dismissedReviews: number;
  needsActionReviews: number;
  highOrCriticalRiskMatches: number;
  uniqueTools: number;
  uniqueUsers: number;
  latestSignalAt: string | null;
  totalOutcomes: number;
  topTools: string[];
  tuningSignalKind: PolicyTuningSignalKind;
  tuningSignal: string;
};

export type PolicyOutcomeAnalyticsSummary = {
  policyCount: number;
  enabledPolicyCount: number;
  totalOutcomes: number;
  blockOutcomes: number;
  reviewOutcomes: number;
  needsActionReviews: number;
  policiesWithOutcomes: number;
  noisyPolicyCount: number;
  legacyPolicyCount: number;
};

export type PolicyOutcomeAnalytics = {
  rows: PolicyOutcomeAnalyticsRow[];
  summary: PolicyOutcomeAnalyticsSummary;
};

type MutablePolicyOutcomeRow = Omit<
  PolicyOutcomeAnalyticsRow,
  | "uniqueTools"
  | "uniqueUsers"
  | "topTools"
  | "tuningSignalKind"
  | "tuningSignal"
> & {
  toolCounts: Map<string, number>;
  userEmails: Set<string>;
};

function baseRow(input: {
  policyId: string;
  policyName: string;
  action: PolicyOutcomeAnalyticsRow["action"];
  enabled: boolean;
  priority: number;
  isLegacyPolicy?: boolean;
}): MutablePolicyOutcomeRow {
  return {
    policyId: input.policyId,
    policyName: input.policyName,
    action: input.action,
    enabled: input.enabled,
    priority: input.priority,
    isLegacyPolicy: input.isLegacyPolicy ?? false,
    blockMatches: 0,
    reviewMatches: 0,
    warnMatches: 0,
    quarantineMatches: 0,
    openReviews: 0,
    investigatingReviews: 0,
    resolvedReviews: 0,
    dismissedReviews: 0,
    needsActionReviews: 0,
    highOrCriticalRiskMatches: 0,
    latestSignalAt: null,
    totalOutcomes: 0,
    toolCounts: new Map(),
    userEmails: new Set(),
  };
}

function isHighRisk(value: RiskLevel | string): boolean {
  return value === "high" || value === "critical";
}

function noteSignal(
  row: MutablePolicyOutcomeRow,
  input: {
    toolName: string;
    userEmail: string;
    riskLevel: RiskLevel | string;
    timestamp: string;
  }
) {
  row.toolCounts.set(input.toolName, (row.toolCounts.get(input.toolName) ?? 0) + 1);
  row.userEmails.add(input.userEmail);
  if (isHighRisk(input.riskLevel)) row.highOrCriticalRiskMatches += 1;

  if (
    !row.latestSignalAt ||
    Date.parse(input.timestamp) > Date.parse(row.latestSignalAt)
  ) {
    row.latestSignalAt = input.timestamp;
  }
}

function legacyPolicyIdFor(review: PolicyOutcomeAnalyticsReview): string {
  return `legacy:${review.policyAction}:${review.policyName}`;
}

function finalizeRow(row: MutablePolicyOutcomeRow): PolicyOutcomeAnalyticsRow {
  row.totalOutcomes = row.blockMatches + row.reviewMatches;
  row.needsActionReviews = row.openReviews + row.investigatingReviews;
  const topTools = [...row.toolCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([tool]) => tool);
  const { kind, message } = deriveTuningSignal(row);

  return {
    policyId: row.policyId,
    policyName: row.policyName,
    action: row.action,
    enabled: row.enabled,
    priority: row.priority,
    isLegacyPolicy: row.isLegacyPolicy,
    blockMatches: row.blockMatches,
    reviewMatches: row.reviewMatches,
    warnMatches: row.warnMatches,
    quarantineMatches: row.quarantineMatches,
    openReviews: row.openReviews,
    investigatingReviews: row.investigatingReviews,
    resolvedReviews: row.resolvedReviews,
    dismissedReviews: row.dismissedReviews,
    needsActionReviews: row.needsActionReviews,
    highOrCriticalRiskMatches: row.highOrCriticalRiskMatches,
    uniqueTools: row.toolCounts.size,
    uniqueUsers: row.userEmails.size,
    latestSignalAt: row.latestSignalAt,
    totalOutcomes: row.totalOutcomes,
    topTools,
    tuningSignalKind: kind,
    tuningSignal: message,
  };
}

function deriveTuningSignal(row: MutablePolicyOutcomeRow): {
  kind: PolicyTuningSignalKind;
  message: string;
} {
  if (row.isLegacyPolicy) {
    return {
      kind: "legacy_policy",
      message:
        "Historical review outcomes reference a deleted or changed policy. Keep them for context; recreate the rule only if current coverage still needs it.",
    };
  }

  if (row.blockMatches >= 5) {
    return {
      kind: "active_blocking",
      message:
        "This block policy is firing often. Spot-check recent outcomes and confirm each source integration honors blocked decisions.",
    };
  }

  if (row.blockMatches > 0) {
    return {
      kind: "active_blocking",
      message:
        "Recent block outcomes exist. Confirm they match the intended policy scope before broadening the rule.",
    };
  }

  if (row.needsActionReviews >= 5 || row.reviewMatches >= 10) {
    return {
      kind: "review_backlog",
      message:
        "Review volume is building. Consider narrowing by source, tool, data category, or pilot group before expanding this rule.",
    };
  }

  if (row.reviewMatches > 0) {
    return {
      kind: "review_flow",
      message:
        "Review outcomes are flowing. Work open items and compare dismissal patterns before changing the rule.",
    };
  }

  if (row.enabled) {
    return {
      kind: "no_recent_signal",
      message:
        "No recent outcomes in the loaded window. Keep or tune this policy based on intended coverage, not this quiet sample alone.",
    };
  }

  return {
    kind: "steady",
    message:
      "Disabled or quiet policy. Enable only when the source, tool scope, and expected review load are clear.",
  };
}

function sortRows(
  left: PolicyOutcomeAnalyticsRow,
  right: PolicyOutcomeAnalyticsRow
): number {
  if (right.totalOutcomes !== left.totalOutcomes) {
    return right.totalOutcomes - left.totalOutcomes;
  }
  if (right.needsActionReviews !== left.needsActionReviews) {
    return right.needsActionReviews - left.needsActionReviews;
  }
  if (left.isLegacyPolicy !== right.isLegacyPolicy) {
    return left.isLegacyPolicy ? 1 : -1;
  }
  return left.priority - right.priority || left.policyName.localeCompare(right.policyName);
}

export function buildPolicyOutcomeAnalytics(input: {
  policies: PolicyOutcomeAnalyticsPolicy[];
  activities: PolicyOutcomeAnalyticsActivity[];
  reviews: PolicyOutcomeAnalyticsReview[];
}): PolicyOutcomeAnalytics {
  const rows = new Map<string, MutablePolicyOutcomeRow>();

  for (const policy of input.policies) {
    rows.set(
      policy.id,
      baseRow({
        policyId: policy.id,
        policyName: policy.name,
        action: policy.action,
        enabled: policy.enabled,
        priority: policy.priority,
      })
    );
  }

  for (const activity of input.activities) {
    if (!activity.blocked || !activity.blockedByPolicyId) continue;
    const key = activity.blockedByPolicyId;
    if (!rows.has(key)) {
      rows.set(
        key,
        baseRow({
          policyId: key,
          policyName: "Deleted or unavailable block policy",
          action: "block",
          enabled: false,
          priority: Number.MAX_SAFE_INTEGER,
          isLegacyPolicy: true,
        })
      );
    }
    const row = rows.get(key);
    if (!row) continue;
    row.blockMatches += 1;
    noteSignal(row, activity);
  }

  for (const review of input.reviews) {
    const key = review.policyId ?? legacyPolicyIdFor(review);
    if (!rows.has(key)) {
      rows.set(
        key,
        baseRow({
          policyId: key,
          policyName: review.policyName || "Deleted or unavailable review policy",
          action: review.policyAction,
          enabled: false,
          priority: Number.MAX_SAFE_INTEGER,
          isLegacyPolicy: true,
        })
      );
    }
    const row = rows.get(key);
    if (!row) continue;
    row.reviewMatches += 1;
    if (review.policyAction === "warn") row.warnMatches += 1;
    if (review.policyAction === "quarantine") row.quarantineMatches += 1;
    row[`${review.status}Reviews`] += 1;
    noteSignal(row, {
      toolName: review.toolName,
      userEmail: review.userEmail,
      riskLevel: review.riskLevel,
      timestamp: review.createdAt,
    });
  }

  const finalRows = [...rows.values()].map(finalizeRow).sort(sortRows);
  const summary: PolicyOutcomeAnalyticsSummary = {
    policyCount: input.policies.length,
    enabledPolicyCount: input.policies.filter((policy) => policy.enabled).length,
    totalOutcomes: 0,
    blockOutcomes: 0,
    reviewOutcomes: 0,
    needsActionReviews: 0,
    policiesWithOutcomes: 0,
    noisyPolicyCount: 0,
    legacyPolicyCount: 0,
  };

  for (const row of finalRows) {
    summary.totalOutcomes += row.totalOutcomes;
    summary.blockOutcomes += row.blockMatches;
    summary.reviewOutcomes += row.reviewMatches;
    summary.needsActionReviews += row.needsActionReviews;
    if (row.totalOutcomes > 0) summary.policiesWithOutcomes += 1;
    if (row.tuningSignalKind === "review_backlog") summary.noisyPolicyCount += 1;
    if (row.isLegacyPolicy) summary.legacyPolicyCount += 1;
  }

  return {
    rows: finalRows,
    summary,
  };
}
