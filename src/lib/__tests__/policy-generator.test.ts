import { describe, expect, it } from "vitest";
import {
  POLICY_GENERATOR_BOUNDARY_COPY,
  buildPolicyDraftSourceSummary,
  generatePolicyDraft,
} from "../policy-generator";

const baseBody = {
  orgName: "Example Organization",
  industry: "general",
  riskTolerance: "balanced" as const,
  approvedTools: [],
  blockedTools: [],
};

describe("policy generator draft helper", () => {
  it("generates truthful manual-input draft copy when no tools are supplied", () => {
    const draft = generatePolicyDraft(
      baseBody,
      new Date("2026-05-22T12:00:00.000Z")
    );

    expect(draft.markdown).toContain("# AI Usage Policy Draft");
    expect(draft.markdown).toContain("Organization:** Example Organization");
    expect(draft.markdown).toContain("Input source:** Manual/request-provided inputs only");
    expect(draft.markdown).toContain(POLICY_GENERATOR_BOUNDARY_COPY.draftOnly);
    expect(draft.markdown).toContain(POLICY_GENERATOR_BOUNDARY_COPY.manualInputOnly);
    expect(draft.markdown).toContain("No approved tools were provided to this draft.");
    expect(draft.markdown).toContain("No blocked tools were provided to this draft.");
    expect(draft.markdown).toContain("Data-Backed Generation Path");
    expect(draft.markdown).not.toContain("Complete a scan first");
    expect(draft.markdown).not.toContain("certified compliant");
  });

  it("summarizes current data posture as manual and not server-loaded", () => {
    const summary = buildPolicyDraftSourceSummary({
      approvedTools: [
        {
          appName: "ChatGPT Team",
          category: "AI Assistant",
          riskLevel: "medium",
        },
      ],
      blockedTools: [{ appName: "Unknown AI Tool", reason: "No vendor review" }],
    });

    expect(summary).toMatchObject({
      inputMode: "manual_request",
      approvedToolCount: 1,
      blockedToolCount: 1,
      serverLoadedScanData: false,
      dataBackedGenerationReady: false,
    });
    expect(summary.limitations).toContain("No server-side scan result loading");
  });

  it("uses healthcare and legal review language without claiming compliance", () => {
    const healthcare = generatePolicyDraft({
      ...baseBody,
      industry: "healthcare",
    }).markdown;
    const legal = generatePolicyDraft({
      ...baseBody,
      industry: "legal",
    }).markdown;

    expect(healthcare).toContain("Healthcare review");
    expect(healthcare).toContain("Business Associate Agreement review");
    expect(healthcare).not.toContain("HIPAA Compliance Required");

    expect(legal).toContain("Legal practice review");
    expect(legal).toContain("attorney work-product");
    expect(legal).not.toContain("Attorney-Client Privilege Protected");
  });
});
