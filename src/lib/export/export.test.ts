import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/db/migrate";
import { runSeed } from "@/db/seed";
import { BOM, centenNaarCsv, tabelNaarCsv } from "./csv";
import { tabelNaarXlsx } from "./xlsx";
import { bouwRapport } from "./reports";

/**
 * Exporttests tegen de gouden dataset uit het plan (identiek aan
 * reports.test.ts). We renderen elk rapport naar CSV en XLSX, parsen de output
 * programmatisch en controleren dat de totalen exact gelijk zijn aan de
 * onderliggende rapportfuncties. Tevens: BOM + puntkomma's in CSV, echte
 * getallen (geen strings) in XLSX.
 */

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "boekhouden-export-")),
  "test.db",
);

type Schema = typeof import("@/db/schema");

let dbMod: typeof import("@/db");
let schema: Schema;
let reports: {
  btw: typeof import("@/lib/reports/btw");
  wv: typeof import("@/lib/reports/wv");
  balans: typeof import("@/lib/reports/balans");
  transacties: typeof import("@/lib/reports/transacties");
};

let boekjaarId: number;
const JAAR = 2026;
const BEDRIJF = "Testbedrijf B.V.";

function gid(code: string): number {
  return dbMod.db
    .select({ id: schema.grootboekrekeningen.id })
    .from(schema.grootboekrekeningen)
    .where(eq(schema.grootboekrekeningen.code, code))
    .get()!.id;
}

beforeAll(async () => {
  dbMod = await import("@/db");
  schema = await import("@/db/schema");
  reports = {
    btw: await import("@/lib/reports/btw"),
    wv: await import("@/lib/reports/wv"),
    balans: await import("@/lib/reports/balans"),
    transacties: await import("@/lib/reports/transacties"),
  };

  runMigrations(dbMod.db);
  runSeed(dbMod.db, { jaar: JAAR });

  boekjaarId = dbMod.db
    .select({ id: schema.boekjaren.id })
    .from(schema.boekjaren)
    .where(eq(schema.boekjaren.jaar, JAAR))
    .get()!.id;

  dbMod.db
    .insert(schema.beginbalans)
    .values([
      { boekjaarId, grootboekId: gid("1010"), bedragCents: 500000 },
      { boekjaarId, grootboekId: gid("1400"), bedragCents: -500000 },
    ])
    .run();

  const t = (
    richting: "verkoop" | "inkoop",
    datum: string,
    excl: number,
    tarief: "hoog" | "laag" | "geen",
    btw: number,
    status: "bank" | "kas" | "openstaand",
    code: string,
  ) => ({
    boekjaarId,
    richting,
    datum,
    soort: "factuur" as const,
    factuurnummer: null,
    omschrijving: "golden",
    relatieId: null,
    bedragExclCents: excl,
    btwTarief: tarief,
    btwCents: btw,
    status,
    grootboekId: gid(code),
  });

  dbMod.db
    .insert(schema.transacties)
    .values([
      t("verkoop", "2026-01-15", 100000, "hoog", 21000, "bank", "8000"),
      t("verkoop", "2026-02-10", 50000, "laag", 4500, "openstaand", "8000"),
      t("verkoop", "2026-03-20", 20000, "geen", 0, "bank", "8000"),
      t("inkoop", "2026-01-18", 30000, "hoog", 6300, "bank", "4500"),
      t("inkoop", "2026-02-12", 10000, "laag", 900, "kas", "4600"),
      t("inkoop", "2026-03-22", 80000, "hoog", 16800, "openstaand", "0130"),
    ])
    .run();
});

afterAll(() => {
  dbMod.sqlite.close();
});

/** Parseert een CSV-string (met BOM) naar velden per regel. */
function parseCsv(csv: string): string[][] {
  const zonderBom = csv.startsWith(BOM) ? csv.slice(BOM.length) : csv;
  return zonderBom
    .split("\r\n")
    .filter((r) => r.length > 0)
    .map((r) => r.split(";"));
}

describe("centenNaarCsv", () => {
  it("gebruikt komma-decimalen zonder duizendtalscheider", () => {
    expect(centenNaarCsv(123456)).toBe("1234,56");
    expect(centenNaarCsv(0)).toBe("0,00");
    expect(centenNaarCsv(-4500)).toBe("-45,00");
    expect(centenNaarCsv(5)).toBe("0,05");
  });
});

