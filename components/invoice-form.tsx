"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveInvoiceAction } from "@/lib/actions";
import { DEFAULT_LAYOUT, DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS } from "@/lib/invoice-fields";
import { formatMoney, lineTotals, parseAmount, todayPrague } from "@/lib/money";
import { kindLabel, statusLabel } from "@/lib/status";
import type { Company, Customer, Invoice, InvoiceKind, InvoiceLayout, InvoiceStatus } from "@/lib/types";
import { isNonVatPayer } from "@/lib/vat";

type ItemState = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
};

const emptyItem = (notVatPayer: boolean): ItemState => ({
  key: crypto.randomUUID(),
  name: "",
  quantity: "1",
  unit: "ks",
  unitPrice: "",
  vatRate: notVatPayer ? "0" : "21",
});

function plusDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function customerSummary(customer: {
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
}) {
  const address = [customer.street, [customer.zip, customer.city].filter(Boolean).join(" "), customer.country]
    .filter(Boolean)
    .join(", ");
  const ids = [customer.ico ? `IČO ${customer.ico}` : "", customer.dic ? `DIČ ${customer.dic}` : ""]
    .filter(Boolean)
    .join(" · ");
  return { address, ids, email: customer.email };
}

export function InvoiceForm({
  customers,
  company,
  invoice,
  suggestedNumber,
}: {
  customers: Customer[];
  company: Company;
  invoice?: Invoice;
  suggestedNumber: string;
}) {
  const [state, action, pending] = useActionState(saveInvoiceAction, { error: "" });
  const today = todayPrague();
  const [customerId, setCustomerId] = useState(invoice?.customerId ?? "");
  const [customerName, setCustomerName] = useState(invoice?.customerName ?? "");
  const [customerIco, setCustomerIco] = useState(invoice?.customerIco ?? "");
  const [customerDic, setCustomerDic] = useState(invoice?.customerDic ?? "");
  const [customerStreet, setCustomerStreet] = useState(invoice?.customerStreet ?? "");
  const [customerCity, setCustomerCity] = useState(invoice?.customerCity ?? "");
  const [customerZip, setCustomerZip] = useState(invoice?.customerZip ?? "");
  const [customerCountry, setCustomerCountry] = useState(invoice?.customerCountry || "Česká republika");
  const [customerEmail, setCustomerEmail] = useState(invoice?.customerEmail ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate || today);
  const [dueDate, setDueDate] = useState(invoice?.dueDate || plusDays(today, 14));
  const [taxDate, setTaxDate] = useState(invoice?.taxDate || today);
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "issued");
  const [kind, setKind] = useState<InvoiceKind>(invoice?.kind ?? "issued");
  const [layout, setLayout] = useState<InvoiceLayout>(invoice?.layout ?? DEFAULT_LAYOUT);
  const [paymentMethod, setPaymentMethod] = useState(invoice?.paymentMethod || DEFAULT_PAYMENT_METHOD);
  const [notVatPayer, setNotVatPayer] = useState(isNonVatPayer(company));
  const [items, setItems] = useState<ItemState[]>(
    invoice?.items.length
      ? invoice.items.map((item) => ({
          key: item.id,
          name: item.name,
          quantity: String(item.quantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          vatRate: String(isNonVatPayer(company) ? 0 : item.vatRate),
        }))
      : [emptyItem(isNonVatPayer(company))],
  );

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const preview = customerSummary({
    name: customerName,
    ico: customerIco,
    dic: customerDic,
    street: customerStreet,
    city: customerCity,
    zip: customerZip,
    country: customerCountry,
    email: customerEmail,
  });

  const totals = items.reduce(
    (sum, item) => {
      const vatRate = notVatPayer ? 0 : Number(item.vatRate) || 0;
      const line = lineTotals(parseAmount(item.quantity), parseAmount(item.unitPrice), vatRate);
      return {
        net: sum.net + line.totalNet,
        vat: sum.vat + line.totalVat,
        gross: sum.gross + line.totalGross,
      };
    },
    { net: 0, vat: 0, gross: 0 },
  );

  const payload = JSON.stringify(
    items.map((item) => ({
      name: item.name,
      quantity: parseAmount(item.quantity),
      unit: item.unit || "ks",
      unitPrice: parseAmount(item.unitPrice),
      vatRate: notVatPayer ? 0 : Number(item.vatRate) || 0,
    })),
  );

  function pickCustomer(id: string) {
    const customer = customers.find((row) => row.id === id);
    if (!customer) {
      setCustomerId("");
      return;
    }
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerIco(customer.ico);
    setCustomerDic(customer.dic);
    setCustomerStreet(customer.street);
    setCustomerCity(customer.city);
    setCustomerZip(customer.zip);
    setCustomerCountry(customer.country || "Česká republika");
    setCustomerEmail(customer.email);
  }

  function updateItem(key: string, patch: Partial<ItemState>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function setNotVatPayerFlag(checked: boolean) {
    setNotVatPayer(checked);
    if (checked) {
      setItems((current) => current.map((item) => ({ ...item, vatRate: "0" })));
    }
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="id" value={invoice?.id ?? ""} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="customerName" value={customerName} />
      <input type="hidden" name="customerIco" value={customerIco} />
      <input type="hidden" name="customerDic" value={customerDic} />
      <input type="hidden" name="customerStreet" value={customerStreet} />
      <input type="hidden" name="customerCity" value={customerCity} />
      <input type="hidden" name="customerZip" value={customerZip} />
      <input type="hidden" name="customerCountry" value={customerCountry} />
      <input type="hidden" name="customerEmail" value={customerEmail} />
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="layout" value={layout} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      {state.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="text-lg font-medium">Doklad</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Číslo">
            <Input name="number" defaultValue={invoice?.number || suggestedNumber} required />
          </Field>
          <Field label="Druh">
            <Select value={kind} onValueChange={(value) => setKind((value as InvoiceKind) || "issued")}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value) => (value ? kindLabel(value as InvoiceKind) : null)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issued">{kindLabel("issued")}</SelectItem>
                <SelectItem value="proforma">{kindLabel("proforma")}</SelectItem>
                <SelectItem value="credit_note">{kindLabel("credit_note")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vzhled">
            <Select value={layout} onValueChange={(value) => setLayout((value as InvoiceLayout) || "classic")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => (value === "idoklad" ? "iDoklad" : value === "classic" ? "Klasická" : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Klasická</SelectItem>
                <SelectItem value="idoklad">iDoklad</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Stav">
            <Select value={status} onValueChange={(value) => setStatus((value as InvoiceStatus) || "issued")}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value) => (value ? statusLabel(value as InvoiceStatus) : null)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{statusLabel("draft")}</SelectItem>
                <SelectItem value="issued">{statusLabel("issued")}</SelectItem>
                <SelectItem value="partial">{statusLabel("partial")}</SelectItem>
                <SelectItem value="paid">{statusLabel("paid")}</SelectItem>
                <SelectItem value="cancelled">{statusLabel("cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vystaveno">
            <Input
              type="date"
              name="issueDate"
              value={issueDate}
              onChange={(event) => {
                const next = event.target.value;
                setIssueDate(next);
                if (!invoice) {
                  setDueDate(plusDays(next, 14));
                  setTaxDate(next);
                }
              }}
              required
            />
          </Field>
          <Field label="Splatnost">
            <Input type="date" name="dueDate" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="DUZP">
            <Input type="date" name="taxDate" value={taxDate} onChange={(event) => setTaxDate(event.target.value)} />
          </Field>
          <Field label="Variabilní symbol">
            <Input name="variableSymbol" defaultValue={invoice?.variableSymbol ?? ""} />
          </Field>
          <Field label="Konstantní symbol">
            <Input name="constantSymbol" defaultValue={invoice?.constantSymbol ?? ""} />
          </Field>
          <Field label="Specifický symbol">
            <Input name="specificSymbol" defaultValue={invoice?.specificSymbol ?? ""} />
          </Field>
          <Field label="Způsob platby">
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value || DEFAULT_PAYMENT_METHOD)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value) => value || DEFAULT_PAYMENT_METHOD}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Číslo objednávky">
            <Input name="orderNumber" defaultValue={invoice?.orderNumber ?? ""} />
          </Field>
          <Field label="Měna">
            <Input name="currency" defaultValue={invoice?.currency || "CZK"} maxLength={3} />
          </Field>
          {status === "paid" || status === "partial" ? (
            <Field label="Datum úhrady">
              <Input type="date" name="paidDate" defaultValue={invoice?.paidDate || today} />
            </Field>
          ) : (
            <input type="hidden" name="paidDate" value="" />
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="notVatPayer"
            checked={notVatPayer}
            onChange={(event) => setNotVatPayerFlag(event.target.checked)}
            className="mt-0.5 size-4 accent-[oklch(0.38_0.07_155)]"
          />
          <span>
            <span className="font-medium">Nejsem plátce DPH</span>
            <span className="mt-0.5 block text-muted-foreground">
              DPH se na dokladu ani v součtech nezobrazí. Nastavení se uloží i k firmě.
            </span>
          </span>
        </label>
        <Field label="Předmět">
          <Input name="description" defaultValue={invoice?.description ?? ""} placeholder="Například správa webu za březen" />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Odběratel</h2>
          <Link href="/odberatele/novy" className="text-sm text-primary underline-offset-2 hover:underline">
            Nový odběratel
          </Link>
        </div>
        {customers.length > 0 ? (
          <Field label="Vybrat z adresáře">
            <Select value={customerId || null} onValueChange={(value) => pickCustomer(value || "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— vyberte odběratele —">
                  {(value) => {
                    if (!value) return null;
                    const customer = customers.find((row) => row.id === value);
                    return customer ? customer.name : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.ico ? ` · ${customer.ico}` : customer.city ? ` · ${customer.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            V adresáři zatím nikdo není. Nejdřív založte odběratele v{" "}
            <Link href="/odberatele/novy" className="text-foreground underline-offset-2 hover:underline">
              Odběratelích
            </Link>
            .
          </p>
        )}
        {customerName ? (
          <div className="grid gap-1 rounded-lg border border-border px-3 py-3 text-sm">
            <p className="font-medium">{selectedCustomer?.name || customerName}</p>
            {preview.ids ? <p className="text-muted-foreground">{preview.ids}</p> : null}
            {preview.address ? <p className="text-muted-foreground">{preview.address}</p> : null}
            {preview.email ? <p className="text-muted-foreground">{preview.email}</p> : null}
            {selectedCustomer ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Údaje měníte v{" "}
                <Link href={`/odberatele/${selectedCustomer.id}/upravit`} className="underline-offset-2 hover:underline">
                  kartě odběratele
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Položky</h2>
          <Button type="button" variant="outline" onClick={() => setItems((current) => [...current, emptyItem(notVatPayer)])}>
            Přidat položku
          </Button>
        </div>
        <div className="grid gap-3">
          {items.map((item, index) => {
            const vatRate = notVatPayer ? 0 : Number(item.vatRate) || 0;
            const line = lineTotals(parseAmount(item.quantity), parseAmount(item.unitPrice), vatRate);
            return (
              <div key={item.key} className="grid gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Položka {index + 1}</p>
                  {items.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}>
                      Odebrat
                    </Button>
                  ) : null}
                </div>
                <Field label="Název">
                  <Input value={item.name} onChange={(event) => updateItem(item.key, { name: event.target.value })} placeholder="Co fakturujete" />
                </Field>
                <div className={`grid grid-cols-2 gap-3 ${notVatPayer ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
                  <Field label="Množství">
                    <Input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} />
                  </Field>
                  <Field label="MJ">
                    <Input value={item.unit} onChange={(event) => updateItem(item.key, { unit: event.target.value })} />
                  </Field>
                  <Field label={notVatPayer ? "Cena" : "Cena bez DPH"}>
                    <Input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })} />
                  </Field>
                  {notVatPayer ? null : (
                    <Field label="DPH %">
                      <Select value={item.vatRate} onValueChange={(value) => updateItem(item.key, { vatRate: value || "21" })}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(value) => (value != null ? `${value} %` : null)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="21">21 %</SelectItem>
                          <SelectItem value="12">12 %</SelectItem>
                          <SelectItem value="15">15 %</SelectItem>
                          <SelectItem value="10">10 %</SelectItem>
                          <SelectItem value="0">0 %</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {notVatPayer ? `Celkem ${formatMoney(line.totalNet, "CZK")}` : `S DPH ${formatMoney(line.totalGross, "CZK")}`}
                </p>
              </div>
            );
          })}
        </div>
        <div className="grid justify-end gap-1 text-sm">
          {notVatPayer ? null : (
            <>
              <p>Základ {formatMoney(totals.net)}</p>
              <p>DPH {formatMoney(totals.vat)}</p>
            </>
          )}
          <p className="text-base font-medium">Celkem {formatMoney(notVatPayer ? totals.net : totals.gross)}</p>
        </div>
      </section>

      <Field label="Poznámka">
        <Textarea name="note" defaultValue={invoice?.note ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit doklad"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
