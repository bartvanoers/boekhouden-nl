import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PagePlaceholder({
  titel,
  omschrijving,
}: {
  titel: string;
  omschrijving?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
        {omschrijving ? (
          <p className="mt-1 text-sm text-muted-foreground">{omschrijving}</p>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{titel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nog niet geïmplementeerd</p>
        </CardContent>
      </Card>
    </div>
  );
}
