/**
 * Node-only opstartlogica: migrate-on-boot gevolgd door een idempotente seed.
 * Wordt alleen vanuit `instrumentation.ts` geïmporteerd in de Node.js-runtime.
 */
import { db } from "./db";
import { runMigrations } from "./db/migrate";
import { runSeed } from "./db/seed";

runMigrations(db);
runSeed(db);
