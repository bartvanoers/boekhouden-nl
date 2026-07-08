"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { maakBoekjaar, wijzigBtwPeriode } from "@/actions/boekjaren";
import { heropenBoekjaar, sluitBoekjaar } from "@/actions/jaarafsluiting";
import {
  BTW_PERIODES,
  BTW_PERIODE_LABELS,
} from "@/lib/schemas/instellingen";
import type { Boekjaar, BtwPeriode } from "@/db/schema";

export function BoekjarenBeheer({
  boekjaren,
  volgendJaar,
  standaardPeriode,
}: {
  boekjaren: Boekjaar[];
  volgendJaar: number;
  standaardPeriode: BtwPeriode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nieuwPeriode, setNieuwPeriode] = useState<BtwPeriode>(standaardPeriode);
  const [error, setError] = useState<string | null>(null);
  const [rijError, setRijError] = useState<string | null>(null);
  const [bevestig, setBevestig] = useState<
    | { modus: "afsluiten" | "heropenen"; boekjaar: Boekjaar }
    | null
  >(null);
  const [pending, start] = useTransition();

  function onNieuw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await maakBoekjaar(formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function onPeriode(boekjaar: Boekjaar, periode: BtwPeriode) {
    if (periode === boekjaar.btwPeriode) return;
    const formData = new FormData();
    formData.set("id", String(boekjaar.id));
    formData.set("btwPeriode", periode);
    setRijError(null);
    start(async () => {
      const res = await wijzigBtwPeriode(formData);
      if (res.ok) {
        router.refresh();
      } else {
        setRijError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function bevestigActie() {
    if (!bevestig) return;
    const id = bevestig.boekjaar.id;
    const actie = bevestig.modus;
    setRijError(null);
    start(async () => {
      const res =
        actie === "afsluiten"
          ? await sluitBoekjaar(id)
          : await heropenBoekjaar(id);
      if (res.ok) {
        setBevestig(null);
        router.refresh();
      } else {
        setRijError(res.error ?? "Er ging iets mis.");
        setBevestig(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Boekjaren</CardTitle>
        <CardDescription>
          Beheer je boekjaren en de btw-aangifteperiode. De btw-periode van een
          open boekjaar kun je aanpassen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setNieuwPeriode(standaardPeriode);
              setError(null);
              setOpen(true);
            }}
          >
            Nieuw boekjaar
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Jaar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Btw-periode</TableHead>
                <TableHead className="text-right">Jaarafsluiting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boekjaren.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.jaar}</TableCell>
                  <TableCell>
                    {b.status === "open" ? (
                      <Badge variant="secondary">Open</Badge>
                    ) : (
                      <Badge variant="muted">Gesloten</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {b.status === "open" ? (
                      <Select
                        value={b.btwPeriode}
                        onValueChange={(v) => onPeriode(b, v as BtwPeriode)}
                        disabled={pending}
                      >
                        <SelectTrigger className="w-44" aria-label="Btw-periode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BTW_PERIODES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {BTW_PERIODE_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">
                        {BTW_PERIODE_LABELS[b.btwPeriode]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {b.status === "open" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setBevestig({ modus: "afsluiten", boekjaar: b })
                        }
                      >
                        Afsluiten
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setBevestig({ modus: "heropenen", boekjaar: b })
                        }
                      >
                        Heropenen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {rijError ? (
          <p className="text-sm text-destructive" role="alert">
            {rijError}
          </p>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw boekjaar</DialogTitle>
            <DialogDescription>
              Kies het jaar en de btw-aangifteperiode.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onNieuw} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jaar">Jaar</Label>
              <Input
                id="jaar"
                name="jaar"
                type="number"
                inputMode="numeric"
                required
                defaultValue={volgendJaar}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="btwPeriode">Btw-periode</Label>
              <input type="hidden" name="btwPeriode" value={nieuwPeriode} />
              <Select
                value={nieuwPeriode}
                onValueChange={(v) => setNieuwPeriode(v as BtwPeriode)}
              >
                <SelectTrigger id="btwPeriode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BTW_PERIODES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {BTW_PERIODE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Bezig…" : "Aanmaken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Afsluiten / heropenen bevestigen */}
      <Dialog
        open={bevestig !== null}
        onOpenChange={(o) => (!o ? setBevestig(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bevestig?.modus === "afsluiten"
                ? `Boekjaar ${bevestig?.boekjaar.jaar} afsluiten`
                : `Boekjaar ${bevestig?.boekjaar.jaar} heropenen`}
            </DialogTitle>
            <DialogDescription>
              {bevestig?.modus === "afsluiten"
                ? `De eindbalans wordt berekend en overgedragen als beginbalans van ${
                    (bevestig?.boekjaar.jaar ?? 0) + 1
                  }, waarbij het resultaat in Beginkapitaal vloeit. Boekjaar ${bevestig?.boekjaar.jaar} wordt daarna alleen-lezen.`
                : `Boekjaar ${bevestig?.boekjaar.jaar} wordt weer bewerkbaar. Controleer daarna of de overdracht naar het volgende jaar nog klopt.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBevestig(null)}
            >
              Annuleren
            </Button>
            <Button type="button" disabled={pending} onClick={bevestigActie}>
              {pending
                ? "Bezig…"
                : bevestig?.modus === "afsluiten"
                  ? "Afsluiten"
                  : "Heropenen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
