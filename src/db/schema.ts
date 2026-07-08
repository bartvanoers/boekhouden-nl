import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Databaseschema voor de boekhoudapplicatie.
 *
 * - Geld wordt altijd opgeslagen als gehele centen (integer).
 * - Datums als TEXT `YYYY-MM-DD` (sorteert als string, substr geeft maand/kwartaal).
 * - Booleans als integer 0/1.
 */

/** Type-unies die als CHECK-achtige waarden in TEXT-kolommen leven. */
export type BtwPeriode = "maand" | "kwartaal" | "jaar";
export type BoekjaarStatus = "open" | "gesloten";
export type GrootboekType =
  | "balans"
  | "betalingsmiddel"
  | "debiteuren"
  | "crediteuren"
  | "voorbelasting"
  | "btw_hoog"
  | "btw_laag"
  | "btw_rc"
  | "winst_verlies";
export type Richting = "verkoop" | "inkoop";
export type Soort = "factuur" | "bonnetje" | "overig";
export type BtwTarief = "hoog" | "laag" | "geen";
export type TransactieStatus = "bank" | "kas" | "openstaand";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
};

/**
 * Singleton met bedrijfsgegevens en de wachtwoord-hash.
 * Er bestaat altijd hooguit één rij (id = 1).
 */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bedrijfsnaam: text("bedrijfsnaam"),
  contactpersoon: text("contactpersoon"),
  adres: text("adres"),
  postcode: text("postcode"),
  plaats: text("plaats"),
  telefoon: text("telefoon"),
  email: text("email"),
  website: text("website"),
  obNummer: text("ob_nummer"),
  kvkNummer: text("kvk_nummer"),
  iban: text("iban"),
  passwordHash: text("password_hash"),
  ...timestamps,
});

/** Boekjaren: één administratie, meerdere jaren. */
export const boekjaren = sqliteTable("boekjaren", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jaar: integer("jaar").notNull().unique(),
  btwPeriode: text("btw_periode").notNull().$type<BtwPeriode>(),
  status: text("status").notNull().default("open").$type<BoekjaarStatus>(),
  ...timestamps,
});

/** Grootboekrekeningen (gedeeld over boekjaren). */
export const grootboekrekeningen = sqliteTable("grootboekrekeningen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  naam: text("naam").notNull(),
  type: text("type").notNull().$type<GrootboekType>(),
  // Systeemrekeningen (1000/1010/1300/1600/1630/1631/1650/1700) zijn niet verwijderbaar.
  isSysteem: integer("is_systeem", { mode: "boolean" })
    .notNull()
    .default(false),
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/** Relaties: klanten en leveranciers (gedeeld over boekjaren). */
export const relaties = sqliteTable("relaties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nr: integer("nr").notNull().unique(),
  naam: text("naam").notNull(),
  adres: text("adres"),
  postcode: text("postcode"),
  plaats: text("plaats"),
  telefoon: text("telefoon"),
  email: text("email"),
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/** Transacties: verkoop én inkoop in één tabel. */
export const transacties = sqliteTable(
  "transacties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boekjaarId: integer("boekjaar_id")
      .notNull()
      .references(() => boekjaren.id),
    richting: text("richting").notNull().$type<Richting>(),
    datum: text("datum").notNull(), // YYYY-MM-DD
    soort: text("soort").notNull().$type<Soort>(),
    factuurnummer: text("factuurnummer"),
    omschrijving: text("omschrijving"),
    relatieId: integer("relatie_id").references(() => relaties.id),
    bedragExclCents: integer("bedrag_excl_cents").notNull(),
    btwTarief: text("btw_tarief").notNull().$type<BtwTarief>(),
    btwCents: integer("btw_cents").notNull(),
    status: text("status").notNull().$type<TransactieStatus>(),
    grootboekId: integer("grootboek_id")
      .notNull()
      .references(() => grootboekrekeningen.id),
    ...timestamps,
  },
  (t) => [
    index("idx_transacties_boekjaar_richting_datum").on(
      t.boekjaarId,
      t.richting,
      t.datum,
    ),
    index("idx_transacties_grootboek").on(t.grootboekId),
    index("idx_transacties_relatie").on(t.relatieId),
  ],
);

/**
 * Beginbalans per boekjaar × grootboekrekening.
 * `bedrag_cents` is getekend: positief = debet/activa, negatief = credit/passiva.
 * Sluitcheck is dus SUM(bedrag_cents) = 0.
 */
export const beginbalans = sqliteTable(
  "beginbalans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boekjaarId: integer("boekjaar_id")
      .notNull()
      .references(() => boekjaren.id),
    grootboekId: integer("grootboek_id")
      .notNull()
      .references(() => grootboekrekeningen.id),
    bedragCents: integer("bedrag_cents").notNull(),
    ...timestamps,
  },
  (t) => [unique("uq_beginbalans_boekjaar_grootboek").on(t.boekjaarId, t.grootboekId)],
);

export type Settings = typeof settings.$inferSelect;
export type Boekjaar = typeof boekjaren.$inferSelect;
export type Grootboekrekening = typeof grootboekrekeningen.$inferSelect;
export type Relatie = typeof relaties.$inferSelect;
export type Transactie = typeof transacties.$inferSelect;
export type Beginbalans = typeof beginbalans.$inferSelect;
