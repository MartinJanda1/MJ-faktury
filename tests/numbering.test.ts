import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestNextNumber, variableSymbolFromNumber } from "../lib/status";
import { withInvoiceDefaults } from "../lib/invoice-fields";

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
