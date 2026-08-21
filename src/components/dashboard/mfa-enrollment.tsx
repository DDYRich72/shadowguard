"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, KeyRound } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/authz";

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
};

export function MfaEnrollment({
  role,
  initialEnrolled,
}: {
  role: Role;
  initialEnrolled: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [pending, setPending] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsSessionVerification, setNeedsSessionVerification] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors([...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function startEnroll() {
    setError(null);
    setInfo(null);
    setNeedsSessionVerification(false);
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
    });
    setEnrolling(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setPending({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }
  }

  async function verify() {
    if (!pending) return;
    setError(null);
    setNeedsSessionVerification(false);
    setEnrolling(true);
    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: pending.factorId });
    if (challengeErr) {
      setError(challengeErr.message);
      setEnrolling(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: pending.factorId,
      challengeId: challenge!.id,
      code: code.trim(),
    });
    setEnrolling(false);
    if (verifyErr) {
      setError(verifyErr.message);
      return;
    }
    setPending(null);
    setCode("");
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      setInfo("MFA enabled and verified for this session.");
    } else {
      setInfo("Factor verified. Verify this session to unlock admin actions.");
      setNeedsSessionVerification(true);
    }
    await refresh();
    router.refresh();
  }

  async function unenroll(factorId: string) {
    setError(null);
    setInfo(null);
    setNeedsSessionVerification(false);
    if (
      role === "admin" &&
      factors.filter((f) => f.status === "verified").length <= 1 &&
      !confirm(
        "You are an admin and this is your only verified factor. Removing it will downgrade your session. Continue?"
      )
    ) {
      return;
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("Factor removed.");
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading factors…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {factors.length > 0 && (
        <ul className="space-y-2">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="font-medium text-slate-900">
                    {f.friendly_name ?? f.factor_type.toUpperCase()}
                  </div>
                  <div className="text-xs text-slate-500">{f.factor_type}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    f.status === "verified"
                      ? "border-emerald-200 text-emerald-700"
                      : "border-amber-200 text-amber-700"
                  }
                >
                  {f.status}
                </Badge>
                <button
                  onClick={() => unenroll(f.id)}
                  className="text-slate-400 hover:text-red-600"
                  title="Remove factor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <div className="space-y-4 rounded-md border border-violet-200 bg-violet-50 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Scan this QR code with your authenticator app
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Or enter the secret manually:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">
                {pending.secret}
              </code>
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pending.qr}
            alt="TOTP QR code"
            className="mx-auto h-48 w-48 rounded bg-white p-2"
          />
          <div className="space-y-2">
            <Label htmlFor="code">Enter the 6-digit code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono tracking-[0.3em]"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={verify}
              disabled={enrolling || code.length < 6}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {enrolling ? "Verifying…" : "Verify and enable"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={startEnroll}
          disabled={enrolling}
          variant={initialEnrolled ? "outline" : "default"}
          className={initialEnrolled ? "" : "bg-slate-900 hover:bg-slate-800"}
        >
          {enrolling
            ? "Working…"
            : initialEnrolled
            ? "Add another factor"
            : "Enroll TOTP factor"}
        </Button>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span>{info}</span>
          {needsSessionVerification && (
            <Link
              href="/login/mfa?next=/dashboard/settings/security"
              className="shrink-0 font-medium underline"
            >
              Verify now
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
