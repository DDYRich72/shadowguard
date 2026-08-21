export type AgentGuardStatusTone =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "slate"
  | "brand";

export type AgentGuardPilotStatusToneKey =
  | "setup_required"
  | "ready_for_pilot"
  | "needs_review"
  | "live_caution";

export type AgentGuardEnterpriseSetupStatusToneKey =
  | AgentGuardPilotStatusToneKey
  | "in_progress"
  | "enterprise_ready";

export type AgentGuardEnterpriseStepStatusToneKey =
  | "done"
  | "next"
  | "attention"
  | "locked";

export type AgentGuardHandoffArtifactStatusToneKey =
  | "ready"
  | "available"
  | "gap"
  | "caution";

export type AgentGuardConcernSeverityToneKey =
  | "attention"
  | "blocked"
  | "live_caution";

export const AGENT_GUARD_STATUS_TONES: AgentGuardStatusTone[] = [
  "green",
  "amber",
  "red",
  "blue",
  "slate",
  "brand",
];

export const AGENT_GUARD_STATUS_SURFACE_CLASSES: Record<
  AgentGuardStatusTone,
  string
> = {
  green: "sg-status-surface sg-status-surface-green",
  amber: "sg-status-surface sg-status-surface-amber",
  red: "sg-status-surface sg-status-surface-red",
  blue: "sg-status-surface sg-status-surface-blue",
  slate: "sg-status-surface sg-status-surface-slate",
  brand: "sg-status-surface sg-status-surface-brand",
};

export const AGENT_GUARD_STATUS_BADGE_CLASSES: Record<
  AgentGuardStatusTone,
  string
> = {
  green: "sg-status-badge sg-status-badge-green",
  amber: "sg-status-badge sg-status-badge-amber",
  red: "sg-status-badge sg-status-badge-red",
  blue: "sg-status-badge sg-status-badge-blue",
  slate: "sg-status-badge sg-status-badge-slate",
  brand: "sg-status-badge sg-status-badge-brand",
};

export const AGENT_GUARD_STATUS_LABEL_CLASSES: Record<
  AgentGuardStatusTone,
  string
> = {
  green: "sg-status-accent-green",
  amber: "sg-status-accent-amber",
  red: "sg-status-accent-red",
  blue: "sg-status-accent-blue",
  slate: "sg-status-accent-slate",
  brand: "sg-status-accent-brand",
};

export const AGENT_GUARD_STATUS_HOVER_CLASSES: Record<
  AgentGuardStatusTone,
  string
> = {
  green: "hover:brightness-110",
  amber: "hover:brightness-110",
  red: "hover:brightness-110",
  blue: "hover:brightness-110",
  slate: "hover:brightness-110",
  brand: "hover:brightness-110",
};

export const AGENT_GUARD_PILOT_STATUS_TONES: Record<
  AgentGuardPilotStatusToneKey,
  AgentGuardStatusTone
> = {
  setup_required: "blue",
  ready_for_pilot: "green",
  needs_review: "amber",
  live_caution: "red",
};

export const AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES: Record<
  AgentGuardEnterpriseSetupStatusToneKey,
  AgentGuardStatusTone
> = {
  setup_required: "blue",
  in_progress: "blue",
  needs_review: "amber",
  live_caution: "red",
  enterprise_ready: "green",
  ready_for_pilot: "green",
};

export const AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES: Record<
  AgentGuardEnterpriseStepStatusToneKey,
  AgentGuardStatusTone
> = {
  done: "green",
  next: "brand",
  attention: "amber",
  locked: "slate",
};

export const AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES: Record<
  AgentGuardHandoffArtifactStatusToneKey,
  AgentGuardStatusTone
> = {
  ready: "green",
  available: "blue",
  gap: "red",
  caution: "amber",
};

export const AGENT_GUARD_CONCERN_SEVERITY_TONES: Record<
  AgentGuardConcernSeverityToneKey,
  AgentGuardStatusTone
> = {
  attention: "amber",
  blocked: "red",
  live_caution: "red",
};

export function agentGuardStatusSurfaceClass(tone: AgentGuardStatusTone): string {
  return AGENT_GUARD_STATUS_SURFACE_CLASSES[tone];
}

export function agentGuardStatusBadgeClass(tone: AgentGuardStatusTone): string {
  return AGENT_GUARD_STATUS_BADGE_CLASSES[tone];
}

export function agentGuardStatusLabelClass(tone: AgentGuardStatusTone): string {
  return AGENT_GUARD_STATUS_LABEL_CLASSES[tone];
}
