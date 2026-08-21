"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FileJson2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_INTEGRATION_CONTRACT_COPY,
  buildAgentGuardIntegrationContract,
} from "@/lib/agent-guard/integration-contract";

export function AgentGuardIntegrationContractPanel() {
  const contract = useMemo(() => buildAgentGuardIntegrationContract(), []);
  const [activeExampleId, setActiveExampleId] = useState(contract.examples[0]?.id);
  const [activeSampleId, setActiveSampleId] = useState(contract.samplePayloads[0]?.id);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);

  const activeExample =
    contract.examples.find((example) => example.id === activeExampleId) ??
    contract.examples[0]!;
  const activeSample =
    contract.samplePayloads.find((sample) => sample.id === activeSampleId) ??
    contract.samplePayloads[0]!;
  const activeSampleText = JSON.stringify(activeSample.payload, null, 2);

  async function copyContract() {
    await navigator.clipboard.writeText(contract.contractMarkdown);
    setCopiedContract(true);
    window.setTimeout(() => setCopiedContract(false), 2000);
  }

  async function copyExample() {
    await navigator.clipboard.writeText(activeExample.code);
    setCopiedExample(true);
    window.setTimeout(() => setCopiedExample(false), 2000);
  }

  async function copySample() {
    await navigator.clipboard.writeText(activeSampleText);
    setCopiedSample(true);
    window.setTimeout(() => setCopiedSample(false), 2000);
  }

  return (
    <Card className="overflow-hidden border-[color:var(--brand)]/30">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
              {AGENT_GUARD_INTEGRATION_CONTRACT_COPY.title}
            </CardTitle>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_INTEGRATION_CONTRACT_COPY.overview}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-[color:var(--brand)]/40 text-[color:var(--brand)]">
              {contract.version}
            </Badge>
            <Button variant="outline" size="sm" onClick={copyContract}>
              {copiedContract ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedContract ? "Copied" : "Copy contract"}
            </Button>
            <a
              href="/api/agent-guard/integration-contract"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-[color:var(--brand)]/35 bg-[color:var(--brand)]/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
            Versioned endpoint
          </p>
          <code className="mt-3 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
            {contract.endpoint.method} {contract.endpoint.url}
          </code>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {contract.boundary}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />
                <p className="text-sm font-semibold text-foreground">
                  Required headers
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {contract.headers.map((field) => (
                  <div key={field.name} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {field.name}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        required
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {field.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">
                Error handling
              </p>
              <div className="mt-3 space-y-2">
                {contract.errorCodes.map((error) => (
                  <div key={`${error.status}:${error.code}`} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{error.status}</Badge>
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {error.code}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {error.operatorAction}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <FileJson2 className="h-4 w-4 text-[color:var(--brand)]" />
                <p className="text-sm font-semibold text-foreground">
                  Request fields
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {contract.requestFields.map((field) => (
                  <div key={field.name} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
            </section>

            <section className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[color:var(--brand)]" />
                <p className="text-sm font-semibold text-foreground">
                  Decision response
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {contract.responseFields.map((field) => (
                  <div key={field.name} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
            </section>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              Safe sample payloads
            </p>
            <Button variant="outline" size="sm" onClick={copySample}>
              {copiedSample ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedSample ? "Copied" : "Copy payload"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contract.samplePayloads.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setActiveSampleId(sample.id);
                  setCopiedSample(false);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeSample.id === sample.id
                    ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">
              {activeSample.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {activeSample.intent}
            </p>
            <pre className="mt-3 max-h-[360px] overflow-x-auto rounded-lg border border-border bg-[#050505] p-4 text-xs leading-5 text-slate-100">
              <code>{activeSampleText}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[color:var(--brand)]" />
              <p className="text-sm font-semibold text-foreground">
                Server-side examples
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyExample}>
              {copiedExample ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedExample ? "Copied" : "Copy example"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contract.examples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => {
                  setActiveExampleId(example.id);
                  setCopiedExample(false);
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
        </section>
      </CardContent>
    </Card>
  );
}
