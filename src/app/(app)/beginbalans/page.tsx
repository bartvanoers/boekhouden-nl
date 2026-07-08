import { asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { beginbalans, grootboekrekeningen } from "@/db/schema";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import {
  BeginbalansFormulier,
  type BeginbalansRegel,
} from "./beginbalans-formulier";

/** Formatteert getekende centen naar een invoerbare nl-decimaal (zonder €). */
function centsNaarInvoer(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function BeginbalansPage() {
  const boekjaar = await getActiefBoekjaar();

  const kop = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Beginbalans</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Beginsaldi per balansrekening met sluitcheck (activa = passiva).
      </p>
    </div>
  );

  if (!boekjaar) {
    return (
      <div className="space-y-6">
        {kop}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Er is nog geen boekjaar. Maak eerst een boekjaar aan bij Instellingen.
        </p>
      </div>
    );
  }

  // Balansrekeningen: actief, of met een bestaande beginbalansregel.
  const rekeningen = db
    .select({
      id: grootboekrekeningen.id,
      code: grootboekrekeningen.code,
      naam: grootboekrekeningen.naam,
      actief: grootboekrekeningen.actief,
    })
    .from(grootboekrekeningen)
    .where(ne(grootboekrekeningen.type, "winst_verlies"))
    .orderBy(asc(grootboekrekeningen.code))
    .all();

  const bestaand = db
    .select({
      grootboekId: beginbalans.grootboekId,
      bedragCents: beginbalans.bedragCents,
    })
    .from(beginbalans)
    .where(eq(beginbalans.boekjaarId, boekjaar.id))
    .all();
  const saldoVoor = new Map(bestaand.map((b) => [b.grootboekId, b.bedragCents]));

  const regels: BeginbalansRegel[] = rekeningen
    .filter((r) => r.actief || saldoVoor.has(r.id))
    .map((r) => {
      const cents = saldoVoor.get(r.id) ?? 0;
      return {
        id: r.id,
        code: r.code,
        naam: r.naam,
        debet: cents > 0 ? centsNaarInvoer(cents) : "",
        credit: cents < 0 ? centsNaarInvoer(cents) : "",
      };
    });

  return (
    <div className="space-y-6">
      {kop}
      <BeginbalansFormulier
        boekjaarJaar={boekjaar.jaar}
        gesloten={boekjaar.status === "gesloten"}
        regels={regels}
      />
    </div>
  );
}
