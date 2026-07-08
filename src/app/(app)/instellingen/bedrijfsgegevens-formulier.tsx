"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bewaarBedrijfsgegevens } from "@/actions/instellingen";
import type { Settings } from "@/db/schema";

const VELDEN: {
  naam: keyof Settings;
  label: string;
  type?: string;
  verplicht?: boolean;
}[] = [
  { naam: "bedrijfsnaam", label: "Bedrijfsnaam", verplicht: true },
  { naam: "contactpersoon", label: "Contactpersoon" },
  { naam: "adres", label: "Adres" },
  { naam: "postcode", label: "Postcode" },
  { naam: "plaats", label: "Plaats" },
  { naam: "telefoon", label: "Telefoon", type: "tel" },
  { naam: "email", label: "E-mail", type: "email" },
  { naam: "website", label: "Website" },
  { naam: "obNummer", label: "OB-nummer" },
  { naam: "kvkNummer", label: "KvK-nummer" },
  { naam: "iban", label: "IBAN" },
];

export function BedrijfsgegevensFormulier({
  settings,
}: {
  settings: Settings | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSucces(null);
    start(async () => {
      const res = await bewaarBedrijfsgegevens(formData);
      if (res.ok) {
        setSucces("Bedrijfsgegevens opgeslagen.");
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Bedrijfsgegevens</CardTitle>
        <CardDescription>
          Deze gegevens worden gebruikt in de app en op exports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {VELDEN.map((veld) => (
              <div key={veld.naam} className="space-y-2">
                <Label htmlFor={veld.naam}>{veld.label}</Label>
                <Input
                  id={veld.naam}
                  name={veld.naam}
                  type={veld.type ?? "text"}
                  required={veld.verplicht}
                  defaultValue={(settings?.[veld.naam] as string | null) ?? ""}
                />
              </div>
            ))}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {succes ? (
            <p
              className="text-sm text-emerald-600 dark:text-emerald-400"
              role="status"
            >
              {succes}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Bezig…" : "Opslaan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
