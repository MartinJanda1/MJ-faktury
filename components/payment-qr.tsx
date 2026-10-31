"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type PaymentQrProps = {
  spayd: string;
  /** Optional server-precomputed data URL so the QR is visible before hydration. */
  initialSrc?: string | null;
};

const QR_SIZE = 120;

/**
 * Renders SPAYD payment QR as an <img> data URL so it survives print and html2pdf
 * (canvas pixels are often blank after clone / print).
 */
export function PaymentQr({ spayd, initialSrc = null }: PaymentQrProps) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (initialSrc) {
      setSrc(initialSrc);
      return () => {
        cancelled = true;
      };
    }
    setSrc(null);

    void QRCode.toDataURL(spayd, {
      width: QR_SIZE,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spayd, initialSrc]);

  if (failed) {
    return (
      <div className="payment-qr-missing" role="status">
        QR platbu se nepodařilo vykreslit
      </div>
    );
  }

  return (
    <div
      id="payment-qr-wrap"
      className="payment-qr-frame"
      data-qr-host
      data-qr-ready={src ? "1" : "0"}
      data-spayd={spayd}
    >
      <div className="payment-qr-body">
        {src ? (
          // Invoice PDF/print need a plain img; next/image is unnecessary for data URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            id="payment-qr-image"
            src={src}
            width={QR_SIZE}
            height={QR_SIZE}
            alt="QR platba"
            data-qr-image
          />
        ) : (
          <canvas id="payment-qr-canvas" width={QR_SIZE} height={QR_SIZE} aria-hidden="true" />
        )}
      </div>
      <div className="payment-qr-caption">
        <span className="payment-qr-line" aria-hidden="true" />
        <span className="payment-qr-label">QR platba</span>
        <span className="payment-qr-line" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Visible when bank transfer is selected but company bank details are missing. */
export function PaymentQrMissing() {
  return (
    <div id="payment-qr-wrap" className="payment-qr-missing" data-qr-missing="1" role="status">
      Doplňte účet v Nastavení pro QR platbu
    </div>
  );
}

/** Wait until PaymentQr has drawn (or decided there is nothing to draw). */
export async function waitForPaymentQr(timeoutMs = 4_000): Promise<void> {
  if (typeof document === "undefined") return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const wrap = document.getElementById("payment-qr-wrap");
    if (!wrap) return; // invoice has no QR host (not transfer / no SPAYD)
    if (wrap.getAttribute("data-qr-missing") === "1") return;
    if (wrap.getAttribute("data-qr-ready") === "1") {
      const img = wrap.querySelector<HTMLImageElement>("[data-qr-image]");
      if (img?.complete) return;
      if (img) {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
      return;
    }

    // Fallback: draw into canvas from invoice data-spayd if PaymentQr is stuck.
    const canvas = document.getElementById("payment-qr-canvas") as HTMLCanvasElement | null;
    const root = document.getElementById("invoice-document");
    const spayd = wrap.dataset.spayd || root?.dataset.spayd;
    if (canvas && spayd) {
      try {
        await QRCode.toCanvas(canvas, spayd, {
          width: QR_SIZE,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
        wrap.setAttribute("data-qr-ready", "1");
        return;
      } catch {
        wrap.remove();
        return;
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
}
