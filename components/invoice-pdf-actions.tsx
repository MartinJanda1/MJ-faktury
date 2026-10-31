"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

type InvoicePdfActionsProps = {
  /** When true (e.g. ?pdf=1), start PDF download after QR is ready. */
  autoPdf?: boolean;
  filename?: string;
};

async function renderPaymentQr(): Promise<void> {
  const root = document.getElementById("invoice-document");
  const canvas = document.getElementById("payment-qr-canvas") as HTMLCanvasElement | null;
  const wrap = document.getElementById("payment-qr-wrap");
  if (!root || !canvas || !wrap) return;

  const spayd = root.dataset.spayd;
  if (!spayd) {
    wrap.style.display = "none";
    return;
  }

  try {
    await QRCode.toCanvas(canvas, spayd, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    wrap.style.display = "";
  } catch {
    wrap.style.display = "none";
  }
}

async function downloadPdf(filename: string): Promise<void> {
  const invoice = document.getElementById("invoice-document");
  if (!invoice) {
    throw new Error("Doklad na stránce chybí.");
  }

  await renderPaymentQr();

  const html2pdf = (await import("html2pdf.js")).default;
  const pdfScale = Math.min(4, Math.max(3, (window.devicePixelRatio || 1) * 2));

  document.documentElement.classList.add("pdf-exporting");
  invoice.classList.add("pdf-exporting");
  window.scrollTo(0, 0);

  const options = {
    margin: [0, 0, 14, 0] as [number, number, number, number],
    filename,
    image: { type: "png" as const, quality: 1 },
    html2canvas: {
      scale: pdfScale,
      useCORS: true,
      letterRendering: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      logging: false,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  try {
    await html2pdf().set(options).from(invoice).save();
  } finally {
    document.documentElement.classList.remove("pdf-exporting");
    invoice.classList.remove("pdf-exporting");
  }
}

function safeFilename(raw: string | undefined): string {
  const number = (raw || "faktura").replace(/[/\\?%*:|"<>]/g, "-").trim() || "faktura";
  return `faktura-${number}.pdf`;
}

export function InvoicePdfActions({ autoPdf = false, filename }: InvoicePdfActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedName = safeFilename(filename);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await renderPaymentQr();
      if (cancelled || !autoPdf) return;
      setBusy(true);
      try {
        await downloadPdf(resolvedName);
      } catch {
        if (!cancelled) setError("PDF se nepodařilo vygenerovat. Zkuste to znovu.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPdf, resolvedName]);

  async function onDownload() {
    setError(null);
    setBusy(true);
    try {
      await downloadPdf(resolvedName);
    } catch {
      setError("PDF se nepodařilo vygenerovat. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <Button type="button" onClick={() => void onDownload()} disabled={busy}>
        {busy ? "Generuji PDF…" : "Stáhnout PDF"}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()} disabled={busy}>
        Tisknout
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
