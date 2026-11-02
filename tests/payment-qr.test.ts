import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSidString,
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
    "SPD*1.0*ACC:CZ6508000000192000145399*AM:1234.50*CC:CZK*X-VS:20260001*X-KS:0308*DT:20260315*MSG:FAKTURA 2026/001",
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
    "SPD*1.0*ACC:CZ8420100000002100132288*AM:81250.00*CC:CZK*X-VS:92026*DT:20261030*MSG:FAKTURA VF 09/2026",
  );
  assert.equal(buildSpaydString({ iban: null, amount: 100 }), null);
});

test("buildSpaydString appends BIC to ACC", () => {
  const spayd = buildSpaydString({
    iban: "CZ8420100000002100132288",
    bic: "FIOBCZPPXXX",
    amount: 100,
    message: "TEST",
  });
  assert.equal(spayd, "SPD*1.0*ACC:CZ8420100000002100132288+FIOBCZPPXXX*AM:100.00*CC:CZK*MSG:TEST");
});

test("buildSidString for non-VAT payer emits NTB", () => {
  const sid = buildSidString({
    id: "VF 06/2026",
    issueDate: "2026-06-30",
    amount: 86500,
    message: "Odborne prace a konzultace",
    supplierIco: "40782310",
    customerIco: "22154256",
    taxDate: "2026-06-30",
    dueDate: "2026-07-23",
    nonVatPayer: true,
  });
  assert.equal(
    sid,
    "SID*1.0*ID:VF 06/2026*DD:20260630*AM:86500.00*MSG:Odborne prace a konzultace*INI:40782310*INR:22154256*DUZP:20260630*DPPD:20260630*DT:20260723*NTB:86500.00*X-SW:MJ-faktury",
  );
});

test("buildSidString for VAT payer emits TB0/T0", () => {
  const sid = buildSidString({
    id: "2026/001",
    issueDate: "2026-03-01",
    amount: 1210,
    supplierIco: "12345678",
    supplierDic: "CZ12345678",
    taxDate: "2026-03-01",
    dueDate: "2026-03-15",
    items: [{ vatRate: 21, totalNet: 1000, totalVat: 210 }],
  });
  assert.equal(
    sid,
    "SID*1.0*ID:2026/001*DD:20260301*AM:1210.00*INI:12345678*VII:CZ12345678*DUZP:20260301*DPPD:20260301*DT:20260315*TB0:1000.00*T0:210.00*X-SW:MJ-faktury",
  );
});

test("buildSpaydString embeds SID as X-INV with encoded asterisks", () => {
  const spayd = buildSpaydString({
    iban: "CZ8420100000002100132288",
    bic: "FIOBCZPPXXX",
    amount: 86500,
    variableSymbol: "62026",
    constantSymbol: "0308",
    dueDate: "2026-07-23",
    message: "VF 06/2026 MARTIN JANDA",
    invoice: {
      id: "VF 06/2026",
      issueDate: "2026-06-30",
      amount: 86500,
      message: "Odborne prace a konzultace",
      supplierIco: "40782310",
      customerIco: "22154256",
      taxDate: "2026-06-30",
      dueDate: "2026-07-23",
      nonVatPayer: true,
    },
  });

  assert.ok(spayd?.startsWith("SPD*1.0*ACC:CZ8420100000002100132288+FIOBCZPPXXX*AM:86500.00*CC:CZK*"));
  assert.ok(spayd?.includes("X-VS:62026*X-KS:0308*DT:20260723*MSG:VF 06/2026 MARTIN JANDA*"));
  assert.ok(spayd?.includes("X-INV:SID%2A1.0%2AID:VF 06/2026%2ADD:20260630%2AAM:86500.00%2A"));
  assert.ok(spayd?.includes("%2AINI:40782310%2AINR:22154256%2ADUZP:20260630%2ADPPD:20260630%2ADT:20260723%2ANTB:86500.00%2AX-SW:MJ-faktury"));
  assert.equal(spayd?.includes("*SID*"), false);
});

test("isTransferPayment treats empty and Převodem as transfer", () => {
  assert.equal(isTransferPayment(""), true);
  assert.equal(isTransferPayment("Převodem"), true);
  assert.equal(isTransferPayment("Bank transfer"), true);
  assert.equal(isTransferPayment("Hotově"), false);
  assert.equal(isTransferPayment("Kartou"), false);
});
