import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import type { LayoutSpec } from "@/lib/print-sheets/compute-layout";
import type { GenerationSnapshot } from "@/lib/print-sheets/generations";
import { PRINT_SHEETS_STALE_MS } from "@/lib/jobs/constants";
import { makeBadgePdf } from "./helpers/badge-pdf";

const storage = vi.hoisted(() => ({ uploadFile: vi.fn(async (key: string) => key) }));
vi.mock("@/lib/storage", () => ({ uploadFile: storage.uploadFile }));
const render = vi.hoisted(() => ({
  loadBadgeRegistration: vi.fn(),
  renderBadgePdf: vi.fn(),
}));
vi.mock("@/lib/badge-templates/render-badge", () => render);

import {
  claimGeneration,
  defaultRunDeps,
  recoverStaleGenerations,
  runGeneration,
  type RunDeps,
} from "@/lib/print-sheets/run-generation";

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const BADGE = { width: 84, height: 120 };
const spec: LayoutSpec = {
  sheetWidthMm: 297,
  sheetHeightMm: 420,
  sheetOrientation: "PORTRAIT",
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  gapHorizontalMm: 4,
  gapVerticalMm: 4,
  badgeOrientation: "ORIGINAL",
  duplexFlip: "LONG_EDGE",
  cropMarks: true,
};
const snapshot: GenerationSnapshot = { spec, badgeMm: BADGE, badgePages: 1 };
const t0 = new Date("2026-11-01T10:00:00.000Z");

let eventId: string;
beforeEach(async () => {
  vi.clearAllMocks();
  await prisma.printSheetGeneration.deleteMany();
  const org = await prisma.organization.create({ data: { name: "O", slug: uniq("o") } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: uniq("e"), location: "L", date: new Date() },
  });
  eventId = event.id;
});

