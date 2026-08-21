import { describe, expect, it } from "vitest";
import {
  buildOnboardingProgress,
  type OnboardingMetrics,
} from "../onboarding";

function metrics(overrides: Partial<OnboardingMetrics> = {}): OnboardingMetrics {
  return {
    googleConnected: false,
    microsoftConnected: false,
    aiSystemsCount: 0,
    completedAssessmentsCount: 0,
    controlsCount: 0,
    completedOrWaivedControlsCount: 0,
    evidenceCount: 0,
    snapshotsCount: 0,
    finalSnapshotsCount: 0,
    pdfSnapshotsCount: 0,
    deliveryLinksCount: 0,
    firstSystemId: null,
    ...overrides,
  };
}

describe("onboarding progress", () => {
  it("starts with inventory intake for a new organization", () => {
    const progress = buildOnboardingProgress(metrics());

    expect(progress.completedSteps).toBe(0);
    expect(progress.percentComplete).toBe(0);
    expect(progress.nextStep).toMatchObject({
      id: "intake",
      href: "/dashboard/ai-systems/import",
      status: "current",
      actionLabel: "Import inventory",
    });
  });

  it("moves from intake to inventory when a provider is connected", () => {
    const progress = buildOnboardingProgress(
      metrics({
        googleConnected: true,
      })
    );

    expect(progress.completedSteps).toBe(1);
    expect(progress.nextStep).toMatchObject({
      id: "inventory",
      href: "/dashboard/ai-systems/new",
      actionLabel: "Create AI System",
    });
  });

  it("links assessment to the first system when inventory exists", () => {
    const progress = buildOnboardingProgress(
      metrics({
        googleConnected: true,
        aiSystemsCount: 1,
        firstSystemId: "system-1",
      })
    );

    expect(progress.nextStep).toMatchObject({
      id: "assessment",
      href: "/dashboard/ai-systems/system-1/assessment",
    });
  });

  it("treats a saved snapshot and delivery artifact as the final steps", () => {
    const progress = buildOnboardingProgress(
      metrics({
        googleConnected: true,
        aiSystemsCount: 3,
        completedAssessmentsCount: 2,
        controlsCount: 6,
        completedOrWaivedControlsCount: 3,
        evidenceCount: 2,
        snapshotsCount: 1,
        finalSnapshotsCount: 1,
        pdfSnapshotsCount: 1,
        deliveryLinksCount: 1,
      })
    );

    expect(progress.completedSteps).toBe(progress.totalSteps);
    expect(progress.percentComplete).toBe(100);
    expect(progress.nextStep).toMatchObject({
      id: "delivery",
      status: "complete",
    });
  });

  it("does not surface commercial warnings", () => {
    const progress = buildOnboardingProgress(metrics());

    expect(progress.warnings).toEqual([]);
    expect(progress.steps.some((step) => step.status === "needs_attention")).toBe(false);
  });
});
