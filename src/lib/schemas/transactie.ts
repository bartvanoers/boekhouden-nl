import { z } from "zod";
import { isValidDatum, kwartaalVan, maandVan } from "@/lib/dates";
import { parseEuro } from "@/lib/money";
import type {
  BtwTarief,
  Richting,
  Soort,
  TransactieStatus,
} from "@/db/schema";

/**
 * Zod-schema en hulpfuncties voor transacties (verkoop én inkoop).
 * Wordt hergebruikt in de server actions en (indirect, via de labels/filters)
 * in het gedeelde registercomponent.
 *
 * Geld komt als nl-tekst binnen ("1.234,56") en wordt naar gehele centen
 * geparsed. De btw is bij invoer live berekend maar handmatig overschrijfbaar,
 * dus het btw-bedrag wordt opgeslagen zoals ingevoerd.
 */

/** NL-labels per soort (voor weergave in tabellen en formulieren). */
export const SOORT_LABELS: Record<Soort, string> = {
  factuur: "Factuur",
  bonnetje: "Bonnetje",
  overig: "Overig",
};

/** NL-labels per btw-tarief. */
export const BTW_TARIEF_LABELS: Record<BtwTarief, string> = {
  hoog: "21%",
  laag: "9%",
  geen: "Geen btw",
};

/** NL-labels per status. */
export const STATUS_LABELS: Record<TransactieStatus, string> = {
  bank: "Betaald via Bank",
  kas: "Betaald via Kas",
  openstaand: "Openstaand",
};

/** Korte statuslabels voor de tabel. */
export const STATUS_LABELS_KORT: Record<TransactieStatus, string> = {
  bank: "Bank",
  kas: "Kas",
  openstaand: "Openstaand",
};

/** Standaard grootboekcode per richting (default in het formulier). */
export const DEFAULT_GROOTBOEK_CODE: Record<Richting, string> = {
  verkoop: "8000", // Omzet NL
  inkoop: "7000", // Inkopen
};

const SOORTEN = ["factuur", "bonnetje", "overig"] as const;
const TARIEVEN = ["hoog", "laag", "geen"] as const;
const STATUSSEN = ["bank", "kas", "openstaand"] as const;
const RICHTINGEN = ["verkoop", "inkoop"] as const;

/** Tekstveld dat leeg → null normaliseert. */
function optioneleTekst(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Maximaal ${max} tekens.`)
    .transform((v) => (v.length === 0 ? null : v));
}

/** Bedragveld: nl-tekst → gehele centen. */
function centenVeld(veld: string) {
  return z
    .string()
    .trim()
    .min(1, `${veld} is verplicht.`)
    .transform((v, ctx) => {
      const cents = parseEuro(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${veld} is ongeldig.` });
        return z.NEVER;
      }
      return cents;
    });
}

export const transactieSchema = z.object({
  richting: z.enum(RICHTINGEN, { message: "Ongeldige richting." }),
  datum: z.string().refine(isValidDatum, "Vul een geldige datum in."),
  soort: z.enum(SOORTEN, { message: "Kies een soort." }),
  factuurnummer: optioneleTekst(100),
  omschrijving: z
    .string()
    .trim()
    .min(1, "Omschrijving is verplicht.")
    .max(500, "Maximaal 500 tekens."),
  relatieId: z.preprocess(
    (v) => {
      if (v == null) return null;
      const s = String(v).trim();
      if (s === "" || s === "geen") return null;
      const n = Number(s);
      return Number.isInteger(n) ? n : null;
    },
    z.number().int().positive().nullable(),
  ),
  bedragExclCents: centenVeld("Bedrag exclusief btw"),
  btwTarief: z.enum(TARIEVEN, { message: "Kies een btw-tarief." }),
  btwCents: centenVeld("Btw-bedrag"),
  status: z.enum(STATUSSEN, { message: "Kies een status." }),
  grootboekId: z.preprocess(
    (v) => {
      const s = String(v ?? "").trim();
      if (s === "") return undefined;
      const n = Number(s);
      return Number.isInteger(n) ? n : undefined;
    },
    z.number({ message: "Kies een categorie." }).int().positive("Kies een categorie."),
  ),
});

export type TransactieInvoer = z.infer<typeof transactieSchema>;

/**
 * Periodefilter binnen een boekjaar:
 * - "alle": geen filter;
 * - "kN" (N=1..4): kwartaal N;
 * - "mN" (N=1..12): maand N.
 */
export function transactieInPeriode(datum: string, filter: string): boolean {
  if (!filter || filter === "alle") return true;
  if (filter.startsWith("k")) {
    return kwartaalVan(datum) === Number(filter.slice(1));
  }
  if (filter.startsWith("m")) {
    return maandVan(datum) === Number(filter.slice(1));
  }
  return true;
}

/** Gecombineerd filter (periode + status + relatie). Pure functie, los testbaar. */
export function filterTransacties<
  T extends {
    datum: string;
    status: TransactieStatus;
    relatieId: number | null;
  },
>(
  rijen: T[],
  filters: { periode: string; status: string; relatie: string },
): T[] {
  return rijen.filter((r) => {
    if (!transactieInPeriode(r.datum, filters.periode)) return false;
    if (filters.status !== "alle" && r.status !== filters.status) return false;
    if (filters.relatie !== "alle") {
      if (filters.relatie === "geen") {
        if (r.relatieId !== null) return false;
      } else if (String(r.relatieId) !== filters.relatie) {
        return false;
      }
    }
    return true;
  });
}
