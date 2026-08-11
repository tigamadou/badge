# Format de paquet et moteur de templates declaratifs — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md`](../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md)
**Premier de trois plans** : **[10] format et moteur** → [11] catalogue et installation → [12] bascule et retrait

**Goal:** Fournir un format de manifeste declaratif et un moteur capable d'en produire un badge PDF identique aux deux templates React actuels.

**Architecture:** Un dossier `src/lib/badge-templates/declarative/` sans dependance a Prisma ni au reseau. Cinq unites pures et independantes — schema Zod, resolution de sources, conditions, polices, rendu — assemblees par une porte d'entree unique `buildDeclarativeTemplate(manifest, assets)` qui renvoie un `BadgeTemplate`, exactement le type que le registre expose deja. Les ressources (images, polices) sont fournies par un `AssetResolver` injecte : le moteur ne lit ni archive, ni disque, ni base.

**Tech Stack:** TypeScript 5, React 19, `@react-pdf/renderer` 4, Zod, Vitest 4.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » de ce plan ne valent **pas** autorisation.
2. **Aucune modification de `src/` pour faire passer un test.** Si un test revele un defaut, corriger le defaut.
3. **Ce plan n'ajoute aucune table, aucune route, aucun ecran.** Le registre `BADGE_TEMPLATES` et `DEFAULT_TEMPLATE_ID` restent en place et inchanges.
4. **Le moteur reste pur** : aucun import de `@/lib/prisma`, de `@/lib/storage`, ni de `jszip` dans `declarative/`. L'ouverture d'archive appartient au plan 11.
5. **Seuils de couverture = gate a 100%** (lignes / branches / fonctions / statements) sur `src/lib/**`. Tout le sous-systeme y est soumis.
6. **`TemplateContext` est inchange** : `build-context.ts` reste l'unique producteur du contexte.
7. **Images : JPEG et PNG uniquement.** `@react-pdf/image` (l.188-190) ne reconnait pas WebP. Ne jamais elargir cette liste sans verifier le rendu.
8. **Les familles de polices sont prefixees** `tpl-<templateId>-<alias>` : `Font.register` est global au process et indexe par nom de famille (`src/lib/badge-templates/fonts.ts:7`).
9. **Langue :** UI, messages et documentation en francais accentue ; identifiants, types et noms de fichiers en anglais ASCII.
10. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Types et schema Zod du manifeste | [x] | 2026-08-11 | 30 tests. Format enrichi en cours de route (cf. note ci-dessous) |
| 2 | Resolution des sources du contexte | [x] | 2026-08-11 | 8 tests. `event.date` reutilise `formatFrenchDate` de mail-helpers, identique a la fonction que recto-verso-v1 dupliquait |
| 3 | Conditions d'affichage `visibleIf` | [x] | 2026-08-11 | 6 tests. Supporte la conjonction (liste de conditions) |
| 4 | Enregistrement des polices prefixees | [x] | 2026-08-11 | 7 tests |
| 5 | Moteur de rendu | [x] | 2026-08-11 | 13 tests |
| 6 | Manifestes de reference et preuve de fidelite | [x] | 2026-08-11 | **16 tests verts** : 7 contextes x 2 familles + validation des manifestes. Condition de sortie du plan 12 remplie |
| 7 | Documentation | [x] | 2026-08-11 | `docs/v4/features/templates-badges.md` cree, garde-fou polices/images du CLAUDE.md mis a jour |

### Ecarts constates a l'execution (2026-08-11)

**Le format a du etre enrichi.** La lecture ligne a ligne de `default-v1` a montre que
la version initiale du format ne pouvait pas exprimer ce que les templates font. Quatre
capacites ajoutees, spec 10 mise a jour en consequence :

1. **`text` est un gabarit** (`{participant.firstName} {participant.lastName}`) et non
   plus une source unique. Ce manque n'etait pas propre a la fidelite : un format
   incapable d'ecrire « Prenom Nom » sur une ligne serait inutilisable.
2. **`visibleIf` accepte `isEmpty`** (blocs de repli) **et la conjonction** — la photo
   s'affiche si le badge n'est pas anonyme ET que la photo existe.
3. **Styles de texte etendus** : `transform`, `letterSpacing`, `lineHeight`.
4. **Bordures sur `rect`** : `borderTopPt`, `borderColor`.

**Le comparateur d'arbres a ete concu autrement que prevu.** Le plan renvoyait a
`BadgeCard.test.tsx`, qui utilise `renderToStaticMarkup` — inapplicable a `@react-pdf`.
Les primitives de la bibliotheque sont de simples chaines (`"DOCUMENT"`, `"PAGE"`,
`"VIEW"`, `"TEXT"`, `"IMAGE"`), ce qui rend le parcours d'arbre exact et sans dependance.

**La comparaison ne couvre pas le placement.** Entre un layout flexbox et un layout
absolu, positions et alignements ne sont pas comparables : le meme resultat visuel est
atteint par des moyens differents. Le test valide contenu et typographie ; le placement
demande une verification visuelle sur un badge imprime, non encore faite.

**La casse est deleguee au style.** Premiere implementation : transformer la chaine.
Les templates historiques passent `textTransform` en style et laissent `@react-pdf`
faire — approche conservee, plus correcte vis-a-vis de la locale.

---

## Etat initial (constate le 2026-08-11)

