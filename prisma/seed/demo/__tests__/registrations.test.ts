import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hash } from "bcryptjs";
import type { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFile, deletePrefix } from "@/lib/storage";
import { DEMO_PASSWORD, DEV_SUPER_ADMIN_EMAIL } from "../../constants";
import { createDemoContext, type DemoContext } from "../context";
import { seedAccounts } from "../accounts";
import { seedOrganizationsAndEvents } from "../organizations";
import { seedRegistrations } from "../registrations";

const TEST_PREFIX = "demo/_test/";
const STATUSES: RegistrationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

async function cleanTemplates() {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { family: { startsWith: "demo-" } },
    select: { id: true, assetPrefix: true },
  });
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  for (const r of rows) await deletePrefix(r.assetPrefix);
}

async function seedCatalogue() {
  await prisma.rejectionReason.createMany({
    data: [
      { label: "Photo illisible", scope: "PROFILE", sortOrder: 10 },
      { label: "Document suspect", scope: "BOTH", sortOrder: 20 },
      { label: "Quota atteint", scope: "REGISTRATION", sortOrder: 30 },
      { label: "Inscription en doublon", scope: "REGISTRATION", sortOrder: 40 },
    ],
  });
}

describe("seedRegistrations", () => {
  let ctx: DemoContext;

  beforeEach(async () => {
    await cleanTemplates();
    await prisma.user.create({
      data: {
        email: DEV_SUPER_ADMIN_EMAIL,
        password: await hash(DEMO_PASSWORD, 4),
        name: "Super Admin",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    await seedCatalogue();
    ctx = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 0.02, storagePrefix: TEST_PREFIX });
    await seedAccounts(ctx);
    await seedOrganizationsAndEvents(ctx);
    await seedRegistrations(ctx);
  });

  afterEach(async () => {
    await cleanTemplates();
    await ctx.storage.clearTracked();
  });

  it("couvre les quatre statuts de profil avec des soumissions coherentes", async () => {
    const users = await prisma.user.findMany({ include: { profileSubmissions: { orderBy: { createdAt: "asc" } } } });
    const statuses = new Set(users.map((u) => u.profileStatus));
    expect([...statuses].sort()).toEqual(["APPROVED", "INCOMPLETE", "PENDING", "REJECTED"]);

    const staffIds = new Set((await prisma.user.findMany({ where: { isStaff: true } })).map((u) => u.id));
    const catalogue = new Map((await prisma.rejectionReason.findMany()).map((r) => [r.id, r]));
    let resubmitted = 0;

    for (const u of users) {
      const subs = u.profileSubmissions;
      if (u.profileStatus === "INCOMPLETE") {
        expect(subs).toHaveLength(0);
        continue;
      }
      if (subs.length === 0) continue; // comptes hors profil (staff, bloque, etc.)
      const last = subs[subs.length - 1];
      expect(last.status).toBe(u.profileStatus);
      if (u.profileStatus === "APPROVED") {
        expect(u.photo).toBeTruthy();
        expect(u.idDocument).toBeTruthy();
        expect(u.participantProfileCompletedAt).not.toBeNull();
        expect((await getFile(u.photo!)).body.length).toBeGreaterThan(0);
        expect((await getFile(u.idDocument!)).body.length).toBeGreaterThan(0);
        if (subs.length > 1) {
          resubmitted++;
          expect(subs[0].status).toBe("REJECTED");
        }
      }
      for (const s of subs.filter((x) => x.status === "REJECTED")) {
        const reason = catalogue.get(s.rejectionReasonId!)!;
        expect(["PROFILE", "BOTH"]).toContain(reason.scope);
        expect(s.rejectionReasonLabel).toBe(reason.label);
        expect(staffIds.has(s.reviewedById!)).toBe(true);
      }
    }
    expect(resubmitted).toBeGreaterThan(0);

    for (const [email, status] of [
      ["participant@badge.local", "APPROVED"],
      ["profil-attente@badge.local", "PENDING"],
      ["profil-rejete@badge.local", "REJECTED"],
    ] as const) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(u.profileStatus).toBe(status);
      expect(ctx.accounts.some((a) => a.email === email)).toBe(true);
    }
    expect(ctx.registry.special.profilePending?.email).toBe("profil-attente@badge.local");
    expect(ctx.registry.special.profileRejected?.email).toBe("profil-rejete@badge.local");
    expect(ctx.registry.special.profileIncomplete).toBeDefined();
  });

  it("cree des inscriptions coherentes a tous les statuts", async () => {
    const regs = await prisma.registration.findMany({ include: { user: true, category: true, rejectionReasonRef: true } });
    expect(new Set(regs.map((r) => r.status))).toEqual(new Set(STATUSES));
    expect(new Set(regs.map((r) => r.id)).size).toBe(regs.length);
    expect(new Set(regs.map((r) => `${r.userId}|${r.eventId}`)).size).toBe(regs.length);

    for (const r of regs) {
      expect(r.user.profileStatus).toBe("APPROVED");
      expect(r.categoryId).toBe(r.category.id);
      expect(r.snapshotFirstName).toBe(r.user.firstName);
      expect(r.snapshotLastName).toBe(r.user.lastName);
      expect(r.snapshotEmail).toBe(r.user.email);
      expect(r.snapshotStructure).toBe(r.user.structure);
      expect(r.snapshotPhoto).toBe(r.user.photo);
      expect(r.snapshotIdDocumentType).toBe(r.user.idDocumentType);
      expect(r.snapshotIdDocumentNumber).toBe(r.user.idDocumentNumber);
      expect(r.snapshotIdDocument).toBe(r.user.idDocument);
      if (r.status === "REJECTED") {
        expect(r.rejectionReasonId).not.toBeNull();
        expect(["REGISTRATION", "BOTH"]).toContain(r.rejectionReasonRef!.scope);
        expect(r.rejectionReason).toBe(r.rejectionReasonRef!.label);
        expect(r.rejectionDetails).toBeTruthy();
      } else {
        expect(r.rejectionReasonId).toBeNull();
      }
      if (r.badgePrinted) {
        expect(r.status).toBe("APPROVED");
        expect(r.badgePrintedAt).not.toBeNull();
      } else {
        expect(r.badgePrintedAt).toBeNull();
      }
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(ctx.dates.now.getTime());
    }
    const approved = regs.filter((r) => r.status === "APPROVED");
    expect(approved.some((r) => !r.badgePrinted)).toBe(true);
    expect(approved.some((r) => r.badgePrinted)).toBe(true);
    expect(approved.some((r) => r.allAccessGranted)).toBe(true);
    expect(regs.filter((r) => r.status !== "APPROVED").every((r) => !r.allAccessGranted)).toBe(true);
  });

  it("respecte les evenements archives et l'organisation archivee", async () => {
    const regs = await prisma.registration.findMany({ include: { event: { include: { organization: true } } } });
    for (const r of regs) {
      if (r.event.archived) expect(r.event.registrationOpen).toBe(false);
      if (r.event.organization.archived) {
        expect(r.event.registrationOpen).toBe(false);
        expect(r.event.date.getTime()).toBeLessThan(ctx.dates.now.getTime());
      }
    }
    const archivedOrg = ctx.registry.orgsBySize.archived[0];
    const inArchived = regs.filter((r) => r.event.orgId === archivedOrg.id);
    expect(inArchived.length).toBeGreaterThan(0);
  });

  it("aligne registry.registrations et registry.participants sur la base", async () => {
    for (const e of ctx.registry.events) {
      const byStatus = ctx.registry.registrations.get(e.id)!;
      for (const status of STATUSES) {
        const count = await prisma.registration.count({ where: { eventId: e.id, status } });
        expect(byStatus[status]).toHaveLength(count);
        for (const ref of byStatus[status]) {
          expect(ref.status).toBe(status);
          expect(ref.eventId).toBe(e.id);
        }
      }
    }
    const refs = [...ctx.registry.registrations.values()].flatMap((b) => STATUSES.flatMap((s) => b[s]));
    expect(refs).toHaveLength(await prisma.registration.count());
    const rows = new Map((await prisma.registration.findMany()).map((r) => [r.id, r]));
    for (const ref of refs.slice(0, 200)) {
      const row = rows.get(ref.id)!;
      expect(row.userId).toBe(ref.userId);
      expect(row.categoryId).toBe(ref.categoryId);
      expect(row.badgePrinted).toBe(ref.badgePrinted);
    }

    const approvedUsers = await prisma.user.count({ where: { profileStatus: "APPROVED", email: { endsWith: "@demo.local" } } });
    expect(ctx.registry.participants.length).toBeGreaterThan(0);
    for (const p of ctx.registry.participants) {
      expect((await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).profileStatus).toBe("APPROVED");
    }
    expect(approvedUsers).toBeGreaterThan(0);
  });

  it("refuse de tourner sans catalogue de motifs de rejet", async () => {
    await prisma.registration.deleteMany();
    await prisma.rejectionReason.deleteMany();
    await expect(seedRegistrations(ctx)).rejects.toThrow(/motifs de rejet/i);
  });
});

