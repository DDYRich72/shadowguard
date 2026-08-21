import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY,
  buildAgentGuardSourcePolicyCoverage,
  type AgentGuardSourceCoverageActivity,
  type AgentGuardSourceCoverageReview,
  type AgentGuardSourceCoverageSource,
} from "../source-policy-coverage";

function source(
  overrides: Partial<AgentGuardSourceCoverageSource> = {}
): AgentGuardSourceCoverageSource {
  return {
    id: "source-1",
    name: "Production wrapper",
    environment: "production",
    status: "active",
    allowedToolNames: [],
    ...overrides,
  };
}

function activity(
  overrides: Partial<AgentGuardSourceCoverageActivity> = {}
): AgentGuardSourceCoverageActivity {
  return {
    id: "activity-1",
    toolName: "ChatGPT",
    userEmail: "analyst@example.com",
    activityType: "prompt_sent",
    timestamp: "2026-05-16T12:00:00.000Z",
    riskLevel: "medium",
    blocked: false,
    blockedByPolicyId: null,
    source: { id: "source-1", name: "Production wrapper", environment: "production" },
    ...overrides,
  };
}

function review(
  overrides: Partial<AgentGuardSourceCoverageReview> = {}
): AgentGuardSourceCoverageReview {
  return {
    id: "review-1",
    activityId: "activity-1",
    policyId: "policy-1",
    policyName: "Regulated data review",
    policyAction: "warn",
    status: "open",
    riskLevel: "medium",
    createdAt: "2026-05-16T12:05:00.000Z",
    ...overrides,
  };
}

describe("AgentGuard source-to-policy coverage", () => {
  it("includes quiet configured sources", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [source()],
      activities: [],
      reviews: [],
    });

    expect(coverage.summary.configuredSourceCount).toBe(1);
    expect(coverage.rows).toHaveLength(1);
    expect(coverage.rows[0]).toMatchObject({
      sourceId: "source-1",
      coverageStatus: "quiet",
      recentActivityCount: 0,
      policyOutcomeCount: 0,
    });
  });

  it("counts activity, block outcomes, review outcomes, and needs-action reviews by source", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [source()],
      activities: [
        activity({
          id: "activity-1",
          blocked: true,
          blockedByPolicyId: "policy-block",
          riskLevel: "critical",
          timestamp: "2026-05-16T12:00:00.000Z",
        }),
        activity({
          id: "activity-2",
          toolName: "GitHub Copilot",
          userEmail: "Engineer@Example.com",
          riskLevel: "medium",
          timestamp: "2026-05-16T12:02:00.000Z",
        }),
      ],
      reviews: [
        review({ id: "review-1", activityId: "activity-2", status: "open" }),
        review({
          id: "review-2",
          activityId: "activity-2",
          policyAction: "quarantine",
          status: "resolved",
          createdAt: "2026-05-16T12:10:00.000Z",
        }),
      ],
    });

    expect(coverage.summary.recentActivitySourceCount).toBe(1);
    expect(coverage.summary.policyOutcomeSourceCount).toBe(1);
    expect(coverage.summary.needsActionReviewCount).toBe(1);
    expect(coverage.rows[0]).toMatchObject({
      coverageStatus: "covered",
      recentActivityCount: 2,
      policyOutcomeCount: 3,
      blockOutcomeCount: 1,
      reviewOutcomeCount: 2,
      needsActionReviewCount: 1,
      highOrCriticalRiskCount: 1,
      uniqueToolCount: 2,
      uniqueUserCount: 2,
      latestOutcomeAt: "2026-05-16T12:10:00.000Z",
      topTools: ["ChatGPT", "GitHub Copilot"],
    });
  });

  it("flags production sources with activity but no policy outcomes", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [source()],
      activities: [activity()],
      reviews: [],
    });

    expect(coverage.summary.needsPolicyScopeCount).toBe(1);
    expect(coverage.rows[0]?.coverageStatus).toBe("needs_policy_scope");
    expect(coverage.rows[0]?.guidance).toContain("no recent policy outcomes");
  });

  it("keeps test and revoked source guidance distinct", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [
        source({
          id: "source-dev",
          name: "Dashboard smoke test",
          environment: "development",
        }),
        source({
          id: "source-revoked",
          name: "Old wrapper",
          status: "revoked",
        }),
      ],
      activities: [
        activity({
          id: "activity-dev",
          source: {
            id: "source-dev",
            name: "Dashboard smoke test",
            environment: "development",
          },
        }),
        activity({
          id: "activity-revoked",
          source: {
            id: "source-revoked",
            name: "Old wrapper",
            environment: "production",
          },
        }),
      ],
      reviews: [],
    });

    expect(
      coverage.rows.find((row) => row.sourceId === "source-dev")?.coverageStatus
    ).toBe("test_or_demo");
    expect(
      coverage.rows.find((row) => row.sourceId === "source-revoked")?.coverageStatus
    ).toBe("revoked");
  });

  it("adds unknown source rows for source-attributed activity outside the loaded catalog", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [],
      activities: [
        activity({
          source: {
            id: "historical-source",
            name: "Historical wrapper",
            environment: "production",
          },
        }),
      ],
      reviews: [],
    });

    expect(coverage.summary.unknownSourceCount).toBe(1);
    expect(coverage.rows[0]).toMatchObject({
      sourceId: "historical-source",
      isConfiguredSource: false,
      coverageStatus: "unknown_source",
    });
  });

  it("does not guess source attribution for uncorrelated review rows", () => {
    const coverage = buildAgentGuardSourcePolicyCoverage({
      sources: [source()],
      activities: [activity({ id: "activity-1" })],
      reviews: [review({ activityId: "activity-outside-window" })],
    });

    expect(coverage.summary.unattributedReviewOutcomeCount).toBe(1);
    expect(coverage.rows[0]?.reviewOutcomeCount).toBe(0);
  });

  it("keeps copy grounded in deterministic submitted-activity guidance", () => {
    const text = Object.values(AGENT_GUARD_SOURCE_POLICY_COVERAGE_COPY).join(" ");

    expect(text).toContain("submitted source activity");
    expect(text).toContain("does not automatically monitor tools");
    expect(text).toContain("change policies");
    expect(text).toContain("AI recommendations");
  });
});
