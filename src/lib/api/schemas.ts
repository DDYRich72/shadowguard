/**
 * Reusable Zod primitives + a parseBody() helper for API routes.
 *
 * Pattern in route handlers:
 *
 *   const body = await parseBody(request, MyRouteSchema);
 *   if (body instanceof NextResponse) return body;
 *   // ...use body.field, fully typed
 *
 * The `instanceof NextResponse` short-circuit returns a 400 with a
 * client-friendly issue list when validation fails. Successful parses
 * give you the inferred type for free.
 *
 * Why both this and src/lib/validate.ts: validate.ts is the
 * "drop into an existing handler with no refactor" path. This module
 * is the long-term destination — declarative schemas, single source
 * of truth, easier to keep in sync with TypeScript types.
 */

import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS } from "../validate";
import { containsDisallowedIntegrationEvidenceText } from "../agent-guard/integration-evidence";

// ── Primitives ─────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(LIMITS.userEmail);

export const planActionSchema = z.enum(["allow", "warn", "block", "quarantine"]);

export const agentPolicyReviewStatusSchema = z.enum([
  "open",
  "investigating",
  "resolved",
  "dismissed",
]);

export const sensitivitySchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);

export const aiRiskTierSchema = z.enum(["critical", "high", "medium", "low"]);

export const aiSystemStatusSchema = z.enum(["active", "archived"]);

export const aiSystemApprovalStatusSchema = z.enum([
  "discovered",
  "under_review",
  "approved",
  "blocked",
  "retired",
]);

export const aiSystemSourceSchema = z.enum(["manual", "discovered", "import"]);

export const aiTrainingDataUseSchema = z.enum([
  "unknown",
  "none",
  "opt_out",
  "allowed",
]);

export const aiSystemControlStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "waived",
]);

export const aiEvidenceCategorySchema = z.enum([
  "policy",
  "vendor_review",
  "security_review",
  "privacy_review",
  "approval",
  "audit_log",
  "training",
  "other",
]);

export const aiEvidenceStatusSchema = z.enum([
  "draft",
  "current",
  "needs_review",
  "expired",
]);

export const governanceReportSnapshotTypeSchema = z.enum([
  "ai_system_readiness",
  "organization_governance",
]);

export const governanceReportDeliveryStatusSchema = z.enum(["draft", "final"]);

export const governanceReportReviewStatusSchema = z.enum([
  "not_submitted",
  "needs_review",
  "approved",
  "changes_requested",
]);

export const governanceReportDeliveryLinkStatusSchema = z.enum(["active", "revoked"]);

export const governanceReportSnapshotRemediationStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "waived",
]);

export const activityTypeSchema = z.enum([
  "prompt_sent",
  "response_received",
  "file_upload",
  "file_download",
  "api_call",
  "data_export",
  "agent_action",
  "tool_invocation",
]);

export const mcpTransportSchema = z.enum([
  "stdio",
  "http",
  "sse",
  "websocket",
  "unknown",
  "other",
]);

export const mcpEnvironmentSchema = z.enum([
  "production",
  "staging",
  "development",
  "local",
  "unknown",
]);

export const mcpRecordStatusSchema = z.enum([
  "active",
  "paused",
  "blocked",
  "archived",
]);

export const mcpApprovalStatusSchema = z.enum([
  "pending_review",
  "approved",
  "blocked",
  "deprecated",
]);

export const mcpCapabilityCategorySchema = z.enum([
  "read",
  "write",
  "execute",
  "data_export",
  "credential_access",
  "admin",
  "external_network",
  "file_access",
  "database_access",
  "custom",
]);

export const agentIngestSourceEnvironmentSchema = z.enum([
  "production",
  "staging",
  "development",
  "other",
]);

export const agentExportDestinationTypeSchema = z.enum(["webhook", "siem"]);

export const agentExportDestinationStatusSchema = z.enum([
  "enabled",
  "disabled",
]);

export const agentExportReceiverAcknowledgementStatusSchema = z.enum([
  "not_requested",
  "requested",
  "confirmed",
  "not_applicable",
]);

export const agentRolloutStatusSchema = z.enum([
  "testing",
  "ready_for_pilot",
  "needs_review",
  "live_caution",
]);

export const agentIntegrationEvidenceStatusSchema = z.enum([
  "planned",
  "in_progress",
  "pilot_ready",
  "needs_review",
  "retired",
]);

export const agentExportEventTypeSchema = z.enum([
  "agentguard.activity.evaluated",
  "agentguard.policy.blocked",
  "agentguard.review.required",
]);

export const agentSlackWorkflowTargetTypeSchema = z.enum([
  "workflow_webhook",
  "incoming_webhook",
]);

