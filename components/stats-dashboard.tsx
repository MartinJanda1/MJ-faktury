"use client";

import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { CustomerDonut, RevenueBars } from "@/components/stats-charts";
import {
  availableYears,
  buildCustomerOptions,
  chartSeries,
  filterInvoices,
  formatStatsHours,
  formatStatsMoney,
  MONTH_NAMES,
  seriesByCustomer,
  summarize,
  type StatsFilter,
  type StatsInvoice,
  type StatsStatusFilter,
} from "@/lib/invoice-stats";
import { cn } from "cn";

function defaultFilter(invoices: StatsInvoice[]): StatsFilter {
  const years = availableYears(invoices);
  return {
    year: years[0] ? String(years[0]) : "",
    quarter: "",
    month: "",
    customerKey: "",
    status: "all",
  };
}

export function StatsDashboard({ invoices }: { invoices: StatsInvoice[] }) {
  const [filter, setFilter] = useState<StatsFilter>(() => defaultFilter(invoices));
  const years = useMemo(() => availableYears(invoices), [invoices]);
  const customers = useMemo(() => buildCustomerOptions(invoices), [invoices]);
  const filtered = useMemo(() => filterInvoices(invoices, filter), [invoices, filter]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const series = useMemo(() => chartSeries(filtered, filter), [filtered, filter]);
  const customerSeries = useMemo(() => seriesByCustomer(filtered), [filtered]);

  function update(partial: Partial<StatsFilter>) {
    setFilter((current) => {
      const next = { ...current, ...partial };
      if (partial.quarter !== undefined && partial.quarter) next.month = "";
      if (partial.month !== undefined && partial.month) next.quarter = "";
      if (partial.year !== undefined && !partial.year) {
        next.quarter = "";
        next.month = "";
      }
      return next;
    });
  }

  function reset() {
    setFilter(defaultFilter(invoices));
  }

  const selectClass = "h-9 min-w-[7.5rem] rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50";

  return (
    <div>
      <section className="mb-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Rok
            <select className={selectClass} value={filter.year} onChange={(event) => update({ year: event.target.value })}>
              <option value="">Všechny roky</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Kvartál
            <select
              className={selectClass}
              value={filter.quarter}
              disabled={!filter.year}
              onChange={(event) => update({ quarter: event.target.value })}
            >
              <option value="">Celý rok</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Měsíc
            <select
              className={cn(selectClass, "min-w-[10rem]")}
              value={filter.month}
              disabled={!filter.year}
              onChange={(event) => update({ month: event.target.value })}
            >
              <option value="">Celý rok / měsíc</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={String(index + 1).padStart(2, "0")}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Odběratel
            <select
              className={cn(selectClass, "min-w-[12rem]")}
              value={filter.customerKey}
              onChange={(event) => update({ customerKey: event.target.value })}
            >
              <option value="">Všichni odběratelé</option>
              {customers.map((customer) => (
                <option key={customer.key} value={customer.key}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Stav
            <select
              className={cn(selectClass, "min-w-[9rem]")}
              value={filter.status}
              onChange={(event) => update({ status: event.target.value as StatsStatusFilter })}
            >
              <option value="all">Všechny</option>
              <option value="active">Platné</option>
              <option value="resolved">Vyřízené</option>
              <option value="cancelled">Stornované</option>
            </select>
          </label>
          <button type="button" className={buttonVariants({ variant: "outline" })} onClick={reset}>
            Reset filtru
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length === invoices.length
            ? `${invoices.length} faktur celkem`
            : `${filtered.length} z ${invoices.length} faktur`}
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Faktur"
          value={String(summary.count)}
          hint={
            summary.count === 0
              ? "—"
              : `${summary.resolved} vyřízených · ${summary.active} otevřených · ${summary.cancelled} storen`
          }
        />
        <Kpi label="Obrat" value={`${formatStatsMoney(summary.total)} Kč`} />
        <Kpi label="Hodiny" value={`${formatStatsHours(summary.hours)} h`} />
        <Kpi label="Průměr / faktura" value={summary.count ? `${formatStatsMoney(summary.avgTotal)} Kč` : "—"} />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-5">
        <RevenueBars points={series.points} title={series.title} />
        <CustomerDonut points={customerSeries} />
      </section>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Detail období</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-3 font-semibold">Období</th>
                <th className="px-4 py-3 text-right font-semibold">Faktur</th>
                <th className="px-4 py-3 text-right font-semibold">Hodin</th>
                <th className="px-4 py-3 text-right font-semibold">Obrat</th>
              </tr>
            </thead>
            <tbody>
              {series.points.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Žádná data pro zvolený filtr
                  </td>
                </tr>
              ) : (
                series.points.map((point) => (
                  <tr key={point.key} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{point.fullLabel || point.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{point.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatStatsHours(point.hours)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatStatsMoney(point.total)} Kč</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-2xl tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
