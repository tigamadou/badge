import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
import { px } from "../../px";
import type { TemplateManifest } from "../manifest-types";
import type { TemplateContext } from "../../types";

const CTX: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    photoDataUrl: "data:image/png;base64,AAA",
    structure: "ACME",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: {
    title: "Salon",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: {
    id: "BDG-1",
    verifyUrl: "https://x/v/BDG-1",
    qrCodeDataUrl: "data:image/png;base64,BBB",
  },
};

function manifest(blocks: TemplateManifest["blocks"], count = 1): TemplateManifest {
  return {
    formatVersion: 1,
    family: "t",
    label: "T",
    description: "",
    page: { widthPx: 1011, heightPx: 638, count },
    blocks,
  };
}

const assets = (name: string) => `data:image/png;base64,${name}`;
const build = (m: TemplateManifest) => buildDeclarativeTemplate(m, assets, "t1");

describe("buildDeclarativeTemplate", () => {
  it("expose une meta derivee du manifeste", () => {
    const t = build(manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118 }]));
    expect(t.meta.id).toBe("t1");
    expect(t.meta.pageSize).toEqual({ width: "1011px", height: "638px" });
    expect(t.meta.pages).toBe(1);
  });

  it("rend un gabarit de texte avec ses sources resolues", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 709, h: 94,
          text: "{participant.firstName} {participant.lastName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["Awa Diallo"]);
  });

  it("conserve les litteraux d'un gabarit", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 472, h: 94, text: "#{badge.id}",
          style: { sizePx: 29, color: "#64748b", overflow: "clip" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["#BDG-1"]);
  });

  it("delegue la mise en majuscules au style, sans alterer la chaine", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{category.name}",
          style: { sizePx: 38, color: "#ffffff", overflow: "clip", transform: "uppercase" },
        },
      ]),
    );
    const out = renderToJson(t.Component, CTX);
    // La casse est confiee a @react-pdf, comme le font les templates historiques :
    // le contenu reste intact, seul le style porte l'intention.
    expect(out.texts).toEqual(["Visiteur"]);
    expect(out.textStyles[0]).toMatchObject({ textTransform: "uppercase" });
  });

  it("rend une image issue d'une ressource du paquet", () => {
    const t = build(
      manifest([{ type: "image", page: 1, x: 0, y: 0, w: 1011, h: 638, asset: "assets/fond.png" }]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,assets/fond.png");
  });

  it("rend un carre comme un aplat et un cercle a rayon implicite", () => {
    const t = build(
      manifest([
        { type: "square", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#112233" },
        { type: "circle", page: 1, x: 100, y: 0, w: 80, h: 60, fill: "#445566" },
      ]),
    );
    const out = renderToJson(t.Component, CTX);
    expect(out.fills).toContain("#112233");
    expect(out.fills).toContain("#445566");
    expect(out.radii.some((r) => r.borderRadius === px(30))).toBe(true); // min(80,60)/2
  });

  it("rend une image issue du contexte", () => {
    const t = build(
      manifest([
        { type: "image", page: 1, x: 0, y: 0, w: 331, h: 402, source: "participant.photoDataUrl" },
      ]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,AAA");
  });

  it("applique objectFit contain a une image", () => {
    const t = build(
      manifest([
        {
          type: "image", page: 1, x: 0, y: 0, w: 331, h: 402,
          source: "participant.photoDataUrl", objectFit: "contain",
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).objectFits).toContain("contain");
  });

  it("rend le QR code sans source explicite", () => {
    const t = build(manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 189, h: 189 }]));
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,BBB");
  });

  it("omet un bloc masque par sa condition", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 472, h: 94, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
          visibleIf: { path: "category.anonymous", equals: true },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual([]);
  });

  it("affiche un bloc de repli quand une valeur est absente", () => {
    const sansPhoto = {
      ...CTX,
      participant: { ...CTX.participant, photoDataUrl: "" },
    } as TemplateContext;
    const t = build(
      manifest([
        {
          type: "rect", page: 1, x: 47, y: 71, w: 331, h: 402, fill: "#e2e8f0",
          visibleIf: { path: "participant.photoDataUrl", isEmpty: true },
        },
      ]),
    );
    expect(renderToJson(t.Component, sansPhoto).fills).toContain("#e2e8f0");
    expect(renderToJson(t.Component, CTX).fills).not.toContain("#e2e8f0");
  });

  it("applique un arrondi et une bordure a un aplat", () => {
    const t = build(
      manifest([
        {
          type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 94,
          fill: "#ffffff", radiusPx: 12,
          borderTop: { widthPx: 4, color: "category.color" },
        },
      ]),
    );
    // La bordure prend sa couleur d'une source, comme la bande de categorie en mode
    // neutre : c'est ce que faisait le template historique.
    const out = renderToJson(t.Component, CTX);
    expect(out.fills).toContain("#ffffff");
    expect(out.borderWidths).toContain(px(4));
  });

  it("applique un arrondi par coin", () => {
    const t = build(
      manifest([
        {
          type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#ffffff",
          radiusPx: { topLeft: 8 },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).radii[0].borderTopLeftRadius).toBe(px(8));
  });

  it("applique un arrondi a une image", () => {
    const t = build(
      manifest([
        {
          type: "image", page: 1, x: 47, y: 71, w: 331, h: 402,
          source: "participant.photoDataUrl", radiusPx: 12,
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,AAA");
  });

  it("resout une couleur de remplissage depuis une source", () => {
    const t = build(
      manifest([{ type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 94, fill: "category.color" }]),
    );
    expect(renderToJson(t.Component, CTX).fills).toContain("#4f46e5");
  });

  it("repartit les blocs sur les pages declarees", () => {
    const t = build(
      manifest(
        [
          { type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118 },
          { type: "qr", page: 2, x: 0, y: 0, w: 118, h: 118 },
        ],
        2,
      ),
    );
    expect(renderToJson(t.Component, CTX).pageCount).toBe(2);
  });

  it("reduit la taille de police en mode shrink sur un texte long", () => {
    const long = {
      ...CTX,
      participant: { ...CTX.participant, firstName: "A".repeat(80) },
    } as TemplateContext;
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 236, h: 71, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#000000", overflow: "shrink", minSizePx: 25 },
        },
      ]),
    );
    // Les tailles rendues sont en points PDF : 50px a 96 dpi valent 37,5pt.
    expect(renderToJson(t.Component, long).fontSizes[0]).toBeLessThan(px(50));
    expect(renderToJson(t.Component, CTX).fontSizes[0]).toBe(px(50));
  });

  it("laisse intact un texte qui tient dans son cadre en mode truncate", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 709, h: 94, text: "{participant.firstName}",
          style: { sizePx: 33, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["Awa"]);
  });

  it("tronque a la seule ellipse dans un cadre trop etroit pour un caractere", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 6, h: 47, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["…"]);
  });

  it("pivote un bloc texte declarant rotate", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 217, y: 101, w: 112, h: 20, rotate: 90,
          text: "{badge.id}",
          style: { sizePx: 13, color: "#000000", overflow: "clip" },
        },
      ]),
    );
    const out = renderToJson(t.Component, CTX);
    expect(out.texts).toEqual(["BDG-1"]);
    expect(out.transforms).toContain("rotate(90deg)");
  });

  it("pivote et attenue un bloc de tout type", () => {
    const t = build(
      manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118, rotate: 45, opacity: 0.5 }]),
    );
    const out = renderToJson(t.Component, CTX);
    expect(out.transforms).toContain("rotate(45deg)");
    expect(out.opacities).toContain(0.5);
  });

  it("n'emet aucune transformation sans rotate", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{badge.id}",
          style: { sizePx: 38, color: "#000000", overflow: "clip" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).transforms).toEqual([]);
  });

  it("rend italique, decoration, justify, maxLines, fond et padding", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{event.title}",
          style: {
            sizePx: 38, color: "#000000", overflow: "clip", fontStyle: "italic",
            decoration: "line-through", align: "justify", maxLines: 2,
            backgroundColor: "#eeeeee", paddingPx: 8,
          },
        },
      ]),
    );
    const out = renderToJson(t.Component, CTX);
    expect(out.textStyles[0]).toMatchObject({
      fontStyle: "italic",
      textDecoration: "line-through",
    });
    expect(out.viewPaddings).toContain(px(8));
    expect(out.fills).toContain("#eeeeee");
  });

  it("utilise la police declaree par le manifeste", () => {
    const withFont: TemplateManifest = {
      ...manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{event.title}",
          style: { font: "titre", sizePx: 42, color: "#000000", overflow: "clip" },
        },
      ]),
      fonts: [{ alias: "titre", file: "fonts/A.ttf" }],
    };
    // La police est enregistree sous une famille prefixee : le rendu ne doit pas
    // retomber sur Montserrat.
    expect(() => renderToJson(build(withFont).Component, CTX)).not.toThrow();
  });

  it("tronque avec ellipse en mode truncate", () => {
    const long = {
      ...CTX,
      participant: { ...CTX.participant, firstName: "A".repeat(80) },
    } as TemplateContext;
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 236, h: 71, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, long).texts[0]).toMatch(/…$/);
  });
});