- `src/lib/badge-templates/index.ts` : registre `BADGE_TEMPLATES` (l.13), `getTemplate` (l.20), `listTemplates` (l.24), `DEFAULT_TEMPLATE_ID = "default-v1"` (l.30).
- `src/lib/badge-templates/types.ts` : `TemplateMeta`, `TemplateContext`, `BadgeTemplate = { meta, Component }`.
- `src/lib/badge-templates/mm.ts` : helper `mm(n)` convertissant des millimetres en points PDF. **A reutiliser**, ne pas redefinir.
- `src/lib/badge-templates/fonts.ts` : `Font.register` de Montserrat depuis Google Fonts, 4 graisses (400/500/600/700).
- `src/lib/badge-templates/default-v1/template.tsx` : mono-page 85,6 x 54 mm, flexbox (`flexDirection: row`, `justifyContent: space-between`, `flex: 1`), branches `isAnonymous` (l.96) et `isNeutral` (l.97).
- `src/lib/badge-templates/recto-verso-v1/template.tsx` : **deux `<Page>`** (l.136 et l.159), memes branches (l.128-129).
- `@react-pdf/font` accepte un `src` en **data URL** (l.249) ou en URL (l.256) : une police embarquee se passe donc en data URL, sans fichier temporaire.
- `build-context.ts:88` fournit `photoDataUrl`, `logoDataUrl` et `qrCodeDataUrl` deja sous forme de data URL.
- `jszip@3.10.1` est deja une dependance du projet (utile au plan 11, pas ici).

---

## Structure des fichiers

| Fichier | Responsabilite |
|---|---|
| `declarative/manifest-types.ts` | Types TypeScript du manifeste. Aucun code executable. |
| `declarative/sources.ts` | Table des sources autorisees et de leur type. Consommee par le schema **et** par la resolution. |
| `declarative/schema.ts` | Schema Zod et `parseManifest`. Seul endroit decrivant ce qu'un manifeste valide contient. |
| `declarative/resolve-source.ts` | Lit une valeur du `TemplateContext` a partir d'un chemin. |
| `declarative/conditions.ts` | Evalue `visibleIf`. |
| `declarative/fonts.ts` | Enregistre les polices d'un paquet sous un nom prefixe. |
| `declarative/renderer.tsx` | Traduit manifeste + contexte + resolveur en arbre `@react-pdf`. |
| `declarative/index.ts` | Porte d'entree : `buildDeclarativeTemplate`. |

---

## Task 1 : Types et schema du manifeste

**Files:**
- Create: `src/lib/badge-templates/declarative/manifest-types.ts`
- Create: `src/lib/badge-templates/declarative/sources.ts`
- Create: `src/lib/badge-templates/declarative/schema.ts`
- Create: `src/lib/badge-templates/declarative/__tests__/schema.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit : le type `TemplateManifest`, la table `SOURCES`, et
  `parseManifest(input: unknown, entries: string[]): ParseResult` ou
  `ParseResult = { ok: true; manifest: TemplateManifest } | { ok: false; errors: string[] }`.
  `entries` est la liste des chemins presents dans le paquet (`["assets/fond.png", "fonts/Inter-Bold.ttf"]`) : elle permet de verifier que chaque `asset` et chaque `fonts[].file` reference existe. Le plan 11 la fournira depuis l'archive ; les tests la fournissent en dur.

- [ ] **Step 1 : Ecrire la table des sources**

Creer `src/lib/badge-templates/declarative/sources.ts` :

```ts
// Liste blanche des chemins du TemplateContext exposes aux manifestes. Le `kind`
// permet de refuser un bloc qui consomme une source d'un type incompatible
// (ex. un bloc image pointant sur participant.firstName).
export type SourceKind = "text" | "color" | "image" | "boolean" | "date";

export const SOURCES: Record<string, SourceKind> = {
  "participant.firstName": "text",
  "participant.lastName": "text",
  "participant.structure": "text",
  "participant.photoDataUrl": "image",
  "category.name": "text",
  "category.color": "color",
  "category.neutralBadge": "boolean",
  "category.anonymous": "boolean",
  "event.title": "text",
  "event.date": "date",
  "event.location": "text",
  "event.logoDataUrl": "image",
  "badge.id": "text",
  "badge.verifyUrl": "text",
  "badge.qrCodeDataUrl": "image",
};

// Seuls chemins booleens admis dans un visibleIf : les deux notions metier.
export const CONDITION_PATHS = ["category.anonymous", "category.neutralBadge"] as const;
export type ConditionPath = (typeof CONDITION_PATHS)[number];
```

- [ ] **Step 2 : Ecrire les types du manifeste**

Creer `src/lib/badge-templates/declarative/manifest-types.ts` :

```ts
import type { ConditionPath } from "./sources";

export type Overflow = "shrink" | "truncate" | "clip";

export type TextStyle = {
  font?: string;
  sizePt: number;
  weight?: 400 | 500 | 600 | 700;
  align?: "left" | "center" | "right";
  color: string;
  overflow: Overflow;
  minSizePt?: number;
};

export type VisibleIf = { path: ConditionPath; equals: boolean };

type BlockBase = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  visibleIf?: VisibleIf;
};

export type TextBlock = BlockBase & { type: "text"; source: string; style: TextStyle };
export type ImageBlock = BlockBase & { type: "image"; source?: string; asset?: string; radiusMm?: number };
export type QrBlock = BlockBase & { type: "qr" };
export type RectBlock = BlockBase & { type: "rect"; fill: string; radiusMm?: number };

export type Block = TextBlock | ImageBlock | QrBlock | RectBlock;

export type FontDeclaration = { alias: string; file: string; weight?: 400 | 500 | 600 | 700 };

export type TemplateManifest = {
  formatVersion: 1;
  family: string;
  label: string;
  description: string;
  page: { widthMm: number; heightMm: number; count: number };
  fonts?: FontDeclaration[];
  blocks: Block[];
};
```

- [ ] **Step 2b : Ecrire les tests en echec**

Creer `src/lib/badge-templates/declarative/__tests__/schema.test.ts`. Un manifeste minimal valide sert de base a chaque cas :

```ts
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
      type: "text", page: 1, x: 4, y: 4, w: 40, h: 8,
      source: "participant.firstName",
      style: { sizePt: 12, color: "#0f172a", overflow: "clip" },
    },
  ],
};

