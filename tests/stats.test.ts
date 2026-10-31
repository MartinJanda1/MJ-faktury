import assert from "node:assert/strict";
import test from "node:test";
import {
  barPixelHeight,
  chartSeries,
  filterInvoices,
  invoiceHours,
  summarize,
  type StatsInvoice,
} from "../lib/invoice-stats.ts";

const sample: StatsInvoice[] = [
  {
    id: "1",
    number: "VF 01/2026",
    issueDate: "2026-01-15",
    status: "paid",
    paidDate: "2026-01-20",
    customerId: "c1",
    customerName: "Alpha s.r.o.",
    customerIco: "111",
    customerDic: "",
    totalGross: 10000,
    currency: "CZK",
    items: [{ quantity: 10, unit: "hod", unitPrice: 1000 }],
  },
  {
    id: "2",
    number: "VF 02/2026",
    issueDate: "2026-02-10",
    status: "issued",
    paidDate: null,
    customerId: "c2",
    customerName: "Beta a.s.",
    customerIco: "222",
    customerDic: "",
    totalGross: 5000,
    currency: "CZK",
    items: [{ quantity: 1, unit: "ks", unitPrice: 5000 }],
  },
  {
    id: "3",
    number: "VF 03/2025",
    issueDate: "2025-11-01",
    status: "cancelled",
    paidDate: null,
    customerId: "c1",
    customerName: "Alpha s.r.o.",
    customerIco: "111",
    customerDic: "",
    totalGross: 2000,
    currency: "CZK",
    items: [{ quantity: 2, unit: "hod", unitPrice: 1000 }],
  },
];

test("stats filter year and status like the original app", () => {
  const year2026 = filterInvoices(sample, {
    year: "2026",
    quarter: "",
    month: "",
    customerKey: "",
    status: "all",
  });
  assert.equal(year2026.length, 2);

  const active = filterInvoices(sample, {
    year: "2026",
    quarter: "",
    month: "",
    customerKey: "",
    status: "active",
  });
  assert.equal(active.length, 1);
  assert.equal(active[0].number, "VF 02/2026");

  const resolved = filterInvoices(sample, {
    year: "",
    quarter: "",
    month: "",
    customerKey: "",
    status: "resolved",
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].customerName, "Alpha s.r.o.");
});

test("stats summary and hours come from hod units", () => {
  assert.equal(invoiceHours(sample[0]), 10);
  assert.equal(invoiceHours(sample[1]), 0);
  const summary = summarize(sample.slice(0, 2));
  assert.equal(summary.count, 2);
  assert.equal(summary.total, 15000);
  assert.equal(summary.hours, 10);
  assert.equal(summary.resolved, 1);
  assert.equal(summary.active, 1);
});

test("chart series switches between years and months", () => {
  const byYear = chartSeries(sample, { year: "", quarter: "", month: "", customerKey: "", status: "all" });
  assert.equal(byYear.mode, "years");
  assert.equal(byYear.points.length, 2);

  const byMonth = chartSeries(sample, { year: "2026", quarter: "", month: "", customerKey: "", status: "all" });
  assert.equal(byMonth.mode, "year-months");
  assert.equal(byMonth.points.length, 12);
  assert.equal(byMonth.points[0].count, 1);
  assert.equal(byMonth.points[1].total, 5000);
  assert.equal(byMonth.points[0].key, "2026-01");
});

test("month filter accepts padded and unpadded values", () => {
  const padded = chartSeries(sample, {
    year: "2026",
    quarter: "",
    month: "01",
    customerKey: "",
    status: "all",
  });
  const unpadded = chartSeries(sample, {
    year: "2026",
    quarter: "",
    month: "1",
    customerKey: "",
    status: "all",
  });
  assert.equal(padded.mode, "month");
  assert.equal(padded.points.length, 1);
  assert.equal(padded.points[0].total, 10000);
  assert.equal(unpadded.points[0].total, padded.points[0].total);

  const filtered = filterInvoices(sample, {
    year: "2026",
    quarter: "",
    month: "01",
    customerKey: "",
    status: "all",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].number, "VF 01/2026");
});

test("bar pixel heights scale with monthly totals", () => {
  const series = chartSeries(sample, {
    year: "2026",
    quarter: "",
    month: "",
    customerKey: "",
    status: "all",
  });
  const max = Math.max(...series.points.map((p) => p.total));
  assert.equal(max, 10000);
  assert.equal(barPixelHeight(10000, max), 248);
  assert.equal(barPixelHeight(5000, max), 124);
  assert.equal(barPixelHeight(0, max), 2);
  assert.ok(series.points.some((p) => p.total > 0), "monthly series must include revenue months");
});
