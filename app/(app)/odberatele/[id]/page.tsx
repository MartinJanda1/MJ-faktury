import Link from "next/link";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { deleteCustomerAction } from "@/lib/actions";
import { formatDate, formatMoney } from "@/lib/money";
import { getCustomer, getInvoices } from "@/lib/queries";
import { sourceLabel } from "@/lib/status";

export async function generateMetadata({ params }: PageProps<"/odberatele/[id]">) {
  const { id } = await params;
  const customer = await getCustomer(id);
  return { title: customer?.name ?? "Odběratel" };
}

export default async function CustomerPage({ params }: PageProps<"/odberatele/[id]">) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return (
      <MissingRecord
        title="Odběratel v adresáři není"
        description="Odkaz vede na kontakt, který tu není."
        href="/odberatele"
        label="Zpět na odběratele"
      />
    );
  }
  const { invoices } = await getInvoices({ customerId: id });
  return (
    <div>
      <PageHeader
        eyebrow="Odběratel"
        title={customer.name}
        description={[customer.ico ? `IČO ${customer.ico}` : "", customer.dic ? `DIČ ${customer.dic}` : ""].filter(Boolean).join(" · ") || "Bez IČO a DIČ"}
        action={
          <Link href={`/odberatele/${customer.id}/upravit`} className={buttonVariants({ variant: "outline" })}>
            Upravit
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
          <p>{[customer.street, [customer.zip, customer.city].filter(Boolean).join(" "), customer.country].filter(Boolean).join(", ") || "Adresa není vyplněná"}</p>
          <p className="mt-2 text-muted-foreground">{customer.email || "E-mail není vyplněný"}</p>
          <p className="text-muted-foreground">{customer.phone || "Telefon není vyplněný"}</p>
          <div className="mt-4 space-y-1 border-t border-border pt-3">
            <p className="font-medium">Bankovní údaje</p>
            {customer.bankAccount || customer.bankCode || customer.iban || customer.swift || customer.bankName ? (
              <>
                <p>
                  {[
                    customer.bankAccount && customer.bankCode
                      ? `${customer.bankAccount}/${customer.bankCode}`
                      : customer.bankAccount || "",
                    customer.bankName,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                {customer.iban ? <p className="text-muted-foreground">IBAN: {customer.iban}</p> : null}
                {customer.swift ? <p className="text-muted-foreground">SWIFT: {customer.swift}</p> : null}
              </>
            ) : (
              <p className="text-muted-foreground">Bankovní údaje nejsou vyplněné</p>
            )}
          </div>
          {customer.note ? <p className="mt-3 leading-6">{customer.note}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">Zdroj: {sourceLabel(customer.source)}</p>
          <div className="mt-4">
            <ConfirmDelete
              action={deleteCustomerAction}
              id={customer.id}
              title="Smazat odběratele?"
              description="Doklady zůstanou, zmizí jen záznam v adresáři."
            />
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Doklady</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">K tomuto odběrateli zatím není žádný doklad.</p>
          ) : (
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {invoices.map((invoice) => (
                <Link key={invoice.id} href={`/faktury/${invoice.id}`} className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                  <span className="font-medium">{invoice.number}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</span>
                  <span className="flex items-center gap-2 sm:justify-end">
                    <StatusBadge status={invoice.status} dueDate={invoice.dueDate} paidDate={invoice.paidDate} />
                    <span className="text-sm">{formatMoney(invoice.totalGross, invoice.currency)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
