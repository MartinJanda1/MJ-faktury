"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countLabel } from "@/lib/money";
import type { ImportCounts } from "@/lib/types";

export function ImportPanel({ clientId, hasSecret }: { clientId: string; hasSecret: boolean }) {
  return (
    <Tabs defaultValue="soubor">
      <TabsList>
        <TabsTrigger value="soubor">CSV / Excel / ISDOC</TabsTrigger>
        <TabsTrigger value="api">API (placené)</TabsTrigger>
      </TabsList>
      <TabsContent value="soubor" className="pt-4">
        <FileImport />
      </TabsContent>
      <TabsContent value="api" className="pt-4">
        <ApiImport clientId={clientId} hasSecret={hasSecret} />
      </TabsContent>
    </Tabs>
  );
}

function ApiImport({ clientId, hasSecret }: { clientId: string; hasSecret: boolean }) {
  const router = useRouter();
  const [id, setId] = useState(clientId);
  const [secret, setSecret] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ImportCounts | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError("");
    setResult(null);
    setLogs(["Připojuji se k iDokladu…"]);
    try {
      const response = await fetch("/api/import/idoklad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: id, clientSecret: secret, saveCredentials }),
      });
      if (!response.body) throw new Error("Server nevrátil průběh importu.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; message?: string } & ImportCounts;
          if (event.type === "log" && event.message) setLogs((current) => [...current, event.message!]);
          if (event.type === "error") setError(event.message || "Import selhal.");
          if (event.type === "done") {
            setResult(event);
            router.refresh();
          }
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import selhal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        API obvykle vyžaduje placený tarif iDokladu. Pokud klíč nemáte, použijte záložku CSV / Excel. Heslo k webu sem nepatří.
      </p>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Client ID</span>
        <Input value={id} onChange={(event) => setId(event.target.value)} autoComplete="off" />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Client Secret</span>
        <Input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          autoComplete="new-password"
          placeholder={hasSecret ? "Nechte prázdné, použije se uložený klíč" : ""}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saveCredentials} onChange={(event) => setSaveCredentials(event.target.checked)} className="size-4" />
        Zapamatovat klíče v této aplikaci
      </label>
      <div>
        <Button type="button" onClick={start} disabled={pending || (!id && !clientId) || (!secret && !hasSecret)}>
          {pending ? "Stahuji…" : "Stáhnout z iDokladu"}
        </Button>
      </div>
      <Outcome error={error} result={result} logs={logs} />
    </div>
  );
}

function FileImport() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportCounts | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/import/soubor", { method: "POST", body: data });
      const payload = (await response.json()) as ImportCounts & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Soubor se nepodařilo načíst.");
      setResult(payload);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Soubor se nepodařilo načíst.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Nahrajte CSV nebo XLSX ze seznamu faktur a klidně i zvlášť export kontaktů. Můžete nahrát více souborů najednou. ISDOC nebo ZIP s ISDOC soubory přinese i položky dokladu.
      </p>
      <Input name="files" type="file" multiple accept=".csv,.txt,.xlsx,.xlsm,.xml,.isdoc,.zip,text/csv,application/xml" required />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Načítám…" : "Načíst soubor"}
        </Button>
      </div>
      <Outcome error={error} result={result} logs={[]} />
    </form>
  );
}

function Outcome({ error, result, logs }: { error: string; result: ImportCounts | null; logs: string[] }) {
  if (!error && !result && logs.length === 0) return null;
  return (
    <div className="grid gap-3">
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="rounded-lg bg-primary/10 px-3 py-3 text-sm leading-6">
          <p>
            Odběratelé: {countLabel(result.customersCreated, "nový", "noví", "nových")}, {countLabel(result.customersUpdated, "aktualizovaný", "aktualizované", "aktualizovaných")}.
          </p>
          <p>
            Doklady: {countLabel(result.invoicesCreated, "nový", "nové", "nových")}, {countLabel(result.invoicesUpdated, "aktualizovaný", "aktualizované", "aktualizovaných")}.
          </p>
          <p className="mt-2 text-muted-foreground">Opakovaný import přepíše doklady se stejným číslem a kontakty se stejným IČO nebo ID z iDokladu.</p>
        </div>
      ) : null}
      {result?.warnings.length ? (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {result.warnings.slice(0, 12).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {logs.length > 0 ? (
        <ol className="max-h-48 overflow-auto rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {logs.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
