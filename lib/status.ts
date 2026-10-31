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

export function suggestNextNumber(numbers: string[], today = todayPrague()): string {
  const year = today.slice(0, 4);
  const vfPattern = /^VF\s+(\d+)\/(\d{4})$/i;
  const hasVf = numbers.some((number) => vfPattern.test(number));
  if (hasVf) {
    const seqs: number[] = [];
    for (const number of numbers) {
      const match = number.match(vfPattern);
      if (match && match[2] === year) seqs.push(Number(match[1]));
    }
    const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
    return `VF ${String(next).padStart(2, "0")}/${year}`;
  }
  let best = 0;
  let width = 4;
  let prefix = year;
  for (const number of numbers) {
    const match = number.match(/^(.*?)(\d+)$/);
    if (!match) continue;
    const value = Number(match[2]);
    if (value >= best) {
      best = value;
      width = match[2].length;
      prefix = match[1];
    }
  }
  if (best === 0) return `${year}0001`;
  return `${prefix}${String(best + 1).padStart(width, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
