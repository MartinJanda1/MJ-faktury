import type { Invoice, InvoiceItem } from "./types";

export const MONTH_NAMES = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
] as const;

export const MONTH_NAMES_SHORT = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"] as const;

export type StatsStatusFilter = "all" | "active" | "resolved" | "cancelled";

export type StatsFilter = {
  year: string;
  quarter: string;
  month: string;
  customerKey: string;
  status: StatsStatusFilter;
};

export type StatsInvoice = Pick<
  Invoice,
  "id" | "number" | "issueDate" | "status" | "paidDate" | "customerId" | "customerName" | "customerIco" | "customerDic" | "totalGross" | "currency"
> & {
  items: Pick<InvoiceItem, "quantity" | "unit" | "unitPrice">[];
};

export type StatsBucket = {
  count: number;
  total: number;
  hours: number;
  resolved: number;
  cancelled: number;
  active: number;
};

export type StatsPoint = StatsBucket & {
  key: string;
  label: string;
  fullLabel?: string;
  month?: number;
};

function emptyBucket(): StatsBucket {
  return { count: 0, total: 0, hours: 0, resolved: 0, cancelled: 0, active: 0 };
}

export function invoiceHours(invoice: StatsInvoice): number {
  return invoice.items.reduce((sum, item) => {
    const unit = String(item.unit || "").toLowerCase();
    if (!unit.startsWith("hod")) return sum;
    return sum + (Number(item.quantity) || 0);
  }, 0);
}

export function invoiceTotal(invoice: StatsInvoice): number {
  if (invoice.totalGross) return invoice.totalGross;
  return invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
}

export function customerKey(invoice: Pick<StatsInvoice, "customerName" | "customerIco" | "customerDic">): string {
  return [invoice.customerName || "", invoice.customerIco || "", invoice.customerDic || ""].join("|");
}

export function customerLabel(invoice: Pick<StatsInvoice, "customerName" | "customerIco">): string {
  return invoice.customerName || invoice.customerIco || "Bez názvu";
}

export function isResolved(invoice: StatsInvoice): boolean {
  return invoice.status === "paid" || Boolean(invoice.paidDate);
}

export function isCancelled(invoice: StatsInvoice): boolean {
  return invoice.status === "cancelled";
}

export function matchesStatusFilter(invoice: StatsInvoice, status: StatsStatusFilter): boolean {
  if (status === "all") return true;
  if (status === "cancelled") return isCancelled(invoice);
  if (status === "resolved") return isResolved(invoice) && !isCancelled(invoice);
  return !isCancelled(invoice) && !isResolved(invoice);
}

function issueParts(invoice: StatsInvoice): { year: number; month: number } | null {
  const match = invoice.issueDate?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function matchesStatsFilter(invoice: StatsInvoice, filter: StatsFilter): boolean {
  if (!matchesStatusFilter(invoice, filter.status || "all")) return false;
  if (filter.customerKey && customerKey(invoice) !== filter.customerKey) return false;
  const parts = issueParts(invoice);
  if (!parts) return false;
  if (filter.year && parts.year !== Number(filter.year)) return false;
  if (filter.quarter) {
    const quarter = Math.ceil(parts.month / 3);
    if (quarter !== Number(filter.quarter)) return false;
  }
  // Accept "1" and "01" like the original month select values.
  if (filter.month && parts.month !== Number(filter.month)) return false;
  return true;
}

export function filterInvoices(invoices: StatsInvoice[], filter: StatsFilter): StatsInvoice[] {
  return invoices.filter((invoice) => matchesStatsFilter(invoice, filter));
}

function addToBucket(bucket: StatsBucket, invoice: StatsInvoice) {
  bucket.count += 1;
  bucket.total += invoiceTotal(invoice);
  bucket.hours += invoiceHours(invoice);
  if (isCancelled(invoice)) bucket.cancelled += 1;
  else if (isResolved(invoice)) bucket.resolved += 1;
  else bucket.active += 1;
}

export function summarize(invoices: StatsInvoice[]) {
  const summary = emptyBucket();
  for (const invoice of invoices) addToBucket(summary, invoice);
  return {
    ...summary,
    avgTotal: summary.count ? summary.total / summary.count : 0,
  };
}

export function availableYears(invoices: StatsInvoice[]): number[] {
  const years = new Set<number>();
  for (const invoice of invoices) {
    const parts = issueParts(invoice);
    if (parts) years.add(parts.year);
  }
  return [...years].sort((a, b) => b - a);
}

export function buildCustomerOptions(invoices: StatsInvoice[]) {
  const map = new Map<string, { key: string; name: string }>();
  for (const invoice of invoices) {
    const key = customerKey(invoice);
    if (!map.has(key)) map.set(key, { key, name: customerLabel(invoice) });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
}

export function seriesByYear(invoices: StatsInvoice[]): StatsPoint[] {
  const map = new Map<number, StatsBucket>();
  for (const invoice of invoices) {
    const parts = issueParts(invoice);
    if (!parts) continue;
    if (!map.has(parts.year)) map.set(parts.year, emptyBucket());
    addToBucket(map.get(parts.year)!, invoice);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, bucket]) => ({
      key: String(year),
      label: String(year),
      fullLabel: String(year),
      ...bucket,
    }));
}

