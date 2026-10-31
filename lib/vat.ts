/** Standard supplier note when the company is not a VAT payer. */
export const NON_VAT_PAYER_NOTE = "Nejsme plátci DPH";

/** True when the supplier note marks a non-VAT payer (or any non-empty vat note). */
export function isNonVatPayer(company: { vatNote?: string | null }): boolean {
  return Boolean(String(company.vatNote ?? "").trim());
}

export function vatNoteForFlag(notVatPayer: boolean): string {
  return notVatPayer ? NON_VAT_PAYER_NOTE : "";
}
