"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  maakTransactie,
  verwijderTransactie,
  wijzigTransactie,
} from "@/actions/transacties";
import { vandaag } from "@/lib/dates";
import { berekenBtw, formatEuro, parseEuro } from "@/lib/money";
import {
  BTW_TARIEF_LABELS,
  SOORT_LABELS,
  STATUS_LABELS,
  STATUS_LABELS_KORT,
  filterTransacties,
} from "@/lib/schemas/transactie";
import type {
  BtwTarief,
  Richting,
  Soort,
  TransactieStatus,
} from "@/db/schema";

/** Rij zoals getoond in het register (transactie + gejoinde namen). */
export type TransactieRij = {
  id: number;
  datum: string;
  soort: Soort;
  factuurnummer: string | null;
  omschrijving: string | null;
  relatieId: number | null;
  relatieNaam: string | null;
  bedragExclCents: number;
  btwTarief: BtwTarief;
  btwCents: number;
  status: TransactieStatus;
  grootboekId: number;
  grootboekCode: string | null;
  grootboekNaam: string | null;
};

export type RelatieOptie = { id: number; nr: number; naam: string; actief: boolean };
export type GrootboekOptie = {
  id: number;
  code: string;
  naam: string;
  actief: boolean;
};

type Props = {
  richting: Richting;
  boekjaarJaar: number;
  gesloten: boolean;
  transacties: TransactieRij[];
  relaties: RelatieOptie[];
  grootboek: GrootboekOptie[];
  defaultGrootboekId: number | null;
};

type DialogState =
  | { modus: "dicht" }
  | { modus: "nieuw" }
  | { modus: "bewerk"; rij: TransactieRij }
  | { modus: "verwijder"; rij: TransactieRij };

const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/** Formatteert centen naar een bewerkbare nl-invoer zonder euroteken ("21,00"). */
function centenNaarInvoer(cents: number): string {
  return formatEuro(cents).replace(/€/g, "").replace(/\s/g, "").trim();
}

