import { describe, it, expect } from "vitest";
import {
  classifyData,
  assessActivityRisk,
  evaluatePolicyMatches,
  shouldKillSwitch,
  type AgentActivity,
  type AgentPolicy,
} from "../engine";

describe("classifyData — PII detection", () => {
  it("detects SSN format", () => {
    const r = classifyData("Customer SSN is 123-45-6789");
    expect(r.piiDetected).toBe(true);
    expect(r.categories).toContain("SSN");
    expect(r.sensitivity).toBe("confidential");
  });

  it("detects email addresses (with corrected char class)", () => {
    const r = classifyData("Reach me at alice@example.com");
    expect(r.piiDetected).toBe(true);
    expect(r.categories).toContain("Email");
  });

  it("detects formatted phone numbers", () => {
    expect(classifyData("call 555-123-4567").categories).toContain("Phone Number");
    expect(classifyData("call 555.123.4567").categories).toContain("Phone Number");
  });

  it("detects E.164 phone numbers", () => {
    expect(classifyData("+1 555-123-4567").categories).toContain("Phone Number");
    expect(classifyData("+44 20 1234 5678").categories).toContain("Phone Number");
  });

  it("does NOT match raw 10+ digit integers (regression: order IDs / timestamps)", () => {
    // The old \b\d{10,}\b pattern false-positived on these. Tightened
    // patterns must let unformatted integers through cleanly.
    const r1 = classifyData("Order id 1234567890123");
    expect(r1.piiDetected).toBe(false);
    const r2 = classifyData("Unix timestamp 1735689600");
    expect(r2.piiDetected).toBe(false);
  });

  it("detects credit cards", () => {
    const r = classifyData("Card 4111 1111 1111 1111");
    expect(r.piiDetected).toBe(true);
    expect(r.categories).toContain("Credit Card");
  });

  it("detects IPv4 addresses", () => {
    const r = classifyData("Connect to 192.168.1.1 on port 22");
    expect(r.piiDetected).toBe(true);
    expect(r.categories).toContain("IP Address");
  });
});

describe("classifyData — credentials detection", () => {
  it("detects password assignments", () => {
    const r = classifyData("password: hunter2");
    expect(r.credentialsDetected).toBe(true);
    expect(r.sensitivity).toBe("restricted");
  });

  it("detects API keys", () => {
    const fixture = ["abcd1234", "efgh5678"].join("");
    expect(classifyData(`api_key = ${fixture}`).credentialsDetected).toBe(true);
    expect(classifyData("apikey: foo").credentialsDetected).toBe(true);
  });

  it("detects bearer tokens", () => {
    const fixture = ["eyJhbGciOi", "JIUzI1NiJ9"].join("");
    expect(classifyData(`token: ${fixture}`).credentialsDetected).toBe(true);
  });

  it("detects PEM private keys", () => {
    const r = classifyData("-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...");
    expect(r.credentialsDetected).toBe(true);
  });

  it("detects AWS access keys", () => {
    const r = classifyData("AKIAIOSFODNN7EXAMPLE");
    expect(r.credentialsDetected).toBe(true);
  });

  it("escalates sensitivity to restricted on credentials", () => {
    // Even if PII is also present, credentials win.
    const r = classifyData("ssn 123-45-6789, api_key = secret");
    expect(r.sensitivity).toBe("restricted");
  });
});

describe("classifyData — proprietary markers", () => {
  it("detects proprietary keywords", () => {
    const r = classifyData("This document is COMPANY CONFIDENTIAL");
    expect(r.proprietaryDetected).toBe(true);
    expect(r.categories).toContain("Proprietary Content");
  });

  it("does not downgrade restricted to confidential", () => {
    const r = classifyData("password: hunter2 (internal only)");
    expect(r.sensitivity).toBe("restricted");
  });
});

describe("classifyData — length heuristic", () => {
  it("flags 2000+ char public content as 'internal'", () => {
    const r = classifyData("a".repeat(2500));
    expect(r.sensitivity).toBe("internal");
    expect(r.categories).toContain("Large Context Block");
  });

  it("does not bump non-public content", () => {
    const long = "password: hunter2 " + "a".repeat(2500);
    expect(classifyData(long).sensitivity).toBe("restricted");
  });
});

