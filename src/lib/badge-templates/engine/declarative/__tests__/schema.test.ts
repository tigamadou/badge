import { describe, it, expect } from "vitest";
import { parseManifest } from "../schema";

const VARIABLES = [
  { name: "participant.firstName", kind: "text", label: "Prenom", sample: "Awa" },
  { name: "participant.photo", kind: "image", label: "Photo", sample: "assets/photo.png" },
  { name: "category.anonymous", kind: "boolean", label: "Anonyme", sample: false },
  { name: "category.color", kind: "color", label: "Couleur", sample: "#4f46e5" },
  { name: "event.date", kind: "date", label: "Date", format: "long", sample: "2027-12-15T00:00:00.000Z" },
];

const BASE = {
  formatVersion: 2,
  family: "demo",
  label: "Demo",
  description: "Un template de demonstration.",
  page: { widthPx: 323.53, heightPx: 204.09, count: 1 },
  variables: VARIABLES,
  blocks: [
    {
      type: "text",
      page: 1,
      x: 10,
      y: 10,
      w: 200,
      h: 30,
      text: "{participant.firstName}",
      style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
    },
  ],
};

const ENTRIES = ["assets/photo.png"];
const parse = (manifest: unknown, entries: string[] = ENTRIES) => parseManifest(manifest, entries);
const errorsOf = (manifest: unknown, entries: string[] = ENTRIES) => {
  const result = parse(manifest, entries);
  return result.ok ? [] : result.errors;
};

describe("parseManifest — format", () => {
  it("accepte un manifeste v2 minimal", () => {
    expect(parse(BASE).ok).toBe(true);
  });

  it("refuse un manifeste v1 avec un message qui indique la migration", () => {
    const errors = errorsOf({ ...BASE, formatVersion: 1 });
    expect(errors).toEqual([
      'manifeste : formatVersion 1 n\'est plus supporte, migrez avec "make migrate-template NAME=<famille>".',
    ]);
  });

  it("refuse un formatVersion inconnu", () => {
    expect(parse({ ...BASE, formatVersion: 9 }).ok).toBe(false);
  });

  it("refuse un bloc de type qr, supprime en v2", () => {
    const blocks = [{ type: "qr", page: 1, x: 0, y: 0, w: 60, h: 60 }];
    expect(parse({ ...BASE, blocks }).ok).toBe(false);
  });
});

describe("parseManifest — variables", () => {
  it("refuse un nom de variable hors grammaire", () => {
    const variables = [...VARIABLES, { name: "Participant.Prenom", kind: "text", label: "X" }];
    expect(parse({ ...BASE, variables }).ok).toBe(false);
  });

  it("refuse un nom de plus de trois segments", () => {
    const variables = [...VARIABLES, { name: "a.b.c.d", kind: "text", label: "Trop profond" }];
    expect(errorsOf({ ...BASE, variables }).join()).toMatch(/trois segments/);
  });

  it("refuse deux variables de meme nom", () => {
    const variables = [...VARIABLES, { name: "participant.firstName", kind: "text", label: "Doublon" }];
    expect(errorsOf({ ...BASE, variables }).join()).toMatch(/declaree deux fois/);
  });

  it("refuse un sample incompatible avec le kind", () => {
    const variables = [...VARIABLES, { name: "flag", kind: "boolean", label: "Drapeau", sample: "oui" }];
    expect(errorsOf({ ...BASE, variables }).join()).toMatch(/sample/);
  });

  it("refuse un sample d'image absent du paquet", () => {
    expect(errorsOf(BASE, []).join()).toMatch(/absente du paquet|absent du paquet/);
  });

  it("refuse un format sur une variable qui n'est pas une date", () => {
    const variables = [...VARIABLES, { name: "note", kind: "text", label: "Note", format: "court" }];
    expect(errorsOf({ ...BASE, variables }).join()).toMatch(/format/);
  });
});

