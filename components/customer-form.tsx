"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerAction } from "@/lib/actions";
import type { Customer } from "@/lib/types";

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, action, pending] = useActionState(saveCustomerAction, { error: "" });
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
          <Input name="name" defaultValue={customer?.name ?? ""} required />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
        </Field>
        <Field label="IČO">
          <Input name="ico" defaultValue={customer?.ico ?? ""} />
        </Field>
        <Field label="DIČ">
          <Input name="dic" defaultValue={customer?.dic ?? ""} />
        </Field>
        <Field label="Ulice">
          <Input name="street" defaultValue={customer?.street ?? ""} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={customer?.phone ?? ""} />
        </Field>
        <Field label="PSČ">
          <Input name="zip" defaultValue={customer?.zip ?? ""} />
        </Field>
        <Field label="Město">
          <Input name="city" defaultValue={customer?.city ?? ""} />
        </Field>
        <Field label="Stát">
          <Input name="country" defaultValue={customer?.country || "Česká republika"} />
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
