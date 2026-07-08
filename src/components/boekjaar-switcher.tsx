"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { wisselBoekjaar } from "@/actions/boekjaren";
import type { Boekjaar } from "@/db/schema";

/**
 * Boekjaar-switcher in de app-shell. Toont alle boekjaren (jaar + status) en
 * wisselt het actieve jaar via de server action (die de cookie zet).
 */
export function BoekjaarSwitcher({
  boekjaren,
  actiefId,
}: {
  boekjaren: Boekjaar[];
  actiefId: number | null;
}) {
  const [pending, start] = useTransition();

  if (boekjaren.length === 0) {
    return null;
  }

  function onChange(value: string) {
    const id = Number(value);
    if (!Number.isFinite(id) || id === actiefId) {
      return;
    }
    start(async () => {
      await wisselBoekjaar(id);
    });
  }

  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-medium text-muted-foreground">Boekjaar</p>
      <Select
        value={actiefId != null ? String(actiefId) : undefined}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger className="w-full" aria-label="Boekjaar kiezen">
          <SelectValue placeholder="Kies boekjaar" />
        </SelectTrigger>
        <SelectContent>
          {boekjaren.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>
              {b.jaar}
              {b.status === "gesloten" ? " · gesloten" : " · open"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
