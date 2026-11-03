import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { Company, Customer, Invoice, InvoiceItem } from "./types";

export type TenantCompany = Company & { idokladClientSecret: string; accessPasswordHash: string };

export type Tenant = {
  id: string;
  company: TenantCompany;
  customers: Customer[];
  invoices: Array<Omit<Invoice, "items">>;
  items: InvoiceItem[];
};

export type StoreDocument = {
  version: 2;
  tenants: Tenant[];
};

/** Legacy v1 shape before multi-tenant. */
type LegacyStoreDocument = {
  version?: 1;
  company: TenantCompany;
  customers: Customer[];
  invoices: Array<Omit<Invoice, "items">>;
  items: InvoiceItem[];
};

const BLOB_PATHNAME = "faktura-db.json";

function localFile() {
  if (process.env.FAKTURA_DB_PATH) return process.env.FAKTURA_DB_PATH;
  if (process.env.VERCEL) return path.join("/tmp", "faktura.json");
  return path.join(process.cwd(), "data", "faktura.json");
}

export function storageMode(): "blob" | "tmp" | "local" {
  if (useBlob()) return "blob";
  if (process.env.VERCEL) return "tmp";
  return "local";
}

export function emptyCompany(): TenantCompany {
  return {
    name: "",
    ico: "",
    dic: "",
    street: "",
    city: "",
    zip: "",
    country: "Česká republika",
    email: "",
    phone: "",
    vatNote: "",
    bankAccount: "",
    bankCode: "",
    iban: "",
    swift: "",
    footerNote: "",
    idokladClientId: "",
    hasIdokladSecret: false,
    hasAccessPassword: false,
    idokladClientSecret: "",
    accessPasswordHash: "",
  };
}

export function emptyTenant(id = randomUUID()): Tenant {
  return {
    id,
    company: emptyCompany(),
    customers: [],
    invoices: [],
    items: [],
  };
}

function emptyDocument(): StoreDocument {
  return { version: 2, tenants: [] };
}

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function normalizeCompany(company: Partial<TenantCompany> | undefined): TenantCompany {
  const base = emptyCompany();
  if (!company) return base;
  return {
    ...base,
    ...company,
    country: company.country || "Česká republika",
    vatNote: company.vatNote ?? "",
    footerNote: company.footerNote ?? "",
    idokladClientSecret: company.idokladClientSecret ?? "",
    accessPasswordHash: company.accessPasswordHash ?? "",
    hasIdokladSecret: Boolean(company.idokladClientSecret),
    hasAccessPassword: Boolean(company.accessPasswordHash),
  };
}

/** Migrate v1 single-company document (or raw legacy) into v2 tenants. */
export function migrateToV2(raw: unknown): StoreDocument {
  if (!raw || typeof raw !== "object") return emptyDocument();
  const data = raw as Record<string, unknown>;

  if (data.version === 2 && Array.isArray(data.tenants)) {
    const tenants = (data.tenants as Tenant[]).map((tenant) => ({
      id: tenant.id || randomUUID(),
      company: normalizeCompany(tenant.company),
      customers: Array.isArray(tenant.customers) ? tenant.customers : [],
      invoices: Array.isArray(tenant.invoices) ? tenant.invoices : [],
      items: Array.isArray(tenant.items) ? tenant.items : [],
    }));
    return { version: 2, tenants };
  }

  const legacy = data as LegacyStoreDocument;
  if (legacy.company || legacy.customers || legacy.invoices || legacy.items) {
    const tenant = emptyTenant();
    tenant.company = normalizeCompany(legacy.company);
    tenant.customers = Array.isArray(legacy.customers) ? legacy.customers : [];
    tenant.invoices = Array.isArray(legacy.invoices) ? legacy.invoices : [];
    tenant.items = Array.isArray(legacy.items) ? legacy.items : [];
    return { version: 2, tenants: [tenant] };
  }

  return emptyDocument();
}

async function readLocal(): Promise<StoreDocument> {
  try {
    const file = localFile();
    const text = await fs.readFile(/*turbopackIgnore: true*/ file, "utf8");
    return migrateToV2(JSON.parse(text));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDocument();
    throw error;
  }
}

async function writeLocal(doc: StoreDocument) {
  const file = localFile();
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ temp, JSON.stringify(doc), "utf8");
  await fs.rename(/*turbopackIgnore: true*/ temp, file);
}

async function readBlob(): Promise<StoreDocument> {
  const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
  if (!result?.stream) return emptyDocument();
  const text = await new Response(result.stream).text();
  if (!text.trim()) return emptyDocument();
  return migrateToV2(JSON.parse(text));
}

async function writeBlob(doc: StoreDocument) {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function syncCompanyFlags(doc: StoreDocument) {
  for (const tenant of doc.tenants) {
    tenant.company.hasIdokladSecret = Boolean(tenant.company.idokladClientSecret);
    tenant.company.hasAccessPassword = Boolean(tenant.company.accessPasswordHash);
  }
}

export async function loadStore(): Promise<StoreDocument> {
  return useBlob() ? readBlob() : readLocal();
}

export async function saveStore(doc: StoreDocument) {
  doc.version = 2;
  syncCompanyFlags(doc);
  if (useBlob()) await writeBlob(doc);
  else await writeLocal(doc);
}

export async function updateStore<T>(mutator: (doc: StoreDocument) => T | Promise<T>): Promise<T> {
  const doc = await loadStore();
  const result = await mutator(doc);
  await saveStore(doc);
  return result;
}

export function publicCompany(company: TenantCompany) {
  const { idokladClientSecret: _secret, accessPasswordHash: _password, ...rest } = company;
  return {
    ...rest,
    vatNote: company.vatNote ?? "",
    footerNote: company.footerNote ?? "",
    hasIdokladSecret: Boolean(_secret),
    hasAccessPassword: Boolean(_password),
  };
}
