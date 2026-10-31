"use client";

import { useActionState, useState } from "react";
import { AresLookup } from "@/components/ares-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerAction } from "@/lib/actions";
import type { Customer } from "@/lib/types";

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, action, pending] = useActionState(saveCustomerAction, { error: "" });
  const [name, setName] = useState(customer?.name ?? "");
  const [ico, setIco] = useState(customer?.ico ?? "");
  const [dic, setDic] = useState(customer?.dic ?? "");
  const [street, setStreet] = useState(customer?.street ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [zip, setZip] = useState(customer?.zip ?? "");
  const [country, setCountry] = useState(customer?.country || "Česká republika");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");

  return (
    <form action={action} className="grid max-w-3xl gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <input type="hidden" name="id" value={customer?.id ?? ""} />
      {state.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název">
          <Input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <div className="grid gap-2">
          <Field label="IČO">
            <Input name="ico" value={ico} onChange={(event) => setIco(event.target.value)} />
          </Field>
          <AresLookup
            ico={ico}
            onLoaded={(party) => {
              setIco(party.ico);
              setName(party.name);
              setDic(party.dic);
              setStreet(party.street);
              setCity(party.city);
              setZip(party.zip);
              setCountry(party.country || "Česká republika");
            }}
          />
        </div>
        <Field label="DIČ">
          <Input name="dic" value={dic} onChange={(event) => setDic(event.target.value)} />
        </Field>
        <Field label="Ulice">
          <Input name="street" value={street} onChange={(event) => setStreet(event.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="PSČ">
          <Input name="zip" value={zip} onChange={(event) => setZip(event.target.value)} />
        </Field>
        <Field label="Město">
          <Input name="city" value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field label="Stát">
          <Input name="country" value={country} onChange={(event) => setCountry(event.target.value)} />
        </Field>
      </div>
      <Field label="Poznámka">
        <Textarea name="note" defaultValue={customer?.note ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit odběratele"}
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
