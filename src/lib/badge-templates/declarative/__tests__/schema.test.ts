import { describe, it, expect } from "vitest";
import { parseManifest } from "../schema";

const VALID = {
  formatVersion: 1,
  family: "salon-2027",
  label: "Badge Salon",
  description: "Un badge de test.",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 47,
      y: 47,
      w: 472,
      h: 94,
      text: "{participant.firstName}",
      style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
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

  it("accepte un bloc qui depasse la page (fond perdu, juge a l'oeil dans l'apercu)", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], x: 700, w: 400 }] }).ok).toBe(true);
    expect(parse({ blocks: [{ ...VALID.blocks[0], y: 590, h: 94 }] }).ok).toBe(true);
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

  it("accepte des bordures globales et par cote", () => {
    const res = parse({
      blocks: [
        {
          type: "rect", page: 1, x: 0, y: 543, w: 1011, h: 94, fill: "#ffffff",
          border: { widthPx: 2, color: "#112233", style: "dashed" },
          borderTop: { widthPx: 4, color: "category.color" },
        },
      ],
    });
    expect(res.ok, errorsOf(res)).toBe(true);
  });

  it("refuse une couleur de bordure invalide", () => {
    const res = parse({
      blocks: [
        {
          type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "#ffffff",
          border: { widthPx: 1, color: "rouge" },
        },
      ],
    });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/bordure/i);
  });

  it("accepte rotate et opacity sur tout type de bloc", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], rotate: 90, opacity: 0.5 }] }).ok).toBe(true);
    expect(
      parse({
        blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118, rotate: -45, opacity: 1 }],
      }).ok,
    ).toBe(true);
    expect(
      parse({
        blocks: [
          { type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#112233", opacity: 0.2 },
        ],
      }).ok,
    ).toBe(true);
  });

  it("refuse une rotation hors bornes", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], rotate: 400 }] }).ok).toBe(false);
  });

  it("refuse une opacite hors bornes", () => {
    expect(parse({ blocks: [{ ...VALID.blocks[0], opacity: 1.5 }] }).ok).toBe(false);
  });

  it("accepte les styles de texte etendus", () => {
    const res = parse({
      blocks: [
        {
          ...VALID.blocks[0],
          style: {
            sizePx: 38, color: "#ffffff", overflow: "clip",
            transform: "uppercase", letterSpacing: 2, lineHeight: 1.2,
          },
        },
      ],
    });
    expect(res.ok).toBe(true);
  });

  it("refuse une source de type incompatible avec le bloc", () => {
    const res = parse({
      blocks: [
        { type: "image", page: 1, x: 0, y: 0, w: 118, h: 118, source: "participant.firstName" },
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
            w: 118,
            h: 118,
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
    expect(parse({ blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 118, h: 118 }] }).ok).toBe(false);
  });

  it("refuse un asset absent du paquet", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 118, h: 118, asset: "assets/absent.png" }] },
      [],
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/absente du paquet/i);
  });

  it("accepte un asset present dans le paquet", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 118, h: 118, asset: "assets/fond.png" }] },
      ["assets/fond.png"],
    );
    expect(res.ok).toBe(true);
  });

  it("refuse une couleur ni hexadecimale ni source de couleur", () => {
    const res = parse({
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "rouge" }],
    });
    expect(res.ok).toBe(false);
  });

  it("accepte une couleur issue d'une source de type couleur", () => {
    const res = parse({
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "category.color" }],
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

  it("refuse overflow shrink sans minSizePx", () => {
    const res = parse({
      blocks: [
        { ...VALID.blocks[0], style: { sizePx: 50, color: "#000000", overflow: "shrink" } },
      ],
    });
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/minSizePx/);
  });

  it("refuse un minSizePx superieur au sizePx", () => {
    const res = parse({
      blocks: [
        {
          ...VALID.blocks[0],
          style: { sizePx: 42, color: "#000000", overflow: "shrink", minSizePx: 50 },
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
        { ...VALID.blocks[0], text: "{participant.secretField}" },
        { type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "pas-une-couleur" },
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
