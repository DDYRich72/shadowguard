/**
 * Minimum-effort password policy. Not a replacement for MFA, but blocks
 * the 99th-percentile credential-spray attacks by itself.
 *
 * Rules:
 *   - ≥ 12 characters
 *   - not on the common-password blocklist (top ~160 worst offenders)
 *   - contains at least 3 of {lowercase, uppercase, digit, symbol} OR
 *     is ≥ 16 characters (long passphrases with 2 classes are fine)
 *
 * Returns a structured result so the UI can show exactly what's wrong
 * instead of a generic "password too weak" message.
 */

// SecLists "10-million-password-list-top-*" top hits + common variants.
// Kept small intentionally; Turnstile + rate limiting do the heavy lifting.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234",
  "passw0rd", "passw0rd1", "p@ssw0rd", "p@ssword", "p@ssword1",
  "qwerty", "qwerty123", "qwerty1234", "qwertyuiop",
  "123456", "1234567", "12345678", "123456789", "1234567890",
  "111111", "000000", "121212", "654321", "987654321",
  "admin", "admin123", "administrator", "root", "letmein",
  "welcome", "welcome1", "welcome123", "login", "monkey",
  "dragon", "sunshine", "princess", "football", "baseball",
  "iloveyou", "trustno1", "whatever", "freedom", "master",
  "ninja", "pokemon", "starwars", "superman", "batman",
  "abc123", "abc12345", "abcd1234", "abcdef", "abcdefg",
  "changeme", "changeme1", "changeme123", "default", "guest",
  "qazwsx", "zxcvbn", "asdfgh", "asdfghjkl", "qwertz",
  "hello", "hello123", "charlie", "michael", "jennifer",
  "summer", "winter", "spring", "autumn", "january",
  "december", "maggie", "cookie", "buster", "hunter",
  "testing", "test123", "test1234", "demo1234", "demo123",
  "letmein123", "letmein1", "qwerty12", "1q2w3e4r", "1qaz2wsx",
  "shadowguard", "agentguard", "shadow123", "agent123",
  "companyname", "company1", "company123", "business1",
  "starter", "business", "enterprise",
]);

export type PasswordCheck = {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4; // 0 = refuse, 4 = excellent
  problems: string[]; // human-readable reasons if !ok
};

export function checkPassword(raw: string): PasswordCheck {
  const problems: string[] = [];

  if (raw.length < 12) {
    problems.push("Use at least 12 characters.");
  }

  if (COMMON_PASSWORDS.has(raw.toLowerCase())) {
    problems.push("This password is on the public leaked-password list.");
  }

  const classes =
    (/[a-z]/.test(raw) ? 1 : 0) +
    (/[A-Z]/.test(raw) ? 1 : 0) +
    (/[0-9]/.test(raw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(raw) ? 1 : 0);

  if (raw.length < 16 && classes < 3) {
    problems.push(
      "Mix at least three of: lowercase, uppercase, digit, symbol — or use a passphrase of 16+ characters."
    );
  }

  // Simple score: useful for UI hint only, not gate.
  let score: PasswordCheck["score"] = 0;
  if (raw.length >= 12) score = 1;
  if (raw.length >= 12 && classes >= 3) score = 2;
  if (raw.length >= 16 && classes >= 2) score = 3;
  if (raw.length >= 20 && classes >= 3) score = 4;
  if (COMMON_PASSWORDS.has(raw.toLowerCase())) score = 0;

  return { ok: problems.length === 0, score, problems };
}

export function passwordStrengthLabel(score: PasswordCheck["score"]): {
  label: string;
  color: string;
} {
  switch (score) {
    case 0: return { label: "too weak", color: "text-red-600" };
    case 1: return { label: "weak", color: "text-orange-600" };
    case 2: return { label: "ok", color: "text-amber-600" };
    case 3: return { label: "good", color: "text-emerald-600" };
    case 4: return { label: "excellent", color: "text-emerald-700" };
  }
}
