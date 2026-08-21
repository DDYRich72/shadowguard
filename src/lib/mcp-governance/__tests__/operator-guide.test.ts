import { describe, expect, it } from "vitest";
import {
  MCP_GUARD_FIELD_GROUPS,
  MCP_GUARD_OPERATOR_GUIDE_COPY,
  MCP_GUARD_OPERATOR_STEPS,
  MCP_GUARD_TROUBLESHOOTING,
  mcpGuardOperatorGuideCounts,
} from "../operator-guide";

describe("MCPGuard operator guide", () => {
  it("keeps the guide complete enough for the production workflow", () => {
    const counts = mcpGuardOperatorGuideCounts();

    expect(counts.steps).toBeGreaterThanOrEqual(6);
    expect(counts.fieldGroups).toBe(3);
    expect(MCP_GUARD_OPERATOR_STEPS.map((step) => step.pageHref)).toEqual(
      expect.arrayContaining([
        "/dashboard/mcp-guard/servers",
        "/dashboard/mcp-guard/tools",
        "/dashboard/mcp-guard/events",
        "/dashboard/agent-guard/monitoring",
        "/dashboard/governance-report",
      ])
    );
  });

  it("documents event fields and safe-content boundaries", () => {
    const eventGroup = MCP_GUARD_FIELD_GROUPS.find((group) => group.id === "event-fields");

    expect(eventGroup?.fields).toEqual(
      expect.arrayContaining([
        "MCP server",
        "MCP tool",
        "Tool name",
        "User email",
        "Activity type",
        "Input content sample",
        "Output content sample",
      ])
    );
    expect(MCP_GUARD_OPERATOR_GUIDE_COPY.safeEventRule).toContain("Do not paste raw prompts");
    expect(MCP_GUARD_OPERATOR_GUIDE_COPY.boundary).toContain("does not execute MCP tools");
    expect(MCP_GUARD_OPERATOR_GUIDE_COPY.boundary).toContain("certify compliance");
  });

  it("includes the duplicate-tool troubleshooting note", () => {
    const duplicateNote = MCP_GUARD_TROUBLESHOOTING.find(
      (note) => note.id === "duplicate-tool"
    );

    expect(duplicateNote?.symptom).toContain("already exists");
    expect(duplicateNote?.check).toContain("unique under the same MCP server");
  });
});