describe.skipIf(!process.env.DEMO_FULL_SCALE_TEST)("seedRegistrations a scale 1", () => {
  let ctx: DemoContext;

  beforeEach(async () => {
    await cleanTemplates();
    await prisma.user.create({
      data: {
        email: DEV_SUPER_ADMIN_EMAIL,
        password: await hash(DEMO_PASSWORD, 4),
        name: "Super Admin",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    await seedCatalogue();
    ctx = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 1, storagePrefix: TEST_PREFIX });
    await seedAccounts(ctx);
    await seedOrganizationsAndEvents(ctx);
  });

  afterEach(async () => {
    await cleanTemplates();
    await ctx.storage.clearTracked();
  });

  it("atteint les volumes cibles avec des identifiants uniques", { timeout: 600_000 }, async () => {
    const t0 = Date.now();
    await seedRegistrations(ctx);
    console.log(`seedRegistrations scale 1 : ${Math.round((Date.now() - t0) / 1000)} s`);

    const huge = ctx.registry.orgsBySize.huge[0];
    const ongoing = ctx.registry.eventsByOrg.get(huge.id)!.find((e) => e.phase === "ongoing")!;
    expect(await prisma.registration.count({ where: { eventId: ongoing.id } })).toBeGreaterThan(3000);

    const total = await prisma.registration.count();
    expect(total).toBeGreaterThanOrEqual(5000);
    expect(total).toBeLessThanOrEqual(8000);

    for (const org of ctx.registry.orgsBySize.medium) {
      expect(await prisma.registration.count({ where: { event: { orgId: org.id } } })).toBeGreaterThanOrEqual(300);
    }
    const perCategory = await prisma.registration.groupBy({ by: ["eventId", "categoryId"], _count: true });
    expect(Math.max(...perCategory.map((g) => g._count))).toBeGreaterThan(999);
  });
});