function parse(overrides: Record<string, unknown> = {}, entries: string[] = []) {
  return parseManifest({ ...VALID, ...overrides }, entries);
}

describe("parseManifest", () => {
  it("accepte un manifeste minimal", () => {
    const res = parse();
    expect(res.ok).toBe(true);
  });

  it("refuse un formatVersion inconnu", () => {
    const res = parse({ formatVersion: 2 });
    expect(res.ok).toBe(false);
  });

  it("refuse un bloc qui sort de la page en largeur", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], x: 60, w: 40 }],
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/hors de la page/i);
  });

  it("refuse un bloc qui sort de la page en hauteur", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], y: 50, h: 10 }] });
    expect(res.ok).toBe(false);
  });

  it("refuse un bloc dont la page depasse le nombre de pages", () => {
    const res = parse({ blocks: [{ ...VALID.blocks[0], page: 2 }] });
    expect(res.ok).toBe(false);
  });

  it("refuse plus de 60 blocs", () => {
    const res = parse({ blocks: Array.from({ length: 61 }, () => VALID.blocks[0]) });
    expect(res.ok).toBe(false);
  });

  it("refuse une source hors liste blanche", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], source: "participant.secretField" }],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse une source de type incompatible avec le bloc", () => {
    const res = parse({
      blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, source: "participant.firstName" }],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse un bloc image portant a la fois source et asset", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, source: "participant.photoDataUrl", asset: "assets/f.png" }] },
      ["assets/f.png"],
    );
    expect(res.ok).toBe(false);
  });

  it("refuse un bloc image sans source ni asset", () => {
    const res = parse({ blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10 }] });
    expect(res.ok).toBe(false);
  });

  it("refuse un asset absent du paquet", () => {
    const res = parse(
      { blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, asset: "assets/absent.png" }] },
      [],
    );
    expect(res.ok).toBe(false);
  });

  it("refuse une couleur ni hexadecimale ni source de couleur", () => {
    const res = parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "rouge" }] });
    expect(res.ok).toBe(false);
  });

  it("accepte une couleur issue d'une source de type couleur", () => {
    const res = parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "category.color" }] });
    expect(res.ok).toBe(true);
  });

  it("refuse un style.font sans alias declare", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], style: { ...VALID.blocks[0].style, font: "titre" } }],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse une police dont le fichier est absent du paquet", () => {
    const res = parse({ fonts: [{ alias: "titre", file: "fonts/Absent.ttf" }] }, []);
    expect(res.ok).toBe(false);
  });

  it("refuse overflow shrink sans minSizePt", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], style: { sizePt: 12, color: "#000000", overflow: "shrink" } }],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse un minSizePt superieur au sizePt", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], style: { sizePt: 10, color: "#000000", overflow: "shrink", minSizePt: 12 } }],
    });
    expect(res.ok).toBe(false);
  });

  it("refuse un visibleIf sur un chemin non autorise", () => {
    const res = parse({
      blocks: [{ ...VALID.blocks[0], visibleIf: { path: "event.title", equals: true } }],
    });
    expect(res.ok).toBe(false);
  });

  it("accumule plusieurs erreurs en une passe", () => {
    const res = parse({ formatVersion: 3, blocks: [{ ...VALID.blocks[0], x: 90 }] });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 3 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/schema.test.ts`
Expected: FAIL — « Failed to resolve import "../schema" ».

- [ ] **Step 4 : Implementer le schema**

Creer `src/lib/badge-templates/declarative/schema.ts`. Le schema Zod couvre la forme ; les regles croisees (bornes, references, coherence de types) sont verifiees dans une seconde passe qui **accumule** les erreurs au lieu de s'arreter a la premiere :

```ts
import { z } from "zod";
import type { TemplateManifest, Block } from "./manifest-types";
import { SOURCES, CONDITION_PATHS, type SourceKind } from "./sources";

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_BLOCKS = 60;

const styleSchema = z.object({
  font: z.string().min(1).optional(),
  sizePt: z.number().positive().max(200),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: z.string().min(1),
  overflow: z.enum(["shrink", "truncate", "clip"]),
  minSizePt: z.number().positive().max(200).optional(),
});

const baseSchema = {
  page: z.number().int().positive(),
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
  visibleIf: z
    .object({ path: z.string(), equals: z.boolean() })
    .optional(),
};

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), source: z.string(), style: styleSchema, ...baseSchema }),
  z.object({ type: z.literal("image"), source: z.string().optional(), asset: z.string().optional(), radiusMm: z.number().min(0).optional(), ...baseSchema }),
  z.object({ type: z.literal("qr"), ...baseSchema }),
  z.object({ type: z.literal("rect"), fill: z.string(), radiusMm: z.number().min(0).optional(), ...baseSchema }),
]);

const manifestSchema = z.object({
  formatVersion: z.literal(1),
  family: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1).max(120),
  description: z.string().max(1000),
  page: z.object({
    widthMm: z.number().positive().max(1000),
    heightMm: z.number().positive().max(1000),
    count: z.number().int().positive().max(4),
  }),
  fonts: z.array(z.object({
    alias: z.string().min(1),
    file: z.string().min(1),
    weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  })).optional(),
  blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS),
});

export type ParseResult =
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; errors: string[] };

