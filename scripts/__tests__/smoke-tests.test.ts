import { describe, it, expect, beforeEach } from "vitest";
import { assert, SmokeError, dataChecks, runChecks } from "../smoke-tests";
import { prisma } from "@/lib/prisma";
import { makeEvent, makeOrg, makeStaff, seedFactories } from "@/test/factories";
import { DEMO_BADGE_LOCAL_EMAILS, DEMO_SLUG_PREFIX } from "../../prisma/seed/constants";

describe("smoke-tests helpers", () => {
  it("assert ne jette pas quand la condition est vraie", () => {
    expect(() => assert(true, "ok")).not.toThrow();
  });

  it("assert jette SmokeError quand la condition est fausse", () => {
    expect(() => assert(false, "boom")).toThrow(SmokeError);
    try {
      assert(false, "boom");
    } catch (e) {
      expect(e).toBeInstanceOf(SmokeError);
      expect((e as Error).message).toBe("boom");
    }
  });
});

describe("dataChecks", () => {
  beforeEach(() => seedFactories(20261103));

  const allOk = (results: { ok: boolean }[]) => results.every((r) => r.ok);

  it("prod : une organisation en base fait echouer", async () => {
    await makeOrg();
    const results = await dataChecks(prisma, "prod");
    expect(results.some((r) => !r.ok)).toBe(true);
  });

  it("prod : un evenement en base fait echouer", async () => {
    const org = await makeOrg();
    await makeEvent(org.id);
    const results = await dataChecks(prisma, "prod");
    expect(results.filter((r) => !r.ok).length).toBeGreaterThan(0);
  });

  it("prod : base vide, tout est ok", async () => {
    const results = await dataChecks(prisma, "prod");
    expect(results.length).toBeGreaterThan(0);
    expect(allOk(results)).toBe(true);
  });

  it("preprod : sans organisation de demo, echec", async () => {
    await makeStaff("SUPER_ADMIN", { email: DEMO_BADGE_LOCAL_EMAILS[0] });
    const results = await dataChecks(prisma, "preprod");
    expect(allOk(results)).toBe(false);
  });

  it("preprod : une organisation non demo seule ne suffit pas", async () => {
    await makeStaff("SUPER_ADMIN", { email: DEMO_BADGE_LOCAL_EMAILS[0] });
    await makeOrg();
    expect(allOk(await dataChecks(prisma, "preprod"))).toBe(false);
  });

  it("preprod : organisation de demo et staff de demo, tout est ok", async () => {
    await makeStaff("SUPER_ADMIN", { email: DEMO_BADGE_LOCAL_EMAILS[0] });
    await makeOrg({ slug: `${DEMO_SLUG_PREFIX}acme` });
    expect(allOk(await dataChecks(prisma, "preprod"))).toBe(true);
  });

  it("preprod : staff de demo principal absent, echec", async () => {
    await makeOrg({ slug: `${DEMO_SLUG_PREFIX}acme` });
    const results = await dataChecks(prisma, "preprod");
    expect(results.some((r) => !r.ok && r.name.includes(DEMO_BADGE_LOCAL_EMAILS[0]))).toBe(true);
  });

  it("preprod : aucune verification 0 organisation / 0 evenement", async () => {
    const results = await dataChecks(prisma, "preprod");
    expect(results.some((r) => /Aucune organisation|Aucun event/.test(r.name))).toBe(false);
  });

  it("dev utilise les controles preprod", async () => {
    await makeStaff("SUPER_ADMIN", { email: DEMO_BADGE_LOCAL_EMAILS[0] });
    await makeOrg({ slug: `${DEMO_SLUG_PREFIX}acme` });
    expect(allOk(await dataChecks(prisma, "dev"))).toBe(true);
  });
});

describe("runChecks", () => {
  it.each([undefined, "", "staging"])("BADGE_ENV %j : erreur explicite", async (value) => {
    await expect(runChecks({ BADGE_ENV: value })).rejects.toThrow(/BADGE_ENV/);
  });
});
