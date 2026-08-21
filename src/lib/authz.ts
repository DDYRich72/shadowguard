/**
 * Role-based authorization helpers.
 *
 * RLS scopes data to an org. These helpers layer role checks on top so
 * that, e.g., a viewer can't disable a credential-blocking policy.
 */

import { createServerSupabase } from "./supabase/server";

export type Role = "admin" | "manager" | "viewer";

export type SessionContext = {
  userId: string;
  email: string | null;
  orgId: string;
  role: Role;
};

/**
 * Resolve the signed-in user's org and role in a single call.
 * Returns null when there is no session or no matching users row.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: data.org_id as string,
    role: data.role as Role,
  };
}

export function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

/**
 * Validate a `?next=` redirect target. Returns `fallback` (default
 * /dashboard) if the value is missing, not a same-origin path, or looks
 * like a protocol-relative or javascript: URL.
 */
export function safeNext(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value) return fallback;
  if (typeof value !== "string") return fallback;
  // Must be a same-origin absolute path.
  if (!value.startsWith("/")) return fallback;
  // Reject protocol-relative URLs like "//evil.com".
  if (value.startsWith("//")) return fallback;
  // Reject control chars and CR/LF (which could smuggle into redirect headers).
  if (/[\x00-\x1f]/.test(value)) return fallback;
  return value;
}
