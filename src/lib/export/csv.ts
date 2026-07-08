import { formatDatumKort } from "@/lib/dates";
import type { Cel, Kolom, Tabel } from "./model";

/**
 * CSV-renderer voor NL-Excel: puntkomma-gescheiden, UTF-8 met BOM, bedragen met
 * komma-decimalen en datums als DD-MM-JJJJ. De opmaak volgt het kolomtype uit
 * het gedeelde tabelmodel.
 */

/** Byte order mark zodat Excel het bestand als UTF-8 herkent. */
export const BOM = "﻿";

const SCHEIDING = ";";

/** Formatteert centen naar "1234,56" (komma-decimaal, geen duizendtalscheider). */
export function centenNaarCsv(cents: number): string {
  const negatief = cents < 0;
  const absoluut = Math.abs(Math.trunc(cents));
  const euros = Math.floor(absoluut / 100);
  const rest = absoluut % 100;
  return `${negatief ? "-" : ""}${euros},${String(rest).padStart(2, "0")}`;
}

/** Escapet een veld volgens RFC 4180 (quotes bij `;`, `"` of regeleinden). */
function escape(veld: string): string {
  if (/[";\r\n]/.test(veld)) {
    return `"${veld.replace(/"/g, '""')}"`;
  }
  return veld;
}

function celNaarTekst(cel: Cel, kolom: Kolom): string {
  if (cel === null || cel === undefined) return "";
  if (kolom.type === "geld") {
    return typeof cel === "number" ? centenNaarCsv(cel) : String(cel);
  }
  if (kolom.type === "datum") {
    return typeof cel === "string" ? formatDatumKort(cel) : String(cel);
  }
  return String(cel);
}

function regel(cellen: Cel[], kolommen: Kolom[]): string {
  return kolommen
    .map((kolom, i) => escape(celNaarTekst(cellen[i] ?? null, kolom)))
    .join(SCHEIDING);
}

/** Rendert een tabelmodel naar een CSV-string (inclusief BOM en kopblok). */
export function tabelNaarCsv(tabel: Tabel, bedrijfsnaam: string): string {
  const regels: string[] = [];

  // Kopblok: bedrijfsnaam, rapportnaam + boekjaar, dan een lege regel.
  regels.push(escape(bedrijfsnaam));
  regels.push(escape(`${tabel.titel} ${tabel.jaar}`));
  regels.push("");
  // Kolomkoppen.
  regels.push(tabel.kolommen.map((k) => escape(k.header)).join(SCHEIDING));
  // Datarijen.
  for (const rij of tabel.rijen) {
    regels.push(regel(rij, tabel.kolommen));
  }
  // Totaalregel.
  if (tabel.totaal) {
    regels.push(regel(tabel.totaal, tabel.kolommen));
  }

  return BOM + regels.join("\r\n") + "\r\n";
}
