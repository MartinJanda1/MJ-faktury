import { CompanyForm } from "@/components/company-form";
import { PageHeader } from "@/components/page-header";
import { resolveIban } from "@/lib/payment-qr";
import { getCompany } from "@/lib/queries";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const company = await getCompany();
  const account =
    company.bankAccount.includes("/")
      ? company.bankAccount
      : company.bankAccount && company.bankCode
        ? `${company.bankAccount}/${company.bankCode}`
        : company.bankAccount;
  const hasQrBank = Boolean(resolveIban(account, company.iban));
  return (
    <div>
      <PageHeader
        eyebrow="Firma"
        title="Nastavení"
        description="Tyto údaje se tisknou jako dodavatel. IČO firmy zároveň odemyká celou evidenci. Když je firma prázdná, první import je doplní z iDokladu nebo z ISDOC."
      />
      {hasQrBank ? null : (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Pro QR platbu na fakturách vyplňte číslo účtu s kódem banky, nebo IBAN (např.{" "}
          <span className="font-medium">2100132288/2010</span>).
        </p>
      )}
      <CompanyForm company={company} />
    </div>
  );
}
