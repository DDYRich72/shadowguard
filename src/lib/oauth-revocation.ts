export type OAuthProvider = "google" | "microsoft";

export type OAuthRevocationStatus =
  | "success"
  | "already_revoked"
  | "not_found"
  | "missing_provider_connection"
  | "missing_provider_permission"
  | "provider_rate_limited"
  | "provider_error"
  | "unsupported_provider";

export type GoogleOAuthRevocationTarget = {
  provider: "google";
  kind: "google_workspace_token";
  clientId: string;
  userKey: string;
  appName?: string;
  scopes?: string[];
  lastSeen?: string;
};

export type MicrosoftDelegatedRevocationTarget = {
  provider: "microsoft";
  kind: "delegated_oauth2_permission_grant";
  grantId: string;
  clientServicePrincipalId?: string;
  consentType?: "Principal" | "AllPrincipals";
  principalId?: string;
  appName?: string;
  scopes?: string[];
  lastSeen?: string;
};

export type MicrosoftAppRoleRevocationTarget = {
  provider: "microsoft";
  kind: "app_role_assignment";
  appRoleAssignmentId: string;
  clientServicePrincipalId?: string;
  resourceServicePrincipalId?: string;
  principalId?: string;
  appName?: string;
  resourceDisplayName?: string;
  lastSeen?: string;
};

export type OAuthRevocationTarget =
  | GoogleOAuthRevocationTarget
  | MicrosoftDelegatedRevocationTarget
  | MicrosoftAppRoleRevocationTarget;

export type OAuthRevocationCapability = {
  provider: OAuthProvider;
  canRevoke: string[];
  requiredProviderPermissions: string[];
  adminRoleAssumptions: string[];
  unsupportedCases: string[];
  apiReferences: string[];
};

export const OAUTH_REVOCATION_CAPABILITY_MAP: Record<
  OAuthProvider,
  OAuthRevocationCapability
> = {
  google: {
    provider: "google",
    canRevoke: [
      "Per-user Google Workspace OAuth tokens for a recorded application client ID.",
    ],
    requiredProviderPermissions: [
      "https://www.googleapis.com/auth/admin.directory.user.security",
    ],
    adminRoleAssumptions: [
      "The connected Google Workspace account can call Admin SDK Directory API token deletion for the target users.",
    ],
    unsupportedCases: [
      "Rows without a recorded Google userKey/clientId target.",
      "Consumer Google accounts outside the connected Workspace tenant.",
      "Revoking an application's publisher registration or non-OAuth provider-side data already copied by the vendor.",
    ],
    apiReferences: [
      "https://developers.google.com/workspace/admin/directory/reference/rest/v1/tokens/delete",
    ],
  },
  microsoft: {
    provider: "microsoft",
    canRevoke: [
      "Microsoft Graph delegated OAuth2 permission grants.",
      "Microsoft Graph app role assignments that represent application permissions.",
    ],
    requiredProviderPermissions: [
      "DelegatedPermissionGrant.ReadWrite.All",
      "AppRoleAssignment.ReadWrite.All",
    ],
    adminRoleAssumptions: [
      "The connected Microsoft 365 account is assigned a supported Microsoft Entra role for grant and app-role-assignment deletion.",
    ],
    unsupportedCases: [
      "Rows without a recorded Microsoft grant ID or appRoleAssignment ID.",
      "Personal Microsoft accounts.",
      "Deleting the service principal or application registration itself.",
      "Invalidating already-issued access tokens before their natural lifetime expires.",
    ],
    apiReferences: [
      "https://learn.microsoft.com/en-us/graph/api/oauth2permissiongrant-delete",
      "https://learn.microsoft.com/en-us/graph/api/serviceprincipal-delete-approleassignedto",
      "https://learn.microsoft.com/en-us/graph/api/serviceprincipal-delete-approleassignments",
    ],
  },
};

export type OAuthTargetRevocationResult = {
  targetKey: string;
  status: OAuthRevocationStatus;
  providerStatus?: number;
  providerErrorCategory?: string;
};

export type OAuthProviderRevocationResult = {
  provider: OAuthProvider;
  status: OAuthRevocationStatus;
  targetCount: number;
  revokedTargetCount: number;
  alreadyRevokedTargetCount: number;
  targetResults: OAuthTargetRevocationResult[];
  providerErrorCategory?: string;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  }
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

