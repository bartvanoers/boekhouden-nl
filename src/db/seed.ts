import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { GrootboekType } from "./schema";

/** Systeemrekeningen: niet verwijderbaar in de UI. */
const SYSTEEM_CODES = new Set([
  "1000",
  "1010",
  "1300",
  "1600",
  "1630",
  "1631",
  "1650",
  "1700",
]);

type GrootboekSeed = { code: string; naam: string; type: GrootboekType };

/**
 * Standaardgrootboek op basis van de Excel-boekhouden.nl-template (codes
 * 0130 t/m 8010). De codes 4500–4950 zijn de kostenrekeningen.
 */
export const STANDAARD_GROOTBOEK: GrootboekSeed[] = [
  { code: "0130", naam: "Inventarissen", type: "balans" },
  { code: "0140", naam: "Hardware", type: "balans" },
  { code: "0740", naam: "Langlopende leningen", type: "balans" },
  { code: "1000", naam: "Kas", type: "betalingsmiddel" },
  { code: "1010", naam: "Bank", type: "betalingsmiddel" },
  { code: "1300", naam: "Debiteuren", type: "debiteuren" },
  { code: "1400", naam: "Beginkapitaal", type: "balans" },
  { code: "1410", naam: "Privé", type: "balans" },
  { code: "1500", naam: "Vorderingen", type: "balans" },
  { code: "1600", naam: "Voorbelasting", type: "voorbelasting" },
  { code: "1630", naam: "Af te dragen BTW hoog", type: "btw_hoog" },
  { code: "1631", naam: "Af te dragen BTW laag", type: "btw_laag" },
  { code: "1650", naam: "BTW rekening-courant", type: "btw_rc" },
  { code: "1700", naam: "Crediteuren", type: "crediteuren" },
  { code: "1800", naam: "Schulden", type: "balans" },
  { code: "2000", naam: "Kruisposten", type: "balans" },
  { code: "4500", naam: "Contributies en abonnementen", type: "winst_verlies" },
  { code: "4510", naam: "Reclame en advertenties", type: "winst_verlies" },
  { code: "4520", naam: "Representatie en verteer", type: "winst_verlies" },
  { code: "4530", naam: "Reis- en verblijfkosten", type: "winst_verlies" },
  { code: "4540", naam: "Relatiegeschenken", type: "winst_verlies" },
  { code: "4545", naam: "Verzekeringen", type: "winst_verlies" },
  { code: "4550", naam: "Bankkosten", type: "winst_verlies" },
  { code: "4590", naam: "Overige verkoopkosten", type: "winst_verlies" },
  { code: "4600", naam: "Kilometervergoeding", type: "winst_verlies" },
  { code: "4700", naam: "Kantoorbenodigdheden", type: "winst_verlies" },
  { code: "4740", naam: "Drukwerk, porti en vrachten", type: "winst_verlies" },
  { code: "4750", naam: "Telefoon en internet", type: "winst_verlies" },
  { code: "4790", naam: "Overige kantoorkosten", type: "winst_verlies" },
  { code: "4810", naam: "Accountants- en administratiekosten", type: "winst_verlies" },
  { code: "4850", naam: "Cursussen/seminars", type: "winst_verlies" },
  { code: "4860", naam: "Vakliteratuur", type: "winst_verlies" },
  { code: "4900", naam: "Betalingsverschillen", type: "winst_verlies" },
  { code: "4950", naam: "Oninbare vorderingen", type: "winst_verlies" },
  { code: "7000", naam: "Inkopen", type: "winst_verlies" },
  { code: "8000", naam: "Omzet NL", type: "winst_verlies" },
  { code: "8010", naam: "Omzet EU", type: "winst_verlies" },
];

/**
 * Idempotente seed. Vult het standaardgrootboek en een boekjaar voor het
 * huidige jaar, maar alléén wanneer de betreffende tabellen nog leeg zijn.
 * Een tweede run voegt niets toe en gooit geen fouten.
 */
export function runSeed(
  db: BetterSQLite3Database<typeof schema>,
  opts: { jaar?: number } = {},
): void {
  const jaar = opts.jaar ?? new Date().getFullYear();

  const bestaandGrootboek = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.grootboekrekeningen)
    .get();

  if (!bestaandGrootboek || bestaandGrootboek.n === 0) {
    db.insert(schema.grootboekrekeningen)
      .values(
        STANDAARD_GROOTBOEK.map((r) => ({
          code: r.code,
          naam: r.naam,
          type: r.type,
          isSysteem: SYSTEEM_CODES.has(r.code),
          actief: true,
        })),
      )
      .run();
  }

  const bestaandBoekjaar = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.boekjaren)
    .get();

  if (!bestaandBoekjaar || bestaandBoekjaar.n === 0) {
    db.insert(schema.boekjaren)
      .values({ jaar, btwPeriode: "kwartaal", status: "open" })
      .run();
  }
}

async function main() {
  const { db, sqlite } = await import("./index");
  runSeed(db);
  console.log("Seed uitgevoerd.");
  sqlite.close();
}

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
