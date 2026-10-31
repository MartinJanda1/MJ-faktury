import { documentItemsMissing, mapContact, mapIssuedDocument, mapSupplier } from "./idoklad-map";
import { applyImport, readCompanyPublic, readCompanySecrets, saveCompany } from "./persist";
import type { CustomerDraft, ImportCounts, InvoiceDraft, InvoiceKind, SupplierDraft } from "./types";

const TOKEN_URL = "https://identity.idoklad.cz/server/connect/token";
const API_URL = "https://api.idoklad.cz/v3";

const DOCUMENTS: { path: string; fallback?: string; kind: InvoiceKind; label: string }[] = [
  { path: "IssuedInvoices", kind: "issued", label: "vydané faktury" },
  { path: "ProformaInvoices", kind: "proforma", label: "zálohové faktury" },
  { path: "CreditNotes", fallback: "IssuedCreditNotes", kind: "credit_note", label: "dobropisy" },
];

export type ImportProgress = {
  type: "log";
  message: string;
};

type TokenError = Error & { invalidClient?: boolean };

async function requestToken(clientId: string, clientSecret: string, scope: string | null) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (scope) body.set("scope", scope);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload: payload as { access_token?: string; error?: string; error_description?: string } | null };
}

export async function idokladToken(clientId: string, clientSecret: string): Promise<string> {
  let lastMessage = "iDoklad klíče nepřijal.";
  for (const scope of ["idoklad_api", null]) {
    const { response, payload } = await requestToken(clientId, clientSecret, scope);
    if (response.ok && payload?.access_token) return payload.access_token;
    lastMessage = payload?.error_description || payload?.error || `HTTP ${response.status}`;
    if (payload?.error === "invalid_client" || payload?.error === "unauthorized_client") break;
    if (payload?.error !== "invalid_scope" && scope === null) break;
  }
  const error = new Error(
    `${lastMessage} Zkontrolujte Client ID a Client Secret z iDokladu, Nastavení → Aplikace → API. Heslo k webu sem nepatří.`,
  ) as TokenError;
  throw error;
}

async function apiGet(token: string, path: string, signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "faktura-app/0.1",
    },
    signal: signal ?? AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

function unwrapList(json: unknown): { items: Record<string, unknown>[]; totalPages: number } {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const data = (root.Data ?? root.data ?? root) as unknown;
  if (Array.isArray(data)) return { items: data.map(asRecord), totalPages: 1 };
  const record = asRecord(data);
  const items = record.Items ?? record.items;
  const totalPages = Number(record.TotalPages ?? record.totalPages ?? 1) || 1;
  return { items: Array.isArray(items) ? items.map(asRecord) : [], totalPages };
}

