import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { runMigrations } from "@/db/migrate";
import { runSeed } from "@/db/seed";
import type { Boekjaar } from "@/db/schema";

/**
 * Integratietest voor de transactie-actions. Draait de échte action-functies
 * tegen een tijdelijke SQLite-database; alleen de Next-laag (sessie, cache,
 * actief boekjaar) wordt gemockt. Dekt de acceptatiecriteria van fase 4:
 * opslag in centen, handmatige btw, jaar-scheiding, gesloten-blokkade en
 * datumvalidatie.
 */

// Gedeelde, hoisted state die de getActiefBoekjaar-mock uitleest.
const h = vi.hoisted(() => ({ actief: null as Boekjaar | null }));

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ loggedIn: true }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/boekjaar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/boekjaar")>();
  return { ...actual, getActiefBoekjaar: async () => h.actief };
});

// DATABASE_PATH moet gezet zijn vóór het (dynamische) importeren van @/db.
process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "boekhouden-test-")),
  "test.db",
);

type Schema = typeof import("@/db/schema");
type ActionsMod = typeof import("./transacties");

let dbMod: typeof import("@/db");
let schema: Schema;
let actions: ActionsMod;

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

const BASIS = {
  richting: "verkoop",
  datum: "2026-03-15",
  soort: "factuur",
  factuurnummer: "F-001",
  omschrijving: "Verkoop dienst",
  relatieId: "geen",
  bedragExcl: "100,00",
  btwTarief: "hoog",
  btwBedrag: "21,00",
  status: "bank",
  grootboekId: "", // per test invullen
};

let boekjaar2026: Boekjaar;
let boekjaar2025: Boekjaar;
let omzetId: number;

beforeAll(async () => {
  dbMod = await import("@/db");
  schema = await import("@/db/schema");
  actions = await import("./transacties");

  runMigrations(dbMod.db);
  runSeed(dbMod.db, { jaar: 2026 });
  dbMod.db
    .insert(schema.boekjaren)
    .values({ jaar: 2025, btwPeriode: "kwartaal", status: "open" })
    .run();

  boekjaar2026 = dbMod.db
    .select()
    .from(schema.boekjaren)
    .where(eq(schema.boekjaren.jaar, 2026))
    .get()!;
  boekjaar2025 = dbMod.db
    .select()
    .from(schema.boekjaren)
    .where(eq(schema.boekjaren.jaar, 2025))
    .get()!;

  omzetId = dbMod.db
    .select()
    .from(schema.grootboekrekeningen)
    .where(eq(schema.grootboekrekeningen.code, "8000"))
    .get()!.id;
});

afterAll(() => {
  dbMod.sqlite.close();
});

beforeEach(() => {
  dbMod.db.delete(schema.transacties).run();
  h.actief = boekjaar2026;
});

describe("maakTransactie", () => {
  it("slaat €100 excl / 21% op als 10000 centen excl en 2100 btw", async () => {
    const res = await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId) }),
    );
    expect(res.ok).toBe(true);

    const rows = dbMod.db.select().from(schema.transacties).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].bedragExclCents).toBe(10000);
    expect(rows[0].btwCents).toBe(2100);
    expect(rows[0].boekjaarId).toBe(boekjaar2026.id);
    expect(rows[0].richting).toBe("verkoop");
  });

  it("bewaart een handmatig aangepast btw-bedrag zoals ingevoerd", async () => {
    const res = await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId), btwBedrag: "20,00" }),
    );
    expect(res.ok).toBe(true);
    const row = dbMod.db.select().from(schema.transacties).get()!;
    expect(row.bedragExclCents).toBe(10000);
    expect(row.btwCents).toBe(2000);
  });

  it("weigert een datum buiten het boekjaar met een nette melding", async () => {
    const res = await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId), datum: "2025-12-31" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("binnen boekjaar 2026");
    expect(dbMod.db.select().from(schema.transacties).all()).toHaveLength(0);
  });

  it("weigert een mutatie in een gesloten boekjaar", async () => {
    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "gesloten" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();
    h.actief = { ...boekjaar2026, status: "gesloten" };

    const res = await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId) }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("gesloten");
    expect(dbMod.db.select().from(schema.transacties).all()).toHaveLength(0);

    // Terugzetten voor volgende tests.
    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "open" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();
  });

  it("scheidt transacties per boekjaar", async () => {
    await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId), datum: "2026-06-01" }),
    );
    h.actief = boekjaar2025;
    await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId), datum: "2025-06-01" }),
    );

    const in2026 = dbMod.db
      .select()
      .from(schema.transacties)
      .where(eq(schema.transacties.boekjaarId, boekjaar2026.id))
      .all();
    const in2025 = dbMod.db
      .select()
      .from(schema.transacties)
      .where(eq(schema.transacties.boekjaarId, boekjaar2025.id))
      .all();
    expect(in2026).toHaveLength(1);
    expect(in2025).toHaveLength(1);
    expect(in2026[0].datum).toBe("2026-06-01");
    expect(in2025[0].datum).toBe("2025-06-01");
  });
});

describe("wijzigTransactie / verwijderTransactie", () => {
  async function maakEr(): Promise<number> {
    await actions.maakTransactie(
      fd({ ...BASIS, grootboekId: String(omzetId) }),
    );
    return dbMod.db.select().from(schema.transacties).get()!.id;
  }

  it("wijzigt een transactie", async () => {
    const id = await maakEr();
    const res = await actions.wijzigTransactie(
      id,
      fd({
        ...BASIS,
        grootboekId: String(omzetId),
        bedragExcl: "250,00",
        btwBedrag: "52,50",
        omschrijving: "Gewijzigd",
      }),
    );
    expect(res.ok).toBe(true);
    const row = dbMod.db.select().from(schema.transacties).get()!;
    expect(row.bedragExclCents).toBe(25000);
    expect(row.btwCents).toBe(5250);
    expect(row.omschrijving).toBe("Gewijzigd");
  });

  it("weigert wijzigen bij een gesloten boekjaar", async () => {
    const id = await maakEr();
    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "gesloten" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();

    const res = await actions.wijzigTransactie(
      id,
      fd({ ...BASIS, grootboekId: String(omzetId), omschrijving: "X" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("gesloten");

    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "open" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();
  });

  it("verwijdert een transactie", async () => {
    const id = await maakEr();
    const res = await actions.verwijderTransactie(id);
    expect(res.ok).toBe(true);
    expect(dbMod.db.select().from(schema.transacties).all()).toHaveLength(0);
  });

  it("weigert verwijderen bij een gesloten boekjaar", async () => {
    const id = await maakEr();
    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "gesloten" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();

    const res = await actions.verwijderTransactie(id);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("gesloten");
    expect(
      dbMod.db
        .select()
        .from(schema.transacties)
        .where(and(eq(schema.transacties.id, id)))
        .all(),
    ).toHaveLength(1);

    dbMod.db
      .update(schema.boekjaren)
      .set({ status: "open" })
      .where(eq(schema.boekjaren.id, boekjaar2026.id))
      .run();
  });
});
