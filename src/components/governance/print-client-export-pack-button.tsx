"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintClientExportPackButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2 print:hidden"
      onClick={() => window.print()}
      suppressHydrationWarning
    >
      <Printer className="h-4 w-4" />
      Print
    </Button>
  );
}
