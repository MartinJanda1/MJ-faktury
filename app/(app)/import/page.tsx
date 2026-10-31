import { ImportPanel } from "@/components/import-panel";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCompany } from "@/lib/queries";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const company = await getCompany();
  return (
    <div>
      <PageHeader
        eyebrow="Přenos"
        title="Import z iDokladu"
        description="API klíč není potřeba. Stačí export CSV nebo Excelu, který si stáhnete sami v iDokladu, a nahrání sem."
        action={
          <a href="/api/export/json" className={buttonVariants({ variant: "outline" })}>
            Stáhnout zálohu JSON
          </a>
        }
      />
      <ol className="mb-6 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>
          V iDokladu otevřete <strong className="font-medium text-foreground">Prodej → Faktury vydané</strong> (případně i Kontakty).
        </li>
        <li>
          Klikněte na <strong className="font-medium text-foreground">Export</strong>, vyberte CSV nebo XLSX. Stačí výchozí sloupce ze seznamu faktur
          (včetně <strong className="font-medium text-foreground">Název/Jméno</strong>, IČ, dat a částky).
        </li>
        <li>Soubor nahrajte níže. Opakovaný import aktualizuje doklady se stejným číslem a doplní odběratele.</li>
      </ol>
      <div className="max-w-3xl rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <ImportPanel clientId={company.idokladClientId} hasSecret={company.hasIdokladSecret} />
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        Export seznamu přenese hlavičku faktury, odběratele a částky. Položkový rozpis v CSV ze seznamu obvykle není — u každé faktury
        vznikne souhrnná položka. Pokud budete chtít i jednotlivé řádky, exportujte ISDOC z detailu dokladu. Zálohu celé evidence
        stáhnete jako JSON (kompatibilní s importem faktura-app).
      </p>
    </div>
  );
}
