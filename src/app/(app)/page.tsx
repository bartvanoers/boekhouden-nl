import Link from "next/link";
import { db } from "@/db";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { berekenDashboard, type RichtingTotaal } from "@/lib/reports/dashboard";
import { formatEuro } from "@/lib/money";
import { ExportKnoppen } from "@/components/export-knoppen";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function Bedrag({ cents, sterk }: { cents: number; sterk?: boolean }) {
  return (
    <span
      className={`tabular-nums ${sterk ? "font-medium text-foreground" : ""}`}
    >
      {formatEuro(cents)}
    </span>
  );
}

function TotaalKaart({
  titel,
  totaal,
}: {
  titel: string;
  totaal: RichtingTotaal;
}) {
  const regels: [string, number][] = [
    ["Totaal incl. btw", totaal.totaalInclCents],
    ["Waarvan btw", totaal.btwCents],
    ["Betaald", totaal.betaaldInclCents],
    ["Openstaand", totaal.openstaandInclCents],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{titel}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1.5 text-sm">
          {regels.map(([label, cents], i) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                <Bedrag cents={cents} sterk={i === 0} />
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const boekjaar = await getActiefBoekjaar();

  const kop = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Financieel overzicht van je administratie.
      </p>
    </div>
  );

  if (!boekjaar) {
    return (
      <div className="space-y-6">
        {kop}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Er is nog geen boekjaar. Maak eerst een boekjaar aan bij{" "}
          <Link href="/instellingen" className="underline">
            Instellingen
          </Link>
          .
        </p>
      </div>
    );
  }

  const data = berekenDashboard(db, boekjaar.id);
  const { wv, balans, btw } = data;
  const btwStand = btw.jaartotaal.teBetalenCents;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        {kop}
        <span className="text-sm text-muted-foreground">
          Boekjaar {boekjaar.jaar}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TotaalKaart titel="Verkopen" totaal={data.verkoop} />
        <TotaalKaart titel="Inkopen" totaal={data.inkoop} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Winst & Verlies */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-medium">
                  Winst &amp; Verlies
                </CardTitle>
                <CardDescription>
                  Opbrengsten en kosten dit boekjaar.
                </CardDescription>
              </div>
              <ExportKnoppen report="wv" jaar={boekjaar.jaar} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium" colSpan={2}>
                    Opbrengsten
                  </TableCell>
                </TableRow>
                {wv.opbrengsten.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="pl-6 text-muted-foreground">
                      {r.code} {r.naam}
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag cents={r.bedragCents} />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium" colSpan={2}>
                    Kosten
                  </TableCell>
                </TableRow>
                {wv.kosten.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="pl-6 text-muted-foreground">
                      {r.code} {r.naam}
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag cents={r.bedragCents} />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-semibold">Resultaat</TableCell>
                  <TableCell className="text-right">
                    <Bedrag cents={wv.resultaatCents} sterk />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Balans */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-medium">Balans</CardTitle>
                <CardDescription>
                  {balans.sluit
                    ? "Activa is gelijk aan passiva."
                    : "Let op: de balans sluit niet."}
                </CardDescription>
              </div>
              <ExportKnoppen report="balans" jaar={boekjaar.jaar} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="flex flex-col">
                <p className="mb-1 font-medium">Activa</p>
                <dl className="flex flex-1 flex-col gap-1">
                  {balans.activa.map((r) => (
                    <div key={r.code} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{r.naam}</dt>
                      <dd>
                        <Bedrag cents={r.bedragCents} />
                      </dd>
                    </div>
                  ))}
                  <div className="mt-auto flex justify-between gap-2 border-t pt-1 font-semibold">
                    <dt>Totaal</dt>
                    <dd>
                      <Bedrag cents={balans.activaTotaalCents} sterk />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-col">
                <p className="mb-1 font-medium">Passiva</p>
                <dl className="flex flex-1 flex-col gap-1">
                  {balans.passiva.map((r) => (
                    <div key={r.code} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{r.naam}</dt>
                      <dd>
                        <Bedrag cents={r.bedragCents} />
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      Resultaat boekjaar
                    </dt>
                    <dd>
                      <Bedrag cents={balans.resultaatCents} />
                    </dd>
                  </div>
                  <div className="mt-auto flex justify-between gap-2 border-t pt-1 font-semibold">
                    <dt>Totaal</dt>
                    <dd>
                      <Bedrag cents={balans.passivaTotaalCents} sterk />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BTW-stand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">BTW-stand</CardTitle>
          <CardDescription>Saldo btw dit boekjaar (jaartotaal).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {btwStand >= 0 ? "Te betalen aan Belastingdienst" : "Terug te vragen"}
            </span>
            <Bedrag cents={Math.abs(btwStand)} sterk />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
