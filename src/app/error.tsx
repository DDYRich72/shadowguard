"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Catches render/data errors from any page so the
 * user sees a recoverable card instead of a white screen. Server-side
 * details stay in the logs — only error.digest reaches the client.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted">
          <AlertTriangle className="h-6 w-6 text-foreground" />
        </div>
        <h1 className="mt-5 text-xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          An unexpected error interrupted this page. Your data is safe — try
          again, or head back to the dashboard.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs">
              Reference: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </section>
    </main>
  );
}
