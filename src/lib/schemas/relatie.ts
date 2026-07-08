import { z } from "zod";

/**
 * Zod-schema voor relaties (klanten/leveranciers).
 * Wordt hergebruikt in de server action en het formulier.
 */

/** Optioneel tekstveld: lege invoer wordt genormaliseerd naar `null`. */
const optioneleTekst = z
  .string()
  .trim()
  .max(255, "Maximaal 255 tekens.")
  .transform((v) => (v.length === 0 ? null : v));

const optioneelEmail = z
  .string()
  .trim()
  .max(255, "Maximaal 255 tekens.")
  .transform((v) => (v.length === 0 ? null : v))
  .refine((v) => v === null || z.email().safeParse(v).success, {
    message: "Vul een geldig e-mailadres in.",
  });

export const relatieSchema = z.object({
  naam: z
    .string()
    .trim()
    .min(1, "Naam is verplicht.")
    .max(255, "Maximaal 255 tekens."),
  adres: optioneleTekst,
  postcode: optioneleTekst,
  plaats: optioneleTekst,
  telefoon: optioneleTekst,
  email: optioneelEmail,
  actief: z.boolean(),
});

export type RelatieInvoer = z.infer<typeof relatieSchema>;

/**
 * Bepaalt het eerstvolgende relatienummer: hoogste bestaande nummer + 1,
 * beginnend bij 1. Pure functie, los testbaar.
 */
export function volgendRelatieNr(bestaande: number[]): number {
  if (bestaande.length === 0) {
    return 1;
  }
  return Math.max(...bestaande) + 1;
}
