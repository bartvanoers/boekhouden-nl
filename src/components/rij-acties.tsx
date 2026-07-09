"use client";

import { Fragment } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Eén regel in het acties-menu van een tabelrij. */
export type RijActie = {
  label: string;
  onSelect: () => void;
  destructief?: boolean;
  disabled?: boolean;
};

/**
 * Gedeeld drie-puntjes-menu voor de rij-acties in de lijsttabellen (verkopen,
 * inkopen, relaties, grootboek). Rendert een ghost-icoonknop die een dropdown
 * opent met per actie een menu-item; een destructieve actie krijgt de
 * destructive-variant en wordt met een scheidingslijn losgetrokken van de
 * gewone acties. Met `disabled` wordt de hele trigger uitgeschakeld (bijv. bij
 * een gesloten boekjaar).
 */
export function RijActies({
  acties,
  disabled,
}: {
  acties: RijActie[];
  disabled?: boolean;
}) {
  const heeftGewoon = acties.some((a) => !a.destructief);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled}>
          <MoreHorizontal aria-hidden />
          <span className="sr-only">Acties</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {acties.map((actie, i) => (
          <Fragment key={actie.label}>
            {actie.destructief && heeftGewoon && i > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              onSelect={() => actie.onSelect()}
              disabled={actie.disabled}
              variant={actie.destructief ? "destructive" : undefined}
            >
              {actie.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