export const agentSlackWorkflowTargetStatusSchema = z.enum([
  "enabled",
  "disabled",
]);

export const agentSlackWorkflowEventTypeSchema = z.enum([
  "agentguard.policy.blocked",
  "agentguard.review.required",
]);

export const agentSlackWorkflowCustomerApprovalStatusSchema = z.enum([
  "not_requested",
  "requested",
  "approved",
  "not_applicable",
]);

export const agentSlackWorkflowUserIdentifierModeSchema = z.enum([
  "redacted",
  "full_email",
  "customer_identifier",
]);

const agentExportEventTypesSchema = z
  .array(agentExportEventTypeSchema)
  .min(1)
  .max(3)
  .optional()
  .default([
    "agentguard.activity.evaluated",
    "agentguard.policy.blocked",
    "agentguard.review.required",
  ]);

const ingestSourceAllowedToolsSchema = z
  .array(z.string().trim().min(1).max(LIMITS.toolName))
  .max(LIMITS.ingestSourceTools)
  .optional()
  .default([]);

const agentSlackWorkflowEventTypesSchema = z
  .array(agentSlackWorkflowEventTypeSchema)
  .min(1)
  .max(2)
  .optional()
  .default(["agentguard.policy.blocked", "agentguard.review.required"]);

// ── Per-route schemas ──────────────────────────────────────────────

/** POST /api/agent-guard/activity body. */
export const activityIngestSchema = z.object({
  toolName: z.string().trim().min(1).max(LIMITS.toolName),
  userEmail: emailSchema,
  activityType: activityTypeSchema,
  content: z.string().max(LIMITS.activityContent).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type ActivityIngestBody = z.infer<typeof activityIngestSchema>;

/** POST /api/agent-guard/ingest-sources body. */
export const agentIngestSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.ingestSourceName),
  environment: agentIngestSourceEnvironmentSchema.optional().default("production"),
  allowedToolNames: ingestSourceAllowedToolsSchema,
});
export type AgentIngestSourceCreateBody = z.infer<
  typeof agentIngestSourceCreateSchema
>;

/** PATCH /api/agent-guard/ingest-sources/[id] body. */
export const agentIngestSourcePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.ingestSourceName).optional(),
    environment: agentIngestSourceEnvironmentSchema.optional(),
    allowedToolNames: z
      .array(z.string().trim().min(1).max(LIMITS.toolName))
      .max(LIMITS.ingestSourceTools)
      .optional(),
    status: z.literal("revoked").optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one source field is required",
  });
export type AgentIngestSourcePatchBody = z.infer<
  typeof agentIngestSourcePatchSchema
>;

/** POST /api/agent-guard/export-destinations body. */
export const agentExportDestinationCreateSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.exportDestinationName),
  destinationType: agentExportDestinationTypeSchema.optional().default("webhook"),
  endpointUrl: z.string().trim().min(1).max(LIMITS.exportDestinationUrl),
  automaticDeliveryEnabled: z.boolean().optional().default(false),
  dryRunEnabled: z.boolean().optional().default(true),
  eventTypes: agentExportEventTypesSchema,
});
export type AgentExportDestinationCreateBody = z.infer<
  typeof agentExportDestinationCreateSchema
>;

/** PATCH /api/agent-guard/export-destinations/[id] body. */
export const agentExportDestinationPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.exportDestinationName).optional(),
    destinationType: agentExportDestinationTypeSchema.optional(),
    endpointUrl: z.string().trim().min(1).max(LIMITS.exportDestinationUrl).optional(),
    status: agentExportDestinationStatusSchema.optional(),
    automaticDeliveryEnabled: z.boolean().optional(),
    dryRunEnabled: z.boolean().optional(),
    eventTypes: z.array(agentExportEventTypeSchema).min(1).max(3).optional(),
    ownerName: z.string().trim().max(LIMITS.exportDestinationOwner).optional(),
    ownerEmail: z.union([emailSchema, z.literal("")]).optional(),
    escalationPath: z
      .string()
      .trim()
      .max(LIMITS.exportDestinationEscalationPath)
      .optional(),
    receiverAcknowledgementStatus:
      agentExportReceiverAcknowledgementStatusSchema.optional(),
    receiverAcknowledgementNote: z
      .string()
      .trim()
      .max(LIMITS.exportDestinationAcknowledgementNote)
      .optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one destination field is required",
  })
  .superRefine(rejectDisallowedIntegrationEvidenceText);
export type AgentExportDestinationPatchBody = z.infer<
  typeof agentExportDestinationPatchSchema
>;

