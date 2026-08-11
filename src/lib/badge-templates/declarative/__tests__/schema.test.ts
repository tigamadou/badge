import { describe, it, expect } from "vitest";
import { parseManifest } from "../schema";

const VALID = {
  formatVersion: 1,
  family: "salon-2027",
  label: "Badge Salon",
  description: "Un badge de test.",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 4,
      y: 4,
      w: 40,
      h: 8,
      text: "{participant.firstName}",
      style: { sizePt: 12, color: "#0f172a", overflow: "clip" },
    },
  ],
};

function parse(overrides: Record<string, unknown> = {}, entries: string[] = []) {
  return parseManifest({ ...VALID, ...overrides }, entries);
}

function errorsOf(res: ReturnType<typeof parse>): string {
  return res.ok === false ? res.errors.join(" | ") : "";
}

describe("parseManifest", () => {
  it("accepte un manifeste minimal", () => {
    expect(parse().ok).toBe(true);
  });

  it("refuse un formatVersion inconnu", () => {
    expect(parse({ formatVersion: 2 }).ok).toBe(false);
  });

  it("refuse un bloc qui sort de la page en largeur", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], x: 60, w: 40 }] });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/hors de la page/i);
  });

  it("refuse un bloc qui sort de la page en hauteur", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], y: 50, h: 10 }] }).ok).toBe(false);
  });

  it("refuse un bloc dont la page depasse le nombre de pages", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], page: 2 }] }).ok).toBe(false);
  });

  it("refuse plus de 60 blocs", () => {
    expect(parse({ blocks: Array.from({ length: 61 }, () => VALID.blocks[0]) }).ok).toBe(false);
  });

  it("refuse une source hors liste blanche dans un gabarit", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], text: "{participant.secretField}" }] });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/source inconnue/i);
  });

  it("accepte un gabarit combinant plusieurs sources et des litteraux", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], text: "{participant.firstName} {participant.lastName}" }],
    });
    expect(res.ok).toBe(true);
  });

  it("accepte un gabarit purement litteral", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], text: "Participant anonyme" }] });
    expect(res.ok).toBe(true);
  });

  it("refuse un gabarit reduit a des espaces", () => {
    // Zod n'exige qu'une longueur minimale : "   " le franchit mais ne rend rien.
    const res = parse({ blocks: [{ ...VALID.blocks[0], text: "   " }] });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/vide/i);
  });

  it("refuse une source de type image dans un gabarit de texte", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], text: "{participant.photoDataUrl}" }] });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/incompatible/i);
  });

  it("accepte un visibleIf de forme isEmpty sur un chemin non booleen", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], visibleIf: { path: "participant.photoDataUrl", isEmpty: true } }],
    });
    expect(res.ok).toBe(true);
  });

  it("refuse un visibleIf de forme equals sur un chemin non booleen", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], visibleIf: { path: "participant.photoDataUrl", equals: true } }],
    });
    expect(res.ok).toBe(false);
  });

  it("accepte une bande avec bordure", () => {
    const res = parse({
      blocks: [
        {
          type: "rect", page: 1, x: 0, y: 46, w: 85.6, h: 8,
          fill: "#ffffff", borderTopPt: 1, borderColor: "category.color",
        },
      ],
    });
    expect(res.ok).toBe(true);
  });

  it("accepte les styles de texte etendus", () => {
    const res = parse({
      blocks: [
        {
          ...VALID.blocks[0],
          style: {
            sizePt: 9, color: "#ffffff", overflow: "clip",
            transform: "uppercase", letterSpacing: 0.5, lineHeight: 1.2,
          },
        },
      ],
    });
    expect(res.ok).toBe(true);
  });

  it("refuse une source de type incompatible avec le bloc", () => {
    const res = parse({
      blocks: [
        { type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, source: "participant.firstName" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/incompatible/i);
  });

  it("refuse un bloc image portant a la fois source et asset", () => {
    const res = parse(
      {
        blocks: [
          {
            type: "image",
            page: 1,
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            source: "participant.photoDataUrl",
            asset: "assets/f.png",
          },
        ],
      },
      ["assets/f.png"],
    );
    expect(res.ok).toBe(false);
  });

  it("refuse un bloc image sans source ni asset", () => {
    expect(parse({ blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10 }] }).ok).toBe(false);
  });

  it("refuse un asset absent du paquet", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, asset: "assets/absent.png" }] },
      [],
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/absente du paquet/i);
  });

  it("accepte un asset present dans le paquet", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, asset: "assets/fond.png" }] },
      ["assets/fond.png"],
    );
    expect(res.ok).toBe(true);
  });

  it("refuse une couleur ni hexadecimale ni source de couleur", () => {
    const res = parse({
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "rouge" }],
    });
    expect(res.ok).toBe(false);
  });

  it("accepte une couleur issue d'une source de type couleur", () => {
    const res = parse({
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "category.color" }],
    });
    expect(res.ok).toBe(true);
  });

  it("refuse un style.font sans alias declare", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], style: { ...VALID.blocks[0].style, font: "titre" } }],
    });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/non declaree/i);
  });

  it("accepte un style.font correspondant a un alias declare", () => {
    const res = parse(
      {
        fonts: [{ alias: "titre", file: "fonts/A.ttf" }],
        blocks: [{ ...VALID.blocks[0], style: { ...VALID.blocks[0].style, font: "titre" } }],
      },
      ["fonts/A.ttf"],
    );
    expect(res.ok).toBe(true);
  });

  it("refuse une police dont le fichier est absent du paquet", () => {
    const res = parse({ fonts: [{ alias: "titre", file: "fonts/Absent.ttf" }] }, []);
    expect(res.ok).toBe(false);
  });

  it("refuse overflow shrink sans minSizePt", () => {
    const res = parse({
      blocks: [
        { ...VALID.blocks[0], style: { sizePt: 12, color: "#000000", overflow: "shrink" } },
      ],
    });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/minSizePt/);
  });

  it("refuse un minSizePt superieur au sizePt", () => {
    const res = parse({
      blocks: [
        {
          ...VALID.blocks[0],
          style: { sizePt: 10, color: "#000000", overflow: "shrink", minSizePt: 12 },
        },
      ],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse un visibleIf sur un chemin non autorise", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], visibleIf: { path: "event.title", equals: true } }],
    });
    expect(res.ok).toBe(false);
  });

  it("accepte un visibleIf sur un chemin autorise", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], visibleIf: { path: "category.anonymous", equals: false } }],
    });
    expect(res.ok).toBe(true);
  });

  it("accumule plusieurs erreurs en une passe", () => {
    const res = parse({
      blocks: [
        { ...VALID.blocks[0], x: 90 },
        { type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "pas-une-couleur" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.length).toBeGreaterThan(1);
  });

  it("accepte un apercu declare et present dans le paquet", () => {
    const res = parse({ preview: "assets/apercu.png" }, ["assets/apercu.png"]);
    expect(res.ok, errorsOf(res)).toBe(true);
  });

  it("accepte un manifeste sans apercu", () => {
    expect(parse().ok).toBe(true);
  });

  it("refuse un apercu absent du paquet", () => {
    const res = parse({ preview: "assets/absent.png" }, []);
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/apercu/i);
  });

  it("refuse une famille qui n'est pas un slug kebab-case", () => {
    expect(parse({ family: "Salon 2027" }).ok).toBe(false);
  });

  it("refuse une entree qui n'est pas un objet, sans chemin d'erreur", () => {
    const res = parseManifest(42, []);
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/^manifeste :/);
  });
});
