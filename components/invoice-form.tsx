"use client";

import { useActionState, useMemo, useState } from "react";
import { AresLookup } from "@/components/ares-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveInvoiceAction } from "@/lib/actions";
import { DEFAULT_LAYOUT, DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS } from "@/lib/invoice-fields";
import { formatMoney, lineTotals, parseAmount, todayPrague } from "@/lib/money";
import type { Customer, Invoice, InvoiceKind, InvoiceLayout, InvoiceStatus } from "@/lib/types";

type ItemState = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
};

const emptyItem = (): ItemState => ({
  key: crypto.randomUUID(),
  name: "",
  quantity: "1",
  unit: "ks",
  unitPrice: "",
  vatRate: "21",
});

function plusDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InvoiceForm({
  customers,
  invoice,
  suggestedNumber,
}: {
  customers: Customer[];
  invoice?: Invoice;
  suggestedNumber: string;
}) {
  const [state, action, pending] = useActionState(saveInvoiceAction, { error: "" });
  const today = todayPrague();
  const [customerId, setCustomerId] = useState(invoice?.customerId ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
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
  const [items, setItems] = useState<ItemState[]>(
    invoice?.items.length
      ? invoice.items.map((item) => ({
          key: item.id,
          name: item.name,
          quantity: String(item.quantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          vatRate: String(item.vatRate),
        }))
      : [emptyItem()],
  );

  const filtered = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    const list = query
      ? customers.filter((customer) => `${customer.name} ${customer.ico} ${customer.city}`.toLowerCase().includes(query))
      : customers;
    return list.slice(0, 8);
  }, [customerQuery, customers]);

  const totals = items.reduce(
    (sum, item) => {
      const line = lineTotals(parseAmount(item.quantity), parseAmount(item.unitPrice), Number(item.vatRate) || 0);
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
      vatRate: Number(item.vatRate) || 0,
    })),
  );

  function pickCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerIco(customer.ico);
    setCustomerDic(customer.dic);
    setCustomerStreet(customer.street);
    setCustomerCity(customer.city);
    setCustomerZip(customer.zip);
    setCustomerCountry(customer.country || "Česká republika");
    setCustomerEmail(customer.email);
    setCustomerQuery("");
  }

  function updateItem(key: string, patch: Partial<ItemState>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="id" value={invoice?.id ?? ""} />
      <input type="hidden" name="customerId" value={customerId} />
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issued">Faktura</SelectItem>
                <SelectItem value="proforma">Zálohová faktura</SelectItem>
                <SelectItem value="credit_note">Dobropis</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vzhled">
            <Select value={layout} onValueChange={(value) => setLayout((value as InvoiceLayout) || "classic")}>
              <SelectTrigger className="w-full">
                <SelectValue />
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Koncept</SelectItem>
                <SelectItem value="issued">Vystaveno</SelectItem>
                <SelectItem value="partial">Částečně uhrazeno</SelectItem>
                <SelectItem value="paid">Uhrazeno</SelectItem>
                <SelectItem value="cancelled">Storno</SelectItem>
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
                <SelectValue />
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
        <Field label="Předmět">
          <Input name="description" defaultValue={invoice?.description ?? ""} placeholder="Například správa webu za březen" />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="text-lg font-medium">Odběratel</h2>
        {customers.length > 0 ? (
          <div className="grid gap-2">
            <Label htmlFor="customer-search">Vybrat z adresáře</Label>
            <Input
              id="customer-search"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Název, IČO nebo město"
            />
            {customerQuery || !customerId ? (
              <div className="max-h-44 overflow-auto rounded-lg border border-border">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Nikdo takový v adresáři není. Vyplňte údaje níže, uložením se přidá.</p>
                ) : (
                  filtered.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => pickCustomer(customer)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>{customer.name}</span>
                      <span className="text-muted-foreground">{customer.ico || customer.city}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Název">
            <Input name="customerName" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerId(""); }} required />
          </Field>
          <Field label="E-mail">
            <Input name="customerEmail" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
          </Field>
          <div className="grid gap-2">
            <Field label="IČO">
              <Input name="customerIco" value={customerIco} onChange={(event) => { setCustomerIco(event.target.value); setCustomerId(""); }} />
            </Field>
            <AresLookup
              ico={customerIco}
              onLoaded={(party) => {
                setCustomerId("");
                setCustomerIco(party.ico);
                setCustomerName(party.name);
                setCustomerDic(party.dic);
                setCustomerStreet(party.street);
                setCustomerCity(party.city);
                setCustomerZip(party.zip);
                setCustomerCountry(party.country || "Česká republika");
              }}
            />
          </div>
          <Field label="DIČ">
            <Input name="customerDic" value={customerDic} onChange={(event) => { setCustomerDic(event.target.value); setCustomerId(""); }} />
          </Field>
          <Field label="Ulice">
            <Input name="customerStreet" value={customerStreet} onChange={(event) => setCustomerStreet(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PSČ">
              <Input name="customerZip" value={customerZip} onChange={(event) => setCustomerZip(event.target.value)} />
            </Field>
            <Field label="Město">
              <Input name="customerCity" value={customerCity} onChange={(event) => setCustomerCity(event.target.value)} />
            </Field>
          </div>
          <Field label="Stát">
            <Input name="customerCountry" value={customerCountry} onChange={(event) => setCustomerCountry(event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Položky</h2>
          <Button type="button" variant="outline" onClick={() => setItems((current) => [...current, emptyItem()])}>
            Přidat položku
          </Button>
        </div>
        <div className="grid gap-3">
          {items.map((item, index) => {
            const line = lineTotals(parseAmount(item.quantity), parseAmount(item.unitPrice), Number(item.vatRate) || 0);
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Množství">
                    <Input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} />
                  </Field>
                  <Field label="MJ">
                    <Input value={item.unit} onChange={(event) => updateItem(item.key, { unit: event.target.value })} />
                  </Field>
                  <Field label="Cena bez DPH">
                    <Input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })} />
                  </Field>
                  <Field label="DPH %">
                    <Select value={item.vatRate} onValueChange={(value) => updateItem(item.key, { vatRate: value || "21" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
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
                </div>
                <p className="text-sm text-muted-foreground">S DPH {formatMoney(line.totalGross, "CZK")}</p>
              </div>
            );
          })}
        </div>
        <div className="grid justify-end gap-1 text-sm">
          <p>Základ {formatMoney(totals.net)}</p>
          <p>DPH {formatMoney(totals.vat)}</p>
          <p className="text-base font-medium">Celkem {formatMoney(totals.gross)}</p>
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
