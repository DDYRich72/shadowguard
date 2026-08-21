/**
 * Boundary validation helpers for API route bodies.
 *
 * Goal: a logged-in user can't blow up the database, the policy
 * generator, or downstream UIs by sending pathological input. RLS
 * stops them from touching another tenant's data; these helpers stop
 * them from filling their own with 10 MB strings or 1 M-item arrays.
 *
 * Returns sanitized values rather than throwing — callers can apply
 * defaults inline. For hard-fail validation (UUIDs, enums) use the
 * is*() guards.
 */

/**
 * Coerce to string and clip to maxLen. Never throws. `undefined`
 * becomes the empty string.
 */
export function clip(value: unknown, maxLen: number): string {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, maxLen);
}

/**
 * Coerce to array and clip to maxItems. Non-array inputs return [].
 */
export function clipArray<T>(value: unknown, maxItems: number): T[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems) as T[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strict UUID check. Use before passing user-supplied IDs to .eq("id", ...)
 * so a malformed input returns a clean 400 instead of leaking a Postgres
 * "invalid input syntax for type uuid" error through the generic handler.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Bounded integer check. Returns the clamped value or `fallback` if
 * input is not a finite number.
 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  // null/undefined/empty-string mean "missing" — return fallback,
  // not Number(null) === 0 silently clamped into range.
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Common length budgets. Centralized so we don't sprinkle magic
 * numbers around the codebase.
 */
export const LIMITS = {
  toolName: 200,
  userEmail: 320, // RFC 5321 max
  policyName: 200,
  policyDescription: 1000,
  blockReason: 500,
  ingestSourceName: 120,
  exportDestinationName: 120,
  exportDestinationUrl: 2000,
  exportDestinationOwner: 160,
  exportDestinationEscalationPath: 1000,
  exportDestinationAcknowledgementNote: 1500,
  slackWorkflowTargetName: 120,
  slackWorkflowUrl: 2000,
  slackWorkflowOwner: 160,
  slackWorkflowApprovalNote: 1500,
  ingestSourceTools: 50,
  // Activity payload content is classified in memory and discarded.
  // Cap defends the classifier and the rate-limit Map from a 50 MB
  // paste; real prompts are well under 100 KB.
  activityContent: 100_000,
  // Conditions are JSONB; bound the array length and per-condition
  // string sizes to keep policy evaluation cheap.
  policyConditions: 50,
  // Tool list arrays in /api/policy/generate. Real orgs have <500
  // SaaS apps total; 1000 is generous.
  toolListItems: 1000,
  // Manual AI inventory imports are synchronous in the dashboard.
  // Cap size to keep request parsing and preview rendering predictable.
  importCsvContent: 250_000,
  assessmentContactName: 120,
  assessmentCompanyName: 160,
  assessmentGoal: 1500,
  assessmentDeliveryOwner: 160,
  assessmentDeliveryNotes: 3000,
  agentPolicyReviewOwner: 160,
  agentPolicyReviewNote: 3000,
  agentRolloutAcknowledgementNote: 1500,
  agentEvidencePacketTitle: 180,
} as const;