describe("parseManifest — references", () => {
  it("refuse un gabarit citant une variable non declaree", () => {
    const blocks = [{ ...BASE.blocks[0], text: "{participant.inconnu}" }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/non declaree/);
  });

  it("refuse un gabarit citant une variable image", () => {
    const blocks = [{ ...BASE.blocks[0], text: "{participant.photo}" }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/incompatible/);
  });

  it("accepte une variable date dans un gabarit", () => {
    const blocks = [{ ...BASE.blocks[0], text: "{event.date}" }];
    expect(parse({ ...BASE, blocks }).ok).toBe(true);
  });

  it("accepte une variable couleur comme remplissage", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "rect", page: 1, x: 0, y: 174, w: 323.5, h: 30, fill: "category.color" },
    ];
    expect(parse({ ...BASE, blocks }).ok).toBe(true);
  });

  it("refuse une variable texte comme remplissage", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "rect", page: 1, x: 0, y: 174, w: 323.5, h: 30, fill: "participant.firstName" },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/couleur/);
  });

  it("refuse une source d'image qui n'est pas une variable image", () => {
    const blocks = [
      ...BASE.blocks,
      {
        type: "square",
        page: 1,
        x: 0,
        y: 0,
        w: 60,
        h: 60,
        image: { source: "participant.firstName" },
      },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/incompatible/);
  });
});

describe("parseManifest — conditions", () => {
  it("accepte un equals sur une variable booleenne", () => {
    const blocks = [{ ...BASE.blocks[0], visibleIf: { variable: "category.anonymous", equals: false } }];
    expect(parse({ ...BASE, blocks }).ok).toBe(true);
  });

  it("refuse un equals sur une variable non booleenne", () => {
    const blocks = [{ ...BASE.blocks[0], visibleIf: { variable: "participant.firstName", equals: true } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/booleenne/);
  });

  it("accepte un isEmpty sur n'importe quelle variable", () => {
    const blocks = [{ ...BASE.blocks[0], visibleIf: { variable: "participant.photo", isEmpty: false } }];
    expect(parse({ ...BASE, blocks }).ok).toBe(true);
  });

  it("refuse une condition sur une variable non declaree", () => {
    const blocks = [{ ...BASE.blocks[0], visibleIf: { variable: "inconnue", isEmpty: true } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/non declaree/);
  });
});

describe("parseManifest — groupes", () => {
  it("valide recursivement les references d'un bloc de groupe", () => {
    const blocks = [
      {
        type: "group",
        page: 1,
        x: 0,
        y: 0,
        w: 200,
        h: 100,
        blocks: [
          {
            type: "text",
            x: 0,
            y: 0,
            w: 100,
            h: 20,
            text: "{inconnue.variable}",
            style: { sizePx: 12, color: "#0f172a", overflow: "clip" },
          },
        ],
      },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/non declaree/);
  });

  it("localise l'erreur d'un enfant de groupe qui declare une page", () => {
    const blocks = [
      {
        type: "group",
        page: 1,
        x: 0,
        y: 0,
        w: 200,
        h: 100,
        blocks: [
          {
            type: "text",
            page: 1,
            x: 0,
            y: 0,
            w: 100,
            h: 20,
            text: "{participant.firstName}",
            style: { sizePx: 12, color: "#0f172a", overflow: "clip" },
          },
        ],
      },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/bloc 1 › 1 : page interdite/i);
  });
});

describe("parseManifest — presets", () => {
  it("accepte un preset sur des variables declarees", () => {
    const presets = [{ label: "Sans photo", values: { "participant.photo": "" } }];
    expect(parse({ ...BASE, presets }).ok).toBe(true);
  });

  it("refuse un preset citant une variable non declaree", () => {
    const presets = [{ label: "X", values: { inconnue: "a" } }];
    expect(errorsOf({ ...BASE, presets }).join()).toMatch(/non declaree/);
  });

  it("refuse une valeur de preset du mauvais type", () => {
    const presets = [{ label: "X", values: { "category.anonymous": "oui" } }];
    expect(errorsOf({ ...BASE, presets }).join()).toMatch(/booleenne|type/);
  });
});

describe("parseManifest — regles de blocs conservees", () => {
  it("exige la page a la racine", () => {
    const blocks = [{ ...BASE.blocks[0], page: undefined }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/page manquante/);
  });

  it("exige w = h sur un carre", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "square", page: 1, x: 0, y: 0, w: 60, h: 40, fill: "#000000" },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/carre/);
  });

  it("laisse une variable declaree mais inutilisee passer", () => {
    const variables = [...VARIABLES, { name: "mention", kind: "text", label: "Mention" }];
    expect(parse({ ...BASE, variables }).ok).toBe(true);
  });

  it("refuse plus de 60 blocs, groupes et enfants compris", () => {
    const many = Array.from({ length: 61 }, () => ({
      type: "rect",
      page: 1,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      fill: "#000000",
    }));
    expect(errorsOf({ ...BASE, blocks: many }).join()).toMatch(/plus de 60 blocs/);
  });

  it("exige un fond sur une forme (fill ou image)", () => {
    const blocks = [...BASE.blocks, { type: "rect", page: 1, x: 0, y: 174, w: 323.5, h: 30 }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/exige un fond/);
  });

  it("refuse une image sans source ni asset", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "rect", page: 1, x: 0, y: 174, w: 323.5, h: 30, image: {} },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/soit source, soit asset/);
  });

  it("refuse une image avec source et asset a la fois", () => {
    const blocks = [
      ...BASE.blocks,
      {
        type: "rect",
        page: 1,
        x: 0,
        y: 174,
        w: 323.5,
        h: 30,
        image: { source: "participant.photo", asset: "assets/photo.png" },
      },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/soit source, soit asset/);
  });

  it("exige un minSizePx quand overflow vaut shrink", () => {
    const blocks = [{ ...BASE.blocks[0], style: { ...BASE.blocks[0].style, overflow: "shrink" } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/exige un minSizePx/);
  });

  it("refuse une police non declaree dans fonts", () => {
    const blocks = [{ ...BASE.blocks[0], style: { ...BASE.blocks[0].style, font: "Inconnue" } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/police "Inconnue" non declaree/);
  });
});

