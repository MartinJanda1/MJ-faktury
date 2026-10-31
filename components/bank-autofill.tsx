"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { fillFromBankCode, parseCzechIban } from "@/lib/bank";
import { czechAccountToIban, parseCzechBankAccount, resolveIban } from "@/lib/payment-qr";

type Props = {
  bankAccount: string;
  bankCode: string;
  iban: string;
  swift: string;
  /** When set (including ""), show editable bank name and persist via form field. */
  bankName?: string;
  /** Show QR hint (company settings). Off for customer directory. */
  showQrHint?: boolean;
};

export function BankAutofillFields({
  bankAccount: initialAccount,
  bankCode: initialCode,
  iban: initialIban,
  swift: initialSwift,
  bankName: initialBankName,
  showQrHint = true,
}: Props) {
  const persistBankName = initialBankName !== undefined;
  const [bankAccount, setBankAccount] = useState(initialAccount);
  const [bankCode, setBankCode] = useState(initialCode);
  const [iban, setIban] = useState(initialIban);
  const [swift, setSwift] = useState(initialSwift);
  const [bankName, setBankName] = useState(initialBankName ?? "");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (persistBankName && bankName) return;
    const bank = fillFromBankCode(bankCode);
    if (bank) setBankName(bank.bankName);
  }, [bankCode, persistBankName, bankName]);

  function applyFromIban(raw: string) {
    setIban(raw);
    const parsed = parseCzechIban(raw);
    if (!parsed) {
      setHint("");
      return;
    }
    setIban(parsed.iban);
    setBankAccount(parsed.bankAccount);
    setBankCode(parsed.bankCode);
    if (parsed.swift) setSwift(parsed.swift);
    if (parsed.bankName) setBankName(parsed.bankName);
    setHint(`Doplněno z IBAN: ${parsed.bankName || parsed.bankCode}`);
  }

  function applyFromAccount(account: string, code: string) {
    setBankAccount(account);
    setBankCode(code);
    const combined = code ? `${account}/${code}` : account;
    const parsed = parseCzechBankAccount(combined.includes("/") ? combined : "");
    const bank = fillFromBankCode(code);
    if (bank) {
      setSwift(bank.swift);
      setBankName(bank.bankName);
    }
    if (parsed) {
      const derived = czechAccountToIban(parsed);
      setIban(derived.replace(/(.{4})/g, "$1 ").trim());
      setHint(`IBAN dopočítán z účtu ${parsed.bankCode}`);
    } else if (!account && !code) {
      setHint("");
    }
  }

  const resolved = resolveIban(bankCode ? `${bankAccount}/${bankCode}` : bankAccount, iban);

  return (
    <>
      <Field label="Číslo účtu">
        <Input
          name="bankAccount"
          value={bankAccount}
          onChange={(event) => applyFromAccount(event.target.value, bankCode)}
          placeholder="123456789"
        />
      </Field>
      <Field label="Kód banky">
        <Input
          name="bankCode"
          value={bankCode}
          onChange={(event) => applyFromAccount(bankAccount, event.target.value)}
          placeholder="0100"
          maxLength={4}
        />
      </Field>
      <Field label="IBAN">
        <Input
          name="iban"
          value={iban}
          onChange={(event) => applyFromIban(event.target.value)}
          placeholder="CZ65 0100 0000 0001 2345 6789"
        />
      </Field>
      <Field label="SWIFT">
        <Input name="swift" value={swift} onChange={(event) => setSwift(event.target.value)} />
      </Field>
      {persistBankName ? (
        <Field label="Název banky">
          <Input
            name="bankName"
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            placeholder="volitelné"
          />
        </Field>
      ) : null}
      {(bankName || hint || (showQrHint && resolved)) && (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          {persistBankName ? hint : [bankName, hint].filter(Boolean).join(" · ")}
          {showQrHint && resolved && !iban.replace(/\s/g, "") ? ` · QR použije ${resolved}` : ""}
        </p>
      )}
    </>
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
