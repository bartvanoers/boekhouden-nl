import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import type { Settings } from "@/db/schema";

/** Leest de settings-singleton (id = 1), of `null` als die nog niet bestaat. */
export function getSettings(): Settings | null {
  return db.select().from(settings).where(eq(settings.id, 1)).get() ?? null;
}

/** Bedrijfsnaam uit de settings, met nette fallback voor de UI. */
export function getBedrijfsnaam(): string {
  const rij = getSettings();
  const naam = rij?.bedrijfsnaam?.trim();
  return naam && naam.length > 0 ? naam : "Boekhouden";
}
