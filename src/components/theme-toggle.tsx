"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIES = [
  { waarde: "light", label: "Licht", icon: Sun },
  { waarde: "dark", label: "Donker", icon: Moon },
  { waarde: "system", label: "Systeem", icon: Monitor },
] as const;

/**
 * Thema-schakelaar in het klassieke shadcn "mode toggle"-ontwerp: een ronde
 * icoonknop (zon/maan wisselt mee met het thema) die een dropdown opent met de
 * standen licht / donker / systeem. Een mounted-check voorkomt een
 * hydration-mismatch, want op de server is het gekozen thema nog onbekend.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [gemount, setGemount] = useState(false);

  useEffect(() => {
    setGemount(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Thema wisselen</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIES.map(({ waarde, label, icon: Icon }) => {
          const actief = gemount && theme === waarde;
          return (
            <DropdownMenuItem key={waarde} onClick={() => setTheme(waarde)}>
              <Icon aria-hidden />
              {label}
              {actief ? <Check className="ml-auto" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
