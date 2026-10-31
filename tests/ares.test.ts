import assert from "node:assert/strict";
import { test } from "node:test";
import { mapAresResponse, normalizeIco } from "../lib/ares";

test("normalizeIco keeps 8 digits", () => {
  assert.equal(normalizeIco("12345678"), "12345678");
  assert.equal(normalizeIco("IČ 12 345 678"), "12345678");
  assert.equal(normalizeIco("123"), "");
});

test("mapAresResponse fills street city zip and VAT note", () => {
  const party = mapAresResponse({
    ico: "27074358",
    obchodniJmeno: "Example s.r.o.",
    dic: "CZ27074358",
    sidlo: {
      nazevUlice: "Hlavní",
      cisloDomovni: 1,
      cisloOrientacni: 2,
      psc: 11000,
      nazevObce: "Praha",
      nazevStatu: "Česká republika",
    },
    seznamRegistraci: { stavZdrojeDph: "AKTIVNI" },
  });

  assert.equal(party.ico, "27074358");
  assert.equal(party.name, "Example s.r.o.");
  assert.equal(party.street, "Hlavní 1/2");
  assert.equal(party.zip, "110 00");
  assert.equal(party.city, "Praha");
  assert.equal(party.dic, "CZ27074358");
  assert.equal(party.vatPayer, true);
  assert.equal(party.vatNote, "");
});

test("mapAresResponse marks non-VAT payer", () => {
  const party = mapAresResponse({
    ico: "12345678",
    obchodniJmeno: "OSVČ",
    sidlo: { textovaAdresa: "Vedlejší 3, Brno" },
    seznamRegistraci: { stavZdrojeDph: "NEEXISTUJICI" },
  });
  assert.equal(party.street, "Vedlejší 3");
  assert.equal(party.vatPayer, false);
  assert.equal(party.vatNote, "Nejsme plátci DPH");
});
