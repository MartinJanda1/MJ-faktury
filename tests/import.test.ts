import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { importIsdocXml } from "../lib/isdoc.ts";
import { mapContact, mapIssuedDocument } from "../lib/idoklad-map.ts";
import { lineTotals, parseAmount, parseIsoDate, snapVat } from "../lib/money.ts";
import { displayStatus, suggestNextNumber } from "../lib/status.ts";
import { importRows, parseCsv } from "../lib/tabular.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "faktura-"));
process.env.FAKTURA_DB_PATH = path.join(dir, "test.json");
delete process.env.BLOB_READ_WRITE_TOKEN;

test("money helpers read Czech amounts and dates", () => {
  assert.equal(parseAmount("1 234,50 Kč"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseIsoDate("1. 3. 2024"), "2024-03-01");
  assert.equal(parseIsoDate("09/30/2026"), "2026-09-30");
  assert.equal(snapVat(20.9), 21);
  assert.deepEqual(lineTotals(2, 100, 21), { totalNet: 200, totalVat: 42, totalGross: 242 });
});

test("overdue status uses the due date", () => {
  assert.equal(displayStatus({ status: "issued", dueDate: "2020-01-01", paidDate: null }, "2026-10-31"), "overdue");
  assert.equal(displayStatus({ status: "paid", dueDate: "2020-01-01", paidDate: "2020-01-02" }, "2026-10-31"), "paid");
  assert.equal(suggestNextNumber(["20240012", "20240007"]), "20240013");
  assert.equal(suggestNextNumber(["VF 08/2026", "VF 09/2026"], "2026-10-31"), "VF 10/2026");
});

test("iDoklad invoice keeps API totals and links the contact", () => {
  const contact = mapContact({
    Id: 55,
    CompanyName: "Studio Les s.r.o.",
    IdentificationNumber: "12345678",
    VatIdentificationNumber: "CZ12345678",
    Street: "Dlouhá 12",
    City: "Praha",
    PostalCode: "110 00",
    Email: "fakturace@les.cz",
  });
  assert.equal(contact?.externalId, "idoklad:contact:55");
  const invoice = mapIssuedDocument(
    {
      Id: 1001,
      DocumentNumber: "20240015",
      VariableSymbol: "20240015",
      DateOfIssue: "2024-03-01T00:00:00",
      DateOfMaturity: "2024-03-15T00:00:00",
      DateOfTaxing: "2024-03-01T00:00:00",
      PaymentStatus: 0,
      CurrencyId: 1,
      PartnerId: 55,
      Description: "Správa webu",
      PartnerAddress: {
        CompanyName: "Studio Les s.r.o.",
        IdentificationNumber: "12345678",
        Street: "Dlouhá 12",
        City: "Praha",
      },
      MyAddress: { CompanyName: "Martin Janda", AccountNumber: "123456789", BankCode: "0100" },
      Prices: { TotalWithoutVat: 1000, TotalVat: 210, TotalWithVat: 1210 },
      Items: [
        {
          Name: "Správa webu",
          Amount: 1,
          Unit: "měs.",
          UnitPrice: 1210,
          PriceType: 0,
          VatRateType: 1,
          VatRate: 21,
          Prices: { TotalWithoutVat: 1000, TotalVat: 210, TotalWithVat: 1210 },
        },
      ],
    },
    "issued",
  );
  assert.equal(invoice?.customerExternalId, "idoklad:contact:55");
  assert.equal(invoice?.items[0].unitPrice, 1000);
  assert.equal(invoice?.items[0].totalGross, 1210);
  assert.equal(invoice?.supplier?.bankAccount, "123456789");
  assert.equal(invoice?.status, "issued");
});

test("semicolon CSV import groups a summary invoice", () => {
  const rows = parseCsv("Číslo dokladu;Odběratel;IČO;Datum vystavení;Datum splatnosti;Celkem s DPH;Základ;DPH\n20240015;Studio Les s.r.o.;12345678;1.3.2024;15.3.2024;1 210,00;1 000,00;210,00\n");
  const imported = importRows(rows, "faktury.csv");
  assert.equal(imported.invoices.length, 1);
  assert.equal(imported.invoices[0].number, "20240015");
  assert.equal(imported.invoices[0].customerName, "Studio Les s.r.o.");
  assert.equal(imported.invoices[0].items[0].totalGross, 1210);
  assert.equal(imported.invoices[0].items[0].vatRate, 21);
  assert.equal(imported.customers[0].ico, "12345678");
});

test("iDoklad issued-invoice list CSV maps Název/Jméno, dates and Kč", () => {
  const csv = `Číslo dokladu,Popis,Číslo objednávky,Řada,Název/Jméno,IČ,DIČ,Vystaveno,Splatnost,Datum platby,Celkem,Měna,Stav úhrady,Uhrazená částka,Variabilní symbol,Exportováno,Odesláno odběrateli,Odesláno účetnímu
VF 09/2026,"Odborné práce",,Výchozí,Your Solutions s.r.o.,22154256,,09/30/2026,10/30/2026,10/31/2026,81250.00,Kč,Uhrazeno,81250.00,92026,Ne,Neodesláno,Ne
VF 08/2026,"Odborné práce",,Výchozí,"YOUR SYSTEM, spol.s r.o.",25596641,,08/31/2026,09/30/2026,09/30/2026,70000.00,Kč,Uhrazeno,70000.00,82026,Ne,Neodesláno,Ne
`;
  const imported = importRows(parseCsv(csv), "Seznam vydaných faktur.csv");
  assert.equal(imported.invoices.length, 2);
  assert.equal(imported.invoices[0].customerName, "Your Solutions s.r.o.");
  assert.equal(imported.invoices[0].customerIco, "22154256");
  assert.equal(imported.invoices[0].issueDate, "2026-09-30");
  assert.equal(imported.invoices[0].dueDate, "2026-10-30");
  assert.equal(imported.invoices[0].paidDate, "2026-10-31");
  assert.equal(imported.invoices[0].status, "paid");
  assert.equal(imported.invoices[0].currency, "CZK");
  assert.equal(imported.invoices[0].items[0].totalGross, 81250);
  assert.equal(imported.customers.length, 2);
  assert.equal(imported.customers[1].name, "YOUR SYSTEM, spol.s r.o.");
  assert.equal(parseIsoDate("09/30/2026"), "2026-09-30");
});

test("ISDOC keeps line items and the customer", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
  <ID>20240015</ID>
  <UUID>abc-123</UUID>
  <IssueDate>2024-03-01</IssueDate>
  <TaxPointDate>2024-03-01</TaxPointDate>
  <LocalCurrencyCode>CZK</LocalCurrencyCode>
  <AccountingSupplierParty><Party>
    <PartyIdentification><ID>87654321</ID></PartyIdentification>
    <PartyName><Name>Martin Janda</Name></PartyName>
    <PostalAddress><StreetName>Krátká</StreetName><BuildingNumber>2</BuildingNumber><CityName>Brno</CityName><PostalZone>60200</PostalZone></PostalAddress>
  </Party></AccountingSupplierParty>
  <AccountingCustomerParty><Party>
    <PartyIdentification><ID>12345678</ID></PartyIdentification>
    <PartyName><Name>Studio Les s.r.o.</Name></PartyName>
    <PostalAddress><StreetName>Dlouhá</StreetName><BuildingNumber>12</BuildingNumber><CityName>Praha</CityName><PostalZone>11000</PostalZone></PostalAddress>
    <PartyTaxScheme><CompanyID>CZ12345678</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>
    <Contact><ElectronicMail>fakturace@les.cz</ElectronicMail></Contact>
  </Party></AccountingCustomerParty>
  <InvoiceLines>
    <InvoiceLine>
      <ID>1</ID>
      <InvoicedQuantity unitCode="měs.">1</InvoicedQuantity>
      <LineExtensionAmount>1000</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>1210</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>210</LineExtensionTaxAmount>
      <UnitPrice>1000</UnitPrice>
      <ClassifiedTaxCategory><Percent>21</Percent></ClassifiedTaxCategory>
      <Item><Description>Správa webu</Description></Item>
    </InvoiceLine>
  </InvoiceLines>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>1000</TaxExclusiveAmount>
    <TaxInclusiveAmount>1210</TaxInclusiveAmount>
    <PayableAmount>1210</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans><Payment>
    <PaidAmount>0</PaidAmount>
    <Details><PaymentDueDate>2024-03-15</PaymentDueDate><VariableSymbol>20240015</VariableSymbol></Details>
  </Payment></PaymentMeans>
</Invoice>`;
  const imported = importIsdocXml(xml, "faktura.isdoc");
  assert.equal(imported.invoices[0].number, "20240015");
  assert.equal(imported.invoices[0].items[0].name, "Správa webu");
  assert.equal(imported.invoices[0].items[0].vatRate, 21);
  assert.equal(imported.customers[0].dic, "CZ12345678");
  assert.equal(imported.supplier?.name, "Martin Janda");
  assert.equal(imported.supplier?.street, "Krátká 2");
});

test("repeated import updates the same invoice and customer", async () => {
  const { applyImport, getInvoiceRow, listCustomerRows, listInvoiceRows } = await import("../lib/persist.ts");
  const first = await applyImport(
    [
      {
        externalId: "idoklad:contact:55",
        source: "idoklad",
        name: "Studio Les s.r.o.",
        ico: "12345678",
        dic: "CZ12345678",
        street: "Dlouhá 12",
        city: "Praha",
        zip: "110 00",
        country: "Česká republika",
        email: "fakturace@les.cz",
        phone: "",
        note: "",
      },
    ],
    [
      {
        externalId: "idoklad:issued:1001",
        source: "idoklad",
        kind: "issued",
        number: "20240015",
        variableSymbol: "20240015",
        constantSymbol: "",
        specificSymbol: "",
        customerExternalId: "idoklad:contact:55",
        customerName: "Studio Les s.r.o.",
        customerIco: "12345678",
        customerDic: "",
        customerStreet: "",
        customerCity: "",
        customerZip: "",
        customerCountry: "",
        customerEmail: "",
        issueDate: "2024-03-01",
        dueDate: "2024-03-15",
        taxDate: "2024-03-01",
        paidDate: null,
        currency: "CZK",
        status: "issued",
        description: "Správa webu",
        note: "",
        items: [{ name: "Správa webu", quantity: 1, unit: "měs.", unitPrice: 1000, vatRate: 21, totalNet: 1000, totalVat: 210, totalGross: 1210 }],
        supplier: null,
      },
    ],
    null,
  );
  assert.equal(first.invoicesCreated, 1);
  assert.equal(first.customersCreated, 1);
  const second = await applyImport(
    [],
    [
      {
        externalId: "idoklad:issued:1001",
        source: "idoklad",
        kind: "issued",
        number: "20240015",
        variableSymbol: "20240015",
        constantSymbol: "",
        specificSymbol: "",
        customerExternalId: "idoklad:contact:55",
        customerName: "Studio Les s.r.o.",
        customerIco: "12345678",
        customerDic: "",
        customerStreet: "",
        customerCity: "",
        customerZip: "",
        customerCountry: "",
        customerEmail: "",
        issueDate: "2024-03-01",
        dueDate: "2024-03-15",
        taxDate: "2024-03-01",
        paidDate: "2024-03-10",
        currency: "CZK",
        status: "paid",
        description: "Správa webu",
        note: "",
        items: [{ name: "Správa webu", quantity: 1, unit: "měs.", unitPrice: 1000, vatRate: 21 }],
        supplier: null,
      },
    ],
    null,
  );
  assert.equal(second.invoicesUpdated, 1);
  assert.equal(second.invoicesCreated, 0);
  const customers = await listCustomerRows("");
  assert.equal(customers.length, 1);
  const listed = await listInvoiceRows({ query: "20240015" });
  const invoice = await getInvoiceRow(listed[0].id);
  assert.equal(invoice?.status, "paid");
  assert.equal(invoice?.customerId, customers[0].id);
  assert.equal(invoice?.items.length, 1);
});

test("xlsx contact sheet is recognized", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kontakty");
  sheet.addRow(["Firma", "IČO", "E-mail", "Město"]);
  sheet.addRow(["Studio Les s.r.o.", "12345678", "fakturace@les.cz", "Praha"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const { rowsFromXlsx } = await import("../lib/files.ts");
  const rows = await rowsFromXlsx(buffer);
  const imported = importRows(rows, "kontakty.xlsx");
  assert.equal(imported.customers[0].name, "Studio Les s.r.o.");
  assert.equal(imported.invoices.length, 0);
});
