import { defineConfig } from "drizzle-kit";

const dbPath = process.env.DATABASE_PATH ?? "./data/boekhouden.db";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbPath,
  },
  strict: true,
  verbose: true,
});
