"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { fillFromBankCode, parseCzechIban } from "@/lib/bank";
import { czechAccountToIban, parseCzechBankAccount, resolveIban } from "@/lib/payment-qr";

export type BankFieldValues = {
  bankAccount: string;
  bankCode: string;
  iban: string;
  swift: string;
};

type Props = {
  bankAccount: string;
  bankCode: string;
  iban: string;
  swift: string;
  required?: boolean;
  onChange?: (values: BankFieldValues) => void;
};

export function BankAutofillFields({
  bankAccount: initialAccount,
  bankCode: initialCode,
  iban: initialIban,
  swift: initialSwift,
  required = false,
  onChange,
}: Props) {
  const [bankAccount, setBankAccount] = useState(initialAccount);
  const [bankCode, setBankCode] = useState(initialCode);
  const [iban, setIban] = useState(initialIban);
  const [swift, setSwift] = useState(initialSwift);
  const [bankName, setBankName] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    const bank = fillFromBankCode(bankCode);
    if (bank) setBankName(bank.bankName);
  }, [bankCode]);

  useEffect(() => {
    onChange?.({ bankAccount, bankCode, iban, swift });
  }, [bankAccount, bankCode, iban, swift, onChange]);

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

  function applySwift(value: string) {
    setSwift(value);
  }

  const resolved = resolveIban(bankCode ? `${bankAccount}/${bankCode}` : bankAccount, iban);

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <Field label="Číslo účtu">
        <Input
          name="bankAccount"
          value={bankAccount}
          onChange={(event) => applyFromAccount(event.target.value, bankCode)}
          placeholder="123456789"
          required={required}
        />
      </Field>
      <Field label="Kód banky">
        <Input
          name="bankCode"
          value={bankCode}
          onChange={(event) => applyFromAccount(bankAccount, event.target.value)}
          placeholder="0100"
          maxLength={4}
          required={required}
        />
      </Field>
      <Field label="IBAN">
        <Input
          name="iban"
          value={iban}
          onChange={(event) => applyFromIban(event.target.value)}
          placeholder="CZ65 0100 0000 0001 2345 6789"
          required={required}
        />
      </Field>
      <Field label="SWIFT">
        <Input
          name="swift"
          value={swift}
          onChange={(event) => applySwift(event.target.value)}
          required={required}
        />
      </Field>
      {(bankName || hint || resolved) && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {[bankName, hint].filter(Boolean).join(" · ")}
          {resolved && !iban.replace(/\s/g, "") ? ` · QR použije ${resolved}` : ""}
        </p>
      )}
    </div>
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
