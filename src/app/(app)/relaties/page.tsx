import { asc } from "drizzle-orm";
import { db } from "@/db";
import { relaties } from "@/db/schema";
import { RelatiesBeheer } from "./relaties-beheer";

export default function RelatiesPage() {
  const rijen = db.select().from(relaties).orderBy(asc(relaties.nr)).all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relaties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Klanten en leveranciers.
        </p>
      </div>

      <RelatiesBeheer relaties={rijen} />
    </div>
  );
}
