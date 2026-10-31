export type CzechBankAccount = {
  bankCode: string;
  prefix: string;
  account: string;
};

export type SpaydInput = {
  iban: string | null | undefined;
  amount: number;
  variableSymbol?: string | null;
  constantSymbol?: string | null;
  message?: string | null;
  dueDate?: string | null;
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

export function sanitizeSpaydMessage(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 +.:,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function buildSpaydString(input: SpaydInput): string | null {
  if (!input.iban) return null;

  const parts = ["SPD*1.0", `ACC:${input.iban}`];

  if (input.amount > 0) {
    parts.push(`AM:${input.amount.toFixed(2)}`);
  }

  parts.push("CC:CZK");

  const vs = String(input.variableSymbol || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (vs) parts.push(`X-VS:${vs}`);

  const ks = String(input.constantSymbol || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (ks) parts.push(`X-KS:${ks}`);

  if (input.dueDate) {
    const dt = String(input.dueDate).replace(/-/g, "");
    if (/^\d{8}$/.test(dt)) parts.push(`DT:${dt}`);
  }

  const msg = sanitizeSpaydMessage(input.message);
  if (msg) parts.push(`MSG:${msg}`);

  return parts.join("*");
}
