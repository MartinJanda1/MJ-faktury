import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { lineTotals, roundMoney } from "./money";
import type {
  Customer,
  CustomerDraft,
  ImportCounts,
  Invoice,
  InvoiceDraft,
  InvoiceItem,
  ItemDraft,
  SupplierDraft,
} from "./types";

type CustomerRow = {
  id: string;
  external_id: string | null;
  source: Customer["source"];
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  note: string;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  external_id: string | null;
  source: Invoice["source"];
  kind: Invoice["kind"];
  number: string;
  variable_symbol: string;
  constant_symbol: string;
  specific_symbol: string;
  customer_id: string | null;
  customer_name: string;
  customer_ico: string;
  customer_dic: string;
  customer_street: string;
  customer_city: string;
  customer_zip: string;
  customer_country: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  tax_date: string;
  paid_date: string | null;
  currency: string;
  status: Invoice["status"];
  description: string;
  note: string;
  total_net: number;
  total_vat: number;
  total_gross: number;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  invoice_id: string;
  position: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  total_net: number;
  total_vat: number;
  total_gross: number;
};

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    name: row.name,
    ico: row.ico,
    dic: row.dic,
    street: row.street,
    city: row.city,
    zip: row.zip,
    country: row.country,
    email: row.email,
    phone: row.phone,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInvoice(row: InvoiceRow, items: InvoiceItem[] = []): Invoice {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    kind: row.kind,
    number: row.number,
    variableSymbol: row.variable_symbol,
    constantSymbol: row.constant_symbol,
    specificSymbol: row.specific_symbol,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerIco: row.customer_ico,
    customerDic: row.customer_dic,
    customerStreet: row.customer_street,
    customerCity: row.customer_city,
    customerZip: row.customer_zip,
    customerCountry: row.customer_country,
    customerEmail: row.customer_email,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    taxDate: row.tax_date,
    paidDate: row.paid_date,
    currency: row.currency,
    status: row.status,
    description: row.description,
    note: row.note,
    totalNet: row.total_net,
    totalVat: row.total_vat,
    totalGross: row.total_gross,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function mapItem(row: ItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    position: row.position,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    vatRate: row.vat_rate,
    totalNet: row.total_net,
    totalVat: row.total_vat,
    totalGross: row.total_gross,
  };
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

export function upsertCustomer(draft: CustomerDraft): { id: string; created: boolean } {
  const db = getDb();
  const customer = blankCustomer(draft);
  if (!customer.name) throw new Error("Odběratel nemá název.");
  const now = new Date().toISOString();

  let existing: { id: string; note: string } | undefined;
  if (customer.externalId) {
    existing = db.prepare(`SELECT id, note FROM customers WHERE external_id = ?`).get(customer.externalId) as
      | { id: string; note: string }
      | undefined;
  }
  if (!existing && customer.ico) {
    existing = db.prepare(`SELECT id, note FROM customers WHERE ico = ? ORDER BY updated_at DESC`).get(customer.ico) as
      | { id: string; note: string }
      | undefined;
  }
  if (!existing) {
    existing = db
      .prepare(`SELECT id, note FROM customers WHERE lower(name) = lower(?) ORDER BY updated_at DESC`)
      .get(customer.name) as { id: string; note: string } | undefined;
  }

  if (existing) {
    db.prepare(
      `UPDATE customers SET
        external_id = COALESCE(?, external_id),
        source = ?,
        name = ?, ico = ?, dic = ?, street = ?, city = ?, zip = ?, country = ?,
        email = ?, phone = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    ).run(
      customer.externalId,
      customer.source,
      customer.name,
      customer.ico,
      customer.dic,
      customer.street,
      customer.city,
      customer.zip,
      customer.country,
      customer.email,
      customer.phone,
      customer.note || existing.note,
      now,
      existing.id,
    );
    return { id: existing.id, created: false };
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO customers (
      id, external_id, source, name, ico, dic, street, city, zip, country, email, phone, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    customer.externalId,
    customer.source,
    customer.name,
    customer.ico,
    customer.dic,
    customer.street,
    customer.city,
    customer.zip,
    customer.country,
    customer.email,
    customer.phone,
    customer.note,
    now,
    now,
  );
  return { id, created: true };
}

function resolvedItems(items: ItemDraft[]) {
  return items.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const vatRate = Number(item.vatRate) || 0;
    const hasImportedTotals =
      item.totalNet != null && item.totalVat != null && item.totalGross != null;
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

function findCustomerId(draft: InvoiceDraft): string | null {
  const db = getDb();
  if (draft.customerExternalId) {
    const row = db.prepare(`SELECT id FROM customers WHERE external_id = ?`).get(draft.customerExternalId) as
      | { id: string }
      | undefined;
    if (row) return row.id;
  }
  if (draft.customerIco) {
    const row = db.prepare(`SELECT id FROM customers WHERE ico = ? ORDER BY updated_at DESC`).get(draft.customerIco) as
      | { id: string }
      | undefined;
    if (row) return row.id;
  }
  if (draft.customerName) {
    const row = db
      .prepare(`SELECT id FROM customers WHERE lower(name) = lower(?) ORDER BY updated_at DESC`)
      .get(draft.customerName) as { id: string } | undefined;
    if (row) return row.id;
  }
  return null;
}

export function saveManualCustomer(id: string | null, draft: CustomerDraft): string {
  const customer = blankCustomer({ ...draft, source: "manual", externalId: null });
  if (!customer.name) throw new Error("Odběratel nemá název.");
  const db = getDb();
  const now = new Date().toISOString();
  if (id) {
    const existing = db.prepare(`SELECT id FROM customers WHERE id = ?`).get(id) as { id: string } | undefined;
    if (!existing) throw new Error("Odběratel už v evidenci není.");
    db.prepare(
      `UPDATE customers SET
        name = ?, ico = ?, dic = ?, street = ?, city = ?, zip = ?, country = ?,
        email = ?, phone = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    ).run(
      customer.name,
      customer.ico,
      customer.dic,
      customer.street,
      customer.city,
      customer.zip,
      customer.country,
      customer.email,
      customer.phone,
      customer.note,
      now,
      id,
    );
    return id;
  }
  return upsertCustomer(customer).id;
}

export function upsertInvoice(
  draft: InvoiceDraft,
  preferredId?: string | null,
  linkedCustomerId?: string | null,
): { id: string; created: boolean } {
  const db = getDb();
  const number = draft.number.trim();
  if (!number) throw new Error("Doklad nemá číslo.");
  const items = resolvedItems(draft.items.length > 0 ? draft.items : []);
  if (items.length === 0) throw new Error(`Doklad ${number} nemá žádnou položku.`);
  const totalNet = roundMoney(items.reduce((sum, item) => sum + item.totalNet, 0));
  const totalVat = roundMoney(items.reduce((sum, item) => sum + item.totalVat, 0));
  const totalGross = roundMoney(items.reduce((sum, item) => sum + item.totalGross, 0));
  const now = new Date().toISOString();
  let customerId = linkedCustomerId || findCustomerId(draft);
  if (!customerId && draft.customerName.trim()) {
    customerId = upsertCustomer({
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

  let existingId: string | undefined;
  if (preferredId) {
    const row = db.prepare(`SELECT id FROM invoices WHERE id = ?`).get(preferredId) as { id: string } | undefined;
    if (!row) throw new Error("Doklad už v evidenci není.");
    const clash = db
      .prepare(`SELECT id FROM invoices WHERE number = ? AND kind = ? AND id != ?`)
      .get(number, draft.kind, preferredId) as { id: string } | undefined;
    if (clash) throw new Error(`Doklad ${number} už existuje.`);
    existingId = preferredId;
  } else if (draft.externalId) {
    const row = db.prepare(`SELECT id FROM invoices WHERE external_id = ?`).get(draft.externalId) as
      | { id: string }
      | undefined;
    existingId = row?.id;
  }
  if (!existingId) {
    const row = db.prepare(`SELECT id, external_id FROM invoices WHERE number = ? AND kind = ?`).get(number, draft.kind) as
      | { id: string; external_id: string | null }
      | undefined;
    if (row && (!row.external_id || !draft.externalId || row.external_id === draft.externalId)) {
      existingId = row.id;
    }
  }

  const values = [
    draft.externalId,
    draft.source,
    draft.kind,
    number,
    draft.variableSymbol.trim(),
    draft.constantSymbol.trim(),
    draft.specificSymbol.trim(),
    customerId,
    draft.customerName.trim(),
    draft.customerIco.trim(),
    draft.customerDic.trim(),
    draft.customerStreet.trim(),
    draft.customerCity.trim(),
    draft.customerZip.trim(),
    draft.customerCountry.trim(),
    draft.customerEmail.trim(),
    draft.issueDate,
    draft.dueDate,
    draft.taxDate,
    draft.paidDate,
    draft.currency || "CZK",
    draft.status,
    draft.description.trim(),
    draft.note.trim(),
    totalNet,
    totalVat,
    totalGross,
    now,
  ] as const;

  let id = existingId;
  let created = false;
  if (id) {
    db.prepare(
      `UPDATE invoices SET
        external_id = COALESCE(?, external_id),
        source = ?, kind = ?, number = ?, variable_symbol = ?, constant_symbol = ?, specific_symbol = ?,
        customer_id = ?, customer_name = ?, customer_ico = ?, customer_dic = ?, customer_street = ?,
        customer_city = ?, customer_zip = ?, customer_country = ?, customer_email = ?,
        issue_date = ?, due_date = ?, tax_date = ?, paid_date = ?, currency = ?, status = ?,
        description = ?, note = ?, total_net = ?, total_vat = ?, total_gross = ?, updated_at = ?
      WHERE id = ?`,
    ).run(...values, id);
    db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(id);
  } else {
    id = randomUUID();
    created = true;
    db.prepare(
      `INSERT INTO invoices (
        id, external_id, source, kind, number, variable_symbol, constant_symbol, specific_symbol,
        customer_id, customer_name, customer_ico, customer_dic, customer_street, customer_city,
        customer_zip, customer_country, customer_email, issue_date, due_date, tax_date, paid_date,
        currency, status, description, note, total_net, total_vat, total_gross, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, ...values.slice(0, -1), now, now);
  }

  const insertItem = db.prepare(
    `INSERT INTO invoice_items (
      id, invoice_id, position, name, quantity, unit, unit_price, vat_rate, total_net, total_vat, total_gross
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of items) {
    insertItem.run(
      randomUUID(),
      id,
      item.position,
      item.name,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.vatRate,
      item.totalNet,
      item.totalVat,
      item.totalGross,
    );
  }
  return { id, created };
}

export function applyImport(customers: CustomerDraft[], invoices: InvoiceDraft[], supplier: SupplierDraft | null): ImportCounts {
  const db = getDb();
  const counts: ImportCounts = {
    customersCreated: 0,
    customersUpdated: 0,
    invoicesCreated: 0,
    invoicesUpdated: 0,
    warnings: [],
  };
  const run = db.transaction(() => {
    for (const customer of customers) {
      if (!customer.name.trim()) {
        counts.warnings.push("Kontakt bez názvu byl přeskočen.");
        continue;
      }
      const result = upsertCustomer(customer);
      if (result.created) counts.customersCreated += 1;
      else counts.customersUpdated += 1;
    }
    for (const invoice of invoices) {
      if (!invoice.number.trim()) {
        counts.warnings.push("Doklad bez čísla byl přeskočen.");
        continue;
      }
      try {
        const result = upsertInvoice(invoice);
        if (result.created) counts.invoicesCreated += 1;
        else counts.invoicesUpdated += 1;
      } catch (error) {
        counts.warnings.push(error instanceof Error ? error.message : "Doklad se nepodařilo uložit.");
      }
    }
    if (supplier?.name.trim()) fillCompanyIfEmpty(supplier);
  });
  run();
  return counts;
}

export function fillCompanyIfEmpty(supplier: SupplierDraft) {
  const db = getDb();
  const current = db.prepare(`SELECT name FROM company WHERE id = 1`).get() as { name: string };
  if (current.name.trim()) return;
  db.prepare(
    `UPDATE company SET
      name = ?, ico = ?, dic = ?, street = ?, city = ?, zip = ?, country = ?,
      email = ?, phone = ?, bank_account = ?, bank_code = ?, iban = ?, swift = ?, updated_at = ?
    WHERE id = 1`,
  ).run(
    supplier.name.trim(),
    supplier.ico.trim(),
    supplier.dic.trim(),
    supplier.street.trim(),
    supplier.city.trim(),
    supplier.zip.trim(),
    supplier.country.trim() || "Česká republika",
    supplier.email.trim(),
    supplier.phone.trim(),
    supplier.bankAccount.trim(),
    supplier.bankCode.trim(),
    supplier.iban.trim(),
    supplier.swift.trim(),
    new Date().toISOString(),
  );
}

export function loadItems(invoiceId: string): InvoiceItem[] {
  const rows = getDb()
    .prepare(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position`)
    .all(invoiceId) as ItemRow[];
  return rows.map(mapItem);
}

export function getCustomerRow(id: string): Customer | null {
  const row = getDb().prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as CustomerRow | undefined;
  return row ? mapCustomer(row) : null;
}

export function getInvoiceRow(id: string): Invoice | null {
  const row = getDb().prepare(`SELECT * FROM invoices WHERE id = ?`).get(id) as InvoiceRow | undefined;
  if (!row) return null;
  return mapInvoice(row, loadItems(id));
}

export function deleteCustomer(id: string) {
  getDb().prepare(`DELETE FROM customers WHERE id = ?`).run(id);
}

export function deleteInvoice(id: string) {
  getDb().prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
}

export function setInvoicePayment(id: string, paidDate: string | null) {
  const status = paidDate ? "paid" : "issued";
  getDb()
    .prepare(`UPDATE invoices SET status = ?, paid_date = ?, updated_at = ? WHERE id = ?`)
    .run(status, paidDate, new Date().toISOString(), id);
}

export type CompanySecrets = {
  clientId: string;
  clientSecret: string;
};

export function readCompanySecrets(): CompanySecrets {
  const row = getDb().prepare(`SELECT idoklad_client_id, idoklad_client_secret FROM company WHERE id = 1`).get() as {
    idoklad_client_id: string;
    idoklad_client_secret: string;
  };
  return { clientId: row.idoklad_client_id, clientSecret: row.idoklad_client_secret };
}

export function saveCompany(input: SupplierDraft & { clientId: string; clientSecret: string | null; clearSecret: boolean }) {
  const db = getDb();
  const current = readCompanySecrets();
  const secret = input.clearSecret ? "" : input.clientSecret?.trim() || current.clientSecret;
  const clientId = input.clearSecret ? "" : input.clientId.trim() || current.clientId;
  db.prepare(
    `UPDATE company SET
      name = ?, ico = ?, dic = ?, street = ?, city = ?, zip = ?, country = ?,
      email = ?, phone = ?, bank_account = ?, bank_code = ?, iban = ?, swift = ?,
      idoklad_client_id = ?, idoklad_client_secret = ?, updated_at = ?
    WHERE id = 1`,
  ).run(
    input.name.trim(),
    input.ico.trim(),
    input.dic.trim(),
    input.street.trim(),
    input.city.trim(),
    input.zip.trim(),
    input.country.trim() || "Česká republika",
    input.email.trim(),
    input.phone.trim(),
    input.bankAccount.trim(),
    input.bankCode.trim(),
    input.iban.trim(),
    input.swift.trim(),
    clientId,
    secret,
    new Date().toISOString(),
  );
}

export function readCompanyPublic() {
  const row = getDb().prepare(`SELECT * FROM company WHERE id = 1`).get() as {
    name: string;
    ico: string;
    dic: string;
    street: string;
    city: string;
    zip: string;
    country: string;
    email: string;
    phone: string;
    bank_account: string;
    bank_code: string;
    iban: string;
    swift: string;
    idoklad_client_id: string;
    idoklad_client_secret: string;
  };
  return {
    name: row.name,
    ico: row.ico,
    dic: row.dic,
    street: row.street,
    city: row.city,
    zip: row.zip,
    country: row.country,
    email: row.email,
    phone: row.phone,
    bankAccount: row.bank_account,
    bankCode: row.bank_code,
    iban: row.iban,
    swift: row.swift,
    idokladClientId: row.idoklad_client_id,
    hasIdokladSecret: row.idoklad_client_secret.length > 0,
  };
}

export function listCustomerRows(query: string): Customer[] {
  const db = getDb();
  if (!query.trim()) {
    return (db.prepare(`SELECT * FROM customers ORDER BY name COLLATE NOCASE`).all() as CustomerRow[]).map(mapCustomer);
  }
  const like = `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`;
  return (
    db
      .prepare(
        `SELECT * FROM customers
         WHERE name LIKE ? ESCAPE '\\' OR ico LIKE ? ESCAPE '\\' OR dic LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
         ORDER BY name COLLATE NOCASE`,
      )
      .all(like, like, like, like) as CustomerRow[]
  ).map(mapCustomer);
}

export function listInvoiceRows(filter: { query?: string; status?: string; kind?: string; customerId?: string }): Invoice[] {
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (filter.kind && filter.kind !== "all") {
    where.push(`kind = ?`);
    params.push(filter.kind);
  }
  if (filter.customerId) {
    where.push(`customer_id = ?`);
    params.push(filter.customerId);
  }
  if (filter.query?.trim()) {
    const like = `%${filter.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where.push(
      `(number LIKE ? ESCAPE '\\' OR variable_symbol LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\' OR customer_ico LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like);
  }
  const sql = `SELECT * FROM invoices ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY issue_date DESC, number DESC`;
  const rows = db.prepare(sql).all(...params) as InvoiceRow[];
  return rows.map((row) => mapInvoice(row));
}

export function listInvoiceNumbers(): string[] {
  const rows = getDb().prepare(`SELECT number FROM invoices`).all() as { number: string }[];
  return rows.map((row) => row.number);
}

export function dashboardRows() {
  const db = getDb();
  const invoices = db.prepare(`SELECT * FROM invoices`).all() as InvoiceRow[];
  const customerCount = (db.prepare(`SELECT COUNT(*) AS count FROM customers`).get() as { count: number }).count;
  return { invoices: invoices.map((row) => mapInvoice(row)), customerCount };
}