// Un bloc `text` consomme du texte ou une date ; un bloc `image` consomme une image.
const EXPECTED_KIND: Record<"text" | "image", SourceKind[]> = {
  text: ["text", "date"],
  image: ["image"],
};

function checkColor(value: string, label: string, errors: string[]): void {
  if (HEX.test(value)) return;
  if (SOURCES[value] === "color") return;
  errors.push(`${label} : "${value}" n'est ni une couleur hexadecimale ni une source de couleur.`);
}

function checkSource(value: string, kind: "text" | "image", label: string, errors: string[]): void {
  const actual = SOURCES[value];
  if (!actual) {
    errors.push(`${label} : source inconnue "${value}".`);
    return;
  }
  if (!EXPECTED_KIND[kind].includes(actual)) {
    errors.push(`${label} : la source "${value}" est de type ${actual}, incompatible avec un bloc ${kind}.`);
  }
}

function checkBlock(
  block: Block,
  index: number,
  manifest: z.infer<typeof manifestSchema>,
  entries: string[],
  errors: string[],
): void {
  const label = `bloc ${index + 1}`;
  const { page } = manifest;

  if (block.x + block.w > page.widthMm || block.y + block.h > page.heightMm) {
    errors.push(`${label} : hors de la page (${block.x}+${block.w} x ${block.y}+${block.h}).`);
  }
  if (block.page > page.count) {
    errors.push(`${label} : page ${block.page} alors que le manifeste en declare ${page.count}.`);
  }
  if (block.visibleIf && !CONDITION_PATHS.includes(block.visibleIf.path as never)) {
    errors.push(`${label} : visibleIf porte sur "${block.visibleIf.path}", non autorise.`);
  }

  if (block.type === "text") {
    checkSource(block.source, "text", label, errors);
    checkColor(block.style.color, `${label} (couleur)`, errors);
    if (block.style.overflow === "shrink" && block.style.minSizePt === undefined) {
      errors.push(`${label} : overflow "shrink" exige un minSizePt.`);
    }
    if (block.style.minSizePt !== undefined && block.style.minSizePt > block.style.sizePt) {
      errors.push(`${label} : minSizePt superieur a sizePt.`);
    }
    if (block.style.font && !(manifest.fonts ?? []).some((f) => f.alias === block.style.font)) {
      errors.push(`${label} : police "${block.style.font}" non declaree.`);
    }
  }

  if (block.type === "image") {
    const hasSource = block.source !== undefined;
    const hasAsset = block.asset !== undefined;
    if (hasSource === hasAsset) {
      errors.push(`${label} : un bloc image porte soit source, soit asset, jamais les deux ni aucun.`);
    }
    if (hasSource) checkSource(block.source!, "image", label, errors);
    if (hasAsset && !entries.includes(block.asset!)) {
      errors.push(`${label} : ressource "${block.asset}" absente du paquet.`);
    }
  }

  if (block.type === "rect") {
    checkColor(block.fill, `${label} (remplissage)`, errors);
  }
}

export function parseManifest(input: unknown, entries: string[]): ParseResult {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`) };
  }

  const errors: string[] = [];
  for (const font of parsed.data.fonts ?? []) {
    if (!entries.includes(font.file)) {
      errors.push(`police "${font.alias}" : fichier "${font.file}" absent du paquet.`);
    }
  }
  parsed.data.blocks.forEach((block, i) => checkBlock(block as Block, i, parsed.data, entries, errors));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: parsed.data as TemplateManifest };
}
```

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/schema.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 6 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe ; couverture 100% sur les trois nouveaux fichiers.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): schema du manifeste de template declaratif"
```

---

## Task 2 : Resolution des sources

**Files:**
- Create: `src/lib/badge-templates/declarative/resolve-source.ts`
- Create: `src/lib/badge-templates/declarative/__tests__/resolve-source.test.ts`

**Interfaces:**
- Consomme : `SOURCES` (Task 1), `TemplateContext` (`../types`).
- Produit : `resolveSource(ctx: TemplateContext, path: string): string | boolean`. Une date est rendue au format francais via `formatFrenchDate` de `@/lib/mail-helpers` — **la meme fonction que les e-mails**, pour que la date d'un badge et celle d'un e-mail ne divergent jamais.

- [ ] **Step 1 : Ecrire les tests en echec**

Creer `src/lib/badge-templates/declarative/__tests__/resolve-source.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { resolveSource } from "../resolve-source";
import { SOURCES } from "../sources";
import type { TemplateContext } from "../../types";

const CTX: TemplateContext = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "data:image/png;base64,AAA", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: { title: "Salon 2027", date: new Date("2027-12-15T00:00:00Z"), location: "Niamey", logoDataUrl: null },
  badge: { id: "BDG-1", verifyUrl: "https://x/verify/BDG-1", qrCodeDataUrl: "data:image/png;base64,BBB" },
};

