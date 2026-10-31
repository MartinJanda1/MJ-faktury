import { normalizeVatRate, parseAmount, parseIsoDate, roundMoney, vatFromType } from "./money";
import { invoiceFieldDefaults } from "./invoice-fields";
import type { CustomerDraft, InvoiceDraft, InvoiceKind, ItemDraft, SupplierDraft } from "./types";

const CURRENCIES: Record<number, string> = {
  1: "CZK",
  2: "EUR",
  3: "USD",
  4: "GBP",
  5: "PLN",
  6: "HUF",
  7: "CHF",
};

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function contactName(raw: Record<string, unknown>): string {
  const company = text(raw.CompanyName) || text(raw.Name);
  if (company) return company;
  return [text(raw.Firstname), text(raw.Surname)].filter(Boolean).join(" ").trim();
}

export function mapContact(raw: Record<string, unknown>): CustomerDraft | null {
  const name = contactName(raw);
  if (!name) return null;
  const id = text(raw.Id);
  const country = record(raw.Country);
  return {
    externalId: id ? `idoklad:contact:${id}` : null,
    source: "idoklad",
    name,
    ico: text(raw.IdentificationNumber),
    dic: text(raw.VatIdentificationNumber),
    street: text(raw.Street),
    city: text(raw.City),
    zip: text(raw.PostalCode),
    country: text(country.Name) || text(raw.CountryName) || "Česká republika",
    email: text(raw.Email),
    phone: text(raw.Phone) || text(raw.Mobile),
    note: "",
    bankAccount: text(raw.AccountNumber),
    bankCode: text(raw.BankCode),
    iban: text(raw.Iban),
    swift: text(raw.Swift),
    bankName: text(raw.BankName) || text(raw.Bank),
  };
}

function currencyOf(raw: Record<string, unknown>): string {
  const currency = record(raw.Currency);
  const code = text(currency.Code) || text(raw.CurrencyCode);
  if (code) return code.toUpperCase();
  const id = Number(raw.CurrencyId);
  return CURRENCIES[id] ?? "CZK";
}

function mapPayment(raw: Record<string, unknown>, paidDate: string | null): InvoiceDraft["status"] {
  if (paidDate) return "paid";
  const value = raw.PaymentStatus ?? raw.DocumentPaymentStatus;
  if (typeof value === "number") {
    if (value === 1 || value === 3) return "paid";
    if (value === 2) return "partial";
    return "issued";
  }
  const textValue = text(value).toLowerCase();
  if (["1", "paid", "uhrazeno", "uhrazena", "overpaid", "přeplaceno", "preplaceno"].includes(textValue)) return "paid";
  if (["2", "partial", "partiallypaid", "partialpaid", "částečně", "castecne"].includes(textValue)) return "partial";
  if (["cancelled", "canceled", "storno"].includes(textValue)) return "cancelled";
  if (["draft", "koncept"].includes(textValue)) return "draft";
  return "issued";
}

function addressOf(raw: Record<string, unknown>, key: string): Record<string, unknown> {
  return record(raw[key]);
}

export function mapSupplier(raw: Record<string, unknown> | null): SupplierDraft | null {
  if (!raw) return null;
  const name = contactName(raw);
  if (!name && !text(raw.AccountNumber) && !text(raw.Iban)) return null;
  return {
    name,
    ico: text(raw.IdentificationNumber),
    dic: text(raw.VatIdentificationNumber),
    street: text(raw.Street),
    city: text(raw.City),
    zip: text(raw.PostalCode),
    country: "Česká republika",
    email: text(raw.Email),
    phone: text(raw.Phone) || text(raw.Mobile),
    vatNote: "",
    bankAccount: text(raw.AccountNumber),
    bankCode: text(raw.BankCode),
    iban: text(raw.Iban),
    swift: text(raw.Swift),
  };
}

