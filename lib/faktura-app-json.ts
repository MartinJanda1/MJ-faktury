import { formatIban, parseCzechIban } from "./bank";
import { invoiceFieldDefaults, normalizeLayout } from "./invoice-fields";
import { parseAmount, parseIsoDate, roundMoney } from "./money";
import { parseCzechBankAccount } from "./payment-qr";
import type { CustomerDraft, InvoiceDraft, InvoiceStatus, SupplierDraft } from "./types";

export type FakturaAppJsonImport = {
  customers: CustomerDraft[];
  invoices: InvoiceDraft[];
  supplier: SupplierDraft | null;
  warnings: string[];
};

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Split "143 00 Praha 4" into zip + city when the original app stored them together. */
export function splitCityLine(raw: string): { zip: string; city: string } {
  const value = raw.trim();
  const match = value.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  if (!match) return { zip: "", city: value };
  const zipDigits = match[1].replace(/\s/g, "");
  const zip = `${zipDigits.slice(0, 3)} ${zipDigits.slice(3)}`;
  return { zip, city: match[2].trim() };
}

/** Parse `2100132288/2010` or IBAN into company bank fields. */
export function bankFieldsFromPayment(payment: {
  accountNumber?: string;
  iban?: string;
  swift?: string;
}): Pick<SupplierDraft, "bankAccount" | "bankCode" | "iban" | "swift"> {
  const accountRaw = text(payment.accountNumber);
  const ibanRaw = text(payment.iban);
  const swiftRaw = text(payment.swift);
  const parsedAccount = parseCzechBankAccount(accountRaw);
  const parsedIban = parseCzechIban(ibanRaw);

  let bankAccount = "";
  let bankCode = "";
  if (parsedAccount) {
    const prefix = parsedAccount.prefix.replace(/^0+/, "");
    const account = parsedAccount.account.replace(/^0+/, "") || parsedAccount.account;
    bankAccount = prefix ? `${prefix}-${account}` : account;
    bankCode = parsedAccount.bankCode;
  } else if (parsedIban) {
    bankAccount = parsedIban.bankAccount;
    bankCode = parsedIban.bankCode;
  } else if (accountRaw.includes("/")) {
    const [left, right] = accountRaw.split("/");
    bankAccount = left.trim();
    bankCode = right.trim();
  } else {
    bankAccount = accountRaw;
  }

  const iban = parsedIban?.iban || (ibanRaw ? formatIban(ibanRaw) : "");
  const swift = swiftRaw || parsedIban?.swift || "";
  return { bankAccount, bankCode, iban, swift };
}

function statusFromImport(data: Record<string, unknown>): { status: InvoiceStatus; paidDate: string | null } {
  const imported = record(data.importedFrom);
  const paidAt = parseIsoDate(text(imported.paidAt)) || null;
  const paymentStatus = text(imported.paymentStatus).toLowerCase();
  if (data.cancelled === true) return { status: "cancelled", paidDate: null };
  if (paidAt || paymentStatus.includes("uhrazen")) return { status: "paid", paidDate: paidAt };
  if (data.resolved === true) return { status: "paid", paidDate: paidAt };
  return { status: "issued", paidDate: null };
}

function mapSupplier(raw: Record<string, unknown>, payment: Record<string, unknown>): SupplierDraft | null {
  const name = text(raw.name);
  const bank = bankFieldsFromPayment({
    accountNumber: text(payment.accountNumber),
    iban: text(payment.iban),
    swift: text(payment.swift),
  });
  if (!name && !bank.bankAccount && !bank.iban) return null;
  const cityLine = splitCityLine(text(raw.city));
  return {
    name,
    ico: text(raw.ico),
    dic: text(raw.dic),
    street: text(raw.address) || text(raw.street),
    city: cityLine.city || text(raw.city),
    zip: cityLine.zip || text(raw.zip) || text(raw.postalCode),
    country: text(raw.country) || "Česká republika",
    email: text(raw.email),
    phone: text(raw.phone),
    vatNote: text(raw.vatNote),
    ...bank,
  };
}

function mapCustomer(raw: Record<string, unknown>): CustomerDraft | null {
  const name = text(raw.name);
  if (!name) return null;
  const cityLine = splitCityLine(text(raw.city));
  return {
    externalId: null,
    source: "csv",
    name,
    ico: text(raw.ico),
    dic: text(raw.dic),
    street: text(raw.address) || text(raw.street),
    city: cityLine.city || text(raw.city),
    zip: cityLine.zip || text(raw.zip) || text(raw.postalCode),
    country: text(raw.country) || "Česká republika",
    email: text(raw.email),
    phone: text(raw.phone),
    note: "",
  };
}

