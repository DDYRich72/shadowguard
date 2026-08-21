/**
 * OAuth state/CSRF protection.
 *
 * Mints a random nonce, stashes it in a short-lived httpOnly cookie,
 * and echoes it as the `state` parameter on the consent URL. The
 * callback verifies the round-trip with a timing-safe compare before
 * exchanging the code. Without this, an attacker can trick a logged-in
 * admin into visiting a crafted callback URL and graft the attacker's
 * Google/Microsoft account onto the victim's organization.
 */

import { cookies } from "next/headers";
import { webcrypto } from "node:crypto";

const COOKIE_MAX_AGE = 10 * 60; // 10 minutes

type Provider = "google" | "microsoft";

function cookieName(provider: Provider): string {
  return `oauth_state_${provider}`;
}

/**
 * Cookies are marked Secure whenever we know the deployment is on
 * HTTPS — either because APP_BASE_URL says so, or because we're in
 * NODE_ENV=production. This means a misconfigured staging URL that
 * forgets to set NODE_ENV will still get Secure cookies as long as
 * APP_BASE_URL points at https.
 */
function isSecureDeployment(): boolean {
  if (process.env.APP_BASE_URL?.startsWith("https://")) return true;
  return process.env.NODE_ENV === "production";
}

export async function mintOAuthState(provider: Provider): Promise<string> {
  const bytes = webcrypto.getRandomValues(new Uint8Array(32));
  const state = Buffer.from(bytes).toString("base64url");
  const store = await cookies();
  store.set(cookieName(provider), state, {
    httpOnly: true,
    secure: isSecureDeployment(),
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return state;
}

export async function verifyOAuthState(
  provider: Provider,
  received: string | null
): Promise<boolean> {
  if (!received) return false;
  const store = await cookies();
  const cookie = store.get(cookieName(provider));
  if (!cookie) return false;

  const a = Buffer.from(cookie.value);
  const b = Buffer.from(received);
  if (a.length !== b.length) {
    store.delete(cookieName(provider));
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];

  // Single-use: burn the cookie whether match or not.
  store.delete(cookieName(provider));
  return result === 0;
}
