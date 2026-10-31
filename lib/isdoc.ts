import { XMLParser } from "fast-xml-parser";
import { parseAmount, parseIsoDate, roundMoney, snapVat } from "./money";
import { invoiceFieldDefaults } from "./invoice-fields";
import type { CustomerDraft, InvoiceDraft, SupplierDraft } from "./types";

export type IsdocImport = {
  customers: CustomerDraft[];
  invoices: InvoiceDraft[];
  supplier: SupplierDraft | null;
  warnings: string[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) => ["Invoice", "InvoiceLine", "Payment", "TaxSubTotal"].includes(name),
});

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object" && value && "#text" in value) return text((value as { "#text": unknown })["#text"]);
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function party(node: unknown) {
  const root = record(node);
  const body = record(root.Party ?? root);
  const address = record(body.PostalAddress);
  const tax = record(body.PartyTaxScheme);
  const contact = record(body.Contact);
  const identification = record(body.PartyIdentification);
  const name = text(record(body.PartyName).Name) || text(body.Name);
  const street = [text(address.StreetName), text(address.BuildingNumber)].filter(Boolean).join(" ").trim();
  return {
    name,
    ico: text(identification.ID) || text(identification.UserID),
    dic: text(tax.CompanyID),
    street,
    city: text(address.CityName),
    zip: text(address.PostalZone),
    country: text(record(address.Country).Name) || text(record(address.Country).IdentificationCode) || "Česká republika",
    email: text(contact.ElectronicMail),
    phone: text(contact.Telephone) || text(contact.Mobile),
  };
}

function supplierFromParty(value: ReturnType<typeof party>, payment: Record<string, unknown>): SupplierDraft | null {
  const details = record(record(payment.Details));
  if (!value.name && !text(details.IBAN) && !text(details.ID)) return null;
  return {
    ...value,
    country: value.country || "Česká republika",
    vatNote: "",
    bankAccount: text(details.ID),
    bankCode: text(details.BankCode),
    iban: text(details.IBAN),
    swift: text(details.BIC),
  };
}

export function importIsdocXml(xml: string, filename: string): IsdocImport {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return { customers: [], invoices: [], supplier: null, warnings: [`${filename}: soubor není čitelné XML.`] };
  }
  const root = record(parsed);
  const invoices = findInvoices(root);
  if (invoices.length === 0) {
    return { customers: [], invoices: [], supplier: null, warnings: [`${filename}: nenašel jsem ISDOC fakturu.`] };
  }
  const customers: CustomerDraft[] = [];
  const drafts: InvoiceDraft[] = [];
  let supplier: SupplierDraft | null = null;
  for (const invoice of invoices) {
    const mapped = mapInvoice(invoice, filename, warnings);
    if (!mapped) continue;
    drafts.push(mapped.invoice);
    if (mapped.customer) customers.push(mapped.customer);
    if (!supplier && mapped.supplier?.name) supplier = mapped.supplier;
  }
  return { customers, invoices: drafts, supplier, warnings };
}

function findInvoices(root: Record<string, unknown>): Record<string, unknown>[] {
  const direct = root.Invoice;
  if (Array.isArray(direct)) return direct.map(record);
  if (direct && typeof direct === "object") return [record(direct)];
  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    const nested = findInvoices(record(value));
    if (nested.length > 0) return nested;
  }
  return [];
}

