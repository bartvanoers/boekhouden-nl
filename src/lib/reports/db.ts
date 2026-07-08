import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/db/schema";

/**
 * Gedeeld databasetype voor de rapportfuncties. Alle rapporten zijn pure
 * functies `(db, boekjaarId) → ReportData` en werken zowel tegen de
 * applicatie-database als tegen een in-memory/tijdelijke SQLite in tests.
 */
export type ReportDb = BetterSQLite3Database<typeof schema>;

/** Vaste systeem-grootboekcodes waarop de boekingslogica leunt. */
export const SYSTEEM_CODE = {
  kas: "1000",
  bank: "1010",
  debiteuren: "1300",
  beginkapitaal: "1400",
  voorbelasting: "1600",
  btwHoog: "1630",
  btwLaag: "1631",
  btwRc: "1650",
  crediteuren: "1700",
} as const;
