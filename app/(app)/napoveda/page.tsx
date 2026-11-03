import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Nápověda" };

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Aplikace"
        title="Nápověda"
        description="Krátký přehled práce s evidencí faktur."
      />

      <article className="grid max-w-3xl gap-8 rounded-xl bg-card p-5 text-sm leading-6 ring-1 ring-foreground/10 sm:p-6">
        <section className="grid gap-2">
          <h2 className="text-base font-medium">Přístup a více firem</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              Evidence je chráněná IČO a heslem (písmena a číslice, nejméně 6 znaků). V jedné instalaci může být
              více firem; každá má vlastní faktury, odběratele, banku i heslo.
            </li>
            <li>
              <strong className="font-medium text-foreground">Nová firma</strong> — zadejte IČO a heslo. IČO se ověří
              v ARES a předvyplní údaje dodavatele. Stejné IČO nelze registrovat dvakrát.
            </li>
            <li>
              <strong className="font-medium text-foreground">Přihlášení</strong> — IČO existující firmy a její heslo.
            </li>
            <li>
              Po registraci otevřete{" "}
              <Link href="/nastaveni" className="text-foreground underline-offset-2 hover:underline">
                Nastavení
              </Link>{" "}
              a doplňte bankovní údaje (účet, kód banky, IBAN, SWIFT). Bez banky a hesla nelze firmu uložit.
            </li>
            <li>
              <strong className="font-medium text-foreground">Přepnutí firmy</strong> — odhlaste se v postranní liště a
              přihlaste se jiným IČO. Přepínač bez hesla aplikace nemá.
            </li>
            <li>Heslo změníte v Nastavení na záložce Heslo (u již nastaveného hesla je potřeba současné).</li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium">Nová faktura</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>
              Otevřete{" "}
              <Link href="/faktury/nova" className="text-foreground underline-offset-2 hover:underline">
                Nová faktura
              </Link>
              .
            </li>
            <li>
              Vyberte odběratele z adresáře. Nového založíte v sekci Odběratelé; IČO lze načíst z ARES (tlačítko vedle
              pole IČO).
            </li>
            <li>
              Číslo dokladu se navrhne automaticky (řada <code className="text-xs">číslo/rok</code>, VF nebo číselná
              přípona).
            </li>
            <li>Výchozí vzhled je Moderní; způsob platby a případně číslo objednávky nastavíte u dokladu.</li>
          </ol>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium">Úprava a PDF</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              Údaje firmy (IČO z ARES, účet, IBAN, SWIFT, poznámka „Nejsme plátci DPH“, patička, iDoklad klíče) nastavíte
              v{" "}
              <Link href="/nastaveni" className="text-foreground underline-offset-2 hover:underline">
                Nastavení
              </Link>
              .
            </li>
            <li>
              PDF stáhnete z detailu dokladu (včetně QR platby převodem). Vzhled (Klasická, Moderní, Elegantní,
              Kontrastní a další) zvolíte přímo před stažením PDF.
            </li>
            <li>
              Koncept, vystavené, částečně uhrazené i po splatnosti jdou upravit. Uhrazený doklad je jen ke čtení — před
              úpravou zrušte úhradu. Storno nejdřív zrušte, teprve pak upravujte.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium">Seznam a statistiky</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Filtry: období, stav, odběratel, hledání a řazení sloupců.</li>
            <li>Kopírování vytvoří nový doklad s navazujícím číslem a dnešním datem.</li>
            <li>
              <Link href="/statistiky" className="text-foreground underline-offset-2 hover:underline">
                Statistiky
              </Link>{" "}
              ukazují obrat, KPI, grafy a rozpad podle období a odběratele (filtry se pamatují). Platí vždy jen pro
              přihlášenou firmu.
            </li>
            <li>V seznamu faktur jsou rychlé akce: PDF, úhrada, kopie, storno.</li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium">Import a záloha</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>API klíče (Client ID / Secret) — bez hesla k webu iDoklad; ukládají se u aktivní firmy.</li>
            <li>Soubor CSV/XLSX, ISDOC, ZIP s ISDOC nebo JSON export faktura-app.</li>
            <li>Opakovaný import aktualizuje doklad se stejným číslem a kontakt se stejným IČO.</li>
            <li>
              Zálohu JSON aktivní firmy stáhnete na stránce{" "}
              <Link href="/import" className="text-foreground underline-offset-2 hover:underline">
                Import
              </Link>
              .
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium">Storno a mazání</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Stornovaný doklad zůstane v seznamu a zachová číslo.</li>
            <li>Mazání dokladu je nevratné v této evidenci; v iDokladu se nic nemění.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
