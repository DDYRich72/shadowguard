const FORBIDDEN_METADATA_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "body",
  "content",
  "credential",
  "credentials",
  "database",
  "database_query",
  "databasequery",
  "file",
  "file_content",
  "filecontent",
  "input",
  "message",
  "output",
  "password",
  "payload",
  "prompt",
  "query",
  "query_result",
  "queryresult",
  "raw",
  "result",
  "results",
  "rows",
  "secret",
  "text",
  "token",
  "toolinput",
  "tool_input",
  "tooloutput",
  "tool_output",
]);

const MAX_DEPTH = 3;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 500;
const SECRET_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function sanitizeString(value: string): string {
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "[redacted-sensitive-value]";
  }
  return value.slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      if (FORBIDDEN_METADATA_KEYS.has(normalizeKey(key))) continue;
      output[key.slice(0, 100)] = sanitizeValue(child, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}

export function sanitizeMCPEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

export function contentLength(value: string | null | undefined): number {
  return value?.length ?? 0;
}

export function buildSafeMCPRawPayload(input: {
  content?: string;
  inputContent?: string;
  outputContent?: string;
}): Record<string, number> {
  return {
    content_length: contentLength(input.content),
    input_length: contentLength(input.inputContent),
    output_length: contentLength(input.outputContent),
  };
}
