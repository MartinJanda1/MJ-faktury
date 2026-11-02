export type CzechBankAccount = {
  bankCode: string;
  prefix: string;
  account: string;
};

/** Empty / bank-transfer-like methods qualify for SPAYD QR. */
export function isTransferPayment(method: string): boolean {
  const normalized = method
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!normalized) return true;
  return (
    normalized.includes("prevod") ||
    normalized.includes("transfer") ||
    normalized.includes("bank") ||
    normalized === "qr" ||
    normalized.includes("spayd")
  );
}

export type SidVatLine = {
  vatRate: number;
  totalNet: number;
  totalVat: number;
};

export type SidInput = {
  /** Invoice number (SID ID). Required. */
  id: string;
  /** Issue date YYYY-MM-DD (SID DD). Required. */
  issueDate: string;
  amount: number;
  message?: string | null;
  variableSymbol?: string | null;
  orderNumber?: string | null;
  dueDate?: string | null;
  /** Taxable supply / DPPD date YYYY-MM-DD. */
  taxDate?: string | null;
  supplierIco?: string | null;
  supplierDic?: string | null;
  customerIco?: string | null;
  customerDic?: string | null;
  /** When true, emit NTB for the whole amount (non-VAT payer). */
  nonVatPayer?: boolean;
  items?: SidVatLine[] | null;
  software?: string | null;
};

export type SpaydInput = {
  iban: string | null | undefined;
  amount: number;
  bic?: string | null;
  variableSymbol?: string | null;
  constantSymbol?: string | null;
  message?: string | null;
  dueDate?: string | null;
  /** When set, embeds SID as X-INV (QR Faktura). */
  invoice?: SidInput | null;
};

export function parseCzechBankAccount(raw: string | null | undefined): CzechBankAccount | null {
  const value = String(raw || "").replace(/\s/g, "");
  if (!value) return null;

  const slash = value.lastIndexOf("/");
  if (slash === -1) return null;

  const bankCode = value.slice(slash + 1).replace(/\D/g, "");
  const accountPart = value.slice(0, slash);
  if (!bankCode || !accountPart) return null;

  let prefix = "000000";
  let account = accountPart.replace(/\D/g, "");
  const dash = accountPart.indexOf("-");

  if (dash !== -1) {
    prefix = accountPart.slice(0, dash).replace(/\D/g, "");
    account = accountPart.slice(dash + 1).replace(/\D/g, "");
  }

  if (!account) return null;

  return {
    bankCode: bankCode.padStart(4, "0").slice(-4),
    prefix: prefix.padStart(6, "0").slice(-6),
    account: account.padStart(10, "0").slice(-10),
  };
}

export function czechAccountToIban(parsed: CzechBankAccount): string {
  const bban = `${parsed.bankCode}${parsed.prefix}${parsed.account}`;
  let remainder = 0;

  for (const ch of `${bban}123500`) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }

  const check = String(98 - remainder).padStart(2, "0");
  return `CZ${check}${bban}`;
}

export function normalizeIban(value: string | null | undefined): string | null {
  const iban = String(value || "").replace(/\s/g, "").toUpperCase();
  return /^CZ\d{22}$/.test(iban) ? iban : null;
}

/** Prefer a valid CZ IBAN; otherwise derive IBAN from a Czech `číslo/kód` account. */
export function resolveIban(
  accountNumber: string | null | undefined,
  iban: string | null | undefined,
): string | null {
  const direct = normalizeIban(iban);
  if (direct) return direct;

  const parsed = parseCzechBankAccount(accountNumber);
  if (!parsed) return null;

  return czechAccountToIban(parsed);
}

export function normalizeBic(value: string | null | undefined): string | null {
  const bic = String(value || "")
    .replace(/\s/g, "")
    .toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic) ? bic : null;
}

function toYyyymmdd(value: string | null | undefined): string | null {
  if (!value) return null;
  const dt = String(value).replace(/-/g, "");
  return /^\d{8}$/.test(dt) ? dt : null;
}

function moneyField(value: number): string {
  return value.toFixed(2);
}

/** Sanitize text for SPAYD MSG / SID fields (ASCII-ish, no `*`). */
export function sanitizeSpaydMessage(value: string | null | undefined, maxLen = 60): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 +.:\/,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeSidValue(value: string | null | undefined, maxLen: number): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function digitsOnly(value: string | null | undefined, maxLen: number): string {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLen);
}

function normalizeDic(value: string | null | undefined): string {
  return String(value || "")
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14);
}

type VatBucket = { net: number; vat: number };

function emptyBucket(): VatBucket {
  return { net: 0, vat: 0 };
}

/** Map CZ VAT % to SID tax buckets (0=basic 21, 1=first reduced, 2=second reduced). */
function vatBucketKey(rate: number): "b0" | "b1" | "b2" | "ntb" {
  if (rate >= 20) return "b0";
  if (rate >= 11) return "b1"; // 12 / 15
  if (rate >= 5) return "b2"; // 10
  return "ntb";
}

