import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const globalForDb = globalThis as unknown as { fakturaDb?: Database.Database };

function databasePath() {
  if (process.env.FAKTURA_DB_PATH) return process.env.FAKTURA_DB_PATH;
  return path.join(process.cwd(), "data", "faktura.db");
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      ico TEXT NOT NULL DEFAULT '',
      dic TEXT NOT NULL DEFAULT '',
      street TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Česká republika',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      bank_account TEXT NOT NULL DEFAULT '',
      bank_code TEXT NOT NULL DEFAULT '',
      iban TEXT NOT NULL DEFAULT '',
      swift TEXT NOT NULL DEFAULT '',
      idoklad_client_id TEXT NOT NULL DEFAULT '',
      idoklad_client_secret TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      ico TEXT NOT NULL DEFAULT '',
      dic TEXT NOT NULL DEFAULT '',
      street TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Česká republika',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      number TEXT NOT NULL,
      variable_symbol TEXT NOT NULL DEFAULT '',
      constant_symbol TEXT NOT NULL DEFAULT '',
      specific_symbol TEXT NOT NULL DEFAULT '',
      customer_id TEXT,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_ico TEXT NOT NULL DEFAULT '',
      customer_dic TEXT NOT NULL DEFAULT '',
      customer_street TEXT NOT NULL DEFAULT '',
      customer_city TEXT NOT NULL DEFAULT '',
      customer_zip TEXT NOT NULL DEFAULT '',
      customer_country TEXT NOT NULL DEFAULT '',
      customer_email TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      tax_date TEXT NOT NULL DEFAULT '',
      paid_date TEXT,
      currency TEXT NOT NULL DEFAULT 'CZK',
      status TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      total_net REAL NOT NULL DEFAULT 0,
      total_vat REAL NOT NULL DEFAULT 0,
      total_gross REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      vat_rate REAL NOT NULL,
      total_net REAL NOT NULL,
      total_vat REAL NOT NULL,
      total_gross REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS customers_external
      ON customers(external_id) WHERE external_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS customers_ico ON customers(ico);
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_external
      ON invoices(external_id) WHERE external_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS invoices_number ON invoices(number);
    CREATE INDEX IF NOT EXISTS invoices_issue ON invoices(issue_date);
    CREATE INDEX IF NOT EXISTS invoice_items_invoice ON invoice_items(invoice_id);
  `);
  db.prepare(`INSERT OR IGNORE INTO company (id, updated_at) VALUES (1, ?)`).run(new Date().toISOString());
}

export function getDb() {
  if (!globalForDb.fakturaDb) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.fakturaDb = db;
  }
  return globalForDb.fakturaDb;
}

export function closeDb() {
  if (globalForDb.fakturaDb) {
    globalForDb.fakturaDb.close();
    globalForDb.fakturaDb = undefined;
  }
}
