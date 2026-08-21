"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, PlugZap, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DestinationStatus = "enabled" | "disabled";
type DestinationType = "webhook" | "siem";
type AttemptStatus = "succeeded" | "failed" | "dry_run";
type AttemptMode = "manual_test" | "automatic" | "dry_run" | "manual_replay";
type HealthStatus = "disabled" | "not_tested" | "ready" | "dry_run" | "live" | "failing";
type ReceiverAcknowledgementStatus =
  | "not_requested"
  | "requested"
  | "confirmed"
  | "not_applicable";
type ExportEventType =
  | "agentguard.activity.evaluated"
  | "agentguard.policy.blocked"
  | "agentguard.review.required";

const EXPORT_EVENT_OPTIONS: { value: ExportEventType; label: string }[] = [
  { value: "agentguard.activity.evaluated", label: "Evaluated activity" },
  { value: "agentguard.policy.blocked", label: "Blocked policy" },
  { value: "agentguard.review.required", label: "Review required" },
];

const ACKNOWLEDGEMENT_OPTIONS: {
  value: ReceiverAcknowledgementStatus;
  label: string;
}[] = [
  { value: "not_requested", label: "Not requested" },
  { value: "requested", label: "Requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "not_applicable", label: "Not applicable" },
];

type AgentExportDestination = {
  id: string;
  name: string;
  destinationType: DestinationType;
  status: DestinationStatus;
  endpointUrl: string;
  signingSecretHint: string;
  automaticDeliveryEnabled: boolean;
  dryRunEnabled: boolean;
  eventTypes: ExportEventType[];
  ownerName: string;
  ownerEmail: string;
  escalationPath: string;
  receiverAcknowledgementStatus: ReceiverAcknowledgementStatus;
  receiverAcknowledgementNote: string;
  receiverAcknowledgedAt: string | null;
  receiverAcknowledgedByEmail: string | null;
  createdByEmail: string | null;
  lastTestedAt: string | null;
  lastAutomaticAttemptAt: string | null;
  healthStatus: HealthStatus;
  healthLabel: string;
  healthSummary: string;
  createdAt: string;
  updatedAt: string;
};

type AgentExportAttempt = {
  id: string;
  destinationId: string | null;
  eventId: string;
  eventType: string;
  status: AttemptStatus;
  deliveryMode: AttemptMode;
  replayedAttemptId: string | null;
  httpStatus: number | null;
  durationMs: number;
  errorMessage: string | null;
  failureCategory: string;
  failureLabel: string;
  failureSummary: string;
  failureNextAction: string;
  createdByEmail: string | null;
  createdAt: string;
};

type OneTimeSecret = {
  destinationName: string;
  signingSecret: string;
};

type HardeningDraft = {
  ownerName: string;
  ownerEmail: string;
  escalationPath: string;
  receiverAcknowledgementStatus: ReceiverAcknowledgementStatus;
  receiverAcknowledgementNote: string;
};

type DestinationPatch = Partial<
  Pick<
    AgentExportDestination,
    | "status"
    | "automaticDeliveryEnabled"
    | "dryRunEnabled"
    | "eventTypes"
    | "ownerName"
    | "ownerEmail"
    | "escalationPath"
    | "receiverAcknowledgementStatus"
    | "receiverAcknowledgementNote"
  >
>;

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

function hardeningDraftFromDestination(
  destination: AgentExportDestination
): HardeningDraft {
  return {
    ownerName: destination.ownerName,
    ownerEmail: destination.ownerEmail,
    escalationPath: destination.escalationPath,
    receiverAcknowledgementStatus:
      destination.receiverAcknowledgementStatus,
    receiverAcknowledgementNote: destination.receiverAcknowledgementNote,
  };
}

function mergeHardeningDrafts(
  current: Record<string, HardeningDraft>,
  destinations: AgentExportDestination[]
): Record<string, HardeningDraft> {
  const next: Record<string, HardeningDraft> = {};
  for (const destination of destinations) {
    next[destination.id] =
      current[destination.id] ?? hardeningDraftFromDestination(destination);
  }
  return next;
}

function attemptStatusClass(status: AttemptStatus): string {
  if (status === "succeeded") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "dry_run") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

function healthStatusClass(status: HealthStatus): string {
  if (status === "live") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "failing") {
    return "border-red-300 bg-red-100 text-red-800";
  }
  if (status === "dry_run") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "ready") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "not_tested") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-border bg-muted text-muted-foreground";
}

