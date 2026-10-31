export type AresParty = {
  ico: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  dic: string;
  vatPayer: boolean;
  vatNote: string;
};

const ARES_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export function normalizeIco(value: string | null | undefined): string {
  const ico = String(value || "").replace(/\D/g, "");
  if (ico.length < 8) return "";
  return ico.slice(0, 8);
}

function formatPsc(psc: unknown): string {
  const digits = String(psc || "").replace(/\D/g, "");
  if (digits.length !== 5) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function formatStreet(sidlo: Record<string, unknown> | null | undefined): string {
  if (!sidlo) return "";
  const street = String(sidlo.nazevUlice || "");
  const house = sidlo.cisloDomovni;
  if (street && house != null && house !== "") {
    let number = String(house);
    if (sidlo.cisloOrientacni) {
      number += `/${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno || ""}`;
    }
    return `${street} ${number}`.trim();
  }
  const text = String(sidlo.textovaAdresa || "");
  return text.split(",")[0]?.trim() || "";
}

function formatCityParts(sidlo: Record<string, unknown> | null | undefined): { zip: string; city: string } {
  if (!sidlo) return { zip: "", city: "" };
  const zip = formatPsc(sidlo.psc);
  const city = String(sidlo.nazevMestskeObvodu || sidlo.nazevObce || "").trim();
  return { zip, city };
}

function isVatPayer(aresData: Record<string, unknown>): boolean {
  const regs = aresData.seznamRegistraci as Record<string, unknown> | undefined;
  return regs?.stavZdrojeDph === "AKTIVNI";
}

export function mapAresResponse(aresData: Record<string, unknown>): AresParty {
  const sidlo = (aresData.sidlo as Record<string, unknown>) || {};
  const vatPayer = isVatPayer(aresData);
  const { zip, city } = formatCityParts(sidlo);

  return {
    ico: String(aresData.ico || ""),
    name: String(aresData.obchodniJmeno || ""),
    street: formatStreet(sidlo),
    city,
    zip,
    country: String(sidlo.nazevStatu || "Česká republika"),
    dic: String(aresData.dic || ""),
    vatPayer,
    vatNote: vatPayer ? "" : "Nejsme plátci DPH",
  };
}

export async function fetchAresByIco(icoInput: string): Promise<AresParty> {
  const ico = normalizeIco(icoInput);
  if (!ico) {
    throw new Error("Zadejte platné IČO (8 číslic).");
  }

  const res = await fetch(`${ARES_BASE}/${ico}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MJ-Faktury/1.0",
    },
    next: { revalidate: 0 },
  });

  if (res.status === 404) {
    throw new Error(`Subjekt s IČO ${ico} nebyl v ARES nalezen.`);
  }

  if (!res.ok) {
    throw new Error(`ARES vrátil chybu (${res.status}). Zkuste to znovu později.`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (!data?.ico) {
    throw new Error(`Subjekt s IČO ${ico} nebyl v ARES nalezen.`);
  }

  return mapAresResponse(data);
}
