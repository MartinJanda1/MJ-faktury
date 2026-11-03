import { randomUUID } from "node:crypto";
import { fillBlankCustomerAddress } from "./customer-address";
import { normalizeIco } from "./ico";
import { withInvoiceDefaults } from "./invoice-fields";
import { lineTotals, roundMoney } from "./money";
import {
  emptyCompany,
  emptyTenant,
  loadStore,
  publicCompany,
  updateStore,
  type StoreDocument,
  type Tenant,
} from "./store";
import { getTenantIdFromCookie, requireTenantId } from "./tenant-session";
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

async function withActiveTenant<T>(mutator: (tenant: Tenant, doc: StoreDocument) => T | Promise<T>): Promise<T> {
  const tenantId = await requireTenantId();
  return updateStore(async (doc) => {
    const tenant = doc.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error("Firma není přihlášená.");
    return mutator(tenant, doc);
  });
}

/** Reads tolerate missing session (locked UI still renders RSC children). */
async function tryLoadActiveTenant(): Promise<Tenant | null> {
  const tenantId = await getTenantIdFromCookie();
  if (!tenantId) return null;
  const doc = await loadStore();
  return doc.tenants.find((row) => row.id === tenantId) ?? null;
}

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

function findCustomer(tenant: Tenant, draft: CustomerDraft): Customer | undefined {
  if (draft.externalId) {
    const byExternal = tenant.customers.find((customer) => customer.externalId === draft.externalId);
    if (byExternal) return byExternal;
  }
  if (draft.ico) {
    const byIco = tenant.customers.find((customer) => customer.ico === draft.ico);
    if (byIco) return byIco;
  }
  return tenant.customers.find((customer) => customer.name.toLowerCase() === draft.name.toLowerCase());
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

function findCustomerId(tenant: Tenant, draft: InvoiceDraft): string | null {
  if (draft.customerExternalId) {
    const match = tenant.customers.find((customer) => customer.externalId === draft.customerExternalId);
    if (match) return match.id;
  }
  if (draft.customerIco) {
    const match = tenant.customers.find((customer) => customer.ico === draft.customerIco);
    if (match) return match.id;
  }
  if (draft.customerName) {
    const match = tenant.customers.find((customer) => customer.name.toLowerCase() === draft.customerName.toLowerCase());
    if (match) return match.id;
  }
  return null;
}

function upsertCustomerInDoc(tenant: Tenant, draft: CustomerDraft): { id: string; created: boolean } {
  const customer = blankCustomer(draft);
  if (!customer.name) throw new Error("Odběratel nemá název.");
  const now = new Date().toISOString();
  const existing = findCustomer(tenant, customer);
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
  tenant.customers.push({
    id,
    ...customer,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

function upsertInvoiceInDoc(
  tenant: Tenant,
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
  let customerId = linkedCustomerId || findCustomerId(tenant, draft);
  if (!customerId && draft.customerName.trim()) {
    customerId = upsertCustomerInDoc(tenant, {
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
    (preferredId ? tenant.invoices.find((invoice) => invoice.id === preferredId) : undefined) ||
    (draft.externalId ? tenant.invoices.find((invoice) => invoice.externalId === draft.externalId) : undefined) ||
    tenant.invoices.find((invoice) => invoice.number === number && invoice.kind === draft.kind);

  if (preferredId && !tenant.invoices.some((invoice) => invoice.id === preferredId)) {
    throw new Error("Doklad už v evidenci není.");
  }
  if (preferredId) {
    const clash = tenant.invoices.find(
      (invoice) => invoice.number === number && invoice.kind === draft.kind && invoice.id !== preferredId,
    );
    if (clash) throw new Error(`Doklad ${number} už existuje.`);
  }

  const linkedCustomer = customerId ? tenant.customers.find((customer) => customer.id === customerId) : undefined;
  const buyer = fillBlankCustomerAddress(
    {
      customerStreet: draft.customerStreet,
      customerCity: draft.customerCity,
      customerZip: draft.customerZip,
      customerCountry: draft.customerCountry,
    },
    linkedCustomer,
  );

  const defaults = withInvoiceDefaults(draft);
  const header = {
    externalId: draft.externalId ?? existing?.externalId ?? null,
    source: draft.source,
    kind: draft.kind,
    number,
    variableSymbol: draft.variableSymbol.trim(),
    constantSymbol: draft.constantSymbol.trim(),
    specificSymbol: draft.specificSymbol.trim(),
    paymentMethod: defaults.paymentMethod,
    orderNumber: defaults.orderNumber,
    layout: defaults.layout,
    customerId,
    customerName: draft.customerName.trim(),
    customerIco: draft.customerIco.trim(),
    customerDic: draft.customerDic.trim(),
    customerStreet: buyer.customerStreet.trim(),
    customerCity: buyer.customerCity.trim(),
    customerZip: buyer.customerZip.trim(),
    customerCountry: buyer.customerCountry.trim(),
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
    tenant.invoices.push({
      id,
      ...header,
      createdAt: now,
    });
  }

  tenant.items = tenant.items.filter((item) => item.invoiceId !== id);
  for (const item of items) {
    tenant.items.push({
      id: randomUUID(),
      invoiceId: id!,
      ...item,
    });
  }
  return { id: id!, created };
}

function fillBlank(current: string | undefined, next: string | undefined): string {
  const existing = (current ?? "").trim();
  if (existing) return existing;
  return (next ?? "").trim();
}

function fillCompanyIfEmptyInDoc(tenant: Tenant, supplier: SupplierDraft) {
  const company = tenant.company;
  if (!company.name.trim()) {
    company.name = supplier.name.trim();
    company.ico = fillBlank(company.ico, supplier.ico);
    company.dic = fillBlank(company.dic, supplier.dic);
    company.street = fillBlank(company.street, supplier.street);
    company.city = fillBlank(company.city, supplier.city);
    company.zip = fillBlank(company.zip, supplier.zip);
    company.country = fillBlank(company.country, supplier.country) || "Česká republika";
    company.email = fillBlank(company.email, supplier.email);
    company.phone = fillBlank(company.phone, supplier.phone);
  }
  company.vatNote = fillBlank(company.vatNote, supplier.vatNote);
  company.bankAccount = fillBlank(company.bankAccount, supplier.bankAccount);
  company.bankCode = fillBlank(company.bankCode, supplier.bankCode);
  company.iban = fillBlank(company.iban, supplier.iban);
  company.swift = fillBlank(company.swift, supplier.swift);
  if (company.footerNote == null) company.footerNote = "";
}

export async function findTenantByIco(ico: string): Promise<Tenant | null> {
  const normalized = normalizeIco(ico);
  if (!normalized) return null;
  const doc = await loadStore();
  return doc.tenants.find((tenant) => normalizeIco(tenant.company.ico) === normalized) ?? null;
}

export async function readAccessStatus(): Promise<{ registered: boolean }> {
  const doc = await loadStore();
  return {
    registered: doc.tenants.some((tenant) => Boolean(tenant.company.accessPasswordHash)),
  };
}

export async function resumeTenantSession(
  tenantId: string,
  ico: string,
): Promise<{ tenantId: string; ico: string; companyName: string } | null> {
  const doc = await loadStore();
  const tenant = doc.tenants.find((row) => row.id === tenantId);
  if (!tenant?.company.accessPasswordHash) return null;
  const storedIco = normalizeIco(tenant.company.ico);
  if (!storedIco || storedIco !== normalizeIco(ico)) return null;
  return { tenantId: tenant.id, ico: storedIco, companyName: tenant.company.name.trim() };
}

export async function upsertCustomer(draft: CustomerDraft): Promise<{ id: string; created: boolean }> {
  return withActiveTenant((tenant) => upsertCustomerInDoc(tenant, draft));
}

export async function saveManualCustomer(id: string | null, draft: CustomerDraft): Promise<string> {
  return withActiveTenant((tenant) => {
    const customer = blankCustomer({ ...draft, source: "manual", externalId: null });
    if (!customer.name) throw new Error("Odběratel nemá název.");
    const now = new Date().toISOString();
    if (id) {
      const existing = tenant.customers.find((row) => row.id === id);
      if (!existing) throw new Error("Odběratel už v evidenci není.");
      Object.assign(existing, customer, {
        id,
        updatedAt: now,
        createdAt: existing.createdAt,
        externalId: existing.externalId,
        source: existing.source === "manual" ? "manual" : existing.source,
      });
      return id;
    }
    return upsertCustomerInDoc(tenant, customer).id;
  });
}

export async function upsertInvoice(
  draft: InvoiceDraft,
  preferredId?: string | null,
  linkedCustomerId?: string | null,
): Promise<{ id: string; created: boolean }> {
  return withActiveTenant((tenant) => upsertInvoiceInDoc(tenant, draft, preferredId, linkedCustomerId));
}

export async function applyImport(
  customers: CustomerDraft[],
  invoices: InvoiceDraft[],
  supplier: SupplierDraft | null,
): Promise<ImportCounts> {
  return withActiveTenant((tenant) => {
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
      const result = upsertCustomerInDoc(tenant, customer);
      if (result.created) counts.customersCreated += 1;
      else counts.customersUpdated += 1;
    }
    for (const invoice of invoices) {
      if (!invoice.number.trim()) {
        counts.warnings.push("Doklad bez čísla byl přeskočen.");
        continue;
      }
      try {
        const result = upsertInvoiceInDoc(tenant, invoice);
        if (result.created) counts.invoicesCreated += 1;
        else counts.invoicesUpdated += 1;
      } catch (error) {
        counts.warnings.push(error instanceof Error ? error.message : "Doklad se nepodařilo uložit.");
      }
    }
    if (
      supplier &&
      (supplier.name.trim() || supplier.bankAccount.trim() || supplier.iban.trim() || supplier.vatNote.trim())
    ) {
      fillCompanyIfEmptyInDoc(tenant, supplier);
    }
    return counts;
  });
}

export async function loadItems(invoiceId: string): Promise<InvoiceItem[]> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  return tenant.items.filter((item) => item.invoiceId === invoiceId).sort((a, b) => a.position - b.position);
}

export async function getCustomerRow(id: string): Promise<Customer | null> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return null;
  return tenant.customers.find((customer) => customer.id === id) ?? null;
}

export async function getInvoiceRow(id: string): Promise<Invoice | null> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return null;
  const invoice = tenant.invoices.find((row) => row.id === id);
  if (!invoice) return null;
  const linkedCustomer = invoice.customerId
    ? tenant.customers.find((customer) => customer.id === invoice.customerId)
    : undefined;
  const withAddress = fillBlankCustomerAddress(withInvoiceDefaults(invoice), linkedCustomer);
  return {
    ...withAddress,
    items: tenant.items.filter((item) => item.invoiceId === id).sort((a, b) => a.position - b.position),
  };
}

export async function deleteCustomer(id: string) {
  await withActiveTenant((tenant) => {
    tenant.customers = tenant.customers.filter((customer) => customer.id !== id);
    for (const invoice of tenant.invoices) {
      if (invoice.customerId === id) invoice.customerId = null;
    }
  });
}

export async function deleteInvoice(id: string) {
  await withActiveTenant((tenant) => {
    tenant.invoices = tenant.invoices.filter((invoice) => invoice.id !== id);
    tenant.items = tenant.items.filter((item) => item.invoiceId !== id);
  });
}

export async function setInvoicePayment(id: string, paidDate: string | null) {
  await withActiveTenant((tenant) => {
    const invoice = tenant.invoices.find((row) => row.id === id);
    if (!invoice) return;
    invoice.status = paidDate ? "paid" : "issued";
    invoice.paidDate = paidDate;
    invoice.updatedAt = new Date().toISOString();
  });
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus, paidDate?: string | null) {
  await withActiveTenant((tenant) => {
    const invoice = tenant.invoices.find((row) => row.id === id);
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
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return { clientId: "", clientSecret: "" };
  return { clientId: tenant.company.idokladClientId, clientSecret: tenant.company.idokladClientSecret };
}

export async function saveCompany(
  input: SupplierDraft & { footerNote: string; clientId: string; clientSecret: string | null; clearSecret: boolean },
) {
  await withActiveTenant((tenant) => {
    const secret = input.clearSecret ? "" : input.clientSecret?.trim() || tenant.company.idokladClientSecret;
    const clientId = input.clearSecret ? "" : input.clientId.trim() || tenant.company.idokladClientId;
    tenant.company.name = input.name.trim();
    tenant.company.ico = input.ico.trim();
    tenant.company.dic = input.dic.trim();
    tenant.company.street = input.street.trim();
    tenant.company.city = input.city.trim();
    tenant.company.zip = input.zip.trim();
    tenant.company.country = input.country.trim() || "Česká republika";
    tenant.company.email = input.email.trim();
    tenant.company.phone = input.phone.trim();
    tenant.company.vatNote = input.vatNote.trim();
    tenant.company.bankAccount = input.bankAccount.trim();
    tenant.company.bankCode = input.bankCode.trim();
    tenant.company.iban = input.iban.trim();
    tenant.company.swift = input.swift.trim();
    tenant.company.footerNote = input.footerNote.trim();
    tenant.company.idokladClientId = clientId;
    tenant.company.idokladClientSecret = secret;
  });
}

export async function setCompanyVatNote(vatNote: string) {
  await withActiveTenant((tenant) => {
    tenant.company.vatNote = vatNote.trim();
  });
}

export async function readCompanyPublic() {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return publicCompany(emptyCompany());
  return publicCompany(tenant.company);
}

type AresCompanyParty = {
  name: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  vatNote: string;
};

function applyAresPartyToCompany(
  tenant: Tenant,
  ico: string,
  party: AresCompanyParty,
  opts?: { passwordHash?: string; overwriteIdentity?: boolean },
) {
  tenant.company.ico = ico;
  if (opts?.passwordHash) tenant.company.accessPasswordHash = opts.passwordHash;
  const write = opts?.overwriteIdentity
    ? (current: string, next: string) => next.trim() || current
    : fillBlank;
  tenant.company.name = write(tenant.company.name, party.name);
  tenant.company.dic = write(tenant.company.dic, party.dic);
  tenant.company.street = write(tenant.company.street, party.street);
  tenant.company.city = write(tenant.company.city, party.city);
  tenant.company.zip = write(tenant.company.zip, party.zip);
  tenant.company.country = write(tenant.company.country, party.country) || "Česká republika";
  tenant.company.vatNote = write(tenant.company.vatNote, party.vatNote);
}

/** Register a new firm (tenant). Fails if IČO already has a password. */
export async function registerCompanyAccess(
  ico: string,
  passwordHash: string,
  party: AresCompanyParty,
): Promise<{ tenantId: string; ico: string; companyName: string }> {
  const normalized = normalizeIco(ico);
  if (!normalized) throw new Error("Zadejte platné IČO (8 číslic).");

  return updateStore((doc) => {
    const existing = doc.tenants.find((tenant) => normalizeIco(tenant.company.ico) === normalized);
    if (existing?.company.accessPasswordHash) {
      throw new Error("Firma s tímto IČO už je registrována. Přihlaste se.");
    }
    const tenant = existing ?? emptyTenant();
    applyAresPartyToCompany(tenant, normalized, party, { passwordHash, overwriteIdentity: true });
    if (!existing) doc.tenants.push(tenant);
    return { tenantId: tenant.id, ico: normalized, companyName: tenant.company.name.trim() };
  });
}

export async function syncCompanyIcoFromAres(ico: string, party: AresCompanyParty, icoChanged: boolean) {
  await withActiveTenant((tenant) => {
    applyAresPartyToCompany(tenant, ico, party, { overwriteIdentity: icoChanged });
  });
}

export async function setAccessPasswordHash(passwordHash: string) {
  await withActiveTenant((tenant) => {
    tenant.company.accessPasswordHash = passwordHash;
  });
}

export async function readAccessPasswordHash(): Promise<string> {
  const tenant = await tryLoadActiveTenant();
  return tenant?.company.accessPasswordHash || "";
}

export async function listCustomerRows(query: string): Promise<Customer[]> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  const rows = [...tenant.customers].sort((a, b) => a.name.localeCompare(b.name, "cs"));
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
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  let rows = [...tenant.invoices];
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
  return rows.map((invoice) => ({ ...withInvoiceDefaults(invoice), items: [] }));
}

export async function listCustomerOptionsForInvoices(): Promise<Array<{ id: string; name: string }>> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  const used = new Set(tenant.invoices.map((invoice) => invoice.customerId).filter(Boolean));
  return tenant.customers
    .filter((customer) => used.has(customer.id))
    .map((customer) => ({ id: customer.id, name: customer.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
}

export async function listInvoiceYears(): Promise<string[]> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  const years = new Set<string>();
  for (const invoice of tenant.invoices) {
    if (/^\d{4}/.test(invoice.issueDate)) years.add(invoice.issueDate.slice(0, 4));
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

export async function listInvoiceNumbers(): Promise<string[]> {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  return tenant.invoices.map((invoice) => invoice.number);
}

export async function dashboardRows() {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return { invoices: [], customerCount: 0 };
  return {
    invoices: tenant.invoices.map((invoice) => ({ ...withInvoiceDefaults(invoice), items: [] })),
    customerCount: tenant.customers.length,
  };
}

export async function listInvoicesForStats() {
  const tenant = await tryLoadActiveTenant();
  if (!tenant) return [];
  return tenant.invoices
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      issueDate: invoice.issueDate,
      status: invoice.status,
      paidDate: invoice.paidDate,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerIco: invoice.customerIco,
      customerDic: invoice.customerDic,
      totalGross: invoice.totalGross,
      currency: invoice.currency,
      items: tenant.items
        .filter((item) => item.invoiceId === invoice.id)
        .map((item) => ({
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
    }))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
}

/** Seed an empty tenant for tests / scripts; sets FAKTURA_TENANT_ID. */
export async function createEmptyTenantForTests(): Promise<string> {
  const tenant = emptyTenant();
  await updateStore((doc) => {
    doc.tenants.push(tenant);
  });
  process.env.FAKTURA_TENANT_ID = tenant.id;
  return tenant.id;
}
