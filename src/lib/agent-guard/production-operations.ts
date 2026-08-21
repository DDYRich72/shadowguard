export type ProductionEndpoint = {
  id: string;
  label: string;
  method: "GET" | "POST";
  path: string;
  url: string;
  auth: string;
  purpose: string;
  boundary: string;
};

export type ProductionEnvGroup = {
  id: string;
  label: string;
  purpose: string;
  variables: readonly string[];
  requiredFor: string;
};

export type ProductionMigration = {
  file: string;
  area: string;
  requiredWhen: string;
};

export type ProductionRunbookAction = {
  id: string;
  label: string;
  steps: readonly string[];
  boundary: string;
};

export type SupabaseAuthUrlConfiguration = {
  siteUrl: string;
  redirectUrls: readonly string[];
  recoveryTemplateLink: string;
  notes: readonly string[];
};

export const SHADOWGUARD_PRODUCTION_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT: ProductionEndpoint = {
  id: "agentguard-activity-ingest",
  label: "AgentGuard activity ingest",
  method: "POST",
  path: "/api/agent-guard/activity",
  url: `${SHADOWGUARD_PRODUCTION_BASE_URL}/api/agent-guard/activity`,
  auth: "Authorization: Bearer <source-key>",
  purpose:
    "Customer-controlled server-side wrappers submit AI activity for in-memory classification and policy decision metadata.",
  boundary:
    "This is not a browser collector, universal monitor, managed connector, secret vault, raw-content archive, or compliance determination.",
};

export const SHADOWGUARD_PRODUCTION_ENDPOINTS: ProductionEndpoint[] = [
  AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT,
  {
    id: "health",
    label: "Application health",
    method: "GET",
    path: "/api/health",
    url: `${SHADOWGUARD_PRODUCTION_BASE_URL}/api/health`,
    auth: "No application session; response is sanitized",
    purpose: "Check required configuration and database reachability.",
    boundary: "The endpoint does not expose secrets, database errors, or user data.",
  },
  {
    id: "password-reset",
    label: "Password reset page",
    method: "GET",
    path: "/login/reset-password",
    url: `${SHADOWGUARD_PRODUCTION_BASE_URL}/login/reset-password`,
    auth: "Supabase recovery session, PKCE code, or token-hash verification",
    purpose: "Complete a Supabase Auth password recovery flow.",
    boundary: "A valid recovery token does not bypass dashboard authorization.",
  },
  {
    id: "google-auth-callback",
    label: "Google Workspace OAuth callback",
    method: "GET",
    path: "/api/auth/google/callback",
    url: `${SHADOWGUARD_PRODUCTION_BASE_URL}/api/auth/google/callback`,
    auth: "Google OAuth state and authorization code",
    purpose: "Complete optional Google Workspace discovery authorization.",
    boundary: "The callback is inactive when Google credentials are not configured.",
  },
  {
    id: "microsoft-auth-callback",
    label: "Microsoft 365 OAuth callback",
    method: "GET",
    path: "/api/auth/microsoft/callback",
    url: `${SHADOWGUARD_PRODUCTION_BASE_URL}/api/auth/microsoft/callback`,
    auth: "Microsoft OAuth state and authorization code",
    purpose: "Complete optional Microsoft 365 discovery authorization.",
    boundary: "The callback is inactive when Microsoft credentials are not configured.",
  },
];

export const AGENT_GUARD_INGEST_REQUEST_FIELDS = [
  "toolName",
  "userEmail",
  "activityType",
  "content",
  "metadata",
] as const;

export const AGENT_GUARD_INGEST_RESPONSE_FIELDS = [
  "id",
  "blocked",
  "reason",
  "riskLevel",
  "policyId",
  "policyActions",
] as const;

