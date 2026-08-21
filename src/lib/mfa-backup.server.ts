/**
 * Server-side MFA backup-code persistence. Uses the admin client so
 * an aal1 session can read/write the rows during enrollment + recovery.
 *
 * Pure helpers (generateBackupCodes, hashCode, normalizeCode) live in
 * mfa-backup.ts so they can be unit-tested without the server-only
 * import guard.
 */

import "server-only";

import { createAdminSupabase } from "./supabase/server";
import { generateBackupCodes, hashCode } from "./mfa-backup";

/**
 * Replace any existing backup codes for this user with a fresh batch.
 * Returns the plain-text codes for the caller to display once.
 */
export async function rotateBackupCodes(userId: string): Promise<string[]> {
  const admin = createAdminSupabase();
  const fresh = generateBackupCodes();

  // Wipe old codes (used or unused) — regenerating invalidates the
  // previous batch in full. Caller is responsible for confirming with
  // the user that they have the new ones safe before doing this.
  await admin.from("mfa_backup_codes").delete().eq("user_id", userId);

  const rows = fresh.map((f) => ({
    user_id: userId,
    code_hash: f.hash,
  }));
  await admin.from("mfa_backup_codes").insert(rows);

  return fresh.map((f) => f.code);
}

/**
 * Verify a code submitted during recovery. If valid and unused, marks
 * it used and returns true. False otherwise. The unique index on
 * code_hash + the `is("used_at", null)` predicate make this an atomic
 * check-and-mark.
 */
export async function consumeBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  const admin = createAdminSupabase();
  const hash = hashCode(code);

  const { data, error } = await admin
    .from("mfa_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("code_hash", hash)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Count of unused backup codes for the UI. Cheap; the partial index
 * on (user_id) WHERE used_at IS NULL serves this directly.
 */
export async function countUnusedBackupCodes(userId: string): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return count ?? 0;
}
