import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_PILOT_ARTIFACTS,
  AGENT_GUARD_PILOT_ENTRY_CRITERIA,
  AGENT_GUARD_PILOT_EXIT_CRITERIA,
  AGENT_GUARD_PILOT_PHASES,
  AGENT_GUARD_PILOT_TIMELINES,
  buildAgentGuardEnterprisePilotPackage,
  agentGuardEnterprisePilotCounts,
} from "../enterprise-pilot-package";
import { AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT } from "../production-operations";

describe("AgentGuard enterprise pilot package", () => {
  it("defines 7-day and 14-day pilot tracks", () => {
    const packageData = buildAgentGuardEnterprisePilotPackage();

    expect(packageData.timelines.map((timeline) => timeline.id)).toEqual([
      "seven_day",
      "fourteen_day",
    ]);
    expect(packageData.timelines[0].label).toContain("7-day");
    expect(packageData.timelines[1].label).toContain("14-day");
    expect(packageData.timelines.every((timeline) => timeline.cadence.length > 0)).toBe(
      true
    );
  });

  it("anchors the pilot to the canonical production endpoint", () => {
    const packageData = buildAgentGuardEnterprisePilotPackage();

    expect(packageData.endpoint).toBe(AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url);
    expect(packageData.auth).toBe("Authorization: Bearer <source-key>");
    expect(packageData.packageText).toContain(
      `Endpoint: POST ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url}`
    );
    expect(packageData.packageText).toContain("Authorization: Bearer <source-key>");
  });

  it("maps pilot phases to existing AgentGuard routes", () => {
    const hrefs = AGENT_GUARD_PILOT_PHASES.map((phase) => phase.dashboardHref);

    expect(hrefs).toContain("/dashboard/agent-guard/setup");
    expect(hrefs).toContain("/dashboard/agent-guard/ingestion");
    expect(hrefs).toContain("/dashboard/agent-guard/monitoring");
    expect(hrefs).toContain("/dashboard/agent-guard/policies");
    expect(hrefs).toContain("/dashboard/agent-guard/reviews");
    expect(hrefs).toContain("/dashboard/agent-guard/readiness");
    expect(hrefs).toContain("/dashboard/agent-guard/guide");
  });

  it("defines entry criteria, exit criteria, responsibilities, and artifacts", () => {
    const packageData = buildAgentGuardEnterprisePilotPackage();

    expect(packageData.entryCriteria).toBe(AGENT_GUARD_PILOT_ENTRY_CRITERIA);
    expect(packageData.exitCriteria).toBe(AGENT_GUARD_PILOT_EXIT_CRITERIA);
    expect(packageData.operatorResponsibilities.length).toBeGreaterThan(3);
    expect(packageData.customerResponsibilities.length).toBeGreaterThan(3);
    expect(packageData.artifacts).toBe(AGENT_GUARD_PILOT_ARTIFACTS);
    expect(packageData.artifacts.map((artifact) => artifact.id)).toContain(
      "operations-runbook"
    );
  });

  it("keeps pilot text customer-controlled and claim-safe", () => {
    const packageData = buildAgentGuardEnterprisePilotPackage();
    const text = packageData.packageText;

    expect(text).toContain("customer-controlled");
    expect(text).toContain("server-side wrapper");
    expect(text).toContain("metadata-only");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a certification");
    expect(text).toContain("not a compliance determination");
    expect(text).toContain("not automatic monitoring");
    expect(text).toContain("not a hosted collector");
    expect(text).toContain("not a managed connector");
    expect(text).not.toContain("monitors all major AI tools");
    expect(text).not.toContain("certifies compliance");
  });

  it("reports package counts for UI badges", () => {
    const counts = agentGuardEnterprisePilotCounts();

    expect(counts.timelines).toBe(AGENT_GUARD_PILOT_TIMELINES.length);
    expect(counts.phases).toBe(AGENT_GUARD_PILOT_PHASES.length);
    expect(counts.artifacts).toBe(AGENT_GUARD_PILOT_ARTIFACTS.length);
    expect(counts.entryCriteria).toBe(AGENT_GUARD_PILOT_ENTRY_CRITERIA.length);
    expect(counts.exitCriteria).toBe(AGENT_GUARD_PILOT_EXIT_CRITERIA.length);
  });
});
