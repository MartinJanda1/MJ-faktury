"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/access-gate";
import { AresLookup } from "@/components/ares-lookup";
import { BankAutofillFields, type BankFieldValues } from "@/components/bank-autofill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { changeAccessPasswordAction, saveCompanyAction } from "@/lib/actions";
import { isAccessPasswordFormat } from "@/lib/password-rules";
import { resolveIban } from "@/lib/payment-qr";
import type { Company } from "@/lib/types";
import { NON_VAT_PAYER_NOTE } from "@/lib/vat";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function bankReady(values: BankFieldValues): boolean {
  const account = values.bankCode ? `${values.bankAccount}/${values.bankCode}` : values.bankAccount;
  return Boolean(resolveIban(account, values.iban) && values.swift.trim());
}

function AccessPasswordForm({
  hasAccessPassword,
  setupMode,
}: {
  hasAccessPassword: boolean;
  setupMode: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(changeAccessPasswordAction, { error: "", saved: false });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordOk =
    isAccessPasswordFormat(newPassword) &&
    newPassword === confirmPassword &&
    (!hasAccessPassword || currentPassword.length > 0);

  useEffect(() => {
    if (state.saved) router.refresh();
  }, [state.saved, router]);

  return (
    <form action={action} className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Heslo smí obsahovat jen písmena a číslice (min. 6 znaků).
        {setupMode && !hasAccessPassword ? " Při založení účtu je heslo povinné." : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-4">
          {hasAccessPassword ? (
            <Field label="Současné heslo">
              <Input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : (
            <input type="hidden" name="currentPassword" value="" />
          )}
        </div>
        <div className="grid gap-4">
          <Field label="Nové heslo">
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 6 znaků, jen písmena a číslice"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Potvrzení hesla">
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </Field>
        </div>
      </div>
      {state.saved ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Heslo je uložené.</p>
      ) : null}
      {state.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !passwordOk}>
          {pending ? "Ukládám heslo…" : hasAccessPassword ? "Změnit heslo" : "Uložit heslo"}
        </Button>
      </div>
    </form>
  );
}

function SaveBar({
  pending,
  saved,
  error,
  disabled,
  hint,
}: {
  pending: boolean;
  saved: boolean;
  error: string;
  disabled: boolean;
  hint: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
      <div className="min-h-8 max-w-xl">
        {saved ? <p className="text-sm text-primary">Údaje firmy jsou uložené.</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!saved && !error && hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Ukládám…" : "Uložit"}
      </Button>
    </div>
  );
}

export function CompanyForm({ company }: { company: Company }) {
  const { syncIco } = useAccess();
  const [state, action, pending] = useActionState(saveCompanyAction, { error: "", saved: false });
  const [tab, setTab] = useState("dodavatel");
  const [name, setName] = useState(company.name);
  const [ico, setIco] = useState(company.ico || "");
  const [dic, setDic] = useState(company.dic);
  const [street, setStreet] = useState(company.street);
  const [city, setCity] = useState(company.city);
  const [zip, setZip] = useState(company.zip);
  const [country, setCountry] = useState(company.country || "Česká republika");
  const [email, setEmail] = useState(company.email);
  const [phone, setPhone] = useState(company.phone);
  const [notVatPayer, setNotVatPayer] = useState(Boolean(company.vatNote?.trim()));
  const [footerNote, setFooterNote] = useState(company.footerNote || "");
  const [bank, setBank] = useState<BankFieldValues>({
    bankAccount: company.bankAccount,
    bankCode: company.bankCode,
    iban: company.iban,
    swift: company.swift,
  });

  const initialBankOk = useMemo(
    () =>
      bankReady({
        bankAccount: company.bankAccount,
        bankCode: company.bankCode,
        iban: company.iban,
        swift: company.swift,
      }),
    [company.bankAccount, company.bankCode, company.iban, company.swift],
  );

  const setupMode = !company.hasAccessPassword || !initialBankOk;
  const liveBankOk = bankReady(bank);
  const passwordOk = Boolean(company.hasAccessPassword);
  const canSave = !setupMode || (liveBankOk && passwordOk);

  const setupHint = useMemo(() => {
    if (!setupMode || canSave) return "";
    const missing: string[] = [];
    if (!liveBankOk) missing.push("bankovní údaje (účet, kód banky, IBAN a SWIFT)");
    if (!passwordOk) missing.push("heslo na záložce Heslo");
    return `Pro založení účtu doplňte: ${missing.join(" a ")}.`;
  }, [setupMode, canSave, liveBankOk, passwordOk]);

  useEffect(() => {
    if (state.saved) syncIco(ico, name);
  }, [state.saved, ico, name, syncIco]);

  // Keep fields in sync when RSC refreshes company after login/register (tenant cookie).
  useEffect(() => {
    setName(company.name);
    setIco(company.ico || "");
    setDic(company.dic);
    setStreet(company.street);
    setCity(company.city);
    setZip(company.zip);
    setCountry(company.country || "Česká republika");
    setEmail(company.email);
    setPhone(company.phone);
    setNotVatPayer(Boolean(company.vatNote?.trim()));
    setFooterNote(company.footerNote || "");
    setBank({
      bankAccount: company.bankAccount,
      bankCode: company.bankCode,
      iban: company.iban,
      swift: company.swift,
    });
  }, [
    company.name,
    company.ico,
    company.dic,
    company.street,
    company.city,
    company.zip,
    company.country,
    company.email,
    company.phone,
    company.vatNote,
    company.footerNote,
    company.bankAccount,
    company.bankCode,
    company.iban,
    company.swift,
  ]);

  const onBankChange = useCallback((values: BankFieldValues) => {
    setBank(values);
  }, []);

  const companyTab = tab === "dodavatel" || tab === "banka" || tab === "idoklad";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
    >
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-foreground/10 p-0">
        <TabsTrigger value="dodavatel" className="rounded-none px-3 py-2">
          Dodavatel
        </TabsTrigger>
        <TabsTrigger value="banka" className="rounded-none px-3 py-2">
          Bankovní údaje
          {setupMode && !liveBankOk ? <span className="text-destructive">*</span> : null}
        </TabsTrigger>
        <TabsTrigger value="heslo" className="rounded-none px-3 py-2">
          Heslo
          {setupMode && !passwordOk ? <span className="text-destructive">*</span> : null}
        </TabsTrigger>
        <TabsTrigger value="idoklad" className="rounded-none px-3 py-2">
          iDoklad
        </TabsTrigger>
      </TabsList>

      {setupMode ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/80">
          Založení účtu: vyplňte bankovní údaje a nastavte heslo. Uložení firmy bude dostupné až potom.
        </p>
      ) : null}

      <form action={action} className={companyTab ? "grid gap-4" : "hidden"}>
        <div className={tab === "dodavatel" ? "grid gap-4 sm:grid-cols-2" : "hidden"} aria-hidden={tab !== "dodavatel"}>
          <Field label="Název">
            <Input name="name" value={name} onChange={(event) => setName(event.target.value)} required={setupMode} />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="IČO">
            <div className="flex items-start gap-2">
              <Input
                name="ico"
                className="min-w-0 flex-1"
                value={ico}
                onChange={(event) => setIco(event.target.value)}
                required={setupMode}
              />
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
                  setNotVatPayer(!party.vatPayer);
                }}
              />
            </div>
          </Field>
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
              onChange={(event) => setNotVatPayer(event.target.checked)}
              className="mt-0.5 size-4 accent-[oklch(0.38_0.07_155)]"
            />
            <span>
              <span className="font-medium">{NON_VAT_PAYER_NOTE}</span>
              <span className="mt-0.5 block text-muted-foreground">
                Na fakturách se nezobrazí sloupce ani součty DPH. Text u dodavatele zůstane pevný.
              </span>
            </span>
          </label>
          <Field label="Patička dokladu">
            <Input
              name="footerNote"
              value={footerNote}
              onChange={(event) => setFooterNote(event.target.value)}
              placeholder="Podnikatel je zapsán v živnostenském rejstříku"
            />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">Patička je na spodním okraji dokladu.</p>
        </div>

        <div className={tab === "banka" ? "grid gap-4 sm:grid-cols-2" : "hidden"} aria-hidden={tab !== "banka"}>
          <BankAutofillFields
            bankAccount={company.bankAccount}
            bankCode={company.bankCode}
            iban={company.iban}
            swift={company.swift}
            required={setupMode}
            onChange={onBankChange}
          />
        </div>

        <div className={tab === "idoklad" ? "grid gap-4" : "hidden"} aria-hidden={tab !== "idoklad"}>
          <p className="text-sm leading-6 text-muted-foreground">
            Client ID a Client Secret z iDokladu (Nastavení → Aplikace → API). Heslo k webu iDokladu se neukládá.
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
        </div>

        {companyTab ? (
          <SaveBar
            pending={pending}
            saved={state.saved}
            error={state.error}
            disabled={!canSave}
            hint={setupHint}
          />
        ) : null}
      </form>

      {tab === "heslo" ? (
        <AccessPasswordForm hasAccessPassword={Boolean(company.hasAccessPassword)} setupMode={setupMode} />
      ) : null}
    </Tabs>
  );
}
