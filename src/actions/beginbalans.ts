"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { beginbalans, grootboekrekeningen } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { parseEuro } from "@/lib/money";
import type { ActieResultaat } from "./boekjaren";

/**
 * Beginbalans opslaan voor het actieve boekjaar. Per balansrekening staan er
 * twee velden in de FormData: `debet_<id>` (activa) en `credit_<id>` (passiva).
 * Het opgeslagen bedrag is getekend: debet positief, credit negatief. Een
 * rekening met saldo 0 wordt verwijderd. Alleen bewerkbaar bij een open
 * boekjaar (server-side geweigerd bij gesloten).
 */
export async function slaBeginbalansOp(
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
      error: `Boekjaar ${boekjaar.jaar} is gesloten; de beginbalans kan niet worden gewijzigd.`,
    };
  }

  // Alle balansrekeningen (winst_verlies vloeit naar het resultaat, niet hier).
  const rekeningen = db
    .select({ id: grootboekrekeningen.id })
    .from(grootboekrekeningen)
    .where(ne(grootboekrekeningen.type, "winst_verlies"))
    .all();
  const geldigeIds = new Set(rekeningen.map((r) => r.id));

  const parseVeld = (naam: string): number | null | "fout" => {
    const raw = formData.get(naam);
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === "") return null;
    const cents = parseEuro(s);
    if (cents === null || cents < 0) return "fout";
    return cents;
  };

  const teZetten: { grootboekId: number; bedragCents: number }[] = [];
  for (const id of geldigeIds) {
    const debet = parseVeld(`debet_${id}`);
    const credit = parseVeld(`credit_${id}`);
    if (debet === "fout" || credit === "fout") {
      return { ok: false, error: "Vul geldige, niet-negatieve bedragen in." };
    }
    const bedragCents = (debet ?? 0) - (credit ?? 0);
    teZetten.push({ grootboekId: id, bedragCents });
  }

  db.transaction((tx) => {
    for (const rij of teZetten) {
      const bestaand = tx
        .select({ id: beginbalans.id })
        .from(beginbalans)
        .where(
          and(
            eq(beginbalans.boekjaarId, boekjaar.id),
            eq(beginbalans.grootboekId, rij.grootboekId),
          ),
        )
        .get();

      if (rij.bedragCents === 0) {
        if (bestaand) {
          tx.delete(beginbalans).where(eq(beginbalans.id, bestaand.id)).run();
        }
        continue;
      }

      if (bestaand) {
        tx.update(beginbalans)
          .set({ bedragCents: rij.bedragCents })
          .where(eq(beginbalans.id, bestaand.id))
          .run();
      } else {
        tx.insert(beginbalans)
          .values({
            boekjaarId: boekjaar.id,
            grootboekId: rij.grootboekId,
            bedragCents: rij.bedragCents,
          })
          .run();
      }
    }
  });

  revalidatePath("/beginbalans");
  revalidatePath("/", "layout");
  return { ok: true };
}
