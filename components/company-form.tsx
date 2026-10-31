"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCompanyAction } from "@/lib/actions";
import type { Company } from "@/lib/types";

export function CompanyForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(saveCompanyAction, { error: "", saved: false });
  return (
    <form action={action} className="grid gap-6">
      {state.saved ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Údaje firmy jsou uložené.</p> : null}
      {state.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}
      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 sm:p-5">
        <h2 className="font-heading text-lg sm:col-span-2">Dodavatel na fakturách</h2>
        <Field label="Název">
          <Input name="name" defaultValue={company.name} />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" defaultValue={company.email} />
        </Field>
        <Field label="IČO">
          <Input name="ico" defaultValue={company.ico} />
        </Field>
        <Field label="DIČ">
          <Input name="dic" defaultValue={company.dic} />
        </Field>
        <Field label="Ulice">
          <Input name="street" defaultValue={company.street} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={company.phone} />
        </Field>
        <Field label="PSČ">
          <Input name="zip" defaultValue={company.zip} />
        </Field>
        <Field label="Město">
          <Input name="city" defaultValue={company.city} />
        </Field>
        <Field label="Stát">
          <Input name="country" defaultValue={company.country || "Česká republika"} />
        </Field>
        <Field label="Číslo účtu">
          <Input name="bankAccount" defaultValue={company.bankAccount} />
        </Field>
        <Field label="Kód banky">
          <Input name="bankCode" defaultValue={company.bankCode} />
        </Field>
        <Field label="IBAN">
          <Input name="iban" defaultValue={company.iban} />
        </Field>
        <Field label="SWIFT">
          <Input name="swift" defaultValue={company.swift} />
        </Field>
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
