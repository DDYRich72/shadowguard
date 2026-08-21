import { google } from "googleapis";
import { logError } from "./logger";
import { getServerAppUrl } from "./public-url";
import { mergeRevocationTargets, type OAuthRevocationTarget } from "./oauth-revocation";

// Google Workspace OAuth2 configuration
// These will be set from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${getServerAppUrl()}/api/auth/google/callback`;

// Safety cap for paginated Google Admin SDK calls. A broken nextPageToken
// (or a tenant with genuinely absurd scale) would otherwise spin the loop
// until the host's function timeout. 100 pages × 1000 per page = 100k
// records — enough for any real tenant, bounded for the pathological case.
const MAX_PAGES = 100;

// Scopes needed for shadow AI discovery
const SCOPES = [
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",  // OAuth token audit logs
  "https://www.googleapis.com/auth/admin.directory.user.security", // OAuth token revocation
  "https://www.googleapis.com/auth/admin.directory.user.readonly", // User directory
  "https://www.googleapis.com/auth/admin.directory.domain.readonly", // Domain info
  "https://www.googleapis.com/auth/userinfo.email",                // Admin email
  "openid",
];

/**
 * Create a Google OAuth2 client
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google Workspace admin consent URL
 * The admin must visit this URL to authorize ShadowGuard
 */
export function getAdminConsentUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: state || "",
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * List all third-party OAuth apps connected to the domain
 * This is the core discovery function
 */
export async function listConnectedApps(
  accessToken: string,
  _domain: string
): Promise<DiscoveredApp[]> {
  void _domain;
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const admin = google.admin({ version: "reports_v1", auth: oauth2Client });

  const apps: DiscoveredApp[] = [];
  const seenApps = new Set<string>();

  try {
    // Get OAuth token usage events from the last 90 days
    let pageToken: string | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore && pages < MAX_PAGES) {
      pages++;
      const response = await admin.activities.list({
        userKey: "all",
        applicationName: "token",
        maxResults: 1000,
        pageToken,
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const activities = response.data.items || [];

      for (const activity of activities) {
        const events = activity.events || [];
        const userEmail = activity.actor?.email || "";

        for (const event of events) {
          const params = event.parameters || [];
          const clientId = getStringParam(params, "client_id");
          const appName = getStringParam(params, "app_name") || clientId || "Unknown";
          const scopes = getStringParam(params, "scope")?.split(" ") || [];
          const eventType = event.name || "";

          // Only track actual OAuth grants (not revocations)
          if (eventType === "authorize" || eventType === "grant") {
            const appKey = `${appName}:${scopes.join(",")}`;

            if (!seenApps.has(appKey)) {
              seenApps.add(appKey);
              apps.push({
                appName,
                clientId,
                scopes,
                users: [userEmail],
                lastActive: activity.id?.time || new Date().toISOString(),
                eventType,
                revocationTargets: googleRevocationTargets({
                  appName,
                  clientId,
                  scopes,
                  userEmail,
                  lastSeen: activity.id?.time,
                }),
              });
            } else {
              // Add user to existing app
              const existingApp = apps.find((a) => `${a.appName}:${a.scopes.join(",")}` === appKey);
              if (existingApp && !existingApp.users.includes(userEmail)) {
                existingApp.users.push(userEmail);
              }
              if (existingApp) {
                existingApp.revocationTargets = mergeRevocationTargets([
                  ...(existingApp.revocationTargets ?? []),
                  ...googleRevocationTargets({
                    appName,
                    clientId,
                    scopes,
                    userEmail,
                    lastSeen: activity.id?.time,
                  }),
                ]);
              }
            }
          }
        }
      }

      pageToken = response.data.nextPageToken || undefined;
      hasMore = !!pageToken;
    }
    if (pages >= MAX_PAGES && hasMore) {
      console.warn("[google] listConnectedApps hit pagination cap", { pages: MAX_PAGES });
    }
  } catch (error) {
    logError(error, { fn: "listConnectedApps", source: "google" });
    throw error;
  }

  return apps;
}

/**
 * List all users in the domain
 */
export async function listDomainUsers(
  accessToken: string,
  domain: string
): Promise<DomainUser[]> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const admin = google.admin({ version: "directory_v1", auth: oauth2Client });

  const users: DomainUser[] = [];
  let pageToken: string | undefined;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < MAX_PAGES) {
    pages++;
    const response = await admin.users.list({
      domain,
      maxResults: 500,
      pageToken,
    });

    const items = response.data.users || [];
    for (const user of items) {
      users.push({
        email: user.primaryEmail || "",
        name: user.name?.fullName || "",
        lastLogin: user.lastLoginTime || "",
        suspended: user.suspended || false,
      });
    }

    pageToken = response.data.nextPageToken || undefined;
    hasMore = !!pageToken;
  }
  if (pages >= MAX_PAGES && hasMore) {
    console.warn("[google] listDomainUsers hit pagination cap", { pages: MAX_PAGES });
  }

  return users;
}

/**
 * Get domain info
 */
export async function getDomainInfo(
  accessToken: string,
  domain: string
): Promise<{ name: string; verified: boolean }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const admin = google.admin({ version: "directory_v1", auth: oauth2Client });

  const response = await admin.domains.get({
    customer: "my_customer",
    domainName: domain,
  });

  return {
    name: response.data.domainName || domain,
    verified: response.data.verified || false,
  };
}

// ── Helper Types ──

export interface DiscoveredApp {
  appName: string;
  clientId?: string;
  scopes: string[];
  users: string[];
  lastActive: string;
  eventType: string;
  revocationTargets?: OAuthRevocationTarget[];
}

export interface DomainUser {
  email: string;
  name: string;
  lastLogin: string;
  suspended: boolean;
}

// ── Helpers ──

function getStringParam(params: Array<{ name?: string; value?: string }>, name: string): string {
  const param = params.find((p) => p.name === name);
  return param?.value || "";
}

function googleRevocationTargets(params: {
  appName: string;
  clientId: string;
  scopes: string[];
  userEmail: string;
  lastSeen?: string;
}): OAuthRevocationTarget[] {
  if (!params.clientId || !params.userEmail) return [];
  return [
    {
      provider: "google",
      kind: "google_workspace_token",
      appName: params.appName,
      clientId: params.clientId,
      userKey: params.userEmail,
      scopes: params.scopes,
      lastSeen: params.lastSeen,
    },
  ];
}