export const SHADOWGUARD_PRODUCTION_ENV_GROUPS = [
  {
    id: "core-app",
    label: "Core application and Supabase",
    purpose: "Run authentication, organization isolation, and database operations.",
    requiredFor: "Every installation.",
    variables: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "APP_BASE_URL",
      "NEXT_PUBLIC_APP_URL",
    ],
  },
  {
    id: "discovery-connectors",
    label: "Optional discovery connectors",
    purpose: "Authorize Google Workspace and Microsoft 365 discovery.",
    requiredFor: "Only the corresponding provider scan.",
    variables: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "MS_CLIENT_ID",
      "MS_CLIENT_SECRET",
      "MS_TENANT_ID",
      "MS_REDIRECT_URI",
      "TOKEN_ENCRYPTION_KEY",
      "TOKEN_ENCRYPTION_KEY_VERSION",
    ],
  },
  {
    id: "agentguard-exports",
    label: "Optional AgentGuard destinations",
    purpose: "Encrypt destination signing credentials under an installer-owned key.",
    requiredFor: "HTTPS export destinations and Slack workflow previews only.",
    variables: ["AGENT_GUARD_EXPORT_SECRET_KEY"],
  },
  {
    id: "abuse-resistance",
    label: "Optional shared rate limit and CAPTCHA",
    purpose: "Coordinate rate limits across instances and add login/signup challenges.",
    requiredFor: "Production hardening when enabled.",
    variables: [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ],
  },
] satisfies readonly ProductionEnvGroup[];

export const SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION: SupabaseAuthUrlConfiguration = {
  siteUrl: SHADOWGUARD_PRODUCTION_BASE_URL,
  redirectUrls: [
    `${SHADOWGUARD_PRODUCTION_BASE_URL}/auth/callback`,
    `${SHADOWGUARD_PRODUCTION_BASE_URL}/login/reset-password`,
  ],
  recoveryTemplateLink:
    '<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>',
  notes: [
    "Set the Supabase Auth Site URL to the exact HTTPS application origin.",
    "Allow-list the exact callback and password-reset URLs.",
    "Use the token-hash recovery template if email scanners consume one-time links.",
  ],
};

export const AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP: ProductionEnvGroup = {
  id: "customer-wrapper",
  label: "Customer-controlled AgentGuard wrapper",
  purpose: "Submit activity from a trusted server-side system.",
  requiredFor: "External source-key activity submission.",
  variables: ["SHADOWGUARD_APP_URL", "AGENTGUARD_INGEST_TOKEN"],
};

export const SHADOWGUARD_PRODUCTION_MIGRATIONS: ProductionMigration[] = [
  {
    file: "20260820183952_initial_schema.sql",
    area: "Fresh-install ShadowGuard schema",
    requiredWhen: "Every new installation.",
  },
];

export const SHADOWGUARD_ROLLBACK_ACTIONS: ProductionRunbookAction[] = [
  {
    id: "application",
    label: "Application rollback",
    steps: [
      "Preserve logs and identify the last known-good image digest.",
      "Restore that image without changing database state.",
      "Run health, authentication, and organization-isolation checks.",
    ],
    boundary: "Do not run destructive database rollback commands as an application rollback shortcut.",
  },
  {
    id: "database",
    label: "Database recovery",
    steps: [
      "Stop writes and preserve the affected database and storage volumes.",
      "Follow the operator's tested Supabase backup and restore procedure.",
      "Validate RLS, grants, membership assignment, and representative workflows before reopening access.",
    ],
    boundary: "Recovery is operator-controlled and must use verified backups; this application does not automate it.",
  },
];

export const SHADOWGUARD_BACKUP_RESTORE_NOTES = [
  "Supabase is the system of record for organizations, users, governance records, AgentGuard metadata, MCP records, and audit evidence.",
  "Back up Postgres and Storage on an operator-defined schedule and test restores before relying on them.",
  "Preserve encryption keys with the backups they protect and keep both outside the application container.",
  "Never export or share service-role keys, source keys, signing secrets, OAuth tokens, raw prompts, responses, files, messages, or user data in an operations handoff.",
] as const;

