import type { Invoice, InvoiceDraft, InvoiceLayout } from "./types";

export const DEFAULT_PAYMENT_METHOD = "Převodem";
export const DEFAULT_LAYOUT: InvoiceLayout = "classic";

export const PAYMENT_METHODS = ["Převodem", "Hotově", "Kartou", "Dobírkou", "Zápočtem"] as const;

export function normalizeLayout(value: unknown): InvoiceLayout {
  return value === "idoklad" ? "idoklad" : "classic";
}

export function normalizePaymentMethod(value: unknown): string {
  const raw = String(value ?? "").trim();
  return raw || DEFAULT_PAYMENT_METHOD;
}

export function normalizeOrderNumber(value: unknown): string {
  return String(value ?? "").trim();
}

/** Ensure older stored invoices get the new optional fields. */
export function withInvoiceDefaults<T extends Partial<Invoice> | Partial<InvoiceDraft>>(
  invoice: T,
): T & { paymentMethod: string; orderNumber: string; layout: InvoiceLayout } {
  return {
    ...invoice,
    paymentMethod: normalizePaymentMethod(invoice.paymentMethod),
    orderNumber: normalizeOrderNumber(invoice.orderNumber),
    layout: normalizeLayout(invoice.layout),
  };
}

export function invoiceFieldDefaults(): Pick<InvoiceDraft, "paymentMethod" | "orderNumber" | "layout"> {
  return {
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    orderNumber: "",
    layout: DEFAULT_LAYOUT,
  };
}
