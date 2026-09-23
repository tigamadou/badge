import { describe, it, expect } from "vitest";
import { renderProof, assetsToResolver } from "../render-proof";
import type { TemplateManifest } from "../declarative/manifest-types";
import { extractPdfText } from "./helpers/pdf-text";

const OK: TemplateManifest = {
  formatVersion: 2,
  family: "t",
  label: "T",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  variables: [
    { name: "participant.firstName", kind: "text", label: "Prenom", sample: "Amina" },
  ],
  blocks: [
    {
      type: "text",
      page: 1,
      x: 4,
      y: 4,
      w: 40,
      h: 8,
      text: "{participant.firstName}",
      style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
    },
  ],
};

describe("renderProof", () => {
  it("produit un PDF non vide", async () => {
    const pdf = await renderProof(OK, [], "t1");
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("imprime le sample de la variable, pas une valeur vide", async () => {
    // Regression : rien dans les assertions ci-dessus (en-tete %PDF, nombre de
    // pages, MediaBox) ne changerait si renderProof alimentait le rendu avec {}
    // plutot qu'avec les samples du manifeste — resolveVariable retombe sur le
    // vide sans jamais lever. Seul le contenu du flux de page distingue les deux,
    // d'ou le decodage explicite du texte reellement dessine.
    // Cadre volontairement plus large que celui de OK (40x8, pense pour les
    // assertions structurelles ci-dessus) : a 50px de police un cadre aussi
    // etroit ne produit aucun operateur de texte, sample ou pas — inutile ici.
    const readable: TemplateManifest = {
      ...OK,
      blocks: [
        {
          type: "text", page: 1, x: 4, y: 4, w: 400, h: 80,
          text: "{participant.firstName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
        },
      ],
    };
    const pdf = await renderProof(readable, [], "t-sample");
    expect(extractPdfText(pdf)).toContain("Amina");
  });

  it("rend un paquet utilisant une ressource embarquee", async () => {
    const withAsset: TemplateManifest = {
      ...OK,
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 1011, h: 638, image: { asset: "assets/f.png" } }],
    };
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]);
    const pdf = await renderProof(
      withAsset,
      [{ path: "assets/f.png", body: png, contentType: "image/png" }],
      "t2",
    );
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("ne cree pas de page supplementaire quand un bloc deborde de la page", async () => {
    // Le fond perdu etant permis, un bloc peut sortir de la page ; @react-pdf ne doit
    // pas paginer le trop-plein sur une deuxieme page.
    const overflowing: TemplateManifest = {
      ...OK,
      blocks: [
        {
          type: "text", page: 1, x: 4, y: 600, w: 400, h: 200,
          text: "{participant.firstName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
        },
      ],
    };
    const pdf = await renderProof(overflowing, [], "t-overflow");
    const raw = pdf.toString("latin1");
    const pages = raw.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBe(1);
    // La page doit garder son format declare : 1011x638 px -> 758,25x478,5 pt.
    // (wrap={false} pose sur la Page ferait retomber la hauteur a 0.)
    const box = raw.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    expect(box).not.toBeNull();
    expect(Number(box![1])).toBeCloseTo(758.25, 1);
    expect(Number(box![2])).toBeCloseTo(478.5, 1);
  });

  it("rend autant de pages PDF que le manifeste en declare", async () => {
    const twoPages: TemplateManifest = {
      ...OK,
      page: { ...OK.page, count: 2 },
      blocks: [
        { ...OK.blocks[0] },
        { ...OK.blocks[0], page: 2 },
      ],
    };
    const pdf = await renderProof(twoPages, [], "t-two-pages");
    const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBe(2);
  });

  it("echoue quand une ressource declaree n'est pas fournie", async () => {
    // Cas de defense en profondeur : le lecteur d'archive refuse deja un asset absent
    // avant d'arriver ici. Le message exact vient de @react-pdf, qui encapsule l'erreur
    // levee par le resolveur : seul compte le fait que le rendu n'aboutisse pas.
    const missing: TemplateManifest = {
      ...OK,
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, image: { asset: "assets/absent.png" } }],
    };
    await expect(renderProof(missing, [], "t3")).rejects.toBeDefined();
  });
});

describe("assetsToResolver", () => {
  it("rend une data URL pour une ressource connue", () => {
    const resolve = assetsToResolver([
      { path: "assets/f.png", body: Buffer.from([1, 2, 3]), contentType: "image/png" },
    ]);
    expect(resolve("assets/f.png")).toBe("data:image/png;base64,AQID");
  });

  it("leve pour une ressource inconnue", () => {
    expect(() => assetsToResolver([])("assets/absent.png")).toThrow(/inconnue/i);
  });
});
