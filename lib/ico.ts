/** Digits-only IČO, empty if fewer than 8 digits. */
export function normalizeIco(value: string | null | undefined): string {
  const ico = String(value || "").replace(/\D/g, "");
  if (ico.length < 8) return "";
  return ico.slice(0, 8);
}

/**
 * Czech IČO checksum (mod 11).
 * Weights 8..2 on the first seven digits; remainder maps to the 8th digit.
 */
export function isValidIcoChecksum(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    sum += Number(ico[i]) * (8 - i);
  }
  const rem = sum % 11;
  const expected = rem === 0 ? 1 : rem === 1 ? 0 : 11 - rem;
  return expected === Number(ico[7]);
}

/** Light format check: exactly 8 digits after normalization. */
export function isValidIcoFormat(value: string | null | undefined): boolean {
  return Boolean(normalizeIco(value));
}
