import { describe, it, expect } from "vitest";
import { listVariants, buildVariantContext } from "../contexts";

describe("listVariants", () => {
  it("expose les cinq cas de la spec, dans l'ordre", () => {
    expect(listVariants().map((v) => v.id)).toEqual([
      "complet",
      "sans-photo",
      "anonyme",
      "neutre",
      "textes-longs",
    ]);
    expect(listVariants().every((v) => v.label.length > 0)).toBe(true);
  });
});

describe("buildVariantContext", () => {
  it("produit un QR reel dans toutes les variantes", async () => {
    for (const variant of listVariants()) {
      const ctx = await buildVariantContext(variant.id);
      expect(ctx?.badge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it("donne une photo au cas complet et aucune au cas sans photo", async () => {
    const complet = await buildVariantContext("complet");
    const sansPhoto = await buildVariantContext("sans-photo");
    expect(complet?.participant.photoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(sansPhoto?.participant.photoDataUrl).toBe("");
  });

  it("positionne les drapeaux de categorie attendus", async () => {
    const anonyme = await buildVariantContext("anonyme");
    const neutre = await buildVariantContext("neutre");
    expect(anonyme?.category.anonymous).toBe(true);
    expect(neutre?.category.neutralBadge).toBe(true);
    expect(neutre?.category.anonymous).toBe(false);
  });

  it("produit des textes debordants dans la variante dediee", async () => {
    const ctx = await buildVariantContext("textes-longs");
    expect(ctx!.participant.lastName.length).toBeGreaterThan(30);
    expect(ctx!.event.title.length).toBeGreaterThan(60);
  });

  it("renvoie null pour un identifiant inconnu", async () => {
    expect(await buildVariantContext("inexistant")).toBeNull();
  });
});
