"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSession, requireSession } from "@/lib/auth/session";
import {
  effectiveHash,
  getActivePasswordHash,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  checkRateLimit,
  clientIpUitHeaders,
  rateLimitBericht,
  recordFailure,
  resetRateLimit,
} from "@/lib/auth/rate-limit";

/**
 * Server actions voor authenticatie.
 *
 * DEFENSE IN DEPTH — patroon voor mutatie-actions:
 * Elke action die data wijzigt roept aan het begin `requireSession()` aan
 * (behalve login/setup, die per definitie ongeauthenticeerd zijn). De
 * middleware redirect ongeauthenticeerde requests al, maar `requireSession()`
 * is de tweede verdedigingslaag voor het geval een request de middleware
 * omzeilt. Nieuwe actions in andere bestanden volgen ditzelfde patroon.
 */

export type AuthFormState = {
  error?: string;
  success?: string;
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpUitHeaders(h.get("x-forwarded-for"));
}

const loginSchema = z.object({
  wachtwoord: z.string().min(1, "Vul een wachtwoord in."),
});

/** Inloggen: rate-limited, constant-time wachtwoordcontrole. */
export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const activeHash = await getActivePasswordHash();
  if (!activeHash) {
    // Nog geen wachtwoord ingesteld → eerst setup.
    redirect("/setup");
  }

  const parsed = loginSchema.safeParse({
    wachtwoord: formData.get("wachtwoord"),
  });
  if (!parsed.success) {
    return { error: "Vul een wachtwoord in." };
  }

  const ip = await clientIp();
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return { error: rateLimitBericht(limit.retryAfterMs) };
  }

  const ok = await verifyPassword(parsed.data.wachtwoord, activeHash);
  if (!ok) {
    // Registreer de mislukte poging. Het blokkeren gebeurt bij de vólgende
    // poging (pre-check hierboven): 5 pogingen toegestaan, de 6e geblokkeerd.
    recordFailure(ip);
    return { error: "Onjuist wachtwoord." };
  }

  resetRateLimit(ip);
  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  redirect("/");
}

/** Uitloggen: sessie vernietigen en terug naar de loginpagina. */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

const setupSchema = z
  .object({
    bedrijfsnaam: z.string().trim().min(1, "Vul een bedrijfsnaam in."),
    wachtwoord: z
      .string()
      .min(10, "Het wachtwoord moet minstens 10 tekens bevatten."),
    bevestiging: z.string(),
  })
  .refine((d) => d.wachtwoord === d.bevestiging, {
    path: ["bevestiging"],
    message: "De wachtwoorden komen niet overeen.",
  });

/**
 * Eenmalige setup: stelt het wachtwoord en de bedrijfsnaam in, logt direct in.
 * Alleen bruikbaar zolang er nog geen wachtwoord-hash bestaat.
 */
export async function setupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const bestaandeHash = await getActivePasswordHash();
  if (bestaandeHash) {
    redirect("/login");
  }

  const parsed = setupSchema.safeParse({
    bedrijfsnaam: formData.get("bedrijfsnaam"),
    wachtwoord: formData.get("wachtwoord"),
    bevestiging: formData.get("bevestiging"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const hash = await hashPassword(parsed.data.wachtwoord);
  const bedrijfsnaam = parsed.data.bedrijfsnaam.trim();

  const bestaand = db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();

  if (bestaand) {
    db.update(settings)
      .set({ passwordHash: hash, bedrijfsnaam })
      .where(eq(settings.id, 1))
      .run();
  } else {
    db.insert(settings)
      .values({ id: 1, passwordHash: hash, bedrijfsnaam })
      .run();
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  redirect("/");
}

const wachtwoordWijzigenSchema = z
  .object({
    huidig: z.string().min(1, "Vul je huidige wachtwoord in."),
    nieuw: z
      .string()
      .min(10, "Het nieuwe wachtwoord moet minstens 10 tekens bevatten."),
    bevestiging: z.string(),
  })
  .refine((d) => d.nieuw === d.bevestiging, {
    path: ["bevestiging"],
    message: "De nieuwe wachtwoorden komen niet overeen.",
  });

/** Wachtwoord wijzigen vanuit de instellingen. */
export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireSession();

  const parsed = wachtwoordWijzigenSchema.safeParse({
    huidig: formData.get("huidig"),
    nieuw: formData.get("nieuw"),
    bevestiging: formData.get("bevestiging"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const storedRow = db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();
  const activeHash = effectiveHash(storedRow?.passwordHash);

  if (!activeHash) {
    return { error: "Er is nog geen wachtwoord ingesteld." };
  }

  const ok = await verifyPassword(parsed.data.huidig, activeHash);
  if (!ok) {
    return { error: "Het huidige wachtwoord is onjuist." };
  }

  if (process.env.AUTH_PASSWORD_HASH && process.env.AUTH_PASSWORD_HASH.trim()) {
    return {
      error:
        "Het wachtwoord is vastgezet via de omgevingsvariabele " +
        "AUTH_PASSWORD_HASH en kan niet via de app worden gewijzigd.",
    };
  }

  const nieuweHash = await hashPassword(parsed.data.nieuw);
  db.update(settings)
    .set({ passwordHash: nieuweHash })
    .where(eq(settings.id, 1))
    .run();

  return { success: "Je wachtwoord is gewijzigd." };
}