export function seriesByMonth(invoices: StatsInvoice[], year: string | number): StatsPoint[] {
  const y = Number(year);
  const buckets: StatsPoint[] = Array.from({ length: 12 }, (_, index) => ({
    key: `${y}-${String(index + 1).padStart(2, "0")}`,
    label: MONTH_NAMES_SHORT[index],
    fullLabel: `${MONTH_NAMES[index]} ${y}`,
    month: index + 1,
    ...emptyBucket(),
  }));
  for (const invoice of invoices) {
    const parts = issueParts(invoice);
    if (!parts || parts.year !== y) continue;
    addToBucket(buckets[parts.month - 1], invoice);
  }
  return buckets;
}

export function seriesByCustomer(invoices: StatsInvoice[]): StatsPoint[] {
  const map = new Map<string, StatsPoint>();
  for (const invoice of invoices) {
    const key = customerKey(invoice);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: customerLabel(invoice),
        fullLabel: customerLabel(invoice),
        ...emptyBucket(),
      });
    }
    addToBucket(map.get(key)!, invoice);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function chartSeries(invoices: StatsInvoice[], filter: StatsFilter) {
  const monthNum = filter.month ? Number(filter.month) : 0;
  if (filter.year && monthNum >= 1 && monthNum <= 12) {
    const all = seriesByMonth(invoices, filter.year);
    return {
      mode: "month" as const,
      title: `Obrat – ${MONTH_NAMES[monthNum - 1]} ${filter.year}`,
      points: all.filter((point) => point.month === monthNum),
    };
  }
  if (filter.year && filter.quarter) {
    const months = seriesByMonth(invoices, filter.year);
    const start = (Number(filter.quarter) - 1) * 3;
    return {
      mode: "quarter" as const,
      title: `Obrat – Q${filter.quarter} ${filter.year}`,
      points: months.slice(start, start + 3),
    };
  }
  if (filter.year) {
    return {
      mode: "year-months" as const,
      title: `Obrat po měsících – ${filter.year}`,
      points: seriesByMonth(invoices, filter.year),
    };
  }
  return {
    mode: "years" as const,
    title: "Obrat po letech",
    points: seriesByYear(invoices),
  };
}

/** Pixel height for a revenue bar given the series max (for tests / SVG chart). */
export function barPixelHeight(total: number, max: number, areaPx = 248): number {
  if (total <= 0) return 2;
  return Math.max(6, Math.round((total / Math.max(1, max)) * areaPx));
}

export function formatStatsMoney(value: number): string {
  return Number(value || 0).toLocaleString("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatStatsHours(value: number): string {
  return Number(value || 0).toLocaleString("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
