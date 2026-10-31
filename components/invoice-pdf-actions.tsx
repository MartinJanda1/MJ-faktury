"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

type InvoicePdfActionsProps = {
  /** When true (e.g. ?pdf=1), start PDF download after QR is ready. */
  autoPdf?: boolean;
  filename?: string;
};

const PDF_TIMEOUT_MS = 25_000;

/** html2pdf leaves a full-viewport `.html2pdf__overlay` when html2canvas fails — remove it. */
function cleanupPdfExportArtifacts(): void {
  if (typeof document === "undefined") return;

  document.documentElement.classList.remove("pdf-exporting");
  document.body.classList.remove("pdf-exporting");
  document.documentElement.removeAttribute("aria-busy");
  document.body.removeAttribute("aria-busy");

  const invoice = document.getElementById("invoice-document");
  invoice?.classList.remove("pdf-exporting");

  document
    .querySelectorAll(".html2pdf__overlay, .html2canvas-container, .html2pdf__container")
    .forEach((node) => {
      try {
        node.remove();
      } catch {
        /* ignore */
      }
    });

  // Restore anything html2canvas / html2pdf may have left on body/html.
  document.body.style.removeProperty("pointer-events");
  document.documentElement.style.removeProperty("pointer-events");
  if (document.body.style.overflow === "hidden") {
    document.body.style.removeProperty("overflow");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

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
    // Ensure pixels are committed before html2pdf clones the canvas → image.
    await waitForPaint();
  } catch {
    wrap.style.display = "none";
  }
}

function openPrintFallback(): void {
  cleanupPdfExportArtifacts();
  // Prefer native print (Save as PDF) — reliable for classic A4 DOM.
  window.print();
}

async function downloadPdfWithHtml2pdf(filename: string): Promise<void> {
  const invoice = document.getElementById("invoice-document");
  if (!invoice) {
    throw new Error("Doklad na stránce chybí.");
  }

  await renderPaymentQr();
  await waitForPaint();

  const html2pdf = (await import("html2pdf.js")).default;
  // High DPR scales often blow past browser canvas limits on A4 → throw mid-capture
  // and leave html2pdf__overlay behind. Cap conservatively.
  const pdfScale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));

  document.documentElement.classList.add("pdf-exporting");
  document.documentElement.setAttribute("aria-busy", "true");
  invoice.classList.add("pdf-exporting");
  window.scrollTo(0, 0);

  const options = {
    margin: [0, 0, 10, 0] as [number, number, number, number],
    filename,
    image: { type: "jpeg" as const, quality: 0.95 },
    html2canvas: {
      scale: pdfScale,
      useCORS: true,
      allowTaint: true,
      letterRendering: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: -window.scrollY,
      logging: false,
      removeContainer: true,
      onclone: (_doc: Document, cloned: HTMLElement) => {
        // Re-paint QR from live canvas into clone if still a canvas (belt-and-suspenders).
        const live = document.getElementById("payment-qr-canvas") as HTMLCanvasElement | null;
        const clonedCanvas = cloned.querySelector("#payment-qr-canvas") as HTMLCanvasElement | null;
        if (live && clonedCanvas) {
          try {
            const ctx = clonedCanvas.getContext("2d");
            ctx?.drawImage(live, 0, 0);
          } catch {
            /* clone may already be an <img> from deepCloneBasic */
          }
        }
        cloned.classList.add("pdf-exporting");
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["css", "legacy"] as string[] },
  };

  try {
    await withTimeout(
      html2pdf().set(options).from(invoice).save(),
      PDF_TIMEOUT_MS,
      "PDF export",
    );
  } finally {
    cleanupPdfExportArtifacts();
  }
}

function safeFilename(raw: string | undefined): string {
  const number = (raw || "faktura").replace(/[/\\?%*:|"<>]/g, "-").trim() || "faktura";
  return `faktura-${number}.pdf`;
}

export function InvoicePdfActions({ autoPdf = false, filename }: InvoicePdfActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const resolvedName = safeFilename(filename);
  const autoStarted = useRef(false);

  useEffect(() => {
    // Always clear leftovers from a previous failed export (e.g. soft navigation).
    cleanupPdfExportArtifacts();
    void renderPaymentQr();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!autoPdf || autoStarted.current) return;
    autoStarted.current = true;

    void (async () => {
      setBusy(true);
      setError(null);
      setHint(null);
      try {
        await downloadPdfWithHtml2pdf(resolvedName);
      } catch {
        cleanupPdfExportArtifacts();
        if (cancelled) return;
        setHint("Automatické stažení PDF selhalo — otevřen tisk (uložte jako PDF).");
        openPrintFallback();
      } finally {
        cleanupPdfExportArtifacts();
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanupPdfExportArtifacts();
    };
  }, [autoPdf, resolvedName]);

  async function onDownload() {
    setError(null);
    setHint(null);
    setBusy(true);
    try {
      await downloadPdfWithHtml2pdf(resolvedName);
    } catch {
      cleanupPdfExportArtifacts();
      setError(null);
      setHint("PDF se nepodařilo stáhnout automaticky — použijte tisk a „Uložit jako PDF“.");
      openPrintFallback();
    } finally {
      cleanupPdfExportArtifacts();
      setBusy(false);
    }
  }

  function onPrint() {
    cleanupPdfExportArtifacts();
    setError(null);
    setBusy(false);
    window.print();
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3" aria-busy={busy || undefined}>
      <Button type="button" onClick={() => void onDownload()} disabled={busy}>
        {busy ? "Generuji PDF…" : "Stáhnout PDF"}
      </Button>
      <Button type="button" variant="outline" onClick={onPrint} disabled={busy}>
        Tisknout
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {hint ? <p className="text-sm text-amber-800">{hint}</p> : null}
    </div>
  );
}
