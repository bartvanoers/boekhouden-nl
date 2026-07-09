import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";
import { BoekjaarSwitcher } from "@/components/boekjaar-switcher";
import { LogoutButton } from "@/components/logout-button";
import { db } from "@/db";
import { boekjaren } from "@/db/schema";
import { getActiefBoekjaar } from "@/lib/boekjaar";
import { getBedrijfsnaam } from "@/lib/settings";

// De app-shell leest bedrijfsnaam en boekjaren uit de database (en de
// cookie), dus deze routes worden altijd dynamisch gerenderd.
export const dynamic = "force-dynamic";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/verkopen", label: "Verkopen" },
  { href: "/inkopen", label: "Inkopen" },
  { href: "/relaties", label: "Relaties" },
  { href: "/grootboek", label: "Grootboek" },
  { href: "/beginbalans", label: "Beginbalans" },
  { href: "/btw", label: "BTW" },
  { href: "/instellingen", label: "Instellingen" },
];

const OVER_NAV_ITEMS: NavItem[] = [{ href: "/over", label: "Over" }];

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
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <Link
            href="/"
            className="line-clamp-2 text-lg font-semibold tracking-tight"
          >
            {bedrijfsnaam}
          </Link>
          <p className="text-xs text-muted-foreground">Administratie</p>
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-6 md:hidden">
          <Link href="/" className="line-clamp-1 text-base font-semibold">
            {bedrijfsnaam}
          </Link>
        </header>

        {actief?.status === "gesloten" ? (
          <div
            role="status"
            className="border-b border-yellow-300 bg-yellow-50 px-6 py-2.5 text-sm text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-300"
          >
            Boekjaar {actief.jaar} is gesloten — alleen-lezen.
          </div>
        ) : null}

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
