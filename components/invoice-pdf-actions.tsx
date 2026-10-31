"use client";

import { useEffect, useRef, useState } from "react";
import { waitForPaymentQr } from "@/components/payment-qr";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_LAYOUT,
  INVOICE_LAYOUT_STORAGE_KEY,
  INVOICE_LAYOUTS,
  layoutLabel,
  normalizeLayout,
} from "@/lib/invoice-fields";
import type { InvoiceLayout } from "@/lib/types";

type InvoicePdfActionsProps = {
  /** When true (e.g. ?pdf=1), start PDF download after QR is ready. */
  autoPdf?: boolean;
  filename?: string;
  /** Layout from URL (?layout=) when present. */
  initialLayout?: InvoiceLayout;
  /** Persist choice to URL query on the print page. */
  syncUrl?: boolean;
  /**
   * When true (print page), restore last layout from localStorage if URL has none.
   * Detail preview keeps classic until the user picks a style.
   */
  useStoredPreference?: boolean;
};

const PDF_TIMEOUT_MS = 25_000;

function readStoredLayout(): InvoiceLayout | null {
  try {
    const raw = window.localStorage.getItem(INVOICE_LAYOUT_STORAGE_KEY);
    return raw ? normalizeLayout(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredLayout(layout: InvoiceLayout): void {
  try {
    window.localStorage.setItem(INVOICE_LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* private mode / quota */
  }
}

function applyLayoutToDocument(layout: InvoiceLayout): void {
  const invoice = document.getElementById("invoice-document");
  if (!invoice) return;
  invoice.classList.remove("layout-classic", "layout-modern", "layout-idoklad");
  invoice.classList.add(`layout-${layout}`);
  invoice.setAttribute("data-layout", layout);
}

function syncLayoutQuery(layout: InvoiceLayout): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("layout") === layout) return;
  url.searchParams.set("layout", layout);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

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

async function prepareInvoiceForExport(): Promise<void> {
  await waitForPaymentQr();
  await waitForPaint();
}

function openPrintFallback(): void {
  cleanupPdfExportArtifacts();
  // Prefer native print (Save as PDF) — reliable for classic A4 DOM.
  void prepareInvoiceForExport().then(() => window.print());
}

async function downloadPdfWithHtml2pdf(filename: string): Promise<void> {
  const invoice = document.getElementById("invoice-document");
  if (!invoice) {
    throw new Error("Doklad na stránce chybí.");
  }

  await prepareInvoiceForExport();

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
        // Prefer copying live QR <img> data URL into the clone.
        const liveImg = document.getElementById("payment-qr-image") as HTMLImageElement | null;
        const clonedImg = cloned.querySelector("#payment-qr-image") as HTMLImageElement | null;
        if (liveImg?.src && clonedImg) {
          clonedImg.src = liveImg.src;
        }
        const liveCanvas = document.getElementById("payment-qr-canvas") as HTMLCanvasElement | null;
        const clonedCanvas = cloned.querySelector("#payment-qr-canvas") as HTMLCanvasElement | null;
        if (liveCanvas && clonedCanvas) {
          try {
            const ctx = clonedCanvas.getContext("2d");
            ctx?.drawImage(liveCanvas, 0, 0);
          } catch {
            /* clone may already be an <img> */
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

export function InvoicePdfActions({
  autoPdf = false,
  filename,
  initialLayout,
  syncUrl = false,
  useStoredPreference = false,
}: InvoicePdfActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [layout, setLayout] = useState<InvoiceLayout>(normalizeLayout(initialLayout ?? DEFAULT_LAYOUT));
  const [layoutReady, setLayoutReady] = useState(false);
  const resolvedName = safeFilename(filename);
  const autoStarted = useRef(false);

  useEffect(() => {
    // Always clear leftovers from a previous failed export (e.g. soft navigation).
    cleanupPdfExportArtifacts();
    void waitForPaymentQr();
  }, []);

  useEffect(() => {
    const fromProp = initialLayout ? normalizeLayout(initialLayout) : null;
    const fromStore = useStoredPreference ? readStoredLayout() : null;
    const next = fromProp ?? fromStore ?? DEFAULT_LAYOUT;
    setLayout(next);
    applyLayoutToDocument(next);
    if (useStoredPreference || fromProp) writeStoredLayout(next);
    if (syncUrl) syncLayoutQuery(next);
    setLayoutReady(true);
  }, [initialLayout, syncUrl, useStoredPreference]);

  useEffect(() => {
    let cancelled = false;
    if (!autoPdf || !layoutReady || autoStarted.current) return;
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
  }, [autoPdf, layoutReady, resolvedName]);

  function onLayoutChange(value: string | null) {
    const next = normalizeLayout(value);
    setLayout(next);
    applyLayoutToDocument(next);
    writeStoredLayout(next);
    if (syncUrl) syncLayoutQuery(next);
  }

  async function onDownload() {
    setError(null);
    setHint(null);
    setBusy(true);
    try {
      applyLayoutToDocument(layout);
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

  async function onPrint() {
    cleanupPdfExportArtifacts();
    setError(null);
    setBusy(true);
    try {
      applyLayoutToDocument(layout);
      await prepareInvoiceForExport();
      window.print();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3" aria-busy={busy || undefined}>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="whitespace-nowrap">Vzhled</span>
        <Select value={layout} onValueChange={onLayoutChange}>
          <SelectTrigger className="h-9 w-[9.5rem] bg-background" aria-label="Vzhled dokladu">
            <SelectValue>{(value) => (value ? layoutLabel(value as InvoiceLayout) : null)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {INVOICE_LAYOUTS.map((row) => (
              <SelectItem key={row.value} value={row.value}>
                {row.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button type="button" onClick={() => void onDownload()} disabled={busy}>
        {busy ? "Generuji PDF…" : "Stáhnout PDF"}
      </Button>
      <Button type="button" variant="outline" onClick={() => void onPrint()} disabled={busy}>
        Tisknout
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {hint ? <p className="text-sm text-amber-800">{hint}</p> : null}
    </div>
  );
}