export function TransactieRegister({
  richting,
  boekjaarJaar,
  gesloten,
  transacties,
  relaties,
  grootboek,
  defaultGrootboekId,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ modus: "dicht" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [periode, setPeriode] = useState("alle");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [relatieFilter, setRelatieFilter] = useState("alle");

  const zichtbaar = useMemo(
    () =>
      filterTransacties(transacties, {
        periode,
        status: statusFilter,
        relatie: relatieFilter,
      }),
    [transacties, periode, statusFilter, relatieFilter],
  );

  const totalen = useMemo(() => {
    let excl = 0;
    let btw = 0;
    for (const r of zichtbaar) {
      excl += r.bedragExclCents;
      btw += r.btwCents;
    }
    return { excl, btw, incl: excl + btw };
  }, [zichtbaar]);

  function sluit() {
    setDialog({ modus: "dicht" });
    setError(null);
  }

  function bevestigVerwijderen() {
    if (dialog.modus !== "verwijder") return;
    const id = dialog.rij.id;
    setError(null);
    start(async () => {
      const res = await verwijderTransactie(id);
      if (res.ok) {
        sluit();
        router.refresh();
      } else {
        setError(res.error ?? "Er ging iets mis.");
      }
    });
  }

  const titel = richting === "verkoop" ? "verkoop" : "inkoop";
  const meervoud = richting === "verkoop" ? "verkopen" : "inkopen";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Periode</Label>
            <Select value={periode} onValueChange={setPeriode}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Hele jaar</SelectItem>
                <SelectGroup>
                  <SelectLabel>Kwartaal</SelectLabel>
                  {[1, 2, 3, 4].map((k) => (
                    <SelectItem key={`k${k}`} value={`k${k}`}>
                      {k}e kwartaal
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Maand</SelectLabel>
                  {MAANDEN.map((naam, i) => (
                    <SelectItem key={`m${i + 1}`} value={`m${i + 1}`}>
                      {naam}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle statussen</SelectItem>
                <SelectItem value="bank">{STATUS_LABELS.bank}</SelectItem>
                <SelectItem value="kas">{STATUS_LABELS.kas}</SelectItem>
                <SelectItem value="openstaand">
                  {STATUS_LABELS.openstaand}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Relatie</Label>
            <Select value={relatieFilter} onValueChange={setRelatieFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle relaties</SelectItem>
                <SelectItem value="geen">Zonder relatie</SelectItem>
                {relaties.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          disabled={gesloten}
          onClick={() => {
            setError(null);
            setDialog({ modus: "nieuw" });
          }}
        >
          Nieuwe {titel}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Datum</TableHead>
              <TableHead>Soort</TableHead>
              <TableHead>Factuurnr.</TableHead>
              <TableHead>Omschrijving</TableHead>
              <TableHead>Relatie</TableHead>
              <TableHead className="text-right">Excl.</TableHead>
              <TableHead className="text-right">Btw</TableHead>
              <TableHead className="text-right">Incl.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Categorie</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zichtbaar.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="py-8 text-center text-muted-foreground"
                >
                  {transacties.length === 0
                    ? `Nog geen ${meervoud} in dit boekjaar.`
                    : "Geen transacties die aan de filters voldoen."}
                </TableCell>
              </TableRow>
            ) : (
              zichtbaar.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDatum(r.datum)}
                  </TableCell>
                  <TableCell>{SOORT_LABELS[r.soort]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.factuurnummer ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.omschrijving ?? "—"}
                  </TableCell>
                  <TableCell>{r.relatieNaam ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatEuro(r.bedragExclCents)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatEuro(r.btwCents)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatEuro(r.bedragExclCents + r.btwCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.grootboekCode ? (
                      <span className="font-mono">{r.grootboekCode}</span>
                    ) : null}{" "}
                    {r.grootboekNaam ?? "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={gesloten}
                      onClick={() => {
                        setError(null);
                        setDialog({ modus: "bewerk", rij: r });
                      }}
                    >
                      Bewerken
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={gesloten}
                      onClick={() => {
                        setError(null);
                        setDialog({ modus: "verwijder", rij: r });
                      }}
                    >
                      Verwijderen
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {zichtbaar.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-medium">
                  Totaal ({zichtbaar.length})
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuro(totalen.excl)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuro(totalen.btw)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuro(totalen.incl)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          ) : null}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.modus === "bewerk"
                ? `${titel[0].toUpperCase()}${titel.slice(1)} bewerken`
                : `Nieuwe ${titel}`}
            </DialogTitle>
            <DialogDescription>
              De datum moet binnen boekjaar {boekjaarJaar} vallen. Het btw-bedrag
              wordt live berekend maar is handmatig aan te passen.
            </DialogDescription>
          </DialogHeader>

          {dialog.modus === "nieuw" || dialog.modus === "bewerk" ? (
            <TransactieFormulier
              key={
                dialog.modus === "bewerk" ? `bewerk-${dialog.rij.id}` : "nieuw"
              }
              richting={richting}
              boekjaarJaar={boekjaarJaar}
              relaties={relaties}
              grootboek={grootboek}
              defaultGrootboekId={defaultGrootboekId}
              rij={dialog.modus === "bewerk" ? dialog.rij : null}
              pending={pending}
              onAnnuleer={sluit}
              onOpslaan={(formData) => {
                setError(null);
                start(async () => {
                  const res =
                    dialog.modus === "bewerk"
                      ? await wijzigTransactie(dialog.rij.id, formData)
                      : await maakTransactie(formData);
                  if (res.ok) {
                    sluit();
                    router.refresh();
                  } else {
                    setError(res.error ?? "Er ging iets mis.");
                  }
                });
              }}
              error={error}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Verwijderen bevestigen */}
      <Dialog
        open={dialog.modus === "verwijder"}
        onOpenChange={(open) => (!open ? sluit() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transactie verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je deze transactie
              {dialog.modus === "verwijder" && dialog.rij.omschrijving ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {dialog.rij.omschrijving}
                  </span>
                </>
              ) : null}{" "}
              wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
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

function StatusBadge({ status }: { status: TransactieStatus }) {
  if (status === "openstaand") {
    return <Badge variant="outline">{STATUS_LABELS_KORT.openstaand}</Badge>;
  }
  return <Badge variant="secondary">{STATUS_LABELS_KORT[status]}</Badge>;
}

/** Korte datumweergave (dd-mm) — het jaar is impliciet het boekjaar. */
function formatDatum(datum: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!m) return datum;
  return `${m[3]}-${m[2]}`;
}

type FormulierProps = {
  richting: Richting;
  boekjaarJaar: number;
  relaties: RelatieOptie[];
  grootboek: GrootboekOptie[];
  defaultGrootboekId: number | null;
  rij: TransactieRij | null;
  pending: boolean;
  error: string | null;
  onAnnuleer: () => void;
  onOpslaan: (formData: FormData) => void;
};

function TransactieFormulier({
  richting,
  boekjaarJaar,
  relaties,
  grootboek,
  defaultGrootboekId,
  rij,
  pending,
  error,
  onAnnuleer,
  onOpslaan,
}: FormulierProps) {
  const standaardDatum =
    vandaag().slice(0, 4) === String(boekjaarJaar)
      ? vandaag()
      : `${boekjaarJaar}-01-01`;

  const [datum, setDatum] = useState(rij?.datum ?? standaardDatum);
  const [soort, setSoort] = useState<Soort>(rij?.soort ?? "factuur");
  const [factuurnummer, setFactuurnummer] = useState(rij?.factuurnummer ?? "");
  const [omschrijving, setOmschrijving] = useState(rij?.omschrijving ?? "");
  const [relatieId, setRelatieId] = useState<string>(
    rij?.relatieId != null ? String(rij.relatieId) : "geen",
  );
  const [exclInput, setExclInput] = useState(
    rij ? centenNaarInvoer(rij.bedragExclCents) : "",
  );
  const [btwTarief, setBtwTarief] = useState<BtwTarief>(rij?.btwTarief ?? "hoog");
  const [btwInput, setBtwInput] = useState(
    rij ? centenNaarInvoer(rij.btwCents) : "",
  );
  // Btw is handmatig wanneer het opgeslagen bedrag afwijkt van de berekening.
  const [btwManual, setBtwManual] = useState(
    rij ? rij.btwCents !== berekenBtw(rij.bedragExclCents, rij.btwTarief) : false,
  );
  const [status, setStatus] = useState<TransactieStatus>(rij?.status ?? "bank");
  const [grootboekId, setGrootboekId] = useState<string>(
    rij?.grootboekId != null
      ? String(rij.grootboekId)
      : defaultGrootboekId != null
        ? String(defaultGrootboekId)
        : "",
  );

  // Live btw-berekening zolang de gebruiker het bedrag niet zelf overschrijft.
  useEffect(() => {
    if (btwManual) return;
    const excl = parseEuro(exclInput);
    if (excl === null) {
      setBtwInput("");
      return;
    }
    setBtwInput(centenNaarInvoer(berekenBtw(excl, btwTarief)));
  }, [exclInput, btwTarief, btwManual]);

  const exclCents = parseEuro(exclInput);
  const btwCents = parseEuro(btwInput);
  const inclWeergave =
    exclCents !== null
      ? formatEuro(exclCents + (btwCents ?? 0))
      : "—";

  // Relaties voor het formulier: actieve relaties + de huidige (evt. inactieve).
  const formRelaties = useMemo(() => {
    const actief = relaties.filter((r) => r.actief);
    if (
      rij?.relatieId != null &&
      !actief.some((r) => r.id === rij.relatieId)
    ) {
      const huidig = relaties.find((r) => r.id === rij.relatieId);
      if (huidig) return [huidig, ...actief];
    }
    return actief;
  }, [relaties, rij]);

  const formGrootboek = useMemo(() => {
    const actief = grootboek.filter((g) => g.actief);
    if (
      rij?.grootboekId != null &&
      !actief.some((g) => g.id === rij.grootboekId)
    ) {
      const huidig = grootboek.find((g) => g.id === rij.grootboekId);
      if (huidig) return [huidig, ...actief];
    }
    return actief;
  }, [grootboek, rij]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("richting", richting);
    fd.set("datum", datum);
    fd.set("soort", soort);
    fd.set("factuurnummer", factuurnummer);
    fd.set("omschrijving", omschrijving);
    fd.set("relatieId", relatieId);
    fd.set("bedragExcl", exclInput);
    fd.set("btwTarief", btwTarief);
    fd.set("btwBedrag", btwInput);
    fd.set("status", status);
    fd.set("grootboekId", grootboekId);
    onOpslaan(fd);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="datum">Datum</Label>
          <Input
            id="datum"
            type="date"
            required
            min={`${boekjaarJaar}-01-01`}
            max={`${boekjaarJaar}-12-31`}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="soort">Soort</Label>
          <Select value={soort} onValueChange={(v) => setSoort(v as Soort)}>
            <SelectTrigger id="soort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["factuur", "bonnetje", "overig"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="omschrijving">Omschrijving</Label>
        <Input
          id="omschrijving"
          required
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="factuurnummer">Factuurnummer</Label>
          <Input
            id="factuurnummer"
            value={factuurnummer}
            onChange={(e) => setFactuurnummer(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="relatie">Relatie</Label>
          <Select value={relatieId} onValueChange={setRelatieId}>
            <SelectTrigger id="relatie" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geen">Geen relatie</SelectItem>
              {formRelaties.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bedragExcl">Bedrag excl.</Label>
          <Input
            id="bedragExcl"
            inputMode="decimal"
            placeholder="0,00"
            value={exclInput}
            onChange={(e) => setExclInput(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="btwTarief">Btw-tarief</Label>
          <Select
            value={btwTarief}
            onValueChange={(v) => setBtwTarief(v as BtwTarief)}
          >
            <SelectTrigger id="btwTarief" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["hoog", "laag", "geen"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {BTW_TARIEF_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="btwBedrag">Btw-bedrag</Label>
          <Input
            id="btwBedrag"
            inputMode="decimal"
            placeholder="0,00"
            value={btwInput}
            onChange={(e) => {
              setBtwManual(true);
              setBtwInput(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Bedrag inclusief btw</span>
        <span className="font-medium tabular-nums">{inclWeergave}</span>
      </div>
      {btwManual ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setBtwManual(false)}
        >
          Btw opnieuw berekenen
        </button>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as TransactieStatus)}
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["bank", "kas", "openstaand"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="categorie">Categorie</Label>
        <Select value={grootboekId} onValueChange={setGrootboekId}>
          <SelectTrigger id="categorie" className="w-full">
            <SelectValue placeholder="Kies een categorie" />
          </SelectTrigger>
          <SelectContent>
            {formGrootboek.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                <span className="font-mono">{g.code}</span> {g.naam}
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
        <Button type="button" variant="outline" onClick={onAnnuleer}>
          Annuleren
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Opslaan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
