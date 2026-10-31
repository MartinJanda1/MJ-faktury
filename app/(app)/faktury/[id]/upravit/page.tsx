import { InvoiceForm } from "@/components/invoice-form";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
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
  return (
    <div>
      <PageHeader eyebrow="Doklady" title={`Upravit ${invoice.number}`} description="Změna se uloží jen v této evidenci." />
      <InvoiceForm customers={customers} invoice={invoice} suggestedNumber={suggestNextNumber(numbers)} />
    </div>
  );
}
