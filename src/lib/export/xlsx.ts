import ExcelJS from "exceljs";
import { formatDatumKort } from "@/lib/dates";
import type { Cel, Kolom, Tabel } from "./model";

/**
 * XLSX-renderer via exceljs. Bevat een nette kopregel (bedrijfsnaam +
 * rapportnaam + boekjaar), vette kolomkoppen, bedragen als **echte getallen**
 * met nl-getalnotatie (#.##0,00) en een vette totaalregel.
 */

/** Nederlandse getalnotatie: duizendtalpunt, komma-decimaal, twee decimalen. */
const GELD_FORMAT = "#,##0.00";

function celWaarde(cel: Cel, kolom: Kolom): string | number | null {
  if (cel === null || cel === undefined) return null;
  if (kolom.type === "geld") {
    // Echte getallen: centen → euro's als number.
    return typeof cel === "number" ? cel / 100 : cel;
  }
  if (kolom.type === "datum") {
    return typeof cel === "string" ? formatDatumKort(cel) : cel;
  }
  return cel;
}

/** Rendert een tabelmodel naar een XLSX-buffer. */
export async function tabelNaarXlsx(
  tabel: Tabel,
  bedrijfsnaam: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = bedrijfsnaam;
  wb.created = new Date();
  const ws = wb.addWorksheet(tabel.titel.slice(0, 31));

  const kolomAantal = tabel.kolommen.length;

  // Kopregel: bedrijfsnaam (groot) en rapportnaam + boekjaar.
  const r1 = ws.addRow([bedrijfsnaam]);
  r1.getCell(1).font = { bold: true, size: 14 };
  const r2 = ws.addRow([`${tabel.titel} ${tabel.jaar}`]);
  r2.getCell(1).font = { bold: true, size: 12 };
  ws.addRow([]);

  // Kolomkoppen (vet).
  const kopRij = ws.addRow(tabel.kolommen.map((k) => k.header));
  kopRij.font = { bold: true };
  kopRij.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });

  const schrijfCel = (
    cell: ExcelJS.Cell,
    waarde: Cel,
    kolom: Kolom,
  ) => {
    cell.value = celWaarde(waarde, kolom);
    if (kolom.type === "geld") {
      cell.numFmt = GELD_FORMAT;
      cell.alignment = { horizontal: "right" };
    }
  };

  // Datarijen.
  for (const rij of tabel.rijen) {
    const row = ws.addRow(new Array(kolomAantal).fill(null));
    tabel.kolommen.forEach((kolom, i) => {
      schrijfCel(row.getCell(i + 1), rij[i] ?? null, kolom);
    });
  }

  // Totaalregel (vet, met lijn erboven).
  if (tabel.totaal) {
    const row = ws.addRow(new Array(kolomAantal).fill(null));
    row.font = { bold: true };
    tabel.kolommen.forEach((kolom, i) => {
      const cell = row.getCell(i + 1);
      schrijfCel(cell, tabel.totaal![i] ?? null, kolom);
      cell.border = { top: { style: "thin" } };
    });
  }

  // Kolombreedtes op basis van de kop.
  tabel.kolommen.forEach((kolom, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, kolom.header.length + 2);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
