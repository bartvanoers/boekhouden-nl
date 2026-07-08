import { and, eq, sql } from "drizzle-orm";
import { grootboekrekeningen, transacties } from "@/db/schema";
import type { ReportDb } from "./db";

/**
 * Winst-en-verliesrekening per boekjaar. Voor elke winst_verlies-rekening wordt
 * Σ `bedrag_excl_cents` genomen; verkoop levert opbrengsten, inkoop kosten.
 * Resultaat = opbrengsten − kosten. Balansposten (bijv. een via inkoop geboekte
 * inventaris) tellen NIET mee.
 */

export type WvRegel = {
  code: string;
  naam: string;
  bedragCents: number;
};

export type WvData = {
  opbrengsten: WvRegel[];
  kosten: WvRegel[];
  opbrengstenTotaalCents: number;
  kostenTotaalCents: number;
  resultaatCents: number;
};

export function berekenWv(db: ReportDb, boekjaarId: number): WvData {
  const rijen = db
    .select({
      code: grootboekrekeningen.code,
      naam: grootboekrekeningen.naam,
      richting: transacties.richting,
      excl: sql<number>`coalesce(sum(${transacties.bedragExclCents}), 0)`,
    })
    .from(transacties)
    .innerJoin(
      grootboekrekeningen,
      eq(transacties.grootboekId, grootboekrekeningen.id),
    )
    .where(
      and(
        eq(transacties.boekjaarId, boekjaarId),
        eq(grootboekrekeningen.type, "winst_verlies"),
      ),
    )
    .groupBy(grootboekrekeningen.id, transacties.richting)
    .all();

  const opbrengsten: WvRegel[] = [];
  const kosten: WvRegel[] = [];
  for (const r of rijen) {
    if (r.excl === 0) continue;
    const regel = { code: r.code, naam: r.naam, bedragCents: r.excl };
    if (r.richting === "verkoop") opbrengsten.push(regel);
    else kosten.push(regel);
  }
  opbrengsten.sort((a, b) => a.code.localeCompare(b.code));
  kosten.sort((a, b) => a.code.localeCompare(b.code));

  const opbrengstenTotaalCents = opbrengsten.reduce(
    (a, r) => a + r.bedragCents,
    0,
  );
  const kostenTotaalCents = kosten.reduce((a, r) => a + r.bedragCents, 0);

  return {
    opbrengsten,
    kosten,
    opbrengstenTotaalCents,
    kostenTotaalCents,
    resultaatCents: opbrengstenTotaalCents - kostenTotaalCents,
  };
}