/** POST /api/agent-guard/slack-workflow-targets body. */
export const agentSlackWorkflowTargetCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.slackWorkflowTargetName),
    targetType: agentSlackWorkflowTargetTypeSchema.optional(),
    webhookUrl: z.string().trim().min(1).max(LIMITS.slackWorkflowUrl),
    eventTypes: agentSlackWorkflowEventTypesSchema,
    dryRunEnabled: z.boolean().optional().default(true),
    liveSendEnabled: z.boolean().optional().default(false),
    ownerName: z.string().trim().max(LIMITS.slackWorkflowOwner).optional().default(""),
    ownerEmail: z.union([emailSchema, z.literal("")]).optional().default(""),
    customerApprovalStatus: agentSlackWorkflowCustomerApprovalStatusSchema
      .optional()
      .default("not_requested"),
    customerApprovalNote: z
      .string()
      .trim()
      .max(LIMITS.slackWorkflowApprovalNote)
      .optional()
      .default(""),
    userIdentifierMode: agentSlackWorkflowUserIdentifierModeSchema
      .optional()
      .default("redacted"),
  })
  .superRefine((value, ctx) => {
    const nonSecretFields = Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "webhookUrl")
    );
    rejectDisallowedIntegrationEvidenceText(nonSecretFields, ctx);
  });
export type AgentSlackWorkflowTargetCreateBody = z.infer<
  typeof agentSlackWorkflowTargetCreateSchema
>;

/** PATCH /api/agent-guard/slack-workflow-targets/[id] body. */
export const agentSlackWorkflowTargetPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.slackWorkflowTargetName).optional(),
    targetType: agentSlackWorkflowTargetTypeSchema.optional(),
    webhookUrl: z.string().trim().min(1).max(LIMITS.slackWorkflowUrl).optional(),
    status: agentSlackWorkflowTargetStatusSchema.optional(),
    eventTypes: z.array(agentSlackWorkflowEventTypeSchema).min(1).max(2).optional(),
    dryRunEnabled: z.boolean().optional(),
    liveSendEnabled: z.boolean().optional(),
    ownerName: z.string().trim().max(LIMITS.slackWorkflowOwner).optional(),
    ownerEmail: z.union([emailSchema, z.literal("")]).optional(),
    customerApprovalStatus:
      agentSlackWorkflowCustomerApprovalStatusSchema.optional(),
    customerApprovalNote: z
      .string()
      .trim()
      .max(LIMITS.slackWorkflowApprovalNote)
      .optional(),
    userIdentifierMode: agentSlackWorkflowUserIdentifierModeSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one Slack target field is required",
  })
  .superRefine((value, ctx) => {
    const nonSecretFields = Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "webhookUrl")
    );
    rejectDisallowedIntegrationEvidenceText(nonSecretFields, ctx);
  });
export type AgentSlackWorkflowTargetPatchBody = z.infer<
  typeof agentSlackWorkflowTargetPatchSchema
>;

const rolloutChecklistSnapshotSchema = z
  .array(
    z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(120),
      status: z.enum(["pass", "attention", "blocked"]),
      summary: z.string().trim().min(1).max(500),
    })
  )
  .max(12);

const rolloutMetricsSnapshotSchema = z.object({
  activeSourceCount: z.number().int().min(0).max(100000),
  activeProductionSourceCount: z.number().int().min(0).max(100000),
  recentActivitySourceCount: z.number().int().min(0).max(100000),
  policyOutcomeSourceCount: z.number().int().min(0).max(100000),
  needsReviewSourceCount: z.number().int().min(0).max(100000),
  needsActionReviewCount: z.number().int().min(0).max(100000),
  liveExportDestinationCount: z.number().int().min(0).max(100000),
  failingExportDestinationCount: z.number().int().min(0).max(100000),
});

/** POST /api/agent-guard/rollout-acknowledgements body. */
export const agentRolloutAcknowledgementCreateSchema = z.object({
  sourceId: uuidSchema,
  sourceName: z.string().trim().min(1).max(LIMITS.ingestSourceName),
  sourceEnvironment: agentIngestSourceEnvironmentSchema,
  sourceStatus: z.enum(["active", "revoked"]),
  sourceRolloutStatus: agentRolloutStatusSchema,
  sourceRolloutLabel: z.string().trim().min(1).max(80),
  sourceNextStep: z.string().trim().min(1).max(700),
  overallRolloutStatus: agentRolloutStatusSchema,
  overallRolloutLabel: z.string().trim().min(1).max(80),
  exportPostureLabel: z.string().trim().min(1).max(120),
  exportWarning: z.string().trim().max(700).nullable().optional(),
  checklistSnapshot: rolloutChecklistSnapshotSchema,
  metricsSnapshot: rolloutMetricsSnapshotSchema,
  note: z
    .string()
    .trim()
    .max(LIMITS.agentRolloutAcknowledgementNote)
    .optional()
    .default(""),
});
export type AgentRolloutAcknowledgementCreateBody = z.infer<
  typeof agentRolloutAcknowledgementCreateSchema
