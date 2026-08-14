import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { migrateRefs } from "../migrate-badge-template-refs";

async function seedOrgWithEvent(legacyId: string) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const org = await prisma.organization.create({
    data: { name: `Org ${suffix}`, slug: `org-mig-${suffix}`, badgeTemplateId: legacyId },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Salon migration",
      slug: `salon-mig-${suffix}`,
      location: "Niamey",
      date: new Date("2027-12-15T00:00:00Z"),
      badgeTemplateId: legacyId,
    },
  });
  return { org, event };
}

describe("migrateRefs", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany({ where: { slug: { startsWith: "salon-mig-" } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: "org-mig-" } } });
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("convertit default-v1 en cuid dans les evenements et les organisations", async () => {
    const { org, event } = await seedOrgWithEvent("default-v1");

    const report = await migrateRefs("seed");
    expect(report.events).toBeGreaterThanOrEqual(1);
    expect(report.orgs).toBeGreaterThanOrEqual(1);

    const target = await prisma.installedBadgeTemplate.findFirst({ where: { family: "default" } });
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.badgeTemplateId).toBe(
      target!.id,
    );
    expect(
      (await prisma.organization.findUnique({ where: { id: org.id } }))?.badgeTemplateId,
    ).toBe(target!.id);
  });

  it("convertit recto-verso-v1", async () => {
    const { event } = await seedOrgWithEvent("recto-verso-v1");

    await migrateRefs("seed");

    const target = await prisma.installedBadgeTemplate.findFirst({
      where: { family: "recto-verso" },
    });
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.badgeTemplateId).toBe(
      target!.id,
    );
  });

  it("est idempotent : une seconde execution ne convertit plus rien", async () => {
    await seedOrgWithEvent("default-v1");

    await migrateRefs("seed");
    const second = await migrateRefs("seed");

    expect(second.events).toBe(0);
    expect(second.orgs).toBe(0);
    expect(second.platform).toBe(0);
  });

  it("signale une valeur inconnue sans interrompre", async () => {
    const { event } = await seedOrgWithEvent("un-template-qui-n-existe-pas");

    const report = await migrateRefs("seed");

    expect(report.unknown.join()).toMatch(/un-template-qui-n-existe-pas/);
    // La valeur inconnue est laissee telle quelle : la migration ne devine pas.
    expect((await prisma.event.findUnique({ where: { id: event.id } }))?.badgeTemplateId).toBe(
      "un-template-qui-n-existe-pas",
    );
  });

  it("ignore les references nulles (heritage de la cascade)", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const org = await prisma.organization.create({
      data: { name: `Org ${suffix}`, slug: `org-mig-${suffix}`, badgeTemplateId: null },
    });

    const report = await migrateRefs("seed");

    expect(report.unknown.filter((u) => u.includes("null"))).toHaveLength(0);
    expect(
      (await prisma.organization.findUnique({ where: { id: org.id } }))?.badgeTemplateId,
    ).toBeNull();
  });
});
