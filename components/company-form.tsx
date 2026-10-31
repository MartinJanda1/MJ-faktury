"use client";

import { useActionState, useState } from "react";
import { AresLookup } from "@/components/ares-lookup";
import { BankAutofillFields } from "@/components/bank-autofill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCompanyAction } from "@/lib/actions";
import type { Company } from "@/lib/types";

export function CompanyForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(saveCompanyAction, { error: "", saved: false });
  const [name, setName] = useState(company.name);
  const [ico, setIco] = useState(company.ico);
  const [dic, setDic] = useState(company.dic);
  const [street, setStreet] = useState(company.street);
  const [city, setCity] = useState(company.city);
  const [zip, setZip] = useState(company.zip);
  const [country, setCountry] = useState(company.country || "Česká republika");
  const [email, setEmail] = useState(company.email);
  const [phone, setPhone] = useState(company.phone);
  const [vatNote, setVatNote] = useState(company.vatNote || "");
  const [notVatPayer, setNotVatPayer] = useState(Boolean(company.vatNote?.trim()));
  const [footerNote, setFooterNote] = useState(company.footerNote || "");

  return (
    <form action={action} className="grid gap-6">
      {state.saved ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Údaje firmy jsou uložené.</p> : null}
      {state.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}
      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 sm:p-5">
        <h2 className="font-heading text-lg sm:col-span-2">Dodavatel na fakturách</h2>
        <Field label="Název">
          <Input name="name" value={name} onChange={(event) => setName(event.target.value)} />
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
              setVatNote(party.vatNote || (party.vatPayer ? "" : "Nejsme plátci DPH"));
              setNotVatPayer(!party.vatPayer);
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
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="notVatPayer"
            checked={notVatPayer}
            onChange={(event) => {
              const checked = event.target.checked;
              setNotVatPayer(checked);
              setVatNote(checked ? vatNote.trim() || "Nejsme plátci DPH" : "");
            }}
            className="mt-0.5 size-4 accent-[oklch(0.38_0.07_155)]"
          />
          <span>
            <span className="font-medium">Nejsme plátci DPH</span>
            <span className="mt-0.5 block text-muted-foreground">
              Na fakturách se nezobrazí sloupce ani součty DPH. Poznámka u dodavatele zůstane viditelná.
            </span>
          </span>
        </label>
        {notVatPayer ? (
          <Field label="Poznámka k DPH">
            <Input
              name="vatNote"
              value={vatNote}
              onChange={(event) => setVatNote(event.target.value)}
              placeholder="Nejsme plátci DPH"
            />
          </Field>
        ) : (
          <input type="hidden" name="vatNote" value="" />
        )}
        <Field label="Patička dokladu">
          <Input
            name="footerNote"
            value={footerNote}
            onChange={(event) => setFooterNote(event.target.value)}
            placeholder="Podnikatel je zapsán v živnostenském rejstříku"
          />
        </Field>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Patička je na spodním okraji dokladu (klasická i iDoklad šablona).
        </p>
        <h3 className="font-heading text-base sm:col-span-2">Bankovní údaje</h3>
        <BankAutofillFields
          bankAccount={company.bankAccount}
          bankCode={company.bankCode}
          iban={company.iban}
          swift={company.swift}
        />
      </section>
      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="font-heading text-lg">Klíče k iDokladu</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Sem patří Client ID a Client Secret z iDokladu, agenda Nastavení → Aplikace → API. Heslo k přihlášení na web se neukládá a aplikace ho ani nechce.
          Klíč zůstane jen v místní databázi.
        </p>
        <Field label="Client ID">
          <Input name="clientId" defaultValue={company.idokladClientId} autoComplete="off" />
        </Field>
        <Field label="Client Secret">
          <Input
            name="clientSecret"
            type="password"
            autoComplete="new-password"
            placeholder={company.hasIdokladSecret ? "Uloženo. Vyplňte jen při výměně klíče." : "Vložte secret z iDokladu"}
          />
        </Field>
        {company.hasIdokladSecret ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="clearSecret" className="size-4 accent-[oklch(0.38_0.07_155)]" />
            Smazat uložené API klíče
          </label>
        ) : null}
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit nastavení"}
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
