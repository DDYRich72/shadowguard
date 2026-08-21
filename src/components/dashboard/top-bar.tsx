"use client";

import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur-md print:hidden sm:px-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2 sg-mono-sm text-muted-foreground">
          <span className="sg-dot bg-[color:var(--approved)] sg-pulse" />
          <span>Live</span>
          <span className="text-muted-foreground/40">·</span>
          <span>2 providers</span>
        </div>
        <h1 className="font-display mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools, evidence, users…"
            className="w-72 rounded-md border-border bg-background pl-9 text-sm"
            suppressHydrationWarning
          />
          <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 sg-mono-sm text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-[color:var(--risk)] ring-2 ring-card"
          />
        </button>

        <ThemeToggle className="hidden lg:inline-flex" />

        <div className="flex items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground text-background">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-xs font-semibold text-foreground">
              Operator
            </span>
            <span className="sg-mono-sm mt-1 text-muted-foreground">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