>;

/** POST /api/agent-guard/evidence-packets body. */
export const agentEvidencePacketCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.agentEvidencePacketTitle)
      .optional(),
  })
  .optional()
  .default({});
export type AgentEvidencePacketCreateBody = z.infer<
  typeof agentEvidencePacketCreateSchema
>;

/** POST /api/agent-guard/slack-evidence-packets body. */
export const agentSlackEvidencePacketCreateSchema = z
  .object({
    targetId: uuidSchema,
    title: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.agentEvidencePacketTitle)
      .optional(),
  });
export type AgentSlackEvidencePacketCreateBody = z.infer<
  typeof agentSlackEvidencePacketCreateSchema
>;

const agentIntegrationEvidenceChecklistItemSchema = z.object({
  id: z.enum([
    "server_side_secret",
    "request_fields_mapped",
    "decision_handling",
    "test_event_accepted",
    "owner_named",
    "evidence_linked",
  ]),
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
  completed: z.boolean(),
});

const agentIntegrationEvidenceChecklistSchema = z
  .array(agentIntegrationEvidenceChecklistItemSchema)
  .max(12)
  .optional()
  .default([]);

function rejectDisallowedIntegrationEvidenceText(
  value: unknown,
  ctx: z.RefinementCtx
) {
  if (containsDisallowedIntegrationEvidenceText(value)) {
    ctx.addIssue({
      code: "custom",
      message:
        "Evidence fields cannot include source keys, private keys, credentials, or raw content.",
    });
  }
}

/** POST /api/agent-guard/integration-evidence body. */
export const agentIntegrationEvidenceCreateSchema = z
  .object({
    sourceId: uuidSchema.nullish().default(null),
    status: agentIntegrationEvidenceStatusSchema.optional().default("in_progress"),
    title: z.string().trim().min(1).max(180),
    implementationOwner: z.string().trim().max(160).optional().default(""),
    wrapperLocation: z.string().trim().max(500).optional().default(""),
    evidenceUrl: z.string().trim().max(1000).optional().default(""),
    checklistSnapshot: agentIntegrationEvidenceChecklistSchema,
    note: z.string().trim().max(1500).optional().default(""),
  })
  .superRefine(rejectDisallowedIntegrationEvidenceText);
export type AgentIntegrationEvidenceCreateBody = z.infer<
  typeof agentIntegrationEvidenceCreateSchema
>;

/** PATCH /api/agent-guard/integration-evidence/[id] body. */
export const agentIntegrationEvidencePatchSchema = z
  .object({
    sourceId: uuidSchema.nullish(),
    status: agentIntegrationEvidenceStatusSchema.optional(),
    title: z.string().trim().min(1).max(180).optional(),
    implementationOwner: z.string().trim().max(160).optional(),
    wrapperLocation: z.string().trim().max(500).optional(),
    evidenceUrl: z.string().trim().max(1000).optional(),
    checklistSnapshot: z.array(agentIntegrationEvidenceChecklistItemSchema).max(12).optional(),
    note: z.string().trim().max(1500).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one evidence field is required",
  })
  .superRefine(rejectDisallowedIntegrationEvidenceText);
export type AgentIntegrationEvidencePatchBody = z.infer<
  typeof agentIntegrationEvidencePatchSchema
>;

/** PATCH /api/alerts body. */
export const alertPatchSchema = z.object({
  id: uuidSchema,
  acknowledged: z.boolean().optional().default(true),
});
export type AlertPatchBody = z.infer<typeof alertPatchSchema>;

const policyConditionSchema = z.object({
  field: z.enum([
    "toolName",
    "activityType",
    "sensitivity",
    "riskLevel",
    "userEmail",
    "dataCategory",
  ]),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "in",
    "gte",
    "lte",
  ]),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
  ]),
});

/** Shared shape for both POST + PATCH on /api/agent-guard/policies(/[id]). */
export const policyBodySchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.policyName),
  description: z.string().max(LIMITS.policyDescription).optional().default(""),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(1000).optional().default(5),
  conditions: z.array(policyConditionSchema).max(LIMITS.policyConditions).optional().default([]),
  action: planActionSchema,
});
export type PolicyBody = z.infer<typeof policyBodySchema>;

/** Partial form for PATCH — every field optional. */
export const policyPatchSchema = policyBodySchema.partial();
export type PolicyPatch = z.infer<typeof policyPatchSchema>;