describe("resolveSource", () => {
  it("resout chaque source de la liste blanche sans lever", () => {
    for (const path of Object.keys(SOURCES)) {
      expect(() => resolveSource(CTX, path)).not.toThrow();
    }
  });

  it("resout un texte", () => {
    expect(resolveSource(CTX, "participant.firstName")).toBe("Awa");
  });

  it("resout un booleen", () => {
    expect(resolveSource(CTX, "category.anonymous")).toBe(true);
  });

  it("formate une date en francais", () => {
    expect(resolveSource(CTX, "event.date")).toMatch(/2027/);
  });

  it("rend une chaine vide pour un logo absent", () => {
    expect(resolveSource(CTX, "event.logoDataUrl")).toBe("");
  });

  it("leve sur un chemin inconnu", () => {
    expect(() => resolveSource(CTX, "participant.secret")).toThrow(/inconnue/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/resolve-source.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

Creer `src/lib/badge-templates/declarative/resolve-source.ts` :

```ts
import type { TemplateContext } from "../types";
import { SOURCES } from "./sources";
import { formatFrenchDate } from "@/lib/mail-helpers";

// Table explicite plutot qu'un acces dynamique par split(".") : le compilateur
// verifie chaque acces, et une source retiree du contexte devient une erreur de
// typage au lieu d'un undefined a l'execution.
const READERS: Record<string, (ctx: TemplateContext) => string | boolean> = {
  "participant.firstName": (c) => c.participant.firstName,
  "participant.lastName": (c) => c.participant.lastName,
  "participant.structure": (c) => c.participant.structure,
  "participant.photoDataUrl": (c) => c.participant.photoDataUrl,
  "category.name": (c) => c.category.name,
  "category.color": (c) => c.category.color,
  "category.neutralBadge": (c) => c.category.neutralBadge,
  "category.anonymous": (c) => c.category.anonymous,
  "event.title": (c) => c.event.title,
  "event.date": (c) => formatFrenchDate(c.event.date),
  "event.location": (c) => c.event.location,
  "event.logoDataUrl": (c) => c.event.logoDataUrl ?? "",
  "badge.id": (c) => c.badge.id,
  "badge.verifyUrl": (c) => c.badge.verifyUrl,
  "badge.qrCodeDataUrl": (c) => c.badge.qrCodeDataUrl,
};

export function resolveSource(ctx: TemplateContext, path: string): string | boolean {
  const reader = READERS[path];
  if (!reader || !SOURCES[path]) {
    throw new Error(`resolveSource : source inconnue "${path}"`);
  }
  return reader(ctx);
}
```

Verifier au passage que `formatFrenchDate` est bien exporte par `src/lib/mail-helpers.ts` (il l'est : utilise par `src/lib/mail.ts:285`). Si sa signature differe, l'adapter ici plutot que de dupliquer un formatage de date.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/resolve-source.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): resolution des sources de contexte pour les templates"
```

---

## Task 3 : Conditions d'affichage

**Files:**
- Create: `src/lib/badge-templates/declarative/conditions.ts`
- Create: `src/lib/badge-templates/declarative/__tests__/conditions.test.ts`

**Interfaces:**
- Consomme : `resolveSource` (Task 2), le type `VisibleIf` (Task 1).
- Produit : `isBlockVisible(ctx: TemplateContext, visibleIf?: VisibleIf): boolean`.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect } from "vitest";
import { isBlockVisible } from "../conditions";
import type { TemplateContext } from "../../types";

const CTX = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: true },
  event: { title: "S", date: new Date("2027-01-01T00:00:00Z"), location: "N", logoDataUrl: null },
  badge: { id: "B", verifyUrl: "u", qrCodeDataUrl: "" },
} as TemplateContext;

describe("isBlockVisible", () => {
  it("affiche un bloc sans condition", () => {
    expect(isBlockVisible(CTX, undefined)).toBe(true);
  });

  it("affiche quand la condition est satisfaite", () => {
    expect(isBlockVisible(CTX, { path: "category.anonymous", equals: true })).toBe(true);
  });

  it("masque quand la condition ne l'est pas", () => {
    expect(isBlockVisible(CTX, { path: "category.anonymous", equals: false })).toBe(false);
  });

  it("fonctionne sur le second chemin autorise", () => {
    expect(isBlockVisible(CTX, { path: "category.neutralBadge", equals: false })).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/conditions.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

```ts
import type { TemplateContext } from "../types";
import type { VisibleIf } from "./manifest-types";
import { resolveSource } from "./resolve-source";

export function isBlockVisible(ctx: TemplateContext, visibleIf?: VisibleIf): boolean {
  if (!visibleIf) return true;
  return resolveSource(ctx, visibleIf.path) === visibleIf.equals;
}
```

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/conditions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): conditions d'affichage des blocs de template"
```

---

## Task 4 : Polices prefixees

**Files:**
- Create: `src/lib/badge-templates/declarative/fonts.ts`
- Create: `src/lib/badge-templates/declarative/__tests__/fonts.test.ts`

**Interfaces:**
- Consomme : `FontDeclaration` (Task 1), `AssetResolver` (defini ici).
- Produit :
  `export type AssetResolver = (name: string) => string;` — rend une **data URL**.
  `registerTemplateFonts(templateId: string, fonts: FontDeclaration[] | undefined, assets: AssetResolver): Record<string, string>` — enregistre les polices et rend la correspondance `alias → famille reelle`.
  `DEFAULT_FONT_FAMILY = "Montserrat"`.

- [ ] **Step 1 : Ecrire les tests en echec**

`Font.register` est global au process : le test le remplace par un espion pour observer les familles enregistrees sans polluer l'etat reel.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const register = vi.fn();
vi.mock("@react-pdf/renderer", () => ({ Font: { register: (...a: unknown[]) => register(...a) } }));

import { registerTemplateFonts, DEFAULT_FONT_FAMILY } from "../fonts";

const assets = (name: string) => `data:font/ttf;base64,${name}`;

describe("registerTemplateFonts", () => {
  beforeEach(() => register.mockClear());

  it("ne fait rien sans police declaree", () => {
    expect(registerTemplateFonts("t1", undefined, assets)).toEqual({});
    expect(register).not.toHaveBeenCalled();
  });

  it("prefixe la famille par l'identifiant du template", () => {
    const map = registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf" }], assets);
    expect(map).toEqual({ titre: "tpl-t1-titre" });
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ family: "tpl-t1-titre" }),
    );
  });

  it("isole deux templates declarant le meme alias", () => {
    const a = registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf" }], assets);
    const b = registerTemplateFonts("t2", [{ alias: "titre", file: "fonts/B.ttf" }], assets);
    expect(a.titre).not.toBe(b.titre);
  });

  it("passe la data URL de la ressource comme source", () => {
    registerTemplateFonts("t1", [{ alias: "titre", file: "fonts/A.ttf", weight: 700 }], assets);
    expect(register).toHaveBeenCalledWith({
      family: "tpl-t1-titre",
      fonts: [{ src: "data:font/ttf;base64,fonts/A.ttf", fontWeight: 700 }],
    });
  });

  it("expose Montserrat comme police par defaut", () => {
    expect(DEFAULT_FONT_FAMILY).toBe("Montserrat");
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/fonts.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

```ts
import { Font } from "@react-pdf/renderer";
import type { FontDeclaration } from "./manifest-types";

// Une ressource du paquet, rendue sous forme de data URL. @react-pdf accepte une
// data URL aussi bien pour une image que pour une police (@react-pdf/font l.249),
// ce qui evite tout fichier temporaire.
export type AssetResolver = (name: string) => string;

export const DEFAULT_FONT_FAMILY = "Montserrat";

// Font.register est global au process et indexe par nom de famille : deux paquets
// declarant "titre" s'ecraseraient. Le prefixe par templateId les isole.
export function registerTemplateFonts(
  templateId: string,
  fonts: FontDeclaration[] | undefined,
  assets: AssetResolver,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const font of fonts ?? []) {
    const family = `tpl-${templateId}-${font.alias}`;
    Font.register({
      family,
      fonts: [{ src: assets(font.file), fontWeight: font.weight ?? 400 }],
    });
    map[font.alias] = family;
  }
  return map;
}
```

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/fonts.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): enregistrement isole des polices de template"
```

---

## Task 5 : Moteur de rendu

**Files:**
- Create: `src/lib/badge-templates/declarative/renderer.tsx`
- Create: `src/lib/badge-templates/declarative/index.ts`
- Create: `src/lib/badge-templates/declarative/__tests__/renderer.test.tsx`

**Interfaces:**
- Consomme : tout ce qui precede.
- Produit : `buildDeclarativeTemplate(manifest: TemplateManifest, assets: AssetResolver, templateId: string): BadgeTemplate`. Le `BadgeTemplate` rendu a la meme forme que ceux du registre (`{ meta, Component }`), de sorte qu'un consommateur ne distingue pas les deux origines.

- [ ] **Step 1 : Ecrire les tests en echec**

```tsx
import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
import type { TemplateManifest } from "../manifest-types";
import type { TemplateContext } from "../../types";

const CTX: TemplateContext = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "data:image/png;base64,AAA", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: { title: "Salon", date: new Date("2027-12-15T00:00:00Z"), location: "Niamey", logoDataUrl: null },
  badge: { id: "BDG-1", verifyUrl: "https://x/v/BDG-1", qrCodeDataUrl: "data:image/png;base64,BBB" },
};

function manifest(blocks: TemplateManifest["blocks"], count = 1): TemplateManifest {
  return {
    formatVersion: 1, family: "t", label: "T", description: "",
    page: { widthMm: 85.6, heightMm: 54, count },
    blocks,
  };
}

const assets = (name: string) => `data:image/png;base64,${name}`;

describe("buildDeclarativeTemplate", () => {
  it("expose une meta derivee du manifeste", () => {
    const t = buildDeclarativeTemplate(manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }]), assets, "t1");
    expect(t.meta.id).toBe("t1");
    expect(t.meta.pageSize).toEqual({ width: "85.6mm", height: "54mm" });
    expect(t.meta.pages).toBe(1);
  });

  it("rend un bloc texte avec sa source resolue", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "text", page: 1, x: 4, y: 4, w: 40, h: 8, source: "participant.firstName",
                  style: { sizePt: 12, color: "#0f172a", overflow: "clip" } }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX)).toMatchObject({ texts: ["Awa"] });
  });

  it("rend une image issue d'une ressource du paquet", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "image", page: 1, x: 0, y: 0, w: 85.6, h: 54, asset: "assets/fond.png" }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,assets/fond.png");
  });

  it("rend une image issue du contexte", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "image", page: 1, x: 0, y: 0, w: 28, h: 34, source: "participant.photoDataUrl" }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX).images).toContain("data:image/png;base64,AAA");
  });

  it("omet un bloc masque par sa condition", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "text", page: 1, x: 4, y: 4, w: 40, h: 8, source: "participant.firstName",
                  style: { sizePt: 12, color: "#0f172a", overflow: "clip" },
                  visibleIf: { path: "category.anonymous", equals: true } }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX).texts).toEqual([]);
  });

  it("resout une couleur de remplissage depuis une source", () => {
    const t = buildDeclarativeTemplate(
      manifest([{ type: "rect", page: 1, x: 0, y: 46, w: 85.6, h: 8, fill: "category.color" }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX).fills).toContain("#4f46e5");
  });

  it("repartit les blocs sur les pages declarees", () => {
    const t = buildDeclarativeTemplate(
      manifest([
        { type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 },
        { type: "qr", page: 2, x: 0, y: 0, w: 10, h: 10 },
      ], 2),
      assets, "t1",
    );
    expect(renderToJson(t.Component, CTX).pageCount).toBe(2);
  });

  it("reduit la taille de police en mode shrink sur un texte long", () => {
    const long = { ...CTX, participant: { ...CTX.participant, firstName: "A".repeat(80) } };
    const t = buildDeclarativeTemplate(
      manifest([{ type: "text", page: 1, x: 4, y: 4, w: 20, h: 6, source: "participant.firstName",
                  style: { sizePt: 12, color: "#000000", overflow: "shrink", minSizePt: 6 } }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, long).fontSizes[0]).toBeLessThan(12);
  });

  it("tronque avec ellipse en mode truncate", () => {
    const long = { ...CTX, participant: { ...CTX.participant, firstName: "A".repeat(80) } };
    const t = buildDeclarativeTemplate(
      manifest([{ type: "text", page: 1, x: 4, y: 4, w: 20, h: 6, source: "participant.firstName",
                  style: { sizePt: 12, color: "#000000", overflow: "truncate" } }]),
      assets, "t1",
    );
    expect(renderToJson(t.Component, long).texts[0]).toMatch(/…$/);
  });
});
```

Creer aussi le helper `src/lib/badge-templates/declarative/__tests__/helpers/render-to-json.tsx`, qui parcourt l'arbre React sans rendre de PDF :

```tsx
import { createElement, type ComponentType } from "react";
import type { TemplateContext } from "../../../types";

