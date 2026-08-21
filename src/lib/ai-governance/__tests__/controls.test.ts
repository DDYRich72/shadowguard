import { describe, expect, it } from "vitest";
import {
  buildControlTaskSeeds,
  calculateControlReadiness,
  isClosedControl,
} from "../controls";

describe("AI governance controls", () => {
  it("calculates readiness from completed and waived controls", () => {
    const readiness = calculateControlReadiness([
      { status: "completed" },
      { status: "waived" },
      { status: "in_progress" },
      { status: "not_started" },
    ]);

    expect(readiness.total).toBe(4);
    expect(readiness.closed).toBe(2);
    expect(readiness.open).toBe(2);
    expect(readiness.readinessPercent).toBe(50);
  });

  it("treats no controls as ready", () => {
    expect(calculateControlReadiness([]).readinessPercent).toBe(100);
  });

  it("knows which statuses close a control", () => {
    expect(isClosedControl("completed")).toBe(true);
    expect(isClosedControl("waived")).toBe(true);
    expect(isClosedControl("in_progress")).toBe(false);
    expect(isClosedControl("not_started")).toBe(false);
  });

  it("normalizes recommended controls into task seeds", () => {
    const seeds = buildControlTaskSeeds({
      orgId: "org-1",
      aiSystemId: "system-1",
      assessmentId: "assessment-1",
      controls: [
        {
          key: "owner-assigned",
          title: "Assign owner",
          category: "Ownership",
          reason: "Every system needs an owner.",
          priority: "required",
        },
      ],
    });

    expect(seeds).toEqual([
      {
        org_id: "org-1",
        ai_system_id: "system-1",
        control_key: "owner-assigned",
        title: "Assign owner",
        category: "Ownership",
        priority: "required",
        reason: "Every system needs an owner.",
        framework_mappings: expect.arrayContaining([
          expect.objectContaining({ framework: "nist_ai_rmf" }),
          expect.objectContaining({ framework: "iso_42001" }),
        ]),
        source_assessment_id: "assessment-1",
      },
    ]);
  });
});
