import Link from "next/link";
import { InvoiceListActions } from "@/components/invoice-list-actions";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney, todayPrague } from "@/lib/money";
import { getInvoiceFilterMeta, getInvoices, type InvoiceSort, type SortDirection } from "@/lib/queries";
import { isInvoiceEditable } from "@/lib/status";
import { cn } from "@/lib/utils";

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

type FilterState = {
  q: string;
  stav: string;
  rok: string;
  mesic: string;
  odberatel: string;
  razeni: InvoiceSort;
  smer: SortDirection;
};

export default async function InvoicesPage({ searchParams }: PageProps<"/faktury">) {
  const params = await searchParams;
  const query = text(params.q);
  const status = text(params.stav) || "all";
  const year = text(params.rok);
  const month = text(params.mesic);
  const customerId = text(params.odberatel);
  const sort = (text(params.razeni) as InvoiceSort) || "issue";
  const dir = (text(params.smer) as SortDirection) || "desc";
  const [{ invoices, total }, meta] = await Promise.all([
    getInvoices({ query, status, year, month, customerId, sort, dir }),
    getInvoiceFilterMeta(),
  ]);
  const currentYear = todayPrague().slice(0, 4);
  const years = meta.years.length ? meta.years : [currentYear];
  const filter: FilterState = {
    q: query,
    stav: status,
    rok: year,
    mesic: month,
    odberatel: customerId,
    razeni: sort,
    smer: dir,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Doklady"
        title="Faktury"
        description="Filtrování podle období, stavu a odběratele. Hledání bere číslo, odběratele, IČO i variabilní symbol."
        action={
          <Link href="/faktury/nova" className={buttonVariants()}>
            Nová faktura
          </Link>
        }
      />

      <div className="mb-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_10rem_minmax(10rem,1fr)_auto]">
          <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-1">
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
            <span className="text-muted-foreground">Odběratel</span>
            <select name="odberatel" defaultValue={customerId} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Všichni</option>
              {meta.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="stav" value={status} />
          <input type="hidden" name="razeni" value={sort} />
          <input type="hidden" name="smer" value={dir} />
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonVariants()}>
              Filtrovat
            </button>
            <Link href="/faktury" className={buttonVariants({ variant: "outline" })}>
              Zrušit
            </Link>
          </div>
        </form>

        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-sm text-muted-foreground">Stav faktury</p>
          <div className="flex flex-wrap gap-2">
            {statuses.map(([value, label]) => (
              <Link
                key={value}
                href={href({ ...filter, stav: value })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm",
                  status === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
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
          <div className="hidden grid-cols-[7rem_minmax(0,1fr)_7rem_7rem_6rem_minmax(12rem,auto)] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground lg:grid">
            <SortLink filter={filter} column="number" label="Číslo" />
            <SortLink filter={filter} column="customer" label="Odběratel" />
            <SortLink filter={filter} column="issue" label="Vystaveno" />
            <SortLink filter={filter} column="status" label="Stav" />
            <SortLink filter={filter} column="total" label="Celkem" className="text-right" />
            <span className="text-right">Akce</span>
          </div>
          {invoices.map((invoice) => {
            const listHref = href(filter);
            return (
              <div
                key={invoice.id}
                className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 lg:grid-cols-[7rem_minmax(0,1fr)_7rem_7rem_6rem_minmax(12rem,auto)] lg:items-center lg:gap-3"
              >
                <Link href={`/faktury/${invoice.id}`} className="font-medium hover:underline">
                  {invoice.number}
                </Link>
                <Link href={`/faktury/${invoice.id}`} className="truncate text-sm hover:underline">
                  {invoice.customerName || "Bez odběratele"}
                </Link>
                <span className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</span>
                <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
                <span className="text-sm lg:text-right">{formatMoney(invoice.totalGross, invoice.currency)}</span>
                <InvoiceListActions
                  id={invoice.id}
                  number={invoice.number}
                  status={invoice.status}
                  editable={isInvoiceEditable(invoice)}
                  returnTo={listHref}
                />
              </div>
            );
          })}
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

function SortLink({
  filter,
  column,
  label,
  className,
}: {
  filter: FilterState;
  column: InvoiceSort;
  label: string;
  className?: string;
}) {
  const active = filter.razeni === column;
  const nextDir: SortDirection = active && filter.smer === "asc" ? "desc" : active ? "asc" : column === "issue" || column === "total" ? "desc" : "asc";
  const marker = active ? (filter.smer === "asc" ? " ↑" : " ↓") : "";
  return (
    <Link href={href({ ...filter, razeni: column, smer: nextDir })} className={cn("hover:text-foreground", className)}>
      {label}
      {marker}
    </Link>
  );
}

function text(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function href(params: FilterState) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.stav && params.stav !== "all") search.set("stav", params.stav);
  if (params.rok) search.set("rok", params.rok);
  if (params.mesic) search.set("mesic", params.mesic);
  if (params.odberatel) search.set("odberatel", params.odberatel);
  if (params.razeni && params.razeni !== "issue") search.set("razeni", params.razeni);
  if (params.smer && !(params.razeni === "issue" && params.smer === "desc")) search.set("smer", params.smer);
  const query = search.toString();
  return query ? `/faktury?${query}` : "/faktury";
}
