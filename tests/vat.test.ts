import assert from "node:assert/strict";
import { test } from "node:test";
import { isNonVatPayer, NON_VAT_PAYER_NOTE, vatNoteForFlag } from "../lib/vat";

test("isNonVatPayer reads company vatNote", () => {
  assert.equal(isNonVatPayer({ vatNote: "" }), false);
  assert.equal(isNonVatPayer({ vatNote: "   " }), false);
  assert.equal(isNonVatPayer({ vatNote: NON_VAT_PAYER_NOTE }), true);
  assert.equal(isNonVatPayer({ vatNote: "Neplátce DPH" }), true);
});

test("vatNoteForFlag maps checkbox to company note", () => {
  assert.equal(vatNoteForFlag(true), NON_VAT_PAYER_NOTE);
  assert.equal(vatNoteForFlag(false), "");
});
