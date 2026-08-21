import { describe, expect, it } from "vitest";
import { buildMCPPostureSummary, calculateMCPToolRisk } from "../risk";
import type { MCPTool } from "../types";

function tool(overrides: Partial<MCPTool>): MCPTool {
  return {
    id: overrides.id ?? "tool-1",
    org_id: "org-1",
    mcp_server_id: "server-1",
    ai_system_id: overrides.ai_system_id ?? null,
    name: overrides.name ?? "query_customer_db",
    description: "",
    capability_categories: overrides.capability_categories ?? ["read"],
    data_sensitivity: overrides.data_sensitivity ?? "internal",
    external_access: overrides.external_access ?? false,
    write_access: overrides.write_access ?? false,
    credential_access: overrides.credential_access ?? false,
    approval_status: overrides.approval_status ?? "pending_review",
    risk_tier: overrides.risk_tier ?? "medium",
    risk_score: overrides.risk_score ?? 45,
    owner_name: "",
    owner_email: null,
    status: overrides.status ?? "active",
    last_activity_at: null,
    created_by: null,
    created_at: "2026-05-22T12:00:00.000Z",
    updated_at: "2026-05-22T12:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("MCP tool risk scoring", () => {
  it("scores low-risk approved read tools conservatively", () => {
    const result = calculateMCPToolRisk({
      capabilityCategories: ["read"],
      dataSensitivity: "public",
      externalAccess: false,
      writeAccess: false,
      credentialAccess: false,
      approvalStatus: "approved",
    });

    expect(result.tier).toBe("low");
    expect(result.score).toBeLessThan(20);
  });

  it("elevates restricted write/admin tools with external and credential access", () => {
    const result = calculateMCPToolRisk({
      capabilityCategories: ["write", "admin", "database_access"],
      dataSensitivity: "restricted",
      externalAccess: true,
      writeAccess: true,
      credentialAccess: true,
      approvalStatus: "pending_review",
    });

    expect(result.tier).toBe("critical");
    expect(result.score).toBe(100);
    expect(result.factors).toContain("credential access");
  });

  it("treats blocked tools as high-risk even with simple capabilities", () => {
    const result = calculateMCPToolRisk({
      capabilityCategories: ["read"],
      dataSensitivity: "internal",
      externalAccess: false,
      writeAccess: false,
      credentialAccess: false,
      approvalStatus: "blocked",
    });

    expect(result.tier).toBe("high");
  });
});

describe("MCP posture summary", () => {
  it("groups tools that need governance attention", () => {
    const summary = buildMCPPostureSummary([
      tool({ id: "high", risk_tier: "high" }),
      tool({ id: "blocked", approval_status: "blocked", status: "blocked" }),
      tool({ id: "linked", ai_system_id: "system-1", approval_status: "approved", risk_tier: "low" }),
    ]);

    expect(summary.totalTools).toBe(3);
    expect(summary.highRiskTools.map((item) => item.id)).toEqual(["high"]);
    expect(summary.blockedTools.map((item) => item.id)).toEqual(["blocked"]);
    expect(summary.unlinkedTools.map((item) => item.id)).toEqual(["high", "blocked"]);
  });
});
