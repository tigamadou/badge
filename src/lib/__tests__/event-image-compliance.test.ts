import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates } from "@/lib/badge-templates/install";
import { ID_PHOTO_REQUIREMENT } from "@/lib/badge-templates/image-frames";
import {
  EVENT_IMAGE_SELECT,
  EventImagesNoncompliantError,
  assertEventImagesCompliant,
  assertEventImagesCompliantById,
  evaluateEventImages,
  eventImagesErrorResponse,
  getEventImageRequirements,
  readStoredDimensions,
  validateImageBuffer,
  validateStoredImage,
  keyHasPrefix,
} from "../event-image-compliance";
import { makeEvent, makeOrg, makeStaff, seedFactories } from "@/test/factories";
import {
  makeFramedTemplate,
  makeJpegHeader,
  makePng,
  makeWebpHeader,
  putTestImage,
} from "@/test/factories-2a";

seedFactories(2203);

afterEach(() => {
  vi.restoreAllMocks();
});

let seq = 0;
async function setup(frames: Parameters<typeof makeFramedTemplate>[1] = { logo: { w: 68, h: 68 }, banner: { w: 750, h: 250 } }) {
  const staff = await makeStaff("SUPER_ADMIN");
  const org = await makeOrg();
  const template = await makeFramedTemplate(staff.id, frames);
  const event = await makeEvent(org.id, { badgeTemplateId: template.id });
  return { staff, org, template, event };
}

async function load(eventId: string) {
  return prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: EVENT_IMAGE_SELECT });
}

async function store(buf: Buffer, ext = "png") {
  return putTestImage(`test-2a/${Date.now()}-${++seq}.${ext}`, buf, `image/${ext === "jpg" ? "jpeg" : ext}`);
}

describe("getEventImageRequirements", () => {
  it("lit les cadres logo et banniere du template de l'evenement", async () => {
    const { event } = await setup();
    const req = await getEventImageRequirements(event);
    expect(req.logo?.ratioLabel).toBe("1:1");
    expect(req.banner?.ratioLabel).toBe("3:1");
  });

  it("retrouve un cadre dans un groupe imbriqué", async () => {
    const { event } = await setup({ logo: { w: 68, h: 68 }, nested: true });
    expect((await getEventImageRequirements(event)).logo?.ratioLabel).toBe("1:1");
  });

  it("se replie sur le template de l'organisation", async () => {
    const staff = await makeStaff("SUPER_ADMIN");
    const template = await makeFramedTemplate(staff.id, { logo: { w: 100, h: 50 } });
    const org = await makeOrg({ badgeTemplateId: template.id });
    const event = await makeEvent(org.id);
    expect((await getEventImageRequirements(event)).logo?.ratioLabel).toBe("2:1");
  });

  it("ne contraint rien quand le template n'a pas la variable", async () => {
    const { event } = await setup({});
    expect(await getEventImageRequirements(event)).toEqual({});
  });

  it("ignore une liaison qui n'est pas un objet", async () => {
    const { event, template } = await setup();
    await prisma.installedBadgeTemplate.update({ where: { id: template.id }, data: { bindings: [] } });
    expect(await getEventImageRequirements(event)).toEqual({});
  });

  it("relance l'erreur d'un layout illisible, et la tolere en mode lenient", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { event, template } = await setup();
    await prisma.installedBadgeTemplate.update({ where: { id: template.id }, data: { layout: "x" } });
    await expect(getEventImageRequirements(event)).rejects.toThrow();
    const logo = await store(makePng(136, 136));
    await prisma.event.update({ where: { id: event.id }, data: { logo, logoWidth: 136, logoHeight: 136 } });
    await expect(assertEventImagesCompliant(await load(event.id))).rejects.toThrow();
    await expect(evaluateEventImages(await load(event.id), { lenient: true })).resolves.toEqual([]);
    await expect(getEventImageRequirements(event, { lenient: true })).resolves.toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it("rend {} quand aucun template n'existe", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    await prisma.installedBadgeTemplate.deleteMany();
    try {
      expect(await getEventImageRequirements(event)).toEqual({});
      expect(warn).toHaveBeenCalled();
    } finally {
      await ensureReferenceTemplates("seed-test");
    }
  });
});

