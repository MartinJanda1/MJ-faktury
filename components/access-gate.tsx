"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isValidIcoChecksum, normalizeIco } from "@/lib/ico";

const STORAGE_KEY = "mj-faktury-access-ico";

type AccessStatus = "loading" | "locked" | "unlocked";

type AccessContextValue = {
  status: AccessStatus;
  unlocked: boolean;
  ico: string | null;
  logout: () => void;
  /** Keep local gate key in sync after company IČO is saved. */
  syncIco: (raw: string) => void;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function useAccess(): AccessContextValue {
  const value = useContext(AccessContext);
  if (!value) {
    throw new Error("useAccess musí být uvnitř AccessGate.");
  }
  return value;
}

type UnlockResponse =
  | { ok: true; mode: "match" | "bootstrap"; ico: string }
  | { ok: false; error: string };

async function verifyIco(raw: string): Promise<UnlockResponse> {
  const res = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ico: raw }),
  });
  const data = (await res.json()) as UnlockResponse;
  return data;
}

function readStoredIco(): string {
  try {
    return normalizeIco(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "";
  }
}

function writeStoredIco(ico: string) {
  try {
    localStorage.setItem(STORAGE_KEY, ico);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredIco() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [ico, setIco] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [checksumHint, setChecksumHint] = useState("");
  const [pending, setPending] = useState(false);

  const unlockWith = useCallback(async (raw: string, fromStorage: boolean) => {
    const normalized = normalizeIco(raw);
    if (!normalized) {
      if (!fromStorage) setError("Zadejte platné IČO (8 číslic).");
      clearStoredIco();
      setIco(null);
      setStatus("locked");
      return false;
    }

    setPending(true);
    setError("");
    try {
      const result = await verifyIco(normalized);
      if (!result.ok) {
        clearStoredIco();
        setIco(null);
        setStatus("locked");
        if (!fromStorage) setError(result.error);
        return false;
      }
      writeStoredIco(result.ico);
      setIco(result.ico);
      setDraft(result.ico);
      setStatus("unlocked");
      setChecksumHint("");
      return true;
    } catch {
      if (!fromStorage) setError("Ověření IČO se nepovedlo. Zkuste to znovu.");
      setStatus("locked");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredIco();
    if (!stored) {
      setStatus("locked");
      return;
    }
    setDraft(stored);
    void unlockWith(stored, true);
  }, [unlockWith]);

  const logout = useCallback(() => {
    clearStoredIco();
    setIco(null);
    setDraft("");
    setError("");
    setChecksumHint("");
    setStatus("locked");
  }, []);

  const syncIco = useCallback((raw: string) => {
    const normalized = normalizeIco(raw);
    if (!normalized) return;
    writeStoredIco(normalized);
    setIco(normalized);
    setDraft(normalized);
  }, []);

  function onDraftChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setDraft(digits);
    setError("");
    if (digits.length === 8 && !isValidIcoChecksum(digits)) {
      setChecksumHint("Kontrolní součet IČO nevypadá správně — zkontrolujte číslo.");
    } else {
      setChecksumHint("");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await unlockWith(draft, false);
  }

  const unlocked = status === "unlocked";
  const showModal = status === "locked";

  return (
    <AccessContext.Provider value={{ status, unlocked, ico, logout, syncIco }}>
      {children}
      <Dialog
        open={showModal}
        disablePointerDismissal
        onOpenChange={(open, eventDetails) => {
          if (!open) eventDetails.cancel();
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Přihlášení IČO</DialogTitle>
            <DialogDescription>
              Pro otevření evidence zadejte IČO dodavatele. Heslo se nepoužívá — stačí správné IČO
              firmy v této instalaci.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">IČO firmy</span>
              <Input
                name="ico"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="12345678"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                disabled={pending}
              />
            </label>
            {checksumHint ? <p className="text-xs text-amber-800">{checksumHint}</p> : null}
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            <p className="text-xs leading-5 text-muted-foreground">
              IČO slouží jen jako jednoduchá pojistka, nejde o silné zabezpečení.
            </p>
            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="submit" disabled={pending || draft.replace(/\D/g, "").length < 8}>
                {pending ? "Ověřuji…" : "Otevřít evidenci"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AccessContext.Provider>
  );
}

export function LockedPlaceholder() {
  return (
    <div className="rounded-xl bg-card px-5 py-12 text-center ring-1 ring-foreground/10">
      <h2 className="font-heading text-2xl tracking-tight">Evidence je zamčená</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Zadejte IČO dodavatele v dialogu. Dokud není ověřené, faktury a statistiky se nezobrazí.
      </p>
    </div>
  );
}
