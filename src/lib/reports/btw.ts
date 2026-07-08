import { eq, sql } from "drizzle-orm";
import { boekjaren, transacties } from "@/db/schema";
import type { BtwPeriode } from "@/db/schema";
import type { ReportDb } from "./db";

/**
 * BTW-overzicht per boekjaar, gegroepeerd per periode volgens de
 * btw-aangifteperiode van het boekjaar (maand/kwartaal/jaar).
 *
 * Rubrieken (per periode):
 * - 1a = verkoop hoog (21%): grondslag + btw;
 * - 1b = verkoop laag (9%): grondslag + btw;
 * - 0% = verkoop geen btw: alleen grondslag;
 * - 5b voorbelasting = Σ btw inkoop;
 * - te betalen = Σ btw verkoop − voorbelasting (negatief = terug te vragen).
 */

const MAANDEN_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export type BtwPeriodeRegel = {
  key: string;
  label: string;
  grondslag1aCents: number;
  btw1aCents: number;
  grondslag1bCents: number;
  btw1bCents: number;
  grondslag0Cents: number;
  voorbelasting5bCents: number;
  /** Positief = te betalen, negatief = terug te vragen. */
  teBetalenCents: number;
};

export type BtwData = {
  periode: BtwPeriode;
  regels: BtwPeriodeRegel[];
  jaartotaal: BtwPeriodeRegel;
};

function legeRegel(key: string, label: string): BtwPeriodeRegel {
  return {
    key,
    label,
    grondslag1aCents: 0,
    btw1aCents: 0,
    grondslag1bCents: 0,
    btw1bCents: 0,
    grondslag0Cents: 0,
    voorbelasting5bCents: 0,
    teBetalenCents: 0,
  };
}

/** Bepaalt periodesleutel + label voor een maand (1–12) en de btw-periode. */
function periodeVoorMaand(
  maand: number,
  periode: BtwPeriode,
  jaar: number,
): { key: string; label: string } {
  if (periode === "maand") {
    return { key: `m${maand}`, label: MAANDEN_NL[maand - 1] ?? `Maand ${maand}` };
  }
  if (periode === "kwartaal") {
    const k = Math.floor((maand - 1) / 3) + 1;
    return { key: `k${k}`, label: `Kwartaal ${k}` };
  }
  return { key: `j${jaar}`, label: String(jaar) };
}

export function berekenBtw(db: ReportDb, boekjaarId: number): BtwData {
  const boekjaar = db
    .select({ jaar: boekjaren.jaar, btwPeriode: boekjaren.btwPeriode })
    .from(boekjaren)
    .where(eq(boekjaren.id, boekjaarId))
    .get();

  const periode: BtwPeriode = boekjaar?.btwPeriode ?? "kwartaal";
  const jaar = boekjaar?.jaar ?? 0;

  const rijen = db
    .select({
      maand: sql<string>`substr(${transacties.datum}, 6, 2)`,
      richting: transacties.richting,
      tarief: transacties.btwTarief,
      grondslag: sql<number>`coalesce(sum(${transacties.bedragExclCents}), 0)`,
      btw: sql<number>`coalesce(sum(${transacties.btwCents}), 0)`,
    })
    .from(transacties)
    .where(eq(transacties.boekjaarId, boekjaarId))
    .groupBy(
      sql`substr(${transacties.datum}, 6, 2)`,
      transacties.richting,
      transacties.btwTarief,
    )
    .all();

  const perPeriode = new Map<string, BtwPeriodeRegel>();
  const jaartotaal = legeRegel(`j${jaar}`, "Jaartotaal");

  const boek = (regel: BtwPeriodeRegel, r: (typeof rijen)[number]) => {
    if (r.richting === "verkoop") {
      if (r.tarief === "hoog") {
        regel.grondslag1aCents += r.grondslag;
        regel.btw1aCents += r.btw;
      } else if (r.tarief === "laag") {
        regel.grondslag1bCents += r.grondslag;
        regel.btw1bCents += r.btw;
      } else {
        regel.grondslag0Cents += r.grondslag;
      }
      regel.teBetalenCents += r.btw;
    } else {
      regel.voorbelasting5bCents += r.btw;
      regel.teBetalenCents -= r.btw;
    }
  };

  for (const r of rijen) {
    const maand = Number(r.maand);
    if (!Number.isFinite(maand) || maand < 1 || maand > 12) continue;
    const { key, label } = periodeVoorMaand(maand, periode, jaar);
    let regel = perPeriode.get(key);
    if (!regel) {
      regel = legeRegel(key, label);
      perPeriode.set(key, regel);
    }
    boek(regel, r);
    boek(jaartotaal, r);
  }

  const regels = [...perPeriode.values()].sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { numeric: true }),
  );

  return { periode, regels, jaartotaal };
}
