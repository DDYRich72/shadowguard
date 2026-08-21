import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HealthConfiguration = {
  appUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
};

function parseHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

export function readHealthConfiguration(
  env: NodeJS.ProcessEnv = process.env
): HealthConfiguration | null {
  const appUrl = parseHttpUrl(env.APP_BASE_URL ?? env.NEXT_PUBLIC_APP_URL);
  const supabaseUrl = parseHttpUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!appUrl || !supabaseUrl || !anonKey || !serviceRoleKey) return null;
  return { appUrl, supabaseUrl, serviceRoleKey };
}

function response(status: "ok" | "unavailable", httpStatus: 200 | 503) {
  return NextResponse.json(
    { status },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

export async function GET() {
  const config = readHealthConfiguration();
  if (!config) return response("unavailable", 503);

  try {
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) return response("unavailable", 503);
    return response("ok", 200);
  } catch {
    return response("unavailable", 503);
  }
}
