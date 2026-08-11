import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
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
    page: { widthMm: 85.6, heightMm: 54, count },
    blocks,
  };
}

const assets = (name: string) => `data:image/png;base64,${name}`;
const build = (m: TemplateManifest) => buildDeclarativeTemplate(m, assets, "t1");

describe("buildDeclarativeTemplate", () => {
  it("expose une meta derivee du manifeste", () => {
    const t = build(manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }]));
    expect(t.meta.id).toBe("t1");
    expect(t.meta.pageSize).toEqual({ width: "85.6mm", height: "54mm" });
    expect(t.meta.pages).toBe(1);
  });

  it("rend un gabarit de texte avec ses sources resolues", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 4, y: 4, w: 60, h: 8,
          text: "{participant.firstName} {participant.lastName}",
          style: { sizePt: 12, color: "#0f172a", overflow: "clip" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["Awa Diallo"]);
  });

  it("conserve les litteraux d'un gabarit", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 4, y: 4, w: 40, h: 8, text: "#{badge.id}",
          style: { sizePt: 7, color: "#64748b", overflow: "clip" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["#BDG-1"]);
  });

  it("delegue la mise en majuscules au style, sans alterer la chaine", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 40, h: 8, text: "{category.name}",
          style: { sizePt: 9, color: "#ffffff", overflow: "clip", transform: "uppercase" },
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
      manifest([{ type: "image", page: 1, x: 0, y: 0, w: 85.6, h: 54, asset: "assets/fond.png" }]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,assets/fond.png");
  });

  it("rend une image issue du contexte", () => {
    const t = build(
      manifest([
        { type: "image", page: 1, x: 0, y: 0, w: 28, h: 34, source: "participant.photoDataUrl" },
      ]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,AAA");
  });

  it("rend le QR code sans source explicite", () => {
    const t = build(manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 16, h: 16 }]));
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,BBB");
  });

  it("omet un bloc masque par sa condition", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 4, y: 4, w: 40, h: 8, text: "{participant.firstName}",
          style: { sizePt: 12, color: "#0f172a", overflow: "clip" },
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
          type: "rect", page: 1, x: 4, y: 6, w: 28, h: 34, fill: "#e2e8f0",
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
          type: "rect", page: 1, x: 0, y: 46, w: 85.6, h: 8,
          fill: "#ffffff", radiusMm: 1, borderTopPt: 1, borderColor: "category.color",
        },
      ]),
    );
    // La bordure prend sa couleur d'une source, comme la bande de categorie en mode
    // neutre : c'est ce que faisait le template historique.
    expect(renderToJson(t.Component, CTX).fills).toContain("#ffffff");
  });

  it("applique un arrondi a une image", () => {
    const t = build(
      manifest([
        {
          type: "image", page: 1, x: 4, y: 6, w: 28, h: 34,
          source: "participant.photoDataUrl", radiusMm: 1,
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,AAA");
  });

  it("resout une couleur de remplissage depuis une source", () => {
    const t = build(
      manifest([{ type: "rect", page: 1, x: 0, y: 46, w: 85.6, h: 8, fill: "category.color" }]),
    );
    expect(renderToJson(t.Component, CTX).fills).toContain("#4f46e5");
  });

  it("repartit les blocs sur les pages declarees", () => {
    const t = build(
      manifest(
        [
          { type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 },
          { type: "qr", page: 2, x: 0, y: 0, w: 10, h: 10 },
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
          type: "text", page: 1, x: 4, y: 4, w: 20, h: 6, text: "{participant.firstName}",
          style: { sizePt: 12, color: "#000000", overflow: "shrink", minSizePt: 6 },
        },
      ]),
    );
    expect(renderToJson(t.Component, long).fontSizes[0]).toBeLessThan(12);
    expect(renderToJson(t.Component, CTX).fontSizes[0]).toBe(12);
  });

  it("laisse intact un texte qui tient dans son cadre en mode truncate", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 60, h: 8, text: "{participant.firstName}",
          style: { sizePt: 8, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["Awa"]);
  });

  it("tronque a la seule ellipse dans un cadre trop etroit pour un caractere", () => {
    const t = build(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 0.5, h: 4, text: "{participant.firstName}",
          style: { sizePt: 12, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual(["…"]);
  });

  it("utilise la police declaree par le manifeste", () => {
    const withFont: TemplateManifest = {
      ...manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 40, h: 8, text: "{event.title}",
          style: { font: "titre", sizePt: 10, color: "#000000", overflow: "clip" },
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
          type: "text", page: 1, x: 4, y: 4, w: 20, h: 6, text: "{participant.firstName}",
          style: { sizePt: 12, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(renderToJson(t.Component, long).texts[0]).toMatch(/…$/);
  });
});
