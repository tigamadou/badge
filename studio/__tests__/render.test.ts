import { describe, it, expect } from "vitest";
import { renderManifest } from "../render";

const MINIMAL = JSON.stringify({
  formatVersion: 1,
  family: "test-mini",
  label: "Test minimal",
  description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 2,
      y: 2,
      w: 40,
      h: 6,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePt: 10, color: "#0f172a", overflow: "clip" },
    },
  ],
});

describe("renderManifest", () => {
  it("rend un PDF pour un manifeste valide", async () => {
    const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId: "complet" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.pdf.length).toBeGreaterThan(500);
  });

  it("rend chaque variante", async () => {
    for (const variantId of ["complet", "sans-photo", "anonyme", "neutre", "textes-longs"]) {
      const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId });
      expect(res.ok).toBe(true);
    }
  });

  it("signale un JSON illisible sans lever", async () => {
    const res = await renderManifest({ manifest: "{ pas du json", assets: [], variantId: "complet" });

    expect(res).toEqual({ ok: false, errors: ["Manifeste invalide : JSON illisible."] });
  });

  it("remonte les erreurs de validation du manifeste", async () => {
    const horsPage = JSON.parse(MINIMAL);
    horsPage.blocks[0].x = 200;
    const res = await renderManifest({
      manifest: JSON.stringify(horsPage),
      assets: [],
      variantId: "complet",
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.join(" ")).toContain("hors de la page");
  });

  it("signale une variante inconnue", async () => {
    const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId: "inexistant" });

    expect(res).toEqual({ ok: false, errors: ['Variante inconnue : "inexistant".'] });
  });
});
