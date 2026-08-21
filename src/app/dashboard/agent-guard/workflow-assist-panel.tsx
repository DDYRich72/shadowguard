import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AGENT_GUARD_WORKFLOW_ASSIST_COPY,
  getAgentGuardWorkflowAssistEntry,
  type AgentGuardWorkflowAssistPageId,
} from "@/lib/agent-guard/workflow-assist";

export function AgentGuardWorkflowAssistPanel({
  page,
}: {
  page: AgentGuardWorkflowAssistPageId;
}) {
  const entry = getAgentGuardWorkflowAssistEntry(page);

  return (
    <section className="rounded-xl border border-[color:var(--brand)]/30 bg-card/90 p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-[color:var(--brand)]/40 text-[color:var(--brand)]"
            >
              {AGENT_GUARD_WORKFLOW_ASSIST_COPY.label}
            </Badge>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {entry.phase}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {entry.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {entry.purpose}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {entry.nextLinks.map((link) => (
            <Link
              key={`${entry.page}-${link.href}-${link.cta}`}
              href={link.href}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[color:var(--brand)]/40 px-3 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:var(--brand)]/10"
            >
              {link.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Compass className="h-3.5 w-3.5 text-[color:var(--brand)]" />
            Confirm here
          </p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-foreground">
            {entry.confirm.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--brand)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--approved-ink)]" />
            Evidence to see
          </p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-foreground">
            {entry.evidence.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--approved-ink)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--brand)]" />
            Boundary
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {entry.boundary}
          </p>
        </div>
      </div>
    </section>
  );
}
