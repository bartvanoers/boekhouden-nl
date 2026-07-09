import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Over",
};

export default function OverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Over</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Over deze applicatie.
        </p>
      </div>

      <div className="max-w-prose space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Dit is een self-hosted boekhoudpakket voor één administratie. Je boekt
          er je verkopen en inkopen in, beheert relaties (klanten en
          leveranciers) en het grootboek, en houdt zo je hele administratie op
          één plek bij.
        </p>
        <p>
          Voor de aangifte biedt de app een btw-overzicht per periode, een
          winst-en-verliesrekening en een balans. Bij de jaarafsluiting sluit je
          het boekjaar en worden de eindsaldi automatisch als beginbalans naar
          het volgende jaar overgedragen. Overzichten exporteer je naar CSV of
          Excel.
        </p>
        <p>
          De applicatie is open source en beschikbaar onder de{" "}
          <a
            href="https://github.com/bartvanoers/boekhouden-nl"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            AGPL-3.0-licentie op GitHub
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Steun de maker
          </CardTitle>
          <CardDescription>
            Vind je de app handig? Trakteer me op een koffie via Ko-fi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a
              href="https://ko-fi.com/bartvanoers"
              target="_blank"
              rel="noopener noreferrer"
            >
              Koffie via Ko-fi
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