function acknowledgementStatusClass(status: ReceiverAcknowledgementStatus): string {
  if (status === "confirmed") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "requested") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "not_applicable") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function acknowledgementLabel(status: ReceiverAcknowledgementStatus): string {
  return ACKNOWLEDGEMENT_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatMode(mode: AttemptMode): string {
  if (mode === "manual_replay") return "manual replay";
  if (mode === "manual_test") return "manual test";
  if (mode === "dry_run") return "dry-run";
  return "automatic";
}

export function ExportDestinationsPanel() {
  const [destinations, setDestinations] = useState<AgentExportDestination[]>([]);
  const [attempts, setAttempts] = useState<AgentExportAttempt[]>([]);
  const [name, setName] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("webhook");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oneTimeSecret, setOneTimeSecret] = useState<OneTimeSecret | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [hardeningDrafts, setHardeningDrafts] = useState<Record<string, HardeningDraft>>({});
  const [savingHardeningId, setSavingHardeningId] = useState<string | null>(null);

  const attemptsByDestination = useMemo(() => {
    const grouped = new Map<string, AgentExportAttempt[]>();
    for (const attempt of attempts) {
      if (!attempt.destinationId) continue;
      grouped.set(attempt.destinationId, [
        ...(grouped.get(attempt.destinationId) ?? []),
        attempt,
      ]);
    }
    return grouped;
  }, [attempts]);

  const destinationById = useMemo(() => {
    return new Map(destinations.map((destination) => [destination.id, destination]));
  }, [destinations]);

  const liveDestinations = useMemo(
    () =>
      destinations.filter(
        (destination) =>
          destination.status === "enabled" &&
          destination.automaticDeliveryEnabled &&
          !destination.dryRunEnabled
      ),
    [destinations]
  );

  async function loadDestinations(
    options: { showLoading?: boolean; clearError?: boolean } = {}
  ) {
    const showLoading = options.showLoading ?? true;
    const clearError = options.clearError ?? true;
    if (showLoading) setLoading(true);
    if (clearError) setError(null);
    const response = await fetch("/api/agent-guard/export-destinations");
    const data = await readJson(response);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to load export destinations.");
      setLoading(false);
      return;
    }
    const nextDestinations = data.destinations ?? [];
    setDestinations(nextDestinations);
    setAttempts(data.attempts ?? []);
    setHardeningDrafts((current) =>
      mergeHardeningDrafts(current, nextDestinations)
    );
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/agent-guard/export-destinations")
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(data.message ?? data.error ?? "Unable to load export destinations.");
          setLoading(false);
          return;
        }
        const nextDestinations = data.destinations ?? [];
        setDestinations(nextDestinations);
        setAttempts(data.attempts ?? []);
        setHardeningDrafts((current) =>
          mergeHardeningDrafts(current, nextDestinations)
        );
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load export destinations.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createDestination() {
    setSaving(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/agent-guard/export-destinations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        destinationType,
        endpointUrl,
      }),
    });
    const data = await readJson(response);
    setSaving(false);

    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to create export destination.");
      return;
    }

    setName("");
    setDestinationType("webhook");
    setEndpointUrl("");
    setOneTimeSecret({
      destinationName: data.destination?.name ?? "New destination",
      signingSecret: data.signingSecret,
    });
    setNotice("Destination created disabled by default.");
    await loadDestinations();
  }

  async function updateDestination(
    destination: AgentExportDestination,
    patch: DestinationPatch
  ) {
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/export-destinations/${destination.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const data = await readJson(response);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to update export destination.");
      return;
    }
    setDestinations((current) =>
      current.map((item) =>
        item.id === destination.id ? data.destination : item
      )
    );
    setNotice(
      "Destination export controls updated."
    );
    await loadDestinations({ showLoading: false, clearError: false });
  }

  function patchHardeningDraft(
    destinationId: string,
    patch: Partial<HardeningDraft>
  ) {
    setHardeningDrafts((current) => ({
      ...current,
      [destinationId]: {
        ...current[destinationId],
        ...patch,
      } as HardeningDraft,
    }));
  }

  async function saveHardening(destination: AgentExportDestination) {
    const draft = hardeningDrafts[destination.id];
    if (!draft) return;
    setSavingHardeningId(destination.id);
    try {
      await updateDestination(destination, draft);
    } finally {
      setSavingHardeningId(null);
    }
  }

  async function toggleEventType(
    destination: AgentExportDestination,
    eventType: ExportEventType
  ) {
    const selected = new Set(destination.eventTypes);
    if (selected.has(eventType) && selected.size > 1) {
      selected.delete(eventType);
    } else if (selected.has(eventType)) {
      setNotice("At least one export event type must stay selected.");
      return;
    } else {
      selected.add(eventType);
    }
    await updateDestination(destination, {
      eventTypes: Array.from(selected) as ExportEventType[],
    });
  }

  async function sendTest(destination: AgentExportDestination) {
    setTestingId(destination.id);
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/export-destinations/${destination.id}/test`,
      { method: "POST" }
    );
    const data = await readJson(response);
    setTestingId(null);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to send test event.");
      return;
    }
    setNotice(
      data.attempt?.status === "succeeded"
        ? "Manual test event delivered."
        : "Manual test event failed. Review the attempt details."
    );
    await loadDestinations();
  }

  async function replayAttempt(attempt: AgentExportAttempt) {
    if (!attempt.destinationId) return;
    setReplayingId(attempt.id);
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/agent-guard/export-destinations/${attempt.destinationId}/attempts/${attempt.id}/replay`,
      { method: "POST" }
    );
    const data = await readJson(response);
    setReplayingId(null);
    if (!response.ok) {
      setError(data.message ?? data.error ?? "Unable to replay delivery attempt.");
      return;
    }
    setNotice(
      data.attempt?.status === "succeeded"
        ? "Replay delivered."
        : "Replay attempted. Review the latest delivery result."
    );
    await loadDestinations();
  }

  async function copySigningSecret() {
    if (!oneTimeSecret?.signingSecret) return;
    await navigator.clipboard.writeText(oneTimeSecret.signingSecret);
    setCopiedSecret(true);
    window.setTimeout(() => setCopiedSecret(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <PlugZap className="h-4 w-4 text-[color:var(--brand)]" />
          Export Destinations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="sg-status-surface sg-status-surface-amber rounded-lg border p-3 text-sm leading-6 text-foreground/85">
          Generic alert routing uses these customer-owned HTTPS destinations.
          Automatic delivery is guarded by destination status, event type
          selection, dry-run mode, and explicit live sends. Dry-run logs attempts
          without outbound requests. Failed attempts remain manual replay only;
          no automatic retry worker is shipped. Customer middleware owns
          downstream Slack, Teams, email, SIEM, SOAR, ticketing, and escalation
          behavior.
        </div>

        {liveDestinations.length > 0 && (
          <div className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Live automatic export is armed.</p>
              <p>
                {liveDestinations.map((destination) => destination.name).join(", ")} can send
                signed metadata-only events from submitted AgentGuard activity. Return to
                dry-run or turn auto off when testing is complete.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {notice}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_160px_1.5fr_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Destination name"
          />
          <select
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
            value={destinationType}
            onChange={(event) =>
              setDestinationType(event.target.value as DestinationType)
            }
          >
            <option value="webhook">Webhook</option>
            <option value="siem">SIEM HTTPS</option>
          </select>
          <Input
            value={endpointUrl}
            onChange={(event) => setEndpointUrl(event.target.value)}
            placeholder="https://receiver.example.com/agentguard"
          />
          <Button
            variant="brand"
            disabled={saving || !name.trim() || !endpointUrl.trim()}
            onClick={createDestination}
          >
            {saving ? "Creating" : "Create"}
          </Button>
        </div>

        {oneTimeSecret && (
          <div className="rounded-lg border border-[color:var(--brand)]/50 bg-black/70 p-4 shadow-[0_0_0_1px_rgba(255,112,0,0.08)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Signing secret for {oneTimeSecret.destinationName}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  This secret is shown once. Store it with the receiving system
                  so it can verify ShadowGuard signatures.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-[color:var(--brand)]/50 text-[color:var(--brand)] hover:bg-[color:var(--brand)]/10"
                onClick={copySigningSecret}
              >
                {copiedSecret ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedSecret ? "Copied" : "Copy secret"}
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg border border-[color:var(--brand)]/40 bg-[#050505] p-3 font-mono text-sm font-semibold tracking-wide text-[color:var(--brand)]">
              {oneTimeSecret.signingSecret}
            </code>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Configured destinations</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDestinations()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Loading export destinations.
            </p>
          ) : destinations.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No export destinations configured.
            </p>
          ) : (
            <div className="space-y-3">
              {destinations.map((destination) => {
                const latestAttempt = attemptsByDestination.get(destination.id)?.[0];
                return (
                  <div
                    key={destination.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {destination.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={
                              destination.status === "enabled"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {destination.status === "enabled" ? "Enabled" : "Disabled"}
                          </Badge>
                          <Badge variant="outline">
                            {destination.destinationType === "siem"
                              ? "SIEM HTTPS"
                              : "Webhook"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={healthStatusClass(destination.healthStatus)}
                            title={destination.healthSummary}
                          >
                            {destination.healthLabel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              destination.automaticDeliveryEnabled
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            Auto {destination.automaticDeliveryEnabled ? "on" : "off"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              destination.dryRunEnabled
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }
                          >
                            {destination.dryRunEnabled ? "Dry-run" : "Live sends"}
                          </Badge>
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {destination.endpointUrl}
                        </p>
                        {(destination.healthStatus === "failing" ||
                          destination.healthStatus === "live") && (
                          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                            {destination.healthSummary}
                          </p>
                        )}
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                          <span>Secret: {destination.signingSecretHint}</span>
                          <span>Last test: {formatDate(destination.lastTestedAt)}</span>
                          <span>
                            Last auto: {formatDate(destination.lastAutomaticAttemptAt)}
                          </span>
                          <span>
                            Created by: {destination.createdByEmail ?? "Unknown"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {EXPORT_EVENT_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className="inline-flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-[color:var(--brand)]"
                                checked={destination.eventTypes.includes(option.value)}
                                onChange={() => void toggleEventType(destination, option.value)}
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                        {latestAttempt && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Latest attempt: {formatMode(latestAttempt.deliveryMode)}, {latestAttempt.status}
                            {latestAttempt.httpStatus
                              ? `, HTTP ${latestAttempt.httpStatus}`
                              : ""}
                            {latestAttempt.errorMessage
                              ? `, ${latestAttempt.errorMessage}`
                              : ""}
                          </p>
                        )}
                        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                HTTPS hardening
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Store receiver ownership, escalation, and customer-confirmed acknowledgement evidence. Do not paste secrets or raw content.
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={acknowledgementStatusClass(
                                destination.receiverAcknowledgementStatus
                              )}
                            >
                              Ack {acknowledgementLabel(destination.receiverAcknowledgementStatus)}
                            </Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              value={hardeningDrafts[destination.id]?.ownerName ?? ""}
                              onChange={(event) =>
                                patchHardeningDraft(destination.id, {
                                  ownerName: event.target.value,
                                })
                              }
                              placeholder="Receiver owner or team"
                            />
                            <Input
                              value={hardeningDrafts[destination.id]?.ownerEmail ?? ""}
                              onChange={(event) =>
                                patchHardeningDraft(destination.id, {
                                  ownerEmail: event.target.value,
                                })
                              }
                              placeholder="owner@example.com"
                            />
                            <select
                              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                              value={
                                hardeningDrafts[destination.id]
                                  ?.receiverAcknowledgementStatus ??
                                "not_requested"
                              }
                              onChange={(event) =>
                                patchHardeningDraft(destination.id, {
                                  receiverAcknowledgementStatus:
                                    event.target.value as ReceiverAcknowledgementStatus,
                                })
                              }
                            >
                              {ACKNOWLEDGEMENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Input
                              value={
                                hardeningDrafts[destination.id]
                                  ?.receiverAcknowledgementNote ?? ""
                              }
                              onChange={(event) =>
                                patchHardeningDraft(destination.id, {
                                  receiverAcknowledgementNote: event.target.value,
                                })
                              }
                              placeholder="Acknowledgement note or ticket reference"
                            />
                          </div>
                          <textarea
                            className="mt-3 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                            value={hardeningDrafts[destination.id]?.escalationPath ?? ""}
                            onChange={(event) =>
                              patchHardeningDraft(destination.id, {
                                escalationPath: event.target.value,
                              })
                            }
                            placeholder="Escalation path, receiver runbook, or customer-owned failure route"
                          />
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {destination.receiverAcknowledgedAt
                                ? `Confirmed ${formatDate(destination.receiverAcknowledgedAt)} by ${destination.receiverAcknowledgedByEmail ?? "unknown"}`
                                : "Confirmation timestamp is set when acknowledgement status becomes Confirmed."}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={savingHardeningId === destination.id}
                              onClick={() => saveHardening(destination)}
                            >
                              {savingHardeningId === destination.id
                                ? "Saving"
                                : "Save hardening"}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDestination(destination, {
                              status:
                                destination.status === "enabled"
                                  ? "disabled"
                                  : "enabled",
                            })
                          }
                        >
                          {destination.status === "enabled" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDestination(destination, {
                              automaticDeliveryEnabled:
                                !destination.automaticDeliveryEnabled,
                            })
                          }
                        >
                          Auto {destination.automaticDeliveryEnabled ? "off" : "on"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={
                            destination.dryRunEnabled
                              ? ""
                              : "border-[color:var(--brand)]/60 text-[color:var(--brand)]"
                          }
                          onClick={() =>
                            updateDestination(destination, {
                              dryRunEnabled: !destination.dryRunEnabled,
                            })
                          }
                        >
                          {destination.dryRunEnabled ? "Use live sends" : "Use dry-run"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingId === destination.id}
                          onClick={() => sendTest(destination)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {testingId === destination.id ? "Testing" : "Send test"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            Recent delivery attempts
          </p>
          {attempts.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No delivery attempts yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {attempts.slice(0, 10).map((attempt) => {
                const destination = attempt.destinationId
                  ? destinationById.get(attempt.destinationId)
                  : null;
                const canReplay =
                  attempt.status === "failed" &&
                  destination?.status === "enabled" &&
                  destination.dryRunEnabled === false;
                const replayDisabledReason =
                  attempt.status !== "failed"
                    ? "Only failed attempts can be replayed."
                    : !destination
                      ? "Destination is unavailable."
                      : destination.status !== "enabled"
                        ? "Enable the destination before replaying."
                        : destination.dryRunEnabled
                          ? "Turn live sends on before replaying."
                          : "Replay failed attempt.";
                return (
                  <div
                    key={attempt.id}
                    className="grid gap-2 border-b border-border bg-card p-3 text-xs last:border-b-0 md:grid-cols-[120px_1fr_110px_90px_80px_1fr_auto]"
                  >
                    <Badge variant="outline" className={attemptStatusClass(attempt.status)}>
                      {attempt.status}
                    </Badge>
                    <span className="font-mono text-muted-foreground">{attempt.eventId}</span>
                    <span className="text-muted-foreground">{formatMode(attempt.deliveryMode)}</span>
                    <span className="text-muted-foreground">
                      {attempt.httpStatus ? `HTTP ${attempt.httpStatus}` : "No HTTP"}
                    </span>
                    <span className="text-muted-foreground">{attempt.durationMs} ms</span>
                    <span className="text-muted-foreground">
                      {attempt.status === "failed"
                        ? `${attempt.failureLabel}: ${attempt.failureNextAction}`
                        : attempt.errorMessage ??
                          (attempt.replayedAttemptId
                            ? `Replay of ${attempt.replayedAttemptId.slice(0, 8)}`
                            : formatDate(attempt.createdAt))}
                    </span>
                    {attempt.status === "failed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canReplay || replayingId === attempt.id}
                        title={replayDisabledReason}
                        onClick={() => replayAttempt(attempt)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {replayingId === attempt.id ? "Replaying" : "Replay"}
                      </Button>
                    ) : (
                      <span className="text-right text-muted-foreground">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
