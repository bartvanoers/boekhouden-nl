import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runMigrations } from "@/db/migrate";
import { runSeed } from "@/db/seed";

/**
 * Rapportagetests tegen de "gouden dataset" uit het plan. De verwachte waarden
 * zijn met de hand herrekend (zie commentaar per assertie) en vastgelegd in
 * centen. De pure rapportfuncties draaien rechtstreeks tegen een tijdelijke
 * SQLite; de jaarafsluiting-action draait met gemockte Next-laag.
 *
 * Gouden dataset (boekjaar 2026, btw-periode kwartaal):
 * - Beginbalans: Bank €5.000 (D), Beginkapitaal €5.000 (C).
 * - Verkoop: €1.000/21%/bank; €500/9%/openstaand; €200/geen/bank (alle 8000).
 * - Inkoop: €300/21%/bank (4500); €100/9%/kas (4600); €800/21%/openstaand (0130).
 */

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ loggedIn: true }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "boekhouden-reports-")),
  "test.db",
);

type Schema = typeof import("@/db/schema");

let dbMod: typeof import("@/db");
let schema: Schema;
let reports: {
  btw: typeof import("./btw");
  wv: typeof import("./wv");
  balans: typeof import("./balans");
  dashboard: typeof import("./dashboard");
};
let jaarafsluiting: typeof import("@/actions/jaarafsluiting");

let boekjaar2026Id: number;

/** Grootboek-id bij een code. */
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
    btw: await import("./btw"),
    wv: await import("./wv"),
    balans: await import("./balans"),
    dashboard: await import("./dashboard"),
  };
  jaarafsluiting = await import("@/actions/jaarafsluiting");

  runMigrations(dbMod.db);
  runSeed(dbMod.db, { jaar: 2026 });

  boekjaar2026Id = dbMod.db
    .select({ id: schema.boekjaren.id })
    .from(schema.boekjaren)
    .where(eq(schema.boekjaren.jaar, 2026))
    .get()!.id;

  // Beginbalans: Bank +500000 (D), Beginkapitaal −500000 (C).
  dbMod.db
    .insert(schema.beginbalans)
    .values([
      { boekjaarId: boekjaar2026Id, grootboekId: gid("1010"), bedragCents: 500000 },
      { boekjaarId: boekjaar2026Id, grootboekId: gid("1400"), bedragCents: -500000 },
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
    boekjaarId: boekjaar2026Id,
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
      // Verkopen (alle in kwartaal 1).
      t("verkoop", "2026-01-15", 100000, "hoog", 21000, "bank", "8000"),
      t("verkoop", "2026-02-10", 50000, "laag", 4500, "openstaand", "8000"),
      t("verkoop", "2026-03-20", 20000, "geen", 0, "bank", "8000"),
      // Inkopen (alle in kwartaal 1).
      t("inkoop", "2026-01-18", 30000, "hoog", 6300, "bank", "4500"),
      t("inkoop", "2026-02-12", 10000, "laag", 900, "kas", "4600"),
      t("inkoop", "2026-03-22", 80000, "hoog", 16800, "openstaand", "0130"),
    ])
    .run();
});

afterAll(() => {
  dbMod.sqlite.close();
});

describe("berekenBtw", () => {
  it("berekent rubrieken en voorbelasting per jaartotaal", () => {
    const r = reports.btw.berekenBtw(dbMod.db, boekjaar2026Id);
    const jt = r.jaartotaal;
    // 1a: verkoop 21% → grondslag €1.000, btw €210.
    expect(jt.grondslag1aCents).toBe(100000);
    expect(jt.btw1aCents).toBe(21000);
    // 1b: verkoop 9% → grondslag €500, btw €45.
    expect(jt.grondslag1bCents).toBe(50000);
    expect(jt.btw1bCents).toBe(4500);
    // 0%: verkoop geen → grondslag €200.
    expect(jt.grondslag0Cents).toBe(20000);
    // 5b voorbelasting: 63 + 9 + 168 = €240.
    expect(jt.voorbelasting5bCents).toBe(24000);
    // Te betalen: (210 + 45) − 240 = €15.
    expect(jt.teBetalenCents).toBe(1500);
  });

  it("groepeert op de btw-periode van het boekjaar (kwartaal)", () => {
    const r = reports.btw.berekenBtw(dbMod.db, boekjaar2026Id);
    expect(r.periode).toBe("kwartaal");
    // Alle transacties vallen in kwartaal 1 → precies één periode-regel.
    expect(r.regels).toHaveLength(1);
    expect(r.regels[0].label).toBe("Kwartaal 1");
    expect(r.regels[0].teBetalenCents).toBe(1500);
  });
});

describe("berekenWv", () => {
  it("berekent omzet, kosten en resultaat (balanspost telt niet mee)", () => {
    const r = reports.wv.berekenWv(dbMod.db, boekjaar2026Id);
    // Omzet 8000: €1.000 + €500 + €200 = €1.700.
    expect(r.opbrengstenTotaalCents).toBe(170000);
    // Kosten: 4500 €300 + 4600 €100 = €400 (0130 is balanspost).
    expect(r.kostenTotaalCents).toBe(40000);
    expect(r.kosten.map((k) => k.code).sort()).toEqual(["4500", "4600"]);
    // Winst: €1.700 − €400 = €1.300.
    expect(r.resultaatCents).toBe(130000);
  });
});