function stringArrayField(
  value: Record<string, unknown>,
  key: string
): string[] | undefined {
  const field = value[key];
  if (!Array.isArray(field)) return undefined;
  return field.filter((item): item is string => typeof item === "string");
}

export function normalizeRevocationTargets(
  raw: unknown
): OAuthRevocationTarget[] {
  if (!Array.isArray(raw)) return [];

  const targets: OAuthRevocationTarget[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const provider = stringField(item, "provider");
    const kind = stringField(item, "kind");

    if (provider === "google" && kind === "google_workspace_token") {
      const clientId = stringField(item, "clientId");
      const userKey = stringField(item, "userKey");
      if (!clientId || !userKey) continue;
      targets.push({
        provider,
        kind,
        clientId,
        userKey,
        appName: stringField(item, "appName"),
        scopes: stringArrayField(item, "scopes"),
        lastSeen: stringField(item, "lastSeen"),
      });
      continue;
    }

    if (
      provider === "microsoft" &&
      kind === "delegated_oauth2_permission_grant"
    ) {
      const grantId = stringField(item, "grantId");
      if (!grantId) continue;
      const consentType = stringField(item, "consentType");
      targets.push({
        provider,
        kind,
        grantId,
        clientServicePrincipalId: stringField(
          item,
          "clientServicePrincipalId"
        ),
        consentType:
          consentType === "Principal" || consentType === "AllPrincipals"
            ? consentType
            : undefined,
        principalId: stringField(item, "principalId"),
        appName: stringField(item, "appName"),
        scopes: stringArrayField(item, "scopes"),
        lastSeen: stringField(item, "lastSeen"),
      });
      continue;
    }

    if (provider === "microsoft" && kind === "app_role_assignment") {
      const appRoleAssignmentId = stringField(item, "appRoleAssignmentId");
      if (!appRoleAssignmentId) continue;
      targets.push({
        provider,
        kind,
        appRoleAssignmentId,
        clientServicePrincipalId: stringField(
          item,
          "clientServicePrincipalId"
        ),
        resourceServicePrincipalId: stringField(
          item,
          "resourceServicePrincipalId"
        ),
        principalId: stringField(item, "principalId"),
        appName: stringField(item, "appName"),
        resourceDisplayName: stringField(item, "resourceDisplayName"),
        lastSeen: stringField(item, "lastSeen"),
      });
    }
  }

  return mergeRevocationTargets(targets);
}

export function revocationTargetKey(target: OAuthRevocationTarget): string {
  if (target.provider === "google") {
    return `google:${target.userKey.toLowerCase()}:${target.clientId}`;
  }
  if (target.kind === "delegated_oauth2_permission_grant") {
    return `microsoft:delegated:${target.grantId}`;
  }
  return `microsoft:appRole:${target.appRoleAssignmentId}`;
}

export function mergeRevocationTargets(
  targets: OAuthRevocationTarget[]
): OAuthRevocationTarget[] {
  const byKey = new Map<string, OAuthRevocationTarget>();
  for (const target of targets) {
    byKey.set(revocationTargetKey(target), target);
  }
  return [...byKey.values()];
}

function providerStatusToResult(status: number): OAuthRevocationStatus {
  if (status >= 200 && status < 300) return "success";
  if (status === 404) return "already_revoked";
  if (status === 401 || status === 403) return "missing_provider_permission";
  if (status === 429) return "provider_rate_limited";
  return "provider_error";
}

function aggregateStatus(
  targetResults: OAuthTargetRevocationResult[]
): OAuthRevocationStatus {
  if (targetResults.length === 0) return "missing_provider_permission";
  if (targetResults.every((result) => result.status === "success")) {
    return "success";
  }
  if (
    targetResults.every(
      (result) =>
        result.status === "success" ||
        result.status === "already_revoked" ||
        result.status === "not_found"
    )
  ) {
    return targetResults.some((result) => result.status === "success")
      ? "success"
      : "already_revoked";
  }
  if (targetResults.some((result) => result.status === "provider_rate_limited")) {
    return "provider_rate_limited";
  }
  if (
    targetResults.some(
      (result) => result.status === "missing_provider_permission"
    )
  ) {
    return "missing_provider_permission";
  }
  if (targetResults.some((result) => result.status === "unsupported_provider")) {
    return "unsupported_provider";
  }
  return "provider_error";
}

function providerDeleteHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

async function deleteProviderResource(params: {
  url: string;
  accessToken: string;
  fetcher: FetchLike;
  targetKey: string;
}): Promise<OAuthTargetRevocationResult> {
  try {
    const response = await params.fetcher(params.url, {
      method: "DELETE",
      headers: providerDeleteHeaders(params.accessToken),
    });
    const status = providerStatusToResult(response.status);
    return {
      targetKey: params.targetKey,
      status,
      providerStatus: response.status,
      providerErrorCategory: status === "success" ? undefined : `http_${response.status}`,
    };
  } catch {
    return {
      targetKey: params.targetKey,
      status: "provider_error",
      providerErrorCategory: "network_error",
    };
  }
}

async function revokeGoogleTarget(
  target: OAuthRevocationTarget,
  accessToken: string,
  fetcher: FetchLike
): Promise<OAuthTargetRevocationResult> {
  const targetKey = revocationTargetKey(target);
  if (target.provider !== "google") {
    return { targetKey, status: "unsupported_provider" };
  }
  const userKey = encodeURIComponent(target.userKey);
  const clientId = encodeURIComponent(target.clientId);
  return deleteProviderResource({
    url: `https://admin.googleapis.com/admin/directory/v1/users/${userKey}/tokens/${clientId}`,
    accessToken,
    fetcher,
    targetKey,
  });
}

function microsoftDeletePath(target: OAuthRevocationTarget): string | null {
  if (target.provider !== "microsoft") return null;
  if (target.kind === "delegated_oauth2_permission_grant") {
    return `/oauth2PermissionGrants/${encodeURIComponent(target.grantId)}`;
  }
  const assignmentId = encodeURIComponent(target.appRoleAssignmentId);
  if (target.resourceServicePrincipalId) {
    return `/servicePrincipals/${encodeURIComponent(
      target.resourceServicePrincipalId
    )}/appRoleAssignedTo/${assignmentId}`;
  }
  if (target.clientServicePrincipalId) {
    return `/servicePrincipals/${encodeURIComponent(
      target.clientServicePrincipalId
    )}/appRoleAssignments/${assignmentId}`;
  }
  return null;
}

async function revokeMicrosoftTarget(
  target: OAuthRevocationTarget,
  accessToken: string,
  fetcher: FetchLike
): Promise<OAuthTargetRevocationResult> {
  const targetKey = revocationTargetKey(target);
  const path = microsoftDeletePath(target);
  if (!path) {
    return {
      targetKey,
      status: "missing_provider_permission",
      providerErrorCategory: "missing_grant_identifier",
    };
  }
  return deleteProviderResource({
    url: `https://graph.microsoft.com/v1.0${path}`,
    accessToken,
    fetcher,
    targetKey,
  });
}

export async function revokeProviderTargets(params: {
  provider: OAuthProvider;
  accessToken: string;
  targets: OAuthRevocationTarget[];
  fetcher?: FetchLike;
}): Promise<OAuthProviderRevocationResult> {
  const fetcher = params.fetcher ?? fetch;
  const targets = mergeRevocationTargets(
    params.targets.filter((target) => target.provider === params.provider)
  );

  const targetResults: OAuthTargetRevocationResult[] = [];
  for (const target of targets) {
    targetResults.push(
      params.provider === "google"
        ? await revokeGoogleTarget(target, params.accessToken, fetcher)
        : await revokeMicrosoftTarget(target, params.accessToken, fetcher)
    );
  }

  const status = aggregateStatus(targetResults);
  return {
    provider: params.provider,
    status,
    targetCount: targets.length,
    revokedTargetCount: targetResults.filter(
      (result) => result.status === "success"
    ).length,
    alreadyRevokedTargetCount: targetResults.filter(
      (result) =>
        result.status === "already_revoked" || result.status === "not_found"
    ).length,
    targetResults,
    providerErrorCategory: targetResults.find(
      (result) =>
        result.status !== "success" &&
        result.status !== "already_revoked" &&
        result.status !== "not_found"
    )?.providerErrorCategory,
  };
}

export function revocationSucceeded(status: OAuthRevocationStatus): boolean {
  return status === "success" || status === "already_revoked" || status === "not_found";
}
