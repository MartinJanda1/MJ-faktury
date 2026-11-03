import assert from "node:assert/strict";
import { test } from "node:test";
import { hashAccessPassword, verifyAccessPassword } from "../lib/password";
import { validateAccessPassword } from "../lib/password-rules";

test("validateAccessPassword accepts letters and digits from length 6", () => {
  assert.equal(validateAccessPassword("abc123"), null);
  assert.equal(validateAccessPassword("AbcDef9"), null);
  assert.ok(validateAccessPassword("abc12"));
  assert.ok(validateAccessPassword("abc 123"));
  assert.ok(validateAccessPassword("abc-123"));
  assert.ok(validateAccessPassword(""));
});

test("hashAccessPassword verifies round-trip and rejects wrong password", () => {
  const hash = hashAccessPassword("Secret9");
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(verifyAccessPassword("Secret9", hash), true);
  assert.equal(verifyAccessPassword("Secret8", hash), false);
  assert.equal(verifyAccessPassword("Secret9", ""), false);
});