/** PATCH /api/agent-guard/policy-reviews/[id] body. */
export const agentPolicyReviewPatchSchema = z
  .object({
    status: agentPolicyReviewStatusSchema.optional(),
    assignedTo: z.string().trim().max(LIMITS.agentPolicyReviewOwner).optional(),
    reviewNote: z.string().trim().max(LIMITS.agentPolicyReviewNote).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one review field is required",
  });
export type AgentPolicyReviewPatchBody = z.infer<
  typeof agentPolicyReviewPatchSchema
>;

const toolEntrySchema = z.object({
  appName: z.string().trim().min(1).max(LIMITS.toolName),
  category: z.string().max(100).optional().default("Other"),
  riskLevel: z.string().max(50).optional().default("medium"),
});

const blockedToolEntrySchema = z.object({
  appName: z.string().trim().min(1).max(LIMITS.toolName),
  reason: z.string().max(500).optional(),
});

/** POST /api/policy/generate body. */
export const policyGenerateSchema = z.object({
  orgName: z.string().max(200).optional().default("Your Organization"),
  industry: z.string().max(50).optional().default("general"),
  riskTolerance: z.enum(["strict", "balanced", "permissive"]).optional().default("balanced"),
  approvedTools: z.array(toolEntrySchema).max(LIMITS.toolListItems).optional().default([]),
  blockedTools: z.array(blockedToolEntrySchema).max(LIMITS.toolListItems).optional().default([]),
});
export type PolicyGenerateBody = z.infer<typeof policyGenerateSchema>;

/** POST /api/apps/[id]/action body. */
export const appActionSchema = z.object({
  action: z.enum(["approve", "block", "revoke", "pending"]),
});
export type AppActionBody = z.infer<typeof appActionSchema>;

/** POST /api/apps/[id]/revoke-oauth body. */
export const oauthRevokeSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
});
export type OAuthRevokeBody = z.infer<typeof oauthRevokeSchema>;

/** POST /api/scan body. Both fields optional — server falls back to org defaults. */
export const scanRequestSchema = z.object({
  domain: z.string().trim().max(253).optional(),
  totalUsers: z.number().int().min(1).max(10_000_000).optional(),
});
export type ScanRequestBody = z.infer<typeof scanRequestSchema>;

/** POST /api/auth/bootstrap body. */
export const bootstrapSchema = z.object({
  user_id: uuidSchema,
  email: emailSchema,
  org_name: z.string().trim().min(1).max(200).optional(),
});
export type BootstrapBody = z.infer<typeof bootstrapSchema>;

/** POST /api/agent-guard/kill-switch body — same shape as ingest minus
 *  metadata, since this endpoint evaluates without recording. */
export const killSwitchSchema = z.object({
  toolName: z.string().trim().min(1).max(LIMITS.toolName),
  userEmail: emailSchema.optional(),
  activityType: activityTypeSchema,
  content: z.string().max(LIMITS.activityContent).optional().default(""),
});
export type KillSwitchBody = z.infer<typeof killSwitchSchema>;

/** PATCH /api/agent-guard/settings body. */
export const agentGuardSettingsSchema = z.object({
  kill_switch_active: z.boolean().optional(),
  auto_block_threshold: z.number().int().min(0).max(100).optional(),
  alert_threshold: z.number().int().min(0).max(100).optional(),
  pii_sensitivity: z.enum(["low", "medium", "high"]).optional(),
});
export type AgentGuardSettingsBody = z.infer<typeof agentGuardSettingsSchema>;

const optionalEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.userEmail)
  .optional()
  .default("")
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Invalid email address",
  });

const optionalEmailPatchField = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.userEmail)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Invalid email address",
  })
  .optional();

const optionalUuidField = uuidSchema.optional().nullable().default(null);

/** POST /api/mcp-guard/servers body. */
export const mcpServerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  serverUrl: z.string().trim().max(1000).optional().default(""),
  transport: mcpTransportSchema.optional().default("unknown"),
  ownerName: z.string().trim().max(200).optional().default(""),
  ownerEmail: optionalEmailField,
  department: z.string().trim().max(120).optional().default(""),
  environment: mcpEnvironmentSchema.optional().default("unknown"),
  status: mcpRecordStatusSchema.optional().default("active"),
  approvalStatus: mcpApprovalStatusSchema.optional().default("pending_review"),
  aiSystemId: optionalUuidField,
});
export type MCPServerCreateBody = z.infer<typeof mcpServerCreateSchema>;

