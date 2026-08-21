"use client";

import { useMemo, useState } from "react";
import { Check, Code2, Copy, FileText, KeyRound, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_SDK_BOUNDARY,
  AGENT_GUARD_SDK_ENV_VARS,
  AGENT_GUARD_SDK_EXAMPLES,
  AGENT_GUARD_SDK_REQUEST_FIELDS,
  AGENT_GUARD_SDK_RESPONSE_FIELDS,
  buildAgentGuardSdkReadmeText,
  type AgentGuardSdkExampleId,
} from "@/lib/agent-guard/sdk-starter-kit";

export function SdkStarterKitPanel() {
  const [activeExampleId, setActiveExampleId] =
    useState<AgentGuardSdkExampleId>("typescript-helper");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedReadme, setCopiedReadme] = useState(false);

  const activeExample = useMemo(
    () =>
      AGENT_GUARD_SDK_EXAMPLES.find((example) => example.id === activeExampleId) ??
      AGENT_GUARD_SDK_EXAMPLES[0]!,
    [activeExampleId]
  );
  const readmeText = useMemo(() => buildAgentGuardSdkReadmeText(), []);

  async function copyCode() {
    await navigator.clipboard.writeText(activeExample.code);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 2000);
  }

  async function copyReadme() {
    await navigator.clipboard.writeText(readmeText);
    setCopiedReadme(true);
    window.setTimeout(() => setCopiedReadme(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Code2 className="h-4 w-4 text-[color:var(--brand)]" />
          SDK Starter Kit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm leading-6 text-muted-foreground">
                Copyable server-side starter patterns for submitting activity
                through the current AgentGuard source-key ingest API.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {AGENT_GUARD_SDK_BOUNDARY}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Server-side source keys
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Current ingest contract
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  Starter examples
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copyReadme}>
              {copiedReadme ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {copiedReadme ? "Copied" : "Copy README"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[color:var(--brand)]" />
              <p className="text-sm font-semibold text-foreground">
                Server-side env vars
              </p>
            </div>
            <div className="space-y-2">
              {AGENT_GUARD_SDK_ENV_VARS.map((item) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[color:var(--brand)]" />
              <p className="text-sm font-semibold text-foreground">
                Decision fields
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {AGENT_GUARD_SDK_RESPONSE_FIELDS.map((field) => (
                <div
                  key={field.name}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-foreground">
                      {field.name}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {field.required ? "expected" : "optional"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {field.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {AGENT_GUARD_SDK_EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => {
                    setActiveExampleId(example.id);
                    setCopiedCode(false);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeExample.id === example.id
                      ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {example.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copiedCode ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedCode ? "Copied" : "Copy example"}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeExample.label}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {activeExample.summary}
                </p>
              </div>
              <Badge variant="outline">{activeExample.runtime}</Badge>
            </div>
            <pre className="max-h-[520px] overflow-x-auto rounded-lg border border-border bg-[#050505] p-4 text-xs leading-5 text-slate-100">
              <code>{activeExample.code}</code>
            </pre>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">
            Request fields
          </p>
          <div className="grid gap-2 lg:grid-cols-5">
            {AGENT_GUARD_SDK_REQUEST_FIELDS.map((field) => (
              <div
                key={field.name}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {field.name}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {field.required ? "required" : "optional"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
