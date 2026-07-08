"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  maakRelatie,
  verwijderRelatie,
  wijzigRelatie,
  zetRelatieActief,
} from "@/actions/relaties";
import type { Relatie } from "@/db/schema";

type DialogState =
  | { modus: "dicht" }
  | { modus: "nieuw" }
  | { modus: "bewerk"; relatie: Relatie }
  | { modus: "verwijder"; relatie: Relatie };

const VELDEN: { naam: keyof Relatie; label: string; type?: string }[] = [
  { naam: "adres", label: "Adres" },
  { naam: "postcode", label: "Postcode" },
  { naam: "plaats", label: "Plaats" },
  { naam: "telefoon", label: "Telefoon", type: "tel" },
  { naam: "email", label: "E-mail", type: "email" },
];

export function RelatiesBeheer({ relaties }: { relaties: Relatie[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ modus: "dicht" });
  const [error, setError] = useState<string | null>(null);
  const [actief, setActief] = useState(true);
  const [pending, start] = useTransition();

  function sluit() {
    setDialog({ modus: "dicht" });
    setError(null);
  }

  function onFormulier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res =
        dialog.modus === "bewerk"
          ? await wijzigRelatie(dialog.relatie.id, formData)
          : await maakRelatie(formData);
      if (res.ok) {
        sluit();
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function toggleActief(relatie: Relatie) {
    setError(null);
    start(async () => {
      const res = await zetRelatieActief(relatie.id, !relatie.actief);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function bevestigVerwijderen() {
    if (dialog.modus !== "verwijder") return;
    const id = dialog.relatie.id;
    setError(null);
    start(async () => {
      const res = await verwijderRelatie(id);
      if (res.ok) {
        sluit();
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  const bewerkRelatie = dialog.modus === "bewerk" ? dialog.relatie : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ modus: "nieuw" })}>
          Nieuwe relatie
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Nr</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Plaats</TableHead>
              <TableHead>Telefoon</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relaties.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nog geen relaties. Voeg je eerste relatie toe.
                </TableCell>
              </TableRow>
            ) : (
              relaties.map((r) => (
                <TableRow key={r.id} className={r.actief ? "" : "opacity-60"}>
                  <TableCell className="text-muted-foreground">{r.nr}</TableCell>
                  <TableCell className="font-medium">{r.naam}</TableCell>
                  <TableCell>{r.plaats ?? "—"}</TableCell>
                  <TableCell>{r.telefoon ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>
                    {r.actief ? (
                      <Badge variant="secondary">Actief</Badge>
                    ) : (
                      <Badge variant="muted">Inactief</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActief(r.actief);
                        setDialog({ modus: "bewerk", relatie: r });
                      }}
                    >
                      Bewerken
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleActief(r)}
                    >
                      {r.actief ? "Deactiveren" : "Heractiveren"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setDialog({ modus: "verwijder", relatie: r })
                      }
                    >
                      Verwijderen
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {error && dialog.modus === "dicht" ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {/* Aanmaken / bewerken */}
      <Dialog
        open={dialog.modus === "nieuw" || dialog.modus === "bewerk"}
        onOpenChange={(open) => (!open ? sluit() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.modus === "bewerk" ? "Relatie bewerken" : "Nieuwe relatie"}
            </DialogTitle>
            <DialogDescription>
              Naam is verplicht; de overige velden zijn optioneel. Het
              relatienummer wordt automatisch toegekend.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onFormulier} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="naam">Naam</Label>
              <Input
                id="naam"
                name="naam"
                required
                defaultValue={bewerkRelatie?.naam ?? ""}
              />
            </div>

            {VELDEN.map((veld) => (
              <div key={veld.naam} className="space-y-2">
                <Label htmlFor={veld.naam}>{veld.label}</Label>
                <Input
                  id={veld.naam}
                  name={veld.naam}
                  type={veld.type ?? "text"}
                  defaultValue={
                    (bewerkRelatie?.[veld.naam] as string | null) ?? ""
                  }
                />
              </div>
            ))}

            {dialog.modus === "bewerk" ? (
              <>
                <input
                  type="hidden"
                  name="actief"
                  value={actief ? "true" : "false"}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={actief}
                    onChange={(e) => setActief(e.target.checked)}
                    className="size-4"
                  />
                  Actief
                </label>
              </>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={sluit}>
                Annuleren
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Bezig…" : "Opslaan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Verwijderen bevestigen */}
      <Dialog
        open={dialog.modus === "verwijder"}
        onOpenChange={(open) => (!open ? sluit() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relatie verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je{" "}
              <span className="font-medium text-foreground">
                {dialog.modus === "verwijder" ? dialog.relatie.naam : ""}
              </span>{" "}
              wilt verwijderen? Dit kan niet ongedaan worden gemaakt. Relaties
              met transacties kunnen alleen worden gedeactiveerd.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={sluit}>
              Annuleren
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={bevestigVerwijderen}
            >
              {pending ? "Bezig…" : "Verwijderen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
