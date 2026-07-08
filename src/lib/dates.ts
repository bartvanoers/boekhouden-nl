/**
 * Datumhelpers. Datums leven als TEXT in de vorm `YYYY-MM-DD`; die sorteren
 * lexicografisch correct en met substrings halen we maand/kwartaal eruit.
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

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Controleert of een string een geldige `YYYY-MM-DD`-datum is. */
export function isValidDatum(datum: string): boolean {
  const m = ISO_DATE_RE.exec(datum);
  if (!m) return false;
  const [, y, mo, d] = m;
  const jaar = Number(y);
  const maand = Number(mo);
  const dag = Number(d);
  if (maand < 1 || maand > 12) return false;
  if (dag < 1 || dag > 31) return false;
  // Verifieer echte kalenderdatum (bijv. 2026-02-30 → ongeldig).
  const date = new Date(Date.UTC(jaar, maand - 1, dag));
  return (
    date.getUTCFullYear() === jaar &&
    date.getUTCMonth() === maand - 1 &&
    date.getUTCDate() === dag
  );
}

/** Geeft de datum van vandaag als `YYYY-MM-DD` (lokale tijd). */
export function vandaag(nu: Date = new Date()): string {
  const y = nu.getFullYear();
  const m = String(nu.getMonth() + 1).padStart(2, "0");
  const d = String(nu.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Lange nl-NL-weergave van een `YYYY-MM-DD`-datum, bijv. "8 juli 2026".
 * Geeft de invoer ongewijzigd terug wanneer die geen geldige datum is.
 */
export function formatDatumLang(datum: string): string {
  const m = ISO_DATE_RE.exec(datum);
  if (!m) return datum;
  const [, y, mo, d] = m;
  const maandNaam = MAANDEN_NL[Number(mo) - 1];
  if (!maandNaam) return datum;
  return `${Number(d)} ${maandNaam} ${Number(y)}`;
}

/**
 * Korte nl-NL-weergave van een `YYYY-MM-DD`-datum, bijv. "08-07-2026".
 * Geeft de invoer ongewijzigd terug wanneer die geen geldige datum is.
 */
export function formatDatumKort(datum: string): string {
  const m = ISO_DATE_RE.exec(datum);
  if (!m) return datum;
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}

/** Maandnummer (1–12) uit een `YYYY-MM-DD`-datum, of `null` bij ongeldige invoer. */
export function maandVan(datum: string): number | null {
  const m = ISO_DATE_RE.exec(datum);
  if (!m) return null;
  return Number(m[2]);
}

/** Jaartal uit een `YYYY-MM-DD`-datum, of `null` bij ongeldige invoer. */
export function jaarVan(datum: string): number | null {
  const m = ISO_DATE_RE.exec(datum);
  if (!m) return null;
  return Number(m[1]);
}

/** Kwartaalnummer (1–4) uit een `YYYY-MM-DD`-datum, of `null` bij ongeldige invoer. */
export function kwartaalVan(datum: string): number | null {
  const maand = maandVan(datum);
  if (maand === null) return null;
  return Math.floor((maand - 1) / 3) + 1;
}
