import {
  BookOpen,
  Info,
  LayoutDashboard,
  Percent,
  Scale,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import pkg from "../../../package.json";
import { AppNav, type NavItem } from "@/components/app-nav";
import { BoekjaarSwitcher } from "@/components/boekjaar-switcher";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { getBedrijfsnaam } from "@/lib/settings";

// De app-shell leest bedrijfsnaam en boekjaren uit de database (en de
// cookie), dus deze routes worden altijd dynamisch gerenderd.
export const dynamic = "force-dynamic";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard /> },
  { href: "/verkopen", label: "Verkopen", icon: <TrendingUp /> },
  { href: "/inkopen", label: "Inkopen", icon: <ShoppingCart /> },
  { href: "/relaties", label: "Relaties", icon: <Users /> },
  { href: "/grootboek", label: "Grootboek", icon: <BookOpen /> },
  { href: "/beginbalans", label: "Beginbalans", icon: <Scale /> },
  { href: "/btw", label: "BTW", icon: <Percent /> },
  { href: "/instellingen", label: "Instellingen", icon: <Settings /> },
];

const OVER_NAV_ITEMS: NavItem[] = [
  { href: "/over", label: "Over", icon: <Info /> },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bedrijfsnaam = getBedrijfsnaam();
  const alleBoekjaren = db.select().from(boekjaren).all();
  const actief = await getActiefBoekjaar();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-card px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo"
              width={578}
              height={649}
              priority
              className="h-8 w-auto shrink-0"
            />
            <span className="line-clamp-2 text-lg font-semibold tracking-tight">
              {bedrijfsnaam}
            </span>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Administratie</p>
        </div>
        <div className="px-1 pb-4">
          <BoekjaarSwitcher
            boekjaren={alleBoekjaren}
            actiefId={actief?.id ?? null}
          />
        </div>
        <AppNav items={NAV_ITEMS} />
        <div className="mt-auto pt-6">
          <AppNav items={OVER_NAV_ITEMS} />
          <LogoutButton />
          <p className="px-3 pt-3 text-xs text-muted-foreground/70">
            v{pkg.version}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <MobileNav
              items={NAV_ITEMS}
              overItems={OVER_NAV_ITEMS}
              bedrijfsnaam={bedrijfsnaam}
              version={pkg.version}
              boekjaarSwitcher={
                <BoekjaarSwitcher
                  boekjaren={alleBoekjaren}
                  actiefId={actief?.id ?? null}
                />
              }
            >
              <LogoutButton />
            </MobileNav>
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Logo"
                width={578}
                height={649}
                className="h-7 w-auto shrink-0"
              />
              <span className="line-clamp-1 text-base font-semibold">
                {bedrijfsnaam}
              </span>
            </Link>
          </div>
          <ThemeToggle />
        </header>

        <div className="sticky top-0 z-20 hidden justify-end border-b bg-background/85 px-6 py-3 backdrop-blur-sm md:flex">
          <ThemeToggle />
        </div>

        {actief?.status === "gesloten" ? (
          <div
            role="status"
            className="border-b border-yellow-300 bg-yellow-50 px-6 py-2.5 text-sm text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-300"
          >
            Boekjaar {actief.jaar} is gesloten — alleen-lezen.
          </div>
        ) : null}

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-[100rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
