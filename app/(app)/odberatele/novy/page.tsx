import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Nový odběratel" };

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader eyebrow="Adresář" title="Nový odběratel" description="Stačí název. IČO a adresu doplníte, až je budete mít." />
      <CustomerForm />
    </div>
  );
}
