/**
 * Sanitize server-side errors before returning them to the client.
 *
 * Raw Supabase / Postgres messages leak schema details (table names,
 * RLS policy hints, foreign-key references). We return a generic
 * message with a short reference id and log the detail server-side
 * so support can correlate when a customer asks.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { logger, logError } from "./logger";

type DbLikeError = { message?: string | null; code?: string | null } | null | undefined;

function newRef(): string {
  return `err_${randomUUID().slice(0, 8)}`;
}

/** Build a sanitized JSON response for a DB or Supabase error. */
export function dbErrorResponse(err: DbLikeError, status = 500): NextResponse {
  const ref = newRef();
  logger.error("db error", {
    ref,
    message: err?.message,
    code: err?.code,
  });
  return NextResponse.json({ error: "database_error", ref }, { status });
}

/** Build a sanitized JSON response for any caught error. */
export function serverErrorResponse(err: unknown, status = 500): NextResponse {
  const ref = newRef();
  logError(err, { ref });
  return NextResponse.json({ error: "server_error", ref }, { status });
}
