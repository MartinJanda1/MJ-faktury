import { ImportPanel } from "@/components/import-panel";
import { PageHeader } from "@/components/page-header";
import { getCompany } from "@/lib/queries";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const company = await getCompany();
  return (
    <div>
      <PageHeader
        eyebrow="Přenos"
        title="Import z iDokladu"
        description="Heslo k účtu na idoklad.cz sem nepatří. Data stáhnete buď API klíči, které si vygenerujete vy, nebo souborem, který si z iDokladu uložíte sami."
      />
      <div className="max-w-3xl rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <ImportPanel clientId={company.idokladClientId} hasSecret={company.hasIdokladSecret} />
      </div>
    </div>
  );
}
