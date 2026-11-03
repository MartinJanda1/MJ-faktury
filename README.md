# Faktura

Místní evidence vydaných faktur, zálohových faktur, dobropisů a odběratelů. Je určená k tomu, abyste v ní pokračovali po přenosu z [iDokladu](https://www.idoklad.cz/).

V jedné instalaci můžete mít **více firem**. Každá firma má vlastní heslo, faktury, odběratele a bankovní údaje. Přepnutí firmy = odhlášení a přihlášení jiným IČO + heslem.

Aplikace nechce heslo k webu iDoklad. Přihlašovací údaje k účtu sem nepatří. Import má dvě cesty, obě spouštíte vy:

1. **API klíče.** V iDokladu otevřete Nastavení → Aplikace → API a vygenerujte Client ID a Client Secret. Klíče zadáte ve Faktuře v Nastavení (záložka iDoklad). Zůstanou jen v místní databázi u dané firmy.
2. **Soubor, který si stáhnete sami.** Seznam faktur nebo kontaktů jako CSV/XLSX, jednotlivý ISDOC, nebo ZIP s více ISDOC soubory. Export seznamu přenese hlavičku a součet. Položky dokladu jsou v ISDOC a v API.

Opakovaný import aktualizuje doklad se stejným číslem a kontakt se stejným IČO nebo ID z iDokladu. Ruční úpravy těchto polí se při dalším importu přepíší.

## Přístup a firmy

1. **Nová firma** — zadejte IČO a heslo (písmena a číslice, min. 6 znaků). IČO se ověří v ARES a předvyplní údaje dodavatele.
2. **Přihlášení** — IČO existující firmy + její heslo.
3. Po registraci doplňte v Nastavení bankovní údaje (účet, IBAN, SWIFT) — bez nich nelze firmu uložit.
4. **Odhlášení** v postranní liště slouží i k přepnutí na jinou firmu.

Data všech firem jsou v jednom souboru `data/faktura.json` (oddělená podle tenanta). Na Vercelu se používá Vercel Blob.

## Spuštění

```bash
npm install
npm run dev
```

Aplikace běží na [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run lint
```

## Co umí

- více firem v jedné instalaci (izolovaná data, přihlášení IČO + heslo)
- registrace přes ARES a nastavení dodavatele
- přehled částek k úhradě, dokladů po splatnosti a odběratelů
- vystavení, úprava, úhrada a tisk faktury (včetně QR platby)
- adresář odběratelů (načtení z ARES)
- import z iDoklad API v3 a ze souboru
- statistiky a záloha JSON
