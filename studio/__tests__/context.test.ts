import { describe, it, expect } from "vitest";
import { buildContext, DEFAULT_CONTEXT_INPUT, PRESETS } from "../context";

describe("buildContext", () => {
  it("fusionne un contexte partiel avec les defauts", async () => {
    const ctx = await buildContext({ participant: { firstName: "Awa" } });
    expect(ctx.participant.firstName).toBe("Awa");
    expect(ctx.participant.lastName).not.toBe("");
    expect(ctx.event.date).toBeInstanceOf(Date);
  });

  it("genere un QR reel depuis verifyUrl", async () => {
    const ctx = await buildContext({ badge: { verifyUrl: "https://x/v/1" } });
    expect(ctx.badge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("expose des presets couvrant les anciens cas", () => {
    const ids = PRESETS.map((p) => p.id);
    for (const id of ["complet", "sans-photo", "anonyme", "neutre", "textes-longs"]) {
      expect(ids).toContain(id);
    }
    expect(PRESETS.every((p) => p.label.length > 0)).toBe(true);
  });

  it("sans argument, rend le contexte par defaut", async () => {
    const ctx = await buildContext();
    expect(ctx.participant.photoDataUrl).toMatch(/^data:image\/png/);
    expect(ctx).toMatchObject(await buildContext(DEFAULT_CONTEXT_INPUT));
  });

  it("expose les cinq presets dans l'ordre", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "complet",
      "sans-photo",
      "anonyme",
      "neutre",
      "textes-longs",
    ]);
  });

  it("produit un QR reel dans tous les presets", async () => {
    for (const preset of PRESETS) {
      const ctx = await buildContext(preset.input);
      expect(ctx.badge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  const byId = (id: string) => PRESETS.find((p) => p.id === id)!.input;

  it("donne une photo au preset complet et aucune au preset sans photo", async () => {
    expect((await buildContext(byId("complet"))).participant.photoDataUrl).toMatch(
      /^data:image\/png;base64,/,
    );
    expect((await buildContext(byId("sans-photo"))).participant.photoDataUrl).toBe("");
  });

  it("positionne les drapeaux de categorie attendus", async () => {
    const anonyme = await buildContext(byId("anonyme"));
    const neutre = await buildContext(byId("neutre"));
    expect(anonyme.category.anonymous).toBe(true);
    expect(neutre.category.neutralBadge).toBe(true);
    expect(neutre.category.anonymous).toBe(false);
  });

  it("produit des textes debordants dans le preset dedie", async () => {
    const ctx = await buildContext(byId("textes-longs"));
    expect(ctx.participant.lastName.length).toBeGreaterThan(30);
    expect(ctx.event.title.length).toBeGreaterThan(60);
  });

  it("accepte une date fournie en ISO", async () => {
    const ctx = await buildContext({ event: { date: "2030-01-15T00:00:00.000Z" } });
    expect(ctx.event.date.toISOString()).toBe("2030-01-15T00:00:00.000Z");
  });

  it("accepte un logo d'evenement absent", async () => {
    const ctx = await buildContext({ event: { logoDataUrl: null } });
    expect(ctx.event.logoDataUrl).toBeNull();
  });
});
