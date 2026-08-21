#!/usr/bin/env tsx
/**
 * Re-encrypt every org's OAuth tokens under the current key.
 *
 * Run after deploying a new TOKEN_ENCRYPTION_KEY (with the previous
 * key still set as TOKEN_ENCRYPTION_KEY_PREVIOUS so this script can
 * read legacy ciphertext).
 *
 * Usage:
 *   tsx scripts/rotate-token-keys.ts          # batch re-encrypt
 *   tsx scripts/rotate-token-keys.ts --dry    # report only, no writes
 *
 * Idempotent: orgs already at the current encryption_key_version are
 * skipped. Per-org failure is logged and processing continues —
 * partial migrations are fine, just re-run.
 *
 * Requires the SAME env as the running app:
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - TOKEN_ENCRYPTION_KEY              (current)
 *   - TOKEN_ENCRYPTION_KEY_VERSION      (current; default 1)
 *   - TOKEN_ENCRYPTION_KEY_PREVIOUS     (optional, only needed for old rows)
 *   - TOKEN_ENCRYPTION_KEY_PREVIOUS_VERSION
 */

import { createClient } from "@supabase/supabase-js";
import { reencrypt, currentKeyVersion } from "../src/lib/crypto";

const TOKEN_COLUMNS = [
  "google_access_token",
  "google_refresh_token",
  "ms_access_token",
  "ms_refresh_token",
] as const;

type OrgRow = {
  id: string;
  encryption_key_version: number | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  ms_access_token: string | null;
  ms_refresh_token: string | null;
};

async function main() {
  const dryRun = process.argv.includes("--dry");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
    );
    process.exit(1);
  }

  const target = await currentKeyVersion();
  console.log(`Current encryption key version: ${target}`);
  console.log(dryRun ? "(dry run — no writes)" : "");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pull every org that hasn't been migrated to the current key yet.
  const { data: orgs, error } = await admin
    .from("organizations")
    .select(
      "id, encryption_key_version, google_access_token, google_refresh_token, ms_access_token, ms_refresh_token"
    )
    .or(
      `encryption_key_version.is.null,encryption_key_version.neq.${target}`
    );

  if (error) {
    console.error("Failed to list organizations:", error.message);
    process.exit(2);
  }

  const rows = (orgs ?? []) as OrgRow[];
  console.log(`Found ${rows.length} org(s) to process.`);

  let successes = 0;
  let failures = 0;
  let skipped = 0;

  for (const org of rows) {
    const updates: Partial<Record<(typeof TOKEN_COLUMNS)[number], string>> = {};
    let anyToken = false;

    try {
      for (const col of TOKEN_COLUMNS) {
        const cipher = org[col];
        if (!cipher) continue;
        anyToken = true;
        updates[col] = await reencrypt(cipher);
      }

      if (!anyToken) {
        // Org has no tokens (never connected a workspace). Just bump
        // the version so it's no longer in the candidate set.
        skipped++;
        if (!dryRun) {
          await admin
            .from("organizations")
            .update({ encryption_key_version: target })
            .eq("id", org.id);
        }
        console.log(`  - ${org.id}  (no tokens, version bumped)`);
        continue;
      }

      if (dryRun) {
        successes++;
        console.log(
          `  ✓ ${org.id}  (would re-encrypt ${Object.keys(updates).length} columns)`
        );
        continue;
      }

      const { error: updateErr } = await admin
        .from("organizations")
        .update({ ...updates, encryption_key_version: target })
        .eq("id", org.id);

      if (updateErr) throw new Error(updateErr.message);
      successes++;
      console.log(
        `  ✓ ${org.id}  (re-encrypted ${Object.keys(updates).length} columns)`
      );
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${org.id}  ${msg}`);
    }
  }

  console.log("");
  console.log(
    `Done. successes=${successes} failures=${failures} skipped=${skipped}`
  );
  if (failures > 0) process.exit(3);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(99);
});
