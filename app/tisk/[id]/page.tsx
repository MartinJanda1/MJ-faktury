import Link from "next/link";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoicePdfActions } from "@/components/invoice-pdf-actions";
import { DEFAULT_LAYOUT, normalizeLayout } from "@/lib/invoice-fields";
import { getCompany, getInvoice } from "@/lib/queries";

export default async function PrintPage({
  params,
  searchParams,
}: PageProps<"/tisk/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const autoPdf = (Array.isArray(query.pdf) ? query.pdf[0] : query.pdf) === "1";
  const layoutRaw = Array.isArray(query.layout) ? query.layout[0] : query.layout;
  const layout = layoutRaw ? normalizeLayout(layoutRaw) : DEFAULT_LAYOUT;
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

  return (
    <div className="invoice-document-shell min-h-screen">
      <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3">
        <Link
          href={`/faktury/${invoice.id}`}
          className="text-sm text-[#00b5c8] hover:underline"
        >
          ← Zpět na doklad
        </Link>
        <InvoicePdfActions
          autoPdf={autoPdf}
          filename={invoice.number}
          initialLayout={layoutRaw ? layout : undefined}
          syncUrl
          useStoredPreference
        />
      </div>
      <InvoiceDocument invoice={invoice} company={company} layout={layout} />
    </div>
  );
}
