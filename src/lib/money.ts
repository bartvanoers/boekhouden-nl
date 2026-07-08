/**
 * Geldhelpers. Geld wordt altijd als gehele centen (integer) verwerkt; er
 * komen nergens floats aan te pas in de opslag.
 */

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatteert centen naar een nl-NL euroweergave, bijv. 123456 → "€ 1.234,56".
 * Intl gebruikt standaard een smalle no-break space tussen teken en bedrag;
 * die normaliseren we naar een gewone spatie voor voorspelbare output.
 */
export function formatEuro(cents: number): string {
  const normalized = Math.trunc(cents);
  return euroFormatter
    .format(normalized / 100)
    .replace(/ | /g, " ");
}

/**
 * Parseert een door de gebruiker ingevoerd bedrag naar centen (integer).
 * Accepteert o.a. "1.234,56", "1234,56", "1234.56", "€ 1.234,56", "-12,50".
 * Geeft `null` terug bij ongeldige invoer.
 *
 * Regels:
 * - euroteken, spaties en de losse duizendtalscheiders worden genegeerd;
 * - zowel komma als punt kunnen als decimaalteken dienen;
 * - maximaal twee decimalen zijn toegestaan.
 */
export function parseEuro(input: string): number | null {
  if (typeof input !== "string") return null;

  let s = input.trim();
  if (s === "") return null;

  // Verwijder euroteken en witruimte (incl. no-break spaces).
  s = s.replace(/€/g, "").replace(/[\s  ]/g, "");
  if (s === "") return null;

  // Optioneel teken.
  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  // Alleen cijfers, punten en komma's zijn nu nog toegestaan.
  if (!/^[0-9.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let integerPart: string;
  let fractionPart: string;

  if (lastComma === -1 && lastDot === -1) {
    // Geen scheidingsteken: puur een geheel getal.
    integerPart = s;
    fractionPart = "";
  } else {
    // Het láátst voorkomende teken is het decimaalteken.
    const decimalPos = Math.max(lastComma, lastDot);
    const decimalChar = s[decimalPos];
    const thousandsChar = decimalChar === "," ? "." : ",";

    const intRaw = s.slice(0, decimalPos);
    fractionPart = s.slice(decimalPos + 1);

    // Het decimaalteken mag maar één keer voorkomen.
    if (fractionPart.includes(",") || fractionPart.includes(".")) return null;

    // Duizendtalscheiders in het gehele deel mogen alleen de "andere" zijn.
    if (intRaw.includes(decimalChar)) return null;
    integerPart = intRaw.split(thousandsChar).join("");
  }

  if (fractionPart.length > 2) return null;
  if (integerPart === "" && fractionPart === "") return null;
  if (integerPart !== "" && !/^[0-9]+$/.test(integerPart)) return null;
  if (fractionPart !== "" && !/^[0-9]+$/.test(fractionPart)) return null;

  const cents =
    Number(integerPart || "0") * 100 + Number(fractionPart.padEnd(2, "0") || "0");

  if (!Number.isFinite(cents)) return null;
  return sign * cents;
}

/** Btw-tarief. */
export type BtwTarief = "hoog" | "laag" | "geen";

const BTW_PERCENTAGE: Record<BtwTarief, number> = {
  hoog: 21,
  laag: 9,
  geen: 0,
};

/**
 * Berekent het btw-bedrag in centen over een bedrag exclusief btw (ook in
 * centen). Gebruikt Math.round voor correcte afronding op hele centen.
 * Voorbeelden bij 'hoog' (21%): 100 → 21, 999 → 210.
 */
export function berekenBtw(exclCents: number, tarief: BtwTarief): number {
  const pct = BTW_PERCENTAGE[tarief];
  return Math.round((exclCents * pct) / 100);
}
