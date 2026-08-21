"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile — invisible / low-friction CAPTCHA.
 *
 * Feature-flagged: renders nothing if NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * unset, so builds and dev work without a Cloudflare account. When set,
 * returns a token via onToken which the caller should pass to Supabase
 * auth as `options.captchaToken` — Supabase then verifies server-side
 * against your Turnstile secret key (configured in Supabase dashboard
 * under Auth → CAPTCHA, free).
 */
export function Turnstile({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;

    const render = () => {
      if (disposed || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "error-callback": () => onToken(null),
        "expired-callback": () => onToken(null),
        theme: "light",
        size: "flexible",
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 50);
      const timeout = setTimeout(() => clearInterval(interval), 10_000);
      return () => {
        disposed = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // widget may have been torn down already
        }
      }
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}

export const TURNSTILE_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
);
