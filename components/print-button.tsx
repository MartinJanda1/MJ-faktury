"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" className="no-print" onClick={() => window.print()}>
      Tisknout nebo uložit PDF
    </Button>
  );
}