async function create(
  over: Partial<{
    output: "SHEETS" | "ZIP";
    ids: string[];
    status: "PENDING" | "RUNNING";
    lockedBy: string | null;
    attempts: number;
    heartbeatAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  const output = over.output ?? "SHEETS";
  return prisma.printSheetGeneration.create({
    data: {
      output,
      eventId,
      layoutSnapshot: output === "SHEETS" ? snapshot : undefined,
      registrationIds: over.ids ?? ["r1", "r2", "r3"],
      status: over.status ?? "RUNNING",
      lockedBy: over.status === "PENDING" ? null : (over.lockedBy ?? "w1"),
      attempts: over.attempts ?? 1,
      heartbeatAt: over.heartbeatAt,
      createdAt: over.createdAt,
    },
  });
}

async function deps(
  over: Partial<RunDeps> & { sizes?: Record<string, { w: number; h: number }>; missing?: string[] } = {},
) {
  const upload = vi.fn(async () => {});
  const d: RunDeps = {
    renderBadge: async (id) =>
      over.missing?.includes(id)
        ? null
        : {
            pdf: await makeBadgePdf({
              widthMm: over.sizes?.[id]?.w ?? BADGE.width,
              heightMm: over.sizes?.[id]?.h ?? BADGE.height,
              pages: 1,
            }),
            fileName: `${id}.pdf`,
          },
    upload,
    now: () => t0,
    ...over,
  };
  return { d, upload };
}

describe("runGeneration", () => {
  it("rend 3 badges, compose 1 feuille, televerse et passe DONE", async () => {
    const g = await create();
    const { d, upload } = await deps();
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row).toMatchObject({
      status: "DONE",
      sheetCount: 1,
      badgeCount: 3,
      fileKey: `print-sheets/${g.id}.pdf`,
      skippedIds: [],
      error: null,
    });
    expect(row.completedAt).toEqual(t0);
    expect(upload).toHaveBeenCalledTimes(1);
    const [key, body, type] = upload.mock.calls[0] as unknown as [string, Uint8Array, string];
    expect(key).toBe(`print-sheets/${g.id}.pdf`);
    expect(type).toBe("application/pdf");
    expect((await PDFDocument.load(body)).getPageCount()).toBe(1);
  });

  it("ecarte les badges null et les liste dans skippedIds", async () => {
    const g = await create();
    const { d } = await deps({ missing: ["r2"] });
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.badgeCount).toBe(2);
    expect(row.skippedIds).toEqual(["r2"]);
  });

  it("echoue quand tous les badges sont null", async () => {
    const g = await create();
    const { d, upload } = await deps({ missing: ["r1", "r2", "r3"] });
    expect(await runGeneration(g.id, "w1", d)).toBe("FAILED");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row).toMatchObject({ status: "FAILED", error: "aucun badge à imprimer" });
    expect(row.skippedIds).toEqual(["r1", "r2", "r3"]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("echoue avec la position du badge au mauvais format (liste ordonnee d'origine)", async () => {
    const g = await create();
    const { d } = await deps({ missing: ["r1"], sizes: { r3: { w: 90, h: 120 } } });
    expect(await runGeneration(g.id, "w1", d)).toBe("FAILED");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.error).toBe("le badge n° 3 n'a pas le format attendu");
  });

  it("echoue quand le PDF d'un badge est illisible", async () => {
    const g = await create({ ids: ["r1"] });
    const { d } = await deps({
      renderBadge: async () => ({ pdf: new Uint8Array([1, 2, 3]), fileName: "r1.pdf" }),
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("FAILED");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.error).toContain("illisible");
  });

  it("echoue avec le message de l'erreur (Error ou autre valeur)", async () => {
    const g1 = await create();
    const e1 = await deps({ renderBadge: async () => Promise.reject(new Error("rendu HS")) });
    expect(await runGeneration(g1.id, "w1", e1.d)).toBe("FAILED");
    expect((await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g1.id } })).error).toBe(
      "rendu HS",
    );
    const g2 = await create();
    const e2 = await deps({ renderBadge: async () => Promise.reject("boom") });
    expect(await runGeneration(g2.id, "w1", e2.d)).toBe("FAILED");
    expect((await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g2.id } })).error).toBe(
      "boom",
    );
  });

  it("met a jour le battement apres chaque badge", async () => {
    const g = await create({ ids: ["r1", "r2"], heartbeatAt: new Date(0) });
    const seen: (Date | null)[] = [];
    const { d } = await deps({
      now: () => new Date(Date.now()),
      renderBadge: async () => {
        seen.push(
          (await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).heartbeatAt,
        );
        return { pdf: await makeBadgePdf({ widthMm: 84, heightMm: 120, pages: 1 }), fileName: "x.pdf" };
      },
    });
    await runGeneration(g.id, "w1", d);
    expect(seen.length).toBe(2);
    expect(seen.every((s) => s !== null)).toBe(true);
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.heartbeatAt!.getTime()).toBeGreaterThan(0);
  });

  it("LOCK_LOST si un autre worker reprend le verrou en cours de route, sans rien ecrire", async () => {
    const g = await create({ ids: ["r1", "r2", "r3", "r4", "r5", "r6"] });
    let calls = 0;
    const { d, upload } = await deps({
      renderBadge: async (id) => {
        calls += 1;
        if (calls === 2) {
          await prisma.printSheetGeneration.update({
            where: { id: g.id },
            data: { lockedBy: "w2" },
          });
        }
        return { pdf: await makeBadgePdf({ widthMm: 84, heightMm: 120, pages: 1 }), fileName: `${id}.pdf` };
      },
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row).toMatchObject({ status: "RUNNING", lockedBy: "w2", fileKey: null, error: null });
    expect(upload).not.toHaveBeenCalled();
  });

  it("LOCK_LOST si le verrou est perdu avant l'ecriture finale", async () => {
    const g = await create({ ids: ["r1"] });
    const { d, upload } = await deps();
    upload.mockImplementation(async () => {
      await prisma.printSheetGeneration.update({ where: { id: g.id }, data: { lockedBy: "w2" } });
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    expect((await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).status).toBe(
      "RUNNING",
    );
  });

  it("LOCK_LOST si le verrou est perdu avant l'ecriture d'un echec", async () => {
    const g = await create({ ids: ["r1"] });
    const stolen = async () => {
      await prisma.printSheetGeneration.update({ where: { id: g.id }, data: { lockedBy: "w2" } });
    };
    const e1 = await deps({
      renderBadge: async () => {
        await stolen();
        return null;
      },
    });
    // le battement echoue deja : LOCK_LOST
    expect(await runGeneration(g.id, "w1", e1.d)).toBe("LOCK_LOST");

    // rendu null puis verrou perdu pendant "aucun badge" : battement OK, ecriture FAILED refusee
    const g2 = await create({ ids: ["r1"] });
    let beats = 0;
    const e2 = await deps({
      now: () => {
        beats += 1;
        return t0;
      },
      renderBadge: async () => null,
    });
    const origUpdateMany = prisma.printSheetGeneration.updateMany.bind(prisma.printSheetGeneration);
    const spy = vi.spyOn(prisma.printSheetGeneration, "updateMany");
    spy.mockImplementation(((args: Parameters<typeof origUpdateMany>[0]) => {
      if ((args.data as { status?: string }).status === "FAILED") {
        return prisma.printSheetGeneration
          .update({ where: { id: g2.id }, data: { lockedBy: "w2" } })
          .then(() => origUpdateMany(args));
      }
      return origUpdateMany(args);
    }) as never);
    expect(await runGeneration(g2.id, "w1", e2.d)).toBe("LOCK_LOST");
    spy.mockRestore();
    expect(beats).toBeGreaterThan(0);

    // erreur de rendu puis verrou perdu
    const g3 = await create({ ids: ["r1"] });
    const e3 = await deps({
      renderBadge: async () => {
        throw new Error("x");
      },
    });
    const spy3 = vi.spyOn(prisma.printSheetGeneration, "updateMany");
    spy3.mockImplementation(((args: Parameters<typeof origUpdateMany>[0]) => {
      if ((args.data as { status?: string }).status === "FAILED") {
        return prisma.printSheetGeneration
          .update({ where: { id: g3.id }, data: { lockedBy: "w2" } })
          .then(() => origUpdateMany(args));
      }
      return origUpdateMany(args);
    }) as never);
    expect(await runGeneration(g3.id, "w1", e3.d)).toBe("LOCK_LOST");
    spy3.mockRestore();
  });

  it("LOCK_LOST si la generation n'existe pas ou n'est pas au worker", async () => {
    const { d } = await deps();
    expect(await runGeneration("inconnu", "w1", d)).toBe("LOCK_LOST");
    const g = await create({ lockedBy: "w2" });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    const done = await create({ status: "PENDING" });
    expect(await runGeneration(done.id, "w1", d)).toBe("LOCK_LOST");
  });

  it("battement periodique pendant l'envoi : le heartbeat avance entre rendu et ecriture finale", async () => {
    const g = await create({ ids: ["r1"], heartbeatAt: new Date(0) });
    let tick = 0;
    const { d, upload } = await deps({ beatIntervalMs: 10, now: () => new Date(1_000_000 + 1000 * tick++) });
    let during: Date | null = null;
    upload.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 120));
      during = (await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).heartbeatAt;
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    // 1 battement apres le badge (tick 0) + au moins un periodique
    expect(during!.getTime()).toBeGreaterThan(1_000_000);
  });

  it("verrou perdu detecte par le battement : LOCK_LOST sans ecriture finale", async () => {
    const g = await create({ ids: ["r1"] });
    const { d, upload } = await deps({ beatIntervalMs: 10 });
    upload.mockImplementation(async () => {
      await prisma.printSheetGeneration.update({ where: { id: g.id }, data: { lockedBy: "w2" } });
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    expect(await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).toMatchObject({
      status: "RUNNING",
      lockedBy: "w2",
      fileKey: null,
    });
  });

  it("verrou perdu detecte par le battement puis erreur d'envoi : LOCK_LOST", async () => {
    const g = await create({ ids: ["r1"] });
    const { d, upload } = await deps({ beatIntervalMs: 10 });
    upload.mockImplementation(async () => {
      await prisma.printSheetGeneration.update({ where: { id: g.id }, data: { lockedBy: "w2" } });
      await new Promise((r) => setTimeout(r, 100));
      throw new Error("s3 HS");
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    expect((await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).error).toBeNull();
  });

  it("une erreur transitoire du battement est ignoree", async () => {
    const g = await create({ ids: ["r1"] });
    const { d, upload } = await deps({ beatIntervalMs: 10 });
    const orig = prisma.printSheetGeneration.updateMany.bind(prisma.printSheetGeneration);
    let first = true;
    const spy = vi.spyOn(prisma.printSheetGeneration, "updateMany");
    spy.mockImplementation(((args: Parameters<typeof orig>[0]) => {
      if (upload.mock.calls.length > 0 && first) {
        first = false;
        return Promise.reject(new Error("db"));
      }
      return orig(args);
    }) as never);
    upload.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    spy.mockRestore();
  });

  it("une reservation plus recente (attempts different) empeche l'ancien run d'ecrire", async () => {
    const g = await create({ ids: ["r1"] });
    const { d, upload } = await deps();
    upload.mockImplementation(async () => {
      await prisma.printSheetGeneration.update({ where: { id: g.id }, data: { attempts: 2 } });
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("LOCK_LOST");
    expect((await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } })).status).toBe("RUNNING");
  });

  it("recto-verso : compose avec les deux pages", async () => {
    const g = await prisma.printSheetGeneration.create({
      data: {
        output: "SHEETS",
        eventId,
        layoutSnapshot: { ...snapshot, badgePages: 2 },
        duplex: true,
        registrationIds: ["r1"],
        status: "RUNNING",
        lockedBy: "w1",
        attempts: 1,
      },
    });
    const { d, upload } = await deps({
      renderBadge: async () => ({
        pdf: await makeBadgePdf({ widthMm: 84, heightMm: 120, pages: 2 }),
        fileName: "r1.pdf",
      }),
    });
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    const body = (upload.mock.calls[0] as unknown as [string, Uint8Array])[1];
    expect((await PDFDocument.load(body)).getPageCount()).toBe(2);
  });

  it("ZIP : un PDF par badge aux noms attendus, sans feuille", async () => {
    const g = await create({ output: "ZIP" });
    const { d, upload } = await deps({ missing: [] });
    expect(await runGeneration(g.id, "w1", d)).toBe("DONE");
    const row = await prisma.printSheetGeneration.findUniqueOrThrow({ where: { id: g.id } });
    expect(row).toMatchObject({
      status: "DONE",
      sheetCount: null,
      badgeCount: 3,
      fileKey: `badge-exports/${eventId}/${g.id}.zip`,
    });
    const [key, body, type] = upload.mock.calls[0] as unknown as [string, Uint8Array, string];
    expect(key).toBe(`badge-exports/${eventId}/${g.id}.zip`);
    expect(type).toBe("application/zip");
    const zip = await JSZip.loadAsync(body);
    expect(Object.keys(zip.files).sort()).toEqual(["r1.pdf", "r2.pdf", "r3.pdf"]);
  });
});

describe("defaultRunDeps", () => {
  it("renderBadge : null si inscription absente ou non approuvee, sinon PDF et nom", async () => {
    render.loadBadgeRegistration.mockResolvedValueOnce(null);
    expect(await defaultRunDeps.renderBadge("x")).toBeNull();
    render.loadBadgeRegistration.mockResolvedValueOnce({ id: "x", status: "PENDING" });
    expect(await defaultRunDeps.renderBadge("x")).toBeNull();
    const pdf = new Uint8Array([1]);
    render.loadBadgeRegistration.mockResolvedValueOnce({
      id: "REG-1",
      status: "APPROVED",
      snapshotFirstName: "Ada",
      snapshotLastName: "Lovelace",
      category: { anonymous: false },
    });
    render.renderBadgePdf.mockResolvedValueOnce({ pdf, templateId: "t" });
    expect(await defaultRunDeps.renderBadge("REG-1")).toEqual({
      pdf,
      fileName: "REG-1-ada-lovelace.pdf",
    });
  });

  it("upload : delegue au stockage, now donne la date courante", async () => {
    await defaultRunDeps.upload("k", new Uint8Array([1, 2]), "application/pdf");
    expect(storage.uploadFile).toHaveBeenCalledWith("k", Buffer.from([1, 2]), "application/pdf");
    expect(Math.abs(defaultRunDeps.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe("claimGeneration", () => {
  it("reserve la plus ancienne PENDING et la passe RUNNING", async () => {
    const younger = await create({ status: "PENDING", attempts: 0, createdAt: new Date(t0.getTime() + 1000) });
    const older = await create({ status: "PENDING", attempts: 0, createdAt: t0 });
    const claimed = await claimGeneration({ workerId: "w1", now: t0 });
    expect(claimed).toMatchObject({
      id: older.id,
      status: "RUNNING",
      lockedBy: "w1",
      attempts: 1,
      heartbeatAt: t0,
      startedAt: t0,
    });
    expect((await claimGeneration({ workerId: "w1", now: t0 }))!.id).toBe(younger.id);
    expect(await claimGeneration({ workerId: "w1", now: t0 })).toBeNull();
  });

  it("deux reservations concurrentes ne prennent jamais la meme ligne", async () => {
    for (let i = 0; i < 4; i++) await create({ status: "PENDING", attempts: 0 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => claimGeneration({ workerId: `w${i}`, now: t0 })),
    );
    const ids = results.filter(Boolean).map((r) => r!.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("recoverStaleGenerations", () => {
  const stale = new Date(t0.getTime() - PRINT_SHEETS_STALE_MS - 1000);
  const fresh = new Date(t0.getTime() - PRINT_SHEETS_STALE_MS + 1000);

  it("remet en PENDING tant qu'il reste des essais, FAILED a la 3e", async () => {
    const a = await create({ attempts: 1, heartbeatAt: stale });
    const b = await create({ attempts: 2, heartbeatAt: stale });
    const c = await create({ attempts: 3, heartbeatAt: stale });
    const alive = await create({ attempts: 1, heartbeatAt: fresh });
    expect(await recoverStaleGenerations(t0)).toBe(3);
    const get = (id: string) => prisma.printSheetGeneration.findUniqueOrThrow({ where: { id } });
    expect(await get(a.id)).toMatchObject({ status: "PENDING", lockedBy: null });
    expect(await get(b.id)).toMatchObject({ status: "PENDING", lockedBy: null });
    expect(await get(c.id)).toMatchObject({
      status: "FAILED",
      error: "génération interrompue trop de fois",
      completedAt: t0,
    });
    expect((await get(alive.id)).status).toBe("RUNNING");
    expect(await recoverStaleGenerations(t0)).toBe(0);
  });
});
