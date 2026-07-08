import { z } from "zod";
import type { GrootboekType } from "@/db/schema";

/**
 * Zod-schema's en regels voor grootboekrekeningen.
 * Wordt hergebruikt in de server action en het formulier.
 */

/** NL-labels per grootboektype (voor weergave in tabellen en formulieren). */
export const GROOTBOEK_TYPE_LABELS: Record<GrootboekType, string> = {
  balans: "Balans",
  betalingsmiddel: "Betalingsmiddel",
  debiteuren: "Debiteuren",
  crediteuren: "Crediteuren",
  voorbelasting: "Voorbelasting",
  btw_hoog: "BTW hoog",
  btw_laag: "BTW laag",
  btw_rc: "BTW rekening-courant",
  winst_verlies: "Winst en verlies",
};

/**
 * Types die bij een nieuwe, niet-systeemrekening gekozen mogen worden.
 * De overige types zijn systeemtypes (voorbelasting, btw_*, betalingsmiddel,
 * debiteuren, crediteuren) en horen bij de vaste systeemrekeningen.
 */
export const NIEUW_GROOTBOEK_TYPES = ["balans", "winst_verlies"] as const;

/** Code: alleen cijfers, leidende nullen toegestaan. */
const codeSchema = z
  .string()
  .trim()
  .min(1, "Code is verplicht.")
  .max(10, "Maximaal 10 tekens.")
  .regex(/^\d+$/, "De code mag alleen cijfers bevatten.");

const naamSchema = z
  .string()
  .trim()
  .min(1, "Naam is verplicht.")
  .max(255, "Maximaal 255 tekens.");

/** Nieuwe (niet-systeem) rekening: code, naam en beperkt type. */
export const grootboekNieuwSchema = z.object({
  code: codeSchema,
  naam: naamSchema,
  type: z.enum(NIEUW_GROOTBOEK_TYPES, {
    message: "Kies een geldig type.",
  }),
  actief: z.boolean(),
});

/** Bewerken van een bestaande, niet-systeemrekening. */
export const grootboekBewerkSchema = z.object({
  code: codeSchema,
  naam: naamSchema,
  type: z.enum(NIEUW_GROOTBOEK_TYPES, {
    message: "Kies een geldig type.",
  }),
  actief: z.boolean(),
});

/** Bewerken van een systeemrekening: alléén de naam mag wijzigen. */
export const grootboekSysteemSchema = z.object({
  naam: naamSchema,
});

export type GrootboekNieuwInvoer = z.infer<typeof grootboekNieuwSchema>;

/**
 * Mag een rekening echt verwijderd worden?
 * Alleen wanneer het geen systeemrekening is én er niets aan hangt
 * (geen transacties, geen beginbalansregels).
 */
export function magGrootboekVerwijderen(opts: {
  isSysteem: boolean;
  inGebruik: boolean;
}): boolean {
  return !opts.isSysteem && !opts.inGebruik;
}
