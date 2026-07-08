import { describe, expect, it } from "vitest";
import { effectiveHash, hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("hasht en verifieert hetzelfde wachtwoord (roundtrip)", async () => {
    const hash = await hashPassword("geheim-wachtwoord-123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword("geheim-wachtwoord-123", hash)).toBe(true);
  });

  it("wijst een verkeerd wachtwoord af", async () => {
    const hash = await hashPassword("geheim-wachtwoord-123");
    expect(await verifyPassword("verkeerd", hash)).toBe(false);
  });

  it("gooit niet bij een onleesbare hash, maar geeft false", async () => {
    expect(await verifyPassword("wat-dan-ook", "geen-geldige-hash")).toBe(false);
  });
});

describe("effectiveHash (env-override-logica)", () => {
  const DB_HASH = "$argon2id$db-hash";
  const ENV_HASH = "$argon2id$env-hash";

  it("gebruikt de DB-hash wanneer de env var niet gezet is", () => {
    expect(effectiveHash(DB_HASH, undefined)).toBe(DB_HASH);
    expect(effectiveHash(DB_HASH, "")).toBe(DB_HASH);
    expect(effectiveHash(DB_HASH, "   ")).toBe(DB_HASH);
  });

  it("laat de env var winnen van de DB-hash", () => {
    expect(effectiveHash(DB_HASH, ENV_HASH)).toBe(ENV_HASH);
    expect(effectiveHash(null, ENV_HASH)).toBe(ENV_HASH);
  });

  it("trimt de env var", () => {
    expect(effectiveHash(null, `  ${ENV_HASH}  `)).toBe(ENV_HASH);
  });

  it("geeft null wanneer er geen enkele hash is", () => {
    expect(effectiveHash(null, undefined)).toBeNull();
    expect(effectiveHash(undefined, "")).toBeNull();
  });
});