describe("evaluateEventImages", () => {
  it("accepte un logo conforme aux dimensions memorisees", async () => {
    const { event } = await setup();
    const logo = await store(makePng(136, 136));
    await prisma.event.update({ where: { id: event.id }, data: { logo, logoWidth: 136, logoHeight: 136 } });
    expect(await evaluateEventImages(await load(event.id))).toEqual([]);
  });

  it("signale un logo hors ratio", async () => {
    const { event } = await setup();
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo, logoWidth: 300, logoHeight: 100 } });
    const issues = await evaluateEventImages(await load(event.id));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ slot: "logo", reason: "RATIO", actual: { width: 300, height: 100 } });
  });

  it("signale une banniere trop petite", async () => {
    const { event } = await setup();
    const banner = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { banner, bannerWidth: 300, bannerHeight: 100 } });
    const issues = await evaluateEventImages(await load(event.id));
    expect(issues[0]).toMatchObject({ slot: "banner", reason: "RESOLUTION" });
  });

  it("change de verdict avec le template, sans ecriture en base", async () => {
    const { event, staff } = await setup({ logo: { w: 68, h: 68 } });
    const logo = await store(makePng(136, 136));
    await prisma.event.update({ where: { id: event.id }, data: { logo, logoWidth: 136, logoHeight: 136 } });
    expect(await evaluateEventImages(await load(event.id))).toEqual([]);

    const wide = await makeFramedTemplate(staff.id, { logo: { w: 750, h: 250 } });
    await prisma.event.update({ where: { id: event.id }, data: { badgeTemplateId: wide.id } });
    const before = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    const issues = await evaluateEventImages(await load(event.id));
    expect(issues.map((i) => i.slot)).toEqual(["logo"]);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toEqual(before);
  });

  it("relit les dimensions dans le fichier quand elles manquent", async () => {
    const { event } = await setup();
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    expect((await evaluateEventImages(await load(event.id)))[0]).toMatchObject({ slot: "logo", reason: "RATIO" });
  });

  it("ignore une image absente du stockage avec un avertissement", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { logo: "test-2a/inexistant.png" } });
    expect(await evaluateEventImages(await load(event.id))).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("ne rend rien sans image", async () => {
    const { event } = await setup();
    expect(await evaluateEventImages(await load(event.id))).toEqual([]);
  });

  it("ne controle pas une image que le template n'utilise pas", async () => {
    const { event } = await setup({ banner: { w: 750, h: 250 } });
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    expect(await evaluateEventImages(await load(event.id))).toEqual([]);
  });
});

describe("validateImageBuffer", () => {
  it("accepte une photo 420x540", () => {
    expect(validateImageBuffer(makePng(420, 540), "image/png", ID_PHOTO_REQUIREMENT)).toEqual({
      ok: true, width: 420, height: 540,
    });
  });

  it("refuse des octets quelconques", () => {
    expect(validateImageBuffer(Buffer.from("pas une image"), "image/png", null)).toMatchObject({
      ok: false, status: 400, code: "INVALID_IMAGE",
    });
  });

  it("refuse un PNG déclaré JPEG", () => {
    expect(validateImageBuffer(makePng(10, 10), "image/jpeg", null)).toMatchObject({ ok: false, status: 400 });
  });

  it("refuse un type MIME inconnu", () => {
    expect(validateImageBuffer(makePng(10, 10), "image/gif", null)).toMatchObject({ ok: false, status: 400 });
  });

  it("refuse WebP pour les formats du moteur seulement", () => {
    const webp = makeWebpHeader(64, 32);
    expect(validateImageBuffer(webp, "image/webp", null, { engineFormatsOnly: true })).toMatchObject({
      ok: false, status: 415, code: "UNSUPPORTED_FORMAT",
    });
    expect(validateImageBuffer(webp, "image/webp", null)).toEqual({ ok: true, width: 64, height: 32 });
  });

  it("refuse un mauvais ratio puis une mauvaise resolution", () => {
    expect(validateImageBuffer(makePng(540, 540), "image/png", ID_PHOTO_REQUIREMENT)).toEqual({
      ok: false, status: 422, code: "IMAGE_RATIO", message: "Ratio attendu 7:9, par ex. 210 × 270 px.",
    });
    expect(validateImageBuffer(makeJpegHeader(140, 180), "image/jpeg", ID_PHOTO_REQUIREMENT)).toMatchObject({
      ok: false, status: 422, code: "IMAGE_RESOLUTION",
    });
  });

  it("sans exigence, une image valide passe", () => {
    expect(validateImageBuffer(makePng(1, 1), "image/png", null)).toEqual({ ok: true, width: 1, height: 1 });
  });
});