describe("CSV-export", () => {
  it("heeft BOM en puntkomma-scheiding", () => {
    const tabel = bouwRapport(dbMod.db, "transacties", boekjaarId, JAAR);
    const csv = tabelNaarCsv(tabel, BEDRIJF);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain(";");
    expect(csv).toContain(BEDRIJF);
  });

  it("transacties: totalen gelijk aan berekenTransacties", () => {
    const data = reports.transacties.berekenTransacties(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "transacties", boekjaarId, JAAR);
    const rijen = parseCsv(tabelNaarCsv(tabel, BEDRIJF));
    const totaal = rijen[rijen.length - 1];
    // Kolommen: 0 Datum … 7 excl, 9 btw, 10 incl.
    expect(totaal[0]).toBe("Totaal");
    expect(totaal[7]).toBe(centenNaarCsv(data.totaalExclCents));
    expect(totaal[9]).toBe(centenNaarCsv(data.totaalBtwCents));
    expect(totaal[10]).toBe(centenNaarCsv(data.totaalInclCents));
    // Gouden dataset: excl €1.700+€1.200=€2.900, incl som.
    expect(totaal[7]).toBe("2900,00");
  });

  it("btw: jaartotaal te betalen = €15,00", () => {
    const data = reports.btw.berekenBtw(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "btw", boekjaarId, JAAR);
    const rijen = parseCsv(tabelNaarCsv(tabel, BEDRIJF));
    const totaal = rijen[rijen.length - 1];
    // Laatste kolom = te betalen.
    expect(totaal[totaal.length - 1]).toBe(
      centenNaarCsv(data.jaartotaal.teBetalenCents),
    );
    expect(totaal[totaal.length - 1]).toBe("15,00");
  });

  it("wv: resultaat = €1.300,00", () => {
    const data = reports.wv.berekenWv(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "wv", boekjaarId, JAAR);
    const rijen = parseCsv(tabelNaarCsv(tabel, BEDRIJF));
    const totaal = rijen[rijen.length - 1];
    expect(totaal[3]).toBe(centenNaarCsv(data.resultaatCents));
    expect(totaal[3]).toBe("1300,00");
  });

  it("balans: balanstotaal sluit en is gelijk aan berekenBalans", () => {
    const data = reports.balans.berekenBalans(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "balans", boekjaarId, JAAR);
    const rijen = parseCsv(tabelNaarCsv(tabel, BEDRIJF));
    const totaal = rijen[rijen.length - 1];
    expect(totaal[3]).toBe(centenNaarCsv(data.activaTotaalCents));
    expect(data.activaTotaalCents).toBe(data.passivaTotaalCents);
  });
});

describe("XLSX-export", () => {
  async function leesTerug(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb.worksheets[0];
  }

  it("btw: geldcellen zijn echte getallen (geen strings)", async () => {
    const data = reports.btw.berekenBtw(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "btw", boekjaarId, JAAR);
    const ws = await leesTerug(await tabelNaarXlsx(tabel, BEDRIJF));

    // Laatste rij is de totaalregel; laatste kolom = te betalen.
    const laatste = ws.lastRow!;
    const teBetalen = laatste.getCell(ws.columnCount).value;
    expect(typeof teBetalen).toBe("number");
    expect(teBetalen).toBeCloseTo(data.jaartotaal.teBetalenCents / 100, 2);
  });

  it("transacties: totaalregel bevat numerieke euro-bedragen", async () => {
    const data = reports.transacties.berekenTransacties(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "transacties", boekjaarId, JAAR);
    const ws = await leesTerug(await tabelNaarXlsx(tabel, BEDRIJF));

    const laatste = ws.lastRow!;
    // Kolom 8 = Bedrag excl. (1-indexed).
    const excl = laatste.getCell(8).value;
    const incl = laatste.getCell(11).value;
    expect(typeof excl).toBe("number");
    expect(typeof incl).toBe("number");
    expect(excl).toBeCloseTo(data.totaalExclCents / 100, 2);
    expect(incl).toBeCloseTo(data.totaalInclCents / 100, 2);
  });

  it("bevat kopregel met bedrijfsnaam en rapportnaam", async () => {
    const tabel = bouwRapport(dbMod.db, "balans", boekjaarId, JAAR);
    const ws = await leesTerug(await tabelNaarXlsx(tabel, BEDRIJF));
    expect(ws.getRow(1).getCell(1).value).toBe(BEDRIJF);
    expect(String(ws.getRow(2).getCell(1).value)).toContain("Balans");
    expect(String(ws.getRow(2).getCell(1).value)).toContain(String(JAAR));
  });

  it("wv: resultaat als echt getal €1.300", async () => {
    const data = reports.wv.berekenWv(dbMod.db, boekjaarId);
    const tabel = bouwRapport(dbMod.db, "wv", boekjaarId, JAAR);
    const ws = await leesTerug(await tabelNaarXlsx(tabel, BEDRIJF));
    const laatste = ws.lastRow!;
    const resultaat = laatste.getCell(4).value;
    expect(typeof resultaat).toBe("number");
    expect(resultaat).toBeCloseTo(data.resultaatCents / 100, 2);
  });
});
