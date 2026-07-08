import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { grootboekrekeningen, relaties, transacties } from "@/db/schema";
import type { Richting } from "@/db/schema";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { DEFAULT_GROOTBOEK_CODE } from "@/lib/schemas/transactie";
import { ExportKnoppen } from "@/components/export-knoppen";
import {
  TransactieRegister,
  type GrootboekOptie,
  type RelatieOptie,
  type TransactieRij,
} from "@/components/transactie-register";

/**
 * Gedeelde server-pagina voor de transactieregisters. Leest het actieve
 * boekjaar, de transacties (gejoind met relatie- en grootboeknamen), en de
 * keuzelijsten. Rendert het gedeelde client-registercomponent.
 */
export async function RegisterPagina({
  richting,
  titel,
  omschrijving,
}: {
  richting: Richting;
  titel: string;
  omschrijving: string;
}) {
  const boekjaar = await getActiefBoekjaar();

  const kop = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{omschrijving}</p>
    </div>
  );

  if (!boekjaar) {
    return (
      <div className="space-y-6">
        {kop}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Er is nog geen boekjaar. Maak eerst een boekjaar aan bij
          Instellingen.
        </p>
      </div>
    );
  }

  const rijen: TransactieRij[] = db
    .select({
      id: transacties.id,
      datum: transacties.datum,
      soort: transacties.soort,
      factuurnummer: transacties.factuurnummer,
      omschrijving: transacties.omschrijving,
      relatieId: transacties.relatieId,
      relatieNaam: relaties.naam,
      bedragExclCents: transacties.bedragExclCents,
      btwTarief: transacties.btwTarief,
      btwCents: transacties.btwCents,
      status: transacties.status,
      grootboekId: transacties.grootboekId,
      grootboekCode: grootboekrekeningen.code,
      grootboekNaam: grootboekrekeningen.naam,
    })
    .from(transacties)
    .leftJoin(relaties, eq(transacties.relatieId, relaties.id))
    .leftJoin(
      grootboekrekeningen,
      eq(transacties.grootboekId, grootboekrekeningen.id),
    )
    .where(
      and(
        eq(transacties.boekjaarId, boekjaar.id),
        eq(transacties.richting, richting),
      ),
    )
    .orderBy(desc(transacties.datum), desc(transacties.id))
    .all();

  const relatieOpties: RelatieOptie[] = db
    .select({
      id: relaties.id,
      nr: relaties.nr,
      naam: relaties.naam,
      actief: relaties.actief,
    })
    .from(relaties)
    .orderBy(asc(relaties.naam))
    .all();

  const grootboekOpties: GrootboekOptie[] = db
    .select({
      id: grootboekrekeningen.id,
      code: grootboekrekeningen.code,
      naam: grootboekrekeningen.naam,
      actief: grootboekrekeningen.actief,
    })
    .from(grootboekrekeningen)
    .orderBy(asc(grootboekrekeningen.code))
    .all();

  const defaultCode = DEFAULT_GROOTBOEK_CODE[richting];
  const defaultGrootboekId =
    grootboekOpties.find((g) => g.code === defaultCode)?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {kop}
        <ExportKnoppen
          report="transacties"
          jaar={boekjaar.jaar}
          richting={richting}
        />
      </div>
      <TransactieRegister
        richting={richting}
        boekjaarJaar={boekjaar.jaar}
        gesloten={boekjaar.status === "gesloten"}
        transacties={rijen}
        relaties={relatieOpties}
        grootboek={grootboekOpties}
        defaultGrootboekId={defaultGrootboekId}
      />
    </div>
  );
}
