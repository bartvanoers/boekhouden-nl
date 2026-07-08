import { and, eq, ne, sql } from "drizzle-orm";
import { beginbalans, grootboekrekeningen, transacties } from "@/db/schema";
import type { GrootboekType } from "@/db/schema";
import { SYSTEEM_CODE, type ReportDb } from "./db";

/**
 * Berekent de saldi van alle balansrekeningen voor een boekjaar.
 *
 * Alles wordt getekend bijgehouden met **debet positief, credit negatief**.
 * Per transactie worden de volledige dubbele boekingen toegepast:
 *
 * - betaal-/vorderingsbeen (afhankelijk van `status` en `richting`):
 *   verkoop → +incl op Bank/Kas/Debiteuren; inkoop → −incl op Bank/Kas/Crediteuren;
 * - btw-been: inkoop → +btw op Voorbelasting; verkoop → −btw op Af te dragen
 *   BTW hoog/laag (0%/geen levert geen btw op);
 * - categoriebeen (het gekozen grootboek): alléén wanneer dat een
 *   balansrekening is (winst_verlies-rekeningen vloeien naar het resultaat):
 *   inkoop → +excl, verkoop → −excl.
 *
 * De som van alle balanssaldi is per constructie gelijk aan het resultaat
 * (omzet − kosten), plus een eventueel niet-sluitende beginbalans. Die som is
 * de sluitpost "resultaat lopend boekjaar" waarmee de balans sluit.
 */

export type BalansSaldo = {
  id: number;
  code: string;
  naam: string;
  type: GrootboekType;
  bedragCents: number; // getekend: debet positief, credit negatief
};

export type SaldiResultaat = {
  /** Alléén balansrekeningen met een saldo ≠ 0, op code gesorteerd. */
  saldi: BalansSaldo[];
  /** Σ van alle balanssaldi = sluitpost/resultaat lopend boekjaar. */
  resultaatCents: number;
};

export function berekenSaldi(db: ReportDb, boekjaarId: number): SaldiResultaat {
  const rekeningen = db
    .select({
      id: grootboekrekeningen.id,
      code: grootboekrekeningen.code,
      naam: grootboekrekeningen.naam,
      type: grootboekrekeningen.type,
    })
    .from(grootboekrekeningen)
    .all();

  const byId = new Map(rekeningen.map((r) => [r.id, r]));
  const byCode = new Map(rekeningen.map((r) => [r.code, r]));
  const idVoorCode = (code: string): number | null =>
    byCode.get(code)?.id ?? null;

  // Getekende saldomap: accountId → centen (debet positief).
  const saldo = new Map<number, number>();
  const add = (accountId: number | null, cents: number) => {
    if (accountId == null || cents === 0) return;
    saldo.set(accountId, (saldo.get(accountId) ?? 0) + cents);
  };

  // 1) Beginbalans (al getekend opgeslagen).
  const beginrijen = db
    .select({
      grootboekId: beginbalans.grootboekId,
      bedragCents: beginbalans.bedragCents,
    })
    .from(beginbalans)
    .where(eq(beginbalans.boekjaarId, boekjaarId))
    .all();
  for (const r of beginrijen) add(r.grootboekId, r.bedragCents);

  // 2) Betaal-/vorderingsbeen per status × richting (bedrag inclusief btw).
  const betaalRijen = db
    .select({
      status: transacties.status,
      richting: transacties.richting,
      incl: sql<number>`coalesce(sum(${transacties.bedragExclCents} + ${transacties.btwCents}), 0)`,
    })
    .from(transacties)
    .where(eq(transacties.boekjaarId, boekjaarId))
    .groupBy(transacties.status, transacties.richting)
    .all();
  for (const r of betaalRijen) {
    const code =
      r.status === "bank"
        ? SYSTEEM_CODE.bank
        : r.status === "kas"
          ? SYSTEEM_CODE.kas
          : r.richting === "verkoop"
            ? SYSTEEM_CODE.debiteuren
            : SYSTEEM_CODE.crediteuren;
    const teken = r.richting === "verkoop" ? 1 : -1;
    add(idVoorCode(code), teken * r.incl);
  }

  // 3) Btw-been per richting × tarief.
  const btwRijen = db
    .select({
      richting: transacties.richting,
      tarief: transacties.btwTarief,
      btw: sql<number>`coalesce(sum(${transacties.btwCents}), 0)`,
    })
    .from(transacties)
    .where(eq(transacties.boekjaarId, boekjaarId))
    .groupBy(transacties.richting, transacties.btwTarief)
    .all();
  for (const r of btwRijen) {
    if (r.richting === "inkoop") {
      add(idVoorCode(SYSTEEM_CODE.voorbelasting), r.btw);
    } else if (r.tarief === "hoog") {
      add(idVoorCode(SYSTEEM_CODE.btwHoog), -r.btw);
    } else if (r.tarief === "laag") {
      add(idVoorCode(SYSTEEM_CODE.btwLaag), -r.btw);
    }
  }

  // 4) Categoriebeen (excl) voor balans-grootboekrekeningen.
  const categorieRijen = db
    .select({
      grootboekId: transacties.grootboekId,
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
        ne(grootboekrekeningen.type, "winst_verlies"),
      ),
    )
    .groupBy(transacties.grootboekId, transacties.richting)
    .all();
  for (const r of categorieRijen) {
    const teken = r.richting === "inkoop" ? 1 : -1;
    add(r.grootboekId, teken * r.excl);
  }

  // Assembleer. Alleen balansrekeningen tellen mee (winst_verlies → resultaat).
  let resultaatCents = 0;
  const saldi: BalansSaldo[] = [];
  for (const [id, cents] of saldo) {
    const meta = byId.get(id);
    if (!meta || meta.type === "winst_verlies") continue;
    resultaatCents += cents;
    if (cents !== 0) {
      saldi.push({
        id,
        code: meta.code,
        naam: meta.naam,
        type: meta.type,
        bedragCents: cents,
      });
    }
  }
  saldi.sort((a, b) => a.code.localeCompare(b.code));

  return { saldi, resultaatCents };
}
