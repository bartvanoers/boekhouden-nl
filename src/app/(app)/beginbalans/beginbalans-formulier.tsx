"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slaBeginbalansOp } from "@/actions/beginbalans";
import { formatEuro, parseEuro } from "@/lib/money";

export type BeginbalansRegel = {
  id: number;
  code: string;
  naam: string;
  debet: string; // ingevoerde nl-tekst (activa)
  credit: string; // ingevoerde nl-tekst (passiva)
};

function centsVan(tekst: string): number {
  const s = tekst.trim();
  if (s === "") return 0;
  const c = parseEuro(s);
  return c != null && c > 0 ? c : 0;
}

export function BeginbalansFormulier({
  boekjaarJaar,
  gesloten,
  regels: initieel,
}: {
  boekjaarJaar: number;
  gesloten: boolean;
  regels: BeginbalansRegel[];
}) {
  const router = useRouter();
  const [regels, setRegels] = useState<BeginbalansRegel[]>(initieel);
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [pending, start] = useTransition();

  function zet(id: number, veld: "debet" | "credit", waarde: string) {
    setSucces(false);
    setRegels((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              // Debet en credit sluiten elkaar uit per rekening.
              debet: veld === "debet" ? waarde : "",
              credit: veld === "credit" ? waarde : "",
            }
          : r,
      ),
    );
  }

  const { activaCents, passivaCents, verschilCents } = useMemo(() => {
    let a = 0;
    let p = 0;
    for (const r of regels) {
      a += centsVan(r.debet);
      p += centsVan(r.credit);
    }
    return { activaCents: a, passivaCents: p, verschilCents: a - p };
  }, [regels]);

  const sluit = verschilCents === 0;

  function opslaan() {
    if (gesloten) return;
    const formData = new FormData();
    for (const r of regels) {
      formData.set(`debet_${r.id}`, r.debet.trim());
      formData.set(`credit_${r.id}`, r.credit.trim());
    }
    setError(null);
    setSucces(false);
    start(async () => {
      const res = await slaBeginbalansOp(formData);
      if (res.ok) {
        setSucces(true);
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Beginbalans {boekjaarJaar}
        </CardTitle>
        <CardDescription>
          Vul per balansrekening het beginsaldo in de kolom Activa (debet) of
          Passiva (credit). De balans sluit wanneer activa gelijk is aan passiva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Rekening</TableHead>
                <TableHead className="w-44 text-right">Activa (debet)</TableHead>
                <TableHead className="w-44 text-right">
                  Passiva (credit)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regels.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {r.code}
                  </TableCell>
                  <TableCell className="font-medium">{r.naam}</TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      className="text-right"
                      aria-label={`Activa ${r.naam}`}
                      disabled={gesloten}
                      value={r.debet}
                      onChange={(e) => zet(r.id, "debet", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      className="text-right"
                      aria-label={`Passiva ${r.naam}`}
                      disabled={gesloten}
                      value={r.credit}
                      onChange={(e) => zet(r.id, "credit", e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Totaal activa:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatEuro(activaCents)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Totaal passiva:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatEuro(passivaCents)}
            </span>
          </span>
        </div>

        {sluit ? (
          <div
            role="status"
            className="rounded-md border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
          >
            De balans sluit: activa is gelijk aan passiva.
          </div>
        ) : (
          <div
            role="alert"
            className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-300"
          >
            De balans sluit niet. Verschil (activa − passiva):{" "}
            <span className="font-medium tabular-nums">
              {formatEuro(verschilCents)}
            </span>
            .
          </div>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {succes ? (
          <p className="text-sm text-muted-foreground" role="status">
            Beginbalans opgeslagen.
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={opslaan} disabled={gesloten || pending}>
            {pending ? "Bezig…" : "Beginbalans opslaan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
