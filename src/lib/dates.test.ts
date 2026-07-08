import { describe, expect, it } from "vitest";
import {
  formatDatumKort,
  formatDatumLang,
  isValidDatum,
  jaarVan,
  kwartaalVan,
  maandVan,
  vandaag,
} from "./dates";

describe("isValidDatum", () => {
  it("herkent geldige datums", () => {
    expect(isValidDatum("2026-07-08")).toBe(true);
    expect(isValidDatum("2024-02-29")).toBe(true); // schrikkeljaar
    expect(isValidDatum("2000-01-01")).toBe(true);
  });

  it("wijst ongeldige datums af", () => {
    expect(isValidDatum("2026-02-30")).toBe(false);
    expect(isValidDatum("2026-13-01")).toBe(false);
    expect(isValidDatum("2026-00-10")).toBe(false);
    expect(isValidDatum("2026-7-8")).toBe(false);
    expect(isValidDatum("08-07-2026")).toBe(false);
    expect(isValidDatum("onzin")).toBe(false);
    expect(isValidDatum("2025-02-29")).toBe(false);
  });
});

describe("vandaag", () => {
  it("formatteert een gegeven datum als YYYY-MM-DD", () => {
    expect(vandaag(new Date(2026, 6, 8))).toBe("2026-07-08");
    expect(vandaag(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(vandaag(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("formatDatumLang", () => {
  it("geeft lange nl-weergave", () => {
    expect(formatDatumLang("2026-07-08")).toBe("8 juli 2026");
    expect(formatDatumLang("2026-01-01")).toBe("1 januari 2026");
    expect(formatDatumLang("2026-12-25")).toBe("25 december 2026");
  });

  it("geeft de invoer terug bij ongeldige datum", () => {
    expect(formatDatumLang("onzin")).toBe("onzin");
  });
});

describe("formatDatumKort", () => {
  it("geeft korte nl-weergave", () => {
    expect(formatDatumKort("2026-07-08")).toBe("08-07-2026");
    expect(formatDatumKort("2026-12-25")).toBe("25-12-2026");
  });
});

describe("maandVan / jaarVan / kwartaalVan", () => {
  it("haalt de maand uit een datum", () => {
    expect(maandVan("2026-07-08")).toBe(7);
    expect(maandVan("2026-01-01")).toBe(1);
    expect(maandVan("onzin")).toBeNull();
  });

  it("haalt het jaar uit een datum", () => {
    expect(jaarVan("2026-07-08")).toBe(2026);
    expect(jaarVan("onzin")).toBeNull();
  });

  it("berekent het kwartaal", () => {
    expect(kwartaalVan("2026-01-15")).toBe(1);
    expect(kwartaalVan("2026-03-31")).toBe(1);
    expect(kwartaalVan("2026-04-01")).toBe(2);
    expect(kwartaalVan("2026-06-30")).toBe(2);
    expect(kwartaalVan("2026-07-08")).toBe(3);
    expect(kwartaalVan("2026-09-30")).toBe(3);
    expect(kwartaalVan("2026-10-01")).toBe(4);
    expect(kwartaalVan("2026-12-31")).toBe(4);
    expect(kwartaalVan("onzin")).toBeNull();
  });
});
