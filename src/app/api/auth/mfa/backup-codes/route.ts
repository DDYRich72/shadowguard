import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  rotateBackupCodes,
  countUnusedBackupCodes,
} from "@/lib/mfa-backup.server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

/**
 * GET — return the count of unused backup codes for the signed-in user.
 * Used by the security settings UI to show "n of 10 codes remaining"
 * and to prompt regeneration when the count gets low.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const remaining = await countUnusedBackupCodes(user.id);
  return NextResponse.json({ remaining });
}

/**
 * POST — generate a fresh batch of 10 codes, invalidating any
 * existing batch. Rate-limited to discourage code-mining; codes are
 * shown exactly once in the response and never echoed again.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 5 generations per hour per user is plenty for the legitimate
  // "I lost my screenshot" reroll case; cuts off any scripted abuse.
  const rl = await rateLimit(`mfa-backup-gen:${user.id}`, 5, 60 * 60_000);
  if (!rl.allowed) return rateLimited(rl);

  const codes = await rotateBackupCodes(user.id);
  return NextResponse.json({
    codes,
    note: "Save these codes now. They will not be shown again.",
  });
}
