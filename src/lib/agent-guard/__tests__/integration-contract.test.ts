import { describe, expect, it } from "vitest";
import { activityTypeSchema } from "@/lib/api/schemas";
import { LIMITS } from "@/lib/validate";
import {
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
  AGENT_GUARD_INGEST_REQUEST_FIELDS,
  AGENT_GUARD_INGEST_RESPONSE_FIELDS,
} from "../production-operations";
import {
  AGENT_GUARD_INTEGRATION_ACTIVITY_TYPES,
  AGENT_GUARD_INTEGRATION_CONTRACT_COPY,
  AGENT_GUARD_INTEGRATION_CONTRACT_VERSION,
  buildAgentGuardIntegrationContract,
} from "../integration-contract";

describe("AgentGuard enterprise integration contract", () => {
  it("builds the versioned contract around the canonical production endpoint", () => {
    const contract = buildAgentGuardIntegrationContract({
      generatedAt: "2026-05-18T12:00:00.000Z",
      organizationName: "Example Organization",
      baseUrl: "https://guard.example.test/",
    });

    expect(contract.version).toBe("agentguard.activity.v1");
    expect(contract.version).toBe(AGENT_GUARD_INTEGRATION_CONTRACT_VERSION);
    expect(contract.organizationName).toBe("Example Organization");
    expect(contract.endpoint).toEqual({
      method: "POST",
      path: AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.path,
      url: "https://guard.example.test/api/agent-guard/activity",
    });
    expect(contract.contractMarkdown).toContain(
      "POST https://guard.example.test/api/agent-guard/activity"
    );
    expect(contract.contractMarkdown).toContain("Authorization: Bearer <source-key>");
    expect(contract.contractMarkdown).toContain("AGENTGUARD_INGEST_TOKEN");
  });

  it("keeps request and response fields aligned with the ingest route catalog", () => {
    const contract = buildAgentGuardIntegrationContract();
    const requestFieldNames = contract.requestFields.map((field) => field.name);
    const responseFieldNames = contract.responseFields.map((field) => field.name);

    expect(requestFieldNames).toEqual([...AGENT_GUARD_INGEST_REQUEST_FIELDS]);
    expect(responseFieldNames).toEqual([...AGENT_GUARD_INGEST_RESPONSE_FIELDS]);
    expect(
      contract.requestFields.find((field) => field.name === "toolName")?.maxLength
    ).toBe(LIMITS.toolName);
    expect(
      contract.requestFields.find((field) => field.name === "userEmail")?.maxLength
    ).toBe(LIMITS.userEmail);
    expect(
      contract.requestFields.find((field) => field.name === "content")?.maxLength
    ).toBe(LIMITS.activityContent);
  });

  it("documents supported activity types and risk levels", () => {
    const contract = buildAgentGuardIntegrationContract();
    const activityField = contract.requestFields.find(
      (field) => field.name === "activityType"
    );
    const riskField = contract.responseFields.find(
      (field) => field.name === "riskLevel"
    );

    expect(AGENT_GUARD_INTEGRATION_ACTIVITY_TYPES).toEqual(
      activityTypeSchema.options
    );
    expect(activityField?.allowedValues).toEqual(activityTypeSchema.options);
    expect(riskField?.allowedValues).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it("includes safe payloads, server-side examples, error handling, and boundaries", () => {
    const contract = buildAgentGuardIntegrationContract({
      generatedAt: "2026-05-18T12:00:00.000Z",
    });
    const text = [
      contract.contractMarkdown,
      ...contract.samplePayloads.map((sample) => JSON.stringify(sample.payload)),
      ...contract.examples.map((example) => example.code),
      AGENT_GUARD_INTEGRATION_CONTRACT_COPY.boundary,
    ].join("\n");

    expect(contract.samplePayloads.map((sample) => sample.id)).toEqual([
      "baseline",
      "metadata-only",
      "pii-like-review",
      "credential-block-training",
    ]);
    expect(contract.examples.map((example) => example.id)).toEqual([
      "curl",
      "node-fetch",
      "next-route-handler",
      "python-requests",
    ]);
    expect(contract.errorCodes.map((error) => error.code)).toEqual([
      "invalid_json",
      "validation_failed",
      "invalid_ingest_token",
      "unauthorized",
      "tool_not_allowed_for_source",
      "rate_limited",
    ]);
    expect(text).toContain("## Safe sample payloads");
    expect(text).toContain("## Server-side examples");
    expect(text).toContain("## Error codes");
    expect(text).toContain("not a managed connector");
    expect(text).toContain("or automatic enforcement");
    expect(text).not.toContain("sgag_");
    expect(text).not.toContain("sgae_");
    expect(text).not.toContain("localStorage");
    expect(text).not.toContain("sessionStorage");
    expect(text).not.toContain("document.cookie");
  });

  it("normalizes unsafe display context", () => {
    const contract = buildAgentGuardIntegrationContract({
      generatedAt: "2026-05-18T12:00:00.000Z",
      organizationName: "Acme\r\nCorp",
      baseUrl: "javascript:alert(1)",
    });

    expect(contract.organizationName).toBe("Acme Corp");
    expect(contract.endpoint.url).toBe(
      AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url
    );
  });
});
