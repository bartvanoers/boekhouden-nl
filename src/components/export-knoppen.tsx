import { Button } from "@/components/ui/button";
import type { Richting } from "@/db/schema";
import type { RapportNaam } from "@/lib/export/reports";

/**
 * Exportknoppen (CSV + Excel) die naar de route handler
 * `/api/export/[report]` linken. De download wordt door de
 * `Content-Disposition: attachment`-header afgedwongen.
 */
export function ExportKnoppen({
  report,
  jaar,
  richting,
  label,
}: {
  report: RapportNaam;
  jaar: number;
  richting?: Richting;
  label?: string;
}) {
  const params = new URLSearchParams({ jaar: String(jaar) });
  if (richting) params.set("richting", richting);
  const basis = `/api/export/${report}?${params.toString()}`;

  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="text-sm text-muted-foreground">{label}</span>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <a href={`${basis}&formaat=csv`} download>
          CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`${basis}&formaat=xlsx`} download>
          Excel
        </a>
      </Button>
    </div>
  );
}
