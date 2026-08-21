"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function AuditRowDetails({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        suppressHydrationWarning
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {open ? (
          <>
            Hide diff <ChevronUp className="h-3 w-3" />
          </>
        ) : (
          <>
            Show diff <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>
      {open && (
        <div className="basis-full grid w-full grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Before
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[11px] text-slate-700">
              {before ? JSON.stringify(before, null, 2) : "—"}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              After
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[11px] text-slate-700">
              {after ? JSON.stringify(after, null, 2) : "—"}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
