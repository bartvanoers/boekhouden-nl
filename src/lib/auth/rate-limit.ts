/**
 * Eenvoudige in-memory rate limiter voor mislukte loginpogingen: maximaal 5
 * mislukte pogingen per 15 minuten per IP. State leeft in het procesgeheugen
 * (single-container, single-process) en verdwijnt bij herstart.
 */

/** Maximaal aantal mislukte pogingen binnen het venster. */
export const MAX_ATTEMPTS = 5;

/** Venster waarin de pogingen worden geteld (15 minuten). */
export const WINDOW_MS = 15 * 60 * 1000;

type Entry = { count: number; firstAt: number };

const store = new Map<string, Entry>();

export type RateLimitState = {
  /** Of een nieuwe poging is toegestaan. */
  allowed: boolean;
  /** Resterende tijd (ms) tot het venster verloopt wanneer geblokkeerd. */
  retryAfterMs: number;
};

/**
 * Controleert of een nieuwe loginpoging voor dit IP is toegestaan. Verlopen
 * vensters worden opgeruimd. Roep dit vóór de wachtwoordcontrole aan.
 */
export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitState {
  const entry = store.get(ip);
  if (!entry) {
    return { allowed: true, retryAfterMs: 0 };
  }

  if (now - entry.firstAt >= WINDOW_MS) {
    store.delete(ip);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - entry.firstAt) };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Registreert een mislukte poging voor dit IP. */
export function recordFailure(ip: string, now: number = Date.now()): void {
  const entry = store.get(ip);
  if (!entry || now - entry.firstAt >= WINDOW_MS) {
    store.set(ip, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

/** Wist de teller voor dit IP (bijv. na een succesvolle login). */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}

/** Leegt de volledige store. Uitsluitend bedoeld voor tests. */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Nette Nederlandse melding met de resterende wachttijd, afgerond naar boven op
 * hele minuten (minimaal 1).
 */
export function rateLimitBericht(retryAfterMs: number): string {
  const minuten = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return `Te veel mislukte inlogpogingen. Probeer het over ${minuten} ${
    minuten === 1 ? "minuut" : "minuten"
  } opnieuw.`;
}

/**
 * Bepaalt het client-IP op basis van `X-Forwarded-For` (eerste hop achter de
 * reverse proxy). Valt terug op een vaste sleutel wanneer geen IP bekend is.
 */
export function clientIpUitHeaders(forwardedFor: string | null): string {
  if (forwardedFor) {
    const eerste = forwardedFor.split(",")[0]?.trim();
    if (eerste) {
      return eerste;
    }
  }
  return "onbekend";
}
