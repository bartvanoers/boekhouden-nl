import { describe, expect, it } from "vitest";
import {
  filterTransacties,
  transactieInPeriode,
  transactieSchema,
} from "./transactie";
import type { TransactieStatus } from "@/db/schema";

const basis = {
  richting: "verkoop",
  datum: "2026-03-15",
  soort: "factuur",
  factuurnummer: "F-001",
  omschrijving: "Verkoop dienst",
  relatieId: "",
  bedragExclCents: "100,00",
  btwTarief: "hoog",
  btwCents: "21,00",
  status: "bank",
  grootboekId: "5",
};

describe("transactieSchema", () => {
  it("parseert €100 excl / 21% naar 10000 centen excl en 2100 btw", () => {
    const res = transactieSchema.safeParse(basis);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.bedragExclCents).toBe(10000);
      expect(res.data.btwCents).toBe(2100);
      expect(res.data.relatieId).toBeNull();
      expect(res.data.grootboekId).toBe(5);
    }
  });

  it("bewaart een handmatig overschreven btw-bedrag zoals ingevoerd", () => {
    const res = transactieSchema.safeParse({ ...basis, btwCents: "20,00" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.btwCents).toBe(2000);
    }
  });

  it("normaliseert een lege relatie naar null en 'geen' naar null", () => {
    expect(
      transactieSchema.safeParse({ ...basis, relatieId: "geen" }).success,
    ).toBe(true);
    const res = transactieSchema.safeParse({ ...basis, relatieId: "7" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.relatieId).toBe(7);
  });

  it("vereist een omschrijving", () => {
    const res = transactieSchema.safeParse({ ...basis, omschrijving: "  " });
    expect(res.success).toBe(false);
  });

  it("weigert een ongeldig bedrag", () => {
    const res = transactieSchema.safeParse({ ...basis, bedragExclCents: "abc" });
    expect(res.success).toBe(false);
  });

  it("weigert een ongeldige datum", () => {
    const res = transactieSchema.safeParse({ ...basis, datum: "2026-02-30" });
    expect(res.success).toBe(false);
  });

  it("vereist een categorie", () => {
    const res = transactieSchema.safeParse({ ...basis, grootboekId: "" });
    expect(res.success).toBe(false);
  });
});

describe("transactieInPeriode", () => {
  it("laat alles door bij 'alle'", () => {
    expect(transactieInPeriode("2026-07-08", "alle")).toBe(true);
  });

  it("filtert op kwartaal", () => {
    expect(transactieInPeriode("2026-02-01", "k1")).toBe(true);
    expect(transactieInPeriode("2026-04-01", "k1")).toBe(false);
    expect(transactieInPeriode("2026-11-30", "k4")).toBe(true);
  });

  it("filtert op maand", () => {
    expect(transactieInPeriode("2026-07-08", "m7")).toBe(true);
    expect(transactieInPeriode("2026-08-08", "m7")).toBe(false);
  });
});

describe("filterTransacties", () => {
  const rijen = [
    { datum: "2026-01-10", status: "bank" as TransactieStatus, relatieId: 1 },
    { datum: "2026-04-10", status: "openstaand" as TransactieStatus, relatieId: 2 },
    { datum: "2026-07-10", status: "bank" as TransactieStatus, relatieId: null },
  ];

  it("combineert periode, status en relatie", () => {
    expect(
      filterTransacties(rijen, {
        periode: "alle",
        status: "alle",
        relatie: "alle",
      }),
    ).toHaveLength(3);

    expect(
      filterTransacties(rijen, {
        periode: "k1",
        status: "alle",
        relatie: "alle",
      }),
    ).toHaveLength(1);

    expect(
      filterTransacties(rijen, {
        periode: "alle",
        status: "bank",
        relatie: "alle",
      }),
    ).toHaveLength(2);

    expect(
      filterTransacties(rijen, {
        periode: "alle",
        status: "alle",
        relatie: "geen",
      }),
    ).toHaveLength(1);

    expect(
      filterTransacties(rijen, {
        periode: "alle",
        status: "bank",
        relatie: "1",
      }),
    ).toHaveLength(1);

    // Gecombineerd zonder match.
    expect(
      filterTransacties(rijen, {
        periode: "k1",
        status: "openstaand",
        relatie: "alle",
      }),
    ).toHaveLength(0);
  });
});
