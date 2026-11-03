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
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeIco } from "@/lib/ico";
import { isAccessPasswordFormat } from "@/lib/password-rules";

const STORAGE_KEY = "mj-faktury-access-tenant";

type AccessStatus = "loading" | "locked" | "unlocked";
type AuthTab = "login" | "register";

type StoredSession = {
  tenantId: string;
  ico: string;
  companyName?: string;
};

type AccessContextValue = {
  status: AccessStatus;
  unlocked: boolean;
  tenantId: string | null;
  ico: string | null;
  companyName: string | null;
  logout: () => void;
  /** Keep local session in sync after company settings are saved. */
  syncIco: (raw: string, name?: string) => void;
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
  | {
      ok: true;
      mode: "login" | "register" | "resume" | "logout";
      tenantId?: string;
      ico?: string;
      companyName?: string;
    }
  | { ok: false; error: string };

async function postAccess(body: Record<string, unknown>): Promise<UnlockResponse> {
  const res = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return (await res.json()) as UnlockResponse;
}

async function fetchAccessStatus(): Promise<{ registered: boolean }> {
  const res = await fetch("/api/access", { method: "GET", cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return { registered: false };
  return (await res.json()) as { registered: boolean };
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy key (IČO only) — cannot resume without tenantId.
      localStorage.removeItem("mj-faktury-access-ico");
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const tenantId = String(parsed.tenantId ?? "").trim();
    const ico = normalizeIco(parsed.ico);
    if (!tenantId || !ico) return null;
    return {
      tenantId,
      ico,
      companyName: typeof parsed.companyName === "string" ? parsed.companyName : undefined,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem("mj-faktury-access-ico");
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("mj-faktury-access-ico");
  } catch {
    /* ignore */
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [ico, setIco] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [tab, setTab] = useState<AuthTab>("login");
  const [hasFirms, setHasFirms] = useState(false);

  const [loginIco, setLoginIco] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerIco, setRegisterIco] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const unlockResume = useCallback(async (session: StoredSession) => {
    setPending(true);
    try {
      const result = await postAccess({
        tenantId: session.tenantId,
        ico: session.ico,
        resume: true,
      });
      if (!result.ok || !result.tenantId || !result.ico) {
        clearStoredSession();
        setTenantId(null);
        setIco(null);
        setCompanyName(null);
        setStatus("locked");
        return false;
      }
      const next: StoredSession = {
        tenantId: result.tenantId,
        ico: result.ico,
        companyName: result.companyName || session.companyName || "",
      };
      writeStoredSession(next);
      setTenantId(next.tenantId);
      setIco(next.ico);
      setCompanyName(next.companyName || null);
      setLoginIco(next.ico);
      setStatus("unlocked");
      // Cookie is set only after resume — refresh RSC so pages see the active tenant.
      router.refresh();
      return true;
    } catch {
      setStatus("locked");
      return false;
    } finally {
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await fetchAccessStatus();
        if (cancelled) return;
        setHasFirms(info.registered);
        setTab(info.registered ? "login" : "register");
      } catch {
        if (!cancelled) {
          setHasFirms(false);
          setTab("register");
        }
      }

      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) setStatus("locked");
        return;
      }
      if (!cancelled) setLoginIco(stored.ico);
      await unlockResume(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [unlockResume]);

  const logout = useCallback(() => {
    clearStoredSession();
    setTenantId(null);
    setIco(null);
    setCompanyName(null);
    setLoginPassword("");
    setRegisterPassword("");
    setConfirmPassword("");
    setError("");
    setStatus("locked");
    void postAccess({ logout: true });
  }, []);

  const syncIco = useCallback(
    (raw: string, name?: string) => {
      const normalized = normalizeIco(raw);
      if (!normalized) return;
      setTenantId((currentTenantId) => {
        if (!currentTenantId) return currentTenantId;
        const nextName = name?.trim() || companyName || undefined;
        writeStoredSession({
          tenantId: currentTenantId,
          ico: normalized,
          companyName: nextName,
        });
        if (name?.trim()) setCompanyName(name.trim());
        return currentTenantId;
      });
      setIco(normalized);
      setLoginIco(normalized);
    },
    [companyName],
  );

  async function submitAuth(intent: "login" | "register") {
    const rawIco = intent === "login" ? loginIco : registerIco;
    const password = intent === "login" ? loginPassword : registerPassword;
    const normalized = normalizeIco(rawIco);

    if (!normalized) {
      setError("Zadejte platné IČO (8 číslic).");
      return;
    }
    if (!isAccessPasswordFormat(password)) {
      setError("Heslo: písmena a číslice, nejméně 6 znaků.");
      return;
    }
    if (intent === "register" && password !== confirmPassword) {
      setError("Heslo a potvrzení se neshodují.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = await postAccess({ ico: normalized, password, intent });
      if (!result.ok) {
        setStatus("locked");
        setError(result.error);
        return;
      }
      if (!result.tenantId || !result.ico) {
        setError(intent === "register" ? "Registrace se nepovedla." : "Přihlášení se nepovedlo.");
        setStatus("locked");
        return;
      }
      const next: StoredSession = {
        tenantId: result.tenantId,
        ico: result.ico,
        companyName: result.companyName || "",
      };
      writeStoredSession(next);
      setTenantId(next.tenantId);
      setIco(next.ico);
      setCompanyName(next.companyName || null);
      setLoginIco(next.ico);
      setLoginPassword("");
      setRegisterPassword("");
      setConfirmPassword("");
      setHasFirms(true);
      setStatus("unlocked");
      // Full navigation so Server Components read the new tenant cookie (soft refresh kept stale empty props).
      if (result.mode === "register") {
        window.location.assign("/nastaveni");
        return;
      }
      window.location.reload();
    } catch {
      setError(
        intent === "register" ? "Registrace se nepovedla. Zkuste to znovu." : "Přihlášení se nepovedlo. Zkuste to znovu.",
      );
      setStatus("locked");
    } finally {
      setPending(false);
    }
  }

  function onLoginSubmit(event: FormEvent) {
    event.preventDefault();
    void submitAuth("login");
  }

  function onRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    void submitAuth("register");
  }

  const unlocked = status === "unlocked";
  const showModal = status === "locked";
  const loginReady = normalizeIco(loginIco).length === 8 && isAccessPasswordFormat(loginPassword);
  const registerReady =
    normalizeIco(registerIco).length === 8 &&
    isAccessPasswordFormat(registerPassword) &&
    registerPassword === confirmPassword;

  return (
    <AccessContext.Provider value={{ status, unlocked, tenantId, ico, companyName, logout, syncIco }}>
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
            <DialogTitle>Přístup k evidenci</DialogTitle>
            <DialogDescription>
              Přihlášení otevře existující firmu. Registrace založí novou firmu přes ARES. Přepnutí firmy = odhlášení a
              přihlášení jiným IČO.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value === "register" ? "register" : "login");
              setError("");
            }}
            className="gap-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Přihlášení</TabsTrigger>
              <TabsTrigger value="register">Nová firma</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="pt-1">
              <form onSubmit={onLoginSubmit} className="grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">IČO firmy</span>
                  <Input
                    name="login-ico"
                    inputMode="numeric"
                    autoComplete="username"
                    autoFocus={tab === "login"}
                    placeholder="12345678"
                    value={loginIco}
                    onChange={(event) => {
                      setLoginIco(event.target.value.replace(/\D/g, "").slice(0, 8));
                      setError("");
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Heslo</span>
                  <Input
                    name="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Min. 6 znaků, jen písmena a číslice"
                    value={loginPassword}
                    onChange={(event) => {
                      setLoginPassword(event.target.value);
                      setError("");
                    }}
                    disabled={pending}
                  />
                </label>
                {error && tab === "login" ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground">
                  {hasFirms
                    ? "Přihlaste se IČO a heslem vybrané firmy."
                    : "Zatím není registrovaná žádná firma — použijte záložku Nová firma."}
                </p>
                <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
                  <Button type="submit" disabled={pending || !loginReady}>
                    {pending && tab === "login" ? "Ověřuji…" : "Přihlásit"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="register" className="pt-1">
              <form onSubmit={onRegisterSubmit} className="grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">IČO nové firmy</span>
                  <Input
                    name="register-ico"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus={tab === "register"}
                    placeholder="12345678"
                    value={registerIco}
                    onChange={(event) => {
                      setRegisterIco(event.target.value.replace(/\D/g, "").slice(0, 8));
                      setError("");
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Heslo</span>
                  <Input
                    name="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 6 znaků, jen písmena a číslice"
                    value={registerPassword}
                    onChange={(event) => {
                      setRegisterPassword(event.target.value);
                      setError("");
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Potvrzení hesla</span>
                  <Input
                    name="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Zadejte heslo znovu"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    disabled={pending}
                  />
                </label>
                {error && tab === "register" ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground">
                  IČO ověříme v ARES a založíme novou firmu s vlastními fakturami a heslem. Stejné IČO nelze registrovat
                  dvakrát.
                </p>
                <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
                  <Button type="submit" disabled={pending || !registerReady}>
                    {pending && tab === "register" ? "Zakládám…" : "Založit firmu"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
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
        Přihlaste se IČO a heslem firmy, nebo založte novou firmu registrací. Odhlášení slouží i k přepnutí na jinou
        firmu.
      </p>
    </div>
  );
}
