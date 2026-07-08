"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boekjaren, grootboekrekeningen, relaties, transacties } from "@/db/schema";
import type { Boekjaar } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { jaarVan } from "@/lib/dates";
import { transactieSchema } from "@/lib/schemas/transactie";
import type { ActieResultaat } from "./boekjaren";

/**
 * Server actions voor transacties (verkoop én inkoop). Patroon:
 * requireSession → Zod → controles → Drizzle → revalidatePath.
 *
 * Transacties horen bij het actieve boekjaar. Mutaties zijn geblokkeerd
 * wanneer het betreffende boekjaar gesloten is (server-side geweigerd, naast
 * de uitgeschakelde knoppen in de UI). De datum moet binnen het boekjaar
 * vallen.
 */

function leesTransactie(formData: FormData) {
  return transactieSchema.safeParse({
    richting: String(formData.get("richting") ?? ""),
    datum: String(formData.get("datum") ?? ""),
    soort: String(formData.get("soort") ?? ""),
    factuurnummer: String(formData.get("factuurnummer") ?? ""),
    omschrijving: String(formData.get("omschrijving") ?? ""),
    relatieId: formData.get("relatieId"),
    bedragExclCents: String(formData.get("bedragExcl") ?? ""),
    btwTarief: String(formData.get("btwTarief") ?? ""),
    btwCents: String(formData.get("btwBedrag") ?? ""),
    status: String(formData.get("status") ?? ""),
    grootboekId: formData.get("grootboekId"),
  });
}

/** Controleert of een relatie bestaat (of null is → altijd goed). */
function relatieGeldig(relatieId: number | null): boolean {
  if (relatieId === null) return true;
  const row = db
    .select({ id: relaties.id })
    .from(relaties)
    .where(eq(relaties.id, relatieId))
    .get();
  return row != null;
}

/** Controleert of een grootboekrekening bestaat. */
function grootboekGeldig(grootboekId: number): boolean {
  const row = db
    .select({ id: grootboekrekeningen.id })
    .from(grootboekrekeningen)
    .where(eq(grootboekrekeningen.id, grootboekId))
    .get();
  return row != null;
}

/** Nieuwe transactie aanmaken in het actieve boekjaar. */
export async function maakTransactie(
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const boekjaar = await getActiefBoekjaar();
  if (!boekjaar) {
    return { ok: false, error: "Er is geen actief boekjaar." };
  }
  if (boekjaar.status !== "open") {
    return {
      ok: false,
      error: `Boekjaar ${boekjaar.jaar} is gesloten; er kunnen geen transacties worden toegevoegd.`,
    };
  }

  const parsed = leesTransactie(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }
  const data = parsed.data;

  const datumFout = controleerDatum(data.datum, boekjaar);
  if (datumFout) return { ok: false, error: datumFout };

  if (!relatieGeldig(data.relatieId)) {
    return { ok: false, error: "Onbekende relatie." };
  }
  if (!grootboekGeldig(data.grootboekId)) {
    return { ok: false, error: "Onbekende categorie." };
  }

  db.insert(transacties)
    .values({
      boekjaarId: boekjaar.id,
      richting: data.richting,
      datum: data.datum,
      soort: data.soort,
      factuurnummer: data.factuurnummer,
      omschrijving: data.omschrijving,
      relatieId: data.relatieId,
      bedragExclCents: data.bedragExclCents,
      btwTarief: data.btwTarief,
      btwCents: data.btwCents,
      status: data.status,
      grootboekId: data.grootboekId,
    })
    .run();

  revalidatePath("/verkopen");
  revalidatePath("/inkopen");
  return { ok: true };
}

/** Bestaande transactie bewerken. Boekjaar en richting blijven ongewijzigd. */
export async function wijzigTransactie(
  id: number,
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const bestaand = db
    .select()
    .from(transacties)
    .where(eq(transacties.id, id))
    .get();
  if (!bestaand) {
    return { ok: false, error: "Onbekende transactie." };
  }

  const boekjaar = db
    .select()
    .from(boekjaren)
    .where(eq(boekjaren.id, bestaand.boekjaarId))
    .get();
  if (!boekjaar) {
    return { ok: false, error: "Onbekend boekjaar." };
  }
  if (boekjaar.status !== "open") {
    return {
      ok: false,
      error: `Boekjaar ${boekjaar.jaar} is gesloten; transacties kunnen niet worden gewijzigd.`,
    };
  }

  const parsed = leesTransactie(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }
  const data = parsed.data;

  const datumFout = controleerDatum(data.datum, boekjaar);
  if (datumFout) return { ok: false, error: datumFout };

  if (!relatieGeldig(data.relatieId)) {
    return { ok: false, error: "Onbekende relatie." };
  }
  if (!grootboekGeldig(data.grootboekId)) {
    return { ok: false, error: "Onbekende categorie." };
  }

  db.update(transacties)
    .set({
      datum: data.datum,
      soort: data.soort,
      factuurnummer: data.factuurnummer,
      omschrijving: data.omschrijving,
      relatieId: data.relatieId,
      bedragExclCents: data.bedragExclCents,
      btwTarief: data.btwTarief,
      btwCents: data.btwCents,
      status: data.status,
      grootboekId: data.grootboekId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(transacties.id, id))
    .run();

  revalidatePath("/verkopen");
  revalidatePath("/inkopen");
  return { ok: true };
}

/** Transactie verwijderen (geblokkeerd bij gesloten boekjaar). */
export async function verwijderTransactie(id: number): Promise<ActieResultaat> {
  await requireSession();

  const bestaand = db
    .select()
    .from(transacties)
    .where(eq(transacties.id, id))
    .get();
  if (!bestaand) {
    return { ok: false, error: "Onbekende transactie." };
  }

  const boekjaar = db
    .select()
    .from(boekjaren)
    .where(eq(boekjaren.id, bestaand.boekjaarId))
    .get();
  if (boekjaar && boekjaar.status !== "open") {
    return {
      ok: false,
      error: `Boekjaar ${boekjaar.jaar} is gesloten; transacties kunnen niet worden verwijderd.`,
    };
  }

  db.delete(transacties).where(eq(transacties.id, id)).run();

  revalidatePath("/verkopen");
  revalidatePath("/inkopen");
  return { ok: true };
}

/** Geeft een foutmelding terug wanneer de datum buiten het boekjaar valt. */
function controleerDatum(datum: string, boekjaar: Boekjaar): string | null {
  if (jaarVan(datum) !== boekjaar.jaar) {
    return `De datum moet binnen boekjaar ${boekjaar.jaar} vallen.`;
  }
  return null;
}
