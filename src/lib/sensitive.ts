/**
 * Branded `SensitiveContent` type for raw user-supplied content
 * (prompts, file uploads, AI responses) that must never be logged,
 * persisted, or echoed back to clients.
 *
 * The type has two layers of defence:
 *
 *   - Compile-time: SensitiveContent is opaque. You can't pass it to
 *     anything expecting a `string` without explicitly unwrapping
 *     via `unwrapForClassification()`. The unwrap function name is
 *     deliberately long and unlovely — grep for it during reviews.
 *
 *   - Runtime: the wrapped value implements `Symbol.toPrimitive` so
 *     accidental string coercion (`console.log(c)`,
 *     `JSON.stringify(c)`, template literal interpolation) renders
 *     a `<sensitive>` placeholder instead of the real content.
 *
 * What you CAN do safely with a SensitiveContent:
 *   - `lengthOf(c)`            — get the character length (we persist this)
 *   - `unwrapForClassification(c)` — when calling the classifier
 *
 * What you CANNOT do (without explicit unwrap):
 *   - log it, JSON-encode it, store it, return it from a handler,
 *     attach it to an error message, or use it in a template literal.
 *
 * A future ESLint rule (roadmap t) will flag accidental unwrap
 * outside an allowlist of call sites. Until then this is honor-
 * system + Symbol.toPrimitive backstop.
 */

const SENSITIVE_BRAND: unique symbol = Symbol("SensitiveContent");

export type SensitiveContent = {
  readonly [SENSITIVE_BRAND]: true;
};

/** Wrap a raw string. Call as soon as the value crosses the API boundary. */
export function markSensitive(value: string): SensitiveContent {
  const length = value.length;
  // The actual content lives on a non-enumerable symbol-keyed slot
  // so JSON.stringify and Object.keys can't see it.
  const contentSlot: unique symbol = Symbol("content");
  const obj = {
    [SENSITIVE_BRAND]: true as const,
    [Symbol.toPrimitive]() {
      return "<sensitive>";
    },
    toString() {
      return "<sensitive>";
    },
    toJSON() {
      return "<sensitive>";
    },
    [contentSlot]: value,
    __length: length,
  } as Record<PropertyKey, unknown> & SensitiveContent;
  // Stash the unwrap accessor where only this module can find it.
  unwrapTable.set(obj, value);
  return obj;
}

// Module-private map: SensitiveContent -> raw string. Not exported.
// The only way to read the raw value is via unwrapForClassification().
const unwrapTable = new WeakMap<SensitiveContent, string>();

/**
 * Get the raw string back. Use ONLY at the classification call site.
 * Every call to this function should appear at most once per route
 * handler, immediately before passing the result to the classifier.
 *
 * Future ESLint rule will flag calls outside the allowlist:
 *   - src/app/api/agent-guard/activity/route.ts
 *   - src/app/api/agent-guard/kill-switch/route.ts
 */
export function unwrapForClassification(c: SensitiveContent): string {
  const raw = unwrapTable.get(c);
  if (raw === undefined) {
    throw new Error(
      "unwrapForClassification: value is not a registered SensitiveContent"
    );
  }
  return raw;
}

/** Character length of the wrapped content. Safe to log + persist. */
export function lengthOf(c: SensitiveContent): number {
  return (c as unknown as { __length: number }).__length;
}

/** Type guard. */
export function isSensitive(value: unknown): value is SensitiveContent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[SENSITIVE_BRAND] === true
  );
}
