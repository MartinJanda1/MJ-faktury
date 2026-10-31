import Link from "next/link";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { deleteInvoiceAction, markPaidAction, markUnpaidAction } from "@/lib/actions";
import { formatDate, formatMoney, formatQuantity } from "@/lib/money";
import { getCompany, getInvoice } from "@/lib/queries";
import { kindLabel, sourceLabel } from "@/lib/status";

export async function generateMetadata({ params }: PageProps<"/faktury/[id]">) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice ? invoice.number : "Doklad" };
}

export default async function InvoicePage({ params }: PageProps<"/faktury/[id]">) {
  const { id } = await params;
  const [invoice, company] = await Promise.all([getInvoice(id), getCompany()]);
  if (!invoice) {
    return (
      <MissingRecord
        title="Doklad v evidenci není"
        description="Odkaz vede na fakturu, která tu není. Mohla být smazaná."
        href="/faktury"
        label="Zpět na faktury"
      />
    );
  }
  const account = [company.bankAccount && company.bankCode ? `${company.bankAccount}/${company.bankCode}` : company.bankAccount, company.iban]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        eyebrow={kindLabel(invoice.kind)}
        title={invoice.number}
        description={invoice.description || invoice.customerName}
        action={
          <>
            <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
            <Link href={`/tisk/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>
              Tisk
            </Link>
            <Link href={`/faktury/${invoice.id}/upravit`} className={buttonVariants({ variant: "outline" })}>
              Upravit
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Položka</th>
                  <th className="py-2 font-medium">Množství</th>
                  <th className="py-2 text-right font-medium">Cena bez DPH</th>
                  <th className="py-2 text-right font-medium">DPH</th>
                  <th className="py-2 text-right font-medium">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2">
                      {formatQuantity(item.quantity)} {item.unit}
                    </td>
                    <td className="py-2 text-right">{formatMoney(item.unitPrice, invoice.currency)}</td>
                    <td className="py-2 text-right">{item.vatRate} %</td>
                    <td className="py-2 text-right">{formatMoney(item.totalGross, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid justify-end gap-1 text-sm">
            <p>Základ {formatMoney(invoice.totalNet, invoice.currency)}</p>
            <p>DPH {formatMoney(invoice.totalVat, invoice.currency)}</p>
            <p className="text-base font-medium">Celkem {formatMoney(invoice.totalGross, invoice.currency)}</p>
          </div>
          {invoice.note ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{invoice.note}</p> : null}
        </section>
        <aside className="grid gap-4">
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="font-medium">Odběratel</h2>
            {invoice.customerId ? (
              <Link href={`/odberatele/${invoice.customerId}`} className="mt-2 block font-medium hover:underline">
                {invoice.customerName}
              </Link>
            ) : (
              <p className="mt-2 font-medium">{invoice.customerName || "Neuveden"}</p>
            )}
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {[invoice.customerStreet, [invoice.customerZip, invoice.customerCity].filter(Boolean).join(" "), invoice.customerCountry]
                .filter(Boolean)
                .join(", ") || "Adresa není vyplněná"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {invoice.customerIco ? `IČO ${invoice.customerIco}` : ""}
              {invoice.customerDic ? ` · DIČ ${invoice.customerDic}` : ""}
            </p>
          </section>
          <section className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
            <Row label="Vystaveno" value={formatDate(invoice.issueDate)} />
            <Row label="Splatnost" value={formatDate(invoice.dueDate)} />
            <Row label="DUZP" value={formatDate(invoice.taxDate)} />
            <Row label="Úhrada" value={formatDate(invoice.paidDate)} />
            <Row label="Variabilní symbol" value={invoice.variableSymbol || "—"} />
            <Row label="Účet" value={account || "Doplňte v nastavení"} />
            <Row label="Původ" value={sourceLabel(invoice.source)} />
          </section>
          <div className="flex flex-wrap gap-2">
            {invoice.status === "paid" ? (
              <form action={markUnpaidAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Označit jako neuhrazené
                </button>
              </form>
            ) : (
              <form action={markPaidAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className={buttonVariants()}>
                  Označit jako uhrazené
                </button>
              </form>
            )}
            <ConfirmDelete
              action={deleteInvoiceAction}
              id={invoice.id}
              title="Smazat doklad?"
              description="Doklad zmizí z evidence. V iDokladu se nic nemění."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
