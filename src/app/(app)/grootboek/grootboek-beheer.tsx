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
import { RijActies } from "@/components/rij-acties";
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
import {
  maakGrootboek,
  verwijderGrootboek,
  wijzigGrootboek,
  zetGrootboekActief,
} from "@/actions/grootboek";
import {
  GROOTBOEK_TYPE_LABELS,
  NIEUW_GROOTBOEK_TYPES,
} from "@/lib/schemas/grootboek";
import type { Grootboekrekening } from "@/db/schema";

type DialogState =
  | { modus: "dicht" }
  | { modus: "nieuw" }
  | { modus: "bewerk"; rekening: Grootboekrekening }
  | { modus: "verwijder"; rekening: Grootboekrekening };

export function GrootboekBeheer({
  rekeningen,
}: {
  rekeningen: Grootboekrekening[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ modus: "dicht" });
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"balans" | "winst_verlies">("balans");
  const [actief, setActief] = useState(true);
  const [pending, start] = useTransition();

  function sluit() {
    setDialog({ modus: "dicht" });
    setError(null);
  }

  const bewerkRekening = dialog.modus === "bewerk" ? dialog.rekening : null;
  const isSysteem = bewerkRekening?.isSysteem ?? false;

  function openNieuw() {
    setType("balans");
    setActief(true);
    setError(null);
    setDialog({ modus: "nieuw" });
  }

  function openBewerk(rekening: Grootboekrekening) {
    setType(rekening.type === "winst_verlies" ? "winst_verlies" : "balans");
    setActief(rekening.actief);
    setError(null);
    setDialog({ modus: "bewerk", rekening });
  }

  function onFormulier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res =
        dialog.modus === "bewerk"
          ? await wijzigGrootboek(dialog.rekening.id, formData)
          : await maakGrootboek(formData);
      if (res.ok) {
        sluit();
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function toggleActief(rekening: Grootboekrekening) {
    setError(null);
    start(async () => {
      const res = await zetGrootboekActief(rekening.id, !rekening.actief);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  function bevestigVerwijderen() {
    if (dialog.modus !== "verwijder") return;
    const id = dialog.rekening.id;
    setError(null);
    start(async () => {
      const res = await verwijderGrootboek(id);
      if (res.ok) {
        sluit();
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNieuw}>Nieuwe rekening</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rekeningen.map((r) => (
              <TableRow key={r.id} className={r.actief ? "" : "opacity-60"}>
                <TableCell className="font-mono text-muted-foreground">
                  {r.code}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {r.naam}
                    {r.isSysteem ? (
                      <Badge variant="outline">Systeem</Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>{GROOTBOEK_TYPE_LABELS[r.type]}</TableCell>
                <TableCell>
                  {r.actief ? (
                    <Badge variant="secondary">Actief</Badge>
                  ) : (
                    <Badge variant="muted">Inactief</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <RijActies
                    acties={[
                      {
                        label: "Bewerken",
                        onSelect: () => openBewerk(r),
                      },
                      ...(r.isSysteem
                        ? []
                        : [
                            {
                              label: r.actief ? "Deactiveren" : "Heractiveren",
                              disabled: pending,
                              onSelect: () => toggleActief(r),
                            },
                            {
                              label: "Verwijderen",
                              destructief: true,
                              onSelect: () =>
                                setDialog({ modus: "verwijder", rekening: r }),
                            },
                          ]),
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
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
              {dialog.modus === "bewerk"
                ? "Rekening bewerken"
                : "Nieuwe rekening"}
            </DialogTitle>
            <DialogDescription>
              {isSysteem
                ? "Dit is een systeemrekening. Alleen de naam kan worden aangepast."
                : "Code bestaat uit cijfers (leidende nullen toegestaan) en is uniek."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onFormulier} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                required={!isSysteem}
                disabled={isSysteem}
                defaultValue={bewerkRekening?.code ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="naam">Naam</Label>
              <Input
                id="naam"
                name="naam"
                required
                defaultValue={bewerkRekening?.naam ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              {isSysteem ? (
                <Input
                  id="type"
                  disabled
                  value={GROOTBOEK_TYPE_LABELS[bewerkRekening!.type]}
                  readOnly
                />
              ) : (
                <>
                  <input type="hidden" name="type" value={type} />
                  <Select
                    value={type}
                    onValueChange={(v) =>
                      setType(v as "balans" | "winst_verlies")
                    }
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NIEUW_GROOTBOEK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {GROOTBOEK_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {dialog.modus === "bewerk" && !isSysteem ? (
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
            <DialogTitle>Rekening verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je{" "}
              <span className="font-medium text-foreground">
                {dialog.modus === "verwijder"
                  ? `${dialog.rekening.code} ${dialog.rekening.naam}`
                  : ""}
              </span>{" "}
              wilt verwijderen? Rekeningen met transacties of beginbalansregels
              kunnen alleen worden gedeactiveerd.
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
