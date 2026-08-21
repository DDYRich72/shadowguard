"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Code2, Copy, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_RECEIVER_CHECKLIST,
  AGENT_GUARD_RECEIVER_EXAMPLES,
  type AgentGuardReceiverExampleId,
} from "@/lib/agent-guard/receiver-kit";

export function ReceiverIntegrationKitPanel() {
  const [activeExampleId, setActiveExampleId] =
    useState<AgentGuardReceiverExampleId>("nextjs");
  const [copiedExample, setCopiedExample] = useState(false);
  const activeExample = useMemo(
    () =>
      AGENT_GUARD_RECEIVER_EXAMPLES.find(
        (example) => example.id === activeExampleId
      ) ?? AGENT_GUARD_RECEIVER_EXAMPLES[0]!,
    [activeExampleId]
  );

  async function copyExample() {
    await navigator.clipboard.writeText(activeExample.code);
    setCopiedExample(true);
    window.setTimeout(() => setCopiedExample(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Code2 className="h-4 w-4 text-[color:var(--brand)]" />
          Receiver Integration Kit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm leading-6 text-muted-foreground">
                Use these customer-side receiver patterns to validate signed
                AgentGuard export events before storing metadata or returning a
                success response. These examples are not managed SIEM connectors.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  HMAC verification
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Duplicate event guard
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  Metadata only
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[color:var(--brand)]" />
            <p className="text-sm font-semibold text-foreground">Receiver checklist</p>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {AGENT_GUARD_RECEIVER_CHECKLIST.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {AGENT_GUARD_RECEIVER_EXAMPLES.map((example) => (
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
            <Button variant="outline" size="sm" onClick={copyExample}>
              {copiedExample ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedExample ? "Copied" : "Copy example"}
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
      </CardContent>
    </Card>
  );
}
