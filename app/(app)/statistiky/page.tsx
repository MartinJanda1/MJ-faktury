import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/money";
import { getStatistics } from "@/lib/queries";

export const metadata = { title: "Statistiky" };

const monthNames: Record<string, string> = {
  "01": "Led",
  "02": "Úno",
  "03": "Bře",
  "04": "Dub",
  "05": "Kvě",
  "06": "Čer",
  "07": "Čvc",
  "08": "Srp",
  "09": "Zář",
  "10": "Říj",
  "11": "Lis",
  "12": "Pro",
};

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const year = text(params.rok);
  const from = text(params.od);
  const to = text(params.do);
  const stats = await getStatistics({ year: year || undefined, from: from || undefined, to: to || undefined });
  const maxMonth = Math.max(1, ...stats.byMonth.map((row) => row.totalCzk));

  return (
    <div>
      <PageHeader
        eyebrow="Přehledy"
        title="Statistiky"
        description="Obrat, úhrady a odběratelé za zvolené období. Do součtu nejdou koncepty a storno."
      />

      <form className="mb-6 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Rok</span>
          <select name="rok" defaultValue={year || stats.year} className="h-9 min-w-28 rounded-lg border border-input bg-background px-3 text-sm">
            {stats.years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Od</span>
          <Input type="date" name="od" defaultValue={from} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Do</span>
          <Input type="date" name="do" defaultValue={to} />
        </label>
        <button type="submit" className={buttonVariants()}>
          Zobrazit
        </button>
        <Link href="/statistiky" className={buttonVariants({ variant: "outline" })}>
          Aktuální rok
        </Link>
      </form>

      <p className="mb-4 text-sm text-muted-foreground">
        Období {formatDate(stats.from)} – {formatDate(stats.to)} · {stats.issuedCount} dokladů v obratu
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Obrat" value={moneyList(stats.issuedByCurrency)} hint={`${stats.issuedCount} dokladů`} />
        <StatCard label="Uhrazeno" value={moneyList(stats.paidByCurrency)} hint={`${stats.paidCount} dokladů`} />
        <StatCard label="K úhradě" value={moneyList(stats.unpaidByCurrency)} hint={`${stats.unpaidCount} dokladů · ${stats.overdueCount} po splatnosti`} />
        <StatCard label="DPH" value={moneyList(stats.vatByCurrency)} hint={`${stats.cancelledCount} storno mimo obrat`} />
      </div>

      <section className="mt-8 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="font-medium">Po měsících</h2>
        {stats.byMonth.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">V období není žádný doklad.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {stats.byMonth.map((row) => {
              const label = `${monthNames[row.month.slice(5)] ?? row.month.slice(5)} ${row.month.slice(0, 4)}`;
              const width = Math.max(4, Math.round((row.totalCzk / maxMonth) * 100));
              return (
                <div key={row.month} className="grid gap-1 sm:grid-cols-[6.5rem_1fr_auto] sm:items-center sm:gap-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[oklch(0.45_0.08_158)]" style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-sm sm:text-right">{moneyList(row.amounts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Největší odběratelé</h2>
          <Link href="/odberatele" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Adresář
          </Link>
        </div>
        {stats.byCustomer.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Zatím bez dat.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {stats.byCustomer.map((row) => (
              <div key={row.name} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.count} {row.count === 1 ? "doklad" : row.count < 5 ? "doklady" : "dokladů"}
                  </p>
                </div>
                <p className="text-sm">{moneyList(row.amounts)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function text(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function moneyList(rows: { currency: string; gross: number }[]) {
  if (rows.length === 0) return formatMoney(0);
  return rows.map((row) => formatMoney(row.gross, row.currency)).join(" · ");
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
