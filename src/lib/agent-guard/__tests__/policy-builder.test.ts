import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY_TEST_SAMPLE,
  draftToPolicyBody,
  evaluatePolicyDraft,
  formatPolicyCondition,
  type PolicyDraft,
} from "../policy-builder";

const baseDraft: PolicyDraft = {
  name: "Block restricted data",
  description: "Blocks restricted submissions.",
  enabled: true,
  priority: 2,
  action: "block",
  conditions: [
    {
      field: "sensitivity",
      operator: "equals",
      value: "restricted",
    },
  ],
};

describe("formatPolicyCondition", () => {
  it("formats scalar conditions", () => {
    expect(
      formatPolicyCondition({
        field: "sensitivity",
        operator: "equals",
        value: "restricted",
      })
    ).toBe('Data sensitivity is "restricted"');
  });

  it("formats array conditions", () => {
    expect(
      formatPolicyCondition({
        field: "toolName",
        operator: "in",
        value: ["ChatGPT", "Claude"],
      })
    ).toBe('Tool is one of "ChatGPT, Claude"');
  });
});

describe("draftToPolicyBody", () => {
  it("trims fields and serializes simple values", () => {
    const body = draftToPolicyBody({
      ...baseDraft,
      name: "  Block secrets  ",
      description: "  demo  ",
    });

    expect(body.name).toBe("Block secrets");
    expect(body.description).toBe("demo");
    expect(body.conditions[0]).toEqual({
      field: "sensitivity",
      operator: "equals",
      value: "restricted",
    });
  });

  it("serializes comma-separated in values to arrays", () => {
    const body = draftToPolicyBody({
      ...baseDraft,
      conditions: [
        {
          field: "toolName",
          operator: "in",
          value: "ChatGPT, Claude,  Gemini ",
        },
      ],
    });

    expect(body.conditions[0].value).toEqual(["ChatGPT", "Claude", "Gemini"]);
  });
});

describe("evaluatePolicyDraft", () => {
  it("returns a match and action for matching sample activity", () => {
    const result = evaluatePolicyDraft(baseDraft, DEFAULT_POLICY_TEST_SAMPLE);

    expect(result.matched).toBe(true);
    expect(result.action).toBe("block");
    expect(result.summary).toContain("block");
  });

  it("returns no match for non-matching sample activity", () => {
    const result = evaluatePolicyDraft(baseDraft, {
      ...DEFAULT_POLICY_TEST_SAMPLE,
      sensitivity: "public",
      riskLevel: "low",
      categories: [],
    });

    expect(result.matched).toBe(false);
    expect(result.action).toBeNull();
  });

  it("does not match disabled drafts", () => {
    const result = evaluatePolicyDraft(
      {
        ...baseDraft,
        enabled: false,
      },
      DEFAULT_POLICY_TEST_SAMPLE
    );

    expect(result.matched).toBe(false);
  });
});
