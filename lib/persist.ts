import { randomUUID } from "node:crypto";
import { lineTotals, roundMoney } from "./money";
import { loadStore, updateStore, type StoreDocument } from "./store";
import type {
  Customer,
  CustomerDraft,
  ImportCounts,
  Invoice,
  InvoiceDraft,
  InvoiceItem,
  InvoiceStatus,
  ItemDraft,
  SupplierDraft,
} from "./types";

function blankCustomer(partial: Partial<CustomerDraft> & Pick<CustomerDraft, "name" | "source">): CustomerDraft {
  return {
    externalId: partial.externalId ?? null,
    source: partial.source,
    name: partial.name.trim(),
    ico: (partial.ico ?? "").trim(),
    dic: (partial.dic ?? "").trim(),
    street: (partial.street ?? "").trim(),
    city: (partial.city ?? "").trim(),
    zip: (partial.zip ?? "").trim(),
    country: (partial.country ?? "").trim() || "Česká republika",
    email: (partial.email ?? "").trim(),
    phone: (partial.phone ?? "").trim(),
    note: (partial.note ?? "").trim(),
  };
}

function findCustomer(doc: StoreDocument, draft: CustomerDraft): Customer | undefined {
  if (draft.externalId) {
    const byExternal = doc.customers.find((customer) => customer.externalId === draft.externalId);
    if (byExternal) return byExternal;
  }
  if (draft.ico) {
    const byIco = doc.customers.find((customer) => customer.ico === draft.ico);
    if (byIco) return byIco;
  }
  return doc.customers.find((customer) => customer.name.toLowerCase() === draft.name.toLowerCase());
}

function resolvedItems(items: ItemDraft[]) {
  return items.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const vatRate = Number(item.vatRate) || 0;
    const hasImportedTotals = item.totalNet != null && item.totalVat != null && item.totalGross != null;
    const computed = lineTotals(quantity, Number(item.unitPrice) || 0, vatRate);
    const totalNet = hasImportedTotals ? roundMoney(item.totalNet ?? 0) : computed.totalNet;
    const totalVat = hasImportedTotals ? roundMoney(item.totalVat ?? 0) : computed.totalVat;
    const totalGross = hasImportedTotals ? roundMoney(item.totalGross ?? 0) : computed.totalGross;
    const unitPrice =
      quantity && hasImportedTotals ? roundMoney(totalNet / quantity) : roundMoney(Number(item.unitPrice) || 0);
    return {
      position: index + 1,
      name: item.name.trim() || "Položka",
      quantity,
      unit: item.unit.trim() || "ks",
      unitPrice,
      vatRate,
      totalNet,
      totalVat,
      totalGross,
    };
  });
}

function findCustomerId(doc: StoreDocument, draft: InvoiceDraft): string | null {
  if (draft.customerExternalId) {
    const match = doc.customers.find((customer) => customer.externalId === draft.customerExternalId);
    if (match) return match.id;
  }
  if (draft.customerIco) {
    const match = doc.customers.find((customer) => customer.ico === draft.customerIco);
    if (match) return match.id;
  }
  if (draft.customerName) {
    const match = doc.customers.find((customer) => customer.name.toLowerCase() === draft.customerName.toLowerCase());
    if (match) return match.id;
  }
  return null;
}

