import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { countLabel, formatDate, formatMoney } from "@/lib/money";
import { getDashboard } from "@/lib/queries";

export const metadata = { title: "Přehled" };

export default async function HomePage() {
  const dashboard = await getDashboard();
  const empty = dashboard.invoiceCount === 0 && dashboard.customerCount === 0;
  return (
    <div>
      <PageHeader
        eyebrow="Přehled"
        title="Co je otevřené"
        description="Vydané doklady, splatnost a odběratelé na jednom místě."
        action={
          <Link href="/faktury/nova" className={buttonVariants()}>
            Nová faktura
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="K úhradě" value={moneyList(dashboard.openByCurrency)} hint={countLabel(dashboard.overdueCount, "doklad po splatnosti", "doklady po splatnosti", "dokladů po splatnosti")} />
        <Stat label="Vystaveno tento měsíc" value={moneyList(dashboard.monthByCurrency)} hint="bez konceptů a storna" />
        <Stat label="Adresář" value={countLabel(dashboard.customerCount, "odběratel", "odběratelé", "odběratelů")} hint={countLabel(dashboard.invoiceCount, "doklad", "doklady", "dokladů")} />
      </div>

      {empty ? (
        <div className="mt-8 rounded-xl bg-card px-5 py-8 ring-1 ring-foreground/10">
          <h2 className="text-xl font-medium">Evidence je prázdná</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Stáhněte faktury a odběratele z iDokladu přes API klíče, nebo nahrajte export. Heslo k webu iDoklad aplikace nepoužívá. Potom můžete doklady dál vystavovat tady.
          </p>
          <Link href="/import" className={`${buttonVariants()} mt-5`}>
            Přenést data
          </Link>
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium">Poslední doklady</h2>
          {dashboard.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím tu není žádný doklad.</p>
          ) : (
            <div className="grid gap-2">
              {dashboard.recent.map((invoice) => (
                <Link key={invoice.id} href={`/faktury/${invoice.id}`} className="grid gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center">
                  <span className="font-medium">{invoice.number}</span>
                  <span className="truncate text-sm">{invoice.customerName || "Bez odběratele"}</span>
                  <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
                  <span className="text-sm sm:text-right">
                    {formatMoney(invoice.totalGross, invoice.currency)}
                    <span className="ml-2 text-muted-foreground">{formatDate(invoice.issueDate)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">V seznamu jsou vydané faktury, zálohy i dobropisy.</p>
        </section>
      )}
    </div>
  );
}

function moneyList(rows: { currency: string; gross: number }[]) {
  if (rows.length === 0) return formatMoney(0);
  return rows.map((row) => formatMoney(row.gross, row.currency)).join(" · ");
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
