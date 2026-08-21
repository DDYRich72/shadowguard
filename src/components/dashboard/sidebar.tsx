"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AppWindow,
  Archive,
  Bell,
  Bot,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  Route,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/authz";

const BRAND = process.env.NEXT_PUBLIC_BRAND === "agentguard" ? "agentguard" : "shadowguard";
const BRAND_NAME = BRAND === "agentguard" ? "AgentGuard" : "ShadowGuard";
const STORAGE_KEY = "shadowguard.sidebar.groups";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  adminOnly?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  defaultOpen?: boolean;
  items: NavItem[];
};

export function Sidebar({
  role,
}: {
  role: Role;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readPersistedGroups());

  const groups = useMemo<NavGroup[]>(() => {
    const navGroups: NavGroup[] = [
      {
        id: "command",
        label: "Command",
        icon: LayoutDashboard,
        defaultOpen: true,
        items: [
          { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
          { href: "/dashboard/onboarding", label: "Onboarding", icon: Route },
        ],
      },
      {
        id: "shadowguard",
        label: "ShadowGuard",
        icon: ShieldCheck,
        defaultOpen: true,
        items: [
          { href: "/dashboard/apps", label: "AI Registry", icon: AppWindow },
          { href: "/dashboard/ai-systems", label: "Risk Findings", icon: ShieldCheck },
          { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
          { href: "/dashboard/policy", label: "Policy Generator", icon: FileText },
          { href: "/dashboard/assessment-kit", label: "Assessment Kit", icon: ClipboardList },
        ],
      },
      {
        id: "governance",
        label: "Governance",
        icon: ListChecks,
        items: [
          { href: "/dashboard/report-review-queue", label: "Review Queue", icon: ListChecks },
          { href: "/dashboard/governance-report", label: "Governance Report", icon: ScrollText },
          { href: "/dashboard/report-snapshots", label: "Evidence Vault", icon: Archive },
          { href: "/dashboard/insurance-packet", label: "Insurance Packet", icon: FileText },
          { href: "/dashboard/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
        ],
      },
      {
        id: "agentguard",
        label: "AgentGuard",
        icon: Bot,
        badge: "PILOT",
        items: [
          {
            href: "/dashboard/agent-guard",
            label: "Overview",
            icon: Bot,
          },
          {
            href: "/dashboard/agent-guard/monitoring",
            label: "Monitoring",
            icon: Activity,
          },
          {
            href: "/dashboard/agent-guard/policies",
            label: "Policies",
            icon: ShieldCheck,
          },
          {
            href: "/dashboard/agent-guard/settings",
            label: "Settings",
            icon: Settings,
          },
        ],
      },
      {
        id: "mcpguard",
        label: "MCPGuard",
        icon: Network,
        badge: "PILOT",
        items: [
          { href: "/dashboard/mcp-guard", label: "Overview", icon: Network },
          { href: "/dashboard/mcp-guard/guide", label: "Guide", icon: BookOpen },
          { href: "/dashboard/mcp-guard/servers", label: "MCP Servers", icon: ServerCog },
          { href: "/dashboard/mcp-guard/tools", label: "MCP Tools", icon: ShieldCheck },
          { href: "/dashboard/mcp-guard/events", label: "Tool Events", icon: Activity },
        ],
      },
      {
        id: "account",
        label: "Account",
        icon: Settings,
        items: [
          { href: "/dashboard/settings", label: "Settings", icon: Settings },
          { href: "/dashboard/faq", label: "FAQ", icon: FileText },
        ],
      },
    ];

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !item.adminOnly || role === "admin"
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = { ...current, [id]: !(current[id] ?? false) };
      persistGroups(next);
      return next;
    });
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/10 bg-[#050505] text-white print:hidden">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5">
        {BRAND === "agentguard" ? (
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--brand)]/40 bg-[color:var(--brand)]/10">
            <Bot className="h-4 w-4 text-[color:var(--brand)]" strokeWidth={2.25} />
          </div>
        ) : (
          <BrandMark />
        )}
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight">
            {BRAND_NAME}
          </span>
          <span className="sg-mono-sm mt-1.5 text-white/35">
            Command Console
          </span>
        </div>
      </div>

      <div className="border-b border-white/8 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="sg-pill sg-pill-live">
            <span className="sg-dot bg-[color:var(--approved)] sg-pulse" />
            Live
          </span>
          <span className="sg-mono-sm text-white/40">2 providers</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          const groupActive = group.items.some((item) => isActivePath(pathname, item.href));
          const isOpen = groupActive || (openGroups[group.id] ?? group.defaultOpen ?? false);
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-2 last:mb-0">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
                  groupActive
                    ? "bg-white/[0.04] text-white"
                    : "text-white/45 hover:bg-white/[0.03] hover:text-white/75"
                )}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-white/35" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-white/35" />
                )}
                <GroupIcon
                  className={cn(
                    "h-4 w-4",
                    groupActive ? "text-[color:var(--brand)]" : "text-white/35"
                  )}
                />
                <span className="sg-mono-sm flex-1 text-white/50">{group.label}</span>
                {group.badge && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 sg-mono-sm",
                      group.badge === "PRO"
                        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                        : "bg-[color:var(--brand)]/15 text-[color:var(--brand)]"
                    )}
                  >
                    {group.badge}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="mt-1 flex flex-col gap-0.5 pl-4">
                  {group.items.map((item) => {
                    const isActive = isActivePath(pathname, item.href);

                    return (
                      <Link
                        key={`${group.id}-${item.href}-${item.label}`}
                        href={item.href}
                        className={cn(
                          "group/item relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-white/[0.07] text-white"
                            : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[color:var(--brand)]"
                          />
                        )}
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-[color:var(--brand)]"
                              : "text-white/40 group-hover/item:text-white"
                          )}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "ml-auto rounded-full px-1.5 py-0.5 sg-mono-sm",
                              item.badge === "PRO"
                                ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                                : "bg-[color:var(--brand)]/15 text-[color:var(--brand)]"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/8 p-3">
        <form action="/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/agent-guard" || href === "/dashboard/mcp-guard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readPersistedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistGroups(groups: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Ignore private browsing storage failures.
  }
}
