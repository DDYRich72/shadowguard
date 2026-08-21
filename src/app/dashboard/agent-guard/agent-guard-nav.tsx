"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const AGENT_GUARD_NAV_ITEMS = [
  { href: "/dashboard/agent-guard", label: "Activity" },
  { href: "/dashboard/agent-guard/guide", label: "Guide" },
  { href: "/dashboard/agent-guard/setup", label: "Setup" },
  { href: "/dashboard/agent-guard/ingestion", label: "Ingestion" },
  { href: "/dashboard/agent-guard/monitoring", label: "Monitoring" },
  { href: "/dashboard/agent-guard/policies", label: "Policies" },
  { href: "/dashboard/agent-guard/reviews", label: "Reviews" },
  { href: "/dashboard/agent-guard/readiness", label: "Readiness" },
  { href: "/dashboard/agent-guard/settings", label: "Settings" },
  { href: "/dashboard/agent-guard/faq", label: "FAQ" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/agent-guard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentGuardNav({ leading }: { leading?: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      {AGENT_GUARD_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors",
              active
                ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