describe("assessActivityRisk", () => {
  it("rates a benign prompt as low/none", () => {
    const r = assessActivityRisk({
      activityType: "prompt_sent",
      dataClassification: classifyData("hello world"),
    });
    expect(["low", "none"]).toContain(r.riskLevel);
  });

  it("rates credential exfil via prompt as critical", () => {
    const r = assessActivityRisk({
      activityType: "prompt_sent",
      dataClassification: classifyData("api_key = AKIAIOSFODNN7EXAMPLE"),
    });
    expect(r.riskLevel).toBe("critical");
  });

  it("rates file uploads with PII as elevated", () => {
    const r = assessActivityRisk({
      activityType: "file_upload",
      dataClassification: classifyData("ssn 123-45-6789"),
    });
    expect(["high", "critical"]).toContain(r.riskLevel);
  });

  it("includes risk factor descriptions", () => {
    const r = assessActivityRisk({
      activityType: "data_export",
      dataClassification: classifyData("password: hunter2"),
    });
    expect(r.factors.some((f) => f.includes("Credentials"))).toBe(true);
  });
});

describe("shouldKillSwitch", () => {
  function activity(over: Partial<AgentActivity>): AgentActivity {
    return {
      id: "a",
      orgId: "o",
      toolName: "ChatGPT",
      toolId: "",
      userId: "",
      userEmail: "x@y.z",
      activityType: "prompt_sent",
      timestamp: new Date().toISOString(),
      dataClassification: {
        sensitivity: "public",
        categories: [],
        piiDetected: false,
        credentialsDetected: false,
        proprietaryDetected: false,
        details: "",
      },
      riskLevel: "low",
      metadata: {},
      blocked: false,
      ...over,
    };
  }

  function policy(over: Partial<AgentPolicy>): AgentPolicy {
    return {
      id: "p",
      orgId: "o",
      name: "test",
      description: "",
      enabled: true,
      priority: 1,
      conditions: [],
      action: "allow",
      createdAt: "",
      updatedAt: "",
      ...over,
    };
  }

  it("blocks when a high-priority block policy matches", () => {
    const p = policy({
      priority: 1,
      action: "block",
      conditions: [{ field: "sensitivity", operator: "equals", value: "restricted" }],
    });
    const a = activity({
      dataClassification: {
        ...activity({}).dataClassification,
        sensitivity: "restricted",
      },
    });
    expect(shouldKillSwitch(a, [p]).blocked).toBe(true);
  });

  it("does not block when no policy matches", () => {
    const p = policy({
      action: "block",
      conditions: [{ field: "sensitivity", operator: "equals", value: "restricted" }],
    });
    const a = activity({});
    expect(shouldKillSwitch(a, [p]).blocked).toBe(false);
  });

  it("respects the priority order (lower wins)", () => {
    const allow = policy({
      id: "allow",
      name: "allow",
      priority: 10,
      action: "allow",
      conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
    });
    const block = policy({
      id: "block",
      name: "block",
      priority: 1,
      action: "block",
      conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
    });
    const a = activity({});
    const result = shouldKillSwitch(a, [allow, block]);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("block");
  });

  it("ignores disabled policies", () => {
    const p = policy({
      enabled: false,
      action: "block",
      conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
    });
    expect(shouldKillSwitch(activity({}), [p]).blocked).toBe(false);
  });

  it("does not block on warn-only policies", () => {
    const p = policy({
      action: "warn",
      conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
    });
    const result = shouldKillSwitch(activity({}), [p]);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("No blocking policy matched");
  });

  it("returns deterministic enabled policy matches in priority order", () => {
    const matches = evaluatePolicyMatches(activity({}), [
      policy({
        id: "disabled",
        enabled: false,
        priority: 0,
        action: "block",
        conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
      }),
      policy({
        id: "warn",
        name: "Warn on ChatGPT",
        priority: 5,
        action: "warn",
        conditions: [{ field: "toolName", operator: "equals", value: "ChatGPT" }],
      }),
      policy({
        id: "quarantine",
        name: "Quarantine prompts",
        priority: 2,
        action: "quarantine",
        conditions: [{ field: "activityType", operator: "equals", value: "prompt_sent" }],
      }),
    ]);

    expect(matches.map((match) => match.policyId)).toEqual([
      "quarantine",
      "warn",
    ]);
    expect(matches.map((match) => match.policyAction)).toEqual([
      "quarantine",
      "warn",
    ]);
  });
});
