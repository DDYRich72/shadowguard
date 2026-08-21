"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  History,
  MessageSquareWarning,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS,
  AGENT_GUARD_SLACK_PREVIEW_COPY,
  AGENT_GUARD_SLACK_PREVIEW_CUSTOMER_RESPONSIBILITIES,
  AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES,
  AGENT_GUARD_SLACK_PREVIEW_FIELDS,
  AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS,
  AGENT_GUARD_SLACK_PREVIEW_GATES,
  AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS,
  agentGuardSlackPreviewGateCounts,
  renderSlackWorkflowPreviewSpecMarkdown,
  type AgentGuardSlackPreviewGateStatus,
} from "@/lib/agent-guard/slack-workflow-preview";
import {
  AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY,
  buildAgentGuardSlackAutomaticReadiness,
  type AgentGuardSlackAutomaticReadiness,
  type AgentGuardSlackAutomaticReadinessStatus,
} from "@/lib/agent-guard/slack-automatic-readiness";

type CopyState = "idle" | "copied" | "failed";
type SlackTargetType = "workflow_webhook" | "incoming_webhook";
type SlackTargetStatus = "enabled" | "disabled";
type SlackEventType = "agentguard.policy.blocked" | "agentguard.review.required";
type SlackApprovalStatus =
  | "not_requested"
  | "requested"
  | "approved"
  | "not_applicable";
type SlackUserIdentifierMode = "redacted" | "full_email" | "customer_identifier";
type AttemptStatus = "succeeded" | "failed" | "dry_run";
type AttemptMode = "manual_test" | "automatic" | "dry_run";
type SlackEvidencePacketStatus =
  | "setup_required"
  | "ready_for_pilot"
  | "needs_review"
  | "live_caution";

type SlackAttempt = {
  id: string;
  targetId: string | null;
  eventId: string;
  eventType: string;
  status: AttemptStatus;
  deliveryMode: AttemptMode;
  httpStatus: number | null;
  durationMs: number;
  errorMessage: string | null;
  failureLabel: string;
  failureSummary: string;
  failureNextAction: string;
  createdByEmail: string | null;
  createdAt: string;
};

type SlackTarget = {
  id: string;
  name: string;
  targetType: SlackTargetType;
  status: SlackTargetStatus;
  webhookUrlHint: string;
  eventTypes: SlackEventType[];
  dryRunEnabled: boolean;
  liveSendEnabled: boolean;
  liveEligible: boolean;
  ownerName: string;
  ownerEmail: string;
  customerApprovalStatus: SlackApprovalStatus;
  customerApprovalNote: string;
  customerApprovedAt: string | null;
  customerApprovedByEmail: string | null;
  userIdentifierMode: SlackUserIdentifierMode;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  lastTestedAt: string | null;
  lastSuccessfulTestAt: string | null;
  lastLiveAttemptAt: string | null;
  latestAttempt: SlackAttempt | null;
  createdAt: string;
  updatedAt: string;
};

type SlackTargetDraft = {
  ownerName: string;
  ownerEmail: string;
  customerApprovalStatus: SlackApprovalStatus;
  customerApprovalNote: string;
  userIdentifierMode: SlackUserIdentifierMode;
  eventTypes: SlackEventType[];
  replacementUrl: string;
};

type SlackEvidencePacket = {
  id: string;
  title: string;
  status: SlackEvidencePacketStatus;
  statusLabel: string;
  summary: string;
  packetText: string;
  generatedByEmail: string | null;
  generatedAt: string;
  createdAt: string;
  summaryMetrics: {
    totalAttemptCount: number;
    hasDryRunEvidence: boolean;
    hasManualSuccess: boolean;
    livePostureOn: boolean;
  };
  snapshot: {
    target: {
      name: string;
      webhookUrlHint: string;
    };
  };
};

type TargetPatch = Partial<
  Pick<
    SlackTarget,
    | "status"
    | "dryRunEnabled"
    | "liveSendEnabled"
    | "ownerName"
    | "ownerEmail"
    | "customerApprovalStatus"
    | "customerApprovalNote"
    | "userIdentifierMode"
    | "eventTypes"
  >
> & { webhookUrl?: string };

const GATE_CLASSES: Record<AgentGuardSlackPreviewGateStatus, string> = {
  decided_for_preview: "border-green-200 bg-green-50 text-green-700",
  requires_future_build: "border-blue-200 bg-blue-50 text-blue-700",
  out_of_scope: "border-slate-200 bg-slate-100 text-slate-600",
};

const SLACK_EVENT_OPTIONS: { value: SlackEventType; label: string }[] = [
  { value: "agentguard.policy.blocked", label: "Blocked policy" },
  { value: "agentguard.review.required", label: "Review required" },
];

