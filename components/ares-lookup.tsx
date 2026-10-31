"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AresParty } from "@/lib/ares";

type Props = {
  ico: string;
  onLoaded: (party: AresParty) => void;
  label?: string;
};

export function AresLookup({ ico, onLoaded, label = "Načíst z ARES" }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setPending(true);
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(ico.trim())}`);
      const data = (await res.json()) as AresParty & { error?: string };
      if (!res.ok) {
        setError(data.error || "ARES se nepodařilo načíst.");
        return;
      }
      onLoaded(data);
    } catch {
      setError("ARES je teď nedostupný. Zkuste to znovu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Button type="button" variant="outline" size="sm" onClick={load} disabled={pending || !ico.trim()}>
        {pending ? "Načítám…" : label}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
