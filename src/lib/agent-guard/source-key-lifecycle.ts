import {
  agentIngestSourceRotationPosture,
  type AgentIngestSourceRotationPosture,
} from "./source-key-posture";

export type AgentGuardSourceKeyLifecycleTone =
  | "green"
  | "amber"
  | "red"
  | "slate";

export type AgentGuardSourceKeyLifecycleStageId =
  | "create"
  | "store"
  | "test"
  | "confirm"
  | "rotate"
  | "revoke"
  | "document";

export type AgentGuardSourceKeyLifecycleNextActionId =
  | "keep_operating"
  | "send_test_event"
  | "plan_rotation"
  | "rotate_now"
  | "confirm_created_date"
  | "retain_history";

export type AgentGuardSourceKeyLifecycleStage = {
  id: AgentGuardSourceKeyLifecycleStageId;
  label: string;
  operatorAction: string;
  customerAction: string;
  evidence: string;
  boundary: string;
};

export type AgentGuardSourceKeyLifecycleSourceInput = {
  id: string;
  name: string;
  environment: string;
  status: string;
  tokenHint: string;
  allowedToolNames: readonly string[];
  createdAt: string | null;
  lastUsedAt: string | null;
};

export type AgentGuardSourceKeyLifecycleSourceSummary = {
  id: string;
  name: string;
  environment: string;
  status: string;
  tokenHint: string;
  scopeLabel: string;
  activityLabel: string;
  rotation: AgentIngestSourceRotationPosture;
  tone: AgentGuardSourceKeyLifecycleTone;
  lifecycleLabel: string;
  nextActionId: AgentGuardSourceKeyLifecycleNextActionId;
  nextAction: string;
  evidenceLine: string;
};

export type AgentGuardSourceKeyLifecycleMetrics = {
  totalSources: number;
  activeSources: number;
  revokedSources: number;
  neverUsedSources: number;
  scopedSources: number;
  rotationAttentionSources: number;
};

export type AgentGuardSourceKeyLifecycleHandoff = {
  title: string;
  overview: string;
  boundary: string;
  metrics: AgentGuardSourceKeyLifecycleMetrics;
  stages: readonly AgentGuardSourceKeyLifecycleStage[];
  sources: AgentGuardSourceKeyLifecycleSourceSummary[];
  handoffText: string;
};

export const AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY = {
  title: "Source-key lifecycle handoff",
  overview:
    "Repeatable operator handoff for creating, storing, testing, rotating, revoking, and documenting AgentGuard source keys.",
  boundary:
    "This handoff is implementation support only. It does not create source keys, reveal source keys, recover source keys, rotate keys automatically, expire keys automatically, store secrets, store raw content, change policies, mutate reviews, change export settings, save evidence, create acknowledgements, provide legal advice, provide certification, make compliance determinations, provide auditor attestation, provide a security warranty, deliver managed connectors, perform automatic monitoring, or enforce policy by itself.",
  noSecrets:
    "Use source-key hints only. Do not paste source keys, signing secrets, private keys, raw prompts, responses, files, messages, real credentials, or customer data into handoffs, tickets, evidence notes, or shared examples.",
} as const;

export const AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES: readonly AgentGuardSourceKeyLifecycleStage[] = [
  {
    id: "create",
    label: "Create scoped source",
    operatorAction:
      "Create a source for one trusted server-side wrapper and scope allowed tool names when practical.",
    customerAction:
      "Confirm the wrapper, owner, environment, and exact tool names before the key is generated.",
    evidence:
      "Source row shows expected name, environment, active status, token hint, and allowed tool scope.",
    boundary:
      "Creating a source shows the key once; ShadowGuard cannot reveal it later.",
  },
  {
    id: "store",
    label: "Store server-side",
    operatorAction:
      "Tell the customer engineer to store the one-time key as AGENTGUARD_INGEST_TOKEN or equivalent server-side secret.",
    customerAction:
      "Update a trusted backend secret store or environment variable; keep the key out of browser code, logs, tickets, and docs.",
    evidence:
      "Customer confirms the key is server-side and the wrapper points to SHADOWGUARD_APP_URL.",
    boundary:
      "ShadowGuard is not a secret vault and does not recover lost source keys.",
  },
  {
    id: "test",
    label: "Send safe test event",
    operatorAction:
      "Use the dashboard test event or the documented diagnostic command with placeholder content.",
    customerAction:
      "Send one safe event through POST /api/agent-guard/activity with Authorization: Bearer <source-key>.",
    evidence:
      "Ingestion shows last-used metadata and Monitoring shows source-attributed submitted activity.",
    boundary:
      "Test with placeholder content only; do not use customer data or real credentials.",
  },
  {
    id: "confirm",
    label: "Confirm outcome",
    operatorAction:
      "Confirm source attribution, risk label, policy outcome, and review queue behavior before expanding traffic.",
    customerAction:
      "Confirm the wrapper can honor block decisions or route warn/quarantine outcomes as agreed.",
    evidence:
      "Policy outcome, review row, or no-block response matches the expected pilot behavior.",
    boundary:
      "AgentGuard returns decision metadata; customer-controlled wrappers decide how to honor it.",
  },
  {
    id: "rotate",
    label: "Rotate replacement-first",
    operatorAction:
      "Create a replacement source before touching the old source and keep both rows visible during validation.",
    customerAction:
      "Store the replacement key, deploy it, and send a safe test event from the replacement source.",
    evidence:
      "Replacement source shows recent activity and expected policy behavior.",
    boundary:
      "Rotation is advisory and manual; ShadowGuard does not rotate or expire keys automatically.",
  },
  {
    id: "revoke",
    label: "Revoke old source",
    operatorAction:
      "Revoke the old source only after the replacement source is proven and customer traffic has moved.",
    customerAction:
      "Remove the old key from the server-side secret store and confirm no wrapper still uses it.",
    evidence:
      "Old source status is revoked, replacement source remains active, and attribution history stays readable.",
    boundary:
      "Revocation blocks future submissions from the old key but keeps old activity attribution.",
  },
  {
    id: "document",
    label: "Document metadata-only",
    operatorAction:
      "Record owner, wrapper location, status, evidence link, and notes without storing key material or raw content.",
    customerAction:
      "Provide non-sensitive implementation proof and confirm who owns future rotation.",
    evidence:
      "Integration Evidence, readiness packet, or runbook references source-key lifecycle status.",
    boundary:
      "Evidence is metadata-only and is not legal advice, certification, compliance determination, or auditor attestation.",
  },
];

