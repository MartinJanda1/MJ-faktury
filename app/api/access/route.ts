import { normalizeIco } from "@/lib/ico";
import { readCompanyPublic } from "@/lib/persist";

export const dynamic = "force-dynamic";

type UnlockBody = {
  ico?: string;
};

/**
 * Soft gate: IČO alone unlocks this single-tenant installation.
 * Match → ok. Empty company IČO → bootstrap. Different IČO → reject.
 */
export async function POST(request: Request) {
  let body: UnlockBody;
  try {
    body = (await request.json()) as UnlockBody;
  } catch {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }

  const ico = normalizeIco(body.ico);
  if (!ico) {
    return Response.json({ ok: false, error: "Zadejte platné IČO (8 číslic)." }, { status: 400 });
  }

  const company = await readCompanyPublic();
  const stored = normalizeIco(company.ico);

  if (!stored) {
    return Response.json({ ok: true, mode: "bootstrap" as const, ico });
  }

  if (stored === ico) {
    return Response.json({ ok: true, mode: "match" as const, ico });
  }

  return Response.json(
    {
      ok: false,
      error:
        "Zadané IČO neodpovídá firmě v této instalaci. Zkontrolujte číslo, nebo se obraťte na majitele evidence.",
    },
    { status: 403 },
  );
}
