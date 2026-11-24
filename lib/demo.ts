import type { AresParty } from "./ares";
import { normalizeIco } from "./ico";

/** Demo IČO: registrace přeskočí ověření v ARES a založí vymyšlenou firmu. */
export const DEMO_ICO = "00000001";

export const DEMO_BANK_ACCOUNT = "000000-0000000000/0000";

export const DEMO_PARTY: AresParty = {
  ico: DEMO_ICO,
  name: "Truhlářství Dřevák s.r.o.",
  street: "Ukázková 1",
  city: "Praha 12",
  zip: "",
  country: "Česká republika",
  dic: "",
  vatPayer: false,
  vatNote: "Nejsme plátci DPH",
};

export function isDemoIco(value: string | null | undefined): boolean {
  return normalizeIco(value) === DEMO_ICO;
}
