/**
 * Structured logging with sensitive-data redaction.
 *
 * Drop-in replacement for `console.error` / `console.warn` / `console.log`
 * in any path that touches OAuth tokens, prompts, or user content.
 *
 * Redaction is best-effort, not a guarantee — if you have a known-
 * sensitive value in scope, don't log it at all. This is the second
 * line of defence: it scrubs tokens that leak through error messages
 * from Google / MS SDKs (which sometimes echo bearer tokens back) and
 * from caught exceptions whose `.message` includes the failing URL.
 *
 * Output shape (one line per call, JSON for log aggregators):
 *   { level, ref, msg, ...ctx }
 *
 * `ref` is a short correlation id; pair with the request-id header
 * so a customer's "err_ab12cd34" maps directly to the log line.
 */

import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

// Patterns we always strip. Conservative — false positives blow away
// data, false negatives leak it. We err toward false negatives and
// rely on the "don't log secrets in the first place" rule.
const REDACTORS: { pattern: RegExp; replacement: string }[] = [
  // Bearer / authorization headers in any form
  { pattern: /(authorization:\s*bearer\s+)[\w.+/=-]+/gi, replacement: "$1<redacted>" },
  { pattern: /(bearer\s+)[\w.+/=-]{20,}/gi, replacement: "$1<redacted>" },
  // Google access + refresh tokens
  { pattern: /ya29\.[\w.-]+/g, replacement: "<google_token>" },
  { pattern: /1\/\/[\w-]+/g, replacement: "<google_refresh>" },
  // MS Graph access tokens (JWT-shaped, long base64 trio)
  { pattern: /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, replacement: "<jwt>" },
  // AWS access keys (in case a user pasted one and it ends up in an error trace)
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: "<aws_key>" },
  // Generic api-key=value patterns
  {
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*[^&\s"',}]{6,}/gi,
    replacement: "$1=<redacted>",
  },
  // Raw secrets in URLs (?key=..., ?token=...)
  {
    pattern: /([?&](?:key|token|secret|access_token|refresh_token)=)[^&\s"]+/gi,
    replacement: "$1<redacted>",
  },
];

// Object fields we always drop entirely.
const FORBIDDEN_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "password",
  "passwd",
  "secret",
  "api_key",
  "apikey",
  "client_secret",
  "provider_secret_key",
  "supabase_service_role_key",
  "token_encryption_key",
  "code", // OAuth authorization codes; backup-recovery codes
  "code_hash",
]);

function redactString(s: string): string {
  let out = s;
  for (const r of REDACTORS) out = out.replace(r.pattern, r.replacement);
  return out;
}

function redactObject(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "<truncated>";
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactObject(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELDS.has(k.toLowerCase())) {
      out[k] = "<redacted>";
      continue;
    }
    out[k] = redactObject(v, depth + 1);
  }
  return out;
}

export function newRef(): string {
  return `ref_${randomUUID().slice(0, 8)}`;
}

type LogPayload = Record<string, unknown> & { msg?: string };

function emit(level: LogLevel, msg: string, ctx?: LogPayload): string {
  const ref = (ctx?.ref as string) ?? newRef();
  const safe = ctx ? (redactObject(ctx) as Record<string, unknown>) : {};
  const line = JSON.stringify({
    level,
    ref,
    msg: redactString(msg),
    ...safe,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  return ref;
}

export const logger = {
  debug: (msg: string, ctx?: LogPayload) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogPayload) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogPayload) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogPayload) => emit("error", msg, ctx),
};

/**
 * Convenience: log a thrown error with redaction. Returns the ref so
 * callers can include it in user-facing error responses for support.
 */
export function logError(err: unknown, ctx?: LogPayload): string {
  const message = err instanceof Error ? err.message : String(err);
  return logger.error(message, {
    ...(ctx ?? {}),
    name: err instanceof Error ? err.name : undefined,
    stack: err instanceof Error ? err.stack?.split("\n").slice(0, 3).join("\n") : undefined,
  });
}
