import { todayPrague } from "./money";
import type { InvoiceKind, InvoiceStatus } from "./types";

export type DisplayStatus = InvoiceStatus | "overdue";

export function displayStatus(
  invoice: { status: InvoiceStatus; dueDate: string; paidDate: string | null },
  today = todayPrague(),
): DisplayStatus {
  if (invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "draft" || invoice.status === "partial") {
    return invoice.status;
  }
  if (invoice.paidDate) return "paid";
  if (invoice.dueDate && invoice.dueDate < today) return "overdue";
  return "issued";
}

export function statusLabel(status: DisplayStatus): string {
  switch (status) {
    case "draft":
      return "Koncept";
    case "issued":
      return "Vystaveno";
    case "partial":
      return "Částečně uhrazeno";
    case "paid":
      return "Uhrazeno";
    case "overdue":
      return "Po splatnosti";
    case "cancelled":
      return "Storno";
  }
}

export function kindLabel(kind: InvoiceKind): string {
  switch (kind) {
    case "issued":
      return "Faktura";
    case "proforma":
      return "Zálohová faktura";
    case "credit_note":
      return "Dobropis";
  }
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "idoklad":
      return "iDoklad";
    case "csv":
      return "Tabulka";
    case "isdoc":
      return "ISDOC";
    default:
      return "Ručně";
  }
}

const SERIES_YEAR_RE = /^(\d+)\/(\d{2,4})$/;

function expandYear(yStr: string): number {
  const n = parseInt(yStr, 10);
  if (yStr.length === 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

function formatSeriesYear(sequence: number, year: number, seqPad = 0): string {
  const num = seqPad > 0 ? String(sequence).padStart(seqPad, "0") : String(sequence);
  return `${num}/${year}`;
}

function findUniqueNumber(candidate: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()).filter(Boolean));
  let next = String(candidate || "").trim() || "1";
  let guard = 0;
  while (taken.has(next.toLowerCase()) && guard < 10000) {
    const series = next.match(SERIES_YEAR_RE);
    if (series) {
      next = formatSeriesYear(parseInt(series[1], 10) + 1, expandYear(series[2]), series[1].length);
    } else {
      const legacy = next.match(/^(.*?)(\d+)(\s*)$/);
      if (legacy) {
        next = `${legacy[1]}${String(parseInt(legacy[2], 10) + 1).padStart(legacy[2].length, "0")}${legacy[3]}`;
      } else {
        next = `${next}-2`;
      }
    }
    guard += 1;
  }
  return next;
}

/** Suggest next invoice number. Prefers `číslo/rok`, then VF, then numeric suffix. */
export function suggestNextNumber(numbers: string[], today = todayPrague()): string {
  const year = Number(today.slice(0, 4));
  const yearStr = String(year);
  const normalized = numbers.map((n) => String(n || "").trim()).filter(Boolean);

  const series = normalized
    .map((raw) => {
      const match = raw.match(SERIES_YEAR_RE);
      if (!match) return null;
      return { sequence: parseInt(match[1], 10), year: expandYear(match[2]), seqPad: match[1].length, raw };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (series.length > 0) {
    let maxSeq = 0;
    let seqPad = 0;
    for (const item of series) {
      if (item.year === year) {
        maxSeq = Math.max(maxSeq, item.sequence);
        seqPad = Math.max(seqPad, item.seqPad);
      }
    }
    return findUniqueNumber(formatSeriesYear(maxSeq + 1, year, seqPad), normalized);
  }

  const vfPattern = /^VF\s+(\d+)\/(\d{4})$/i;
  const hasVf = normalized.some((number) => vfPattern.test(number));
  if (hasVf) {
    const seqs: number[] = [];
    for (const number of normalized) {
      const match = number.match(vfPattern);
      if (match && match[2] === yearStr) seqs.push(Number(match[1]));
    }
    const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
    return findUniqueNumber(`VF ${String(next).padStart(2, "0")}/${yearStr}`, normalized);
  }

  let best = 0;
  let width = 4;
  let prefix = yearStr;
  for (const number of normalized) {
    const match = number.match(/^(.*?)(\d+)$/);
    if (!match) continue;
    const value = Number(match[2]);
    if (value >= best) {
      best = value;
      width = match[2].length;
      prefix = match[1];
    }
  }
  if (best === 0) return `${yearStr}0001`;
  return findUniqueNumber(`${prefix}${String(best + 1).padStart(width, "0")}`, normalized);
}

/** Digits-only variable symbol derived from invoice number (max 10). */
export function variableSymbolFromNumber(invoiceNumber: string): string {
  return String(invoiceNumber || "")
    .replace(/\D/g, "")
    .slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
