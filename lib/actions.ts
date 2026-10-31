"use server";

import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { normalizeLayout, normalizeOrderNumber, normalizePaymentMethod } from "./invoice-fields";
import { todayPrague } from "./money";
import {
  deleteCustomer,
  deleteInvoice,
  getInvoiceRow,
  listInvoiceNumbers,
  saveCompany,
  saveManualCustomer,
  setCompanyVatNote,
  setInvoicePayment,
  setInvoiceStatus,
  upsertInvoice,
} from "./persist";
import { addDaysIso, isInvoiceEditable, suggestNextNumber, variableSymbolFromNumber } from "./status";
import type { InvoiceKind, InvoiceStatus, ItemDraft } from "./types";
import { vatNoteForFlag } from "./vat";

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveCompanyAction(_previous: { error: string; saved: boolean }, formData: FormData) {
  await connection();
  const clearSecret = formData.get("clearSecret") === "on";
  const secret = String(formData.get("clientSecret") ?? "");
  await saveCompany({
    name: String(formData.get("name") ?? ""),
    ico: String(formData.get("ico") ?? ""),
    dic: String(formData.get("dic") ?? ""),
    street: String(formData.get("street") ?? ""),
    city: String(formData.get("city") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    country: String(formData.get("country") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    vatNote:
      formData.get("notVatPayer") === "on"
        ? String(formData.get("vatNote") ?? "").trim() || vatNoteForFlag(true)
        : "",
    bankAccount: String(formData.get("bankAccount") ?? ""),
    bankCode: String(formData.get("bankCode") ?? ""),
    iban: String(formData.get("iban") ?? ""),
    swift: String(formData.get("swift") ?? ""),
    footerNote: String(formData.get("footerNote") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
    clientSecret: secret.trim() ? secret : null,
    clearSecret,
  });
  refresh();
  return { error: "", saved: true };
}

export async function saveCustomerAction(_previous: { error: string }, formData: FormData) {
  await connection();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Vyplňte název odběratele." };
  const existing = String(formData.get("id") ?? "") || null;
  let savedId = "";
  try {
    savedId = await saveManualCustomer(existing, {
      externalId: null,
      source: "manual",
      name,
      ico: String(formData.get("ico") ?? ""),
      dic: String(formData.get("dic") ?? ""),
      street: String(formData.get("street") ?? ""),
      city: String(formData.get("city") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      country: String(formData.get("country") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Odběratele se nepodařilo uložit." };
  }
  refresh();
  redirect(`/odberatele/${savedId}`);
}

export async function deleteCustomerAction(formData: FormData) {
  await connection();
  await deleteCustomer(String(formData.get("id") ?? ""));
  refresh();
  redirect("/odberatele");
}

export async function saveInvoiceAction(_previous: { error: string }, formData: FormData) {
  await connection();
  const number = String(formData.get("number") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const issueDate = String(formData.get("issueDate") ?? "");
  if (!number) return { error: "Vyplňte číslo dokladu." };
  if (!customerName) return { error: "Vyplňte odběratele." };
  if (!issueDate) return { error: "Vyplňte datum vystavení." };
  let parsed: ItemDraft[] = [];
  try {
    parsed = JSON.parse(String(formData.get("items") ?? "[]")) as ItemDraft[];
  } catch {
    return { error: "Položky se nepodařilo přečíst." };
  }
  const items = parsed.filter((item) => item.name?.trim());
  if (items.length === 0) return { error: "Přidejte aspoň jednu položku." };
  const status = String(formData.get("status") ?? "issued") as InvoiceStatus;
  const allowed: InvoiceStatus[] = ["draft", "issued", "partial", "paid", "cancelled"];
  const safeStatus = allowed.includes(status) ? status : "issued";
  const paidDateRaw = String(formData.get("paidDate") ?? "");
  const paidDate = safeStatus === "paid" ? paidDateRaw || todayPrague() : paidDateRaw || null;
  const kind = String(formData.get("kind") ?? "issued") as InvoiceKind;
  const safeKind: InvoiceKind = kind === "proforma" || kind === "credit_note" ? kind : "issued";
  const customerId = String(formData.get("customerId") ?? "").trim();
  if (!customerId) {
    return { error: "Vyberte odběratele z adresáře. Nového založíte v sekci Odběratelé." };
  }
  const invoiceId = String(formData.get("id") ?? "") || null;
  if (invoiceId) {
    const existing = await getInvoiceRow(invoiceId);
    if (existing && !isInvoiceEditable(existing)) {
      return {
        error:
          existing.status === "cancelled"
            ? "Stornovaný doklad nelze upravovat. Nejprve zrušte storno."
            : "Uhrazený doklad nelze upravovat. Nejprve zrušte úhradu.",
      };
    }
  }
  const notVatPayer = formData.get("notVatPayer") === "on";
  const normalizedItems = notVatPayer
    ? items.map((item) => ({ ...item, vatRate: 0 }))
    : items;
  let result: { id: string };
  try {
    await setCompanyVatNote(vatNoteForFlag(notVatPayer));
    result = await upsertInvoice(
      {
        externalId: null,
        source: "manual",
        kind: safeKind,
        number,
        variableSymbol: String(formData.get("variableSymbol") ?? ""),
        constantSymbol: String(formData.get("constantSymbol") ?? ""),
        specificSymbol: String(formData.get("specificSymbol") ?? ""),
        paymentMethod: normalizePaymentMethod(formData.get("paymentMethod")),
        orderNumber: normalizeOrderNumber(formData.get("orderNumber")),
        layout: normalizeLayout(formData.get("layout")),
        customerExternalId: null,
        customerName,
        customerIco: String(formData.get("customerIco") ?? ""),
        customerDic: String(formData.get("customerDic") ?? ""),
        customerStreet: String(formData.get("customerStreet") ?? ""),
        customerCity: String(formData.get("customerCity") ?? ""),
        customerZip: String(formData.get("customerZip") ?? ""),
        customerCountry: String(formData.get("customerCountry") ?? ""),
        customerEmail: String(formData.get("customerEmail") ?? ""),
        issueDate,
        dueDate: String(formData.get("dueDate") ?? ""),
        taxDate: String(formData.get("taxDate") ?? "") || issueDate,
        paidDate: safeStatus === "paid" ? paidDate : safeStatus === "partial" ? paidDateRaw || null : null,
        currency: String(formData.get("currency") ?? "CZK").toUpperCase() || "CZK",
        status: safeStatus,
        description: String(formData.get("description") ?? ""),
        note: String(formData.get("note") ?? ""),
        items: normalizedItems,
        supplier: null,
      },
      invoiceId,
      customerId,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Doklad se nepodařilo uložit." };
  }
  refresh();
  redirect(`/faktury/${result.id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  await connection();
  await deleteInvoice(String(formData.get("id") ?? ""));
  refresh();
  redirect("/faktury");
}

function redirectAfter(formData: FormData, fallback: string) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  redirect(returnTo.startsWith("/") ? returnTo : fallback);
}

export async function markPaidAction(formData: FormData) {
  await connection();
  const id = String(formData.get("id") ?? "");
  await setInvoicePayment(id, todayPrague());
  refresh();
  redirectAfter(formData, `/faktury/${id}`);
}

export async function markUnpaidAction(formData: FormData) {
  await connection();
  const id = String(formData.get("id") ?? "");
  await setInvoicePayment(id, null);
  refresh();
  redirectAfter(formData, `/faktury/${id}`);
}

export async function cancelInvoiceAction(formData: FormData) {
  await connection();
  const id = String(formData.get("id") ?? "");
  await setInvoiceStatus(id, "cancelled");
  refresh();
  redirectAfter(formData, `/faktury/${id}`);
}

export async function restoreInvoiceAction(formData: FormData) {
  await connection();
  const id = String(formData.get("id") ?? "");
  await setInvoiceStatus(id, "issued");
  refresh();
  redirectAfter(formData, `/faktury/${id}`);
}

export async function duplicateInvoiceAction(formData: FormData) {
  await connection();
  const id = String(formData.get("id") ?? "");
  const source = await getInvoiceRow(id);
  if (!source) redirect("/faktury");
  const today = todayPrague();
  const numbers = await listInvoiceNumbers();
  const nextNumber = suggestNextNumber(numbers, today);
  const result = await upsertInvoice(
    {
      externalId: null,
      source: "manual",
      kind: source.kind,
      number: nextNumber,
      variableSymbol: variableSymbolFromNumber(nextNumber),
      constantSymbol: source.constantSymbol,
      specificSymbol: "",
      paymentMethod: source.paymentMethod || "Převodem",
      orderNumber: "",
      layout: source.layout || "classic",
      customerExternalId: null,
      customerName: source.customerName,
      customerIco: source.customerIco,
      customerDic: source.customerDic,
      customerStreet: source.customerStreet,
      customerCity: source.customerCity,
      customerZip: source.customerZip,
      customerCountry: source.customerCountry,
      customerEmail: source.customerEmail,
      issueDate: today,
      dueDate: addDaysIso(today, 14),
      taxDate: today,
      paidDate: null,
      currency: source.currency,
      status: "issued",
      description: source.description,
      note: source.note,
      items: source.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalNet: item.totalNet,
        totalVat: item.totalVat,
        totalGross: item.totalGross,
      })),
      supplier: null,
    },
    null,
    source.customerId,
  );
  refresh();
  redirect(`/faktury/${result.id}/upravit`);
}
