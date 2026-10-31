import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { Company, Customer, Invoice, InvoiceItem } from "./types";

export type StoreDocument = {
  version: 1;
  company: Company & { idokladClientSecret: string };
  customers: Customer[];
  invoices: Array<Omit<Invoice, "items">>;
  items: InvoiceItem[];
};

const BLOB_PATHNAME = "faktura-db.json";

function localFile() {
  if (process.env.FAKTURA_DB_PATH) return process.env.FAKTURA_DB_PATH;
  // On Vercel without Blob the writable area is /tmp (ephemeral per instance).
  if (process.env.VERCEL) return path.join("/tmp", "faktura.json");
  return path.join(process.cwd(), "data", "faktura.json");
}

export function storageMode(): "blob" | "tmp" | "local" {
  if (useBlob()) return "blob";
  if (process.env.VERCEL) return "tmp";
  return "local";
}

function emptyDocument(): StoreDocument {
  return {
    version: 1,
    company: {
      name: "",
      ico: "",
      dic: "",
      street: "",
      city: "",
      zip: "",
      country: "Česká republika",
      email: "",
      phone: "",
      bankAccount: "",
      bankCode: "",
      iban: "",
      swift: "",
      idokladClientId: "",
      hasIdokladSecret: false,
      idokladClientSecret: "",
    },
    customers: [],
    invoices: [],
    items: [],
  };
}

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocal(): Promise<StoreDocument> {
  try {
    const file = localFile();
    const raw = await fs.readFile(/*turbopackIgnore: true*/ file, "utf8");
    return JSON.parse(raw) as StoreDocument;
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
  return JSON.parse(text) as StoreDocument;
}

async function writeBlob(doc: StoreDocument) {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function loadStore(): Promise<StoreDocument> {
  return useBlob() ? readBlob() : readLocal();
}

export async function saveStore(doc: StoreDocument) {
  doc.company.hasIdokladSecret = Boolean(doc.company.idokladClientSecret);
  if (useBlob()) await writeBlob(doc);
  else await writeLocal(doc);
}

export async function updateStore<T>(mutator: (doc: StoreDocument) => T | Promise<T>): Promise<T> {
  const doc = await loadStore();
  const result = await mutator(doc);
  await saveStore(doc);
  return result;
}
