import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney, todayPrague } from "@/lib/money";
import { getInvoiceFilterMeta, getInvoices } from "@/lib/queries";
import { cn } from "cn";

export const metadata = { title: "Faktury" };

const statuses = [
  ["all", "Vše"],
  ["unpaid", "K úhradě"],
  ["overdue", "Po splatnosti"],
  ["paid", "Uhrazené"],
  ["partial", "Částečně"],
  ["draft", "Koncepty"],
  ["cancelled", "Storno"],
] as const;

const months = [
  ["", "Celý rok"],
  ["01", "Leden"],
  ["02", "Únor"],
  ["03", "Březen"],
  ["04", "Duben"],
  ["05", "Květen"],
  ["06", "Červen"],
  ["07", "Červenec"],
  ["08", "Srpen"],
  ["09", "Září"],
  ["10", "Říjen"],
  ["11", "Listopad"],
  ["12", "Prosinec"],
] as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/faktury">) {
  const params = await searchParams;
  const query = text(params.q);
  const status = text(params.stav) || "all";
  const year = text(params.rok);
  const month = text(params.mesic);
  const from = text(params.od);
  const to = text(params.do);
  const [{ invoices, total }, meta] = await Promise.all([
    getInvoices({ query, status, year, month, from, to }),
    getInvoiceFilterMeta(),
  ]);
  const currentYear = todayPrague().slice(0, 4);
  const years = meta.years.length ? meta.years : [currentYear];
  const filter = { q: query, stav: status, rok: year, mesic: month, od: from, do: to };

  return (
    <div>
      <PageHeader
        eyebrow="Doklady"
        title="Faktury"
        description="Filtrování podle období, stavu a čísla. Hledání bere i odběratele, IČO a variabilní symbol."
        action={
          <Link href="/faktury/nova" className={buttonVariants()}>
            Nová faktura
          </Link>
        }
      />

      <form className="mb-4 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-6">
        <label className="grid gap-1 text-sm lg:col-span-2">
          <span className="text-muted-foreground">Hledat</span>
          <Input name="q" defaultValue={query} placeholder="Číslo, odběratel, VS…" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Rok</span>
          <select name="rok" defaultValue={year} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">Všechny roky</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Měsíc</span>
          <select name="mesic" defaultValue={month} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
            {months.map(([value, label]) => (
              <option key={label} value={value}>
                {label}
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
        <input type="hidden" name="stav" value={status} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={buttonVariants()}>
            Filtrovat
          </button>
          <Link href="/faktury" className={buttonVariants({ variant: "outline" })}>
            Zrušit filtr
          </Link>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map(([value, label]) => (
          <Link
            key={value}
            href={href({ ...filter, stav: value })}
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
            <Link
              key={invoice.id}
              href={`/faktury/${invoice.id}`}
              className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[8rem_1fr_8rem_8rem_7rem] md:items-center md:gap-3"
            >
              <span className="font-medium">{invoice.number}</span>
              <span className="truncate text-sm">{invoice.customerName || "Bez odběratele"}</span>
              <span className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</span>
              <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
              <span className="text-sm md:text-right">{formatMoney(invoice.totalGross, invoice.currency)}</span>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {total > invoices.length
          ? `Zobrazeno ${invoices.length} z ${total}. Zúžte hledání.`
          : `${total} ${total === 1 ? "doklad" : total < 5 ? "doklady" : "dokladů"}`}
      </p>
    </div>
  );
}

function text(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function href(params: {
  q: string;
  stav: string;
  rok: string;
  mesic: string;
  od: string;
  do: string;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.stav && params.stav !== "all") search.set("stav", params.stav);
  if (params.rok) search.set("rok", params.rok);
  if (params.mesic) search.set("mesic", params.mesic);
  if (params.od) search.set("od", params.od);
  if (params.do) search.set("do", params.do);
  const query = search.toString();
  return query ? `/faktury?${query}` : "/faktury";
}
