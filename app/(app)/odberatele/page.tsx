import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { getCustomers } from "@/lib/queries";

export const metadata = { title: "Odběratelé" };

export default async function CustomersPage({ searchParams }: PageProps<"/odberatele">) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const customers = await getCustomers(query);
  return (
    <div>
      <PageHeader
        eyebrow="Adresář"
        title="Odběratelé"
        description="iDoklad má jeden adresář, takže import přenese všechny kontakty, nejen odběratele."
        action={
          <Link href="/odberatele/novy" className={buttonVariants()}>
            Nový odběratel
          </Link>
        }
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input name="q" defaultValue={query} placeholder="Název, IČO, DIČ nebo e-mail" className="sm:max-w-sm" />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Hledat
        </button>
      </form>
      {customers.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 ring-1 ring-foreground/10">
          <h2 className="text-xl font-medium">{query ? "Nikdo neodpovídá hledání" : "Adresář je prázdný"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Přidejte odběratele ručně, nebo je stáhněte spolu s fakturami.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {customers.map((customer) => (
            <Link key={customer.id} href={`/odberatele/${customer.id}`} className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_8rem_10rem] sm:items-center">
              <span className="font-medium">{customer.name}</span>
              <span className="text-sm text-muted-foreground">{customer.ico ? `IČO ${customer.ico}` : "bez IČO"}</span>
              <span className="truncate text-sm text-muted-foreground">{customer.email || customer.city}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
