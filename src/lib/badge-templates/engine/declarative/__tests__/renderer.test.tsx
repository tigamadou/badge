import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
import { DeclarativeDocument } from "../renderer";
import { px } from "../../px";
import type { TemplateManifest, VariableValues } from "../manifest-types";

// Valeurs d'epreuve couvrant toutes les references employees par les blocs de ce
// fichier : un objet plat, comme le consomme desormais le moteur.
const VALUES: VariableValues = {
  "participant.firstName": "Awa",
  "participant.lastName": "Diallo",
  "participant.photoDataUrl": "data:image/png;base64,AAA",
  "category.name": "Visiteur",
  "category.color": "#4f46e5",
  "category.anonymous": false,
  "event.title": "Salon",
  "badge.id": "BDG-1",
  "badge.qrCodeDataUrl": "data:image/png;base64,BBB",
};

const MANIFEST: TemplateManifest = {
  formatVersion: 2,
  family: "t",
  label: "T",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  variables: [
    { name: "participant.firstName", kind: "text", label: "Prenom" },
    { name: "participant.lastName", kind: "text", label: "Nom" },
    { name: "participant.photoDataUrl", kind: "image", label: "Photo" },
    { name: "category.name", kind: "text", label: "Categorie" },
    { name: "category.color", kind: "color", label: "Couleur de categorie" },
    { name: "category.anonymous", kind: "boolean", label: "Anonyme" },
    { name: "event.title", kind: "text", label: "Titre" },
    { name: "badge.id", kind: "text", label: "Identifiant" },
    { name: "badge.qrCodeDataUrl", kind: "image", label: "QR code" },
  ],
  blocks: [],
};

function manifest(blocks: TemplateManifest["blocks"], count = 1): TemplateManifest {
  return { ...MANIFEST, page: { ...MANIFEST.page, count }, blocks };
}

const ASSETS = (name: string) => `data:image/png;base64,${name}`;

// Rend directement le composant produit par le moteur, sans passer par le
// registre (`buildDeclarativeTemplate`) : c'est l'interface de ce fichier.
function render(m: TemplateManifest, values: VariableValues = VALUES) {
  return renderToJson(
    <DeclarativeDocument manifest={m} assets={ASSETS} templateId="t1" values={values} />,
  );
}

