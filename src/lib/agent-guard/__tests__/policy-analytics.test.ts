import { describe, expect, it } from "vitest";
import { buildPolicyOutcomeAnalytics } from "../policy-analytics";
import type {
  PolicyOutcomeAnalyticsActivity,
  PolicyOutcomeAnalyticsPolicy,
  PolicyOutcomeAnalyticsReview,
} from "../policy-analytics";

const policies: PolicyOutcomeAnalyticsPolicy[] = [
  {
    id: "block-credentials",
    name: "Block credentials",
    action: "block",
    enabled: true,
    priority: 1,
  },
  {
    id: "warn-pii",
    name: "Warn on PII",
    action: "warn",
    enabled: true,
    priority: 2,
  },
  {
    id: "quiet-policy",
    name: "Quiet policy",
    action: "quarantine",
    enabled: true,
    priority: 3,
  },
];

function activity(
  override: Partial<PolicyOutcomeAnalyticsActivity>
): PolicyOutcomeAnalyticsActivity {
  return {
    id: "activity",
    blocked: false,
    blockedByPolicyId: null,
    toolName: "ChatGPT",
    userEmail: "user@example.com",
    riskLevel: "low",
    timestamp: "2026-05-16T12:00:00.000Z",
    ...override,
  };
}

function review(
  override: Partial<PolicyOutcomeAnalyticsReview>
): PolicyOutcomeAnalyticsReview {
  return {
    id: "review",
    policyId: "warn-pii",
    policyName: "Warn on PII",
    policyAction: "warn",
    status: "open",
    toolName: "ChatGPT",
    userEmail: "user@example.com",
    riskLevel: "medium",
    createdAt: "2026-05-16T12:00:00.000Z",
    ...override,
  };
}

describe("AgentGuard policy outcome analytics", () => {
  it("counts block outcomes by blocked policy id", () => {
    const analytics = buildPolicyOutcomeAnalytics({
      policies,
      activities: [
        activity({
          id: "a1",
          blocked: true,
          blockedByPolicyId: "block-credentials",
          riskLevel: "critical",
        }),
        activity({
          id: "a2",
          blocked: true,
          blockedByPolicyId: "block-credentials",
          toolName: "Claude",
        }),
      ],
      reviews: [],
    });

    const row = analytics.rows.find((item) => item.policyId === "block-credentials");
    expect(row?.blockMatches).toBe(2);
    expect(row?.totalOutcomes).toBe(2);
    expect(row?.uniqueTools).toBe(2);
    expect(row?.highOrCriticalRiskMatches).toBe(1);
    expect(row?.tuningSignalKind).toBe("active_blocking");
    expect(analytics.summary.blockOutcomes).toBe(2);
  });

  it("counts warn and quarantine review outcomes by policy", () => {
    const analytics = buildPolicyOutcomeAnalytics({
      policies,
      activities: [],
      reviews: [
        review({ id: "r1", status: "open" }),
        review({ id: "r2", status: "investigating", toolName: "Copilot" }),
        review({
          id: "r3",
          policyId: "quiet-policy",
          policyName: "Quiet policy",
          policyAction: "quarantine",
          status: "resolved",
          riskLevel: "high",
        }),
      ],
    });

    const warnRow = analytics.rows.find((item) => item.policyId === "warn-pii");
    const quarantineRow = analytics.rows.find((item) => item.policyId === "quiet-policy");

    expect(warnRow?.reviewMatches).toBe(2);
    expect(warnRow?.warnMatches).toBe(2);
    expect(warnRow?.needsActionReviews).toBe(2);
    expect(quarantineRow?.quarantineMatches).toBe(1);
    expect(quarantineRow?.resolvedReviews).toBe(1);
    expect(quarantineRow?.highOrCriticalRiskMatches).toBe(1);
    expect(analytics.summary.reviewOutcomes).toBe(3);
    expect(analytics.summary.needsActionReviews).toBe(2);
  });

  it("flags review backlog without presenting it as AI-generated advice", () => {
    const reviews = Array.from({ length: 6 }, (_, index) =>
      review({
        id: `r${index}`,
        status: index % 2 === 0 ? "open" : "investigating",
        userEmail: `user${index}@example.com`,
      })
    );

    const analytics = buildPolicyOutcomeAnalytics({
      policies,
      activities: [],
      reviews,
    });

    const row = analytics.rows.find((item) => item.policyId === "warn-pii");
    expect(row?.tuningSignalKind).toBe("review_backlog");
    expect(row?.tuningSignal).toContain("Consider narrowing");
    expect(row?.tuningSignal).not.toContain("AI");
    expect(analytics.summary.noisyPolicyCount).toBe(1);
  });

  it("keeps deleted or legacy review rows visible", () => {
    const analytics = buildPolicyOutcomeAnalytics({
      policies,
      activities: [],
      reviews: [
        review({
          id: "legacy",
          policyId: null,
          policyName: "Deleted warning policy",
          policyAction: "warn",
        }),
      ],
    });

    const legacy = analytics.rows.find((row) => row.isLegacyPolicy);
    expect(legacy?.policyName).toBe("Deleted warning policy");
    expect(legacy?.reviewMatches).toBe(1);
    expect(legacy?.tuningSignalKind).toBe("legacy_policy");
    expect(analytics.summary.legacyPolicyCount).toBe(1);
  });

  it("keeps quiet enabled policies in the analytics table", () => {
    const analytics = buildPolicyOutcomeAnalytics({
      policies,
      activities: [],
      reviews: [],
    });

    const quiet = analytics.rows.find((row) => row.policyId === "quiet-policy");
    expect(quiet?.totalOutcomes).toBe(0);
    expect(quiet?.tuningSignalKind).toBe("no_recent_signal");
    expect(analytics.summary.policiesWithOutcomes).toBe(0);
  });
});
