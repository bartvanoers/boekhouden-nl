import { hash, verify } from "@node-rs/argon2";

/** argon2id in de Algorithm-enum van @node-rs/argon2 (0=d, 1=i, 2=id). */
const ARGON2ID = 2;

/**
 * Wachtwoord-hashing met argon2id.
 *
 * De "effectieve" hash die bij het inloggen wordt gecontroleerd is de env var
 * `AUTH_PASSWORD_HASH` indien gezet (override / reset-mechanisme), anders de
 * `password_hash` uit de settings-tabel.
 */

/** Hasht een wachtwoord met argon2id. */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: ARGON2ID });
}

/**
 * Verifieert een wachtwoord tegen een argon2-hash in constante tijd. Geeft
 * `false` terug bij een ongeldige of onleesbare hash in plaats van te gooien.
 */
export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/**
 * Pure resolutie van de effectieve hash: env var wint van de DB-hash. Los
 * gehouden van de database zodat de override-logica direct testbaar is.
 */
export function effectiveHash(
  dbHash: string | null | undefined,
  envHash: string | undefined = process.env.AUTH_PASSWORD_HASH,
): string | null {
  if (envHash && envHash.trim().length > 0) {
    return envHash.trim();
  }
  return dbHash ?? null;
}

/**
 * Geeft de actieve wachtwoord-hash terug: `AUTH_PASSWORD_HASH` indien gezet,
 * anders `settings.password_hash` (singleton, id = 1). Geeft `null` wanneer er
 * nog geen wachtwoord is ingesteld (verse database → setup vereist).
 */
export async function getActivePasswordHash(): Promise<string | null> {
  const envHash = process.env.AUTH_PASSWORD_HASH;
  if (envHash && envHash.trim().length > 0) {
    return envHash.trim();
  }

  const { db } = await import("@/db");
  const { settings } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const row = db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();

  return row?.passwordHash ?? null;
}