/** PATCH /api/mcp-guard/servers/[id] body. */
export const mcpServerPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  serverUrl: z.string().trim().max(1000).optional(),
  transport: mcpTransportSchema.optional(),
  ownerName: z.string().trim().max(200).optional(),
  ownerEmail: optionalEmailPatchField,
  department: z.string().trim().max(120).optional(),
  environment: mcpEnvironmentSchema.optional(),
  status: mcpRecordStatusSchema.optional(),
  approvalStatus: mcpApprovalStatusSchema.optional(),
  aiSystemId: uuidSchema.optional().nullable(),
});
export type MCPServerPatchBody = z.infer<typeof mcpServerPatchSchema>;

const mcpCapabilityCategoriesSchema = z
  .array(mcpCapabilityCategorySchema)
  .max(20)
  .optional()
  .default(["read"]);

/** POST /api/mcp-guard/servers/[id]/tools body. */
export const mcpToolCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  capabilityCategories: mcpCapabilityCategoriesSchema,
  dataSensitivity: sensitivitySchema.optional().default("internal"),
  externalAccess: z.boolean().optional().default(false),
  writeAccess: z.boolean().optional().default(false),
  credentialAccess: z.boolean().optional().default(false),
  approvalStatus: mcpApprovalStatusSchema.optional().default("pending_review"),
  ownerName: z.string().trim().max(200).optional().default(""),
  ownerEmail: optionalEmailField,
  status: mcpRecordStatusSchema.optional().default("active"),
  aiSystemId: optionalUuidField,
});
export type MCPToolCreateBody = z.infer<typeof mcpToolCreateSchema>;

/** PATCH /api/mcp-guard/tools/[toolId] body. */
export const mcpToolPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  capabilityCategories: z.array(mcpCapabilityCategorySchema).max(20).optional(),
  dataSensitivity: sensitivitySchema.optional(),
  externalAccess: z.boolean().optional(),
  writeAccess: z.boolean().optional(),
  credentialAccess: z.boolean().optional(),
  approvalStatus: mcpApprovalStatusSchema.optional(),
  ownerName: z.string().trim().max(200).optional(),
  ownerEmail: optionalEmailPatchField,
  status: mcpRecordStatusSchema.optional(),
  aiSystemId: uuidSchema.optional().nullable(),
});
export type MCPToolPatchBody = z.infer<typeof mcpToolPatchSchema>;

/** POST /api/mcp-guard/events body. */
export const mcpEventIngestSchema = z.object({
  serverId: uuidSchema.optional().nullable().default(null),
  toolId: uuidSchema.optional().nullable().default(null),
  serverName: z.string().trim().max(200).optional().default(""),
  toolName: z.string().trim().min(1).max(LIMITS.toolName),
  clientName: z.string().trim().max(200).optional().default(""),
  userEmail: emailSchema,
  activityType: activityTypeSchema.optional().default("tool_invocation"),
  content: z.string().max(LIMITS.activityContent).optional().default(""),
  inputContent: z.string().max(LIMITS.activityContent).optional().default(""),
  outputContent: z.string().max(LIMITS.activityContent).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type MCPEventIngestBody = z.infer<typeof mcpEventIngestSchema>;

const dataTypesSchema = z
  .array(z.string().trim().min(1).max(100))
  .max(30)
  .optional()
  .default([]);

// Same shape as dateOnlyOrEmptySchema below, but declared before the
// AI-system schemas so module evaluation order stays valid.
const reviewDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  z.literal(""),
  z.null(),
]);

/** POST /api/ai-systems body. */
export const aiSystemCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  ownerName: z.string().trim().max(200).optional().default(""),
  ownerEmail: optionalEmailField,
  department: z.string().trim().max(120).optional().default(""),
  vendorName: z.string().trim().max(200).optional().default(""),
  modelName: z.string().trim().max(200).optional().default(""),
  useCase: z.string().trim().min(1).max(2000),
  businessProcess: z.string().trim().max(500).optional().default(""),
  dataTypes: dataTypesSchema,
  dataSensitivity: sensitivitySchema.optional().default("internal"),
  customerFacing: z.boolean().optional().default(false),
  employeeFacing: z.boolean().optional().default(false),
  automatedDecisions: z.boolean().optional().default(false),
  humanReviewRequired: z.boolean().optional().default(true),
  trainingDataUse: aiTrainingDataUseSchema.optional().default("unknown"),
  approvalStatus: aiSystemApprovalStatusSchema.optional().default("under_review"),
  nextReviewDate: reviewDateSchema.optional().default(""),
  source: aiSystemSourceSchema.optional().default("manual"),
  connectedAppId: uuidSchema.optional().nullable().default(null),
});
export type AISystemCreateBody = z.infer<typeof aiSystemCreateSchema>;

