# Faktura

Místní evidence vydaných faktur, zálohových faktur, dobropisů a odběratelů. Je určená k tomu, abyste v ní pokračovali po přenosu z [iDokladu](https://www.idoklad.cz/).

Aplikace nechce heslo k webu iDoklad. Přihlašovací údaje k účtu sem nepatří. Import má dvě cesty, obě spouštíte vy:

1. **API klíče.** V iDokladu otevřete Nastavení → Aplikace → API a vygenerujte Client ID a Client Secret. Klíče zadáte ve Faktuře na stránce Import. Zůstanou jen v místní databázi `data/faktura.db`.
2. **Soubor, který si stáhnete sami.** Seznam faktur nebo kontaktů jako CSV/XLSX, jednotlivý ISDOC, nebo ZIP s více ISDOC soubory. Export seznamu přenese hlavičku a součet. Položky dokladu jsou v ISDOC a v API.

Opakovaný import aktualizuje doklad se stejným číslem a kontakt se stejným IČO nebo ID z iDokladu. Ruční úpravy těchto polí se při dalším importu přepíší.

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

Evidence nemá vlastní přihlášení. Je myšlená pro počítač, ke kterému máte přístup jen vy. Databáze je soubor `data/faktura.db` a do gitu se neukládá.

## Co umí

- přehled částek k úhradě, dokladů po splatnosti a odběratelů
- vystavení, úprava, úhrada a tisk faktury
- adresář odběratelů
- import z iDoklad API v3 a ze souboru
- údaje vaší firmy na tištěném dokladu
