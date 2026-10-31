import ExcelJS from "exceljs";
import JSZip from "jszip";
import { importIsdocXml, type IsdocImport } from "./isdoc";
import { applyImport } from "./persist";
import { decodeTableText, importRows, parseCsv, type TabularImport } from "./tabular";
import type { CustomerDraft, ImportCounts, InvoiceDraft, SupplierDraft } from "./types";

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value && value.result != null) return cellToString(value.result as ExcelJS.CellValue);
    if ("text" in value && value.text) return String(value.text).trim();
  }
  return String(value).trim();
}

export async function rowsFromXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[];
    const cells: string[] = [];
    for (let index = 1; index < values.length; index += 1) cells.push(cellToString(values[index]));
    rows.push(cells);
  });
  return rows;
}

export async function importUploadedFile(filename: string, buffer: Buffer): Promise<TabularImport & { supplier: SupplierDraft | null }> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return importZip(buffer, filename);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const rows = await rowsFromXlsx(buffer);
    const imported = importRows(rows, filename);
    return { ...imported, supplier: null };
  }
  if (lower.endsWith(".xml") || lower.endsWith(".isdoc")) {
    return fromIsdoc(importIsdocXml(buffer.toString("utf8"), filename));
  }
  const text = decodeTableText(buffer);
  if (text.includes("<Invoice") || text.includes("isdoc")) return fromIsdoc(importIsdocXml(text, filename));
  return { ...importRows(parseCsv(text), filename), supplier: null };
}

function fromIsdoc(imported: IsdocImport): TabularImport & { supplier: SupplierDraft | null } {
  return {
    customers: imported.customers,
    invoices: imported.invoices,
    warnings: imported.warnings,
    supplier: imported.supplier,
  };
}

async function importZip(buffer: Buffer, filename: string): Promise<TabularImport & { supplier: SupplierDraft | null }> {
  const zip = await JSZip.loadAsync(buffer);
  const customers: CustomerDraft[] = [];
  const invoices: InvoiceDraft[] = [];
  const warnings: string[] = [];
  let supplier: SupplierDraft | null = null;
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  if (names.length === 0) return { customers, invoices, warnings: [`${filename}: archiv je prázdný.`], supplier };
  for (const name of names) {
    const file = await zip.files[name].async("nodebuffer");
    const imported = await importUploadedFile(name, file);
    customers.push(...imported.customers);
    invoices.push(...imported.invoices);
    warnings.push(...imported.warnings);
    if (!supplier && imported.supplier?.name) supplier = imported.supplier;
  }
  return { customers, invoices, warnings, supplier };
}

export async function importFiles(files: { name: string; buffer: Buffer }[]): Promise<ImportCounts> {
  const customers: CustomerDraft[] = [];
  const invoices: InvoiceDraft[] = [];
  const warnings: string[] = [];
  let supplier: SupplierDraft | null = null;
  for (const file of files) {
    if (file.buffer.length > 20 * 1024 * 1024) {
      warnings.push(`${file.name}: soubor je větší než 20 MB.`);
      continue;
    }
    const imported = await importUploadedFile(file.name, file.buffer);
    customers.push(...imported.customers);
    invoices.push(...imported.invoices);
    warnings.push(...imported.warnings);
    if (!supplier && imported.supplier?.name) supplier = imported.supplier;
  }
  const counts = applyImport(customers, invoices, supplier);
  counts.warnings.push(...warnings);
  return counts;
}
