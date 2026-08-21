/**
 * Validate the AI tools database.
 * Run: npx tsx scripts/validate-ai-db.ts
 *
 * Exits non-zero on any failure so it can gate CI / pre-commit.
 */

import { AI_TOOLS_DATABASE } from "../src/lib/ai-tools-database";

const MIN_ENTRIES = 500;
const residencyValues = new Set(["us", "eu", "global", "unknown"]);
const scopeValues = new Set(["high", "medium", "low"]);

const problems: string[] = [];

if (AI_TOOLS_DATABASE.length < MIN_ENTRIES) {
  problems.push(
    `Expected at least ${MIN_ENTRIES} entries, got ${AI_TOOLS_DATABASE.length}`
  );
}

const canonicalNames = new Map<string, number>();
const aliasOwners = new Map<string, string>();

for (let i = 0; i < AI_TOOLS_DATABASE.length; i++) {
  const t = AI_TOOLS_DATABASE[i];
  const where = `[${i}] "${t.name}"`;

  if (!t.name) problems.push(`${where}: missing name`);
  if (!t.category) problems.push(`${where}: missing category`);
  if (!Array.isArray(t.aliases) || t.aliases.length === 0) {
    problems.push(`${where}: must have at least one alias`);
  }
  if (!scopeValues.has(t.data_access_scope)) {
    problems.push(`${where}: invalid data_access_scope="${t.data_access_scope}"`);
  }
  if (!residencyValues.has(t.data_residency)) {
    problems.push(`${where}: invalid data_residency="${t.data_residency}"`);
  }
  if (typeof t.risk_base_score !== "number" || t.risk_base_score < 0 || t.risk_base_score > 100) {
    problems.push(`${where}: risk_base_score must be 0-100 (got ${t.risk_base_score})`);
  }
  if (typeof t.has_soc2 !== "boolean") problems.push(`${where}: has_soc2 must be boolean`);
  if (typeof t.has_gdpr !== "boolean") problems.push(`${where}: has_gdpr must be boolean`);
  if (typeof t.has_hipaa !== "boolean") problems.push(`${where}: has_hipaa must be boolean`);

  const canon = t.name.toLowerCase().trim();
  if (canonicalNames.has(canon)) {
    problems.push(
      `${where}: duplicate canonical name (also at index ${canonicalNames.get(canon)})`
    );
  } else {
    canonicalNames.set(canon, i);
  }

  for (const alias of t.aliases ?? []) {
    const a = alias.toLowerCase().trim();
    if (!a) {
      problems.push(`${where}: empty alias`);
      continue;
    }
    const owner = aliasOwners.get(a);
    if (owner && owner !== t.name) {
      problems.push(`${where}: alias "${alias}" collides with "${owner}"`);
    } else {
      aliasOwners.set(a, t.name);
    }
  }
}

if (problems.length > 0) {
  console.error(`AI tools DB validation FAILED (${problems.length} issue${problems.length === 1 ? "" : "s"}):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

const byCategory: Record<string, number> = {};
for (const t of AI_TOOLS_DATABASE) {
  byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
}

console.log(`OK: ${AI_TOOLS_DATABASE.length} entries, 0 duplicates`);
console.log("\nBy category:");
for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(4)}  ${cat}`);
}
