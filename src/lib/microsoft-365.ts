/**
 * Microsoft 365 / Entra ID (Azure AD) integration
 * Uses MS Graph API for OAuth token audit log discovery
 */

import { logError } from "./logger";
import { getServerAppUrl } from "./public-url";
import { type OAuthRevocationTarget } from "./oauth-revocation";

const MS_CLIENT_ID = process.env.MS_CLIENT_ID!;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET!;
const MS_TENANT_ID = process.env.MS_TENANT_ID || "common";
const MS_REDIRECT_URI =
  process.env.MS_REDIRECT_URI ||
  `${getServerAppUrl()}/api/auth/microsoft/callback`;

// Safety cap for paginated MS Graph calls. @odata.nextLink chains can
// run long on big tenants; this bounds the pathological case where a
// broken cursor would otherwise spin until the host's function timeout.
const MAX_PAGES = 100;

// Scopes for shadow AI discovery via MS Graph
const SCOPES = [
  "AuditLog.Read.All",        // Sign-in and audit logs
  "Directory.Read.All",       // Users, groups, apps
  "Application.Read.All",     // Service principals / enterprise apps
  "DelegatedPermissionGrant.ReadWrite.All", // Delegated OAuth grant revocation
  "AppRoleAssignment.ReadWrite.All", // Application permission revocation
  "Policy.Read.All",          // Conditional access policies
  "offline_access",           // Refresh token
  "openid",
  "profile",
].join(" ");

// ── OAuth URLs ──