function upsertCustomerInDoc(doc: StoreDocument, draft: CustomerDraft): { id: string; created: boolean } {
  const customer = blankCustomer(draft);
  if (!customer.name) throw new Error("Odběratel nemá název.");
  const now = new Date().toISOString();
  const existing = findCustomer(doc, customer);
  if (existing) {
    existing.externalId = customer.externalId ?? existing.externalId;
    existing.source = customer.source;
    existing.name = customer.name;
    existing.ico = customer.ico;
    existing.dic = customer.dic;
    existing.street = customer.street;
    existing.city = customer.city;
    existing.zip = customer.zip;
    existing.country = customer.country;
    existing.email = customer.email;
    existing.phone = customer.phone;
    existing.note = customer.note || existing.note;
    existing.updatedAt = now;
    return { id: existing.id, created: false };
  }
  const id = randomUUID();
  doc.customers.push({
    id,
    ...customer,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

function upsertInvoiceInDoc(
  doc: StoreDocument,
  draft: InvoiceDraft,
  preferredId?: string | null,
  linkedCustomerId?: string | null,
): { id: string; created: boolean } {
  const number = draft.number.trim();
  if (!number) throw new Error("Doklad nemá číslo.");
  const items = resolvedItems(draft.items);
  if (items.length === 0) throw new Error(`Doklad ${number} nemá žádnou položku.`);
  const totalNet = roundMoney(items.reduce((sum, item) => sum + item.totalNet, 0));
  const totalVat = roundMoney(items.reduce((sum, item) => sum + item.totalVat, 0));
  const totalGross = roundMoney(items.reduce((sum, item) => sum + item.totalGross, 0));
  const now = new Date().toISOString();
  let customerId = linkedCustomerId || findCustomerId(doc, draft);
  if (!customerId && draft.customerName.trim()) {
    customerId = upsertCustomerInDoc(doc, {
      externalId: draft.customerExternalId,
      source: draft.source,
      name: draft.customerName,
      ico: draft.customerIco,
      dic: draft.customerDic,
      street: draft.customerStreet,
      city: draft.customerCity,
      zip: draft.customerZip,
      country: draft.customerCountry || "Česká republika",
      email: draft.customerEmail,
      phone: "",
      note: "",
    }).id;
  }

  let existing =
    (preferredId ? doc.invoices.find((invoice) => invoice.id === preferredId) : undefined) ||
    (draft.externalId ? doc.invoices.find((invoice) => invoice.externalId === draft.externalId) : undefined) ||
    doc.invoices.find((invoice) => invoice.number === number && invoice.kind === draft.kind);

  if (preferredId && !doc.invoices.some((invoice) => invoice.id === preferredId)) {
    throw new Error("Doklad už v evidenci není.");
  }
  if (preferredId) {
    const clash = doc.invoices.find((invoice) => invoice.number === number && invoice.kind === draft.kind && invoice.id !== preferredId);
    if (clash) throw new Error(`Doklad ${number} už existuje.`);
  }

  const header = {
    externalId: draft.externalId ?? existing?.externalId ?? null,
    source: draft.source,
    kind: draft.kind,
    number,
    variableSymbol: draft.variableSymbol.trim(),
    constantSymbol: draft.constantSymbol.trim(),
    specificSymbol: draft.specificSymbol.trim(),
    customerId,
    customerName: draft.customerName.trim(),
    customerIco: draft.customerIco.trim(),
    customerDic: draft.customerDic.trim(),
    customerStreet: draft.customerStreet.trim(),
    customerCity: draft.customerCity.trim(),
    customerZip: draft.customerZip.trim(),
    customerCountry: draft.customerCountry.trim(),
    customerEmail: draft.customerEmail.trim(),
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    taxDate: draft.taxDate,
    paidDate: draft.paidDate,
    currency: draft.currency || "CZK",
    status: draft.status,
    description: draft.description.trim(),
    note: draft.note.trim(),
    totalNet,
    totalVat,
    totalGross,
    updatedAt: now,
  };

  let id = existing?.id;
  let created = false;
  if (existing && id) {
    Object.assign(existing, header);
  } else {
    id = randomUUID();
    created = true;
    doc.invoices.push({
      id,
      ...header,
      createdAt: now,
    });
  }

  doc.items = doc.items.filter((item) => item.invoiceId !== id);
  for (const item of items) {
    doc.items.push({
      id: randomUUID(),
      invoiceId: id!,
      ...item,
    });
  }
  return { id: id!, created };
}

function fillCompanyIfEmptyInDoc(doc: StoreDocument, supplier: SupplierDraft) {
  if (doc.company.name.trim()) return;
  doc.company.name = supplier.name.trim();
  doc.company.ico = supplier.ico.trim();
  doc.company.dic = supplier.dic.trim();
  doc.company.street = supplier.street.trim();
  doc.company.city = supplier.city.trim();
  doc.company.zip = supplier.zip.trim();
  doc.company.country = supplier.country.trim() || "Česká republika";
  doc.company.email = supplier.email.trim();
  doc.company.phone = supplier.phone.trim();
  doc.company.bankAccount = supplier.bankAccount.trim();
  doc.company.bankCode = supplier.bankCode.trim();
  doc.company.iban = supplier.iban.trim();
  doc.company.swift = supplier.swift.trim();
}

export async function upsertCustomer(draft: CustomerDraft): Promise<{ id: string; created: boolean }> {
  return updateStore((doc) => upsertCustomerInDoc(doc, draft));
}

export async function saveManualCustomer(id: string | null, draft: CustomerDraft): Promise<string> {
  return updateStore((doc) => {
    const customer = blankCustomer({ ...draft, source: "manual", externalId: null });
    if (!customer.name) throw new Error("Odběratel nemá název.");
    const now = new Date().toISOString();
    if (id) {
      const existing = doc.customers.find((row) => row.id === id);
      if (!existing) throw new Error("Odběratel už v evidenci není.");
      Object.assign(existing, customer, { id, updatedAt: now, createdAt: existing.createdAt, externalId: existing.externalId, source: existing.source === "manual" ? "manual" : existing.source });
      return id;
    }
    return upsertCustomerInDoc(doc, customer).id;
  });
}

export async function upsertInvoice(
  draft: InvoiceDraft,
  preferredId?: string | null,
  linkedCustomerId?: string | null,
): Promise<{ id: string; created: boolean }> {
  return updateStore((doc) => upsertInvoiceInDoc(doc, draft, preferredId, linkedCustomerId));
}

export async function applyImport(customers: CustomerDraft[], invoices: InvoiceDraft[], supplier: SupplierDraft | null): Promise<ImportCounts> {
  return updateStore((doc) => {
    const counts: ImportCounts = {
      customersCreated: 0,
      customersUpdated: 0,
      invoicesCreated: 0,
      invoicesUpdated: 0,
      warnings: [],
    };
    for (const customer of customers) {
      if (!customer.name.trim()) {
        counts.warnings.push("Kontakt bez názvu byl přeskočen.");
        continue;
      }
      const result = upsertCustomerInDoc(doc, customer);
      if (result.created) counts.customersCreated += 1;
      else counts.customersUpdated += 1;
    }
    for (const invoice of invoices) {
      if (!invoice.number.trim()) {
        counts.warnings.push("Doklad bez čísla byl přeskočen.");
        continue;
      }
      try {
        const result = upsertInvoiceInDoc(doc, invoice);
        if (result.created) counts.invoicesCreated += 1;
        else counts.invoicesUpdated += 1;
      } catch (error) {
        counts.warnings.push(error instanceof Error ? error.message : "Doklad se nepodařilo uložit.");
      }
    }
    if (supplier?.name.trim()) fillCompanyIfEmptyInDoc(doc, supplier);
    return counts;
  });
}

export async function loadItems(invoiceId: string): Promise<InvoiceItem[]> {
  const doc = await loadStore();
  return doc.items.filter((item) => item.invoiceId === invoiceId).sort((a, b) => a.position - b.position);
}

export async function getCustomerRow(id: string): Promise<Customer | null> {
  const doc = await loadStore();
  return doc.customers.find((customer) => customer.id === id) ?? null;
}

export async function getInvoiceRow(id: string): Promise<Invoice | null> {
  const doc = await loadStore();
  const invoice = doc.invoices.find((row) => row.id === id);
  if (!invoice) return null;
  return {
    ...invoice,
    items: doc.items.filter((item) => item.invoiceId === id).sort((a, b) => a.position - b.position),
  };
}

export async function deleteCustomer(id: string) {
  await updateStore((doc) => {
    doc.customers = doc.customers.filter((customer) => customer.id !== id);
    for (const invoice of doc.invoices) {
      if (invoice.customerId === id) invoice.customerId = null;
    }
  });
}

export async function deleteInvoice(id: string) {
  await updateStore((doc) => {
    doc.invoices = doc.invoices.filter((invoice) => invoice.id !== id);
    doc.items = doc.items.filter((item) => item.invoiceId !== id);
  });
}

export async function setInvoicePayment(id: string, paidDate: string | null) {
  await updateStore((doc) => {
    const invoice = doc.invoices.find((row) => row.id === id);
    if (!invoice) return;
    invoice.status = paidDate ? "paid" : "issued";
    invoice.paidDate = paidDate;
    invoice.updatedAt = new Date().toISOString();
  });
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus, paidDate?: string | null) {
  await updateStore((doc) => {
    const invoice = doc.invoices.find((row) => row.id === id);
    if (!invoice) return;
    invoice.status = status;
    if (status === "paid") {
      invoice.paidDate = paidDate || invoice.paidDate || new Date().toISOString().slice(0, 10);
    } else if (status === "issued" || status === "cancelled" || status === "draft") {
      invoice.paidDate = null;
    } else if (paidDate !== undefined) {
      invoice.paidDate = paidDate;
    }
    invoice.updatedAt = new Date().toISOString();
  });
}

export type CompanySecrets = {
  clientId: string;
  clientSecret: string;
};

export async function readCompanySecrets(): Promise<CompanySecrets> {
  const doc = await loadStore();
  return { clientId: doc.company.idokladClientId, clientSecret: doc.company.idokladClientSecret };
}

export async function saveCompany(input: SupplierDraft & { clientId: string; clientSecret: string | null; clearSecret: boolean }) {
  await updateStore((doc) => {
    const secret = input.clearSecret ? "" : input.clientSecret?.trim() || doc.company.idokladClientSecret;
    const clientId = input.clearSecret ? "" : input.clientId.trim() || doc.company.idokladClientId;
    doc.company.name = input.name.trim();
    doc.company.ico = input.ico.trim();
    doc.company.dic = input.dic.trim();
    doc.company.street = input.street.trim();
    doc.company.city = input.city.trim();
    doc.company.zip = input.zip.trim();
    doc.company.country = input.country.trim() || "Česká republika";
    doc.company.email = input.email.trim();
    doc.company.phone = input.phone.trim();
    doc.company.bankAccount = input.bankAccount.trim();
    doc.company.bankCode = input.bankCode.trim();
    doc.company.iban = input.iban.trim();
    doc.company.swift = input.swift.trim();
    doc.company.idokladClientId = clientId;
    doc.company.idokladClientSecret = secret;
  });
}

export async function readCompanyPublic() {
  const doc = await loadStore();
  const { idokladClientSecret: _secret, ...company } = doc.company;
  return {
    ...company,
    hasIdokladSecret: Boolean(_secret),
  };
}

export async function listCustomerRows(query: string): Promise<Customer[]> {
  const doc = await loadStore();
  const rows = [...doc.customers].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  if (!query.trim()) return rows;
  const needle = query.trim().toLowerCase();
  return rows.filter((customer) =>
    [customer.name, customer.ico, customer.dic, customer.email].join(" ").toLowerCase().includes(needle),
  );
}

export async function listInvoiceRows(filter: {
  query?: string;
  status?: string;
  kind?: string;
  customerId?: string;
  from?: string;
  to?: string;
}): Promise<Invoice[]> {
  const doc = await loadStore();
  let rows = [...doc.invoices];
  if (filter.kind && filter.kind !== "all") rows = rows.filter((invoice) => invoice.kind === filter.kind);
  if (filter.customerId) rows = rows.filter((invoice) => invoice.customerId === filter.customerId);
  if (filter.from) rows = rows.filter((invoice) => invoice.issueDate >= filter.from!);
  if (filter.to) rows = rows.filter((invoice) => invoice.issueDate <= filter.to!);
  if (filter.query?.trim()) {
    const needle = filter.query.trim().toLowerCase();
    rows = rows.filter((invoice) =>
      [invoice.number, invoice.variableSymbol, invoice.customerName, invoice.customerIco, invoice.description]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  rows.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  return rows.map((invoice) => ({ ...invoice, items: [] }));
}

export async function listInvoiceYears(): Promise<string[]> {
  const doc = await loadStore();
  const years = new Set<string>();
  for (const invoice of doc.invoices) {
    if (/^\d{4}/.test(invoice.issueDate)) years.add(invoice.issueDate.slice(0, 4));
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

export async function listInvoiceNumbers(): Promise<string[]> {
  const doc = await loadStore();
  return doc.invoices.map((invoice) => invoice.number);
}

export async function dashboardRows() {
  const doc = await loadStore();
  return {
    invoices: doc.invoices.map((invoice) => ({ ...invoice, items: [] })),
    customerCount: doc.customers.length,
  };
}
