"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { beginbalans, boekjaren } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { berekenOverdracht } from "@/lib/reports/overdracht";
import type { ActieResultaat } from "./boekjaren";

/**
 * Jaarafsluiting. Bij het afsluiten van boekjaar N:
 * - wordt de eindbalans berekend;
 * - wordt boekjaar N+1 aangemaakt (of hergebruikt) met dezelfde btw-periode;
 * - krijgt N+1 een beginbalans gelijk aan de eindbalans, waarbij het resultaat
 *   in 1400 Beginkapitaal vloeit (zodat de nieuwe beginbalans sluit);
 * - gaat boekjaar N op `gesloten`.
 *
 * Heropenen zet een gesloten boekjaar terug op `open` (bewerkbaar). Beide
 * mutaties beginnen met `requireSession()`.
 */

/** Sluit een open boekjaar af en draagt de eindbalans over naar N+1. */
export async function sluitBoekjaar(id: number): Promise<ActieResultaat> {
  await requireSession();

  const boekjaar = db
    .select()
    .from(boekjaren)
    .where(eq(boekjaren.id, id))
    .get();
  if (!boekjaar) {
    return { ok: false, error: "Onbekend boekjaar." };
  }
  if (boekjaar.status !== "open") {
    return { ok: false, error: `Boekjaar ${boekjaar.jaar} is al gesloten.` };
  }

  const nieuwJaar = boekjaar.jaar + 1;
  const overdracht = berekenOverdracht(db, boekjaar.id);

  db.transaction((tx) => {
    // Boekjaar N+1 aanmaken of hergebruiken (bij een eerdere afsluiting).
    let volgend = tx
      .select()
      .from(boekjaren)
      .where(eq(boekjaren.jaar, nieuwJaar))
      .get();
    if (!volgend) {
      tx.insert(boekjaren)
        .values({
          jaar: nieuwJaar,
          btwPeriode: boekjaar.btwPeriode,
          status: "open",
        })
        .run();
      volgend = tx
        .select()
        .from(boekjaren)
        .where(eq(boekjaren.jaar, nieuwJaar))
        .get()!;
    }

    // Beginbalans van N+1 opnieuw opbouwen uit de eindbalans van N.
    tx.delete(beginbalans).where(eq(beginbalans.boekjaarId, volgend.id)).run();
    if (overdracht.length > 0) {
      tx.insert(beginbalans)
        .values(
          overdracht.map((r) => ({
            boekjaarId: volgend!.id,
            grootboekId: r.grootboekId,
            bedragCents: r.bedragCents,
          })),
        )
        .run();
    }

    tx.update(boekjaren)
      .set({ status: "gesloten" })
      .where(eq(boekjaren.id, boekjaar.id))
      .run();
  });

  revalidatePath("/instellingen");
  revalidatePath("/beginbalans");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Heropent een gesloten boekjaar (weer bewerkbaar). */
export async function heropenBoekjaar(id: number): Promise<ActieResultaat> {
  await requireSession();

  const boekjaar = db
    .select()
    .from(boekjaren)
    .where(eq(boekjaren.id, id))
    .get();
  if (!boekjaar) {
    return { ok: false, error: "Onbekend boekjaar." };
  }
  if (boekjaar.status !== "gesloten") {
    return { ok: false, error: `Boekjaar ${boekjaar.jaar} is al open.` };
  }

  db.update(boekjaren)
    .set({ status: "open" })
    .where(eq(boekjaren.id, id))
    .run();

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
  return { ok: true };
}
