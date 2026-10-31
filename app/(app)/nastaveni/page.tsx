import { CompanyForm } from "@/components/company-form";
import { PageHeader } from "@/components/page-header";
import { getCompany } from "@/lib/queries";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const company = await getCompany();
  return (
    <div>
      <PageHeader
        eyebrow="Firma"
        title="Nastavení"
        description="Tyto údaje se tisknou jako dodavatel. Když je firma prázdná, první import je doplní z iDokladu nebo z ISDOC."
      />
      <CompanyForm company={company} />
    </div>
  );
}
