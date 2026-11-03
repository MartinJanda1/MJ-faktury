import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashAccessPassword } from "../lib/password.ts";
import { migrateToV2, type StoreDocument } from "../lib/store.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "faktura-mt-"));
const dbPath = path.join(dir, "store.json");
delete process.env.BLOB_READ_WRITE_TOKEN;

function useMtDb() {
  process.env.FAKTURA_DB_PATH = dbPath;
  delete process.env.FAKTURA_TENANT_ID;
}

test("migrateToV2 wraps legacy v1 document into a single tenant", () => {
  const legacy = {
    version: 1,
    company: {
      name: "Martin Janda",
      ico: "40782310",
      dic: "",
      street: "Krátká 1",
      city: "Praha",
      zip: "110 00",
      country: "Česká republika",
      email: "",
      phone: "",
      vatNote: "",
      bankAccount: "1",
      bankCode: "0100",
      iban: "",
      swift: "",
      footerNote: "",
      idokladClientId: "",
      hasIdokladSecret: false,
      hasAccessPassword: true,
      idokladClientSecret: "",
      accessPasswordHash: "hash",
    },
    customers: [{ id: "c1", name: "Odběratel", ico: "12345678" }],
    invoices: [{ id: "i1", number: "20240001", kind: "issued" }],
    items: [{ id: "x1", invoiceId: "i1", name: "Práce", position: 1 }],
  };

  const migrated = migrateToV2(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.tenants.length, 1);
  assert.ok(migrated.tenants[0].id);
  assert.equal(migrated.tenants[0].company.ico, "40782310");
  assert.equal(migrated.tenants[0].company.accessPasswordHash, "hash");
  assert.equal(migrated.tenants[0].customers.length, 1);
  assert.equal(migrated.tenants[0].invoices.length, 1);
  assert.equal(migrated.tenants[0].items.length, 1);
});

test("migrateToV2 keeps an already-v2 document", () => {
  const v2 = {
    version: 2,
    tenants: [
      {
        id: "tenant-a",
        company: { name: "A", ico: "11111111", accessPasswordHash: "a", idokladClientSecret: "" },
        customers: [],
        invoices: [],
        items: [],
      },
    ],
  };
  const migrated = migrateToV2(v2);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.tenants[0].id, "tenant-a");
  assert.equal(migrated.tenants[0].company.ico, "11111111");
});

test("registerCompanyAccess creates a second firm without blocking", async () => {
  useMtDb();
  const { registerCompanyAccess, findTenantByIco, readAccessStatus } = await import("../lib/persist.ts");
  const { loadStore } = await import("../lib/store.ts");

  const partyA = {
    name: "Firma Alpha",
    dic: "CZ11111111",
    street: "Ulice 1",
    city: "Praha",
    zip: "110 00",
    country: "Česká republika",
    vatNote: "",
  };
  const partyB = {
    name: "Firma Beta",
    dic: "CZ22222222",
    street: "Ulice 2",
    city: "Brno",
    zip: "602 00",
    country: "Česká republika",
    vatNote: "",
  };

  const first = await registerCompanyAccess("11111111", hashAccessPassword("heslo11"), partyA);
  const second = await registerCompanyAccess("22222222", hashAccessPassword("heslo22"), partyB);

  assert.notEqual(first.tenantId, second.tenantId);
  assert.equal(first.ico, "11111111");
  assert.equal(second.ico, "22222222");

  const status = await readAccessStatus();
  assert.equal(status.registered, true);

  const doc = await loadStore();
  assert.equal(doc.tenants.length, 2);

  const byIco = await findTenantByIco("22222222");
  assert.equal(byIco?.id, second.tenantId);
  assert.equal(byIco?.company.name, "Firma Beta");

  await assert.rejects(
    () => registerCompanyAccess("11111111", hashAccessPassword("jine11"), partyA),
    /už je registrována/,
  );
});

