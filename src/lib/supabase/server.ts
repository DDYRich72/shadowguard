import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side Supabase client for route handlers and server components.
 * Reads/writes session cookies; RLS applies.
 * `cookies()` is async in Next.js 16.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createSsrServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll called from a server component; Supabase SSR docs say to
          // ignore — the session will be refreshed on the next route handler.
        }
      },
    },
  });
}

/**
 * Service-role Supabase client. Bypasses RLS. Use only for webhooks, signup
 * bootstrap, or similarly trusted paths. Never import into client code.
 */
export function createAdminSupabase() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