export function getMicrosoftConsentUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    scope: SCOPES,
    response_mode: "query",
    state: state || "",
    prompt: "consent",
  });

  return `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

// ── Token Exchange ──

export interface MsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function getMicrosoftTokens(
  code: string
): Promise<MsTokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    code,
    redirect_uri: MS_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MS token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function refreshMicrosoftToken(
  refreshToken: string
): Promise<MsTokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MS token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ── MS Graph API Helpers ──

interface GraphClient {
  get: (path: string) => Promise<GraphObject>;
}

type GraphObject = Record<string, unknown>;

type GraphAppRoleAssignment = {
  id?: string;
  principalDisplayName?: string;
  principalId?: string;
  resourceDisplayName?: string;
  resourceId?: string;
};

type GraphServicePrincipal = {
  id?: string;
  appId?: string;
  displayName?: string;
  signInAudience?: string;
  verifiedPublisher?: unknown;
  createdDateTime?: string;
};

type GraphOAuthGrant = {
  id?: string;
  consentType?: string;
  clientId?: string;
  scope?: string;
  principal?: {
    displayName?: string;
  };
  principalId?: string;
};

type GraphDirectoryUser = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  accountEnabled?: boolean;
  signInSessionsInfo?: {
    lastSignInDateTime?: string;
  };
};

type GraphVerifiedDomain = {
  name?: string;
};

type ServicePrincipalCache = Map<string, Promise<GraphServicePrincipal | null>>;

function graphNextLink(data: GraphObject): string {
  return typeof data["@odata.nextLink"] === "string"
    ? data["@odata.nextLink"]
    : "";
}

function createGraphClient(accessToken: string): GraphClient {
  return {
    async get(path: string) {
      const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        throw new Error(
          `Graph API error: ${res.status} ${await res.text()}`
        );
      }
      return res.json();
    },
  };
}

async function getServicePrincipalSummary(
  graph: GraphClient,
  servicePrincipalId: string,
  cache: ServicePrincipalCache
): Promise<GraphServicePrincipal | null> {
  if (!servicePrincipalId) return null;
  const cached = cache.get(servicePrincipalId);
  if (cached) return cached;

  const promise = graph
    .get(
      `/servicePrincipals/${encodeURIComponent(
        servicePrincipalId
      )}?$select=id,appId,displayName`
    )
    .then((data) => data as GraphServicePrincipal)
    .catch(() => null);
  cache.set(servicePrincipalId, promise);
  return promise;
}

async function listServicePrincipalAppRoleAssignments(
  graph: GraphClient,
  servicePrincipalId: string
): Promise<GraphAppRoleAssignment[]> {
  const assignments: GraphAppRoleAssignment[] = [];
  let nextLink =
    `/servicePrincipals/${encodeURIComponent(
      servicePrincipalId
    )}/appRoleAssignments?$select=id,principalDisplayName,principalId,resourceDisplayName,resourceId,appRoleId&$top=100`;
  let pages = 0;

  while (nextLink && pages < MAX_PAGES) {
    pages++;
    const data = await graph.get(nextLink);
    if (Array.isArray(data.value)) {
      assignments.push(...(data.value as GraphAppRoleAssignment[]));
    }
    nextLink = graphNextLink(data);
    if (nextLink.startsWith("https://")) {
      nextLink = nextLink.replace("https://graph.microsoft.com/v1.0", "");
    }
  }

  return assignments;
}

// ── Discovery Functions ──

export interface DiscoveredApp {
  appName: string;
  appId: string;
  scopes: string[];
  users: string[];
  lastActive: string;
  source: "microsoft";
  revocationTargets?: OAuthRevocationTarget[];
}

export interface DomainUser {
  email: string;
  name: string;
  lastLogin: string;
  suspended: boolean;
}

/**
 * List all enterprise applications (service principals) with sign-in activity
 * This is the MS equivalent of Google's OAuth token audit
 */
export async function listMicrosoftConnectedApps(
  accessToken: string
): Promise<DiscoveredApp[]> {
  const graph = createGraphClient(accessToken);
  const apps: DiscoveredApp[] = [];
  let appRoleAssignmentsUnavailable = false;

  try {
    // Get all service principals (enterprise apps) — includes third-party SaaS
    let nextLink = `/servicePrincipals?$select=id,appId,displayName,signInAudience,verifiedPublisher,createdDateTime&$top=100`;
    let pages = 0;

    while (nextLink && pages < MAX_PAGES) {
      pages++;
      const data = await graph.get(nextLink);
      const principals = Array.isArray(data.value)
        ? (data.value as GraphServicePrincipal[])
        : [];

      for (const sp of principals) {
        // Skip Microsoft's own apps
        if (sp.signInAudience === "AzureADMyOrg" && !sp.verifiedPublisher) {
          continue;
        }

        let assignments: GraphAppRoleAssignment[] = [];
        if (sp.id && !appRoleAssignmentsUnavailable) {
          try {
            assignments = await listServicePrincipalAppRoleAssignments(graph, sp.id);
          } catch {
            appRoleAssignmentsUnavailable = true;
            console.warn(
              "[ms] appRoleAssignments unavailable; continuing without application permission revocation targets"
            );
          }
        }
        const users = assignments.map(
          (a) => a.principalDisplayName || a.principalId || "Unknown"
        );

        apps.push({
          appName: sp.displayName || "Unknown",
          appId: sp.appId || "",
          scopes: [], // Would need additional API call for delegated permissions
          users,
          lastActive: sp.createdDateTime || new Date().toISOString(),
          source: "microsoft",
          revocationTargets: assignments
            .filter((assignment) => assignment.id)
            .map((assignment) => ({
              provider: "microsoft",
              kind: "app_role_assignment",
              appName: sp.displayName || "Unknown",
              appRoleAssignmentId: assignment.id!,
              clientServicePrincipalId: sp.id,
              principalId: assignment.principalId,
              resourceServicePrincipalId: assignment.resourceId,
              resourceDisplayName: assignment.resourceDisplayName,
              lastSeen: sp.createdDateTime || new Date().toISOString(),
            })),
        });
      }

      nextLink = graphNextLink(data);
      // Convert full URL to relative path
      if (nextLink.startsWith("https://")) {
        nextLink = nextLink.replace("https://graph.microsoft.com/v1.0", "");
      }
    }
    if (pages >= MAX_PAGES && nextLink) {
      console.warn("[ms] listMicrosoftConnectedApps hit pagination cap", { pages: MAX_PAGES });
    }
  } catch (error) {
    logError(error, { fn: "listMicrosoftConnectedApps", source: "microsoft" });
    throw error;
  }

  return apps;
}

/**
 * List OAuth2 permission grants (delegated consents)
 * This catches shadow AI tools that users have consented to
 */
export async function listOAuth2Grants(
  accessToken: string
): Promise<DiscoveredApp[]> {
  const graph = createGraphClient(accessToken);
  const apps: DiscoveredApp[] = [];
  const servicePrincipalCache: ServicePrincipalCache = new Map();

  try {
    let nextLink =
      "/oauth2PermissionGrants?$expand=principal&$top=100";
    let pages = 0;

    while (nextLink && pages < MAX_PAGES) {
      pages++;
      const data = await graph.get(nextLink);
      const grants = Array.isArray(data.value)
        ? (data.value as GraphOAuthGrant[])
        : [];

      for (const grant of grants) {
        if (grant.consentType === "Principal" || grant.consentType === "AllPrincipals") {
          const client = grant.clientId
            ? await getServicePrincipalSummary(
                graph,
                grant.clientId,
                servicePrincipalCache
              )
            : null;
          const appName = client?.displayName || grant.clientId || "Unknown";
          const scopes = (grant.scope || "").split(" ").filter(Boolean);
          apps.push({
            appName,
            appId: client?.appId || grant.clientId || "",
            scopes,
            users: grant.principal
              ? [grant.principal.displayName || grant.principalId || "Unknown"]
              : ["All Users"],
            lastActive: new Date().toISOString(),
            source: "microsoft",
            revocationTargets: grant.id
              ? [
                  {
                    provider: "microsoft",
                    kind: "delegated_oauth2_permission_grant",
                    appName,
                    grantId: grant.id,
                    clientServicePrincipalId: grant.clientId,
                    consentType: grant.consentType,
                    principalId: grant.principalId,
                    scopes,
                    lastSeen: new Date().toISOString(),
                  },
                ]
              : [],
          });
        }
      }

      nextLink = graphNextLink(data);
      if (nextLink.startsWith("https://")) {
        nextLink = nextLink.replace("https://graph.microsoft.com/v1.0", "");
      }
    }
    if (pages >= MAX_PAGES && nextLink) {
      console.warn("[ms] listOAuth2Grants hit pagination cap", { pages: MAX_PAGES });
    }
  } catch (error) {
    logError(error, { fn: "listOAuth2Grants", source: "microsoft" });
    throw error;
  }

  return apps;
}

/**
 * List all users in the tenant
 */
export async function listMicrosoftUsers(
  accessToken: string
): Promise<DomainUser[]> {
  const graph = createGraphClient(accessToken);
  const users: DomainUser[] = [];

  try {
    let nextLink =
      "/users?$select=displayName,mail,userPrincipalName,accountEnabled,signInSessionsInfo&$top=100";
    let pages = 0;

    while (nextLink && pages < MAX_PAGES) {
      pages++;
      const data = await graph.get(nextLink);
      const items = Array.isArray(data.value)
        ? (data.value as GraphDirectoryUser[])
        : [];

      for (const user of items) {
        users.push({
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || "",
          lastLogin: user.signInSessionsInfo?.lastSignInDateTime || "",
          suspended: user.accountEnabled === false,
        });
      }

      nextLink = graphNextLink(data);
      if (nextLink.startsWith("https://")) {
        nextLink = nextLink.replace("https://graph.microsoft.com/v1.0", "");
      }
    }
    if (pages >= MAX_PAGES && nextLink) {
      console.warn("[ms] listMicrosoftUsers hit pagination cap", { pages: MAX_PAGES });
    }
  } catch (error) {
    logError(error, { fn: "listMicrosoftUsers", source: "microsoft" });
    throw error;
  }

  return users;
}

/**
 * Get organization info from MS Graph
 */
export async function getMicrosoftOrgInfo(
  accessToken: string
): Promise<{ name: string; id: string; domains: string[] }> {
  const graph = createGraphClient(accessToken);

  const org = await graph.get("/organization?$select=displayName,id,verifiedDomains");
  const orgData = Array.isArray(org.value)
    ? (org.value[0] as GraphObject | undefined) ?? {}
    : {};

  return {
    name: typeof orgData.displayName === "string" ? orgData.displayName : "Unknown",
    id: typeof orgData.id === "string" ? orgData.id : "",
    domains: Array.isArray(orgData.verifiedDomains)
      ? (orgData.verifiedDomains as GraphVerifiedDomain[])
          .map((d) => d.name)
          .filter((name): name is string => Boolean(name))
      : [],
  };
}
