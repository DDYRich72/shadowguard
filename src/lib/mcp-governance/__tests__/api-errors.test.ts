import { describe, expect, it } from "vitest";
import {
  MCP_TOOL_DUPLICATE_ERROR,
  MCP_TOOL_DUPLICATE_MESSAGE,
  isMCPToolNameConflict,
} from "../api-errors";

describe("MCPGuard API errors", () => {
  it("identifies MCP tool name conflicts from Postgres unique violations", () => {
    expect(isMCPToolNameConflict({ code: "23505" })).toBe(true);
    expect(isMCPToolNameConflict({ code: "42501" })).toBe(false);
  });

  it("keeps the duplicate-tool response operator friendly", () => {
    expect(MCP_TOOL_DUPLICATE_ERROR).toBe("mcp_tool_already_exists");
    expect(MCP_TOOL_DUPLICATE_MESSAGE).toContain("already exists");
    expect(MCP_TOOL_DUPLICATE_MESSAGE).toContain("selected MCP server");
  });
});
