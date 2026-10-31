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

export async function getInvoices(filter: { query?: string; status?: string; kind?: string; customerId?: string }) {
  await live();
  const rows = listInvoiceRows(filter);
  const status = filter.status || "all";
  const filtered = rows.filter((invoice) => matchesStatus(invoice, status));
  return {
    invoices: filtered.slice(0, 500),
    total: filtered.length,
  };
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
  const { invoices, customerCount } = dashboardRows();
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
