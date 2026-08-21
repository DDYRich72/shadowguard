"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintInsurancePacketButton() {
  return (
    <Button onClick={() => window.print()} className="gap-2">
      <Printer className="h-4 w-4" />
      Print Packet
    </Button>
  );
}
