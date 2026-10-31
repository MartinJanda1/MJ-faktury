"use client";

import { useEffect } from "react";
import { waitForPaymentQr } from "@/components/payment-qr";
import { Button } from "@/components/ui/button";

async function printInvoice(): Promise<void> {
  await waitForPaymentQr();
  window.print();
}

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void printInvoice().then(() => {
        if (cancelled) return;
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auto]);

  return (
    <Button type="button" className="no-print" onClick={() => void printInvoice()}>
      Stáhnout PDF / tisknout
    </Button>
  );
}