const PREFIXES = { allowedPrefixes: ["test-2a/"] };

describe("validateStoredImage / readStoredDimensions", () => {
  it("refuse une cle hors des prefixes attendus, meme si le fichier existe", async () => {
    const key = await store(makePng(420, 540));
    expect(await validateStoredImage(key, null, { allowedPrefixes: ["profile/u1/"] })).toEqual({
      ok: false, status: 400, code: "INVALID_IMAGE", message: "Image introuvable.",
    });
    expect(keyHasPrefix("profile/u1/../u2/a.png", ["profile/u1/"])).toBe(false);
    expect(keyHasPrefix("profile/u1/a.png", ["profile/u1/"])).toBe(true);
  });

  it("refuse une cle absente", async () => {
    expect(await validateStoredImage("test-2a/absente.png", null, PREFIXES)).toEqual({
      ok: false, status: 400, code: "INVALID_IMAGE", message: "Image introuvable.",
    });
    expect(await readStoredDimensions("test-2a/absente.png")).toBeNull();
  });

  it("rend le verdict de validateImageBuffer pour une cle valide", async () => {
    const key = await store(makePng(420, 540));
    expect(await validateStoredImage(key, ID_PHOTO_REQUIREMENT, PREFIXES)).toEqual({ ok: true, width: 420, height: 540 });
    expect(await readStoredDimensions(key)).toEqual({ width: 420, height: 540, format: "png" });
    const bad = await store(makePng(540, 540));
    expect(await validateStoredImage(bad, ID_PHOTO_REQUIREMENT, PREFIXES)).toMatchObject({ ok: false, code: "IMAGE_RATIO" });
  });

  it("refuse un contenu qui n'est pas une image", async () => {
    const key = await putTestImage(`test-2a/texte-${++seq}.png`, Buffer.from("texte"), "image/png");
    expect(await validateStoredImage(key, null, PREFIXES)).toMatchObject({ ok: false, status: 400, code: "INVALID_IMAGE" });
  });
});

describe("assertEventImagesCompliant", () => {
  it("leve l'erreur avec les problemes", async () => {
    const { event } = await setup();
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    const err = await assertEventImagesCompliant(await load(event.id)).catch((e) => e);
    expect(err).toBeInstanceOf(EventImagesNoncompliantError);
    expect(err).toMatchObject({ code: "EVENT_IMAGES_NONCOMPLIANT", httpStatus: 422 });
    expect(err.issues).toHaveLength(1);
  });

  it("passe quand tout est conforme", async () => {
    const { event } = await setup();
    await expect(assertEventImagesCompliant(await load(event.id))).resolves.toBeUndefined();
  });

  it("par identifiant : evenement inconnu sans effet, non conforme leve", async () => {
    await expect(assertEventImagesCompliantById("inconnu")).resolves.toBeUndefined();
    const { event } = await setup();
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    await expect(assertEventImagesCompliantById(event.id)).rejects.toBeInstanceOf(EventImagesNoncompliantError);
  });

  it("traduit l'erreur en reponse 422", async () => {
    const { event } = await setup({ logo: { w: 68, h: 68 } });
    const logo = await store(makePng(300, 100));
    await prisma.event.update({ where: { id: event.id }, data: { logo } });
    const err = await assertEventImagesCompliant(await load(event.id)).catch((e) => e);
    const res = eventImagesErrorResponse(err);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("EVENT_IMAGES_NONCOMPLIANT");
    expect(body.message).toBe(
      "Images de l'évènement à recadrer : logo — Ratio attendu 1:1, par ex. 136 × 136 px. Corrigez-les dans les paramètres de l'évènement avant de générer les badges.",
    );
    expect(body.issues).toHaveLength(1);
  });
});
