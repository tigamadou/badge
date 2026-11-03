import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BADGE_ENVS,
  BadgeEnvError,
  assertDemoSeedAllowed,
  readBadgeEnv,
} from "../badge-env";

describe("readBadgeEnv", () => {
  it("expose les trois environnements", () => {
    expect(BADGE_ENVS).toEqual(["dev", "preprod", "prod"]);
  });

  it("lit une valeur valide", () => {
    expect(readBadgeEnv({ BADGE_ENV: "dev" })).toBe("dev");
  });

  it("ignore espaces et casse", () => {
    expect(readBadgeEnv({ BADGE_ENV: " Preprod " })).toBe("preprod");
    expect(readBadgeEnv({ BADGE_ENV: "PROD" })).toBe("prod");
  });

  it("retourne null si absent, vide ou inconnu", () => {
    expect(readBadgeEnv({})).toBeNull();
    expect(readBadgeEnv({ BADGE_ENV: "" })).toBeNull();
    expect(readBadgeEnv({ BADGE_ENV: "staging" })).toBeNull();
  });

  describe("par défaut", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("lit process.env", () => {
      vi.stubEnv("BADGE_ENV", "preprod");
      expect(readBadgeEnv()).toBe("preprod");
    });
  });
});

describe("assertDemoSeedAllowed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("autorise dev et preprod", () => {
    expect(assertDemoSeedAllowed({ BADGE_ENV: "dev" })).toBe("dev");
    expect(assertDemoSeedAllowed({ BADGE_ENV: "preprod" })).toBe("preprod");
  });

  it("refuse prod en citant la valeur lue", () => {
    expect(() => assertDemoSeedAllowed({ BADGE_ENV: "prod" })).toThrow(BadgeEnvError);
    expect(() => assertDemoSeedAllowed({ BADGE_ENV: "prod" })).toThrow(/prod/);
  });

  it("refuse une valeur absente", () => {
    expect(() => assertDemoSeedAllowed({})).toThrow(BadgeEnvError);
  });

  it("refuse une valeur invalide en la citant", () => {
    expect(() => assertDemoSeedAllowed({ BADGE_ENV: "staging" })).toThrow(/staging/);
  });

  it("lit process.env par défaut", () => {
    vi.stubEnv("BADGE_ENV", "dev");
    expect(assertDemoSeedAllowed()).toBe("dev");
  });
});
