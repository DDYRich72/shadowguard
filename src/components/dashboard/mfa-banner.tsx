"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, ArrowRight } from "lucide-react";

export function MfaBanner({
  hasVerifiedFactor,
  currentLevel,
}: {
  hasVerifiedFactor: boolean;
  currentLevel: "aal1" | "aal2";
}) {
  const pathname = usePathname();
  const next = pathname || "/dashboard";
  const needsVerification = hasVerifiedFactor && currentLevel !== "aal2";
  const href = needsVerification
    ? `/login/mfa?next=${encodeURIComponent(next)}`
    : "/dashboard/settings/security?enrollment=required";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm">
          <span className="font-medium text-amber-900">
            {needsVerification
              ? "MFA verification required"
              : "MFA enrollment required"}
          </span>
          <span className="ml-2 text-amber-800">
            {needsVerification
              ? "Your admin account has MFA enabled, but this session has not passed a second-factor challenge."
              : "Your admin account does not have a verified second factor. Admin mutations will be blocked until you enroll."}
          </span>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
      >
        {needsVerification ? "Verify now" : "Enroll now"}{" "}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
