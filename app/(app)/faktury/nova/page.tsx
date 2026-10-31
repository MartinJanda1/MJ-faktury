import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { getCompany, getCustomers, getNextNumber } from "@/lib/queries";
import { suggestNextNumber } from "@/lib/status";

export const metadata = { title: "Nová faktura" };

export default async function NewInvoicePage() {
  const [customers, numbers, company] = await Promise.all([getCustomers(), getNextNumber(), getCompany()]);
  return (
    <div>
      <PageHeader
        eyebrow="Doklady"
        title="Nová faktura"
        description="Číslo navazuje na poslední doklad v evidenci. Odběratele vyberete z adresáře."
      />
      <InvoiceForm customers={customers} company={company} suggestedNumber={suggestNextNumber(numbers)} />
    </div>
  );
}
