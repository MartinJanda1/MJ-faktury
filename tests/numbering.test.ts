import assert from "node:assert/strict";
import { test } from "node:test";
import { isInvoiceEditable, isInvoiceReadOnly, suggestNextNumber, variableSymbolFromNumber } from "../lib/status";
import { normalizeLayout, withInvoiceDefaults } from "../lib/invoice-fields";
import type { InvoiceStatus } from "../lib/types";

test("suggestNextNumber continues series-year format", () => {
  assert.equal(suggestNextNumber(["1/2026", "2/2026"], "2026-04-01"), "3/2026");
  assert.equal(suggestNextNumber(["01/2025"], "2026-01-10"), "1/2026");
});

test("suggestNextNumber keeps VF and legacy numeric formats", () => {
  assert.equal(suggestNextNumber(["VF 01/2026", "VF 02/2026"], "2026-05-01"), "VF 03/2026");
  assert.equal(suggestNextNumber(["20260001", "20260002"], "2026-05-01"), "20260003");
});

test("variableSymbolFromNumber strips non-digits", () => {
  assert.equal(variableSymbolFromNumber("VF 03/2026"), "032026");
  assert.equal(variableSymbolFromNumber("12/2026"), "122026");
});

test("withInvoiceDefaults fills missing invoice fields", () => {
  const normalized = withInvoiceDefaults({ number: "1/2026" });
  assert.equal(normalized.paymentMethod, "Převodem");
  assert.equal(normalized.orderNumber, "");
  assert.equal(normalized.layout, "classic");
});

test("normalizeLayout maps modern and legacy idoklad", () => {
  assert.equal(normalizeLayout("classic"), "classic");
  assert.equal(normalizeLayout("modern"), "modern");
  assert.equal(normalizeLayout("idoklad"), "modern");
  assert.equal(normalizeLayout(""), "classic");
  assert.equal(normalizeLayout(undefined), "classic");
});

test("unpaid invoice statuses stay editable; paid and cancelled are read-only", () => {
  const editable: InvoiceStatus[] = ["draft", "issued", "partial"];
  const locked: InvoiceStatus[] = ["paid", "cancelled"];
  for (const status of editable) {
    assert.equal(isInvoiceEditable({ status }), true, status);
    assert.equal(isInvoiceReadOnly({ status }), false, status);
  }
  for (const status of locked) {
    assert.equal(isInvoiceEditable({ status }), false, status);
    assert.equal(isInvoiceReadOnly({ status }), true, status);
  }
});