describe("berekenBalans", () => {
  it("berekent sluitende activa/passiva met resultaat als sluitpost", () => {
    const r = reports.balans.berekenBalans(dbMod.db, boekjaar2026Id);
    const bedrag = (rijen: { code: string; bedragCents: number }[], code: string) =>
      rijen.find((x) => x.code === code)?.bedragCents;

    // Activa.
    expect(bedrag(r.activa, "1010")).toBe(604700); // Bank €6.047
    expect(bedrag(r.activa, "1300")).toBe(54500); // Debiteuren €545
    expect(bedrag(r.activa, "1600")).toBe(24000); // Voorbelasting €240
    expect(bedrag(r.activa, "0130")).toBe(80000); // Inventaris €800
    // Passiva (absolute weergave).
    expect(bedrag(r.passiva, "1000")).toBe(10900); // Kas €109 (credit)
    expect(bedrag(r.passiva, "1700")).toBe(96800); // Crediteuren €968
    expect(bedrag(r.passiva, "1630")).toBe(21000); // Af te dragen btw hoog €210
    expect(bedrag(r.passiva, "1631")).toBe(4500); // Af te dragen btw laag €45
    expect(bedrag(r.passiva, "1400")).toBe(500000); // Beginkapitaal €5.000

    // Totalen + sluitpost.
    expect(r.activaTotaalCents).toBe(763200);
    expect(r.resultaatCents).toBe(130000); // = winst uit W&V
    expect(r.passivaTotaalCents).toBe(763200);
    expect(r.sluit).toBe(true);
  });

  it("resultaat balans is gelijk aan resultaat W&V", () => {
    const balans = reports.balans.berekenBalans(dbMod.db, boekjaar2026Id);
    const wv = reports.wv.berekenWv(dbMod.db, boekjaar2026Id);
    expect(balans.resultaatCents).toBe(wv.resultaatCents);
  });
});

describe("berekenDashboard", () => {
  it("berekent totalen per richting", () => {
    const d = reports.dashboard.berekenDashboard(dbMod.db, boekjaar2026Id);
    // Verkoop: incl €1.955, btw €255, betaald €1.410, openstaand €545.
    expect(d.verkoop.totaalInclCents).toBe(195500);
    expect(d.verkoop.btwCents).toBe(25500);
    expect(d.verkoop.betaaldInclCents).toBe(141000);
    expect(d.verkoop.openstaandInclCents).toBe(54500);
    // Inkoop: incl €1.440, btw €240, betaald €472, openstaand €968.
    expect(d.inkoop.totaalInclCents).toBe(144000);
    expect(d.inkoop.btwCents).toBe(24000);
    expect(d.inkoop.betaaldInclCents).toBe(47200);
    expect(d.inkoop.openstaandInclCents).toBe(96800);
  });

  it("hergebruikt dezelfde onderliggende rapporten", () => {
    const d = reports.dashboard.berekenDashboard(dbMod.db, boekjaar2026Id);
    expect(d.wv.resultaatCents).toBe(130000);
    expect(d.balans.sluit).toBe(true);
    expect(d.btw.jaartotaal.teBetalenCents).toBe(1500);
  });
});

describe("jaarafsluiting", () => {
  it("sluit N af en maakt N+1 met sluitende beginbalans (resultaat in kapitaal)", async () => {
    const res = await jaarafsluiting.sluitBoekjaar(boekjaar2026Id);
    expect(res.ok).toBe(true);

    // Boekjaar 2026 is nu gesloten.
    const b2026 = dbMod.db
      .select()
      .from(schema.boekjaren)
      .where(eq(schema.boekjaren.jaar, 2026))
      .get()!;
    expect(b2026.status).toBe("gesloten");

    // Boekjaar 2027 is aangemaakt met dezelfde btw-periode.
    const b2027 = dbMod.db
      .select()
      .from(schema.boekjaren)
      .where(eq(schema.boekjaren.jaar, 2027))
      .get()!;
    expect(b2027.status).toBe("open");
    expect(b2027.btwPeriode).toBe("kwartaal");

    // Beginbalans 2027 sluit (Σ getekend = 0).
    const rijen = dbMod.db
      .select({
        grootboekId: schema.beginbalans.grootboekId,
        bedragCents: schema.beginbalans.bedragCents,
      })
      .from(schema.beginbalans)
      .where(eq(schema.beginbalans.boekjaarId, b2027.id))
      .all();
    const som = rijen.reduce((a, r) => a + r.bedragCents, 0);
    expect(som).toBe(0);

    // Resultaat (€1.300 winst) is in Beginkapitaal gevloeid: −500000 − 130000.
    const kapitaal = rijen.find((r) => r.grootboekId === gid("1400"));
    expect(kapitaal?.bedragCents).toBe(-630000);

    // Overige eindsaldi zijn overgenomen.
    const saldo = (code: string) =>
      rijen.find((r) => r.grootboekId === gid(code))?.bedragCents;
    expect(saldo("1010")).toBe(604700);
    expect(saldo("1300")).toBe(54500);
    expect(saldo("1600")).toBe(24000);
    expect(saldo("0130")).toBe(80000);
    expect(saldo("1000")).toBe(-10900);
    expect(saldo("1700")).toBe(-96800);
    expect(saldo("1630")).toBe(-21000);
    expect(saldo("1631")).toBe(-4500);
  });

  it("heropent een gesloten boekjaar", async () => {
    const res = await jaarafsluiting.heropenBoekjaar(boekjaar2026Id);
    expect(res.ok).toBe(true);
    const b2026 = dbMod.db
      .select()
      .from(schema.boekjaren)
      .where(eq(schema.boekjaren.jaar, 2026))
      .get()!;
    expect(b2026.status).toBe("open");
  });
});
