"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Route,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PolicyDocumentMeta = {
  id: string;
  version: number;
  created_at: string;
};

type PolicyGenerateResponse = {
  success?: boolean;
  policy?: string;
  document?: PolicyDocumentMeta;
  error?: string;
  message?: string;
  ref?: string;
  sourceSummary?: {
    inputLabel: string;
    approvedToolCount: number;
    blockedToolCount: number;
    serverLoadedScanData: boolean;
    dataBackedGenerationReady: boolean;
  };
};

function messageForError(data: PolicyGenerateResponse, status: number): string {
  if (data.error === "mfa_required") {
    return data.message ?? "Policy draft generation requires MFA for this role.";
  }
  if (data.error === "forbidden") {
    return "Only admins and managers can save policy drafts.";
  }
  if (data.error === "rate_limited") {
    return "Policy draft generation is rate-limited. Wait a moment and try again.";
  }
  if (data.ref) {
    return `Policy draft generation failed. Support reference: ${data.ref}`;
  }
  return data.message ?? `Policy draft generation failed with HTTP ${status}.`;
}

export default function PolicyPage() {
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("general");
  const [policy, setPolicy] = useState("");
  const [documentMeta, setDocumentMeta] = useState<PolicyDocumentMeta | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function generatePolicy() {
    const trimmedOrgName = orgName.trim();
    if (!trimmedOrgName) return;

    setGenerating(true);
    setError("");
    setDocumentMeta(null);
    setSourceLabel("");

    try {
      const response = await fetch("/api/policy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: trimmedOrgName,
          industry,
          approvedTools: [],
          blockedTools: [],
        }),
      });

      const data = (await response.json()) as PolicyGenerateResponse;
      if (!response.ok || !data.success || !data.policy) {
        setError(messageForError(data, response.status));
        return;
      }

      setPolicy(data.policy);
      setDocumentMeta(data.document ?? null);
      setSourceLabel(data.sourceSummary?.inputLabel ?? "Manual inputs only");
    } catch (err) {
      console.error("Policy draft generation failed:", err);
      setError("Policy draft generation failed. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  function copyPolicy() {
    if (!policy) return;
    navigator.clipboard.writeText(policy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadPolicy() {
    if (!policy) return;
    const filenameOrg = (orgName.trim() || "shadowguard")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const blob = new Blob([policy], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameOrg}-ai-usage-policy-draft.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          AI Usage Policy Draft Generator
        </h2>
        <p className="text-sm text-muted-foreground">
          Create an editable policy starter from manual inputs. Data-backed
          generation is planned, but scan and approval data are not wired into
          this generator yet.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="sg-status-surface sg-status-surface-green rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 sg-status-accent-green" />
            <h3 className="text-sm font-semibold text-foreground">Functional today</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Generates, saves, copies, and downloads a versioned markdown draft
            from the organization name and industry selected below.
          </p>
        </div>
        <div className="sg-status-surface sg-status-surface-amber rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 sg-status-accent-amber" />
            <h3 className="text-sm font-semibold text-foreground">Not wired yet</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This page does not automatically read scans, approved tools,
            blocklists, AI Systems, AgentGuard activity, reports, or evidence.
          </p>
        </div>
        <div className="sg-status-surface sg-status-surface-blue rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 sg-status-accent-blue" />
            <h3 className="text-sm font-semibold text-foreground">Next path</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The next useful slice is server-side loading of approved tools,
            blocked tools, discovered AI apps, and governance evidence.
          </p>
        </div>
      </div>

      {error && (
        <div className="sg-status-surface sg-status-surface-red rounded-lg border p-4 text-sm text-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 sg-status-accent-red" />
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Draft Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                Organization Name
              </label>
              <input
                type="text"
                placeholder="Acme Corp"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Industry</label>
              <select
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              >
                <option value="general">General Business</option>
                <option value="healthcare">Healthcare Review</option>
                <option value="legal">Legal Practice Review</option>
              </select>
            </div>

            <div className="sg-status-surface sg-status-surface-slate rounded-lg border p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Current generation uses only this form and request-provided tool
                arrays. It is a draft starter, not legal advice, compliance
                determination, certification, auditor attestation, employee
                acknowledgement, or final policy approval.
              </p>
            </div>

            <Button
              onClick={generatePolicy}
              disabled={!orgName.trim() || generating}
              className="w-full bg-[color:var(--brand)] text-white hover:bg-[color:var(--focus)]"
            >
              {generating ? "Generating draft..." : "Generate draft"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Draft Preview</CardTitle>
              {documentMeta && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved as version {documentMeta.version}
                  {sourceLabel ? ` - ${sourceLabel}` : ""}
                </p>
              )}
            </div>
            {policy && (
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={copyPolicy}>
                  {copied ? (
                    <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="mr-1 h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPolicy}>
                  <Download className="mr-1 h-4 w-4" />
                  Download
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {policy ? (
              <pre className="max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-xs leading-5 text-foreground">
                {policy}
              </pre>
            ) : (
              <div className="flex h-64 items-center justify-center text-center">
                <div>
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Enter an organization name and generate an editable policy draft.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