// Regles toujours en vigueur dans schema.ts mais qui avaient perdu leur seul test a
// la reecriture de ce fichier (le passage de 52 a 34 `it`). Chaque fixture part de
// BASE et n'introduit qu'un seul defaut, pour que l'assertion pointe exactement la
// regle visee.
describe("regles conservees", () => {
  it("refuse un nom de bloc de plus de 60 caracteres", () => {
    const blocks = [{ ...BASE.blocks[0], name: "x".repeat(61) }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/<=60 character/);
  });

  it("refuse un nom de bloc vide", () => {
    const blocks = [{ ...BASE.blocks[0], name: "" }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/>=1 character/);
  });

  it("refuse radiusPx sur un cercle", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "circle", page: 1, x: 0, y: 0, w: 40, h: 40, fill: "#000000", radiusPx: 10 },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/rayon implicite/);
  });

  it("refuse une page de bloc superieure a page.count", () => {
    const blocks = [{ ...BASE.blocks[0], page: 2 }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/page 2 alors que le manifeste en declare 1/);
  });

  it("refuse une rotation hors ±360", () => {
    const blocks = [{ ...BASE.blocks[0], rotate: 400 }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/<=360/);
  });

  it("refuse une opacite hors 0-1", () => {
    const blocks = [{ ...BASE.blocks[0], opacity: 1.5 }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/<=1/);
  });

  it("refuse un maxLines inferieur a 1", () => {
    const blocks = [{ ...BASE.blocks[0], style: { ...BASE.blocks[0].style, maxLines: 0 } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/>=1/);
  });

  it("refuse une couleur de bordure invalide", () => {
    const blocks = [{ ...BASE.blocks[0], borderRight: { widthPx: 1, color: "pasunecouleur" } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(
      /n'est ni une couleur hexadecimale ni une variable de type couleur/,
    );
  });

  it("refuse un style.backgroundColor invalide", () => {
    const blocks = [
      { ...BASE.blocks[0], style: { ...BASE.blocks[0].style, backgroundColor: "pasunecouleur" } },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(
      /n'est ni une couleur hexadecimale ni une variable de type couleur/,
    );
  });

  it("refuse un minSizePx superieur a sizePx", () => {
    const blocks = [{ ...BASE.blocks[0], style: { ...BASE.blocks[0].style, minSizePx: 20 } }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/minSizePx superieur a sizePx/);
  });

  it("refuse un gabarit de texte compose uniquement d'espaces", () => {
    const blocks = [{ ...BASE.blocks[0], text: "   " }];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/gabarit de texte est vide/);
  });

  it("refuse un image.asset absent du paquet", () => {
    const blocks = [
      ...BASE.blocks,
      { type: "square", page: 1, x: 0, y: 0, w: 60, h: 60, image: { asset: "assets/absent.png" } },
    ];
    expect(errorsOf({ ...BASE, blocks }).join()).toMatch(/ressource "assets\/absent\.png" absente du paquet/);
  });

  it("refuse un fichier de police absent du paquet", () => {
    const manifest = { ...BASE, fonts: [{ alias: "titre", file: "fonts/absent.ttf" }] };
    expect(errorsOf(manifest).join()).toMatch(/police "titre" : fichier "fonts\/absent\.ttf" absent du paquet/);
  });

  it("refuse un apercu (preview) absent du paquet", () => {
    const manifest = { ...BASE, preview: "assets/absent.png" };
    expect(errorsOf(manifest).join()).toMatch(/apercu : fichier "assets\/absent\.png" absent du paquet/);
  });

  it("refuse une family hors slug", () => {
    const manifest = { ...BASE, family: "Not Valid!" };
    expect(errorsOf(manifest).join()).toMatch(/family : Invalid string: must match pattern/);
  });

  it("prefixe l'erreur par \"manifeste :\" pour une entree non objet", () => {
    expect(errorsOf("pas un objet")[0]).toMatch(/^manifeste :/);
    expect(errorsOf(null)[0]).toMatch(/^manifeste :/);
    expect(errorsOf([1, 2, 3])[0]).toMatch(/^manifeste :/);
  });

  it("accepte un radiusPx par coin", () => {
    const blocks = [
      { ...BASE.blocks[0], radiusPx: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } },
    ];
    expect(parse({ ...BASE, blocks }).ok).toBe(true);
  });

  it("refuse plus de 40 variables (MAX_VARIABLES)", () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ name: `v${i}`, kind: "text", label: `L${i}` }));
    const variables = [...VARIABLES, ...many];
    expect(errorsOf({ ...BASE, variables }).join()).toMatch(/<=40 items/);
  });
});

