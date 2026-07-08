import { asc } from "drizzle-orm";
import { db } from "@/db";
import { grootboekrekeningen } from "@/db/schema";
import { GrootboekBeheer } from "./grootboek-beheer";

export default function GrootboekPage() {
  const rijen = db
    .select()
    .from(grootboekrekeningen)
    .orderBy(asc(grootboekrekeningen.code))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grootboek</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Het grootboekschema. Systeemrekeningen zijn vergrendeld.
        </p>
      </div>

      <GrootboekBeheer rekeningen={rijen} />
    </div>
  );
}
