import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";

/**
 * Middleware: alles vereist een sessie behalve de publieke routes hieronder en
 * de Next-assets (uitgesloten via de matcher). Ongeauthenticeerde requests
 * worden naar `/login` geredirect. Dit is de eerste verdedigingslaag; elke
 * mutatie-action controleert daarnaast zelf met `requireSession()`.
 */
const PUBLIEKE_PADEN = ["/login", "/setup", "/api/health"];

function isPubliek(pathname: string): boolean {
  return PUBLIEKE_PADEN.some(
    (pad) => pathname === pad || pathname.startsWith(`${pad}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPubliek(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(
    req,
    res,
    getSessionOptions(),
  );

  if (!session.loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Sla Next-assets en bestanden met een extensie over.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
