import { eq, sql } from "drizzle-orm";
import { transacties } from "@/db/schema";
import { berekenBalans, type BalansData } from "./balans";
import { berekenBtw, type BtwData } from "./btw";
import { berekenWv, type WvData } from "./wv";
import type { ReportDb } from "./db";

/**
 * Dashboard: totalen per richting (verkoop/inkoop) plus een compacte W&V,
 * balans en btw-stand. Assembleert de andere rapportfuncties zodat het
 * dashboard en de losse pagina's exact dezelfde bedragen tonen.
 */

export type RichtingTotaal = {
  totaalInclCents: number;
  btwCents: number;
  betaaldInclCents: number;
  openstaandInclCents: number;
};

export type DashboardData = {
  verkoop: RichtingTotaal;
  inkoop: RichtingTotaal;
  wv: WvData;
  balans: BalansData;
  btw: BtwData;
};

function leegTotaal(): RichtingTotaal {
  return {
    totaalInclCents: 0,
    btwCents: 0,
    betaaldInclCents: 0,
    openstaandInclCents: 0,
  };
}

export function berekenDashboard(
  db: ReportDb,
  boekjaarId: number,
): DashboardData {
  const rijen = db
    .select({
      richting: transacties.richting,
      status: transacties.status,
      excl: sql<number>`coalesce(sum(${transacties.bedragExclCents}), 0)`,
      btw: sql<number>`coalesce(sum(${transacties.btwCents}), 0)`,
    })
    .from(transacties)
    .where(eq(transacties.boekjaarId, boekjaarId))
    .groupBy(transacties.richting, transacties.status)
    .all();

  const verkoop = leegTotaal();
  const inkoop = leegTotaal();
  for (const r of rijen) {
    const doel = r.richting === "verkoop" ? verkoop : inkoop;
    const incl = r.excl + r.btw;
    doel.totaalInclCents += incl;
    doel.btwCents += r.btw;
    if (r.status === "openstaand") doel.openstaandInclCents += incl;
    else doel.betaaldInclCents += incl;
  }

  return {
    verkoop,
    inkoop,
    wv: berekenWv(db, boekjaarId),
    balans: berekenBalans(db, boekjaarId),
    btw: berekenBtw(db, boekjaarId),
  };
}