const APPROVAL_OPTIONS: { value: SlackApprovalStatus; label: string }[] = [
  { value: "not_requested", label: "Not requested" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "not_applicable", label: "Not applicable" },
];

const USER_IDENTIFIER_OPTIONS: { value: SlackUserIdentifierMode; label: string }[] = [
  { value: "redacted", label: "Redacted" },
  { value: "full_email", label: "Full email" },
  { value: "customer_identifier", label: "Customer identifier" },
];

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function copyTextToClipboard(text: string): Promise<boolean> {
  return (async () => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to textarea fallback for restricted browser contexts.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      textarea.style.left = "-1000px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  })();
}

function targetDraftFromTarget(target: SlackTarget): SlackTargetDraft {
  return {
    ownerName: target.ownerName,
    ownerEmail: target.ownerEmail,
    customerApprovalStatus: target.customerApprovalStatus,
    customerApprovalNote: target.customerApprovalNote,
    userIdentifierMode: target.userIdentifierMode,
    eventTypes: target.eventTypes,
    replacementUrl: "",
  };
}

function mergeTargetDrafts(
  current: Record<string, SlackTargetDraft>,
  targets: SlackTarget[]
): Record<string, SlackTargetDraft> {
  const next: Record<string, SlackTargetDraft> = {};
  for (const target of targets) {
    next[target.id] = current[target.id] ?? targetDraftFromTarget(target);
  }
  return next;
}

function attemptClass(status: AttemptStatus): string {
  if (status === "succeeded") return "border-green-200 bg-green-50 text-green-700";
  if (status === "dry_run") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function packetStatusClass(status: SlackEvidencePacketStatus): string {
  if (status === "ready_for_pilot") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "live_caution") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "needs_review") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function automaticReadinessClass(
  status: AgentGuardSlackAutomaticReadinessStatus
): string {
  if (status === "automatic_outbound_ready") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "automatic_dry_run_ready") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "manual_verified_auto_off") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function automaticGateClass(ready: boolean): string {
  return ready
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function approvalClass(status: SlackApprovalStatus): string {
  if (status === "approved") return "border-green-200 bg-green-50 text-green-700";
  if (status === "requested") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "not_applicable") return "border-border bg-muted text-muted-foreground";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function approvalLabel(status: SlackApprovalStatus): string {
  return APPROVAL_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function targetTypeLabel(type: SlackTargetType): string {
  return type === "incoming_webhook" ? "Incoming webhook" : "Workflow webhook";
}

function deliveryModeLabel(mode: AttemptMode): string {
  if (mode === "manual_test") return "manual test";
  if (mode === "dry_run") return "dry-run";
  return "automatic";
}

type ValidationStepStatus = "complete" | "pending" | "safe" | "attention";

type ValidationStep = {
  label: string;
  status: ValidationStepStatus;
  detail: string;
};

function validationStepClass(status: ValidationStepStatus): string {
  if (status === "complete") return "border-green-200 bg-green-50 text-green-700";
  if (status === "safe") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "attention") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-border bg-muted text-muted-foreground";
}

function validationStepLabel(status: ValidationStepStatus): string {
  if (status === "complete") return "Done";
  if (status === "safe") return "Guarded";
  if (status === "attention") return "Review";
  return "Pending";
}

function slackTargetValidationSteps(
  target: SlackTarget,
  hasDryRunEvidence: boolean
): ValidationStep[] {
  return [
    {
      label: "Enable",
      status: target.status === "enabled" ? "complete" : "pending",
      detail:
        target.status === "enabled"
          ? "Manual tests are allowed."
          : "Enable before sending tests.",
    },
    {
      label: "Dry-run",
      status: hasDryRunEvidence ? "complete" : "pending",
      detail: hasDryRunEvidence
        ? "A no-outbound attempt exists."
        : "Log one before outbound testing.",
    },
    {
      label: "Manual send",
      status: target.lastSuccessfulTestAt ? "complete" : "pending",
      detail: target.lastSuccessfulTestAt
        ? `Succeeded ${formatDate(target.lastSuccessfulTestAt)}.`
        : "Send only to a controlled Slack URL.",
    },
    {
      label: "Approval",
      status:
        target.customerApprovalStatus === "approved" ? "complete" : "attention",
      detail:
        target.customerApprovalStatus === "approved"
          ? "Customer approval recorded."
          : "Approval is required before live automatic sends.",
    },
    {
      label: "Auto live",
      status: target.liveSendEnabled ? "attention" : "safe",
      detail: target.liveSendEnabled
        ? "Automatic send posture is on."
        : "Automatic sends remain off.",
    },
  ];
}

function slackTargetNextAction(
  target: SlackTarget,
  hasDryRunEvidence: boolean
): string {
  if (target.status !== "enabled") {
    return "Enable this target before sending a manual test.";
  }
  if (!hasDryRunEvidence && target.dryRunEnabled) {
    return "Send a dry-run test first; it records evidence without contacting Slack.";
  }
  if (target.dryRunEnabled) {
    return "Dry-run evidence exists. Allow outbound tests only for a controlled Slack receiver.";
  }
  if (!target.lastSuccessfulTestAt) {
    return "Send a manual test and confirm Slack receives only metadata-only fields.";
  }
  if (target.liveSendEnabled) {
    return "Manual delivery is verified; review customer approval and rollback ownership before automatic sends stay on.";
  }
  return "Manual delivery is verified and automatic sends remain off. Keep this posture unless a pilot owner approves live events.";
}

function renderTargetEvidenceSummary(
  target: SlackTarget,
  targetAttempts: SlackAttempt[]
): string {
  const hasDryRunEvidence = targetAttempts.some(
    (attempt) => attempt.status === "dry_run"
  );
  const latestAttempt = target.latestAttempt;
  return [
    "# AgentGuard Slack Preview Evidence",
    "",
    `Target: ${target.name}`,
    `Type: ${targetTypeLabel(target.targetType)}`,
    `URL hint: ${target.webhookUrlHint}`,
    `Status: ${target.status}`,
    `Dry-run posture: ${target.dryRunEnabled ? "on; outbound Slack requests are skipped" : "off; manual tests can send outbound requests"}`,
    `Automatic live posture: ${target.liveSendEnabled ? "on; still gated by eligibility and approval" : "off"}`,
    `Event scope: ${target.eventTypes.join(", ") || "none selected"}`,
    `Owner/team: ${target.ownerName || "-"}`,
    `Owner email: ${target.ownerEmail || "-"}`,
    `Customer approval: ${approvalLabel(target.customerApprovalStatus)}`,
    `Last test: ${formatDate(target.lastTestedAt)}`,
    `Last successful manual test: ${formatDate(target.lastSuccessfulTestAt)}`,
    `Dry-run evidence recorded: ${hasDryRunEvidence ? "yes" : "not captured"}`,
    latestAttempt
      ? `Latest attempt: ${latestAttempt.status}; ${deliveryModeLabel(latestAttempt.deliveryMode)}; ${latestAttempt.httpStatus ? `HTTP ${latestAttempt.httpStatus}` : "No HTTP"}; ${latestAttempt.durationMs} ms; ${formatDate(latestAttempt.createdAt)}`
      : "Latest attempt: none",
    "",
    "Boundary: Metadata-only Slack preview evidence. No raw prompt, response, file, message, source key, signing secret, bearer token, or plaintext Slack URL is included. This evidence does not prove Slack app installation, OAuth, channel discovery, background retry, automatic escalation, guaranteed delivery, legal advice, certification, compliance determination, auditor attestation, or security warranty.",
  ].join("\n");
}

export function SlackWorkflowPreviewPanel() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [targets, setTargets] = useState<SlackTarget[]>([]);
  const [attempts, setAttempts] = useState<SlackAttempt[]>([]);
  const [evidencePackets, setEvidencePackets] = useState<SlackEvidencePacket[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingEvidencePackets, setLoadingEvidencePackets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedEvidenceId, setCopiedEvidenceId] = useState<string | null>(null);
  const [savingEvidenceId, setSavingEvidenceId] = useState<string | null>(null);
  const [copiedPacketId, setCopiedPacketId] = useState<string | null>(null);
  const [copiedAutomaticReadinessId, setCopiedAutomaticReadinessId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [evidenceWarning, setEvidenceWarning] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<SlackTargetType>("workflow_webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [eventTypes, setEventTypes] = useState<SlackEventType[]>([
    "agentguard.policy.blocked",
    "agentguard.review.required",
  ]);
  const [drafts, setDrafts] = useState<Record<string, SlackTargetDraft>>({});
  const gateCounts = useMemo(() => agentGuardSlackPreviewGateCounts(), []);
  const specMarkdown = useMemo(
    () => renderSlackWorkflowPreviewSpecMarkdown(),
    []
  );

  async function copySpec() {
    const copied = await copyTextToClipboard(specMarkdown);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), copied ? 2000 : 3500);
  }

  async function loadTargets(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true;
    if (showLoading) setLoadingTargets(true);
    setError(null);
    const response = await fetch("/api/agent-guard/slack-workflow-targets");
    const data = await readJson(response);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to load Slack preview targets.");
      setLoadingTargets(false);
      return;
    }
    const nextTargets = data.targets ?? [];
    setTargets(nextTargets);
    setAttempts(data.attempts ?? []);
    setDrafts((current) => mergeTargetDrafts(current, nextTargets));
    setLoadingTargets(false);
  }

  async function loadEvidencePackets(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true;
    if (showLoading) setLoadingEvidencePackets(true);
    setEvidenceWarning(null);
    const response = await fetch("/api/agent-guard/slack-evidence-packets?limit=8");
    const data = await readJson(response);
    if (!response.ok) {
      if (data.error === "migration_required") {
        setEvidencePackets([]);
        setEvidenceWarning(
          data.message ?? "Slack evidence packet history is not available yet."
        );
      } else {
        setError(data.message ?? data.error ?? "Unable to load Slack evidence packets.");
      }
      setLoadingEvidencePackets(false);
      return;
    }
    setEvidencePackets(data.packets ?? []);
    setLoadingEvidencePackets(false);
  }

  async function refreshSlackPanel() {
    await Promise.all([
      loadTargets({ showLoading: false }),
      loadEvidencePackets({ showLoading: false }),
    ]);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/agent-guard/slack-workflow-targets")
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(data.message ?? data.error ?? "Unable to load Slack preview targets.");
          setLoadingTargets(false);
          return;
        }
        const nextTargets = data.targets ?? [];
        setTargets(nextTargets);
        setAttempts(data.attempts ?? []);
        setDrafts((current) => mergeTargetDrafts(current, nextTargets));
        setLoadingTargets(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load Slack preview targets.");
        setLoadingTargets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/agent-guard/slack-evidence-packets?limit=8")
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          if (data.error === "migration_required") {
            setEvidencePackets([]);
            setEvidenceWarning(
              data.message ?? "Slack evidence packet history is not available yet."
            );
          } else {
            setError(
              data.message ?? data.error ?? "Unable to load Slack evidence packets."
            );
          }
          setLoadingEvidencePackets(false);
          return;
        }
        setEvidencePackets(data.packets ?? []);
        setLoadingEvidencePackets(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load Slack evidence packets.");
        setLoadingEvidencePackets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createTarget() {
    setSaving(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/agent-guard/slack-workflow-targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        targetType,
        webhookUrl,
        ownerName,
        ownerEmail,
        eventTypes,
      }),
    });
    const data = await readJson(response);
    setSaving(false);

    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to create Slack preview target.");
      return;
    }

    setName("");
    setTargetType("workflow_webhook");
    setWebhookUrl("");
    setOwnerName("");
    setOwnerEmail("");
    setEventTypes(["agentguard.policy.blocked", "agentguard.review.required"]);
    setNotice("Slack preview target created disabled with dry-run on. Plaintext URL will not be shown again.");
    await loadTargets({ showLoading: false });
  }

  async function updateTarget(target: SlackTarget, patch: TargetPatch) {
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/slack-workflow-targets/${target.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const data = await readJson(response);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to update Slack preview target.");
      return false;
    }
    setTargets((current) =>
      current.map((item) => (item.id === target.id ? data.target : item))
    );
    setDrafts((current) => ({
      ...current,
      [target.id]: targetDraftFromTarget(data.target),
    }));
    setNotice("Slack preview target updated.");
    return true;
  }

  async function saveDraft(target: SlackTarget) {
    const draft = drafts[target.id];
    if (!draft) return;
    setSavingId(target.id);
    const patch: TargetPatch = {
      ownerName: draft.ownerName,
      ownerEmail: draft.ownerEmail,
      customerApprovalStatus: draft.customerApprovalStatus,
      customerApprovalNote: draft.customerApprovalNote,
      userIdentifierMode: draft.userIdentifierMode,
      eventTypes: draft.eventTypes,
    };
    if (draft.replacementUrl.trim()) {
      patch.webhookUrl = draft.replacementUrl;
    }
    await updateTarget(target, patch);
    setSavingId(null);
  }

  async function sendTest(target: SlackTarget) {
    setTestingId(target.id);
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/slack-workflow-targets/${target.id}/test`,
      { method: "POST" }
    );
    const data = await readJson(response);
    setTestingId(null);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to send Slack preview test.");
      return;
    }
    setNotice(
      data.attempt?.status === "dry_run"
        ? "Slack preview dry-run attempt logged without outbound request."
        : "Slack preview test attempt recorded."
    );
    await loadTargets({ showLoading: false });
  }

  async function deleteTarget(target: SlackTarget) {
    const confirmed = window.confirm(
      `Delete Slack preview target "${target.name}" and remove its stored URL? Historical attempts remain without the secret.`
    );
    if (!confirmed) return;
    setDeletingId(target.id);
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/slack-workflow-targets/${target.id}`,
      { method: "DELETE" }
    );
    const data = await readJson(response);
    setDeletingId(null);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to delete Slack preview target.");
      return;
    }
    setNotice("Slack preview target deleted and stored URL removed.");
    await loadTargets({ showLoading: false });
  }

  async function copyTargetEvidence(target: SlackTarget) {
    const targetAttempts = attempts.filter((attempt) => attempt.targetId === target.id);
    const copied = await copyTextToClipboard(
      renderTargetEvidenceSummary(target, targetAttempts)
    );
    if (!copied) {
      setError("Unable to copy Slack target evidence summary.");
      return;
    }
    setCopiedEvidenceId(target.id);
    window.setTimeout(() => setCopiedEvidenceId(null), 2000);
  }

  async function copyAutomaticReadiness(
    target: SlackTarget,
    readiness: AgentGuardSlackAutomaticReadiness
  ) {
    const copied = await copyTextToClipboard(readiness.copyText);
    if (!copied) {
      setError("Unable to copy Slack automatic preview readiness.");
      return;
    }
    setCopiedAutomaticReadinessId(target.id);
    window.setTimeout(() => setCopiedAutomaticReadinessId(null), 2000);
  }

  async function saveEvidencePacket(target: SlackTarget) {
    setSavingEvidenceId(target.id);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/agent-guard/slack-evidence-packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetId: target.id }),
    });
    const data = await readJson(response);
    setSavingEvidenceId(null);

    if (!response.ok) {
      if (data.error === "migration_required") {
        setEvidenceWarning(
          data.message ?? "Slack evidence packet history is not available yet."
        );
        return;
      }
      setError(data.message ?? data.error ?? "Unable to save Slack evidence packet.");
      return;
    }

    setEvidenceWarning(null);
    setEvidencePackets((current) => [data.packet, ...current].slice(0, 8));
    setNotice("Slack evidence packet saved with URL-hint-only metadata.");
  }

  async function copySavedEvidencePacket(packet: SlackEvidencePacket) {
    const copied = await copyTextToClipboard(packet.packetText);
    if (!copied) {
      setError("Unable to copy saved Slack evidence packet.");
      return;
    }
    setCopiedPacketId(packet.id);
    window.setTimeout(() => setCopiedPacketId(null), 2000);
  }

  function toggleCreateEvent(eventType: SlackEventType) {
    setEventTypes((current) =>
      current.includes(eventType)
        ? current.filter((item) => item !== eventType)
        : [...current, eventType]
    );
  }

  function updateDraft(targetId: string, patch: Partial<SlackTargetDraft>) {
    setDrafts((current) => ({
      ...current,
      [targetId]: {
        ...current[targetId],
        ...patch,
      } as SlackTargetDraft,
    }));
  }

  function toggleDraftEvent(targetId: string, eventType: SlackEventType) {
    const draft = drafts[targetId];
    if (!draft) return;
    const next = draft.eventTypes.includes(eventType)
      ? draft.eventTypes.filter((item) => item !== eventType)
      : [...draft.eventTypes, eventType];
    updateDraft(targetId, { eventTypes: next });
  }

  const recentAttempts = attempts.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageSquareWarning className="h-4 w-4 text-[color:var(--brand)]" />
              {AGENT_GUARD_SLACK_PREVIEW_COPY.title}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_SLACK_PREVIEW_COPY.overview}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refreshSlackPanel}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={copySpec}>
              {copyState === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy Slack spec"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand)]" />
            <p className="text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_SLACK_PREVIEW_COPY.decision}
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            The preview uses encrypted Slack URL targets, URL hints, manual tests, delivery attempts, dry-run/live posture, and delete-secret behavior. It does not ship Slack app installation, OAuth, bot tokens, channel discovery, background retry, automatic escalation, or incident-response automation.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_SLACK_PREVIEW_COPY.boundary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="border-green-200 bg-green-50 text-green-700"
            >
              {gateCounts.decided_for_preview} decided
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700"
            >
              {gateCounts.requires_future_build} remaining gate
            </Badge>
            <Badge variant="outline">
              {gateCounts.out_of_scope} out of scope
            </Badge>
          </div>
        </div>

        {error && (
          <div className="sg-status-surface sg-status-surface-red flex gap-2 rounded-lg border px-4 py-3 text-sm text-foreground/85">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="sg-status-surface sg-status-surface-green rounded-lg border px-4 py-3 text-sm text-foreground/85">
            {notice}
          </div>
        )}
        {evidenceWarning && (
          <div className="sg-status-surface sg-status-surface-amber rounded-lg border px-4 py-3 text-sm text-foreground/85">
            {evidenceWarning}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Create Slack preview target</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,1.4fr)_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Target name"
            />
            <select
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as SlackTargetType)}
            >
              <option value="workflow_webhook">Workflow webhook</option>
              <option value="incoming_webhook">Incoming webhook</option>
            </select>
            <Input
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://hooks.slack.com/triggers/..."
              type="password"
            />
            <Button
              variant="brand"
              disabled={saving || !name.trim() || !webhookUrl.trim() || eventTypes.length === 0}
              onClick={createTarget}
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Owner/team"
            />
            <Input
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="Owner email"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {SLACK_EVENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={eventTypes.includes(option.value)}
                  onChange={() => toggleCreateEvent(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Targets are created disabled with dry-run on and live sends off. The full Slack URL is encrypted and never shown after save.
          </p>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Configured Slack preview targets</p>
            <Badge variant="outline">{targets.length} configured</Badge>
          </div>

          {loadingTargets ? (
            <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Loading Slack preview targets...
            </div>
          ) : targets.length === 0 ? (
            <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No Slack preview targets configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map((target) => {
                const draft = drafts[target.id] ?? targetDraftFromTarget(target);
                const targetAttempts = attempts.filter(
                  (attempt) => attempt.targetId === target.id
                );
                const hasDryRunEvidence = targetAttempts.some(
                  (attempt) => attempt.status === "dry_run"
                );
                const validationSteps = slackTargetValidationSteps(
                  target,
                  hasDryRunEvidence
                );
                const nextAction = slackTargetNextAction(target, hasDryRunEvidence);
                const automaticReadiness =
                  buildAgentGuardSlackAutomaticReadiness({
                    target,
                    attempts,
                  });
                return (
                  <div key={target.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{target.name}</p>
                          <Badge variant="outline">{targetTypeLabel(target.targetType)}</Badge>
                          <Badge
                            variant="outline"
                            className={
                              target.status === "enabled"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {target.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={target.dryRunEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-red-200 bg-red-50 text-red-700"}
                          >
                            {target.dryRunEnabled ? "Dry-run" : "Outbound on"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={target.liveSendEnabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-muted text-muted-foreground"}
                          >
                            {target.liveSendEnabled ? "Live posture on" : "Live posture off"}
                          </Badge>
                          <Badge variant="outline" className={approvalClass(target.customerApprovalStatus)}>
                            {approvalLabel(target.customerApprovalStatus)}
                          </Badge>
                          {target.lastSuccessfulTestAt && (
                            <Badge
                              variant="outline"
                              className="border-green-200 bg-green-50 text-green-700"
                            >
                              Manual delivery verified
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                          {target.webhookUrlHint}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                          <span>Last test: {formatDate(target.lastTestedAt)}</span>
                          <span>Last success: {formatDate(target.lastSuccessfulTestAt)}</span>
                          <span>Last live attempt: {formatDate(target.lastLiveAttemptAt)}</span>
                        </div>
                        {target.latestAttempt && (
                          <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={attemptClass(target.latestAttempt.status)}>
                                {target.latestAttempt.status}
                              </Badge>
                              <span className="text-muted-foreground">
                                {deliveryModeLabel(target.latestAttempt.deliveryMode)}
                              </span>
                              <span className="text-muted-foreground">
                                {target.latestAttempt.httpStatus ? `HTTP ${target.latestAttempt.httpStatus}` : "No HTTP"}
                              </span>
                              <span className="text-muted-foreground">
                                {target.latestAttempt.durationMs} ms
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(target.latestAttempt.createdAt)}
                              </span>
                            </div>
                            {target.latestAttempt.status === "failed" && (
                              <p className="mt-2 leading-5 text-red-700">
                                {target.latestAttempt.failureSummary} {target.latestAttempt.failureNextAction}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="mt-3 rounded-lg border border-border bg-card p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                Validation path
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {nextAction}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyTargetEvidence(target)}
                              >
                                {copiedEvidenceId === target.id ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {copiedEvidenceId === target.id
                                  ? "Copied"
                                  : "Copy evidence"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={savingEvidenceId === target.id}
                                onClick={() => saveEvidencePacket(target)}
                              >
                                <Save className="h-3.5 w-3.5" />
                                {savingEvidenceId === target.id
                                  ? "Saving..."
                                  : "Save evidence"}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-5">
                            {validationSteps.map((step) => (
                              <div
                                key={step.label}
                                className="rounded-lg border border-border bg-background p-2"
                              >
                                <Badge
                                  variant="outline"
                                  className={validationStepClass(step.status)}
                                >
                                  {validationStepLabel(step.status)}
                                </Badge>
                                <p className="mt-2 text-xs font-semibold text-foreground">
                                  {step.label}
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                  {step.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-border bg-card p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                                Automatic preview readiness
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {automaticReadiness.nextAction}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={automaticReadinessClass(
                                  automaticReadiness.status
                                )}
                              >
                                {automaticReadiness.statusLabel}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyAutomaticReadiness(
                                    target,
                                    automaticReadiness
                                  )
                                }
                              >
                                {copiedAutomaticReadinessId === target.id ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {copiedAutomaticReadinessId === target.id
                                  ? "Copied"
                                  : "Copy auto gates"}
                              </Button>
                            </div>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {automaticReadiness.summary}
                          </p>
                          <div className="mt-3 grid gap-2 md:grid-cols-4">
                            {automaticReadiness.gates.map((gate) => (
                              <div
                                key={gate.id}
                                className="rounded-lg border border-border bg-background p-2"
                              >
                                <Badge
                                  variant="outline"
                                  className={automaticGateClass(gate.ready)}
                                >
                                  {gate.ready ? "Ready" : "Missing"}
                                </Badge>
                                <p className="mt-2 text-xs font-semibold text-foreground">
                                  {gate.label}
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                  {gate.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                            <span>
                              Auto attempts:{" "}
                              {automaticReadiness.automaticAttemptCount}
                            </span>
                            <span>
                              Event scope:{" "}
                              {automaticReadiness.selectedEventTypes.length}
                            </span>
                            <span>
                              Latest auto:{" "}
                              {automaticReadiness.latestAutomaticAttempt
                                ? formatDate(
                                    automaticReadiness.latestAutomaticAttempt
                                      .createdAt
                                  )
                                : "Not yet"}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                            {AGENT_GUARD_SLACK_AUTOMATIC_READINESS_COPY.overview}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingId === target.id}
                          onClick={() => sendTest(target)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {testingId === target.id ? "Sending..." : "Send test"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateTarget(target, {
                              status: target.status === "enabled" ? "disabled" : "enabled",
                            })
                          }
                        >
                          {target.status === "enabled" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateTarget(target, {
                              dryRunEnabled: !target.dryRunEnabled,
                            })
                          }
                        >
                          {target.dryRunEnabled
                            ? "Allow outbound tests"
                            : "Return to dry-run"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateTarget(target, {
                              liveSendEnabled: !target.liveSendEnabled,
                            })
                          }
                        >
                          {target.liveSendEnabled ? "Auto live off" : "Auto live on"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingId === target.id}
                          onClick={() => deleteTarget(target)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === target.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <Input
                        value={draft.ownerName}
                        onChange={(event) => updateDraft(target.id, { ownerName: event.target.value })}
                        placeholder="Owner/team"
                      />
                      <Input
                        value={draft.ownerEmail}
                        onChange={(event) => updateDraft(target.id, { ownerEmail: event.target.value })}
                        placeholder="Owner email"
                      />
                      <select
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={draft.customerApprovalStatus}
                        onChange={(event) =>
                          updateDraft(target.id, {
                            customerApprovalStatus: event.target.value as SlackApprovalStatus,
                          })
                        }
                      >
                        {APPROVAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={draft.userIdentifierMode}
                        onChange={(event) =>
                          updateDraft(target.id, {
                            userIdentifierMode: event.target.value as SlackUserIdentifierMode,
                          })
                        }
                      >
                        {USER_IDENTIFIER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        className="lg:col-span-2"
                        value={draft.customerApprovalNote}
                        onChange={(event) =>
                          updateDraft(target.id, {
                            customerApprovalNote: event.target.value,
                          })
                        }
                        placeholder="Customer approval note"
                      />
                      <Input
                        className="lg:col-span-2"
                        value={draft.replacementUrl}
                        onChange={(event) =>
                          updateDraft(target.id, {
                            replacementUrl: event.target.value,
                          })
                        }
                        placeholder="Replace Slack URL (optional, hidden after save)"
                        type="password"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-3">
                        {SLACK_EVENT_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.eventTypes.includes(option.value)}
                              onChange={() => toggleDraftEvent(target.id, option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={savingId === target.id || draft.eventTypes.length === 0}
                        onClick={() => saveDraft(target)}
                      >
                        {savingId === target.id ? "Saving..." : "Save Slack target"}
                      </Button>
                    </div>
                    {!target.liveEligible && target.liveSendEnabled && (
                      <p className="mt-3 text-xs leading-5 text-amber-800">
                        Live posture is stored, but automatic Slack preview sends remain gated until the target is enabled, approved, event-selected, and has a successful manual test after the current URL was saved.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-[color:var(--brand)]" />
                Saved Slack evidence handoffs
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Point-in-time, metadata-only packets for Slack preview targets. URL hints only; no plaintext Slack URLs, payloads, source keys, signing secrets, bearer tokens, raw prompts, responses, files, or messages.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadEvidencePackets({ showLoading: false })}
            >
              Refresh history
            </Button>
          </div>

          {loadingEvidencePackets ? (
            <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Loading Slack evidence handoffs...
            </div>
          ) : evidencePackets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No saved Slack evidence handoffs yet.
            </div>
          ) : (
            <div className="space-y-3">
              {evidencePackets.map((packet) => (
                <div
                  key={packet.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {packet.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={packetStatusClass(packet.status)}
                        >
                          {packet.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {packet.summary}
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                        {packet.snapshot.target.name}: {packet.snapshot.target.webhookUrlHint}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span>Saved {formatDate(packet.createdAt)}</span>
                        <span>
                          Generated by {packet.generatedByEmail ?? "unknown"}
                        </span>
                        <span>
                          Attempts {packet.summaryMetrics.totalAttemptCount}
                        </span>
                        <span>
                          Manual success{" "}
                          {packet.summaryMetrics.hasManualSuccess ? "yes" : "no"}
                        </span>
                        <span>
                          Dry-run{" "}
                          {packet.summaryMetrics.hasDryRunEvidence ? "yes" : "no"}
                        </span>
                        <span>
                          Live posture{" "}
                          {packet.summaryMetrics.livePostureOn ? "on" : "off"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copySavedEvidencePacket(packet)}
                    >
                      {copiedPacketId === packet.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedPacketId === packet.id ? "Copied" : "Copy packet"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {recentAttempts.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Recent Slack attempts</p>
            <div className="overflow-hidden rounded-lg border border-border">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="grid gap-2 border-b border-border px-4 py-3 text-xs last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_120px_100px_160px]"
                >
                  <Badge variant="outline" className={`w-fit ${attemptClass(attempt.status)}`}>
                    {attempt.status}
                  </Badge>
                  <span className="min-w-0 truncate font-mono text-muted-foreground">
                    {attempt.eventId}
                  </span>
                  <span className="text-muted-foreground">
                    {deliveryModeLabel(attempt.deliveryMode)}
                  </span>
                  <span className="text-muted-foreground">
                    {attempt.httpStatus ? `HTTP ${attempt.httpStatus}` : "No HTTP"}
                  </span>
                  <span className="text-muted-foreground">{formatDate(attempt.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {AGENT_GUARD_SLACK_PREVIEW_DOC_NOTES.map((note) => (
            <div key={note.label} className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">{note.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {note.note}
              </p>
              <p className="mt-2 break-all text-[11px] text-muted-foreground">
                {note.url}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Implementation gates
            </p>
            {AGENT_GUARD_SLACK_PREVIEW_GATES.map((gate) => (
              <div key={gate.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {gate.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {gate.decision}
                    </p>
                  </div>
                  <Badge variant="outline" className={GATE_CLASSES[gate.status]}>
                    {gate.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <MiniBlock title="Future requirement" body={gate.futureRequirement} />
                  <MiniBlock title="Safety check" body={gate.safetyCheck} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <ChecklistBlock
              title="Allowed event scope"
              items={AGENT_GUARD_SLACK_PREVIEW_ALLOWED_EVENTS}
            />

            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Allowed message fields
              </p>
              <div className="mt-2 space-y-2">
                {AGENT_GUARD_SLACK_PREVIEW_FIELDS.map((field) => (
                  <div
                    key={field.sourceField}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {field.sourceField}
                      </p>
                      <Badge variant="outline">
                        {field.required ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {field.slackLabel}: {field.redaction}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground">
                      {field.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rollout steps
              </p>
              <div className="mt-2 space-y-2">
                {AGENT_GUARD_SLACK_PREVIEW_ROLLOUT_STEPS.map((step) => (
                  <div key={step.step} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-semibold text-foreground">{step.step}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Owner: {step.owner}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground">
                      Evidence: {step.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <ChecklistBlock
              title="Customer responsibilities"
              items={AGENT_GUARD_SLACK_PREVIEW_CUSTOMER_RESPONSIBILITIES}
            />
            <ChecklistBlock
              title="Forbidden claims"
              items={AGENT_GUARD_SLACK_PREVIEW_FORBIDDEN_CLAIMS}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-foreground">{body}</p>
    </div>
  );
}

function ChecklistBlock({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
