import { describe, expect, it } from "vitest";
import { kiesActiefBoekjaar, volgendBoekjaar } from "./boekjaar";
import type { Boekjaar } from "@/db/schema";

function bj(partial: Partial<Boekjaar> & { id: number; jaar: number }): Boekjaar {
  return {
    id: partial.id,
    jaar: partial.jaar,
    btwPeriode: partial.btwPeriode ?? "kwartaal",
    status: partial.status ?? "open",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("kiesActiefBoekjaar", () => {
  it("geeft null bij lege lijst", () => {
    expect(kiesActiefBoekjaar([], 1)).toBeNull();
  });

  it("volgt de cookie wanneer die naar een bestaand boekjaar wijst", () => {
    const alle = [bj({ id: 1, jaar: 2025 }), bj({ id: 2, jaar: 2026 })];
    expect(kiesActiefBoekjaar(alle, 1)?.jaar).toBe(2025);
  });

  it("valt terug op het meest recente open boekjaar bij onbekende cookie", () => {
    const alle = [
      bj({ id: 1, jaar: 2024, status: "gesloten" }),
      bj({ id: 2, jaar: 2025, status: "open" }),
      bj({ id: 3, jaar: 2026, status: "gesloten" }),
    ];
    expect(kiesActiefBoekjaar(alle, 999)?.jaar).toBe(2025);
  });

  it("valt terug op het meest recente jaar wanneer geen boekjaar open is", () => {
    const alle = [
      bj({ id: 1, jaar: 2024, status: "gesloten" }),
      bj({ id: 2, jaar: 2026, status: "gesloten" }),
    ];
    expect(kiesActiefBoekjaar(alle, null)?.jaar).toBe(2026);
  });

  it("gebruikt de fallback ook wanneer geen cookie is gezet", () => {
    const alle = [bj({ id: 1, jaar: 2025 }), bj({ id: 2, jaar: 2026 })];
    expect(kiesActiefBoekjaar(alle, null)?.jaar).toBe(2026);
  });
});

describe("volgendBoekjaar", () => {
  it("neemt het hoogste jaar + 1", () => {
    expect(volgendBoekjaar([2024, 2026, 2025])).toBe(2027);
  });

  it("valt terug op het huidige jaar bij lege lijst", () => {
    expect(volgendBoekjaar([])).toBe(new Date().getFullYear());
  });
});
