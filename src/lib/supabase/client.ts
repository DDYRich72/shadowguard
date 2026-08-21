import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for client components (browser). Session lives in cookies.
 * Never import this file from server-only code that already has its own
 * session handling.
 */
export function createBrowserSupabase() {
  return createSsrBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Password recovery links are often opened from an email client, another
 * browser, or another device. Do not generate PKCE recovery links here; a PKCE
 * verifier only exists in the browser that requested the email.
 */
export function createPasswordRecoverySupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
        persistSession: false,
      },
    }
  );
}
