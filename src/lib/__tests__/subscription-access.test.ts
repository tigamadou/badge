import { describe, it, expect, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadOrgAccess } from "@/lib/subscription-access";
import { DEFAULT_RIGHTS } from "@/lib/subscription-rights";

async function makeOrg(slug: string, endDate: Date | null) {
  const org = await prisma.organization.create({ data: { name: slug, slug } });
  const plan = await prisma.plan.create({ data: { name: `plan-${slug}`, maxEvents: 3 } });
  await prisma.subscription.create({
    data: { orgId: org.id, planId: plan.id, status: "ACTIVE", endDate },
  });
  return org;
}

async function setRights(value: unknown) {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { subscriptionRights: value as never },
    create: { id: "singleton", subscriptionRights: value as never },
  });
}

// La ligne singleton doit rester présente pour les autres suites : retour à l'état neutre.
afterEach(async () => {
  await setRights(Prisma.DbNull);
});

describe("loadOrgAccess", () => {
  it("abonnement échu + réglage personnalisé : inactif et droits fusionnés", async () => {
    const org = await makeOrg("access-expired", new Date(Date.now() - 86_400_000));
    await setRights({ CREATE_EVENT: { inactive: true } });
    const access = await loadOrgAccess(org.id);
    expect(access.active).toBe(false);
    expect(access.maxEvents).toBe(3);
    expect(access.rights.CREATE_EVENT.inactive).toBe(true);
    expect(access.rights.ACCESS_ORG_SPACE).toEqual(DEFAULT_RIGHTS.ACCESS_ORG_SPACE);
  });

  it("abonnement valide sans réglage : actif et défauts", async () => {
    const org = await makeOrg("access-active", new Date(Date.now() + 86_400_000));
    await setRights(null);
    const access = await loadOrgAccess(org.id);
    expect(access.active).toBe(true);
    expect(access.rights).toEqual(DEFAULT_RIGHTS);
  });

  it("droits à null dans PlatformSettings : défauts", async () => {
    const org = await makeOrg("access-nosettings", new Date(Date.now() + 86_400_000));
    await setRights(Prisma.DbNull);
    const access = await loadOrgAccess(org.id);
    expect(access.rights).toEqual(DEFAULT_RIGHTS);
  });
});
