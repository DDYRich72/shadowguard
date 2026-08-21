/**
 * MFA helpers — server-side reads of the user's factors and current
 * Authenticator Assurance Level (AAL).
 *
 * Privileged role gating rule:
 *   - admin / manager → must reach AAL2 to perform mutations
 *   - viewer → AAL2 not required (can enroll voluntarily)
 *
 * The AAL value is part of the access-token claims, so reading it is
 * free relative to a DB query. Factor listing hits the auth API, so
 * cache the result inside a single request if you call it twice.
 */

import { createServerSupabase } from "./supabase/server";
import type { Role } from "./authz";
import {
  privilegedRoleNeedsAal2,
  type AalLevel,
} from "./mfa-policy";

export type { AalLevel } from "./mfa-policy";

export type MfaSnapshot = {
  currentLevel: AalLevel;
  nextLevel: AalLevel;
  hasVerifiedFactor: boolean;
};

/**
 * Snapshot of the user's MFA posture: current AAL, what level they'd
 * be at if they completed a challenge, and whether they have any
 * verified TOTP factor.
 *
 * Returns null when there is no session.
 */
export async function getMfaSnapshot(): Promise<MfaSnapshot | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified =
    (factors?.totp ?? []).some((f) => f.status === "verified") ||
    (factors?.all ?? []).some((f) => f.status === "verified");

  return {
    currentLevel: ((aal?.currentLevel as AalLevel) ?? "aal1"),
    nextLevel: ((aal?.nextLevel as AalLevel) ?? "aal1"),
    hasVerifiedFactor: verified,
  };
}

/**
 * Decision rule for the MFA gate. True when the role demands AAL2
 * and the session is still at AAL1.
 */
export function adminNeedsAal2(role: Role, currentLevel: AalLevel): boolean {
  return privilegedRoleNeedsAal2(role, currentLevel);
}

/**
 * Standard 403 payload for AAL2-gated endpoints. Clients can branch
 * on `error === "mfa_required"` to surface an enrollment / challenge CTA.
 */
export const mfaRequiredError = {
  error: "mfa_required",
  message:
    "This action requires multi-factor authentication. Verify this session with your authenticator code, or enroll a TOTP factor in Settings > Security first.",
  action: "verify_mfa",
} as const;
