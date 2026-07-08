import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const MIGRATIONS_FOLDER = resolve(process.cwd(), "drizzle");

/**
 * Draait alle nog niet toegepaste SQL-migraties. Idempotent: Drizzle houdt in
 * de `__drizzle_migrations`-tabel bij welke migraties al zijn uitgevoerd, dus
 * een tweede run doet niets.
 */
export function runMigrations(
  db: BetterSQLite3Database<typeof schema>,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): void {
  migrate(db, { migrationsFolder });
}

async function main() {
  const { db, sqlite } = await import("./index");
  runMigrations(db);
  console.log("Migraties uitgevoerd.");
  sqlite.close();
}

// Alleen uitvoeren wanneer dit bestand direct via de CLI wordt aangeroepen.
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
