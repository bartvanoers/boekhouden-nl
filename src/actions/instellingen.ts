"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { bedrijfsgegevensSchema } from "@/lib/schemas/instellingen";
import type { ActieResultaat } from "./boekjaren";

/**
 * Server action voor de bedrijfsgegevens (settings-singleton, id = 1).
 * De bedrijfsnaam wordt overal in de UI uit deze tabel gelezen.
 */
export async function bewaarBedrijfsgegevens(
  formData: FormData,
): Promise<ActieResultaat> {
  await requireSession();

  const parsed = bedrijfsgegevensSchema.safeParse({
    bedrijfsnaam: String(formData.get("bedrijfsnaam") ?? ""),
    contactpersoon: String(formData.get("contactpersoon") ?? ""),
    adres: String(formData.get("adres") ?? ""),
    postcode: String(formData.get("postcode") ?? ""),
    plaats: String(formData.get("plaats") ?? ""),
    telefoon: String(formData.get("telefoon") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    obNummer: String(formData.get("obNummer") ?? ""),
    kvkNummer: String(formData.get("kvkNummer") ?? ""),
    iban: String(formData.get("iban") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }

  const bestaand = db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();

  const waarden = {
    bedrijfsnaam: parsed.data.bedrijfsnaam,
    contactpersoon: parsed.data.contactpersoon,
    adres: parsed.data.adres,
    postcode: parsed.data.postcode,
    plaats: parsed.data.plaats,
    telefoon: parsed.data.telefoon,
    email: parsed.data.email,
    website: parsed.data.website,
    obNummer: parsed.data.obNummer,
    kvkNummer: parsed.data.kvkNummer,
    iban: parsed.data.iban,
  };

  if (bestaand) {
    db.update(settings)
      .set({ ...waarden, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(settings.id, 1))
      .run();
  } else {
    db.insert(settings)
      .values({ id: 1, ...waarden })
      .run();
  }

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
  return { ok: true };
}