describe("DeclarativeDocument", () => {
  it("expose une meta derivee du manifeste", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#000000" }]),
      ASSETS,
      "t1",
    );
    expect(t.meta.id).toBe("t1");
    expect(t.meta.pageSize).toEqual({ width: "1011px", height: "638px" });
    expect(t.meta.pages).toBe(1);
  });

  it("rend un gabarit de texte avec ses sources resolues", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 709, h: 94,
          text: "{participant.firstName} {participant.lastName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
        },
      ]),
    );
    expect(out.texts).toEqual(["Awa Diallo"]);
  });

  it("conserve les litteraux d'un gabarit", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 472, h: 94, text: "#{badge.id}",
          style: { sizePx: 29, color: "#64748b", overflow: "clip" },
        },
      ]),
    );
    expect(out.texts).toEqual(["#BDG-1"]);
  });

  it("delegue la mise en majuscules au style, sans alterer la chaine", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{category.name}",
          style: { sizePx: 38, color: "#ffffff", overflow: "clip", transform: "uppercase" },
        },
      ]),
    );
    // La casse est confiee a @react-pdf, comme le font les templates historiques :
    // le contenu reste intact, seul le style porte l'intention.
    expect(out.texts).toEqual(["Visiteur"]);
    expect(out.textStyles[0]).toMatchObject({ textTransform: "uppercase" });
  });

  it("rend le fond image d'une forme, rogne par elle", () => {
    const out = render(
      manifest([
        {
          type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#e2e8f0",
          image: { asset: "assets/fond.png", fit: "contain" },
        },
      ]),
    );
    expect(out.images).toContain("data:image/png;base64,assets/fond.png");
    expect(out.objectFits).toContain("contain");
    expect(out.fills).toContain("#e2e8f0");
  });

  it("rend un carre comme un aplat et un cercle a rayon implicite", () => {
    const out = render(
      manifest([
        { type: "square", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#112233" },
        { type: "circle", page: 1, x: 100, y: 0, w: 80, h: 60, fill: "#445566" },
      ]),
    );
    expect(out.fills).toContain("#112233");
    expect(out.fills).toContain("#445566");
    expect(out.radii.some((r) => r.borderRadius === px(30))).toBe(true); // min(80,60)/2
  });

  it("rend le fond image issu d'une variable", () => {
    const out = render(
      manifest([
        {
          type: "rect", page: 1, x: 0, y: 0, w: 331, h: 402,
          image: { source: "participant.photoDataUrl" },
        },
      ]),
    );
    expect(out.images).toContain("data:image/png;base64,AAA");
  });

  it("rend recursivement les enfants d'un groupe", () => {
    const out = render(
      manifest([
        {
          type: "group", page: 1, x: 10, y: 10, w: 300, h: 100, opacity: 0.5,
          blocks: [
            {
              type: "text", x: 0, y: 0, w: 200, h: 40, text: "{participant.firstName}",
              style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
            },
            {
              type: "group", x: 0, y: 50, w: 100, h: 50,
              blocks: [
                {
                  type: "rect", x: 0, y: 0, w: 40, h: 40,
                  image: { source: "badge.qrCodeDataUrl" },
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(out.texts).toEqual(["Awa"]);
    expect(out.images).toContain("data:image/png;base64,BBB"); // l'image imbriquee
    expect(out.opacities).toContain(0.5);
  });

  it("masque tout un groupe via sa condition", () => {
    const out = render(
      manifest([
        {
          type: "group", page: 1, x: 0, y: 0, w: 100, h: 50,
          visibleIf: { variable: "category.anonymous", equals: true },
          blocks: [
            {
              type: "text", x: 0, y: 0, w: 80, h: 30, text: "{participant.firstName}",
              style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
            },
          ],
        },
      ]),
    );
    expect(out.texts).toEqual([]); // VALUES n'est pas anonyme
  });

  it("omet un bloc masque par sa condition", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 47, y: 47, w: 472, h: 94, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
          visibleIf: { variable: "category.anonymous", equals: true },
        },
      ]),
    );
    expect(out.texts).toEqual([]);
  });

  it("affiche un bloc de repli quand une valeur est absente", () => {
    const sansPhoto: VariableValues = { ...VALUES, "participant.photoDataUrl": "" };
    const m = manifest([
      {
        type: "rect", page: 1, x: 47, y: 71, w: 331, h: 402, fill: "#e2e8f0",
        visibleIf: { variable: "participant.photoDataUrl", isEmpty: true },
      },
    ]);
    // Le meme bloc, sous deux jeux de valeurs : un cas affiche, un cas masque —
    // c'est ce qui distingue un bloc reellement conditionnel d'un bloc toujours visible.
    expect(render(m, sansPhoto).fills).toContain("#e2e8f0");
    expect(render(m, VALUES).fills).not.toContain("#e2e8f0");
  });

  it("applique un arrondi et une bordure a un aplat", () => {
    const out = render(
      manifest([
        {
          type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 94,
          fill: "#ffffff", radiusPx: 12,
          borderTop: { widthPx: 4, color: "category.color" },
        },
      ]),
    );
    // La bordure prend sa couleur d'une variable, comme la bande de categorie en
    // mode neutre : c'est ce que faisait le template historique.
    expect(out.fills).toContain("#ffffff");
    expect(out.borderWidths).toContain(px(4));
  });

  it("applique un arrondi par coin", () => {
    const out = render(
      manifest([
        {
          type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#ffffff",
          radiusPx: { topLeft: 8 },
        },
      ]),
    );
    expect(out.radii[0].borderTopLeftRadius).toBe(px(8));
  });

  it("applique un arrondi a une forme a fond image", () => {
    const out = render(
      manifest([
        {
          type: "rect", page: 1, x: 47, y: 71, w: 331, h: 402,
          image: { source: "participant.photoDataUrl" }, radiusPx: 12,
        },
      ]),
    );
    expect(out.images).toContain("data:image/png;base64,AAA");
  });

  it("resout une couleur de remplissage depuis une variable", () => {
    const out = render(
      manifest([{ type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 94, fill: "category.color" }]),
    );
    expect(out.fills).toContain("#4f46e5");
  });

  it("repartit les blocs sur les pages declarees", () => {
    const out = render(
      manifest(
        [
          { type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#000000" },
          { type: "rect", page: 2, x: 0, y: 0, w: 118, h: 118, fill: "#000000" },
        ],
        2,
      ),
    );
    expect(out.pageCount).toBe(2);
  });

  it("reduit la taille de police en mode shrink sur un texte long", () => {
    const long: VariableValues = { ...VALUES, "participant.firstName": "A".repeat(80) };
    const m = manifest([
      {
        type: "text", page: 1, x: 47, y: 47, w: 236, h: 71, text: "{participant.firstName}",
        style: { sizePx: 50, color: "#000000", overflow: "shrink", minSizePx: 25 },
      },
    ]);
    // Les tailles rendues sont en points PDF : 50px a 96 dpi valent 37,5pt.
    expect(render(m, long).fontSizes[0]).toBeLessThan(px(50));
    expect(render(m, VALUES).fontSizes[0]).toBe(px(50));
  });

  it("laisse intact un texte qui tient dans son cadre en mode truncate", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 709, h: 94, text: "{participant.firstName}",
          style: { sizePx: 33, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(out.texts).toEqual(["Awa"]);
  });

  it("tronque a la seule ellipse dans un cadre trop etroit pour un caractere", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 6, h: 47, text: "{participant.firstName}",
          style: { sizePx: 50, color: "#000000", overflow: "truncate" },
        },
      ]),
    );
    expect(out.texts).toEqual(["…"]);
  });

  it("pivote un bloc texte declarant rotate", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 217, y: 101, w: 112, h: 20, rotate: 90,
          text: "{badge.id}",
          style: { sizePx: 13, color: "#000000", overflow: "clip" },
        },
      ]),
    );
    expect(out.texts).toEqual(["BDG-1"]);
    expect(out.transforms).toContain("rotate(90deg)");
  });

  it("pivote et attenue un bloc de tout type", () => {
    const out = render(
      manifest([
        { type: "square", page: 1, x: 0, y: 0, w: 118, h: 118, rotate: 45, opacity: 0.5 },
      ]),
    );
    expect(out.transforms).toContain("rotate(45deg)");
    expect(out.opacities).toContain(0.5);
  });

  it("n'emet aucune transformation sans rotate", () => {
    const out = render(
      manifest([
        {
          type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{badge.id}",
          style: { sizePx: 38, color: "#000000", overflow: "clip" },
        },
      ]),
    );
    expect(out.transforms).toEqual([]);
  });

  it("rend italique, decoration, justify, maxLines, fond et padding", () => {
    const out = render(
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
    expect(() => render(withFont)).not.toThrow();
  });

  it("tronque avec ellipse en mode truncate", () => {
    const long: VariableValues = { ...VALUES, "participant.firstName": "A".repeat(80) };
    const m = manifest([
      {
        type: "text", page: 1, x: 47, y: 47, w: 236, h: 71, text: "{participant.firstName}",
        style: { sizePx: 50, color: "#000000", overflow: "truncate" },
      },
    ]);
    expect(render(m, long).texts[0]).toMatch(/…$/);
  });

  it("masque un groupe via une condition nommee", () => {
    const m = {
      ...MANIFEST,
      conditions: [{ name: "estAnonyme", when: { variable: "category.anonymous", equals: true } }],
      blocks: [
        {
          type: "group" as const,
          page: 1,
          x: 0, y: 0, w: 200, h: 100,
          visibleIf: { use: "estAnonyme" },
          blocks: [
            {
              type: "text" as const,
              x: 0, y: 0, w: 100, h: 20,
              text: "{participant.firstName}",
              style: { sizePx: 12, color: "#000000", overflow: "clip" as const },
            },
          ],
        },
      ],
    } as unknown as TemplateManifest;

    // category.anonymous vaut false dans VALUES : le groupe et son enfant sortent.
    expect(render(m).texts).toEqual([]);
    expect(render(m, { ...VALUES, "category.anonymous": true }).texts).toEqual(["Awa"]);
  });

  it("propage l'index des conditions nommees au filtrage des enfants d'un groupe", () => {
    // Le groupe racine n'a lui-meme AUCUNE condition : il traverse le filtre
    // des blocs racine sans jamais toucher a l'index. Seuls ses enfants —
    // l'un direct, l'un imbrique dans un sous-groupe — portent visibleIf.use.
    // Si le filtre des enfants d'un groupe retombait sur l'index par defaut
    // ({}), ces deux enfants resteraient visibles a tort.
    const m = {
      ...MANIFEST,
      conditions: [{ name: "estAnonyme", when: { variable: "category.anonymous", equals: true } }],
      blocks: [
        {
          type: "group" as const,
          page: 1,
          x: 0, y: 0, w: 200, h: 100,
          blocks: [
            {
              type: "text" as const,
              x: 0, y: 0, w: 100, h: 20,
              text: "{participant.firstName}",
              visibleIf: { use: "estAnonyme" },
              style: { sizePx: 12, color: "#000000", overflow: "clip" as const },
            },
            {
              type: "group" as const,
              x: 0, y: 30, w: 100, h: 20,
              blocks: [
                {
                  type: "text" as const,
                  x: 0, y: 0, w: 100, h: 20,
                  text: "{participant.lastName}",
                  visibleIf: { use: "estAnonyme" },
                  style: { sizePx: 12, color: "#000000", overflow: "clip" as const },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as TemplateManifest;

    expect(render(m).texts).toEqual([]);
    expect(render(m, { ...VALUES, "category.anonymous": true }).texts).toEqual(["Awa", "Diallo"]);
  });

  it("rend un texte vide quand la valeur manque, sans lever", async () => {
    const manifestSansValeur = {
      ...MANIFEST,
      variables: [{ name: "mention", kind: "text" as const, label: "Mention" }],
      blocks: [
        {
          type: "text" as const,
          page: 1,
          x: 0,
          y: 0,
          w: 100,
          h: 20,
          text: "[{mention}]",
          style: { sizePx: 10, color: "#000000", overflow: "clip" as const },
        },
      ],
    };
    const json = await renderToJson(
      <DeclarativeDocument manifest={manifestSansValeur} assets={ASSETS} templateId="t" values={{}} />,
    );
    expect(JSON.stringify(json)).toContain("[]");
  });
});
