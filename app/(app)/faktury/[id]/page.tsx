import Link from "next/link";
import { ConfirmDelete } from "@/components/confirm-delete";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoicePdfActions } from "@/components/invoice-pdf-actions";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  duplicateInvoiceAction,
  markPaidAction,
  markUnpaidAction,
  restoreInvoiceAction,
} from "@/lib/actions";
import { DEFAULT_LAYOUT } from "@/lib/invoice-fields";
import { getCompany, getInvoice } from "@/lib/queries";
import { isInvoiceReadOnly, kindLabel } from "@/lib/status";

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

  const isPaid = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";
  const readOnly = isInvoiceReadOnly(invoice);

  return (
    <div>
      <div className="no-print" data-print-hide>
        <PageHeader
          eyebrow={kindLabel(invoice.kind)}
          title={invoice.number}
          action={
            <>
              <StatusBadge
                status={invoice.status}
                dueDate={invoice.dueDate}
                paidDate={invoice.paidDate}
                size="lg"
              />
              {readOnly ? null : (
                <Link href={`/faktury/${invoice.id}/upravit`} className={buttonVariants({ variant: "outline" })}>
                  Upravit
                </Link>
              )}
            </>
          }
        />
        {isPaid ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900">
            Uhrazený doklad — pouze ke čtení. Pro úpravu nejprve zrušte úhradu.
          </p>
        ) : null}
        {isCancelled ? (
          <p className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Stornovaný doklad — pouze ke čtení. Pro úpravu nejprve zrušte storno.
          </p>
        ) : null}
        <div className="mb-4 flex flex-wrap gap-2">
          {!isPaid && !isCancelled ? (
            <form action={markPaidAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className={buttonVariants()}>
                Označit jako uhrazené
              </button>
            </form>
          ) : null}
          {isPaid ? (
            <form action={markUnpaidAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Zrušit úhradu
              </button>
            </form>
          ) : null}
          <form action={duplicateInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Kopírovat a vytvořit novou
            </button>
          </form>
          {!isCancelled ? (
            <form action={cancelInvoiceAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Stornovat
              </button>
            </form>
          ) : (
            <form action={restoreInvoiceAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Zrušit storno
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

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Náhled (moderní). Vzhled PDF zvolíte před stažením.
          </p>
          <InvoicePdfActions filename={invoice.number} />
        </div>
      </div>

      <div className="invoice-document-shell overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <InvoiceDocument invoice={invoice} company={company} layout={DEFAULT_LAYOUT} />
      </div>
    </div>
  );
}
