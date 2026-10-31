import { revalidatePath } from "next/cache";
import { importFiles } from "@/lib/files";

export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) {
    return Response.json({ error: "Vyberte aspoň jeden soubor." }, { status: 400 });
  }
  const payload = [];
  for (const file of files) {
    payload.push({ name: file.name, buffer: Buffer.from(await file.arrayBuffer()) });
  }
  const counts = await importFiles(payload);
  revalidatePath("/", "layout");
  return Response.json(counts);
}
