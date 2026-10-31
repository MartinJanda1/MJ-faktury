import { PageHeader } from "@/components/page-header";
import { StatsDashboard } from "@/components/stats-dashboard";
import { getStatsInvoices } from "@/lib/queries";

export const metadata = { title: "Statistiky" };

export default async function StatisticsPage() {
  const invoices = await getStatsInvoices();
  return (
    <div>
      <PageHeader
        eyebrow="Přehledy"
        title="Statistiky"
        description="Obrat, hodiny a odběratelé podle zvoleného období."
      />
      {invoices.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 ring-1 ring-foreground/10">
          <h2 className="text-xl font-medium">Zatím bez dat</h2>
          <p className="mt-2 text-sm text-muted-foreground">Importujte faktury, nebo vystavte první doklad.</p>
        </div>
      ) : (
        <StatsDashboard invoices={invoices} />
      )}
    </div>
  );
}
