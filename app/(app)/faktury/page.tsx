import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/money";
import { getInvoices } from "@/lib/queries";
import { kindLabel } from "@/lib/status";
import { cn } from "cn";

export const metadata = { title: "Faktury" };

const statuses = [
  ["all", "Vše"],
  ["unpaid", "K úhradě"],
  ["overdue", "Po splatnosti"],
  ["paid", "Uhrazené"],
  ["draft", "Koncepty"],
] as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/faktury">) {
  const params = await searchParams;
  const query = text(params.q);
  const status = text(params.stav) || "all";
  const kind = text(params.druh) || "all";
  const { invoices, total } = await getInvoices({ query, status, kind });

  return (
    <div>
      <PageHeader
        eyebrow="Doklady"
        title="Faktury"
        description="Vydané faktury, zálohy a dobropisy. Hledání bere číslo, odběratele, IČO i variabilní symbol."
        action={
          <Link href="/faktury/nova" className={buttonVariants()}>
            Nová faktura
          </Link>
        }
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input name="q" defaultValue={query} placeholder="Hledat doklad" className="sm:max-w-sm" />
        <input type="hidden" name="stav" value={status} />
        <input type="hidden" name="druh" value={kind} />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Hledat
        </button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map(([value, label]) => (
          <Link
            key={value}
            href={href({ q: query, stav: value, druh: kind })}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              status === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      {invoices.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 ring-1 ring-foreground/10">
          <h2 className="text-xl font-medium">Žádný doklad neodpovídá</h2>
          <p className="mt-2 text-sm text-muted-foreground">Upravte filtr, nebo přeneste historii z iDokladu.</p>
          <Link href="/import" className={`${buttonVariants({ variant: "outline" })} mt-4`}>
            Import
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="hidden grid-cols-[8rem_1fr_8rem_8rem_7rem] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground md:grid">
            <span>Číslo</span>
            <span>Odběratel</span>
            <span>Vystaveno</span>
            <span>Stav</span>
            <span className="text-right">Celkem</span>
          </div>
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/faktury/${invoice.id}`} className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[8rem_1fr_8rem_8rem_7rem] md:items-center md:gap-3">
              <span className="font-medium">{invoice.number}</span>
              <span className="truncate text-sm">
                {invoice.customerName || "Bez odběratele"}
                <span className="ml-2 text-muted-foreground">{kindLabel(invoice.kind)}</span>
              </span>
              <span className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</span>
              <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
              <span className="text-sm md:text-right">{formatMoney(invoice.totalGross, invoice.currency)}</span>
            </Link>
          ))}
        </div>
      )}
      {total > invoices.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Zobrazeno {invoices.length} z {total}. Zúžte hledání.</p>
      ) : null}
    </div>
  );
}

function text(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function href(params: { q: string; stav: string; druh: string }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.stav && params.stav !== "all") search.set("stav", params.stav);
  if (params.druh && params.druh !== "all") search.set("druh", params.druh);
  const query = search.toString();
  return query ? `/faktury?${query}` : "/faktury";
}
