"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [auto]);

  return (
    <Button type="button" className="no-print" onClick={() => window.print()}>
      Stáhnout PDF / tisknout
    </Button>
  );
}
