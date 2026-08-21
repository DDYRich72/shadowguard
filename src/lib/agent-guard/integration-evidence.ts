export type AgentGuardIntegrationEvidenceStatus =
  | "planned"
  | "in_progress"
  | "pilot_ready"
  | "needs_review"
  | "retired";

export type AgentGuardIntegrationEvidenceStatusTone =
  | "slate"
  | "blue"
  | "green"
  | "amber";

export type AgentGuardIntegrationEvidenceChecklistItem = {
  id:
    | "server_side_secret"
    | "request_fields_mapped"
    | "decision_handling"
    | "test_event_accepted"
    | "owner_named"
    | "evidence_linked";
  label: string;
  detail: string;
  completed: boolean;
};

export type AgentGuardIntegrationEvidence = {
  id: string;
  sourceId: string | null;
  sourceName: string | null;
  sourceEnvironment: string | null;
  sourceStatus: string | null;
  status: AgentGuardIntegrationEvidenceStatus;
  statusLabel: string;
  statusTone: AgentGuardIntegrationEvidenceStatusTone;
  title: string;
  implementationOwner: string;
  wrapperLocation: string;
  evidenceUrl: string;
  checklistSnapshot: AgentGuardIntegrationEvidenceChecklistItem[];
  completedChecklistCount: number;
  note: string;
  createdByUserId: string | null;
  createdByEmail: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentGuardIntegrationEvidenceRow = {
  id: string;
  source_id: string | null;
  source_name?: string | null;
  source_environment?: string | null;
  source_status?: string | null;
  agent_ingest_sources?:
    | {
        name?: string | null;
        environment?: string | null;
        status?: string | null;
      }
    | null;
  status: AgentGuardIntegrationEvidenceStatus;
  title: string;
  implementation_owner: string | null;
  wrapper_location: string | null;
  evidence_url: string | null;
  checklist_snapshot: unknown;
  note: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  updated_by_user_id: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export const AGENT_GUARD_INTEGRATION_EVIDENCE_COPY = {
  overview:
    "Integration evidence records document customer-controlled AgentGuard source implementation details such as owner, wrapper location, evidence link, and checklist state.",
  boundary:
    "Integration evidence is metadata-only implementation support. It is not secret storage, not raw content storage, not legal advice, not a certification, not a compliance determination, not an auditor attestation, and not automatic monitoring.",
  migrationWarning:
    "AgentGuard integration evidence is unavailable. Verify that the current initial schema is installed before recording implementation evidence.",
  secretWarning:
    "Do not paste source keys, private keys, credentials, raw prompts, responses, files, or message content into evidence fields.",
} as const;

export const AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES: Record<
  AgentGuardIntegrationEvidenceStatus,
  { label: string; tone: AgentGuardIntegrationEvidenceStatusTone }
> = {
  planned: { label: "Planned", tone: "slate" },
  in_progress: { label: "In progress", tone: "blue" },
  pilot_ready: { label: "Pilot ready", tone: "green" },
  needs_review: { label: "Needs review", tone: "amber" },
  retired: { label: "Retired", tone: "slate" },
};

export const AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST: AgentGuardIntegrationEvidenceChecklistItem[] = [
  {
    id: "server_side_secret",
    label: "Source key stored server-side",
    detail: "The source key is stored in server-side secret storage, not browser code.",
    completed: false,
  },
  {
    id: "request_fields_mapped",
    label: "Activity fields mapped",
    detail: "toolName, userEmail, activityType, content, and metadata are mapped intentionally.",
    completed: false,
  },
  {
    id: "decision_handling",
    label: "Decision handling reviewed",
    detail: "The wrapper has an agreed behavior for blocked, warn, quarantine, and allow outcomes.",
    completed: false,
  },
  {
    id: "test_event_accepted",
    label: "Test event accepted",
    detail: "A safe test event was accepted and source health updated.",
    completed: false,
  },
  {
    id: "owner_named",
    label: "Owner named",
    detail: "A responsible owner or team is recorded for the source integration.",
    completed: false,
  },
  {
    id: "evidence_linked",
    label: "Evidence linked",
    detail: "A customer-controlled runbook, ticket, PR, or architecture note is linked.",
    completed: false,
  },
];

const DISALLOWED_EVIDENCE_PATTERNS = [
  /sgag_[A-Za-z0-9_-]{8,}/i,
  /sgae_[A-Za-z0-9_-]{8,}/i,
  /BEGIN [A-Z ]*PRIVATE KEY/i,
  /AGENTGUARD_INGEST_TOKEN\s*=/i,
  /AGENT_GUARD_EXPORT_SECRET_KEY\s*=/i,
  /authorization:\s*bearer\s+sgag_/i,
  /authorization:\s*bearer\s+[A-Za-z0-9._-]{12,}/i,
];

export function containsDisallowedIntegrationEvidenceText(
  value: unknown
): boolean {
  if (typeof value === "string") {
    return DISALLOWED_EVIDENCE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsDisallowedIntegrationEvidenceText(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      containsDisallowedIntegrationEvidenceText(item)
    );
  }
  return false;
}

export function isMissingAgentGuardIntegrationEvidenceTable(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("agent_integration_evidence")
  );
}

function checklistItemFromUnknown(
  value: unknown
): AgentGuardIntegrationEvidenceChecklistItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AgentGuardIntegrationEvidenceChecklistItem>;
  const template = AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST.find(
    (candidate) => candidate.id === item.id
  );
  if (!template) return null;
  return {
    ...template,
    label: typeof item.label === "string" && item.label.trim() ? item.label : template.label,
    detail:
      typeof item.detail === "string" && item.detail.trim()
        ? item.detail
        : template.detail,
    completed: item.completed === true,
  };
}

export function normalizeAgentGuardIntegrationEvidenceChecklist(
  value: unknown
): AgentGuardIntegrationEvidenceChecklistItem[] {
  const incoming = Array.isArray(value) ? value : [];
  const mappedById = new Map(
    incoming
      .map(checklistItemFromUnknown)
      .filter(
        (item): item is AgentGuardIntegrationEvidenceChecklistItem => item !== null
      )
      .map((item) => [item.id, item])
  );

  return AGENT_GUARD_INTEGRATION_EVIDENCE_CHECKLIST.map(
    (template) => mappedById.get(template.id) ?? template
  );
}

export function agentGuardIntegrationEvidenceRowToApi(
  row: AgentGuardIntegrationEvidenceRow
): AgentGuardIntegrationEvidence {
  const statusMeta =
    AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES[row.status] ??
    AGENT_GUARD_INTEGRATION_EVIDENCE_STATUSES.in_progress;
  const checklist = normalizeAgentGuardIntegrationEvidenceChecklist(
    row.checklist_snapshot
  );
  const source = row.agent_ingest_sources;

  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name ?? source?.name ?? null,
    sourceEnvironment: row.source_environment ?? source?.environment ?? null,
    sourceStatus: row.source_status ?? source?.status ?? null,
    status: row.status,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    title: row.title,
    implementationOwner: row.implementation_owner ?? "",
    wrapperLocation: row.wrapper_location ?? "",
    evidenceUrl: row.evidence_url ?? "",
    checklistSnapshot: checklist,
    completedChecklistCount: checklist.filter((item) => item.completed).length,
    note: row.note ?? "",
    createdByUserId: row.created_by_user_id,
    createdByEmail: row.created_by_email,
    updatedByUserId: row.updated_by_user_id,
    updatedByEmail: row.updated_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
