import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import type { Boekjaar } from "@/db/schema";

/** Naam van de cookie waarin het actieve boekjaar wordt bewaard. */
export const BOEKJAAR_COOKIE = "boekjaar";

/**
 * Kiest het actieve boekjaar uit een lijst, gegeven een (optionele) cookie-id.
 *
 * Regels:
 * 1. Wijst de cookie naar een bestaand boekjaar → dat boekjaar.
 * 2. Anders: het meest recente open boekjaar.
 * 3. Anders: het meest recente boekjaar (ongeacht status).
 * 4. Geen boekjaren → `null`.
 *
 * Pure functie zodat de keuzelogica los van de database testbaar is.
 */
export function kiesActiefBoekjaar(
  alle: Boekjaar[],
  cookieId: number | null,
): Boekjaar | null {
  if (alle.length === 0) {
    return null;
  }

  if (cookieId != null) {
    const gekozen = alle.find((b) => b.id === cookieId);
    if (gekozen) {
      return gekozen;
    }
  }

  const gesorteerd = [...alle].sort((a, b) => b.jaar - a.jaar);
  return gesorteerd.find((b) => b.status === "open") ?? gesorteerd[0];
}

/** Berekent het jaar voor een nieuw boekjaar: hoogste bestaande jaar + 1. */
export function volgendBoekjaar(jaren: number[]): number {
  if (jaren.length === 0) {
    return new Date().getFullYear();
  }
  return Math.max(...jaren) + 1;
}

/**
 * Leest het actieve boekjaar op basis van de cookie en de database.
 * Wordt in fase 4/5 hergebruikt; houd de signatuur stabiel.
 */
export async function getActiefBoekjaar(): Promise<Boekjaar | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(BOEKJAAR_COOKIE)?.value;
  const cookieId = raw != null && /^\d+$/.test(raw) ? Number(raw) : null;

  const alle = db.select().from(boekjaren).all();
  return kiesActiefBoekjaar(alle, cookieId);
}
