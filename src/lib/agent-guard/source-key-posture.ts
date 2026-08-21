import type { AgentIngestSourceStatus } from "./ingest-sources";

export const AGENT_GUARD_SOURCE_ROTATION_DAYS = 90;
export const AGENT_GUARD_SOURCE_ROTATION_WARNING_DAYS = 75;

export type AgentIngestSourceRotationTone = "green" | "amber" | "red" | "slate";

export type AgentIngestSourceRotationStatus =
  | "fresh"
  | "due_soon"
  | "overdue"
  | "revoked"
  | "unknown";

export type AgentIngestSourceRotationPosture = {
  status: AgentIngestSourceRotationStatus;
  tone: AgentIngestSourceRotationTone;
  label: string;
  description: string;
  daysOld: number | null;
  dueAt: string | null;
};

export function agentIngestSourceRotationPosture(
  input: {
    createdAt: string | null | undefined;
    status?: AgentIngestSourceStatus | string | null;
  },
  now = new Date()
): AgentIngestSourceRotationPosture {
  if (input.status === "revoked") {
    return {
      status: "revoked",
      tone: "slate",
      label: "Revoked",
      description: "This key is revoked and cannot submit future activity.",
      daysOld: null,
      dueAt: null,
    };
  }

  if (!input.createdAt) {
    return {
      status: "unknown",
      tone: "slate",
      label: "Rotation unknown",
      description: "Created date is unavailable; confirm this key manually.",
      daysOld: null,
      dueAt: null,
    };
  }

  const created = new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) {
    return {
      status: "unknown",
      tone: "slate",
      label: "Rotation unknown",
      description: "Created date is invalid; confirm this key manually.",
      daysOld: null,
      dueAt: null,
    };
  }

  const daysOld = Math.max(
    0,
    Math.floor((now.getTime() - created.getTime()) / 86_400_000)
  );
  const due = new Date(created);
  due.setDate(due.getDate() + AGENT_GUARD_SOURCE_ROTATION_DAYS);
  const dueAt = due.toISOString();

  if (daysOld >= AGENT_GUARD_SOURCE_ROTATION_DAYS) {
    return {
      status: "overdue",
      tone: "red",
      label: "Rotate now",
      description:
        "This source key is past the advisory rotation window. Create a replacement, test it, then revoke the old key.",
      daysOld,
      dueAt,
    };
  }

  if (daysOld >= AGENT_GUARD_SOURCE_ROTATION_WARNING_DAYS) {
    return {
      status: "due_soon",
      tone: "amber",
      label: "Rotation due soon",
      description:
        "This source key is nearing the advisory rotation window. Schedule a replacement before broad rollout.",
      daysOld,
      dueAt,
    };
  }

  return {
    status: "fresh",
    tone: "green",
    label: "Rotation fresh",
    description: "This source key is inside the advisory rotation window.",
    daysOld,
    dueAt,
  };
}