/** PATCH /api/ai-systems/[id] body. */
export const aiSystemPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  ownerName: z.string().trim().max(200).optional(),
  ownerEmail: optionalEmailPatchField,
  department: z.string().trim().max(120).optional(),
  vendorName: z.string().trim().max(200).optional(),
  modelName: z.string().trim().max(200).optional(),
  useCase: z.string().trim().min(1).max(2000).optional(),
  businessProcess: z.string().trim().max(500).optional(),
  dataTypes: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  dataSensitivity: sensitivitySchema.optional(),
  customerFacing: z.boolean().optional(),
  employeeFacing: z.boolean().optional(),
  automatedDecisions: z.boolean().optional(),
  humanReviewRequired: z.boolean().optional(),
  trainingDataUse: aiTrainingDataUseSchema.optional(),
  approvalStatus: aiSystemApprovalStatusSchema.optional(),
  nextReviewDate: reviewDateSchema.optional(),
  source: aiSystemSourceSchema.optional(),
  connectedAppId: uuidSchema.optional().nullable(),
  status: aiSystemStatusSchema.optional(),
  riskTier: aiRiskTierSchema.optional(),
});
export type AISystemPatchBody = z.infer<typeof aiSystemPatchSchema>;

/** POST /api/ai-systems/from-connected-app body. */
export const aiSystemFromConnectedAppSchema = z.object({
  connectedAppId: uuidSchema,
  ownerName: z.string().trim().max(200).optional().default(""),
  ownerEmail: optionalEmailField,
  department: z.string().trim().max(120).optional().default(""),
  useCase: z.string().trim().max(2000).optional().default(""),
});
export type AISystemFromConnectedAppBody = z.infer<typeof aiSystemFromConnectedAppSchema>;

/** POST /api/ai-systems/import body. */
export const aiSystemImportSchema = z.object({
  csvText: z.string().min(1, "CSV text is required").max(LIMITS.importCsvContent),
  dryRun: z.boolean().optional().default(true),
});
export type AISystemImportBody = z.infer<typeof aiSystemImportSchema>;

export const regulatedDecisionAreaSchema = z.enum([
  "none",
  "hiring",
  "credit",
  "insurance",
  "healthcare",
  "legal",
  "financial",
  "other",
]);

export const businessCriticalitySchema = z.enum(["low", "medium", "high"]);

/** POST /api/ai-systems/[id]/assessments body. */
export const aiRiskAssessmentSchema = z.object({
  status: z.enum(["draft", "completed"]).optional().default("completed"),
  dataSensitivity: sensitivitySchema.optional().default("internal"),
  processesPersonalData: z.boolean().optional().default(false),
  processesCustomerData: z.boolean().optional().default(false),
  processesEmployeeData: z.boolean().optional().default(false),
  regulatedDecisionArea: regulatedDecisionAreaSchema.optional().default("none"),
  customerFacing: z.boolean().optional().default(false),
  employeeFacing: z.boolean().optional().default(false),
  autonomousActions: z.boolean().optional().default(false),
  humanReviewRequired: z.boolean().optional().default(true),
  vendorApproved: z.boolean().optional().default(false),
  hasSoc2: z.boolean().optional().default(false),
  hasDpa: z.boolean().optional().default(false),
  loggingEnabled: z.boolean().optional().default(false),
  businessCriticality: businessCriticalitySchema.optional().default("medium"),
  usesDataForTraining: z.boolean().optional().default(false),
});
export type AIRiskAssessmentBody = z.infer<typeof aiRiskAssessmentSchema>;

const dateOnlyOrEmptySchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  z.literal(""),
  z.null(),
]);

const optionalUrlField = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Expected a valid http(s) URL");

/** PATCH /api/ai-systems/[id]/controls/[controlId] body. */
export const aiSystemControlPatchSchema = z.object({
  owner: z.string().trim().max(200).optional(),
  status: aiSystemControlStatusSchema.optional(),
  dueDate: dateOnlyOrEmptySchema.optional(),
  notes: z.string().trim().max(4000).optional(),
  evidenceUrl: optionalUrlField,
  evidenceText: z.string().trim().max(4000).optional(),
});
export type AISystemControlPatchBody = z.infer<typeof aiSystemControlPatchSchema>;

/** POST /api/ai-systems/[id]/evidence body. */
export const aiSystemEvidenceCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: aiEvidenceCategorySchema.optional().default("other"),
  owner: z.string().trim().max(200).optional().default(""),
  status: aiEvidenceStatusSchema.optional().default("current"),
  evidenceUrl: optionalUrlField.default(""),
  notes: z.string().trim().max(4000).optional().default(""),
  controlId: uuidSchema.optional().nullable().default(null),
});
export type AISystemEvidenceCreateBody = z.infer<typeof aiSystemEvidenceCreateSchema>;

