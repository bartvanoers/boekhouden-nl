import { describe, expect, it } from "vitest";
import { relatieSchema, volgendRelatieNr } from "./relatie";

describe("volgendRelatieNr", () => {
  it("begint bij 1 zonder bestaande relaties", () => {
    expect(volgendRelatieNr([])).toBe(1);
  });

  it("neemt het hoogste nummer + 1", () => {
    expect(volgendRelatieNr([1, 2, 5])).toBe(6);
  });

  it("werkt met gaten in de nummering", () => {
    expect(volgendRelatieNr([3, 7, 4])).toBe(8);
  });
});

describe("relatieSchema", () => {
  it("vereist een naam", () => {
    const res = relatieSchema.safeParse({
      naam: "  ",
      adres: "",
      postcode: "",
      plaats: "",
      telefoon: "",
      email: "",
      actief: true,
    });
    expect(res.success).toBe(false);
  });

  it("normaliseert lege optionele velden naar null", () => {
    const res = relatieSchema.safeParse({
      naam: "Klant BV",
      adres: "",
      postcode: "",
      plaats: "  ",
      telefoon: "",
      email: "",
      actief: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.adres).toBeNull();
      expect(res.data.plaats).toBeNull();
      expect(res.data.email).toBeNull();
      expect(res.data.naam).toBe("Klant BV");
    }
  });

  it("weigert een ongeldig e-mailadres", () => {
    const res = relatieSchema.safeParse({
      naam: "Klant",
      adres: "",
      postcode: "",
      plaats: "",
      telefoon: "",
      email: "geen-email",
      actief: true,
    });
    expect(res.success).toBe(false);
  });

  it("accepteert een geldig e-mailadres", () => {
    const res = relatieSchema.safeParse({
      naam: "Klant",
      adres: "",
      postcode: "",
      plaats: "",
      telefoon: "",
      email: "info@voorbeeld.nl",
      actief: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.email).toBe("info@voorbeeld.nl");
    }
  });
});