type Collected = {
  texts: string[];
  images: string[];
  fills: string[];
  fontSizes: number[];
  pageCount: number;
};

// Parcourt l'arbre React produit par un template, sans passer par @react-pdf :
// c'est la representation dont le rendu PDF derive de facon deterministe.
export function renderToJson(
  Component: ComponentType<{ ctx: TemplateContext }>,
  ctx: TemplateContext,
): Collected {
  const out: Collected = { texts: [], images: [], fills: [], fontSizes: [], pageCount: 0 };
  walk(createElement(Component, { ctx }), out);
  return out;
}

function walk(node: unknown, out: Collected): void {
  // Implementation : deployer l'element, inspecter type.displayName
  // ("Page", "Text", "Image", "View"), collecter children/src/style, recurser.
  // Voir src/components/badge/__tests__/BadgeCard.test.tsx pour le motif de
  // parcours d'arbre deja utilise dans le projet.
}
```

**Avant d'ecrire `walk`, relire `src/components/badge/__tests__/BadgeCard.test.tsx`** : le projet y parcourt deja un arbre de composants. Reprendre ce motif plutot qu'en inventer un autre.

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/renderer.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer le rendu**

Creer `src/lib/badge-templates/declarative/renderer.tsx`. Points structurants :

```tsx
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { TemplateContext } from "../types";
import type { Block, TemplateManifest, TextStyle } from "./manifest-types";
import { mm } from "../mm";
import { SOURCES } from "./sources";
import { resolveSource } from "./resolve-source";
import { isBlockVisible } from "./conditions";
import { registerTemplateFonts, DEFAULT_FONT_FAMILY, type AssetResolver } from "./fonts";
import "../fonts";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Une couleur est soit litterale, soit une source de type couleur.
function colorOf(value: string, ctx: TemplateContext): string {
  return HEX.test(value) ? value : String(resolveSource(ctx, value));
}

