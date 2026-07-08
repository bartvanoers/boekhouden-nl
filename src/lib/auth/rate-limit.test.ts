import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  checkRateLimit,
  clearRateLimitStore,
  clientIpUitHeaders,
  rateLimitBericht,
  recordFailure,
  resetRateLimit,
} from "./rate-limit";

const IP = "203.0.113.7";

describe("rate limiter", () => {
  beforeEach(() => clearRateLimitStore());
  afterEach(() => clearRateLimitStore());

  it("staat 5 mislukte pogingen toe en blokkeert de 6e", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(checkRateLimit(IP).allowed).toBe(true);
      recordFailure(IP);
    }
    const blocked = checkRateLimit(IP);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
  });

  it("reset na afloop van het venster", () => {
    const start = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(IP, start);
    }
    // Binnen het venster nog geblokkeerd.
    expect(checkRateLimit(IP, start + WINDOW_MS - 1).allowed).toBe(false);
    // Na afloop van het venster weer toegestaan.
    expect(checkRateLimit(IP, start + WINDOW_MS).allowed).toBe(true);
  });

  it("houdt IP's gescheiden", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure(IP);
    expect(checkRateLimit(IP).allowed).toBe(false);
    expect(checkRateLimit("198.51.100.1").allowed).toBe(true);
  });

  it("resetRateLimit wist de teller na een succesvolle login", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure(IP);
    expect(checkRateLimit(IP).allowed).toBe(false);
    resetRateLimit(IP);
    expect(checkRateLimit(IP).allowed).toBe(true);
  });

  it("formatteert de resterende wachttijd in hele minuten", () => {
    expect(rateLimitBericht(60_000)).toContain("1 minuut");
    expect(rateLimitBericht(2 * 60_000)).toContain("2 minuten");
    // Afronden naar boven, minimaal 1.
    expect(rateLimitBericht(1)).toContain("1 minuut");
    expect(rateLimitBericht(90_000)).toContain("2 minuten");
  });
});

describe("clientIpUitHeaders", () => {
  it("neemt de eerste hop uit X-Forwarded-For", () => {
    expect(clientIpUitHeaders("203.0.113.7, 70.41.3.18, 150.172.238.178")).toBe(
      "203.0.113.7",
    );
    expect(clientIpUitHeaders("198.51.100.1")).toBe("198.51.100.1");
    expect(clientIpUitHeaders("  198.51.100.2  , x")).toBe("198.51.100.2");
  });

  it("valt terug op 'onbekend' zonder header", () => {
    expect(clientIpUitHeaders(null)).toBe("onbekend");
    expect(clientIpUitHeaders("")).toBe("onbekend");
  });
});
