/** Letters and digits only, at least 6 characters. Safe for client + server. */
export const ACCESS_PASSWORD_PATTERN = /^[A-Za-z0-9]{6,64}$/;

export function validateAccessPassword(raw: string | null | undefined): string | null {
  const value = String(raw ?? "");
  if (!value) return "Zadejte heslo.";
  if (value.length < 6) return "Heslo musí mít alespoň 6 znaků.";
  if (value.length > 64) return "Heslo může mít nejvýše 64 znaků.";
  if (!ACCESS_PASSWORD_PATTERN.test(value)) {
    return "Heslo smí obsahovat jen písmena a číslice (bez mezer a znaků).";
  }
  return null;
}

export function isAccessPasswordFormat(raw: string | null | undefined): boolean {
  return validateAccessPassword(raw) === null;
}