function unwrapOne(json: unknown): Record<string, unknown> {
  const root = asRecord(json);
  return asRecord(root.Data ?? root.data ?? root);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function fetchAll(token: string, resource: string, onPage: (page: number, total: number, count: number) => void, signal?: AbortSignal) {
  const items: Record<string, unknown>[] = [];
  let page = 1;
  while (page <= 500) {
    const query = new URLSearchParams({ page: String(page), pageSize: "100" });
    const { response, json, text } = await apiGet(token, `${resource}?${query}`, signal);
    if (!response.ok) {
      const error = new Error(`${resource}: HTTP ${response.status} ${text.slice(0, 180)}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const batch = unwrapList(json);
    items.push(...batch.items);
    onPage(page, batch.totalPages, items.length);
    if (page >= batch.totalPages || batch.items.length === 0) break;
    page += 1;
  }
  return items;
}

async function withDetails(
  token: string,
  resource: string,
  rows: Record<string, unknown>[],
  onProgress: (message: string) => void,
  signal?: AbortSignal,
) {
  const missing = rows.filter(documentItemsMissing);
  if (missing.length === 0) return rows;
  onProgress(`Doplňuji položky u ${missing.length} dokladů.`);
  let done = 0;
  const detailed = new Map<string, Record<string, unknown>>();
  const queue = [...missing];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const row = queue.shift();
      if (!row) return;
      const id = String(row.Id ?? "");
      if (!id) continue;
      try {
        const { response, json } = await apiGet(token, `${resource}/${id}`, signal);
        if (response.ok) detailed.set(id, unwrapOne(json));
      } catch {
        // The header import still keeps the document.
      }
      done += 1;
      if (done % 25 === 0 || done === missing.length) onProgress(`Položky ${done} / ${missing.length}.`);
    }
  });
  await Promise.all(workers);
  return rows.map((row) => detailed.get(String(row.Id ?? "")) ?? row);
}

export async function importFromIdoklad(options: {
  clientId?: string;
  clientSecret?: string;
  saveCredentials?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: ImportProgress) => void;
}): Promise<ImportCounts> {
  const stored = readCompanySecrets();
  const clientId = options.clientId?.trim() || stored.clientId;
  const clientSecret = options.clientSecret?.trim() || stored.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("Chybí Client ID nebo Client Secret. Vygenerujte je v iDokladu v Nastavení → Aplikace → API.");
  }
  const log = (message: string) => options.onProgress?.({ type: "log", message });
  log("Ověřuji klíče u iDokladu.");
  const token = await idokladToken(clientId, clientSecret);
  if (options.saveCredentials !== false) {
    const company = readCompanyPublic();
    saveCompany({ ...company, clientId, clientSecret, clearSecret: false });
  }

  log("Stahuji adresář.");
  const contacts = await fetchAll(token, "Contacts", (page, total, count) => {
    log(`Kontakty, stránka ${page} z ${total} (${count}).`);
  }, options.signal);
  const customers: CustomerDraft[] = [];
  for (const contact of contacts) {
    const mapped = mapContact(contact);
    if (mapped) customers.push(mapped);
  }

  const invoices: InvoiceDraft[] = [];
  const warnings: string[] = [];
  let supplier: SupplierDraft | null = null;
  for (const document of DOCUMENTS) {
    log(`Stahuji ${document.label}.`);
    let rows: Record<string, unknown>[] = [];
    let resource = document.path;
    try {
      rows = await fetchAll(token, resource, (page, total, count) => {
        log(`${document.label}, stránka ${page} z ${total} (${count}).`);
      }, options.signal);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw error;
      if (document.fallback && (status === 404 || status === 400)) {
        resource = document.fallback;
        try {
          rows = await fetchAll(token, resource, (page, total) => {
            log(`${document.label}, náhradní zdroj, stránka ${page} z ${total}.`);
          }, options.signal);
        } catch {
          warnings.push(`${document.label} se nepodařilo stáhnout. Ostatní doklady pokračují.`);
          continue;
        }
      } else if (status === 404) {
        warnings.push(`${document.label} tento účet v API nenabízí.`);
        continue;
      } else {
        warnings.push(error instanceof Error ? error.message : `Stažení ${document.label} selhalo.`);
        continue;
      }
    }
    rows = await withDetails(token, resource, rows, log, options.signal);
    for (const row of rows) {
      const mapped = mapIssuedDocument(row, document.kind);
      if (!mapped) {
        warnings.push(`Jeden doklad typu ${document.label} nemá číslo a byl přeskočen.`);
        continue;
      }
      if (!supplier && mapped.supplier?.name) supplier = mapped.supplier;
      invoices.push(mapped);
    }
  }

  if (!supplier) {
    const agenda = await apiGet(token, "Agendas", options.signal).catch(() => null);
    if (agenda?.response.ok) {
      const data = unwrapOne(agenda.json);
      const items = unwrapList(agenda.json).items;
      supplier = mapSupplier(items[0] ?? data);
    }
  }

  log("Ukládám do evidence.");
  const counts = applyImport(customers, invoices, supplier);
  counts.warnings.push(...warnings);
  return counts;
}
