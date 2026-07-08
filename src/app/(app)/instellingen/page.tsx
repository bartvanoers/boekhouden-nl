import { desc } from "drizzle-orm";
import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { volgendBoekjaar } from "@/lib/boekjaar";
import { BedrijfsgegevensFormulier } from "./bedrijfsgegevens-formulier";
import { BoekjarenBeheer } from "./boekjaren-beheer";
import { WachtwoordFormulier } from "./wachtwoord-formulier";

export default function InstellingenPage() {
  const settings = getSettings();
  const alleBoekjaren = db
    .select()
    .from(boekjaren)
    .orderBy(desc(boekjaren.jaar))
    .all();

  const volgendJaar = volgendBoekjaar(alleBoekjaren.map((b) => b.jaar));
  // Default btw-periode voor een nieuw boekjaar = die van het laatste jaar.
  const standaardPeriode = alleBoekjaren[0]?.btwPeriode ?? "kwartaal";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bedrijfsgegevens, boekjaren en btw-aangifteperiode.
        </p>
      </div>

      <BedrijfsgegevensFormulier settings={settings} />
      <BoekjarenBeheer
        boekjaren={alleBoekjaren}
        volgendJaar={volgendJaar}
        standaardPeriode={standaardPeriode}
      />
      <WachtwoordFormulier />
    </div>
  );
}