function mapInvoice(raw: Record<string, unknown>, filename: string, warnings: string[]) {
  const number = text(raw.ID);
  if (!number) {
    warnings.push(`${filename}: faktura bez čísla byla přeskočena.`);
    return null;
  }
  const customerParty = party(raw.AccountingCustomerParty);
  const supplierParty = party(raw.AccountingSupplierParty);
  const payments = Array.isArray(raw.Payment) ? raw.Payment : record(raw.PaymentMeans).Payment;
  const payment = record(Array.isArray(payments) ? payments[0] : payments);
  const details = record(payment.Details);
  const lines = Array.isArray(raw.InvoiceLine) ? raw.InvoiceLine : record(raw.InvoiceLines).InvoiceLine;
  const lineList = Array.isArray(lines) ? lines.map(record) : [];
  const items = lineList.map((line) => {
    const quantity = parseAmount(text(line.InvoicedQuantity) || line.InvoicedQuantity) || 1;
    const percent = parseAmount(text(record(line.ClassifiedTaxCategory).Percent));
    const vatRate = snapVat(percent);
    const net = parseAmount(text(line.LineExtensionAmount));
    const gross = parseAmount(text(line.LineExtensionAmountTaxInclusive));
    const vat = parseAmount(text(line.LineExtensionTaxAmount)) || roundMoney(gross - net);
    const unit = text(line.UnitPrice) ? parseAmount(text(line.UnitPrice)) : quantity ? roundMoney(net / quantity) : net;
    const unitCode = text(record(line.InvoicedQuantity)["@_unitCode"]) || "ks";
    return {
      name: text(record(line.Item).Description) || "Položka",
      quantity,
      unit: unitCode,
      unitPrice: unit,
      vatRate,
      totalNet: roundMoney(net),
      totalVat: roundMoney(vat),
      totalGross: roundMoney(gross || net + vat),
    };
  });
  if (items.length === 0) {
    const monetary = record(raw.LegalMonetaryTotal);
    const net = parseAmount(text(monetary.TaxExclusiveAmount));
    const gross = parseAmount(text(monetary.TaxInclusiveAmount) || text(monetary.PayableAmount));
    items.push({
      name: text(raw.Note) || "Souhrnná položka",
      quantity: 1,
      unit: "ks",
      unitPrice: roundMoney(net || gross),
      vatRate: 0,
      totalNet: roundMoney(net || gross),
      totalVat: roundMoney(gross - net),
      totalGross: roundMoney(gross || net),
    });
    warnings.push(`${filename}: doklad ${number} nemá položky, uložil jsem součet.`);
  }
  const paidAmount = parseAmount(text(payment.PaidAmount));
  const payable = parseAmount(text(record(raw.LegalMonetaryTotal).PayableAmount));
  const uuid = text(raw.UUID);
  const invoice: InvoiceDraft = {
    externalId: uuid ? `isdoc:${uuid}` : null,
    source: "isdoc",
    kind: "issued",
    number,
    variableSymbol: text(details.VariableSymbol) || text(details.ID),
    constantSymbol: text(details.ConstantSymbol),
    specificSymbol: text(details.SpecificSymbol),
    ...invoiceFieldDefaults(),
    customerExternalId: null,
    customerName: customerParty.name,
    customerIco: customerParty.ico,
    customerDic: customerParty.dic,
    customerStreet: customerParty.street,
    customerCity: customerParty.city,
    customerZip: customerParty.zip,
    customerCountry: customerParty.country || "Česká republika",
    customerEmail: customerParty.email,
    issueDate: parseIsoDate(text(raw.IssueDate)),
    dueDate: parseIsoDate(text(details.PaymentDueDate)),
    taxDate: parseIsoDate(text(raw.TaxPointDate)),
    paidDate: paidAmount > 0 && payable > 0 && paidAmount >= payable ? parseIsoDate(text(raw.IssueDate)) || null : null,
    currency: (text(raw.LocalCurrencyCode) || "CZK").toUpperCase(),
    status: paidAmount > 0 && payable > 0 && paidAmount >= payable ? "paid" : paidAmount > 0 ? "partial" : "issued",
    description: text(raw.Note),
    note: "",
    items,
    supplier: null,
  };
  const customer: CustomerDraft | null = customerParty.name
    ? {
        externalId: null,
        source: "isdoc",
        name: customerParty.name,
        ico: customerParty.ico,
        dic: customerParty.dic,
        street: customerParty.street,
        city: customerParty.city,
        zip: customerParty.zip,
        country: customerParty.country || "Česká republika",
        email: customerParty.email,
        phone: customerParty.phone,
        note: "",
      }
    : null;
  return { invoice, customer, supplier: supplierFromParty(supplierParty, payment) };
}
