import { normalizeCurrency, normalizeVatRate, parseAmount, parseIsoDate, roundMoney, snapVat } from "./money";
import type { CustomerDraft, InvoiceDraft, InvoiceStatus } from "./types";

export type TabularImport = {
  customers: CustomerDraft[];
  invoices: InvoiceDraft[];
  warnings: string[];
};

const INVOICE_HEADERS = new Set([
  "cislo",
  "cislodokladu",
  "cislodoklad",
  "cislofaktury",
  "documentnumber",
  "doklad",
  "variabilnisymbol",
  "datumvystaveni",
  "dateofissue",
  "datumsplatnosti",
  "celkem",
  "celkemsdph",
  "totalwithvat",
]);

const CONTACT_HEADERS = new Set([
  "firma",
  "companyname",
  "odberatel",
  "nazev",
  "nazevjmeno",
  "nazevfirmy",
  "jmeno",
  "ico",
  "ic",
  "dic",
  "ulice",
  "mesto",
  "psc",
  "email",
  "telefon",
]);

const CUSTOMER_NAME_KEYS = [
  "odberatel",
  "firma",
  "nazevjmeno",
  "nazevfirmy",
  "nazev",
  "companyname",
  "partner",
  "zakaznik",
  "jmeno",
  "name",
];

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = source.split("\n").find((line) => line.trim()) ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const delimiter = semicolons > commas && semicolons >= tabs ? ";" : tabs > commas ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function decodeTableText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const cp1250 = new TextDecoder("windows-1250").decode(buffer);
  const utf8Score = headerScore(utf8);
  const cpScore = headerScore(cp1250);
  if (utf8.includes("\uFFFD")) return cp1250;
  return cpScore > utf8Score ? cp1250 : utf8;
}

function headerScore(text: string): number {
  const rows = parseCsv(text);
  if (rows.length === 0) return 0;
  return rows[0].filter((cell) => INVOICE_HEADERS.has(normalizeHeader(cell)) || CONTACT_HEADERS.has(normalizeHeader(cell))).length;
}

