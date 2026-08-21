import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES,
  AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY,
  agentGuardNativeConnectorPostureCounts,
  firstNativeConnectorSpecCandidate,
  nativeConnectorCandidateById,
  renderNativeConnectorGroundworkMarkdown,
} from "../native-connector-groundwork";

const UNSAFE_HANDOFF_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  /xox[baprs]-[A-Za-z0-9-]+/i,
  /sgae_[A-Za-z0-9_-]{8,}/,
  /api[_-]?key\s*=/i,
  /promptText/i,
  /raw_prompt/i,
  /raw_response/i,
];

describe("AgentGuard native connector groundwork", () => {
  it("defines the conservative native connector candidate order", () => {
    expect(AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES.map((candidate) => candidate.id)).toEqual([
      "generic_https_foundation",
      "slack_workflow_url_preview",
      "teams_incoming_webhook_preview",
      "siem_http_intake_pack",
      "ticketing_soar_middleware_pack",
    ]);
  });

  it("selects Slack workflow URL preview as the first future native spec candidate", () => {
    const candidate = firstNativeConnectorSpecCandidate();

    expect(candidate.id).toBe("slack_workflow_url_preview");
    expect(candidate.decision).toContain("Recommended first future native connector spec");
    expect(candidate.credentialOwner).toContain("Customer creates and owns");
    expect(candidate.failureBehavior).toContain("Do not retry in the background");
    expect(candidate.forbiddenClaims).toContain("Do not claim installed Slack app support.");
  });

  it("requires every candidate to define the preflight decisions", () => {
    for (const candidate of AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES) {
      expect(candidate.label.length).toBeGreaterThan(8);
      expect(candidate.decision.length).toBeGreaterThan(30);
      expect(candidate.credentialOwner.length).toBeGreaterThan(30);
      expect(candidate.credentialStorageBoundary.length).toBeGreaterThan(30);
      expect(candidate.testEventPath.length).toBeGreaterThan(30);
      expect(candidate.failureBehavior.length).toBeGreaterThan(30);
      expect(candidate.rateLimitPosture.length).toBeGreaterThan(30);
      expect(candidate.dataFieldsSent.length).toBeGreaterThanOrEqual(9);
      expect(candidate.customerResponsibilities.length).toBeGreaterThanOrEqual(5);
      expect(candidate.forbiddenClaims.length).toBeGreaterThanOrEqual(4);
      expect(candidate.nextSpecQuestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("counts groundwork postures deterministically", () => {
    expect(agentGuardNativeConnectorPostureCounts()).toEqual({
      shipped_https_foundation: 1,
      recommended_first_native_spec: 1,
      candidate_after_first_native: 1,
      defer_until_customer_signal: 2,
    });
  });

  it("renders copyable markdown with boundaries and no secrets", () => {
    const markdown = renderNativeConnectorGroundworkMarkdown(
      nativeConnectorCandidateById("slack_workflow_url_preview")
    );

    expect(markdown).toContain("# AgentGuard Native Connector Groundwork");
    expect(markdown).toContain("## Candidate Matrix");
    expect(markdown).toContain("Selected Candidate For Next Spec: Slack workflow URL preview");
    expect(markdown).toContain("Credential owner:");
    expect(markdown).toContain("Failure behavior:");
    expect(markdown).toContain("Rate-limit posture:");
    expect(markdown).toContain("Forbidden Claims");
    expect(markdown).toContain(AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.boundary);

    for (const pattern of UNSAFE_HANDOFF_PATTERNS) {
      expect(markdown).not.toMatch(pattern);
    }
  });

  it("keeps native connector claims unshipped", () => {
    const text = `${AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.boundary}\n${JSON.stringify(
      AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES
    )}`;

    expect(text).toContain("does not ship a Slack app");
    expect(text).toContain("managed customer credential storage");
    expect(text).toContain("Do not store SIEM API tokens");
    expect(text).toContain("Do not automatically create or escalate cases");
    expect(text).not.toContain("Slack app is shipped");
    expect(text).not.toContain("managed SIEM connector is shipped");
    expect(text).not.toContain("tickets are automatically created");
  });

  it("falls back to the HTTPS foundation for unknown ids at runtime", () => {
    expect(
      nativeConnectorCandidateById(
        "missing" as Parameters<typeof nativeConnectorCandidateById>[0]
      ).id
    ).toBe("generic_https_foundation");
  });
});