function sourceName(value: string): string {
  return value.trim().slice(0, 120) || "Unnamed source";
}

function sourceEnvironment(value: string): string {
  return value.trim().slice(0, 80) || "unknown";
}

function sourceStatus(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

function tokenHint(value: string): string {
  return value.trim().slice(0, 80) || "hint unavailable";
}

function scopeLabel(allowedToolNames: readonly string[]): string {
  const normalized = allowedToolNames
    .map((name) => name.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized.join(", ") : "Any submitted tool name";
}

function activityLabel(lastUsedAt: string | null): string {
  return lastUsedAt ? `Last used ${lastUsedAt}` : "Never used";
}

function lifecycleDecision(input: {
  source: AgentGuardSourceKeyLifecycleSourceInput;
  rotation: AgentIngestSourceRotationPosture;
}): Pick<
  AgentGuardSourceKeyLifecycleSourceSummary,
  "tone" | "lifecycleLabel" | "nextActionId" | "nextAction" | "evidenceLine"
> {
  const status = sourceStatus(input.source.status);

  if (status === "revoked") {
    return {
      tone: "slate",
      lifecycleLabel: "History retained",
      nextActionId: "retain_history",
      nextAction:
        "Keep this source row for attribution history. Create a new active source if the wrapper resumes.",
      evidenceLine:
        "Revoked source cannot submit future activity; old rows remain useful for audit context.",
    };
  }

  if (input.rotation.status === "unknown") {
    return {
      tone: "slate",
      lifecycleLabel: "Confirm manually",
      nextActionId: "confirm_created_date",
      nextAction:
        "Confirm the source creation date and ownership before expanding or rotating this wrapper.",
      evidenceLine:
        "Created date is unavailable or invalid, so rotation posture needs manual confirmation.",
    };
  }

  if (input.rotation.status === "overdue") {
    return {
      tone: "red",
      lifecycleLabel: "Rotate now",
      nextActionId: "rotate_now",
      nextAction:
        "Create a replacement source, store the new key server-side, test it, then revoke this old source.",
      evidenceLine:
        "Source is past the advisory rotation window and should not broaden pilot scope until rotation is planned.",
    };
  }

  if (input.rotation.status === "due_soon") {
    return {
      tone: "amber",
      lifecycleLabel: "Schedule rotation",
      nextActionId: "plan_rotation",
      nextAction:
        "Schedule replacement-first rotation before broader enterprise rollout.",
      evidenceLine:
        "Source is approaching the advisory rotation window; keep owner and replacement timing clear.",
    };
  }

  if (!input.source.lastUsedAt) {
    return {
      tone: "amber",
      lifecycleLabel: "Needs test event",
      nextActionId: "send_test_event",
      nextAction:
        "Send one safe test event and confirm source-attributed activity before pilot traffic.",
      evidenceLine:
        "Source is active and fresh but has not proven the bearer-token ingest path yet.",
    };
  }

  return {
    tone: "green",
    lifecycleLabel: "Operational",
    nextActionId: "keep_operating",
    nextAction:
      "Keep the source scoped, monitor policy outcomes, and schedule rotation before the advisory window.",
    evidenceLine:
      "Source is active, recently used, and inside the advisory rotation window.",
  };
}

export function summarizeAgentGuardSourceKeyLifecycleSource(
  source: AgentGuardSourceKeyLifecycleSourceInput,
  now = new Date()
): AgentGuardSourceKeyLifecycleSourceSummary {
  const rotation = agentIngestSourceRotationPosture(
    {
      createdAt: source.createdAt,
      status: source.status,
    },
    now
  );
  const decision = lifecycleDecision({ source, rotation });

  return {
    id: source.id,
    name: sourceName(source.name),
    environment: sourceEnvironment(source.environment),
    status: sourceStatus(source.status),
    tokenHint: tokenHint(source.tokenHint),
    scopeLabel: scopeLabel(source.allowedToolNames),
    activityLabel: activityLabel(source.lastUsedAt),
    rotation,
    ...decision,
  };
}

function buildMetrics(
  summaries: AgentGuardSourceKeyLifecycleSourceSummary[]
): AgentGuardSourceKeyLifecycleMetrics {
  return {
    totalSources: summaries.length,
    activeSources: summaries.filter((source) => source.status === "active").length,
    revokedSources: summaries.filter((source) => source.status === "revoked").length,
    neverUsedSources: summaries.filter(
      (source) => source.status === "active" && source.activityLabel === "Never used"
    ).length,
    scopedSources: summaries.filter(
      (source) => source.scopeLabel !== "Any submitted tool name"
    ).length,
    rotationAttentionSources: summaries.filter(
      (source) =>
        source.nextActionId === "plan_rotation" ||
        source.nextActionId === "rotate_now" ||
        source.nextActionId === "confirm_created_date"
    ).length,
  };
}

function stageLines(stages: readonly AgentGuardSourceKeyLifecycleStage[]): string {
  return stages
    .map((stage, index) =>
      [
        `${index + 1}. ${stage.label}`,
        `Operator: ${stage.operatorAction}`,
        `Customer: ${stage.customerAction}`,
        `Evidence: ${stage.evidence}`,
        `Boundary: ${stage.boundary}`,
      ].join("\n")
    )
    .join("\n\n");
}

function sourceLines(
  sources: readonly AgentGuardSourceKeyLifecycleSourceSummary[]
): string {
  if (sources.length === 0) {
    return [
      "- No sources loaded yet.",
      "- Create a scoped source for a trusted server-side wrapper.",
      "- Store the one-time key server-side, send a safe test event, and confirm source attribution before pilot traffic.",
    ].join("\n");
  }

  return sources
    .map((source) =>
      [
        `- ${source.name} (${source.environment})`,
        `  - Status: ${source.status}; lifecycle: ${source.lifecycleLabel}; rotation: ${source.rotation.label}.`,
        `  - Key hint only: ${source.tokenHint}; scope: ${source.scopeLabel}.`,
        `  - Activity: ${source.activityLabel}.`,
        `  - Next action: ${source.nextAction}`,
        `  - Evidence: ${source.evidenceLine}`,
      ].join("\n")
    )
    .join("\n");
}

export function buildAgentGuardSourceKeyLifecycleHandoff(input: {
  sources: readonly AgentGuardSourceKeyLifecycleSourceInput[];
  generatedAt?: string;
  now?: Date;
}): AgentGuardSourceKeyLifecycleHandoff {
  const now = input.now ?? new Date();
  const generatedAt = input.generatedAt ?? now.toISOString();
  const summaries = input.sources.map((source) =>
    summarizeAgentGuardSourceKeyLifecycleSource(source, now)
  );
  const metrics = buildMetrics(summaries);

  const handoffText = [
    `# ${AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.title}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.overview,
    "",
    `Boundary: ${AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.boundary}`,
    "",
    `Secret handling: ${AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.noSecrets}`,
    "",
    "## Metrics",
    "",
    `- Total sources: ${metrics.totalSources}`,
    `- Active sources: ${metrics.activeSources}`,
    `- Revoked sources: ${metrics.revokedSources}`,
    `- Never used sources: ${metrics.neverUsedSources}`,
    `- Scoped sources: ${metrics.scopedSources}`,
    `- Rotation attention sources: ${metrics.rotationAttentionSources}`,
    "",
    "## Source next actions",
    "",
    sourceLines(summaries),
    "",
    "## Lifecycle stages",
    "",
    stageLines(AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES),
    "",
    "## Exclusions",
    "",
    "- No automatic rotation or automatic expiry is performed.",
    "- No source-key recovery, source-key reveal, secret vaulting, raw content storage, or managed connector delivery is included.",
    "- No source, policy, review, export, evidence, acknowledgement, monitoring, or enforcement behavior is changed by this handoff.",
  ].join("\n");

  return {
    title: AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.title,
    overview: AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.overview,
    boundary: AGENT_GUARD_SOURCE_KEY_LIFECYCLE_COPY.boundary,
    metrics,
    stages: AGENT_GUARD_SOURCE_KEY_LIFECYCLE_STAGES,
    sources: summaries,
    handoffText,
  };
}
