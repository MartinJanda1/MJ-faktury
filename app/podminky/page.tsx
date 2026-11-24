import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podmínky a ochrana údajů",
};

export default function PodminkyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
        ← Zpět do aplikace
      </Link>
      <article className="mt-6 space-y-3 text-sm leading-6 [&_h1]:font-heading [&_h1]:text-3xl [&_h2]:mt-6 [&_h2]:font-heading [&_h2]:text-xl [&_ul]:list-disc [&_ul]:pl-5">
        <h1>Podmínky používání a ochrana údajů</h1>
        <p className="text-muted-foreground">Platné od [DATUM NASAZENÍ]</p>

        <h2>Kdo službu provozuje</h2>
        <p>
          Aplikaci MJ Faktura (faktury.jandasoft.cz) provozuje Martin Janda – JandaSoft, IČO 40782310, e-mail{" "}
          <a className="underline" href="mailto:info@jandasoft.cz">
            info@jandasoft.cz
          </a>
          .
        </p>

        <h2>Co služba nabízí</h2>
        <p>
          MJ Faktura slouží k vystavování a evidenci faktur pro živnostníky a malé firmy. Používání je zdarma. Služba je
          poskytována „tak, jak je“: provozovatel se snaží o její bezchybný chod, ale nezaručuje nepřetržitou dostupnost
          ani bezchybnost a neodpovídá za škody vzniklé jejím používáním. Za správnost údajů na fakturách a jejich soulad
          s daňovými předpisy odpovídá uživatel.
        </p>
        <p>
          Provozovatel může službu upravit nebo ukončit. O ukončení dá uživatelům vědět alespoň 30 dní předem, aby si
          mohli data stáhnout.
        </p>

        <h2>Účet a přístup</h2>
        <p>
          Účet se zakládá na IČO firmy, základní údaje se načítají z veřejného registru ARES. Účet smí založit jen osoba
          oprávněná za firmu jednat. Heslo uchovávejte v tajnosti; za činnost pod vaším účtem odpovídáte vy.
        </p>

        <h2>Jaké údaje zpracováváme</h2>
        <ul>
          <li>Údaje o vaší firmě: název, IČO, DIČ, adresa, kontakty, bankovní spojení.</li>
          <li>Obsah evidence: faktury, odběratelé a jejich údaje, položky a částky.</li>
          <li>Technické údaje nutné pro chod služby: datum založení účtu, souhlas s podmínkami, přihlášení.</li>
        </ul>

        <h2>Kdo za údaje odpovídá</h2>
        <ul>
          <li>
            Za údaje o vašem účtu odpovídá provozovatel jako správce. Zpracovává je, aby mohl službu poskytovat (plnění
            smlouvy).
          </li>
          <li>
            Za údaje vašich odběratelů, které do aplikace vložíte, odpovídáte vy jako správce. Provozovatel je pro vás
            zpracovává jen jako zpracovatel: ukládá je a zobrazuje vám je, nic jiného s nimi nedělá, nikomu je neprodává
            a nepoužívá je pro vlastní účely. Používáním služby s tímto zpracováním souhlasíte; tento odstavec tvoří
            zpracovatelské ujednání podle čl. 28 GDPR.
          </li>
        </ul>

        <h2>Kde jsou data uložena</h2>
        <p>
          Aplikace běží na infrastruktuře společnosti Vercel Inc. a data jsou v databázi u [POSKYTOVATEL DATABÁZE,
          REGION – doplnit]. Tito poskytovatelé jsou subdodavatelé (dílčí zpracovatelé) provozovatele. Přenos dat je
          šifrovaný (HTTPS) a hesla jsou uložena v zašifrované podobě.
        </p>

        <h2>Jak dlouho údaje uchováváme a jak je smazat</h2>
        <p>
          Údaje uchováváme po dobu existence účtu. Na požádání na info@jandasoft.cz účet i všechna data smažeme do 30
          dní. Před smazáním si můžete stáhnout zálohu (Import → Stáhnout zálohu JSON). Zákonnou povinnost archivovat
          faktury (zpravidla 10 let) si plní každý uživatel sám.
        </p>

        <h2>Vaše práva</h2>
        <p>
          Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést
          námitku. Stačí napsat na info@jandasoft.cz. Pokud máte za to, že údaje zpracováváme v rozporu s předpisy,
          můžete se obrátit na Úřad pro ochranu osobních údajů (www.uoou.cz).
        </p>

        <h2>Změny podmínek</h2>
        <p>Podmínky můžeme upravit. O podstatných změnách vás informujeme v aplikaci alespoň 14 dní předem.</p>
      </article>
    </main>
  );
}
