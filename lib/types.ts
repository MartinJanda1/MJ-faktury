export type InvoiceKind = "issued" | "proforma" | "credit_note";
export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "cancelled";
export type InvoiceLayout = "classic" | "idoklad";
export type RecordSource = "manual" | "idoklad" | "csv" | "isdoc";

export type SupplierDraft = {
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  /** Visible note under supplier, e.g. "Nejsme plátci DPH". */
  vatNote: string;
  bankAccount: string;
  bankCode: string;
  iban: string;
  swift: string;
};

export type CustomerDraft = {
  externalId: string | null;
  source: RecordSource;
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
  /** Customer’s own payment details (not used as invoice supplier bank). */
  bankAccount: string;
  bankCode: string;
  iban: string;
  swift: string;
  bankName: string;
};

export type ItemDraft = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  totalNet?: number;
  totalVat?: number;
  totalGross?: number;
};

export type InvoiceDraft = {
  externalId: string | null;
  source: RecordSource;
  kind: InvoiceKind;
  number: string;
  variableSymbol: string;
  constantSymbol: string;
  specificSymbol: string;
  paymentMethod: string;
  orderNumber: string;
  layout: InvoiceLayout;
  customerExternalId: string | null;
  customerName: string;
  customerIco: string;
  customerDic: string;
  customerStreet: string;
  customerCity: string;
  customerZip: string;
  customerCountry: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  taxDate: string;
  paidDate: string | null;
  currency: string;
  status: InvoiceStatus;
  description: string;
  note: string;
  items: ItemDraft[];
  supplier: SupplierDraft | null;
};

export type Customer = CustomerDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  position: number;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  totalNet: number;
  totalVat: number;
  totalGross: number;
};

export type Invoice = Omit<InvoiceDraft, "items" | "supplier" | "customerExternalId"> & {
  id: string;
  customerId: string | null;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
};

export type Company = SupplierDraft & {
  /** Footer line on the invoice document (classic + iDoklad). */
  footerNote: string;
  idokladClientId: string;
  hasIdokladSecret: boolean;
};

export type ImportCounts = {
  customersCreated: number;
  customersUpdated: number;
  invoicesCreated: number;
  invoicesUpdated: number;
  warnings: string[];
};