export const SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS: ProductionRunbookAction[] = [
  {
    id: "triage",
    label: "Triage",
    steps: [
      "Record the route, timestamp, request identifier, affected organization, and safe error code.",
      "Determine whether the issue is isolated to one organization or affects the installation.",
      "Preserve relevant logs and database evidence before changing state.",
    ],
    boundary: "This checklist is not incident-response automation, legal advice, or a substitute for the operator's response process.",
  },
  {
    id: "containment",
    label: "Containment and recovery",
    steps: [
      "Revoke affected sessions, source keys, OAuth grants, or destination secrets as applicable.",
      "Patch the smallest verified cause and test authorization boundaries before restoring access.",
      "Record decisions and follow the operator's notification obligations.",
    ],
    boundary: "ShadowGuard provides evidence and controls, not a certification, not a compliance determination, and not a security warranty.",
  },
];

export const SHADOWGUARD_PRODUCTION_OPERATIONS_COPY = {
  title: "Self-hosted operations reference",
  overview:
    "Installer-owned endpoint, environment, recovery, and incident-response notes for operating ShadowGuard on infrastructure you control.",
  endpointSummary:
    "AgentGuard accepts source-key-authenticated events from trusted server-side wrappers at the configured application origin.",
  boundary:
    "This reference is not managed hosting, not implementation assistance, not legal advice, not a certification, not a compliance determination, not a security warranty, and not a support SLA.",
} as const;

function bullets(values: readonly string[]): string {
  return values.map((value) => `- ${value}`).join("\n");
}

export function buildShadowGuardProductionOperationsRunbook(input?: {
  generatedAt?: string;
}): string {
  const generatedAt = input?.generatedAt ?? new Date().toISOString();
  return [
    `# ${SHADOWGUARD_PRODUCTION_OPERATIONS_COPY.title}`,
    "",
    `Generated: ${generatedAt}`,
    `Application base URL: ${SHADOWGUARD_PRODUCTION_BASE_URL}`,
    `Endpoint: ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.method} ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.url}`,
    "",
    SHADOWGUARD_PRODUCTION_OPERATIONS_COPY.overview,
    "",
    "## Application environment inventory",
    ...SHADOWGUARD_PRODUCTION_ENV_GROUPS.flatMap((group) => [
      "",
      `### ${group.label}`,
      group.purpose,
      `Required for: ${group.requiredFor}`,
      bullets(group.variables),
    ]),
    "",
    "## Supabase Auth URL configuration",
    `Site URL: ${SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION.siteUrl}`,
    bullets(SHADOWGUARD_SUPABASE_AUTH_URL_CONFIGURATION.redirectUrls),
    "",
    "## Supabase migration checklist",
    ...SHADOWGUARD_PRODUCTION_MIGRATIONS.map(
      (migration) => `- ${migration.file}: ${migration.area}`
    ),
    "",
    "## Rollback and recovery",
    ...SHADOWGUARD_ROLLBACK_ACTIONS.flatMap((action) => [
      `### ${action.label}`,
      bullets(action.steps),
      action.boundary,
    ]),
    "",
    "## Backup and restore notes",
    bullets(SHADOWGUARD_BACKUP_RESTORE_NOTES),
    "",
    "## Incident response handoff",
    ...SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS.flatMap((action) => [
      `### ${action.label}`,
      bullets(action.steps),
      action.boundary,
    ]),
    "",
    `Boundary: ${SHADOWGUARD_PRODUCTION_OPERATIONS_COPY.boundary}`,
    `AgentGuard boundary: ${AGENT_GUARD_ACTIVITY_INGEST_ENDPOINT.boundary}`,
  ].join("\n");
}

export function productionOperationsCounts() {
  return {
    endpoints: SHADOWGUARD_PRODUCTION_ENDPOINTS.length,
    envGroups: SHADOWGUARD_PRODUCTION_ENV_GROUPS.length,
    appEnvVars: SHADOWGUARD_PRODUCTION_ENV_GROUPS.reduce(
      (total, group) => total + group.variables.length,
      0
    ),
    customerWrapperEnvVars: AGENT_GUARD_CUSTOMER_WRAPPER_ENV_GROUP.variables.length,
    migrations: SHADOWGUARD_PRODUCTION_MIGRATIONS.length,
    rollbackActions: SHADOWGUARD_ROLLBACK_ACTIONS.length,
    incidentActions: SHADOWGUARD_INCIDENT_RESPONSE_ACTIONS.length,
  };
}
