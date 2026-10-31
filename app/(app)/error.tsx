"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl font-medium">Něco se nepovedlo</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{error.message || "Stránku se nepodařilo načíst."}</p>
      <Button className="mt-6" onClick={() => reset()}>
        Zkusit znovu
      </Button>
    </div>
  );
}