function mapItem(raw: Record<string, unknown>): ItemDraft {
  const prices = record(raw.Prices);
  const vatRate =
    normalizeVatRate(raw.VatRate ?? raw.VatRateValue ?? prices.VatRate) ??
    vatFromType(raw.VatRateType) ??
    0;
  const quantity = parseAmount(raw.Amount ?? raw.Quantity ?? 1);
  const totalNetValue = prices.TotalWithoutVat ?? raw.TotalWithoutVat;
  const totalVatValue = prices.TotalVat ?? raw.TotalVat;
  const totalGrossValue = prices.TotalWithVat ?? raw.TotalWithVat;
  const totalNet = totalNetValue != null ? roundMoney(parseAmount(totalNetValue)) : undefined;
  const totalGross = totalGrossValue != null ? roundMoney(parseAmount(totalGrossValue)) : undefined;
  const totalVat =
    totalVatValue != null
      ? roundMoney(parseAmount(totalVatValue))
      : totalNet != null && totalGross != null
        ? roundMoney(totalGross - totalNet)
        : undefined;

  let unitPrice = parseAmount(prices.UnitPrice ?? raw.UnitPrice ?? raw.Price ?? 0);
  const priceType = raw.PriceType;
  const withVat = priceType === 0 || text(priceType).toLowerCase() === "withvat";
  if (withVat && vatRate && totalNet == null) {
    unitPrice = roundMoney(unitPrice / (1 + vatRate / 100));
  }

  const name = text(raw.Name) || text(raw.Description) || "Položka";
  const unit = text(raw.Unit) || "ks";
  if (totalNet != null || totalGross != null) {
    const gross = totalGross ?? roundMoney((totalNet ?? 0) + (totalVat ?? 0));
    const net = totalNet ?? roundMoney(gross - (totalVat ?? 0));
    const vat = totalVat ?? roundMoney(gross - net);
    return {
      name,
      quantity: quantity || 0,
      unit,
      unitPrice: quantity ? roundMoney(net / quantity) : unitPrice,
      vatRate,
      totalNet: net,
      totalVat: vat,
      totalGross: gross,
    };
  }

  return {
    name,
    quantity: quantity || 0,
    unit,
    unitPrice,
    vatRate,
  };
}

export function mapIssuedDocument(raw: Record<string, unknown>, kind: InvoiceKind): InvoiceDraft | null {
  const number = text(raw.DocumentNumber) || text(raw.Number) || text(raw.ProformaInvoiceNumber);
  if (!number) return null;
  const partner = addressOf(raw, "PartnerAddress");
  const partnerId = text(raw.PartnerId);
  const paidDate = parseIsoDate(raw.DateOfPayment) || null;
  const itemSource = raw.Items ?? raw.IssuedInvoiceItems ?? raw.ProformaInvoiceItems ?? raw.CreditNoteItems;
  const items = Array.isArray(itemSource) ? itemSource.map((item) => mapItem(record(item))) : [];
  const prices = record(raw.Prices);
  if (items.length === 0) {
    const totalNet = roundMoney(parseAmount(prices.TotalWithoutVat ?? raw.TotalWithoutVat));
    const totalVat = roundMoney(parseAmount(prices.TotalVat ?? raw.TotalVat));
    const totalGross = roundMoney(parseAmount(prices.TotalWithVat ?? raw.TotalWithVat ?? raw.Total));
    const net = totalNet || (totalGross ? roundMoney(totalGross - totalVat) : 0);
    items.push({
      name: text(raw.Description) || "Souhrnná položka",
      quantity: 1,
      unit: "ks",
      unitPrice: net,
      vatRate: net ? normalizeVatRate((totalVat / net) * 100) ?? 0 : 0,
      totalNet: net,
      totalVat,
      totalGross: totalGross || roundMoney(net + totalVat),
    });
  }
  const id = text(raw.Id);
  return {
    externalId: id ? `idoklad:${kind}:${id}` : null,
    source: "idoklad",
    kind,
    number,
    variableSymbol: text(raw.VariableSymbol),
    constantSymbol: text(raw.ConstantSymbol),
    specificSymbol: text(raw.SpecificSymbol),
    ...invoiceFieldDefaults(),
    orderNumber: text(raw.OrderNumber) || text(raw.OrderNumberText) || "",
    customerExternalId: partnerId ? `idoklad:contact:${partnerId}` : null,
    customerName: contactName(partner),
    customerIco: text(partner.IdentificationNumber),
    customerDic: text(partner.VatIdentificationNumber),
    customerStreet: text(partner.Street),
    customerCity: text(partner.City),
    customerZip: text(partner.PostalCode),
    customerCountry: "Česká republika",
    customerEmail: text(partner.Email),
    issueDate: parseIsoDate(raw.DateOfIssue),
    dueDate: parseIsoDate(raw.DateOfMaturity),
    taxDate: parseIsoDate(raw.DateOfTaxing),
    paidDate,
    currency: currencyOf(raw),
    status: mapPayment(raw, paidDate),
    description: text(raw.Description),
    note: text(raw.Note) || text(raw.ItemsTextSuffix),
    items,
    supplier: mapSupplier(addressOf(raw, "MyAddress")),
  };
}

export function documentItemsMissing(raw: Record<string, unknown>): boolean {
  const items = raw.Items ?? raw.IssuedInvoiceItems ?? raw.ProformaInvoiceItems ?? raw.CreditNoteItems;
  return !Array.isArray(items);
}
