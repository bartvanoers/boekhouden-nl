import { getIronSession, type SessionOptions } from "iron-session";

/**
 * Sessiebeheer met iron-session: de sessie-inhoud staat versleuteld in een
 * cookie, er is geen sessietabel in de database. De cookie is `HttpOnly`,
 * `SameSite=Lax` en `Secure` buiten development.
 *
 * `SESSION_SECRET` is verplicht en moet minstens 32 tekens lang zijn. In
 * productie gooit de applicatie een duidelijke fout bij ontbreken; in
 * development valt de app terug op een onveilige sleutel met een waarschuwing.
 */
export type SessionData = {
  loggedIn: boolean;
};

/** Naam van de sessiecookie. */
export const SESSION_COOKIE = "boekhouden_session";

/** Onveilige fallbacksleutel, uitsluitend voor development. */
const DEV_FALLBACK_SECRET =
  "boekhouden-dev-onveilige-sessiesleutel-vervang-in-productie";

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET ontbreekt of is te kort. Zet een geheime sleutel van " +
        "minstens 32 tekens in de omgeving voordat je de applicatie start.",
    );
  }

  if (secret && secret.length < 32) {
    console.warn(
      "[auth] SESSION_SECRET is korter dan 32 tekens; dev-fallback wordt " +
        "gebruikt. Zet een langere sleutel voor productie.",
    );
  } else {
    console.warn(
      "[auth] SESSION_SECRET niet gezet; onveilige dev-fallback wordt " +
        "gebruikt. Zet SESSION_SECRET voor productie.",
    );
  }

  return DEV_FALLBACK_SECRET;
}

/**
 * Bouwt de iron-session-opties. De sessiesleutel wordt hier **lazy** opgelost:
 * pas wanneer daadwerkelijk een sessie gelezen/geschreven wordt, niet al bij
 * het importeren van deze module. Zo faalt `next build` (dat met
 * `NODE_ENV=production` draait maar geen `SESSION_SECRET` nodig heeft voor het
 * verzamelen van pagina-data) niet op een ontbrekende sleutel.
 */
export function getSessionOptions(): SessionOptions {
  return {
    password: resolveSecret(),
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

/**
 * Leest de sessie uit de request-cookies. Bruikbaar in server actions, RSC en
 * route handlers (alles wat `next/headers` mag gebruiken).
 */
export async function getSession() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

/**
 * Vereist een geldige sessie. Redirect naar `/login` wanneer de gebruiker niet
 * is ingelogd. Roep dit aan het begin van elke mutatie-action en beschermde
 * RSC/route handler aan (defense in depth naast de middleware).
 */
export async function requireSession() {
  const session = await getSession();
  if (!session.loggedIn) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session;
}
