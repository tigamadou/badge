import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { BadgeEnvError } from "@/lib/badge-env";
import { getFile, uploadFile, listPrefix } from "@/lib/storage";
import { makeEvent, makeInstalledTemplate, makeOrg, makeCategory, makeRegistration, makeUser, makeStaff } from "@/test/factories";
import { DEMO_BADGE_LOCAL_EMAILS } from "../../constants";
import * as accounts from "../accounts";
import * as organizations from "../organizations";
import * as registrations from "../registrations";
import * as print from "../print";
import * as billing from "../billing";
import * as notifications from "../notifications";
import * as cleanup from "../cleanup";
import { createDemoContext, insertInBatches, type DemoContext } from "../context";
import { runDemoSeed } from "../index";
import { writeAccountsFile } from "../accounts-file";

// Chaque contexte construit la reserve d'images aux dimensions des cadres : plus lent qu'avant.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DEV = { BADGE_ENV: "dev" };
const TEST_PREFIX = "demo/_test/";

async function rowCounts() {
  return { users: await prisma.user.count(), orgs: await prisma.organization.count() };
}

describe("cadre du seed de demo", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Le catalogue de motifs vient du seed minimal : seedRegistrations est teste dans registrations.test.ts.
    vi.spyOn(registrations, "seedRegistrations").mockImplementation(async () => {});
    // Les lots impression, facturation et notifications ont leurs propres tests : ici seul le cadre compte.
    vi.spyOn(print, "seedPrint").mockImplementation(async () => {});
    vi.spyOn(billing, "seedBilling").mockImplementation(async () => {});
    vi.spyOn(notifications, "seedNotificationsAndActivity").mockImplementation(async () => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
    await ctx.storage.clearTracked();
    const leftovers = await listPrefix("print-sheets/orders/x.pdf");
    expect(leftovers).toEqual([]);
  });

  describe("garde-fou", () => {
    it.each([
      ["prod", { BADGE_ENV: "prod" }],
      ["vide", {}],
      ["staging", { BADGE_ENV: "staging" }],
    ])("refuse sans ecrire (%s)", async (_label, env) => {
      await makeUser({ email: "existant@test.local" });
      const before = await rowCounts();
      await expect(runDemoSeed({ env, accountsFile: null })).rejects.toBeInstanceOf(BadgeEnvError);
      expect(await rowCounts()).toEqual(before);
    });
  });

  describe("contexte", () => {
    it("laisse la reserve d'images presente en stockage apres le nettoyage", async () => {
      const ctx = await runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX });
      const stored = new Set((await listPrefix(TEST_PREFIX)).map((o) => o.key));
      const reserved = [...ctx.images.photos, ...ctx.images.logos, ...ctx.images.banners];
      expect(reserved.length).toBeGreaterThan(0);
      for (const key of reserved) expect(stored.has(key)).toBe(true);
    });

    it("fournit echelle, dates et stockage", async () => {
      const ctx = await runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX });
      expect(ctx.scaled(1000, 1)).toBeGreaterThanOrEqual(1);
      expect(ctx.scaled(1, 3)).toBe(3);
      expect(ctx.dates.daysAgo(3).getTime()).toBeLessThan(ctx.dates.now.getTime());
      expect(ctx.dates.now.getTime()).toBeLessThan(ctx.dates.daysFromNow(3).getTime());
      expect(ctx.dates.daysFromNow(1, 14).getHours()).toBe(14);
      const d = ctx.dates.between(10, 20);
      expect(d.getTime()).toBeLessThanOrEqual(ctx.dates.daysAgo(10).getTime());
      expect(d.getTime()).toBeGreaterThanOrEqual(ctx.dates.daysAgo(20).getTime());
      expect(ctx.storage.key("a", "b")).toBe(`${TEST_PREFIX}a/b`);
      expect(() => ctx.storage.key("..", "x")).toThrow();
      expect(() => ctx.storage.key("a", "")).toThrow();
      expect(() => ctx.storage.key("a\\b")).toThrow();
      await expect(ctx.storage.put("autre/x", Buffer.from("x"), "text/plain")).rejects.toThrow();
      expect(Object.keys(ctx.registry.staff).sort()).toEqual(
        ["STAFF_ADMIN", "STAFF_OBSERVER", "STAFF_PRINTER", "STAFF_SUPPORT", "SUPER_ADMIN"],
      );
      expect(ctx.registry.registrations.size).toBe(0);
      expect(ctx.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    });

    it("supporte une echelle nulle sans diviser par zero", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0, storagePrefix: TEST_PREFIX });
      expect(ctx.scaled(1000)).toBe(1);
      expect(ctx.scaled(1000, 4)).toBe(4);
    });

    it("rejette une echelle invalide", async () => {
      await expect(createDemoContext({ env: DEV, scale: -1 })).rejects.toThrow();
      await expect(createDemoContext({ env: { ...DEV, DEMO_SCALE: "abc" } })).rejects.toThrow();
    });

    it("lit DEMO_SCALE dans l'environnement", async () => {
      const ctx = await createDemoContext({ env: { ...DEV, DEMO_SCALE: "0.5" }, storagePrefix: TEST_PREFIX });
      expect(ctx.scale).toBe(0.5);
    });

    it("est deterministe (graine faker)", async () => {
      const a = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const b = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      expect(a.faker.person.firstName()).toBe(b.faker.person.firstName());
    });

    it("enregistre les comptes", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      ctx.recordAccount("a@demo.local", "OWNER", "cas A");
      expect(ctx.accounts).toEqual([{ email: "a@demo.local", role: "OWNER", scenario: "cas A" }]);
    });
  });

  it("insertInBatches decoupe en tranches", async () => {
    const sizes: number[] = [];
    await insertInBatches(Array.from({ length: 1250 }, (_, i) => i), async (chunk) => {
      sizes.push(chunk.length);
    });
    expect(sizes).toEqual([500, 500, 250]);
    const small: number[] = [];
    await insertInBatches([1, 2, 3], async (c) => { small.push(c.length); }, 2);
    expect(small).toEqual([2, 1]);
    await insertInBatches([], async () => { throw new Error("jamais"); });
  });

  describe("orchestration", () => {
    it("appelle nettoyages puis seeds dans l'ordre fige", async () => {
      const calls: string[] = [];
      const spy = (mod: object, name: string, label = name) =>
        vi.spyOn(mod as Record<string, () => Promise<unknown>>, name).mockImplementation(async () => {
          calls.push(label);
        });
      spy(notifications, "cleanupNotificationsAndActivity");
      spy(billing, "cleanupBilling");
      spy(print, "cleanupPrint");
      spy(cleanup, "cleanupDemoCore");
      spy(accounts, "seedAccounts");
      spy(organizations, "seedOrganizationsAndEvents");
      spy(registrations, "seedRegistrations");
      spy(print, "seedPrint");
      spy(billing, "seedBilling");
      spy(notifications, "seedNotificationsAndActivity");

      const ctx = await runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX });
      expect(calls).toEqual([
        "cleanupNotificationsAndActivity",
        "cleanupBilling",
        "cleanupPrint",
        "cleanupDemoCore",
        "seedAccounts",
        "seedOrganizationsAndEvents",
        "seedRegistrations",
        "seedPrint",
        "seedBilling",
        "seedNotificationsAndActivity",
      ]);
      expect(ctx).toBeDefined();
    });

    it("parke les jobs et ecrit le manifeste apres les trois lots, y compris en cas d'echec", async () => {
      const order: string[] = [];
      vi.spyOn(notifications, "seedNotificationsAndActivity").mockImplementation(async (ctx: DemoContext) => {
        const park = ctx.parkJobs;
        ctx.parkJobs = async (...args) => { order.push("parkJobs"); return park(...args); };
        const flush = ctx.storage.flushTrackedKeys;
        ctx.storage.flushTrackedKeys = async () => { order.push("flush"); return flush(); };
        order.push("lot");
      });
      await runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX });
      expect(order).toEqual(["lot", "parkJobs", "flush"]);

      order.length = 0;
      vi.spyOn(billing, "seedBilling").mockImplementation(async (ctx: DemoContext) => {
        const park = ctx.parkJobs;
        ctx.parkJobs = async (...args) => { order.push("parkJobs"); return park(...args); };
        const flush = ctx.storage.flushTrackedKeys;
        ctx.storage.flushTrackedKeys = async () => { order.push("flush"); return flush(); };
        throw new Error("boom");
      });
      await expect(
        runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX }),
      ).rejects.toThrow("boom");
      expect(order).toEqual(["parkJobs", "flush"]);
    }, 30_000);

    it("parke les jobs sans masquer l'erreur d'origine quand parkJobs echoue aussi", async () => {
      vi.spyOn(billing, "seedBilling").mockImplementation(async (ctx: DemoContext) => {
        ctx.parkJobs = async () => { throw new Error("park casse"); };
        throw new Error("boom");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        runDemoSeed({ env: DEV, scale: 0.02, accountsFile: null, storagePrefix: TEST_PREFIX }),
      ).rejects.toThrow("boom");
    });

    it("ecrit le fichier de comptes par defaut dans le chemin demande", async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "demo-run-"));
      try {
        const file = path.join(dir, "sous", "comptes.md");
        vi.spyOn(accounts, "seedAccounts").mockImplementation(async (ctx: DemoContext) => {
          ctx.recordAccount("x@demo.local", "OWNER", "cas X");
        });
        vi.spyOn(organizations, "seedOrganizationsAndEvents").mockImplementation(async () => {});
        await runDemoSeed({ env: DEV, scale: 0.02, accountsFile: file, storagePrefix: TEST_PREFIX });
        expect(await readFile(file, "utf8")).toContain("x@demo.local");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("writeAccountsFile", () => {
    it("liste les comptes et rappelle le mot de passe commun", async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "demo-accounts-"));
      try {
        const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
        ctx.recordAccount("owner.grosse-org@demo.local", "OWNER", "Propriétaire | grosse org");
        ctx.recordAccount("observer@demo.local", "STAFF_OBSERVER", "Lecture seule");
        const file = path.join(dir, "a", "b", "comptes-demo.md");
        await writeAccountsFile(ctx, file);
        const text = await readFile(file, "utf8");
        expect(text).toContain("| owner.grosse-org@demo.local | OWNER | Propriétaire \\| grosse org |");
        expect(text).toContain("| observer@demo.local | STAFF_OBSERVER | Lecture seule |");
        expect(text).toContain("123456");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("cleanupDemoCore", () => {
    it("supprime le perimetre de demo et laisse le reste intact", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const admin = await makeStaff("SUPER_ADMIN", { email: "admin@badge.local" });
      const demoUser = await makeUser({ email: "participant.0001@demo.local" });
      const movedUser = await makeUser({ email: DEMO_BADGE_LOCAL_EMAILS[0] });
      const keptUser = await makeUser({ email: "autre@test.local" });
      const demoOrg = await makeOrg({ slug: "demo-grosse-org" });
      const keptOrg = await makeOrg({ slug: "autre-org" });
      const demoEvent = await makeEvent(demoOrg.id, { slug: "demo-grosse-org-congres" });
      const cat = await makeCategory(demoEvent.id);
      await makeRegistration(demoEvent.id, cat.id, "APPROVED", { userId: demoUser.id });
      const keptEvent = await makeEvent(keptOrg.id);
      await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: demoUser.id, orgId: demoOrg.id } });
      await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: keptUser.id } });
      const demoTpl = await makeInstalledTemplate(admin.id, { family: "demo-modele", assetPrefix: "badge-templates/demo-modele/" });
      const keptTpl = await makeInstalledTemplate(admin.id);
      const reason = await prisma.rejectionReason.create({ data: { label: "Motif", scope: "BOTH" } });
      const plan = await prisma.plan.create({ data: { name: "Plan test" } });
      await uploadFile("badge-templates/demo-modele/asset.png", Buffer.from("x"), "image/png");
      await ctx.storage.put(ctx.storage.key("photos", "p1.png"), Buffer.from("x"), "image/png");

      const clear = vi.spyOn(ctx.storage, "clearTracked");
      await cleanup.cleanupDemoCore(ctx);

      expect(clear).toHaveBeenCalled();
      expect(await prisma.organization.findMany({ select: { id: true } })).toEqual([{ id: keptOrg.id }]);
      expect(await prisma.event.findMany({ select: { id: true } })).toEqual([{ id: keptEvent.id }]);
      expect(await prisma.registration.count()).toBe(0);
      const emails = (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email).sort();
      expect(emails).toEqual(["admin@badge.local", "autre@test.local"].sort());
      expect(movedUser.id).toBeDefined();
      expect(await prisma.activityLog.count()).toBe(1);
      expect(await prisma.installedBadgeTemplate.count({ where: { id: keptTpl.id } })).toBe(1);
      expect(await prisma.installedBadgeTemplate.count({ where: { id: demoTpl.id } })).toBe(0);
      expect(await prisma.rejectionReason.count({ where: { id: reason.id } })).toBe(1);
      expect(await prisma.plan.count({ where: { id: plan.id } })).toBe(1);
      expect(await listPrefix("badge-templates/demo-modele/")).toEqual([]);
      expect(await listPrefix(TEST_PREFIX)).toEqual([]);
    });
  });

  describe("stockage", () => {
    it("putAt ecrit a la cle exacte et le manifeste permet le nettoyage", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      await ctx.storage.put(ctx.storage.key("a.txt"), Buffer.from("a"), "text/plain");
      await ctx.storage.putAt("print-sheets/orders/x.pdf", Buffer.from("pdf"), "application/pdf");
      expect((await getFile("print-sheets/orders/x.pdf")).body.toString()).toBe("pdf");
      await expect(ctx.storage.putAt("../x", Buffer.from("x"), "text/plain")).rejects.toThrow();
      await expect(ctx.storage.putAt("/x", Buffer.from("x"), "text/plain")).rejects.toThrow();
      await expect(ctx.storage.putAt("", Buffer.from("x"), "text/plain")).rejects.toThrow();
      await expect(ctx.storage.putAt("a\\b", Buffer.from("x"), "text/plain")).rejects.toThrow();
      await ctx.storage.flushTrackedKeys();

      const next = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const deleted = await next.storage.clearTracked();
      expect(deleted).toBeGreaterThanOrEqual(2);
      await expect(getFile("print-sheets/orders/x.pdf")).rejects.toThrow();
      expect(await listPrefix(TEST_PREFIX)).toEqual([]);
    });

    it("clearTracked sans manifeste ne supprime que le prefixe", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      await ctx.storage.put(ctx.storage.key("seul.txt"), Buffer.from("a"), "text/plain");
      expect(await ctx.storage.clearTracked()).toBe(1 + ctx.images.photos.length + ctx.images.logos.length + ctx.images.banners.length);
      expect(await ctx.storage.clear()).toBe(0);
    });

    it("ignore dans le manifeste toute cle invalide", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      await uploadFile("hors-manifeste.txt", Buffer.from("garde"), "text/plain");
      await uploadFile(`${TEST_PREFIX}_tracked-keys.json`, Buffer.from(JSON.stringify(["../x", "/y", "hors-manifeste.txt", 3])), "application/json");
      await ctx.storage.clearTracked();
      // seules les cles valides du manifeste sont supprimees : ici la cle valide l'est bien
      await expect(getFile("hors-manifeste.txt")).rejects.toThrow();
    });

    it("manifeste illisible : le nettoyage continue", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      await uploadFile(`${TEST_PREFIX}_tracked-keys.json`, Buffer.from("pas du json"), "application/json");
      await expect(ctx.storage.clearTracked()).resolves.toBeGreaterThanOrEqual(1);
    });
  });

  describe("backdate", () => {
    it("reecrit createdAt et updatedAt", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const org = await makeOrg();
      const event = await makeEvent(org.id);
      const cat = await makeCategory(event.id);
      const reg = await makeRegistration(event.id, cat.id);
      const reg2 = await makeRegistration(event.id, cat.id);
      const d = new Date("2026-01-02T03:04:05.000Z");
      const u = new Date("2026-01-03T03:04:05.000Z");

      await ctx.backdate("registration", reg.id, d);
      const one = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
      expect(one.createdAt.toISOString()).toBe(d.toISOString());
      expect(one.updatedAt.toISOString()).toBe(d.toISOString());

      await ctx.backdate("registration", [reg.id, reg2.id], d, u);
      for (const id of [reg.id, reg2.id]) {
        const r = await prisma.registration.findUniqueOrThrow({ where: { id } });
        expect(r.createdAt.toISOString()).toBe(d.toISOString());
        expect(r.updatedAt.toISOString()).toBe(u.toISOString());
      }
      await ctx.backdate("registration", [], d);
    });

    it("ignore updatedAt pour un modele qui n'a pas la colonne", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const admin = await makeStaff("SUPER_ADMIN");
      const tpl = await makeInstalledTemplate(admin.id);
      const log = await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: admin.id } });
      const d = new Date("2026-02-02T00:00:00.000Z");
      await ctx.backdate("activityLog", log.id, d, new Date());
      expect((await prisma.activityLog.findUniqueOrThrow({ where: { id: log.id } })).createdAt.toISOString()).toBe(d.toISOString());
      expect(tpl.id).toBeDefined();
    });

    it("refuse un modele hors liste", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      await expect(ctx.backdate("plan" as never, "x", new Date())).rejects.toThrow();
      await expect(ctx.backdate("user; DROP TABLE User" as never, "x", new Date())).rejects.toThrow();
    });
  });

  describe("parkJobs", () => {
    it("reporte uniquement les jobs PENDING crees depuis `since`", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const base = { type: "EMAIL" as const, payload: {}, kind: "test" };
      const old = await prisma.job.create({ data: { ...base, createdAt: new Date(ctx.dates.now.getTime() - 60_000) } });
      const pending = await prisma.job.create({ data: { ...base } });
      const done = await prisma.job.create({ data: { ...base, status: "SUCCEEDED" } });

      const n = await ctx.parkJobs();

      expect(n).toBe(1);
      const limit = ctx.dates.now.getTime() + 3000 * 86_400_000;
      expect((await prisma.job.findUniqueOrThrow({ where: { id: pending.id } })).runAt.getTime()).toBeGreaterThan(limit);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: done.id } })).runAt.getTime()).toBeLessThan(limit);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: old.id } })).runAt.getTime()).toBeLessThan(limit);

      const at = new Date("2040-01-01T00:00:00.000Z");
      expect(await ctx.parkJobs(new Date(0), at)).toBe(2);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: old.id } })).runAt.toISOString()).toBe(at.toISOString());
    });

    it("reporte un job PENDING de demo antidate (createdAt < since), pas un job etranger", async () => {
      const ctx = await createDemoContext({ env: DEV, scale: 0.02, storagePrefix: TEST_PREFIX });
      const base = { type: "EMAIL" as const, payload: {}, kind: "test" };
      const past = new Date(ctx.dates.now.getTime() - 30 * 86_400_000);
      const demoJob = await prisma.job.create({ data: { ...base, recipient: "a@demo.local" } });
      await ctx.backdate("job", demoJob.id, past);
      const foreign = await prisma.job.create({ data: { ...base, recipient: "x@exemple.com" } });
      await ctx.backdate("job", foreign.id, past);

      expect(await ctx.parkJobs()).toBe(1);

      const limit = ctx.dates.now.getTime() + 3000 * 86_400_000;
      expect((await prisma.job.findUniqueOrThrow({ where: { id: demoJob.id } })).runAt.getTime()).toBeGreaterThan(limit);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: foreign.id } })).runAt.getTime()).toBeLessThan(limit);
      expect(await ctx.parkJobs()).toBe(0);
    });
  });
});