/** PATCH /api/ai-systems/[id]/evidence/[evidenceId] body. */
export const aiSystemEvidencePatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: aiEvidenceCategorySchema.optional(),
  owner: z.string().trim().max(200).optional(),
  status: aiEvidenceStatusSchema.optional(),
  evidenceUrl: optionalUrlField,
  notes: z.string().trim().max(4000).optional(),
  controlId: uuidSchema.optional().nullable(),
});
export type AISystemEvidencePatchBody = z.infer<typeof aiSystemEvidencePatchSchema>;

/** POST /api/governance/report-snapshots body. */
export const governanceReportSnapshotCreateSchema = z
  .object({
    reportType: governanceReportSnapshotTypeSchema,
    aiSystemId: uuidSchema.optional().nullable().default(null),
    title: z.string().trim().max(200).optional().default(""),
  })
  .refine(
    (value) => value.reportType !== "ai_system_readiness" || Boolean(value.aiSystemId),
    {
      path: ["aiSystemId"],
      message: "aiSystemId is required for AI system readiness snapshots",
    }
  );
export type GovernanceReportSnapshotCreateBody = z.infer<typeof governanceReportSnapshotCreateSchema>;

/** PATCH /api/governance/report-snapshots/[id] body. */
export const governanceReportSnapshotDeliveryPatchSchema = z.object({
  clientName: z.string().trim().max(200).optional(),
  preparedByNote: z.string().trim().max(2000).optional(),
  executiveSummaryNote: z.string().trim().max(4000).optional(),
});
export type GovernanceReportSnapshotDeliveryPatchBody = z.infer<
  typeof governanceReportSnapshotDeliveryPatchSchema
>;

const reviewFieldsSchema = z.object({
  reviewerName: z.string().trim().max(200).optional().default(""),
  reviewerEmail: optionalEmailField,
  reviewNote: z.string().trim().max(4000).optional().default(""),
});

/** POST /api/governance/report-snapshots/[id]/review body. */
export const governanceReportSnapshotReviewSubmitSchema = reviewFieldsSchema;
export type GovernanceReportSnapshotReviewSubmitBody = z.infer<
  typeof governanceReportSnapshotReviewSubmitSchema
>;

/** PATCH /api/governance/report-snapshots/[id]/review body. */
export const governanceReportSnapshotReviewDecisionSchema = reviewFieldsSchema.extend({
  action: z.enum(["approve", "changes_requested"]),
});
export type GovernanceReportSnapshotReviewDecisionBody = z.infer<
  typeof governanceReportSnapshotReviewDecisionSchema
>;

/** POST /api/governance/report-snapshots/[id]/remediations body. */
export const governanceReportSnapshotRemediationCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  owner: z.string().trim().max(200).optional().default(""),
  status: governanceReportSnapshotRemediationStatusSchema.optional().default("open"),
  dueDate: dateOnlyOrEmptySchema.optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
});
export type GovernanceReportSnapshotRemediationCreateBody = z.infer<
  typeof governanceReportSnapshotRemediationCreateSchema
>;

/** PATCH /api/governance/report-snapshots/[id]/remediations/[remediationId] body. */
export const governanceReportSnapshotRemediationPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  owner: z.string().trim().max(200).optional(),
  status: governanceReportSnapshotRemediationStatusSchema.optional(),
  dueDate: dateOnlyOrEmptySchema.optional(),
  notes: z.string().trim().max(4000).optional(),
});
export type GovernanceReportSnapshotRemediationPatchBody = z.infer<
  typeof governanceReportSnapshotRemediationPatchSchema
>;

/** POST /api/governance/report-snapshots/[id]/delivery-links body. */
export const governanceReportDeliveryLinkCreateSchema = z.object({
  expiresAt: dateOnlyOrEmptySchema.optional().default(""),
});
export type GovernanceReportDeliveryLinkCreateBody = z.infer<
  typeof governanceReportDeliveryLinkCreateSchema
>;

/** PATCH /api/governance/report-snapshots/[id]/delivery-links/[linkId] body. */
export const governanceReportDeliveryLinkPatchSchema = z.object({
  status: z.literal("revoked"),
});
export type GovernanceReportDeliveryLinkPatchBody = z.infer<
  typeof governanceReportDeliveryLinkPatchSchema
>;

// ── Helper ─────────────────────────────────────────────────────────

/**
 * Parse + validate a JSON body against a Zod schema. On failure,
 * returns a 400 NextResponse with a flattened issue list. On success,
 * returns the parsed (and typed) value.
 *
 * The caller pattern is: `const body = await parseBody(req, schema);
 * if (body instanceof NextResponse) return body;`.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: NextRequest | Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body is not valid JSON" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  return parsed.data as z.infer<T>;
}
