import { revalidatePath } from "next/cache";
import { importFromIdoklad } from "@/lib/idoklad";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    clientId?: string;
    clientSecret?: string;
    saveCredentials?: boolean;
  } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const secret = body?.clientSecret?.trim() ?? "";
      try {
        const counts = await importFromIdoklad({
          clientId: body?.clientId,
          clientSecret: body?.clientSecret,
          saveCredentials: body?.saveCredentials !== false,
          signal: request.signal,
          onProgress: send,
        });
        revalidatePath("/", "layout");
        send({ type: "done", ...counts });
      } catch (error) {
        let message = error instanceof Error ? error.message : "Import selhal.";
        if (secret) message = message.split(secret).join("••••");
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
