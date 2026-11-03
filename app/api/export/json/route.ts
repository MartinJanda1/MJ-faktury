import { NextResponse } from "next/server";
import { connection } from "next/server";
import { loadStore } from "@/lib/store";
import { withInvoiceDefaults } from "@/lib/invoice-fields";
import { requireTenantId } from "@/lib/tenant-session";

export const dynamic = "force-dynamic";

/** Backup export compatible with faktura-app JSON import (active tenant only). */
export async function GET() {
  await connection();
  const tenantId = await requireTenantId();
  const doc = await loadStore();
  const tenant = doc.tenants.find((row) => row.id === tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Nejste přihlášeni k firmě." }, { status: 401 });
  }

  const invoices = tenant.invoices.map((invoice) => {
    const full = withInvoiceDefaults(invoice);
    const items = tenant.items
      .filter((item) => item.invoiceId === invoice.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        desc: item.name,
        qty: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }));
    const account =
      tenant.company.bankAccount && tenant.company.bankCode
        ? `${tenant.company.bankAccount}/${tenant.company.bankCode}`
        : tenant.company.bankAccount || "";
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
        iban: tenant.company.iban || "",
        swift: tenant.company.swift || "",
        variableSymbol: full.variableSymbol || "",
        constantSymbol: full.constantSymbol || "",
        method: full.paymentMethod || "Převodem",
      },
      supplier: {
        name: tenant.company.name,
        ico: tenant.company.ico,
        dic: tenant.company.dic,
        address: tenant.company.street,
        city: [tenant.company.zip, tenant.company.city].filter(Boolean).join(" "),
        country: tenant.company.country,
        email: tenant.company.email,
        phone: tenant.company.phone,
        vatNote: tenant.company.vatNote,
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