// Approximation de largeur : @react-pdf ne mesure pas hors rendu. 0,55 em par
// caractere correspond a Montserrat en graisse normale ; l'objectif n'est pas
// d'etre exact mais de garantir qu'un texte long retrecit au lieu de deborder.
function shrinkToFit(text: string, style: TextStyle, widthMm: number): number {
  const maxPt = mm(widthMm);
  const min = style.minSizePt ?? style.sizePt;
  let size = style.sizePt;
  while (size > min && text.length * size * 0.55 > maxPt) size -= 0.5;
  return Math.max(size, min);
}

function truncateToFit(text: string, style: TextStyle, widthMm: number): string {
  const maxChars = Math.floor(mm(widthMm) / (style.sizePt * 0.55));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}
```

Chaque bloc devient un `View` positionne en absolu :

```tsx
function blockStyle(block: Block) {
  return {
    position: "absolute" as const,
    left: mm(block.x),
    top: mm(block.y),
    width: mm(block.w),
    height: mm(block.h),
  };
}
```

Le composant final filtre les blocs par page et par condition, et delegue le rendu de chaque type. Un bloc `image` lit `assets(block.asset)` ou `resolveSource(ctx, block.source)` selon celui des deux qui est renseigne — le schema garantit qu'exactement un l'est.

Creer `src/lib/badge-templates/declarative/index.ts` :

```ts
import type { BadgeTemplate } from "../types";
import type { TemplateManifest } from "./manifest-types";
import type { AssetResolver } from "./fonts";
import { DeclarativeDocument } from "./renderer";

export type { AssetResolver } from "./fonts";
export { parseManifest } from "./schema";
export type { TemplateManifest } from "./manifest-types";

export function buildDeclarativeTemplate(
  manifest: TemplateManifest,
  assets: AssetResolver,
  templateId: string,
): BadgeTemplate {
  return {
    meta: {
      id: templateId,
      label: manifest.label,
      description: manifest.description,
      pages: manifest.page.count,
      pageSize: { width: `${manifest.page.widthMm}mm`, height: `${manifest.page.heightMm}mm` },
      previewSrc: "",
      version: manifest.formatVersion,
    },
    Component: ({ ctx }) => DeclarativeDocument({ manifest, assets, templateId, ctx }),
  };
}
```

`previewSrc` est laisse vide : c'est le plan 11 qui le renseignera depuis le stockage, le moteur n'ayant aucune connaissance des aperçus.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/renderer.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 5 : Verifier l'ensemble**

Run: `make lint && make typecheck && make test`
Expected: tout passe, couverture 100% sur `declarative/`.

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): moteur de rendu des templates declaratifs"
```

---

## Task 6 : Manifestes de reference et preuve de fidelite

**Files:**
- Create: `src/lib/badge-templates/declarative/__fixtures__/default.json`
- Create: `src/lib/badge-templates/declarative/__fixtures__/recto-verso.json`
- Create: `src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx`

