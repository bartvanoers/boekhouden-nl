"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { BOEKJAAR_COOKIE, volgendBoekjaar } from "@/lib/boekjaar";
import {
  btwPeriodeSchema,
  nieuwBoekjaarSchema,
} from "@/lib/schemas/instellingen";

/** Gedeeld resultaattype voor de stamgegevens-actions. */
export type ActieResultaat = { ok: boolean; error?: string };

/**
 * Server actions voor boekjaren. Stamgegevens zijn jaar-onafhankelijk, dus
 * deze mutaties zijn NIET geblokkeerd bij een gesloten boekjaar. Elke action
 * begint met `requireSession()` (defense in depth).
 */

/** Zet het actieve boekjaar in de cookie. */
export async function wisselBoekjaar(id: number): Promise<ActieResultaat> {
  await requireSession();

  const boekjaar = db
    .select({ id: boekjaren.id })
    .from(boekjaren)
    .where(eq(boekjaren.id, id))
    .get();

  if (!boekjaar) {
    return { ok: false, error: "Onbekend boekjaar." };
  }

  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(BOEKJAAR_COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Maakt een nieuw boekjaar aan (jaar + btw-periode). */
export async function maakBoekjaar(formData: FormData): Promise<ActieResultaat> {
  await requireSession();

  const parsed = nieuwBoekjaarSchema.safeParse({
    jaar: formData.get("jaar"),
    btwPeriode: formData.get("btwPeriode"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  const bestaat = db
    .select({ id: boekjaren.id })
    .from(boekjaren)
    .where(eq(boekjaren.jaar, parsed.data.jaar))
    .get();
  if (bestaat) {
    return { ok: false, error: `Boekjaar ${parsed.data.jaar} bestaat al.` };
  }

  db.insert(boekjaren)
    .values({
      jaar: parsed.data.jaar,
      btwPeriode: parsed.data.btwPeriode,
      status: "open",
    })
    .run();

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Wijzigt de btw-periode van een open boekjaar. */
export async function wijzigBtwPeriode(
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const parsed = btwPeriodeSchema.safeParse({
    id: formData.get("id"),
    btwPeriode: formData.get("btwPeriode"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  const boekjaar = db
    .select()
    .from(boekjaren)
    .where(eq(boekjaren.id, parsed.data.id))
    .get();
  if (!boekjaar) {
    return { ok: false, error: "Onbekend boekjaar." };
  }
  if (boekjaar.status !== "open") {
    return {
      ok: false,
      error: "De btw-periode van een gesloten boekjaar kan niet wijzigen.",
    };
  }

  db.update(boekjaren)
    .set({ btwPeriode: parsed.data.btwPeriode })
    .where(eq(boekjaren.id, parsed.data.id))
    .run();

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Helper die het eerstvolgende jaar berekent (voor het formulier). */
export async function berekenVolgendJaar(): Promise<number> {
  const jaren = db.select({ jaar: boekjaren.jaar }).from(boekjaren).all();
  return volgendBoekjaar(jaren.map((r) => r.jaar));
}
