import { CustomerForm } from "@/components/customer-form";
import { MissingRecord } from "@/components/missing-record";
import { PageHeader } from "@/components/page-header";
import { getCustomer } from "@/lib/queries";

export const metadata = { title: "Upravit odběratele" };

export default async function EditCustomerPage({ params }: PageProps<"/odberatele/[id]/upravit">) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return (
      <MissingRecord
        title="Odběratel v adresáři není"
        description="Upravovat jde jen kontakt, který je pořád v adresáři."
        href="/odberatele"
        label="Zpět na odběratele"
      />
    );
  }
  return (
    <div>
      <PageHeader eyebrow="Adresář" title={customer.name} description="Úprava platí pro tuto evidenci. Další import z iDokladu může stejný kontakt znovu přepsat." />
      <CustomerForm customer={customer} />
    </div>
  );
}
