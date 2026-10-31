import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { getCustomers, getNextNumber } from "@/lib/queries";
import { suggestNextNumber } from "@/lib/status";

export const metadata = { title: "Nová faktura" };

export default async function NewInvoicePage() {
  const [customers, numbers] = await Promise.all([getCustomers(), getNextNumber()]);
  return (
    <div>
      <PageHeader eyebrow="Doklady" title="Nová faktura" description="Číslo navazuje na poslední doklad v evidenci. Odběratele můžete vybrat, nebo zapsat nového." />
      <InvoiceForm customers={customers} suggestedNumber={suggestNextNumber(numbers)} />
    </div>
  );
}
