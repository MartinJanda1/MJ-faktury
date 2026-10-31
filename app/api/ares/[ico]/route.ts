import { fetchAresByIco, normalizeIco } from "@/lib/ares";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ ico: string }> }) {
  const { ico: raw } = await context.params;
  const ico = normalizeIco(raw);
  if (!ico) {
    return Response.json({ error: "Zadejte platné IČO (8 číslic)." }, { status: 400 });
  }

  try {
    const party = await fetchAresByIco(ico);
    return Response.json(party);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ARES se nepodařilo načíst.";
    const status = message.includes("nebyl v ARES nalezen") ? 404 : 502;
    return Response.json({ error: message }, { status });
  }
}
