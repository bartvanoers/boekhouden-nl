import { describe, expect, it } from "vitest";
import { berekenBtw, formatEuro, parseEuro } from "./money";

describe("formatEuro", () => {
  it("formatteert centen naar nl-NL euroweergave", () => {
    expect(formatEuro(123456)).toBe("€ 1.234,56");
    expect(formatEuro(0)).toBe("€ 0,00");
    expect(formatEuro(5)).toBe("€ 0,05");
    expect(formatEuro(100)).toBe("€ 1,00");
    expect(formatEuro(500000)).toBe("€ 5.000,00");
    expect(formatEuro(100000000)).toBe("€ 1.000.000,00");
  });

  it("formatteert negatieve bedragen", () => {
    expect(formatEuro(-1250)).toBe("€ -12,50");
  });
});

describe("parseEuro", () => {
  it("accepteert nl-notatie met duizendtalscheiders", () => {
    expect(parseEuro("1.234,56")).toBe(123456);
    expect(parseEuro("€ 1.234,56")).toBe(123456);
    expect(parseEuro("1.000.000,00")).toBe(100000000);
  });

  it("accepteert komma als decimaalteken zonder duizendtal", () => {
    expect(parseEuro("1234,56")).toBe(123456);
    expect(parseEuro("0,05")).toBe(5);
    expect(parseEuro("12,5")).toBe(1250);
  });

  it("accepteert punt als decimaalteken", () => {
    expect(parseEuro("1234.56")).toBe(123456);
    expect(parseEuro("1,234.56")).toBe(123456);
  });

  it("accepteert gehele getallen", () => {
    expect(parseEuro("1234")).toBe(123400);
    expect(parseEuro("0")).toBe(0);
    expect(parseEuro("€ 100")).toBe(10000);
  });

  it("verwerkt tekens en witruimte", () => {
    expect(parseEuro("  12,50  ")).toBe(1250);
    expect(parseEuro("-12,50")).toBe(-1250);
    expect(parseEuro("+12,50")).toBe(1250);
    expect(parseEuro("€-12,50")).toBe(-1250);
  });

  it("geeft null bij ongeldige invoer", () => {
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("   ")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("12,345")).toBeNull(); // meer dan 2 decimalen
    expect(parseEuro("1,2,3")).toBeNull();
    expect(parseEuro("€")).toBeNull();
    expect(parseEuro("12.34.56")).toBeNull();
  });
});

describe("berekenBtw", () => {
  it("berekent 21% (hoog) met correcte afronding", () => {
    expect(berekenBtw(100, "hoog")).toBe(21);
    expect(berekenBtw(999, "hoog")).toBe(210);
    expect(berekenBtw(100000, "hoog")).toBe(21000);
    expect(berekenBtw(0, "hoog")).toBe(0);
  });

  it("berekent 9% (laag) met correcte afronding", () => {
    expect(berekenBtw(100, "laag")).toBe(9);
    expect(berekenBtw(999, "laag")).toBe(90); // 89,91 → 90
    expect(berekenBtw(50000, "laag")).toBe(4500);
  });

  it("berekent 0% (geen)", () => {
    expect(berekenBtw(100, "geen")).toBe(0);
    expect(berekenBtw(999999, "geen")).toBe(0);
  });
});
