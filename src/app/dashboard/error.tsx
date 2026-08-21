"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard error boundary. Sits inside the dashboard layout, so the
 * sidebar and top bar stay mounted — only the failing page content is
 * replaced with this recoverable card.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto mt-12 w-full max-w-md rounded-lg border border-border bg-background p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted">
        <AlertTriangle className="h-6 w-6 text-foreground" />
      </div>
      <h1 className="mt-5 text-xl font-bold">This page hit an error</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The rest of your dashboard is unaffected. Try reloading this page —
        if it keeps failing, note the reference below and contact support.
        {error.digest && (
          <span className="mt-2 block font-mono text-xs">
            Reference: {error.digest}
          </span>
        )}
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </section>
  );
}
