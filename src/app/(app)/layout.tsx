import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";

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

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Boekhouden
          </Link>
          <p className="text-xs text-muted-foreground">Administratie</p>
        </div>
        <AppNav items={NAV_ITEMS} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b bg-card px-6 md:hidden">
          <Link href="/" className="text-base font-semibold">
            Boekhouden
          </Link>
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
