import { berekenSaldi } from "./saldi";
import type { ReportDb } from "./db";

/**
 * Balans per boekjaar. Elke balansrekening krijgt haar getekende saldo
 * (debet positief). Positieve saldi staan aan de activazijde, negatieve aan de
 * passivazijde (getoond als absolute waarde). De sluitpost is het resultaat
 * lopend boekjaar aan de creditzijde, waardoor activa = passiva per constructie.
 */

export type BalansRegel = {
  code: string;
  naam: string;
  bedragCents: number; // altijd positief weergegeven
};

export type BalansData = {
  activa: BalansRegel[];
  passiva: BalansRegel[];
  /** Sluitpost: resultaat lopend boekjaar (positief = winst → creditzijde). */
  resultaatCents: number;
  activaTotaalCents: number;
  /** Inclusief de sluitpost resultaat. */
  passivaTotaalCents: number;
  sluit: boolean;
};

export function berekenBalans(db: ReportDb, boekjaarId: number): BalansData {
  const { saldi, resultaatCents } = berekenSaldi(db, boekjaarId);

  const activa: BalansRegel[] = [];
  const passiva: BalansRegel[] = [];
  for (const s of saldi) {
    if (s.bedragCents > 0) {
      activa.push({ code: s.code, naam: s.naam, bedragCents: s.bedragCents });
    } else if (s.bedragCents < 0) {
      passiva.push({ code: s.code, naam: s.naam, bedragCents: -s.bedragCents });
    }
  }

  const activaTotaalCents = activa.reduce((a, r) => a + r.bedragCents, 0);
  const passivaAccountsCents = passiva.reduce((a, r) => a + r.bedragCents, 0);
  // De sluitpost (= Σ saldi = activa − passiva-rekeningen) sluit de balans.
  const passivaTotaalCents = passivaAccountsCents + resultaatCents;

  return {
    activa,
    passiva,
    resultaatCents,
    activaTotaalCents,
    passivaTotaalCents,
    sluit: activaTotaalCents === passivaTotaalCents,
  };
}
