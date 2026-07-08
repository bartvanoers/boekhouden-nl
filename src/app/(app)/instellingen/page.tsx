import { WachtwoordFormulier } from "./wachtwoord-formulier";

export default function InstellingenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bedrijfsgegevens, boekjaren en btw-aangifteperiode.
        </p>
      </div>

      <WachtwoordFormulier />
    </div>
  );
}
