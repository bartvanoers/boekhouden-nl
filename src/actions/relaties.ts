"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { relaties, transacties } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { relatieSchema, volgendRelatieNr } from "@/lib/schemas/relatie";
import type { ActieResultaat } from "./boekjaren";

/**
 * Server actions voor relaties. Patroon: requireSession → Zod → Drizzle →
 * revalidatePath. Stamgegevens zijn jaar-onafhankelijk (niet geblokkeerd bij
 * gesloten boekjaar).
 */

function leesRelatie(formData: FormData) {
  return relatieSchema.safeParse({
    naam: String(formData.get("naam") ?? ""),
    adres: String(formData.get("adres") ?? ""),
    postcode: String(formData.get("postcode") ?? ""),
    plaats: String(formData.get("plaats") ?? ""),
    telefoon: String(formData.get("telefoon") ?? ""),
    email: String(formData.get("email") ?? ""),
    actief: formData.get("actief") !== "false",
  });
}

function heeftTransacties(relatieId: number): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transacties)
    .where(eq(transacties.relatieId, relatieId))
    .get();
  return (row?.n ?? 0) > 0;
}

/** Nieuwe relatie aanmaken; nummer wordt automatisch opvolgend toegekend. */
export async function maakRelatie(formData: FormData): Promise<ActieResultaat> {
  await requireSession();

  const parsed = leesRelatie(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  const bestaandeNrs = db.select({ nr: relaties.nr }).from(relaties).all();
  const nr = volgendRelatieNr(bestaandeNrs.map((r) => r.nr));

  db.insert(relaties)
    .values({
      nr,
      naam: parsed.data.naam,
      adres: parsed.data.adres,
      postcode: parsed.data.postcode,
      plaats: parsed.data.plaats,
      telefoon: parsed.data.telefoon,
      email: parsed.data.email,
      actief: parsed.data.actief,
    })
    .run();

  revalidatePath("/relaties");
  return { ok: true };
}

/** Bestaande relatie bewerken. */
export async function wijzigRelatie(
  id: number,
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const bestaand = db
    .select({ id: relaties.id })
    .from(relaties)
    .where(eq(relaties.id, id))
    .get();
  if (!bestaand) {
    return { ok: false, error: "Onbekende relatie." };
  }

  const parsed = leesRelatie(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  db.update(relaties)
    .set({
      naam: parsed.data.naam,
      adres: parsed.data.adres,
      postcode: parsed.data.postcode,
      plaats: parsed.data.plaats,
      telefoon: parsed.data.telefoon,
      email: parsed.data.email,
      actief: parsed.data.actief,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(relaties.id, id))
    .run();

  revalidatePath("/relaties");
  return { ok: true };
}

/** Relatie activeren of deactiveren. */
export async function zetRelatieActief(
  id: number,
  actief: boolean,
): Promise<ActieResultaat> {
  await requireSession();

  const bestaand = db
    .select({ id: relaties.id })
    .from(relaties)
    .where(eq(relaties.id, id))
    .get();
  if (!bestaand) {
    return { ok: false, error: "Onbekende relatie." };
  }

  db.update(relaties)
    .set({ actief, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(relaties.id, id))
    .run();

  revalidatePath("/relaties");
  return { ok: true };
}

/**
 * Relatie verwijderen. Kan alléén wanneer er geen transacties aan hangen;
 * anders moet de relatie gedeactiveerd worden.
 */
export async function verwijderRelatie(id: number): Promise<ActieResultaat> {
  await requireSession();

  const bestaand = db
    .select({ id: relaties.id })
    .from(relaties)
    .where(eq(relaties.id, id))
    .get();
  if (!bestaand) {
    return { ok: false, error: "Onbekende relatie." };
  }

  if (heeftTransacties(id)) {
    return {
      ok: false,
      error:
        "Deze relatie heeft transacties en kan niet worden verwijderd. " +
        "Deactiveer de relatie in plaats daarvan.",
    };
  }

  db.delete(relaties).where(eq(relaties.id, id)).run();

  revalidatePath("/relaties");
  return { ok: true };
}
