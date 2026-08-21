"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MfaBackupCodes({ enrolled }: { enrolled: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/mfa/backup-codes");
    if (res.ok) {
      const j = (await res.json()) as { remaining: number };
      setRemaining(j.remaining);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function generate() {
    setError(null);
    setCopied(false);
    if (
      remaining !== null &&
      remaining > 0 &&
      !confirm(
        `You have ${remaining} unused codes. Generating a new batch will invalidate all of them. Continue?`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/mfa/backup-codes", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError("Failed to generate codes. Try again in a minute.");
      return;
    }
    const j = (await res.json()) as { codes: string[] };
    setCodes(j.codes);
    await refresh();
  }

  function copyAll() {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    if (!codes) return;
    const blob = new Blob(
      [
        `ShadowGuard MFA backup codes\nGenerated: ${new Date().toISOString()}\n\n` +
          codes.join("\n") +
          "\n\nKeep these somewhere safe. Each code works once.\n",
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shadowguard-backup-codes-${new Date()
      .toISOString()
      .slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!enrolled) {
    return (
      <p className="text-sm text-slate-500">
        Enroll a TOTP factor first. Backup codes will be available after
        enrollment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {codes ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Save these codes now.</p>
              <p className="text-amber-800">
                Each works once. They will not be shown again. Store them in a
                password manager or print them.
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded bg-white p-3 font-mono text-sm">
            {codes.map((c) => (
              <li key={c} className="text-slate-800">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copyAll}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy all
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download .txt
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 hover:bg-slate-800"
              onClick={() => setCodes(null)}
            >
              I&apos;ve saved them
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {remaining === null
              ? "Loading…"
              : remaining === 0
              ? "No backup codes set up. Generate a batch in case you lose your authenticator."
              : `${remaining} of 10 backup codes remaining.`}
          </div>
          <Button
            size="sm"
            variant={remaining === 0 ? "default" : "outline"}
            onClick={generate}
            disabled={loading}
            className={
              remaining === 0 ? "bg-slate-900 hover:bg-slate-800" : ""
            }
          >
            {loading ? (
              "Generating…"
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {remaining === 0 ? "Generate codes" : "Regenerate codes"}
              </>
            )}
          </Button>
        </div>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
