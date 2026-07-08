/**
 * Next.js instrumentation hook: draait één keer bij het opstarten van de
 * server. We voeren hier migrate-on-boot uit, gevolgd door een idempotente
 * seed. Alleen in de Node.js-runtime (niet in de edge-runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { db } = await import("./db");
  const { runMigrations } = await import("./db/migrate");
  const { runSeed } = await import("./db/seed");

  runMigrations(db);
  runSeed(db);
}
