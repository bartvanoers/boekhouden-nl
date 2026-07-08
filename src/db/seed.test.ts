import { resolve } from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";
import * as schema from "./schema";
import { STANDAARD_GROOTBOEK, runSeed } from "./seed";

const MIGRATIONS_FOLDER = resolve(process.cwd(), "drizzle");

function tel(sqlite: Database.Database, table: string): number {
  const row = sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

describe("migrate + seed", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    runMigrations(db, MIGRATIONS_FOLDER);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("migreert alle tabellen", () => {
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "settings",
        "boekjaren",
        "grootboekrekeningen",
        "relaties",
        "transacties",
        "beginbalans",
      ]),
    );
  });

  it("vult het grootboek en een boekjaar", () => {
    runSeed(db, { jaar: 2026 });

    expect(tel(sqlite, "grootboekrekeningen")).toBe(STANDAARD_GROOTBOEK.length);
    expect(tel(sqlite, "boekjaren")).toBe(1);

    const boekjaar = db.select().from(schema.boekjaren).get();
    expect(boekjaar?.jaar).toBe(2026);
    expect(boekjaar?.btwPeriode).toBe("kwartaal");
    expect(boekjaar?.status).toBe("open");
  });

  it("markeert de juiste systeemrekeningen", () => {
    runSeed(db, { jaar: 2026 });
    const systeem = db
      .select({ code: schema.grootboekrekeningen.code })
      .from(schema.grootboekrekeningen)
      .where(sql`${schema.grootboekrekeningen.isSysteem} = 1`)
      .all()
      .map((r) => r.code)
      .sort();
    expect(systeem).toEqual([
      "1000",
      "1010",
      "1300",
      "1600",
      "1630",
      "1631",
      "1650",
      "1700",
    ]);
  });

  it("is idempotent: tweede run voegt niets toe en gooit geen fouten", () => {
    runSeed(db, { jaar: 2026 });
    expect(() => runSeed(db, { jaar: 2026 })).not.toThrow();
    runSeed(db, { jaar: 2026 });

    expect(tel(sqlite, "grootboekrekeningen")).toBe(STANDAARD_GROOTBOEK.length);
    expect(tel(sqlite, "boekjaren")).toBe(1);
  });

  it("draaien van migraties is idempotent", () => {
    expect(() => runMigrations(db, MIGRATIONS_FOLDER)).not.toThrow();
  });
});
