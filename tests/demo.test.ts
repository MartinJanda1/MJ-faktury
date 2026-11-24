import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_BANK_ACCOUNT, DEMO_ICO, DEMO_PARTY, isDemoIco } from "../lib/demo";

test("isDemoIco recognises the demo IČO only", () => {
  assert.equal(isDemoIco("00000001"), true);
  assert.equal(isDemoIco("IČ 0000 0001"), true);
  assert.equal(isDemoIco("00000002"), false);
  assert.equal(isDemoIco(""), false);
});

test("demo party is the fictional woodworking firm", () => {
  assert.equal(DEMO_PARTY.ico, DEMO_ICO);
  assert.equal(DEMO_PARTY.name, "Truhlářství Dřevák s.r.o.");
  assert.equal(DEMO_PARTY.street, "Ukázková 1");
  assert.equal(DEMO_PARTY.city, "Praha 12");
  assert.equal(DEMO_BANK_ACCOUNT, "000000-0000000000/0000");
});
