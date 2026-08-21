import { describe, expect, it } from "vitest";
import {
  POLICY_ACTION_OPTIONS,
  POLICY_FIELD_OPTIONS,
  POLICY_OPERATOR_OPTIONS,
} from "../policy-builder";
import {
  AGENT_GUARD_POLICY_ACTION_GUIDE,
  AGENT_GUARD_POLICY_TEMPLATES,
  POLICY_TEMPLATE_CATEGORY_LABELS,
  policyTemplateToDraft,
  policyTemplatesByCategory,
} from "../policy-templates";

const supportedActions = new Set(POLICY_ACTION_OPTIONS.map((option) => option.value));
const supportedFields = new Set(POLICY_FIELD_OPTIONS.map((option) => option.value));
const supportedOperators = new Set(POLICY_OPERATOR_OPTIONS.map((option) => option.value));

describe("AgentGuard policy templates", () => {
  it("has unique, complete templates for expected starter use cases", () => {
    const ids = AGENT_GUARD_POLICY_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(AGENT_GUARD_POLICY_TEMPLATES.map((template) => template.category)).toEqual(
      expect.arrayContaining([
        "credential_exposure",
        "regulated_data",
        "file_handling",
        "critical_risk",
        "approved_use",
        "usage_review",
      ])
    );

    for (const template of AGENT_GUARD_POLICY_TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.categoryLabel).toBe(POLICY_TEMPLATE_CATEGORY_LABELS[template.category]);
      expect(template.summary).toBeTruthy();
      expect(template.guidance).toBeTruthy();
      expect(template.safetyNote).toBeTruthy();
      expect(template.conditions.length).toBeGreaterThan(0);
    }
  });

  it("only uses supported policy actions, fields, and operators", () => {
    for (const template of AGENT_GUARD_POLICY_TEMPLATES) {
      expect(supportedActions.has(template.action)).toBe(true);
      for (const condition of template.conditions) {
        expect(supportedFields.has(condition.field)).toBe(true);
        expect(supportedOperators.has(condition.operator)).toBe(true);
        expect(condition.value.trim()).not.toBe("");
      }
    }
  });

  it("keeps broad templates review-oriented and clearly caveated", () => {
    const broadTemplates = AGENT_GUARD_POLICY_TEMPLATES.filter(
      (template) => template.broadMatch
    );
    expect(broadTemplates.length).toBeGreaterThan(0);

    for (const template of broadTemplates) {
      expect(["warn", "quarantine"]).toContain(template.action);
      expect(template.safetyNote.toLowerCase()).toMatch(/review|tune|scop/);
    }
  });

  it("converts templates into editable policy drafts without sharing condition references", () => {
    const template = AGENT_GUARD_POLICY_TEMPLATES[0];
    const draft = policyTemplateToDraft(template);

    expect(draft).toMatchObject({
      name: template.name,
      enabled: template.enabled,
      priority: template.priority,
      action: template.action,
    });
    expect(draft.description).toContain(template.summary);
    expect(draft.conditions).toEqual(template.conditions);

    draft.conditions[0].value = "changed";
    expect(template.conditions[0].value).not.toBe("changed");
  });

  it("groups templates by catalog category labels", () => {
    const groups = policyTemplatesByCategory();

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((group) => group.templates)).toHaveLength(
      AGENT_GUARD_POLICY_TEMPLATES.length
    );
    for (const group of groups) {
      expect(group.label).toBe(POLICY_TEMPLATE_CATEGORY_LABELS[group.category]);
    }
  });
});

describe("AgentGuard policy action guide", () => {
  it("documents shipped behavior for every policy action", () => {
    expect(AGENT_GUARD_POLICY_ACTION_GUIDE.map((item) => item.action)).toEqual(
      ["block", "warn", "quarantine", "allow"]
    );

    for (const item of AGENT_GUARD_POLICY_ACTION_GUIDE) {
      expect(item.summary).toBeTruthy();
      expect(item.shippedBehavior).toBeTruthy();
      expect(item.safetyNote).toBeTruthy();
    }
  });

  it("does not imply automatic third-party quarantine enforcement", () => {
    const text = AGENT_GUARD_POLICY_ACTION_GUIDE.map((item) =>
      `${item.summary} ${item.shippedBehavior} ${item.safetyNote}`
    ).join("\n");

    expect(text).toContain("not an automatic third-party file hold");
    expect(text).toContain("customer integration must enforce");
  });
});
