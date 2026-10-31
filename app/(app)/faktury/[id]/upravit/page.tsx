import Link from "next/link";
import { InvoiceForm } from "@/components/invoice-form";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCustomers, getInvoice, getNextNumber } from "@/lib/queries";
import { suggestNextNumber } from "@/lib/status";

export const metadata = { title: "Upravit doklad" };

export default async function EditInvoicePage({ params }: PageProps<"/faktury/[id]/upravit">) {
  const { id } = await params;
  const [invoice, customers, numbers] = await Promise.all([getInvoice(id), getCustomers(), getNextNumber()]);
  if (!invoice) {
    return (
      <MissingRecord
        title="Doklad v evidenci není"
        description="Upravovat jde jen doklad, který je pořád v evidenci."
        href="/faktury"
        label="Zpět na faktury"
      />
    );
  }
  if (invoice.status === "paid") {
    return (
      <div>
        <PageHeader
          eyebrow="Doklady"
          title={invoice.number}
          description="Uhrazený doklad je jen ke čtení. Před úpravou zrušte úhradu."
          action={
            <Link href={`/faktury/${invoice.id}`} className={buttonVariants()}>
              Zpět na doklad
            </Link>
          }
        />
        <div className="rounded-xl bg-card px-5 py-8 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Stejně jako v původní MJ Faktura zůstávají vyřízené / uhrazené doklady bez možnosti přímé editace, aby se neměnila historie plateb.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader eyebrow="Doklady" title={`Upravit ${invoice.number}`} description="Změna se uloží jen v této evidenci." />
      <InvoiceForm customers={customers} invoice={invoice} suggestedNumber={suggestNextNumber(numbers)} />
    </div>
  );
}
