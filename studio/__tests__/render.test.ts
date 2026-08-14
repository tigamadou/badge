import { describe, it, expect } from "vitest";
import { renderManifest } from "../render";
import { buildContext, PRESETS } from "../context";

const MINIMAL = JSON.stringify({
  formatVersion: 1,
  family: "test-mini",
  label: "Test minimal",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 2,
      y: 2,
      w: 40,
      h: 6,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePx: 42, color: "#0f172a", overflow: "clip" },
    },
  ],
});

describe("renderManifest", () => {
  it("rend un PDF pour un manifeste valide", async () => {
    const res = await renderManifest({
      manifest: MINIMAL,
      assets: [],
      context: await buildContext(),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.pdf.length).toBeGreaterThan(500);
  });

  it("rend chaque preset", async () => {
    for (const preset of PRESETS) {
      const res = await renderManifest({
        manifest: MINIMAL,
        assets: [],
        context: await buildContext(preset.input),
      });
      expect(res.ok).toBe(true);
    }
  });

  it("signale un JSON illisible sans lever", async () => {
    const res = await renderManifest({
      manifest: "{ pas du json",
      assets: [],
      context: await buildContext(),
    });

    expect(res).toEqual({ ok: false, errors: ["Manifeste invalide : JSON illisible."] });
  });

  it("remonte les erreurs de validation du manifeste", async () => {
    const sourceInconnue = JSON.parse(MINIMAL);
    sourceInconnue.blocks[0].text = "{participant.inconnu}";
    const res = await renderManifest({
      manifest: JSON.stringify(sourceInconnue),
      assets: [],
      context: await buildContext(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.join(" ")).toContain("source inconnue");
  });
});
