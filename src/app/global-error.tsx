"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: replaces the root layout when it crashes, so it
 * must render its own <html>/<body> and cannot rely on globals.css or
 * the theme provider. Styling is inline on purpose.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1220",
          color: "#e2e8f0",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: "2rem",
            border: "1px solid #1e293b",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>
            ShadowGuard hit an unexpected error
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "#94a3b8" }}>
            Reload to continue. If the problem persists, contact support
            {error.digest ? ` with reference ${error.digest}` : ""}.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#1d4ed8",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
