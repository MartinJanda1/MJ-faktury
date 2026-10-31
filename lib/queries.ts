import "server-only";
import { connection } from "next/server";
import { todayPrague } from "./money";
import {
  dashboardRows,
  getCustomerRow,
  getInvoiceRow,
  listCustomerRows,
  listInvoiceNumbers,
  listInvoiceRows,
  listInvoiceYears,
  listInvoicesForStats,
  readCompanyPublic,
} from "./persist";
import { displayStatus } from "./status";
import type { Invoice } from "./types";

async function live() {
  await connection();
}

export async function getCompany() {
  await live();
  return readCompanyPublic();
}

export async function getCustomers(query = "") {
  await live();
  return listCustomerRows(query);
}

export async function getCustomer(id: string) {
  await live();
  return getCustomerRow(id);
}

export async function getInvoice(id: string) {
  await live();
  return getInvoiceRow(id);
}

export type InvoiceListFilter = {
  query?: string;
  status?: string;
  kind?: string;
  customerId?: string;
  year?: string;
  month?: string;
  from?: string;
  to?: string;
};

export function resolvePeriod(filter: InvoiceListFilter): { from?: string; to?: string } {
  if (filter.from || filter.to) {
    return { from: filter.from || undefined, to: filter.to || undefined };
  }
  if (filter.year && /^\d{4}$/.test(filter.year)) {
    if (filter.month && /^\d{1,2}$/.test(filter.month)) {
      const month = filter.month.padStart(2, "0");
      const lastDay = new Date(Date.UTC(Number(filter.year), Number(month), 0)).getUTCDate();
      return {
        from: `${filter.year}-${month}-01`,
        to: `${filter.year}-${month}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    return { from: `${filter.year}-01-01`, to: `${filter.year}-12-31` };
  }
  return {};
}

export async function getInvoices(filter: InvoiceListFilter) {
  await live();
  const period = resolvePeriod(filter);
  const rows = await listInvoiceRows({ ...filter, ...period });
  const status = filter.status || "all";
  const filtered = rows.filter((invoice) => matchesStatus(invoice, status));
  return {
    invoices: filtered.slice(0, 500),
    total: filtered.length,
  };
}

export async function getInvoiceFilterMeta() {
  await live();
  const years = await listInvoiceYears();
  const current = todayPrague().slice(0, 4);
  if (!years.includes(current)) years.unshift(current);
  return { years };
}

function matchesStatus(invoice: Invoice, status: string) {
  if (!status || status === "all") return true;
  const shown = displayStatus(invoice);
  if (status === "unpaid") return shown === "issued" || shown === "overdue" || shown === "partial";
  if (status === "overdue") return shown === "overdue";
  return shown === status;
}

export async function getNextNumber() {
  await live();
  return listInvoiceNumbers();
}

export async function getDashboard() {
  await live();
  const { invoices, customerCount } = await dashboardRows();
  const today = todayPrague();
  const month = today.slice(0, 7);
  const recent = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)).slice(0, 6);
  const open = invoices.filter((invoice) => {
    const shown = displayStatus(invoice, today);
    return shown === "issued" || shown === "overdue" || shown === "partial";
  });
  const buckets = new Map<string, number>();
  for (const invoice of open) {
    buckets.set(invoice.currency, (buckets.get(invoice.currency) ?? 0) + invoice.totalGross);
  }
  const monthGross = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.issueDate.startsWith(month) || invoice.status === "cancelled" || invoice.status === "draft") continue;
    monthGross.set(invoice.currency, (monthGross.get(invoice.currency) ?? 0) + invoice.totalGross);
  }
  return {
    invoiceCount: invoices.length,
    customerCount,
    overdueCount: invoices.filter((invoice) => displayStatus(invoice, today) === "overdue").length,
    openByCurrency: [...buckets.entries()].map(([currency, gross]) => ({ currency, gross })),
    monthByCurrency: [...monthGross.entries()].map(([currency, gross]) => ({ currency, gross })),
    recent,
  };
}

function addMoney(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

function moneyEntries(map: Map<string, number>) {
  return [...map.entries()]
    .map(([currency, gross]) => ({ currency, gross }))
    .sort((a, b) => b.gross - a.gross || a.currency.localeCompare(b.currency));
}

export async function getStatsInvoices() {
  await live();
  return listInvoicesForStats();
}

export async function getStatistics(filter: { year?: string; from?: string; to?: string }) {
  await live();
  const today = todayPrague();
  const year = filter.year && /^\d{4}$/.test(filter.year) ? filter.year : today.slice(0, 4);
  const period = resolvePeriod({
    year: filter.from || filter.to ? undefined : year,
    from: filter.from,
    to: filter.to,
  });
  const from = period.from || `${year}-01-01`;
  const to = period.to || `${year}-12-31`;
  const { invoices, customerCount } = await dashboardRows();
  const rows = invoices.filter((invoice) => invoice.issueDate >= from && invoice.issueDate <= to);
  const issued = rows.filter((invoice) => invoice.status !== "draft" && invoice.status !== "cancelled");
  const paid = rows.filter((invoice) => displayStatus(invoice, today) === "paid");
  const unpaid = rows.filter((invoice) => {
    const shown = displayStatus(invoice, today);
    return shown === "issued" || shown === "overdue" || shown === "partial";
  });
  const cancelled = rows.filter((invoice) => invoice.status === "cancelled");
  const overdue = rows.filter((invoice) => displayStatus(invoice, today) === "overdue");

  const issuedGross = new Map<string, number>();
  const paidGross = new Map<string, number>();
  const unpaidGross = new Map<string, number>();
  const vatGross = new Map<string, number>();
  for (const invoice of issued) {
    addMoney(issuedGross, invoice.currency, invoice.totalGross);
    addMoney(vatGross, invoice.currency, invoice.totalVat);
  }
  for (const invoice of paid) addMoney(paidGross, invoice.currency, invoice.totalGross);
  for (const invoice of unpaid) addMoney(unpaidGross, invoice.currency, invoice.totalGross);

  const monthMap = new Map<string, Map<string, number>>();
  for (const invoice of issued) {
    const month = invoice.issueDate.slice(0, 7);
    const bucket = monthMap.get(month) ?? new Map<string, number>();
    addMoney(bucket, invoice.currency, invoice.totalGross);
    monthMap.set(month, bucket);
  }
  const byMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amounts]) => ({
      month,
      amounts: moneyEntries(amounts),
      totalCzk: amounts.get("CZK") ?? [...amounts.values()].reduce((sum, value) => sum + value, 0),
    }));

  const customerMap = new Map<string, { name: string; count: number; amounts: Map<string, number> }>();
  for (const invoice of issued) {
    const key = invoice.customerId || invoice.customerIco || invoice.customerName || "neznamy";
    const row = customerMap.get(key) ?? {
      name: invoice.customerName || "Bez odběratele",
      count: 0,
      amounts: new Map<string, number>(),
    };
    row.count += 1;
    addMoney(row.amounts, invoice.currency, invoice.totalGross);
    customerMap.set(key, row);
  }
  const byCustomer = [...customerMap.values()]
    .map((row) => ({
      name: row.name,
      count: row.count,
      amounts: moneyEntries(row.amounts),
      sortValue: row.amounts.get("CZK") ?? [...row.amounts.values()].reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.sortValue - a.sortValue || b.count - a.count)
    .slice(0, 12);

  const years = await listInvoiceYears();
  if (!years.includes(year)) years.unshift(year);

  return {
    from,
    to,
    year,
    years: [...new Set(years)].sort((a, b) => b.localeCompare(a)),
    invoiceCount: rows.length,
    customerCount,
    issuedCount: issued.length,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    cancelledCount: cancelled.length,
    overdueCount: overdue.length,
    issuedByCurrency: moneyEntries(issuedGross),
    paidByCurrency: moneyEntries(paidGross),
    unpaidByCurrency: moneyEntries(unpaidGross),
    vatByCurrency: moneyEntries(vatGross),
    byMonth,
    byCustomer,
  };
}
