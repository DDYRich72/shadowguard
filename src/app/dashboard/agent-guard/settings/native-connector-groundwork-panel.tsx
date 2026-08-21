"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Copy, PlugZap, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES,
  AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY,
  agentGuardNativeConnectorPostureCounts,
  nativeConnectorCandidateById,
  renderNativeConnectorGroundworkMarkdown,
  type AgentGuardNativeConnectorCandidateId,
  type AgentGuardNativeConnectorPosture,
} from "@/lib/agent-guard/native-connector-groundwork";

type CopyState = "idle" | "copied" | "failed";

const POSTURE_CLASSES: Record<AgentGuardNativeConnectorPosture, string> = {
  shipped_https_foundation: "border-green-200 bg-green-50 text-green-700",
  recommended_first_native_spec: "border-blue-200 bg-blue-50 text-blue-700",
  candidate_after_first_native: "border-amber-200 bg-amber-50 text-amber-800",
  defer_until_customer_signal: "border-slate-200 bg-slate-100 text-slate-600",
};

export function NativeConnectorGroundworkPanel() {
  const [activeCandidateId, setActiveCandidateId] =
    useState<AgentGuardNativeConnectorCandidateId>(
      "slack_workflow_url_preview"
    );
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const activeCandidate = useMemo(
    () => nativeConnectorCandidateById(activeCandidateId),
    [activeCandidateId]
  );
  const counts = useMemo(() => agentGuardNativeConnectorPostureCounts(), []);
  const markdown = useMemo(
    () => renderNativeConnectorGroundworkMarkdown(activeCandidate),
    [activeCandidate]
  );

  async function copyGroundwork() {
    const copied = await copyTextToClipboard(markdown);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), copied ? 2000 : 3500);
  }

  async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy copy path for browsers that block Clipboard API.
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
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PlugZap className="h-4 w-4 text-[color:var(--brand)]" />
              {AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.title}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.overview}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyGroundwork}>
            {copyState === "copied" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy groundwork"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand)]" />
            <p className="text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.currentDecision}
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_NATIVE_CONNECTOR_GROUNDWORK_COPY.boundary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="border-green-200 bg-green-50 text-green-700"
            >
              {counts.shipped_https_foundation} shipped foundation
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700"
            >
              {counts.recommended_first_native_spec} first spec candidate
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800"
            >
              {counts.candidate_after_first_native} follow-up candidate
            </Badge>
            <Badge variant="outline">
              {counts.defer_until_customer_signal} deferred candidates
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {AGENT_GUARD_NATIVE_CONNECTOR_CANDIDATES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                setActiveCandidateId(candidate.id);
                setCopyState("idle");
              }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                activeCandidate.id === candidate.id
                  ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <p className="text-xs font-semibold text-foreground">
                {candidate.label}
              </p>
              <Badge
                variant="outline"
                className={`mt-2 ${POSTURE_CLASSES[candidate.posture]}`}
              >
                {candidate.postureLabel}
              </Badge>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[color:var(--brand)]" />
                <p className="text-sm font-semibold text-foreground">
                  {activeCandidate.label}
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {activeCandidate.decision}
              </p>
            </div>
            <Badge
              variant="outline"
              className={POSTURE_CLASSES[activeCandidate.posture]}
            >
              {activeCandidate.category}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Credential owner
                </p>
                <p className="mt-1 text-xs leading-5 text-foreground">
                  {activeCandidate.credentialOwner}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Credential storage boundary
                </p>
                <p className="mt-1 text-xs leading-5 text-foreground">
                  {activeCandidate.credentialStorageBoundary}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Test event path
                </p>
                <p className="mt-1 text-xs leading-5 text-foreground">
                  {activeCandidate.testEventPath}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Failure behavior
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {activeCandidate.failureBehavior}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Rate limits
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {activeCandidate.rateLimitPosture}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Data fields sent
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeCandidate.dataFieldsSent.map((field) => (
                    <Badge key={field} variant="outline">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ChecklistBlock
                  title="Customer responsibilities"
                  items={activeCandidate.customerResponsibilities}
                />
                <ChecklistBlock
                  title="Forbidden claims"
                  items={activeCandidate.forbiddenClaims}
                />
              </div>

              <ChecklistBlock
                title="Next spec questions"
                items={activeCandidate.nextSpecQuestions}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
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
