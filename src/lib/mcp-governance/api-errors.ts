type DbLikeError = {
  code?: string | null;
  message?: string | null;
};

export const MCP_TOOL_DUPLICATE_ERROR = "mcp_tool_already_exists";
export const MCP_TOOL_DUPLICATE_MESSAGE =
  "An MCP tool with this name already exists for the selected MCP server. Use the existing tool row or choose a different tool name.";

export function isMCPToolNameConflict(error: DbLikeError): boolean {
  return error?.code === "23505";
}
