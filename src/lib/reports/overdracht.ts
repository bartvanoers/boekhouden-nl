import { eq } from "drizzle-orm";
import { grootboekrekeningen } from "@/db/schema";
import { berekenSaldi } from "./saldi";
import { SYSTEEM_CODE, type ReportDb } from "./db";

/**
 * Berekent de beginbalans voor het volgende boekjaar op basis van de
 * eindbalans (saldi) van het af te sluiten boekjaar. De eindsaldi van alle
 * balansrekeningen worden overgenomen; de sluitpost (resultaat lopend boekjaar)
 * vloeit in 1400 Beginkapitaal. Daardoor sluit de nieuwe beginbalans (Σ = 0).
 */

export type OverdrachtRegel = {
  grootboekId: number;
  bedragCents: number; // getekend: debet positief, credit negatief
};

export function berekenOverdracht(
  db: ReportDb,
  boekjaarId: number,
): OverdrachtRegel[] {
  const { saldi, resultaatCents } = berekenSaldi(db, boekjaarId);

  const map = new Map<number, number>();
  for (const s of saldi) map.set(s.id, s.bedragCents);

  const kapitaal = db
    .select({ id: grootboekrekeningen.id })
    .from(grootboekrekeningen)
    .where(eq(grootboekrekeningen.code, SYSTEEM_CODE.beginkapitaal))
    .get();
  if (kapitaal) {
    // Winst (positief resultaat) is een credit op het kapitaal → −resultaat op
    // de debet-positieve schaal.
    map.set(kapitaal.id, (map.get(kapitaal.id) ?? 0) - resultaatCents);
  }

  return [...map.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([grootboekId, bedragCents]) => ({ grootboekId, bedragCents }))
    .sort((a, b) => a.grootboekId - b.grootboekId);
}
