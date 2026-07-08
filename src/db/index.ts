import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** Pad naar de SQLite-database; override via DATABASE_PATH. */
export const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/boekhouden.db";

/**
 * Maakt (indien nodig) een better-sqlite3-connectie aan met WAL-mode en
 * foreign keys ingeschakeld. Geeft zowel de Drizzle-instantie als de ruwe
 * better-sqlite3-connectie terug.
 */
export function createConnection(dbPath: string = DATABASE_PATH) {
  const absolute = resolve(dbPath);
  const dir = dirname(absolute);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(absolute);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/**
 * Gedeelde singleton-connectie voor de applicatie. In development kan Next.js
 * modules opnieuw evalueren; we cachen daarom op het globale object.
 */
const globalForDb = globalThis as unknown as {
  __boekhoudenDb?: ReturnType<typeof createConnection>;
};

const connection = globalForDb.__boekhoudenDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__boekhoudenDb = connection;
}

export const db = connection.db;
export const sqlite = connection.sqlite;
export { schema };