describe("conditions nommees", () => {
  // `entries` doit contenir la ressource citee par le sample d'image de VARIABLES,
  // sans quoi le manifeste est refuse pour une raison etrangere a ces tests.
  const ENTRIES = ["assets/photo.png"];
  const withConditions = (conditions: unknown, visibleIf?: unknown) => ({
    ...BASE,
    conditions,
    blocks: [{ ...BASE.blocks[0], ...(visibleIf === undefined ? {} : { visibleIf }) }],
  });

  it("accepte une condition nommee referencee par un bloc", () => {
    const res = parseManifest(
      withConditions([{ name: "estVrai", when: { variable: "category.anonymous", equals: true } }], { use: "estVrai" }),
      ENTRIES,
    );
    expect(res.ok).toBe(true);
  });

  it("accepte une condition nommee jamais referencee", () => {
    const res = parseManifest(
      withConditions([{ name: "estVrai", when: { variable: "category.anonymous", equals: true } }]),
      ENTRIES,
    );
    expect(res.ok).toBe(true);
  });

  it("refuse une reference vers une condition non declaree", () => {
    const res = parseManifest(withConditions([], { use: "absente" }), ENTRIES);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toContain('bloc 1 : condition non declaree "absente".');
  });

  it("refuse deux conditions de meme nom", () => {
    const res = parseManifest(
      withConditions([
        { name: "estVrai", when: { variable: "category.anonymous", equals: true } },
        { name: "estVrai", when: { variable: "category.anonymous", equals: false } },
      ]),
      ENTRIES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toContain('condition "estVrai" : declaree deux fois.');
  });

  it("refuse un equals sur une variable non booleenne dans un when", () => {
    const res = parseManifest(
      withConditions([{ name: "mauvais", when: { variable: "participant.firstName", equals: true } }]),
      ENTRIES,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes('"equals" exige une variable booleenne'))).toBe(true);
    }
  });

  it("refuse un when qui reference une autre condition", () => {
    const res = parseManifest(
      withConditions([
        { name: "a", when: { variable: "category.anonymous", equals: true } },
        { name: "b", when: { use: "a" } },
      ]),
      ENTRIES,
    );
    expect(res.ok).toBe(false);
  });

  it("refuse plus de quarante conditions", () => {
    const many = Array.from({ length: 41 }, (_, i) => ({
      name: `condition${i}`,
      when: { variable: "category.anonymous", equals: true },
    }));
    const res = parseManifest(withConditions(many), ENTRIES);
    expect(res.ok).toBe(false);
  });
});
