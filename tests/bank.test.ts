import assert from "node:assert/strict";
import { test } from "node:test";
import { fillFromBankCode, formatIban, parseCzechIban } from "../lib/bank";

test("parseCzechIban fills account bank code and SWIFT", () => {
  const parsed = parseCzechIban("CZ65 0100 0000 0001 2345 6789");
  assert.ok(parsed);
  assert.equal(parsed!.bankCode, "0100");
  assert.equal(parsed!.bankAccount, "123456789");
  assert.equal(parsed!.swift, "KOMBCZPPXXX");
  assert.equal(parsed!.bankName, "Komerční banka");
  assert.equal(formatIban(parsed!.iban.replace(/\s/g, "")), "CZ65 0100 0000 0001 2345 6789");
});

test("parseCzechIban rejects non-CZ IBAN", () => {
  assert.equal(parseCzechIban("DE89370400440532013000"), null);
  assert.equal(parseCzechIban("CZ12"), null);
});

test("fillFromBankCode knows Fio", () => {
  const bank = fillFromBankCode("2010");
  assert.deepEqual(bank, { swift: "FIOBCZPPXXX", bankName: "Fio banka" });
});