function indexMap(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function pick(row: string[], map: Map<string, number>, keys: string[]): string {
  for (const key of keys) {
    const index = map.get(key);
    if (index == null) continue;
    const value = row[index]?.trim() ?? "";
    if (value) return value;
  }
  return "";
}

function statusFromCell(value: string, paidDate: string): InvoiceStatus {
  if (paidDate) return "paid";
  const text = normalizeHeader(value);
  if (["uhrazeno", "uhrazena", "ano", "paid", "preplaceno"].includes(text)) return "paid";
  if (["castecne", "castecneuhrazeno", "partial"].includes(text)) return "partial";
  if (["storno", "zruseno", "cancelled"].includes(text)) return "cancelled";
  if (["koncept", "draft"].includes(text)) return "draft";
  return "issued";
}

function classify(headers: string[]): "invoices" | "contacts" | "unknown" {
  const keys = headers.map(normalizeHeader);
  const invoiceHits = keys.filter((key) => INVOICE_HEADERS.has(key)).length;
  const contactHits = keys.filter((key) => CONTACT_HEADERS.has(key)).length;
  const hasNumber = keys.some((key) => ["cislo", "cislodokladu", "cislofaktury", "documentnumber", "doklad"].includes(key));
  const hasMoney = keys.some((key) => ["celkem", "celkemsdph", "totalwithvat", "castka", "zaklad"].includes(key));
  if (hasNumber && (hasMoney || invoiceHits >= 2)) return "invoices";
  if (contactHits >= 2 && !hasNumber) return "contacts";
  if (invoiceHits > contactHits) return "invoices";
  if (contactHits > 0) return "contacts";
  return "unknown";
}

export function importRows(rows: string[][], filename: string): TabularImport {
  const warnings: string[] = [];
  if (rows.length < 2) {
    return { customers: [], invoices: [], warnings: [`${filename}: soubor nemá hlavičku a data.`] };
  }
  const headers = rows[0];
  const kind = classify(headers);
  const map = indexMap(headers);
  const body = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));
  if (kind === "contacts") return { customers: body.map((row) => contactFromRow(row, map)).filter((row) => row.name), invoices: [], warnings };
  if (kind === "unknown") {
    return { customers: [], invoices: [], warnings: [`${filename}: nepoznávám sloupce. Exportujte seznam faktur nebo kontaktů z iDokladu.`] };
  }

  const itemNameKey = ["polozka", "nazevpolozky", "popispolozky"].find((key) => map.has(key));
  const groups = new Map<string, string[][]>();
  for (const row of body) {
    const number = pick(row, map, ["cislo", "cislodokladu", "cislofaktury", "documentnumber", "doklad"]);
    const key = number || `bez-cisla-${groups.size}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const invoices: InvoiceDraft[] = [];
  for (const [number, group] of groups) {
    if (!pick(group[0], map, ["cislo", "cislodokladu", "cislofaktury", "documentnumber", "doklad"])) {
      warnings.push(`${filename}: řádek bez čísla dokladu byl přeskočen.`);
      continue;
    }
    invoices.push(invoiceFromRows(number, group, map, Boolean(itemNameKey), warnings, filename));
  }
  const customers = invoices
    .filter((invoice) => invoice.customerName)
    .map((invoice) => customerFromInvoice(invoice));
  return { customers, invoices, warnings };
}

function contactFromRow(row: string[], map: Map<string, number>): CustomerDraft {
  const company = pick(row, map, [
    "odberatel",
    "firma",
    "nazevjmeno",
    "nazevfirmy",
    "nazev",
    "companyname",
    "partner",
    "zakaznik",
    "name",
  ]);
  const person = [pick(row, map, ["jmeno", "firstname"]), pick(row, map, ["prijmeni", "surname"])].filter(Boolean).join(" ");
  return {
    externalId: null,
    source: "csv",
    name: company || person,
    ico: pick(row, map, ["ico", "ic", "identificationnumber"]),
    dic: pick(row, map, ["dic", "vat", "vatidentificationnumber"]),
    street: pick(row, map, ["ulice", "street", "adresa"]),
    city: pick(row, map, ["mesto", "city"]),
    zip: pick(row, map, ["psc", "zip", "postalcode"]),
    country: pick(row, map, ["stat", "zeme", "country"]) || "Česká republika",
    email: pick(row, map, ["email", "mail", "emailovaadresa"]),
    phone: pick(row, map, ["telefon", "phone", "mobil", "mobile"]),
    note: pick(row, map, ["poznamka", "note"]),
  };
}

function customerFromInvoice(invoice: InvoiceDraft): CustomerDraft {
  return {
    externalId: null,
    source: "csv",
    name: invoice.customerName,
    ico: invoice.customerIco,
    dic: invoice.customerDic,
    street: invoice.customerStreet,
    city: invoice.customerCity,
    zip: invoice.customerZip,
    country: invoice.customerCountry || "Česká republika",
    email: invoice.customerEmail,
    phone: "",
    note: "",
  };
}

function invoiceFromRows(
  number: string,
  rows: string[][],
  map: Map<string, number>,
  hasItems: boolean,
  warnings: string[],
  filename: string,
): InvoiceDraft {
  const first = rows[0];
  const paidDate =
    parseIsoDate(pick(first, map, ["datumplatby", "datumuhrady", "dateofpayment", "paiddate"])) || null;
  const items = hasItems
    ? rows.map((row) => {
        const quantity = parseAmount(pick(row, map, ["mnozstvi", "pocet", "amount", "quantity"])) || 1;
        const vatRate = normalizeVatRate(pick(row, map, ["sazbadph", "dph", "vatrate"])) ?? 0;
        const unitPrice = parseAmount(pick(row, map, ["cenazajednotku", "cenabezdph", "unitprice", "cena"]));
        return {
          name: pick(row, map, ["polozka", "nazevpolozky", "popispolozky", "popis"]) || "Položka",
          quantity,
          unit: pick(row, map, ["jednotka", "mj", "unit"]) || "ks",
          unitPrice,
          vatRate,
        };
      })
    : [summaryItem(first, map, warnings, filename, number)];

  return {
    externalId: null,
    source: "csv",
    kind: "issued",
    number,
    variableSymbol: pick(first, map, ["variabilnisymbol", "vs", "variablesymbol"]),
    constantSymbol: pick(first, map, ["konstantnisymbol", "ks", "constantsymbol"]),
    specificSymbol: pick(first, map, ["specifickysymbol", "ss"]),
    customerExternalId: null,
    customerName: pick(first, map, CUSTOMER_NAME_KEYS),
    customerIco: pick(first, map, ["ico", "ic", "identificationnumber"]),
    customerDic: pick(first, map, ["dic", "vatidentificationnumber"]),
    customerStreet: pick(first, map, ["ulice", "street"]),
    customerCity: pick(first, map, ["mesto", "city"]),
    customerZip: pick(first, map, ["psc", "zip", "postalcode"]),
    customerCountry: "Česká republika",
    customerEmail: pick(first, map, ["email", "mail"]),
    issueDate: parseIsoDate(pick(first, map, ["datumvystaveni", "dateofissue", "vystaveno"])),
    dueDate: parseIsoDate(pick(first, map, ["datumsplatnosti", "dateofmaturity", "splatnost"])),
    taxDate: parseIsoDate(pick(first, map, ["datumzdanitelnehoplneni", "duzp", "dateoftaxing"])),
    paidDate,
    currency: normalizeCurrency(pick(first, map, ["mena", "currency"]) || "CZK"),
    status: statusFromCell(pick(first, map, ["stavuhrady", "stav", "paymentstatus", "uhrazeno"]), paidDate ?? ""),
    description: pick(first, map, ["popis", "description", "predmet"]),
    note: hasItems ? "" : "Importováno ze seznamu. Položkový rozpis v exportu seznamu není.",
    items,
    supplier: null,
  };
}

function summaryItem(row: string[], map: Map<string, number>, warnings: string[], filename: string, number: string) {
  const totalGross = parseAmount(pick(row, map, ["celkem", "celkemsdph", "totalwithvat", "castkasdph", "castka"]));
  const totalNetRaw = pick(row, map, ["zaklad", "celkembezdph", "totalwithoutvat", "zakladdane"]);
  const totalVatRaw = pick(row, map, ["dph", "totalvat", "dan"]);
  const totalNet = totalNetRaw ? parseAmount(totalNetRaw) : 0;
  const totalVat = totalVatRaw ? parseAmount(totalVatRaw) : 0;
  if (!totalNetRaw && totalGross) {
    warnings.push(`${filename}: doklad ${number} nemá rozpad DPH, částka je uložená jako celkem.`);
  }
  const net = totalNet || totalGross;
  const vatRate = totalNet ? snapVat((totalVat / totalNet) * 100) : 0;
  return {
    name: pick(row, map, ["popis", "description"]) || "Souhrnná položka ze seznamu",
    quantity: 1,
    unit: "ks",
    unitPrice: roundMoney(net),
    vatRate,
    totalNet: roundMoney(net),
    totalVat: roundMoney(totalVat),
    totalGross: roundMoney(totalGross || net + totalVat),
  };
}
