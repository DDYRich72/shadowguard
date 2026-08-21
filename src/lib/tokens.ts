/**
 * Encrypted OAuth token storage + refresh.
 *
 * Tokens live on organizations (one admin connects, org-wide scan).
 * We read ciphertext, decrypt, and auto-refresh when the access token
 * expires within REFRESH_WINDOW_MS. Rotated refresh tokens are written
 * back to the DB.
 *
 * Callers just want a working access token — refresh is invisible.
 */

import { google } from "googleapis";
import { createAdminSupabase } from "./supabase/server";
import { encrypt, decrypt } from "./crypto";
import { refreshMicrosoftToken } from "./microsoft-365";

const REFRESH_WINDOW_MS = 5 * 60 * 1000; // refresh if <5 min left

function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() < REFRESH_WINDOW_MS;
}

// ── Google ──────────────────────────────────────────────────────────

export async function saveGoogleTokens(
  orgId: string,
  tokens: {
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }
): Promise<void> {
  const admin = createAdminSupabase();
  const patch: Record<string, unknown> = {
    google_connected: true,
    google_access_token: await encrypt(tokens.access_token),
    google_token_expires_at: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
  };
  if (tokens.refresh_token) {
    patch.google_refresh_token = await encrypt(tokens.refresh_token);
  }
  const { error } = await admin.from("organizations").update(patch).eq("id", orgId);
  if (error) throw new Error(`saveGoogleTokens: ${error.message}`);
}

export async function getGoogleAccessToken(orgId: string): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("organizations")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", orgId)
    .single();
  if (error || !data) {
    throw new Error("Google Workspace not connected for this organization.");
  }
  if (!data.google_access_token) {
    throw new Error("Google Workspace not connected for this organization.");
  }

  if (!isExpiringSoon(data.google_token_expires_at)) {
    return decrypt(data.google_access_token);
  }

  // Refresh.
  if (!data.google_refresh_token) {
    throw new Error("Google access token expired and no refresh token on file.");
  }
  const refreshToken = await decrypt(data.google_refresh_token);
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Google token refresh returned no access_token.");
  }

  await saveGoogleTokens(orgId, {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token ?? refreshToken,
    expiry_date: credentials.expiry_date ?? null,
  });

  return credentials.access_token;
}

// ── Microsoft ───────────────────────────────────────────────────────

export async function saveMicrosoftTokens(
  orgId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in: number }
): Promise<void> {
  const admin = createAdminSupabase();
  const patch: Record<string, unknown> = {
    microsoft_connected: true,
    ms_access_token: await encrypt(tokens.access_token),
    ms_token_expires_at: new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString(),
  };
  if (tokens.refresh_token) {
    patch.ms_refresh_token = await encrypt(tokens.refresh_token);
  }
  const { error } = await admin.from("organizations").update(patch).eq("id", orgId);
  if (error) throw new Error(`saveMicrosoftTokens: ${error.message}`);
}

export async function getMicrosoftAccessToken(orgId: string): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("organizations")
    .select("ms_access_token, ms_refresh_token, ms_token_expires_at")
    .eq("id", orgId)
    .single();
  if (error || !data || !data.ms_access_token) {
    throw new Error("Microsoft 365 not connected for this organization.");
  }

  if (!isExpiringSoon(data.ms_token_expires_at)) {
    return decrypt(data.ms_access_token);
  }

  if (!data.ms_refresh_token) {
    throw new Error("Microsoft access token expired and no refresh token on file.");
  }
  const refreshToken = await decrypt(data.ms_refresh_token);
  const refreshed = await refreshMicrosoftToken(refreshToken);

  await saveMicrosoftTokens(orgId, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? refreshToken,
    expires_in: refreshed.expires_in,
  });

  return refreshed.access_token;
}

// ── Shared: resolve org_id from the signed-in session ───────────────

export async function getSessionOrgId(): Promise<string | null> {
  const { createServerSupabase } = await import("./supabase/server");
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.org_id ?? null;
}