test("invoice data is isolated between tenants", async () => {
  useMtDb();
  const {
    applyImport,
    listInvoiceRows,
    listCustomerRows,
    resumeTenantSession,
  } = await import("../lib/persist.ts");
  const { loadStore } = await import("../lib/store.ts");

  const doc = await loadStore();
  assert.ok(doc.tenants.length >= 2);
  const tenantA = doc.tenants.find((t) => t.company.ico === "11111111");
  const tenantB = doc.tenants.find((t) => t.company.ico === "22222222");
  assert.ok(tenantA && tenantB);

  process.env.FAKTURA_TENANT_ID = tenantA.id;
  await applyImport(
    [
      {
        externalId: null,
        source: "manual",
        name: "Zákazník Alpha",
        ico: "33333333",
        dic: "",
        street: "",
        city: "",
        zip: "",
        country: "Česká republika",
        email: "",
        phone: "",
        note: "",
      },
    ],
    [
      {
        externalId: null,
        source: "manual",
        kind: "issued",
        number: "A-001",
        variableSymbol: "A001",
        constantSymbol: "",
        specificSymbol: "",
        customerExternalId: null,
        customerName: "Zákazník Alpha",
        customerIco: "33333333",
        customerDic: "",
        customerStreet: "",
        customerCity: "",
        customerZip: "",
        customerCountry: "",
        customerEmail: "",
        issueDate: "2024-01-01",
        dueDate: "2024-01-15",
        taxDate: "2024-01-01",
        paidDate: null,
        currency: "CZK",
        status: "issued",
        description: "",
        note: "",
        items: [{ name: "Služba A", quantity: 1, unit: "ks", unitPrice: 100, vatRate: 21 }],
        supplier: null,
      },
    ],
    null,
  );

  process.env.FAKTURA_TENANT_ID = tenantB.id;
  await applyImport(
    [
      {
        externalId: null,
        source: "manual",
        name: "Zákazník Beta",
        ico: "44444444",
        dic: "",
        street: "",
        city: "",
        zip: "",
        country: "Česká republika",
        email: "",
        phone: "",
        note: "",
      },
    ],
    [
      {
        externalId: null,
        source: "manual",
        kind: "issued",
        number: "B-001",
        variableSymbol: "B001",
        constantSymbol: "",
        specificSymbol: "",
        customerExternalId: null,
        customerName: "Zákazník Beta",
        customerIco: "44444444",
        customerDic: "",
        customerStreet: "",
        customerCity: "",
        customerZip: "",
        customerCountry: "",
        customerEmail: "",
        issueDate: "2024-02-01",
        dueDate: "2024-02-15",
        taxDate: "2024-02-01",
        paidDate: null,
        currency: "CZK",
        status: "issued",
        description: "",
        note: "",
        items: [{ name: "Služba B", quantity: 1, unit: "ks", unitPrice: 200, vatRate: 21 }],
        supplier: null,
      },
    ],
    null,
  );

  process.env.FAKTURA_TENANT_ID = tenantA.id;
  const invoicesA = await listInvoiceRows({});
  const customersA = await listCustomerRows("");
  assert.equal(invoicesA.length, 1);
  assert.equal(invoicesA[0].number, "A-001");
  assert.equal(customersA.length, 1);
  assert.equal(customersA[0].name, "Zákazník Alpha");

  process.env.FAKTURA_TENANT_ID = tenantB.id;
  const invoicesB = await listInvoiceRows({});
  const customersB = await listCustomerRows("");
  assert.equal(invoicesB.length, 1);
  assert.equal(invoicesB[0].number, "B-001");
  assert.equal(customersB.length, 1);
  assert.equal(customersB[0].name, "Zákazník Beta");

  const resumed = await resumeTenantSession(tenantA.id, "11111111");
  assert.equal(resumed?.tenantId, tenantA.id);
  assert.equal(resumed?.ico, "11111111");

  const badResume = await resumeTenantSession(tenantA.id, "22222222");
  assert.equal(badResume, null);

  // Cleanup env so other test files are not affected if run in same process.
  delete process.env.FAKTURA_TENANT_ID;
});

test("empty or unknown payload migrates to empty v2 store", () => {
  const empty = migrateToV2(null) as StoreDocument;
  assert.equal(empty.version, 2);
  assert.deepEqual(empty.tenants, []);
  assert.deepEqual(migrateToV2({}).tenants, []);
});
