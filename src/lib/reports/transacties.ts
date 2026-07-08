import { and, asc, eq } from "drizzle-orm";
import { grootboekrekeningen, relaties, transacties } from "@/db/schema";
import type {
  BtwTarief,
  Richting,
  Soort,
  TransactieStatus,
} from "@/db/schema";
import type { ReportDb } from "./db";

/**
 * Transactieoverzicht per boekjaar (verkoop en/of inkoop). Levert de gejoinde
 * regels plus de totalen (excl./btw/incl.). Wordt gebruikt door de export; de
 * enige "rekenlogica" is de optelling van de zichtbare regels.
 */

export type TransactieRegel = {
  datum: string;
  richting: Richting;
  soort: Soort;
  factuurnummer: string | null;
  omschrijving: string | null;
  relatieNaam: string | null;
  grootboekCode: string | null;
  grootboekNaam: string | null;
  bedragExclCents: number;
  btwTarief: BtwTarief;
  btwCents: number;
  bedragInclCents: number;
  status: TransactieStatus;
};

export type TransactiesData = {
  regels: TransactieRegel[];
  totaalExclCents: number;
  totaalBtwCents: number;
  totaalInclCents: number;
};

export function berekenTransacties(
  db: ReportDb,
  boekjaarId: number,
  richting?: Richting,
): TransactiesData {
  const voorwaarden = [eq(transacties.boekjaarId, boekjaarId)];
  if (richting) voorwaarden.push(eq(transacties.richting, richting));

  const rijen = db
    .select({
      datum: transacties.datum,
      richting: transacties.richting,
      soort: transacties.soort,
      factuurnummer: transacties.factuurnummer,
      omschrijving: transacties.omschrijving,
      relatieNaam: relaties.naam,
      grootboekCode: grootboekrekeningen.code,
      grootboekNaam: grootboekrekeningen.naam,
      bedragExclCents: transacties.bedragExclCents,
      btwTarief: transacties.btwTarief,
      btwCents: transacties.btwCents,
      status: transacties.status,
    })
    .from(transacties)
    .leftJoin(relaties, eq(transacties.relatieId, relaties.id))
    .leftJoin(
      grootboekrekeningen,
      eq(transacties.grootboekId, grootboekrekeningen.id),
    )
    .where(and(...voorwaarden))
    .orderBy(asc(transacties.datum), asc(transacties.id))
    .all();

  const regels: TransactieRegel[] = rijen.map((r) => ({
    ...r,
    bedragInclCents: r.bedragExclCents + r.btwCents,
  }));

  let totaalExclCents = 0;
  let totaalBtwCents = 0;
  for (const r of regels) {
    totaalExclCents += r.bedragExclCents;
    totaalBtwCents += r.btwCents;
  }

  return {
    regels,
    totaalExclCents,
    totaalBtwCents,
    totaalInclCents: totaalExclCents + totaalBtwCents,
  };
}
