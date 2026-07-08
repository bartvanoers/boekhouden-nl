"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { beginbalans, grootboekrekeningen, transacties } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import {
  grootboekBewerkSchema,
  grootboekNieuwSchema,
  grootboekSysteemSchema,
  magGrootboekVerwijderen,
} from "@/lib/schemas/grootboek";
import type { ActieResultaat } from "./boekjaren";

/**
 * Server actions voor grootboekrekeningen. Regels:
 * - Systeemrekeningen (is_systeem=1): code/type niet wijzigbaar, niet
 *   verwijderbaar, alléén naam aanpasbaar.
 * - Niet-systeemrekeningen met transacties of beginbalansregels: deactiveren
 *   i.p.v. verwijderen.
 * - Code uniek, alleen cijfers (leidende nullen toegestaan).
 */

function inGebruik(grootboekId: number): boolean {
  const t = db
    .select({ n: sql<number>`count(*)` })
    .from(transacties)
    .where(eq(transacties.grootboekId, grootboekId))
    .get();
  if ((t?.n ?? 0) > 0) {
    return true;
  }
  const b = db
    .select({ n: sql<number>`count(*)` })
    .from(beginbalans)
    .where(eq(beginbalans.grootboekId, grootboekId))
    .get();
  return (b?.n ?? 0) > 0;
}

function codeBestaat(code: string, behalveId?: number): boolean {
  const row = db
    .select({ id: grootboekrekeningen.id })
    .from(grootboekrekeningen)
    .where(
      behalveId != null
        ? and(
            eq(grootboekrekeningen.code, code),
            ne(grootboekrekeningen.id, behalveId),
          )
        : eq(grootboekrekeningen.code, code),
    )
    .get();
  return row != null;
}

/** Nieuwe grootboekrekening aanmaken (nooit een systeemrekening). */
export async function maakGrootboek(
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const parsed = grootboekNieuwSchema.safeParse({
    code: String(formData.get("code") ?? ""),
    naam: String(formData.get("naam") ?? ""),
    type: String(formData.get("type") ?? ""),
    actief: formData.get("actief") !== "false",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  if (codeBestaat(parsed.data.code)) {
    return {
      ok: false,
      error: `Code ${parsed.data.code} bestaat al.`,
    };
  }

  db.insert(grootboekrekeningen)
    .values({
      code: parsed.data.code,
      naam: parsed.data.naam,
      type: parsed.data.type,
      isSysteem: false,
      actief: parsed.data.actief,
    })
    .run();

  revalidatePath("/grootboek");
  return { ok: true };
}

/**
 * Grootboekrekening bewerken. Bij een systeemrekening wordt alléén de naam
 * bijgewerkt; code, type en actief-vlag blijven ongewijzigd.
 */
export async function wijzigGrootboek(
  id: number,
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const rekening = db
    .select()
    .from(grootboekrekeningen)
    .where(eq(grootboekrekeningen.id, id))
    .get();
  if (!rekening) {
    return { ok: false, error: "Onbekende rekening." };
  }

  if (rekening.isSysteem) {
    const parsed = grootboekSysteemSchema.safeParse({
      naam: String(formData.get("naam") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
      };
    }
    db.update(grootboekrekeningen)
      .set({ naam: parsed.data.naam, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(grootboekrekeningen.id, id))
      .run();

    revalidatePath("/grootboek");
    return { ok: true };
  }

  const parsed = grootboekBewerkSchema.safeParse({
    code: String(formData.get("code") ?? ""),
    naam: String(formData.get("naam") ?? ""),
    type: String(formData.get("type") ?? ""),
    actief: formData.get("actief") !== "false",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  if (codeBestaat(parsed.data.code, id)) {
    return { ok: false, error: `Code ${parsed.data.code} bestaat al.` };
  }

  db.update(grootboekrekeningen)
    .set({
      code: parsed.data.code,
      naam: parsed.data.naam,
      type: parsed.data.type,
      actief: parsed.data.actief,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(grootboekrekeningen.id, id))
    .run();

  revalidatePath("/grootboek");
  return { ok: true };
}

/** Grootboekrekening activeren of deactiveren (niet voor systeemrekeningen). */
export async function zetGrootboekActief(
  id: number,
  actief: boolean,
): Promise<ActieResultaat> {
  await requireSession();

  const rekening = db
    .select()
    .from(grootboekrekeningen)
    .where(eq(grootboekrekeningen.id, id))
    .get();
  if (!rekening) {
    return { ok: false, error: "Onbekende rekening." };
  }
  if (rekening.isSysteem) {
    return {
      ok: false,
      error: "Een systeemrekening kan niet gedeactiveerd worden.",
    };
  }

  db.update(grootboekrekeningen)
    .set({ actief, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(grootboekrekeningen.id, id))
    .run();

  revalidatePath("/grootboek");
  return { ok: true };
}

/**
 * Grootboekrekening verwijderen. Alleen wanneer het geen systeemrekening is en
 * er niets aan hangt (transacties of beginbalans); anders deactiveren.
 */
export async function verwijderGrootboek(id: number): Promise<ActieResultaat> {
  await requireSession();

  const rekening = db
    .select()
    .from(grootboekrekeningen)
    .where(eq(grootboekrekeningen.id, id))
    .get();
  if (!rekening) {
    return { ok: false, error: "Onbekende rekening." };
  }

  if (rekening.isSysteem) {
    return {
      ok: false,
      error: "Een systeemrekening kan niet worden verwijderd.",
    };
  }

  if (!magGrootboekVerwijderen({ isSysteem: false, inGebruik: inGebruik(id) })) {
    return {
      ok: false,
      error:
        "Deze rekening is in gebruik en kan niet worden verwijderd. " +
        "Deactiveer de rekening in plaats daarvan.",
    };
  }

  db.delete(grootboekrekeningen).where(eq(grootboekrekeningen.id, id)).run();

  revalidatePath("/grootboek");
  return { ok: true };
}
