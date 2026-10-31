import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidIcoChecksum, isValidIcoFormat, normalizeIco } from "../lib/ico";

test("normalizeIco keeps 8 digits", () => {
  assert.equal(normalizeIco("12345678"), "12345678");
  assert.equal(normalizeIco("IČ 12 345 678"), "12345678");
  assert.equal(normalizeIco("123"), "");
});

test("isValidIcoFormat accepts 8 digits only", () => {
  assert.equal(isValidIcoFormat("27074358"), true);
  assert.equal(isValidIcoFormat("12 345 678"), true);
  assert.equal(isValidIcoFormat("1234567"), false);
});

test("isValidIcoChecksum checks Czech mod-11 digit", () => {
  assert.equal(isValidIcoChecksum("27074358"), true);
  assert.equal(isValidIcoChecksum("25596641"), true);
  assert.equal(isValidIcoChecksum("12345678"), false);
  assert.equal(isValidIcoChecksum("123"), false);
});
