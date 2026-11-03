import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ACCESS_PASSWORD_PATTERN, validateAccessPassword } from "./password-rules";

export { ACCESS_PASSWORD_PATTERN, validateAccessPassword };

export function hashAccessPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyAccessPassword(password: string, stored: string | null | undefined): boolean {
  const value = String(stored ?? "");
  const parts = value.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex || expectedHex.length % 2 !== 0) return false;
  try {
    const actual = scryptSync(password, salt, 32);
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
