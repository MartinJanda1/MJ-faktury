import { NextResponse } from "next/server";
import { connection } from "next/server";
import { loadStore } from "@/lib/store";
import { withInvoiceDefaults } from "@/lib/invoice-fields";

export const dynamic = "force-dynamic";

/** Backup export compatible with faktura-app JSON import. */
export async function GET() {
  await connection();
  const doc = await loadStore();
  const invoices = doc.invoices.map((invoice) => {
    const full = withInvoiceDefaults(invoice);
    const items = doc.items
      .filter((item) => item.invoiceId === invoice.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        desc: item.name,
        qty: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }));
    const account =
      doc.company.bankAccount && doc.company.bankCode
        ? `${doc.company.bankAccount}/${doc.company.bankCode}`
        : doc.company.bankAccount || "";
    return {
      id: invoice.id,
      invoiceNumber: full.number,
      layout: full.layout,
      cancelled: full.status === "cancelled",
      resolved: full.status === "paid" || Boolean(full.paidDate),
      dates: {
        issue: full.issueDate,
        due: full.dueDate,
        orderNumber: full.orderNumber || "",
      },
      payment: {
        accountNumber: account,
        iban: doc.company.iban || "",
        swift: doc.company.swift || "",
        variableSymbol: full.variableSymbol || "",
        constantSymbol: full.constantSymbol || "",
        method: full.paymentMethod || "Převodem",
      },
      supplier: {
        name: doc.company.name,
        ico: doc.company.ico,
        dic: doc.company.dic,
        address: doc.company.street,
        city: [doc.company.zip, doc.company.city].filter(Boolean).join(" "),
        country: doc.company.country,
        email: doc.company.email,
        phone: doc.company.phone,
        vatNote: doc.company.vatNote,
      },
      customer: {
        name: full.customerName,
        ico: full.customerIco,
        dic: full.customerDic,
        address: full.customerStreet,
        city: [full.customerZip, full.customerCity].filter(Boolean).join(" "),
        country: full.customerCountry,
        email: full.customerEmail,
      },
      items,
      importedFrom: {
        paidAt: full.paidDate,
        paidAmount: full.totalGross,
        paymentStatus: full.status === "paid" ? "uhrazeno" : "",
      },
    };
  });

  const payload = {
    type: "faktura-app-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    invoices,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mj-faktury-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
