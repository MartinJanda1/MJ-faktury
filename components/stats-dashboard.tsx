"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
  type Chart as ChartInstance,
} from "chart.js";
import { buttonVariants } from "@/components/ui/button";
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

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const BRAND = "#00b5c8";
const BRAND_FILL = "rgba(0, 181, 200, 0.75)";
const PALETTE = ["#0d9488", "#0284c7", "#7c3aed", "#d97706", "#e11d48", "#16a34a"];

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
  const revenueRef = useRef<HTMLCanvasElement>(null);
  const customerRef = useRef<HTMLCanvasElement>(null);
  const revenueChart = useRef<ChartInstance | null>(null);
  const customerChart = useRef<ChartInstance | null>(null);

  useEffect(() => {
    if (!filter.year && years[0]) {
      setFilter((current) => ({ ...current, year: String(years[0]) }));
    }
  }, [filter.year, years]);

  useEffect(() => {
    if (!revenueRef.current) return;
    revenueChart.current?.destroy();
    revenueChart.current = new Chart(revenueRef.current, {
      type: "bar",
      data: {
        labels: series.points.map((point) => point.label),
        datasets: [
          {
            label: "Obrat (Kč)",
            data: series.points.map((point) => Math.round(point.total)),
            backgroundColor: BRAND_FILL,
            borderColor: BRAND,
            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: series.mode === "years" ? 48 : 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const point = series.points[ctx.dataIndex];
                return [
                  `Obrat: ${formatStatsMoney(Number(ctx.parsed.y))} Kč`,
                  `Faktur: ${point?.count ?? 0}`,
                  `Hodin: ${formatStatsHours(point?.hours ?? 0)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: (value) => formatStatsMoney(Number(value)),
            },
          },
        },
      },
    });
    return () => {
      revenueChart.current?.destroy();
      revenueChart.current = null;
    };
  }, [series]);

  useEffect(() => {
    if (!customerRef.current) return;
    customerChart.current?.destroy();
    if (!customerSeries.length) {
      customerChart.current = null;
      return;
    }
    customerChart.current = new Chart(customerRef.current, {
      type: "doughnut",
      data: {
        labels: customerSeries.map((row) => row.label),
        datasets: [
          {
            data: customerSeries.map((row) => Math.round(row.total)),
            backgroundColor: customerSeries.map((_, index) => PALETTE[index % PALETTE.length]),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, padding: 14 },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const row = customerSeries[ctx.dataIndex];
                const sum = customerSeries.reduce((total, item) => total + item.total, 0);
                const pct = row && sum ? Math.round((row.total / sum) * 100) : 0;
                return `${ctx.label}: ${formatStatsMoney(Number(ctx.parsed))} Kč (${pct} %)`;
              },
            },
          },
        },
      },
    });
    return () => {
      customerChart.current?.destroy();
      customerChart.current = null;
    };
  }, [customerSeries]);

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
                <option key={name} value={String(index + 1)}>
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
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold">{series.title}</h2>
          <div className="relative h-72">
            <canvas ref={revenueRef} aria-label="Graf obratu" />
          </div>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Podíl odběratelů</h2>
          <div className="relative h-72">
            {customerSeries.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Žádná data</p>
            ) : (
              <canvas ref={customerRef} aria-label="Graf odběratelů" />
            )}
          </div>
        </div>
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
