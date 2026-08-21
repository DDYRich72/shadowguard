"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileJson2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_GUARD_RECEIVER_FIELD_DICTIONARY,
  AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY,
  AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES,
  AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES,
  prettyReceiverMappingSample,
  receiverMappingTemplateById,
  renderReceiverMappingTemplateMarkdown,
  type AgentGuardReceiverMappingTemplateId,
} from "@/lib/agent-guard/receiver-field-mapping";

export function ReceiverFieldMappingPanel() {
  const [activeTemplateId, setActiveTemplateId] =
    useState<AgentGuardReceiverMappingTemplateId>("webhook_event_log");
  const [copied, setCopied] = useState(false);

  const activeTemplate = useMemo(
    () => receiverMappingTemplateById(activeTemplateId),
    [activeTemplateId]
  );
  const mappingMarkdown = useMemo(
    () => renderReceiverMappingTemplateMarkdown(activeTemplate),
    [activeTemplate]
  );

  async function copyMapping() {
    try {
      await navigator.clipboard.writeText(mappingMarkdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileJson2 className="h-4 w-4 text-[color:var(--brand)]" />
              {AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY.title}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY.overview}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyMapping}>
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy mapping"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            {AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY.boundary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES.map((eventType) => (
              <Badge key={eventType} variant="outline">
                {eventType}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800"
            >
              Metadata only
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setActiveTemplateId(template.id);
                setCopied(false);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTemplate.id === template.id
                  ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {template.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-[color:var(--brand)]" />
                <p className="text-sm font-semibold text-foreground">
                  {activeTemplate.label}
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {activeTemplate.summary}
              </p>
            </div>
            <Badge variant="outline">{activeTemplate.rows.length} mappings</Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Receiver use
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {activeTemplate.receiverUse}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer owner
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {activeTemplate.customerOwner}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {activeTemplate.rows.map((row) => (
                  <div
                    key={`${row.sourcePath}:${row.targetField}`}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {row.sourcePath}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {row.notes}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          row.required
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }
                      >
                        {row.required ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                          Target
                        </p>
                        <p className="mt-1 font-mono text-foreground">
                          {row.targetField}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                          Transform
                        </p>
                        <p className="mt-1 text-foreground">{row.transformation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Safe sample output
                </p>
                <pre className="max-h-[520px] overflow-x-auto rounded-lg border border-border bg-[#050505] p-4 text-xs leading-5 text-slate-100">
                  <code>{prettyReceiverMappingSample(activeTemplate)}</code>
                </pre>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Field dictionary
                </p>
                <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-3">
                  {AGENT_GUARD_RECEIVER_FIELD_DICTIONARY.map((field) => (
                    <div
                      key={field.path}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {field.path}
                        </p>
                        <Badge variant="outline">{field.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {field.customerUse}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
