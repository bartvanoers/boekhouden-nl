"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav, type NavItem } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Mobiele navigatie: hamburger-knop die een slide-in drawer aan de linkerkant
 * opent. Spiegelt de compositie van de desktop-zijbalk uit de app-layout.
 */
export function MobileNav({
  items,
  overItems,
  bedrijfsnaam,
  version,
  boekjaarSwitcher,
  children,
}: {
  items: NavItem[];
  overItems: NavItem[];
  bedrijfsnaam: string;
  version: string;
  boekjaarSwitcher?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Sluit de drawer zodra er naar een andere route wordt genavigeerd.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu />
          <span className="sr-only">Menu openen</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 overflow-y-auto px-3 py-5">
        <SheetHeader className="px-3 pr-8">
          <SheetTitle>{bedrijfsnaam}</SheetTitle>
          <SheetDescription>Administratie</SheetDescription>
        </SheetHeader>
        {boekjaarSwitcher ? <div className="px-1">{boekjaarSwitcher}</div> : null}
        <AppNav items={items} />
        <div className="mt-auto pt-6">
          <AppNav items={overItems} />
          {children}
          <p className="px-3 pt-3 text-xs text-muted-foreground/70">
            v{version}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
