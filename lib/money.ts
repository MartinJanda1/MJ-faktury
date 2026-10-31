const KNOWN_VAT = [0, 10, 12, 15, 21];

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function snapVat(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  let best = rate;
  let distance = Infinity;
  for (const known of KNOWN_VAT) {
    const next = Math.abs(known - rate);
    if (next < distance) {
      distance = next;
      best = known;
    }
  }
  return distance <= 0.6 ? best : roundMoney(rate);
}

export function normalizeVatRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric < 1) return snapVat(numeric * 100);
  return snapVat(numeric);
}

/** iDoklad VatRateType when the explicit percent is missing. 0 = snížená, 1 = základní, 2 = nulová, 3 = druhá snížená. */
export function vatFromType(value: unknown): number | null {
  if (typeof value === "string") {
    const text = value.toLowerCase();
    if (text.includes("zero")) return 0;
    if (text.includes("basic")) return 21;
    if (text.includes("reduced2")) return 10;
    if (text.includes("reduced")) return 12;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 0) return 12;
  if (numeric === 1) return 21;
  if (numeric === 2) return 0;
  if (numeric === 3) return 10;
  return null;
}

export function lineTotals(quantity: number, unitPrice: number, vatRate: number) {
  const totalNet = roundMoney(quantity * unitPrice);
  const totalVat = roundMoney(totalNet * (vatRate / 100));
  const totalGross = roundMoney(totalNet + totalVat);
  return { totalNet, totalVat, totalGross };
}

export function parseAmount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return 0;
  if (value == null) return 0;
  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
  if (!text || text === "-" || text === "," || text === ".") return 0;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(",", ".");
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const czech = text.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (czech) {
    return `${czech[3]}-${czech[2].padStart(2, "0")}-${czech[1].padStart(2, "0")}`;
  }
  return "";
}

export function todayPrague(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatMoney(amount: number, currency = "CZK"): string {
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${Number(match[3])}. ${Number(match[2])}. ${match[1]}`;
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 3 }).format(value);
}

export function countLabel(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}
