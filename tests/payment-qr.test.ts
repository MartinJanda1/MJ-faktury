import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSpaydString,
  czechAccountToIban,
  parseCzechBankAccount,
  resolveIban,
} from "../lib/payment-qr";

test("parseCzechBankAccount understands prefix-account/bank", () => {
  const parsed = parseCzechBankAccount("19-2000145399/0800");
  assert.deepEqual(parsed, {
    bankCode: "0800",
    prefix: "000019",
    account: "2000145399",
  });
});

test("resolveIban prefers explicit IBAN and falls back to Czech account", () => {
  assert.equal(resolveIban("", "CZ65 0800 0000 1920 0014 5399"), "CZ6508000000192000145399");
  const fromAccount = resolveIban("19-2000145399/0800", "");
  assert.equal(fromAccount, czechAccountToIban(parseCzechBankAccount("19-2000145399/0800")!));
});

test("buildSpaydString builds SPD payload", () => {
  const spayd = buildSpaydString({
    iban: "CZ6508000000192000145399",
    amount: 1234.5,
    variableSymbol: "20260001",
    constantSymbol: "0308",
    dueDate: "2026-03-15",
    message: "Faktura 2026/001",
  });
  assert.equal(
    spayd,
    "SPD*1.0*ACC:CZ6508000000192000145399*AM:1234.50*CC:CZK*X-VS:20260001*X-KS:0308*DT:20260315*MSG:FAKTURA 2026 001",
  );
});
