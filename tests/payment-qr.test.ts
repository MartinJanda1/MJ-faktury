import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSpaydString,
  czechAccountToIban,
  isTransferPayment,
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

test("resolveIban derives Fio sample CZ8420100000002100132288", () => {
  assert.equal(resolveIban("2100132288/2010", ""), "CZ8420100000002100132288");
  assert.equal(resolveIban("", "CZ84 2010 0000 0021 0013 2288"), "CZ8420100000002100132288");
  assert.equal(resolveIban("2100132288", ""), null);
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

test("buildSpaydString with sample Fio IBAN", () => {
  const spayd = buildSpaydString({
    iban: "CZ8420100000002100132288",
    amount: 81250,
    variableSymbol: "92026",
    dueDate: "2026-10-30",
    message: "Faktura VF 09/2026",
  });
  assert.equal(
    spayd,
    "SPD*1.0*ACC:CZ8420100000002100132288*AM:81250.00*CC:CZK*X-VS:92026*DT:20261030*MSG:FAKTURA VF 09 2026",
  );
  assert.equal(buildSpaydString({ iban: null, amount: 100 }), null);
});

test("isTransferPayment treats empty and Převodem as transfer", () => {
  assert.equal(isTransferPayment(""), true);
  assert.equal(isTransferPayment("Převodem"), true);
  assert.equal(isTransferPayment("Bank transfer"), true);
  assert.equal(isTransferPayment("Hotově"), false);
  assert.equal(isTransferPayment("Kartou"), false);
});
