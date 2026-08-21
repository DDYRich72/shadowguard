import { describe, expect, it, vi } from "vitest";
import {
  OAUTH_REVOCATION_CAPABILITY_MAP,
  normalizeRevocationTargets,
  revokeProviderTargets,
} from "../oauth-revocation";

function response(status: number) {
  return new Response(null, { status });
}

describe("OAuth revocation capability map", () => {
  it("documents supported providers, required permissions, and APIs", () => {
    expect(OAUTH_REVOCATION_CAPABILITY_MAP.google.requiredProviderPermissions).toContain(
      "https://www.googleapis.com/auth/admin.directory.user.security"
    );
    expect(OAUTH_REVOCATION_CAPABILITY_MAP.google.apiReferences[0]).toContain(
      "tokens/delete"
    );
    expect(
      OAUTH_REVOCATION_CAPABILITY_MAP.microsoft.requiredProviderPermissions
    ).toEqual(
      expect.arrayContaining([
        "DelegatedPermissionGrant.ReadWrite.All",
        "AppRoleAssignment.ReadWrite.All",
      ])
    );
    expect(OAUTH_REVOCATION_CAPABILITY_MAP.microsoft.apiReferences).toEqual(
      expect.arrayContaining([
        expect.stringContaining("oauth2permissiongrant-delete"),
        expect.stringContaining("serviceprincipal-delete-approleassignedto"),
      ])
    );
  });
});

describe("normalizeRevocationTargets", () => {
  it("keeps valid provider targets and deduplicates them", () => {
    const targets = normalizeRevocationTargets([
      {
        provider: "google",
        kind: "google_workspace_token",
        clientId: "client-1",
        userKey: "User@Example.com",
      },
      {
        provider: "google",
        kind: "google_workspace_token",
        clientId: "client-1",
        userKey: "user@example.com",
      },
      {
        provider: "microsoft",
        kind: "delegated_oauth2_permission_grant",
        grantId: "grant-1",
      },
      { provider: "google", kind: "google_workspace_token" },
    ]);

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.provider)).toEqual([
      "google",
      "microsoft",
    ]);
  });
});

describe("revokeProviderTargets", () => {
  it("deletes Google Workspace user token grants by userKey and clientId", async () => {
    const fetcher = vi.fn(async () => response(204));

    const result = await revokeProviderTargets({
      provider: "google",
      accessToken: "google-token",
      targets: [
        {
          provider: "google",
          kind: "google_workspace_token",
          userKey: "admin@example.com",
          clientId: "client-123",
        },
      ],
      fetcher,
    });

    expect(result.status).toBe("success");
    expect(result.revokedTargetCount).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://admin.googleapis.com/admin/directory/v1/users/admin%40example.com/tokens/client-123",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer google-token",
        }),
      })
    );
  });

  it("treats provider 404s as idempotent already-revoked results", async () => {
    const fetcher = vi.fn(async () => response(404));

    const result = await revokeProviderTargets({
      provider: "google",
      accessToken: "google-token",
      targets: [
        {
          provider: "google",
          kind: "google_workspace_token",
          userKey: "admin@example.com",
          clientId: "client-123",
        },
      ],
      fetcher,
    });

    expect(result.status).toBe("already_revoked");
    expect(result.alreadyRevokedTargetCount).toBe(1);
  });

  it("deletes Microsoft delegated OAuth2 permission grants", async () => {
    const fetcher = vi.fn(async () => response(204));

    const result = await revokeProviderTargets({
      provider: "microsoft",
      accessToken: "ms-token",
      targets: [
        {
          provider: "microsoft",
          kind: "delegated_oauth2_permission_grant",
          grantId: "grant-123",
        },
      ],
      fetcher,
    });

    expect(result.status).toBe("success");
    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/oauth2PermissionGrants/grant-123",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer ms-token" }),
      })
    );
  });

  it("deletes Microsoft app role assignments through the resource service principal", async () => {
    const fetcher = vi.fn(async () => response(204));

    const result = await revokeProviderTargets({
      provider: "microsoft",
      accessToken: "ms-token",
      targets: [
        {
          provider: "microsoft",
          kind: "app_role_assignment",
          appRoleAssignmentId: "assignment-123",
          clientServicePrincipalId: "client-sp-1",
          resourceServicePrincipalId: "resource-sp-1",
        },
      ],
      fetcher,
    });

    expect(result.status).toBe("success");
    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/servicePrincipals/resource-sp-1/appRoleAssignedTo/assignment-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("maps provider throttling and permission failures to stable result states", async () => {
    const throttled = await revokeProviderTargets({
      provider: "microsoft",
      accessToken: "ms-token",
      targets: [
        {
          provider: "microsoft",
          kind: "delegated_oauth2_permission_grant",
          grantId: "grant-123",
        },
      ],
      fetcher: vi.fn(async () => response(429)),
    });
    expect(throttled.status).toBe("provider_rate_limited");

    const permission = await revokeProviderTargets({
      provider: "microsoft",
      accessToken: "ms-token",
      targets: [
        {
          provider: "microsoft",
          kind: "delegated_oauth2_permission_grant",
          grantId: "grant-123",
        },
      ],
      fetcher: vi.fn(async () => response(403)),
    });
    expect(permission.status).toBe("missing_provider_permission");
  });
});