function pushVatFields(parts: string[], items: SidVatLine[] | null | undefined, nonVatPayer: boolean, amount: number): void {
  if (nonVatPayer || !items?.length) {
    if (amount > 0) parts.push(`NTB:${moneyField(amount)}`);
    return;
  }

  const b0 = emptyBucket();
  const b1 = emptyBucket();
  const b2 = emptyBucket();
  let ntb = 0;

  for (const item of items) {
    const key = vatBucketKey(Number(item.vatRate) || 0);
    const net = Number(item.totalNet) || 0;
    const vat = Number(item.totalVat) || 0;
    if (key === "b0") {
      b0.net += net;
      b0.vat += vat;
    } else if (key === "b1") {
      b1.net += net;
      b1.vat += vat;
    } else if (key === "b2") {
      b2.net += net;
      b2.vat += vat;
    } else {
      ntb += net;
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  if (b0.net || b0.vat) {
    parts.push(`TB0:${moneyField(round2(b0.net))}`);
    parts.push(`T0:${moneyField(round2(b0.vat))}`);
  }
  if (b1.net || b1.vat) {
    parts.push(`TB1:${moneyField(round2(b1.net))}`);
    parts.push(`T1:${moneyField(round2(b1.vat))}`);
  }
  if (b2.net || b2.vat) {
    parts.push(`TB2:${moneyField(round2(b2.net))}`);
    parts.push(`T2:${moneyField(round2(b2.vat))}`);
  }
  if (ntb) parts.push(`NTB:${moneyField(round2(ntb))}`);
}

/** Build Short Invoice Descriptor (QR Faktura / SID*1.0). */
export function buildSidString(input: SidInput): string | null {
  const id = sanitizeSidValue(input.id, 40);
  const dd = toYyyymmdd(input.issueDate);
  if (!id || !dd || !(input.amount > 0)) return null;

  const parts = ["SID*1.0", `ID:${id}`, `DD:${dd}`, `AM:${moneyField(input.amount)}`];

  const msg = sanitizeSidValue(input.message, 40);
  if (msg) parts.push(`MSG:${msg}`);

  const vs = digitsOnly(input.variableSymbol, 10);
  if (vs) parts.push(`VS:${vs}`);

  const on = sanitizeSidValue(input.orderNumber, 20);
  if (on) parts.push(`ON:${on}`);

  const ini = digitsOnly(input.supplierIco, 8);
  if (ini) parts.push(`INI:${ini}`);

  const vii = normalizeDic(input.supplierDic);
  if (vii) parts.push(`VII:${vii}`);

  const inr = digitsOnly(input.customerIco, 8);
  if (inr) parts.push(`INR:${inr}`);

  const vir = normalizeDic(input.customerDic);
  if (vir) parts.push(`VIR:${vir}`);

  const taxDate = toYyyymmdd(input.taxDate);
  if (taxDate) {
    parts.push(`DUZP:${taxDate}`);
    parts.push(`DPPD:${taxDate}`);
  }

  const due = toYyyymmdd(input.dueDate);
  if (due) parts.push(`DT:${due}`);

  pushVatFields(parts, input.items, Boolean(input.nonVatPayer), input.amount);

  const sw = sanitizeSidValue(input.software || "MJ-faktury", 30);
  if (sw) parts.push(`X-SW:${sw}`);

  return parts.join("*");
}

export function buildSpaydString(input: SpaydInput): string | null {
  if (!input.iban) return null;

  const bic = normalizeBic(input.bic);
  const acc = bic ? `${input.iban}+${bic}` : input.iban;
  const parts = ["SPD*1.0", `ACC:${acc}`];

  if (input.amount > 0) {
    parts.push(`AM:${moneyField(input.amount)}`);
  }

  parts.push("CC:CZK");

  const vs = digitsOnly(input.variableSymbol, 10);
  if (vs) parts.push(`X-VS:${vs}`);

  const ks = digitsOnly(input.constantSymbol, 4);
  if (ks) parts.push(`X-KS:${ks}`);

  const due = toYyyymmdd(input.dueDate);
  if (due) parts.push(`DT:${due}`);

  const msg = sanitizeSpaydMessage(input.message);
  if (msg) parts.push(`MSG:${msg}`);

  if (input.invoice) {
    const sid = buildSidString({
      ...input.invoice,
      amount: input.invoice.amount > 0 ? input.invoice.amount : input.amount,
      variableSymbol: input.invoice.variableSymbol ?? input.variableSymbol,
      dueDate: input.invoice.dueDate ?? input.dueDate,
    });
    if (sid) parts.push(`X-INV:${sid.replace(/\*/g, "%2A")}`);
  }

  return parts.join("*");
}
