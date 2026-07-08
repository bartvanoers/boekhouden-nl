/**
 * Abstract tabelmodel voor exports. De rapportbouwers (`reports.ts`) zetten de
 * bestaande rapportfuncties om naar dit model; de CSV- en XLSX-renderers
 * consumeren hetzelfde model. Zo bestaat er één plek met de kolomindeling en
 * blijft alle rekenlogica in `src/lib/reports/`.
 */

/** Kolomtype bepaalt de opmaak in beide renderers. */
export type KolomType = "tekst" | "geld" | "datum";

export type Kolom = {
  header: string;
  type: KolomType;
};

/**
 * Celwaarde. Interpretatie volgt het kolomtype:
 * - `tekst`: string (of null → leeg);
 * - `geld`: getal in **centen** (integer), of null → leeg;
 * - `datum`: string `YYYY-MM-DD`, of null → leeg.
 */
export type Cel = string | number | null;

export type Tabel = {
  /** Titel van het rapport (bijv. "Verkopen"). */
  titel: string;
  /** Boekjaar waarop het rapport betrekking heeft. */
  jaar: number;
  kolommen: Kolom[];
  rijen: Cel[][];
  /** Optionele totaalregel (zelfde lengte als `kolommen`). */
  totaal?: Cel[] | null;
};
