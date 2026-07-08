import { describe, expect, it } from "vitest";
import {
  grootboekNieuwSchema,
  magGrootboekVerwijderen,
} from "./grootboek";

describe("magGrootboekVerwijderen", () => {
  it("staat verwijderen toe voor een ongebruikte, niet-systeemrekening", () => {
    expect(magGrootboekVerwijderen({ isSysteem: false, inGebruik: false })).toBe(
      true,
    );
  });

  it("blokkeert verwijderen van een systeemrekening", () => {
    expect(magGrootboekVerwijderen({ isSysteem: true, inGebruik: false })).toBe(
      false,
    );
  });

  it("blokkeert verwijderen van een rekening in gebruik", () => {
    expect(magGrootboekVerwijderen({ isSysteem: false, inGebruik: true })).toBe(
      false,
    );
  });
});

describe("grootboekNieuwSchema", () => {
  it("accepteert een code met cijfers en leidende nullen", () => {
    const res = grootboekNieuwSchema.safeParse({
      code: "0130",
      naam: "Inventaris",
      type: "balans",
      actief: true,
    });
    expect(res.success).toBe(true);
  });

  it("weigert een code met letters", () => {
    const res = grootboekNieuwSchema.safeParse({
      code: "12A",
      naam: "Iets",
      type: "balans",
      actief: true,
    });
    expect(res.success).toBe(false);
  });

  it("weigert een lege code", () => {
    const res = grootboekNieuwSchema.safeParse({
      code: "",
      naam: "Iets",
      type: "balans",
      actief: true,
    });
    expect(res.success).toBe(false);
  });

  it("weigert een systeemtype bij een nieuwe rekening", () => {
    const res = grootboekNieuwSchema.safeParse({
      code: "1620",
      naam: "Voorbelasting extra",
      type: "voorbelasting",
      actief: true,
    });
    expect(res.success).toBe(false);
  });

  it("accepteert winst_verlies als type", () => {
    const res = grootboekNieuwSchema.safeParse({
      code: "4990",
      naam: "Diverse kosten",
      type: "winst_verlies",
      actief: true,
    });
    expect(res.success).toBe(true);
  });
});