**Interfaces:**
- Consomme : `buildDeclarativeTemplate` (Task 5), les composants historiques `DefaultV1Template` et `RectoVersoV1Template`.
- Produit : la **condition de sortie du plan 12**. Ces deux manifestes sont promus en donnees de seed par le plan 12 ; ils ne doivent donc pas etre modifies sans relancer ce test.

- [ ] **Step 1 : Transcrire `default-v1` en manifeste**

Lire `src/lib/badge-templates/default-v1/template.tsx` **en entier** et transcrire chaque element en bloc absolu. Les constantes de tete (`PAGE_W`, `PAGE_H`, `PHOTO_W`, `PHOTO_H`, `CATEGORY_BAND_H`) donnent directement les coordonnees. Les positions issues de `justifyContent: space-between` se calculent depuis les paddings declares dans `styles`.

Les branches `isAnonymous` (l.96) et `isNeutral` (l.97) deviennent des `visibleIf` sur les blocs concernes.

- [ ] **Step 2 : Ecrire le test de fidelite en echec**

```tsx
import { describe, it, expect } from "vitest";
import { renderToJson } from "./helpers/render-to-json";
import { buildDeclarativeTemplate } from "../index";
import DefaultV1Template from "../../default-v1/template";
import RectoVersoV1Template from "../../recto-verso-v1/template";
import defaultManifest from "../__fixtures__/default.json";
import rectoVersoManifest from "../__fixtures__/recto-verso.json";
import type { TemplateContext } from "../../types";
import type { TemplateManifest } from "../manifest-types";

const BASE: TemplateContext = {
  participant: { firstName: "Awa", lastName: "Diallo", photoDataUrl: "data:image/png;base64,AAA", structure: "ACME" },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: { title: "Salon 2027", date: new Date("2027-12-15T00:00:00Z"), location: "Niamey", logoDataUrl: null },
  badge: { id: "BDG-1", verifyUrl: "https://x/v/BDG-1", qrCodeDataUrl: "data:image/png;base64,BBB" },
};

const CASES: Array<[string, TemplateContext]> = [
  ["nominal", BASE],
  ["anonyme", { ...BASE, category: { ...BASE.category, anonymous: true } }],
  ["neutre", { ...BASE, category: { ...BASE.category, neutralBadge: true } }],
  ["texte long", { ...BASE, participant: { ...BASE.participant, firstName: "Aminata-Bintou".repeat(3), structure: "Association ".repeat(4) } }],
];

const FAMILIES: Array<[string, TemplateManifest, typeof DefaultV1Template]> = [
  ["default-v1", defaultManifest as TemplateManifest, DefaultV1Template],
  ["recto-verso-v1", rectoVersoManifest as TemplateManifest, RectoVersoV1Template],
];

describe("fidelite du moteur declaratif", () => {
  for (const [family, manifest, Legacy] of FAMILIES) {
    for (const [caseName, ctx] of CASES) {
      it(`${family} — ${caseName} : rendu identique`, () => {
        const declarative = buildDeclarativeTemplate(manifest, () => "", family);
        expect(renderToJson(declarative.Component, ctx)).toEqual(renderToJson(Legacy, ctx));
      });
    }
  }
});
```

- [ ] **Step 3 : Lancer et constater les ecarts**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx`
Expected: FAIL sur plusieurs cas.

**Traiter chaque ecart en corrigeant le manifeste, jamais le composant historique** : c'est lui la reference. Si un ecart s'avere impossible a combler par le manifeste, c'est le moteur (Task 5) qui manque d'une capacite — l'ajouter la, avec son test unitaire, plutot que de relacher l'assertion de fidelite.

- [ ] **Step 4 : Transcrire `recto-verso-v1` et iterer de meme**

Le template historique declare **deux `<Page>`** (l.136 et l.159) : le manifeste porte `page.count = 2` et chaque bloc son numero de page.

- [ ] **Step 5 : Verifier que les huit comparaisons passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx`
Expected: PASS, 8 tests.

**Cette etape est la condition de sortie du plan.** Tant qu'elle echoue, le plan 12 ne doit pas etre engage.

- [ ] **Step 6 : Verifier l'ensemble**

Run: `make lint && make typecheck && make test`
Expected: tout passe.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "test(v4): preuve de fidelite du moteur declaratif"
```

---

## Task 7 : Documentation

**Files:**
- Create: `docs/v4/features/templates-badges.md`
- Modify: `CLAUDE.md` (garde-fous metier, ligne « Rendu PDF des badges »)

- [ ] **Step 1 : Ecrire la fiche feature**

Creer `docs/v4/features/templates-badges.md` : structure d'un paquet, manifeste commente, liste des sources autorisees et de leur type, les quatre types de blocs, `visibleIf`, `overflow`, regles de validation. Preciser que le registre code coexiste encore a ce stade et que l'installation arrive avec le plan 11.

- [ ] **Step 2 : Mettre a jour le garde-fou des polices**

Dans `CLAUDE.md`, remplacer :

```markdown
- **Rendu PDF des badges** : utilise Montserrat via Google Fonts (`https://fonts.googleapis.com/`) — préserver l'accès sortant à ce domaine.
```

par :

```markdown
- **Rendu PDF des badges** : Montserrat via Google Fonts (`https://fonts.googleapis.com/`) est la police **par défaut** — préserver l'accès sortant à ce domaine. Un paquet de template peut embarquer ses propres polices (TTF/OTF), enregistrées sous une famille préfixée par template.
```

- [ ] **Step 3 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe.

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add docs/v4/features/templates-badges.md CLAUDE.md
git commit -m "docs(v4): fiche des templates de badge declaratifs"
```
