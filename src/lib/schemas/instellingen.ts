import { z } from "zod";
import type { BtwPeriode } from "@/db/schema";

/**
 * Zod-schema's voor de instellingen: bedrijfsgegevens en boekjaren.
 */

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

export const bedrijfsgegevensSchema = z.object({
  bedrijfsnaam: z
    .string()
    .trim()
    .min(1, "Bedrijfsnaam is verplicht.")
    .max(255, "Maximaal 255 tekens."),
  contactpersoon: optioneleTekst,
  adres: optioneleTekst,
  postcode: optioneleTekst,
  plaats: optioneleTekst,
  telefoon: optioneleTekst,
  email: optioneelEmail,
  website: optioneleTekst,
  obNummer: optioneleTekst,
  kvkNummer: optioneleTekst,
  iban: optioneleTekst,
});

export type BedrijfsgegevensInvoer = z.infer<typeof bedrijfsgegevensSchema>;

/** NL-labels per btw-aangifteperiode. */
export const BTW_PERIODE_LABELS: Record<BtwPeriode, string> = {
  maand: "Per maand",
  kwartaal: "Per kwartaal",
  jaar: "Per jaar",
};

export const BTW_PERIODES = ["maand", "kwartaal", "jaar"] as const;

export const nieuwBoekjaarSchema = z.object({
  jaar: z.coerce
    .number({ message: "Vul een geldig jaar in." })
    .int("Vul een geldig jaar in.")
    .min(2000, "Het jaar moet minimaal 2000 zijn.")
    .max(2100, "Het jaar moet maximaal 2100 zijn."),
  btwPeriode: z.enum(BTW_PERIODES, { message: "Kies een geldige btw-periode." }),
});

export const btwPeriodeSchema = z.object({
  id: z.coerce.number().int().positive(),
  btwPeriode: z.enum(BTW_PERIODES, { message: "Kies een geldige btw-periode." }),
});
