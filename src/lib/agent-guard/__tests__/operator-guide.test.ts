import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_OPERATOR_GUIDE_COPY,
  AGENT_GUARD_OPERATOR_GUIDE_PHASES,
  AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS,
  AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING,
  agentGuardOperatorGuideCounts,
  flattenAgentGuardOperatorGuideSteps,
} from "../operator-guide";

describe("AgentGuard operator guide", () => {
  it("defines the expected streamlined workflow phases", () => {
    expect(AGENT_GUARD_OPERATOR_GUIDE_PHASES.map((phase) => phase.id)).toEqual([
      "orient",
      "connect",
      "tune",
      "prove",
      "integrate",
    ]);
  });

  it("defines complete guide steps with routes, evidence, and guardrails", () => {
    const steps = flattenAgentGuardOperatorGuideSteps();
    expect(steps.length).toBeGreaterThanOrEqual(10);

    for (const step of steps) {
      expect(step.id.length).toBeGreaterThan(3);
      expect(step.label.length).toBeGreaterThan(5);
      expect(step.goal.length).toBeGreaterThan(20);
      expect(step.href).toMatch(/^\/dashboard\/agent-guard/);
      expect(step.cta.length).toBeGreaterThan(5);
      expect(step.evidence.length).toBeGreaterThan(20);
      expect(step.guardrail.length).toBeGreaterThan(20);
    }
  });

  it("defines quick-start shortcuts and troubleshooting notes", () => {
    expect(AGENT_GUARD_OPERATOR_GUIDE_SHORTCUTS).toHaveLength(3);
    expect(AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING.length).toBeGreaterThanOrEqual(5);
    expect(agentGuardOperatorGuideCounts()).toEqual({
      phases: 5,
      steps: flattenAgentGuardOperatorGuideSteps().length,
      shortcuts: 3,
      troubleshootingNotes: AGENT_GUARD_OPERATOR_GUIDE_TROUBLESHOOTING.length,
    });
  });

  it("keeps guide claims conservative and read-only", () => {
    const text = `${AGENT_GUARD_OPERATOR_GUIDE_COPY.boundary}\n${JSON.stringify(
      AGENT_GUARD_OPERATOR_GUIDE_PHASES
    )}`;

    expect(text).toContain("read-only workflow support");
    expect(text).toContain("submitted activity");
    expect(text).toContain("does not create source keys");
    expect(text).toContain("send test events");
    expect(text).toContain("change policies");
    expect(text).toContain("mutate reviews");
    expect(text).toContain("change export settings");
    expect(text).toContain("save evidence packets");
    expect(text).toContain("create acknowledgements");
    expect(text).toContain("expand enforcement");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not automatic policy tuning");
    expect(text).toContain("native managed vendor connectors are not shipped");
    expect(text).not.toContain("automatically starts monitoring");
    expect(text).not.toContain("managed connector is available");
    expect(text).not.toContain("certifies compliance");
  });
});
