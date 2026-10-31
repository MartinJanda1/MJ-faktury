import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatMoney, formatQuantity } from "@/lib/money";
import { getCompany, getInvoice } from "@/lib/queries";
import { kindLabel } from "@/lib/status";

export default async function PrintPage({
  params,
  searchParams,
}: PageProps<"/tisk/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const autoPdf = (Array.isArray(query.pdf) ? query.pdf[0] : query.pdf) === "1";
  const [invoice, company] = await Promise.all([getInvoice(id), getCompany()]);
  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-heading text-3xl">Doklad v evidenci není</h1>
        <Link href="/faktury" className="mt-4 inline-block text-sm underline">
          Zpět na faktury
        </Link>
      </div>
    );
  }
  const account = company.bankAccount && company.bankCode ? `${company.bankAccount}/${company.bankCode}` : company.bankAccount;
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white px-6 py-8 text-neutral-900">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href={`/faktury/${invoice.id}`} className="text-sm underline">
          Zpět na doklad
        </Link>
        <PrintButton auto={autoPdf} />
      </div>
      <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
        <div>
          <p className="text-sm tracking-wide text-neutral-500 uppercase">{kindLabel(invoice.kind)}</p>
          <h1 className="font-heading text-4xl">{invoice.number}</h1>
        </div>
        <div className="text-right text-sm leading-6">
          <p>Vystaveno {formatDate(invoice.issueDate)}</p>
          <p>Splatnost {formatDate(invoice.dueDate)}</p>
          <p>DUZP {formatDate(invoice.taxDate)}</p>
          {invoice.variableSymbol ? <p>VS {invoice.variableSymbol}</p> : null}
        </div>
      </header>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Party title="Dodavatel" name={company.name || "Doplňte firmu v nastavení"} lines={[company.street, [company.zip, company.city].filter(Boolean).join(" "), company.ico ? `IČO ${company.ico}` : "", company.dic ? `DIČ ${company.dic}` : "", company.email]} />
        <Party title="Odběratel" name={invoice.customerName || "—"} lines={[invoice.customerStreet, [invoice.customerZip, invoice.customerCity].filter(Boolean).join(" "), invoice.customerIco ? `IČO ${invoice.customerIco}` : "", invoice.customerDic ? `DIČ ${invoice.customerDic}` : "", invoice.customerEmail]} />
      </div>
      {invoice.description ? <p className="mt-6 text-sm">{invoice.description}</p> : null}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-2 font-medium">Položka</th>
            <th className="py-2 font-medium">Množství</th>
            <th className="py-2 text-right font-medium">Bez DPH</th>
            <th className="py-2 text-right font-medium">DPH</th>
            <th className="py-2 text-right font-medium">Celkem</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-200">
              <td className="py-2">{item.name}</td>
              <td className="py-2">
                {formatQuantity(item.quantity)} {item.unit}
              </td>
              <td className="py-2 text-right">{formatMoney(item.totalNet, invoice.currency)}</td>
              <td className="py-2 text-right">{item.vatRate} %</td>
              <td className="py-2 text-right">{formatMoney(item.totalGross, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 text-sm">
        <p className="flex justify-between"><span>Základ</span><span>{formatMoney(invoice.totalNet, invoice.currency)}</span></p>
        <p className="flex justify-between"><span>DPH</span><span>{formatMoney(invoice.totalVat, invoice.currency)}</span></p>
        <p className="mt-1 flex justify-between border-t border-neutral-400 pt-2 text-base font-medium"><span>Celkem</span><span>{formatMoney(invoice.totalGross, invoice.currency)}</span></p>
      </div>
      <div className="mt-8 text-sm leading-6">
        {account ? <p>Účet {account}</p> : null}
        {company.iban ? <p>IBAN {company.iban}</p> : null}
        {invoice.constantSymbol ? <p>Konstantní symbol {invoice.constantSymbol}</p> : null}
        {invoice.note ? <p className="mt-3">{invoice.note}</p> : null}
      </div>
    </div>
  );
}

function Party({ title, name, lines }: { title: string; name: string; lines: string[] }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-neutral-500 uppercase">{title}</p>
      <p className="mt-1 font-medium">{name}</p>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="text-sm">
          {line}
        </p>
      ))}
    </div>
  );
}
