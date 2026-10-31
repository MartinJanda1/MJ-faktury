"use client";

import dynamic from "next/dynamic";
import type { StatsInvoice } from "@/lib/invoice-stats";

const StatsDashboard = dynamic(
  () => import("@/components/stats-dashboard").then((mod) => mod.StatsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl bg-card px-5 py-10 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">Načítám statistiky…</p>
      </div>
    ),
  },
);

export function StatsDashboardLazy({ invoices }: { invoices: StatsInvoice[] }) {
  return <StatsDashboard invoices={invoices} />;
}