function mapItems(rawItems: unknown, fallbackName: string, totalGrossHint: number): InvoiceDraft["items"] {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const items = list
    .map((entry) => {
      const item = record(entry);
      const name = text(item.desc) || text(item.name) || text(item.description);
      const qtyRaw = text(item.qty) || text(item.quantity) || "1";
      const priceRaw = text(item.unitPrice) || text(item.price) || "0";
      const quantity = parseAmount(qtyRaw) || 1;
      const unitPrice = parseAmount(priceRaw);
      const totalNet = roundMoney(quantity * unitPrice);
      return {
        name: name || fallbackName || "Položka",
        quantity,
        unit: text(item.unit) || "ks",
        unitPrice,
        vatRate: 0,
        totalNet,
        totalVat: 0,
        totalGross: totalNet,
      };
    })
    .filter((item) => item.name);
  if (items.length > 0) return items;
  if (totalGrossHint > 0) {
    return [
      {
        name: fallbackName || "Položka",
        quantity: 1,
        unit: "ks",
        unitPrice: totalGrossHint,
        vatRate: 0,
        totalNet: totalGrossHint,
        totalVat: 0,
        totalGross: totalGrossHint,
      },
    ];
  }
  return [];
}

function mapInvoice(
  data: Record<string, unknown>,
  filename: string,
): { invoice: InvoiceDraft; customer: CustomerDraft | null; supplier: SupplierDraft | null } | null {
  const dates = record(data.dates);
  const payment = record(data.payment);
  const customerRaw = record(data.customer);
  const supplierRaw = record(data.supplier);
  const number = text(data.invoiceNumber) || text(data.number);
  if (!number) return null;

  const customer = mapCustomer(customerRaw);
  const supplier = mapSupplier(supplierRaw, payment);
  const paidAmount = parseAmount(text(record(data.importedFrom).paidAmount));
  const firstItemDesc = Array.isArray(data.items) ? text(record(data.items[0]).desc) : "";
  const items = mapItems(data.items, firstItemDesc, paidAmount);
  const { status, paidDate } = statusFromImport(data);
  const defaults = invoiceFieldDefaults();
  const issueDate = parseIsoDate(text(dates.issue)) || "";
  if (!issueDate) return null;

  const invoice: InvoiceDraft = {
    externalId: text(data.id) ? `faktura-app:${text(data.id)}` : null,
    source: "csv",
    kind: "issued",
    number,
    variableSymbol: text(payment.variableSymbol) || number.replace(/\D/g, ""),
    constantSymbol: text(payment.constantSymbol),
    specificSymbol: "",
    paymentMethod: text(payment.method) || defaults.paymentMethod,
    orderNumber: text(dates.orderNumber) || defaults.orderNumber,
    layout: normalizeLayout(text(data.layout) || defaults.layout),
    customerExternalId: null,
    customerName: customer?.name || "",
    customerIco: customer?.ico || "",
    customerDic: customer?.dic || "",
    customerStreet: customer?.street || "",
    customerCity: customer?.city || "",
    customerZip: customer?.zip || "",
    customerCountry: customer?.country || "",
    customerEmail: customer?.email || "",
    issueDate,
    dueDate: parseIsoDate(text(dates.due)) || "",
    taxDate: issueDate,
    paidDate,
    currency: "CZK",
    status,
    description: "",
    note: "",
    items,
    supplier,
  };

  void filename;
  return { invoice, customer, supplier };
}

export function looksLikeFakturaAppJson(textValue: string): boolean {
  const trimmed = textValue.trim();
  if (!trimmed.startsWith("{")) return false;
  return (
    trimmed.includes('"faktura-app-invoice"') ||
    trimmed.includes('"faktura-app-export"') ||
    (trimmed.includes('"invoiceNumber"') && trimmed.includes('"supplier"') && trimmed.includes('"payment"'))
  );
}

export function importFakturaAppJson(textValue: string, filename: string): FakturaAppJsonImport {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(textValue);
  } catch {
    return { customers: [], invoices: [], supplier: null, warnings: [`${filename}: soubor není platné JSON.`] };
  }

  const root = record(parsed);
  const payloads: Record<string, unknown>[] = [];
  if (text(root.type) === "faktura-app-invoice" && root.data) {
    payloads.push(record(root.data));
  } else if (Array.isArray(root.invoices)) {
    for (const entry of root.invoices) payloads.push(record(entry));
  } else if (root.invoiceNumber || root.supplier) {
    payloads.push(root);
  } else if (root.data && typeof root.data === "object") {
    payloads.push(record(root.data));
  } else {
    return {
      customers: [],
      invoices: [],
      supplier: null,
      warnings: [`${filename}: neočekávaný formát JSON exportu faktura-app.`],
    };
  }

  const customers: CustomerDraft[] = [];
  const invoices: InvoiceDraft[] = [];
  let supplier: SupplierDraft | null = null;

  for (const payload of payloads) {
    if (!payload || Object.keys(payload).length === 0) continue;
    const mapped = mapInvoice(payload, filename);
    if (!mapped) {
      warnings.push(`${filename}: doklad bez čísla nebo data vystavení byl přeskočen.`);
      continue;
    }
    invoices.push(mapped.invoice);
    if (mapped.customer) customers.push(mapped.customer);
    if (!supplier && mapped.supplier) supplier = mapped.supplier;
  }

  if (invoices.length === 0 && warnings.length === 0) {
    warnings.push(`${filename}: v JSON jsem nenašel žádnou fakturu.`);
  }

  return { customers, invoices, supplier, warnings };
}
