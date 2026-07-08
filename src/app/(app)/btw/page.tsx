import { db } from "@/db";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { berekenBtw, type BtwPeriodeRegel } from "@/lib/reports/btw";
import { BTW_PERIODE_LABELS } from "@/lib/schemas/instellingen";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function TeBetalen({ cents }: { cents: number }) {
  if (cents >= 0) {
    return <span className="tabular-nums">{formatEuro(cents)}</span>;
  }
  return (
    <span className="tabular-nums text-muted-foreground">
      {formatEuro(-cents)} terug
    </span>
  );
}

function Rij({ regel, sterk }: { regel: BtwPeriodeRegel; sterk?: boolean }) {
  return (
    <TableRow className={sterk ? "font-medium" : ""}>
      <TableCell>{regel.label}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.grondslag1aCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.btw1aCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.grondslag1bCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.btw1bCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.grondslag0Cents)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(regel.voorbelasting5bCents)}
      </TableCell>
      <TableCell className="text-right">
        <TeBetalen cents={regel.teBetalenCents} />
      </TableCell>
    </TableRow>
  );
}

export default async function BtwPage() {
  const boekjaar = await getActiefBoekjaar();

  const kop = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">BTW</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        BTW-overzicht per aangifteperiode met rubrieken en voorbelasting.
      </p>
    </div>
  );

  if (!boekjaar) {
    return (
      <div className="space-y-6">
        {kop}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Er is nog geen boekjaar. Maak eerst een boekjaar aan bij Instellingen.
        </p>
      </div>
    );
  }

  const btw = berekenBtw(db, boekjaar.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {kop}
        <ExportKnoppen report="btw" jaar={boekjaar.jaar} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Aangifte {boekjaar.jaar}
          </CardTitle>
          <CardDescription>
            Aangifteperiode: {BTW_PERIODE_LABELS[btw.periode].toLowerCase()}.
            Rubriek 1a = 21%, 1b = 9%, 0% = geen btw. 5b = voorbelasting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">1a grondslag</TableHead>
                  <TableHead className="text-right">1a btw</TableHead>
                  <TableHead className="text-right">1b grondslag</TableHead>
                  <TableHead className="text-right">1b btw</TableHead>
                  <TableHead className="text-right">0% grondslag</TableHead>
                  <TableHead className="text-right">5b voorbelasting</TableHead>
                  <TableHead className="text-right">Te betalen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {btw.regels.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nog geen btw-gegevens in dit boekjaar.
                    </TableCell>
                  </TableRow>
                ) : (
                  btw.regels.map((r) => <Rij key={r.key} regel={r} />)
                )}
                <Rij regel={btw.jaartotaal} sterk />
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
