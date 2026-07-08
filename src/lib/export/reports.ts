import { berekenBalans } from "@/lib/reports/balans";
import { berekenBtw } from "@/lib/reports/btw";
import { berekenTransacties } from "@/lib/reports/transacties";
import { berekenWv } from "@/lib/reports/wv";
import type { ReportDb } from "@/lib/reports/db";
import type { Richting } from "@/db/schema";
import { BTW_TARIEF_LABELS, STATUS_LABELS_KORT } from "@/lib/schemas/transactie";
import type { Tabel } from "./model";

/**
 * Zet de bestaande rapportfuncties om naar het abstracte tabelmodel. Dit is de
 * enige plek met de kolomindeling; CSV en XLSX renderen hetzelfde model. Er
 * wordt hier niets gerekend behalve triviale samenvoeging — alle bedragen komen
 * rechtstreeks uit `src/lib/reports/`.
 */

export const RAPPORTEN = ["transacties", "btw", "wv", "balans"] as const;
export type RapportNaam = (typeof RAPPORTEN)[number];

export function isRapportNaam(v: string): v is RapportNaam {
  return (RAPPORTEN as readonly string[]).includes(v);
}

const RICHTING_LABEL: Record<Richting, string> = {
  verkoop: "Verkoop",
  inkoop: "Inkoop",
};

function transactiesTabel(
  db: ReportDb,
  boekjaarId: number,
  jaar: number,
  richting?: Richting,
): Tabel {
  const data = berekenTransacties(db, boekjaarId, richting);
  const titel =
    richting === "verkoop"
      ? "Verkopen"
      : richting === "inkoop"
        ? "Inkopen"
        : "Transacties";

  return {
    titel,
    jaar,
    kolommen: [
      { header: "Datum", type: "datum" },
      { header: "Richting", type: "tekst" },
      { header: "Soort", type: "tekst" },
      { header: "Factuurnr.", type: "tekst" },
      { header: "Omschrijving", type: "tekst" },
      { header: "Relatie", type: "tekst" },
      { header: "Categorie", type: "tekst" },
      { header: "Bedrag excl.", type: "geld" },
      { header: "Btw-tarief", type: "tekst" },
      { header: "Btw", type: "geld" },
      { header: "Bedrag incl.", type: "geld" },
      { header: "Status", type: "tekst" },
    ],
    rijen: data.regels.map((r) => [
      r.datum,
      RICHTING_LABEL[r.richting],
      r.soort,
      r.factuurnummer,
      r.omschrijving,
      r.relatieNaam,
      r.grootboekCode
        ? `${r.grootboekCode} ${r.grootboekNaam ?? ""}`.trim()
        : (r.grootboekNaam ?? null),
      r.bedragExclCents,
      BTW_TARIEF_LABELS[r.btwTarief],
      r.btwCents,
      r.bedragInclCents,
      STATUS_LABELS_KORT[r.status],
    ]),
    totaal: [
      "Totaal",
      null,
      null,
      null,
      null,
      null,
      null,
      data.totaalExclCents,
      null,
      data.totaalBtwCents,
      data.totaalInclCents,
      null,
    ],
  };
}

function btwTabel(db: ReportDb, boekjaarId: number, jaar: number): Tabel {
  const data = berekenBtw(db, boekjaarId);
  const rij = (r: (typeof data.regels)[number] | typeof data.jaartotaal) => [
    r.label,
    r.grondslag1aCents,
    r.btw1aCents,
    r.grondslag1bCents,
    r.btw1bCents,
    r.grondslag0Cents,
    r.voorbelasting5bCents,
    r.teBetalenCents,
  ];

  return {
    titel: "BTW-overzicht",
    jaar,
    kolommen: [
      { header: "Periode", type: "tekst" },
      { header: "1a grondslag", type: "geld" },
      { header: "1a btw", type: "geld" },
      { header: "1b grondslag", type: "geld" },
      { header: "1b btw", type: "geld" },
      { header: "0% grondslag", type: "geld" },
      { header: "5b voorbelasting", type: "geld" },
      { header: "Te betalen", type: "geld" },
    ],
    rijen: data.regels.map(rij),
    totaal: rij(data.jaartotaal),
  };
}

function wvTabel(db: ReportDb, boekjaarId: number, jaar: number): Tabel {
  const data = berekenWv(db, boekjaarId);
  const rijen = [
    ...data.opbrengsten.map((r) => [r.code, r.naam, "Opbrengst", r.bedragCents]),
    ["", "Totaal opbrengsten", "", data.opbrengstenTotaalCents],
    ...data.kosten.map((r) => [r.code, r.naam, "Kosten", r.bedragCents]),
    ["", "Totaal kosten", "", data.kostenTotaalCents],
  ];

  return {
    titel: "Winst- en verliesrekening",
    jaar,
    kolommen: [
      { header: "Code", type: "tekst" },
      { header: "Omschrijving", type: "tekst" },
      { header: "Soort", type: "tekst" },
      { header: "Bedrag", type: "geld" },
    ],
    rijen,
    totaal: ["", "Resultaat", "", data.resultaatCents],
  };
}

function balansTabel(db: ReportDb, boekjaarId: number, jaar: number): Tabel {
  const data = berekenBalans(db, boekjaarId);
  const rijen: (string | number | null)[][] = [
    ...data.activa.map((r) => ["Activa", r.code, r.naam, r.bedragCents]),
    ["Activa", "", "Totaal activa", data.activaTotaalCents],
    ...data.passiva.map((r) => ["Passiva", r.code, r.naam, r.bedragCents]),
    ["Passiva", "", "Resultaat boekjaar", data.resultaatCents],
    ["Passiva", "", "Totaal passiva", data.passivaTotaalCents],
  ];

  return {
    titel: "Balans",
    jaar,
    kolommen: [
      { header: "Zijde", type: "tekst" },
      { header: "Code", type: "tekst" },
      { header: "Naam", type: "tekst" },
      { header: "Bedrag", type: "geld" },
    ],
    rijen,
    totaal: ["", "", "Balanstotaal", data.activaTotaalCents],
  };
}

/** Bouwt het tabelmodel voor een rapport. */
export function bouwRapport(
  db: ReportDb,
  rapport: RapportNaam,
  boekjaarId: number,
  jaar: number,
  richting?: Richting,
): Tabel {
  switch (rapport) {
    case "transacties":
      return transactiesTabel(db, boekjaarId, jaar, richting);
    case "btw":
      return btwTabel(db, boekjaarId, jaar);
    case "wv":
      return wvTabel(db, boekjaarId, jaar);
    case "balans":
      return balansTabel(db, boekjaarId, jaar);
  }
}
