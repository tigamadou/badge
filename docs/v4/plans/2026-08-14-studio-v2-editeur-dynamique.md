# Plan d'implémentation — Studio v2 : éditeur dynamique de badges

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Studio complet de création de badge : format déclaratif enrichi (bordures, coins, opacité, rotation, typo étendue, objectFit), serveur studio avec contexte libre / upload / scaffold / pack, et interface Preact à trois onglets (Contexte, Blocs, JSON) avec aperçu permanent et export zip.

**Architecture :** Trois lots séquentiels. **Lot A** enrichit le format déclaratif (schéma Zod + renderer + migration des manifestes du dépôt). **Lot B** refond le serveur studio (contexte dynamique remplaçant les variantes, routes schema-info / upload / scaffold / pack). **Lot C** reconstruit l'interface en Preact + htm sans build (vendorisé), onglet par onglet. Chaque lot laisse le studio fonctionnel.

**Tech Stack :** TypeScript 5, Zod, @react-pdf/renderer 4, Vitest 4 (dans le conteneur : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`), Preact + htm standalone (ESM vendorisé, sans build), serveur Node natif (`studio/server.ts`, lancé par tsx).

**Spec :** `docs/v4/specs/2026-08-14-18-v4-studio-v2-editeur-dynamique.md`

## Progression

| Task | Statut | Date | Notes |
|---|---|---|---|
| 1. opacity + rotate sur tous les blocs | [x] | 2026-08-14 | |
| 2. Bordures par côté (remplace borderTopPx) | [x] | 2026-08-14 | |
| 3. Coins arrondis par coin (+ QR) | [ ] | | |
| 4. Typo étendue (italique, décoration, justify, maxLines, fond/padding) | [ ] | | |
| 5. objectFit des images | [ ] | | |
| 6. Doc feature : format enrichi | [ ] | | |
| 7. Contexte dynamique serveur (context.ts, render, presets) | [ ] | | |
| 8. Routes render/schema-info + statiques vendor-ui | [ ] | | |
| 9. Upload de ressources vers l'atelier | [ ] | | |
| 10. Scaffold + pack depuis le studio | [ ] | | |
| 11. UI : socle Preact (parité JSON + aperçu) | [ ] | | |
| 12. UI : onglet Contexte | [ ] | | |
| 13. UI : onglet Blocs | [ ] | | |
| 14. UI : métadonnées, polices, ressources, nouveau template | [ ] | | |
| 15. UI : génération du paquet + parcours complet + doc | [ ] | | |

## Global Constraints

- Unités : **pixels CSS à 96 dpi** partout dans le manifeste (1 px = 0,75 pt, helper `px()` de `src/lib/badge-templates/px.ts`).
- **Breaking pré-déploiement accepté** : `formatVersion` reste `1` ; tout manifeste du dépôt (prisma + scaffold) migre dans la même task que le changement de schéma qui le casse.
- Règle du texte avalé : un cadre texte doit avoir **h ≥ 1,45 × sizePx** par ligne (`@react-pdf` supprime silencieusement un texte trop à l'étroit).
- Langue : UI et messages d'erreur en **français accentué** ; code et identifiants en anglais ; commentaires de code en français (suivre le style du fichier) ; commits en français ASCII conventional commits.
- **Jamais de `git commit` sans demande explicite de l'utilisateur** : les étapes « Point de commit » ci-dessous PROPOSENT un message et s'arrêtent là.
- Tests : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ; avant de clore une task de fin de lot : `make lint && make typecheck && make test`.
- Les gates de couverture 100 % (lib + API) sont actives : tout nouveau code de `src/lib` doit être couvert.
- Uploads : sniff d'en-têtes obligatoire (jamais l'extension), 5 Mo max JPEG/PNG, 2 Mo max TTF/OTF.
- Ne jamais exposer de secrets dans les réponses du serveur studio (aucun accès BDD : il n'en a pas).

---

## Lot A — Format déclaratif enrichi

### Task 1 : `opacity` + `rotate` sur tous les blocs

**Files:**
- Modify: `src/lib/badge-templates/declarative/manifest-types.ts`
- Modify: `src/lib/badge-templates/declarative/schema.ts`
- Modify: `src/lib/badge-templates/declarative/renderer.tsx`
- Test: `src/lib/badge-templates/declarative/__tests__/schema.test.ts`, `.../renderer.test.tsx`

**Interfaces:**
- Produces: `BlockBase` porte désormais `opacity?: number` (0–1) et `rotate?: number` (±360, degrés sens horaire, pivot au centre du cadre non pivoté). `TextBlock` ne déclare plus `rotate` en propre. Le renderer émet `opacity` et `transform: rotate(...)` dans `frame(block)` pour tous les types.

- [x] **Step 1 : Tests qui échouent** — dans `schema.test.ts`, remplacer le test « accepte un bloc texte pivote » par la version tous-types, et ajouter l'opacité :

```ts
it("accepte rotate et opacity sur tout type de bloc", () => {
  expect(parse({ blocks: [{ ...VALID.blocks[0], rotate: 90, opacity: 0.5 }] }).ok).toBe(true);
  expect(
    parse({ blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118, rotate: -45, opacity: 1 }] }).ok,
  ).toBe(true);
  expect(
    parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#112233", opacity: 0.2 }] }).ok,
  ).toBe(true);
});

it("refuse une opacite hors bornes", () => {
  expect(parse({ blocks: [{ ...VALID.blocks[0], opacity: 1.5 }] }).ok).toBe(false);
});
```

Dans `renderer.test.tsx`, ajouter (le helper `render-to-json` collecte déjà `transforms` ; lui faire aussi collecter `opacities`) :

```ts
it("pivote et attenue un bloc de tout type", () => {
  const t = build(
    manifest([{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118, rotate: 45, opacity: 0.5 }]),
  );
  const out = renderToJson(t.Component, CTX);
  expect(out.transforms).toContain("rotate(45deg)");
  expect(out.opacities).toContain(0.5);
});
```

Dans `helpers/render-to-json.tsx` : ajouter `opacities: number[]` au type `Collected`, l'initialiser dans `renderToJson`, et dans `walk()` : `if (typeof style.opacity === "number") out.opacities.push(style.opacity);`.

- [x] **Step 2 : Vérifier l'échec** — `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/declarative` → les nouveaux tests échouent (clé `opacity` inconnue refusée par… rien : Zod strippe les clés inconnues, donc c'est le renderer qui échoue sur `opacities` vide et le schéma sur `rotate` posé sur un bloc qr).
- [x] **Step 3 : Implémentation** —
  - `manifest-types.ts` : déplacer `rotate?: number` de `TextBlock` vers `BlockBase`, ajouter `opacity?: number` à `BlockBase` (commentaire : rotation sens horaire autour du centre du cadre non pivoté, opacité 0–1 appliquée au bloc entier).
  - `schema.ts` : dans `baseShape`, ajouter `rotate: z.number().min(-360).max(360).optional(), opacity: z.number().min(0).max(1).optional()` ; retirer la ligne `rotate` du bloc texte.
  - `renderer.tsx` : `frame(block)` retourne aussi `opacity: block.opacity` et `transform: block.rotate !== undefined ? \`rotate(${block.rotate}deg)\` : undefined` ; retirer le transform spécifique du `<View>` de `renderText` (le frame le porte pour tous).
- [x] **Step 4 : Vérifier le vert** — même commande, tout passe.
- [x] **Step 5 : Point de commit (proposer, ne pas exécuter)** — `feat(v4): generalise rotation et opacite a tous les blocs du manifeste`

### Task 2 : Bordures complètes par côté (remplace `borderTopPx`)

**Files:**
- Modify: `src/lib/badge-templates/declarative/manifest-types.ts`, `schema.ts`, `renderer.tsx`
- Modify: `prisma/badge-templates/default/manifest.json` (seul manifeste du dépôt utilisant `borderTopPx` — vérifier `recto-verso` par grep et migrer pareil le cas échéant)
- Test: `schema.test.ts`, `renderer.test.tsx`

**Interfaces:**
- Produces:
```ts
export type BorderStyle = "solid" | "dashed" | "dotted";
export type BorderSide = { widthPx: number; color: string; style?: BorderStyle };
// Sur BlockBase :
//   border?: BorderSide;                       // les 4 cotes d'un coup
//   borderTop?, borderRight?, borderBottom?, borderLeft?: BorderSide;  // primes sur border
```
`borderTopPx` et `borderColor` disparaissent de `RectBlock`. La couleur d'une bordure accepte hexa ou source couleur (comme `fill`).

- [x] **Step 1 : Tests qui échouent** — `schema.test.ts` : remplacer le test « accepte une bande avec bordure » :

```ts
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
      { type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, fill: "#ffffff",
        border: { widthPx: 1, color: "rouge" } },
    ],
  });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/bordure/i);
});
```

`renderer.test.tsx` : remplacer « applique un arrondi et une bordure a un aplat » (retirer `borderTopPx`/`borderColor`, utiliser `borderTop: { widthPx: 4, color: "category.color" }`) et étendre `render-to-json` : collecter `borderWidths: number[]` (`style.borderTopWidth` etc. numériques). Vérifier `out.borderWidths` contient `px(4)`.

- [x] **Step 2 : Vérifier l'échec** — mêmes commandes vitest ; les anciens champs n'existant plus dans les tests, l'échec vient du schéma qui ignore `border`.
- [x] **Step 3 : Implémentation** —
  - Types : ajouter `BorderStyle`, `BorderSide`, les cinq champs optionnels sur `BlockBase` ; supprimer `borderTopPx`/`borderColor` de `RectBlock`.
  - Schéma : `const borderSideSchema = z.object({ widthPx: z.number().min(0), color: z.string().min(1), style: z.enum(["solid", "dashed", "dotted"]).optional() });` dans `baseShape` : `border: borderSideSchema.optional(), borderTop: ..., borderRight: ..., borderBottom: ..., borderLeft: ...`. Dans `checkBlock`, valider chaque couleur de bordure présente via `checkColor(side.color, \`${label} (bordure)\`, errors)`.
  - Renderer : nouvelle fonction

```tsx
function borderStyles(block: Block, ctx: TemplateContext) {
  const sides = {
    Top: block.borderTop ?? block.border,
    Right: block.borderRight ?? block.border,
    Bottom: block.borderBottom ?? block.border,
    Left: block.borderLeft ?? block.border,
  } as const;
  const out: Record<string, unknown> = {};
  for (const [side, decl] of Object.entries(sides)) {
    if (!decl) continue;
    out[`border${side}Width`] = px(decl.widthPx);
    out[`border${side}Color`] = colorOf(decl.color, ctx);
    out[`border${side}Style`] = decl.style ?? "solid";
  }
  return out;
}
```

  appliquée dans le rendu des `rect`, `image` et `qr` (spread après `frame(block)`), et sur le `<View>` des textes. Retirer `borderTopWidth`/`borderTopColor` spécifiques au rect.
  - Migration : dans `prisma/badge-templates/default/manifest.json`, remplacer `"borderTopPx": 1.3, "borderColor": "category.color"` par `"borderTop": { "widthPx": 1.3, "color": "category.color" }` (grep `borderTopPx` sur le dépôt pour attraper d'autres occurrences, scaffold compris).
- [x] **Step 4 : Vérifier le vert** — vitest declarative + `yarn vitest run src/lib/badge-templates studio scripts` (les seeds migrés passent `reference-packages.test.ts`).
- [x] **Step 5 : Point de commit (proposer)** — `feat(v4): bordures completes par cote sur tous les blocs`

### Task 3 : Coins arrondis par coin (+ blocs QR)

**Files:** mêmes fichiers que Task 2.

**Interfaces:**
- Produces:
```ts
export type CornerRadii = { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number };
// BlockBase.radiusPx?: number | CornerRadii   (remplace radiusPx de ImageBlock/RectBlock, s'etend a qr et text)
```

- [ ] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts
it("accepte un radius global ou par coin, y compris sur un qr", () => {
  expect(parse({ blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 118, h: 118, radiusPx: 8 }] }).ok).toBe(true);
  expect(
    parse({
      blocks: [
        { type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#ffffff",
          radiusPx: { topLeft: 8, bottomRight: 16 } },
      ],
    }).ok,
  ).toBe(true);
});
```

```ts
// renderer.test.tsx — render-to-json collecte radii: Array<Record<string, number>>
// (cles borderRadius / borderTopLeftRadius / ... presentes et numeriques)
it("applique un arrondi par coin", () => {
  const t = build(
    manifest([
      { type: "rect", page: 1, x: 0, y: 0, w: 118, h: 118, fill: "#ffffff",
        radiusPx: { topLeft: 8 } },
    ]),
  );
  expect(renderToJson(t.Component, CTX).radii[0].borderTopLeftRadius).toBe(px(8));
});
```

- [ ] **Step 2 : Vérifier l'échec** (vitest declarative).
- [ ] **Step 3 : Implémentation** — types (`CornerRadii`, `radiusPx` sur `BlockBase`, retiré des blocs image/rect) ; schéma : `radiusPx: z.union([z.number().min(0), z.object({ topLeft: z.number().min(0).optional(), topRight: ..., bottomRight: ..., bottomLeft: ... })]).optional()` dans `baseShape` ; renderer :

```tsx
function radiusStyles(block: Block) {
  const r = block.radiusPx;
  if (r === undefined) return {};
  if (typeof r === "number") return { borderRadius: px(r) };
  const out: Record<string, number> = {};
  if (r.topLeft !== undefined) out.borderTopLeftRadius = px(r.topLeft);
  if (r.topRight !== undefined) out.borderTopRightRadius = px(r.topRight);
  if (r.bottomRight !== undefined) out.borderBottomRightRadius = px(r.bottomRight);
  if (r.bottomLeft !== undefined) out.borderBottomLeftRadius = px(r.bottomLeft);
  return out;
}
```

appliqué à tous les types (spread avec `frame`/`borderStyles`) ; retirer les anciens `borderRadius: block.radiusPx ? px(...)` spécifiques.
- [ ] **Step 4 : Vérifier le vert** ; grep `radiusPx` dans les manifestes du dépôt : la forme nombre reste valide, aucune migration attendue.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): coins arrondis par coin et sur les blocs qr`

### Task 4 : Typo étendue — italique, décoration, justify, maxLines, fond et padding

**Files:**
- Modify: `manifest-types.ts`, `schema.ts`, `renderer.tsx`
- Modify: `src/lib/badge-templates/fonts.ts` (italiques Montserrat), `src/lib/badge-templates/declarative/fonts.ts` (`FontDeclaration.style`)
- Test: `schema.test.ts`, `renderer.test.tsx`, `src/lib/badge-templates/declarative/__tests__/fonts.test.ts`

**Interfaces:**
- Produces — sur `TextStyle` : `fontStyle?: "italic"`, `decoration?: "underline" | "line-through"`, `align` accepte `"justify"`, `maxLines?: number` (entier ≥ 1, ellipsis native), `backgroundColor?: string` (hexa ou source), `paddingPx?: number` (les 4 côtés). Sur `FontDeclaration` : `style?: "normal" | "italic"`. `shrink`/`truncate` calculent sur `w - 2*paddingPx`.

- [ ] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts
it("accepte la typo etendue", () => {
  const res = parse({
    blocks: [
      { ...VALID.blocks[0],
        style: { sizePx: 50, color: "#0f172a", overflow: "clip", fontStyle: "italic",
                 decoration: "underline", align: "justify", maxLines: 2,
                 backgroundColor: "category.color", paddingPx: 8 } },
    ],
  });
  expect(res.ok, errorsOf(res)).toBe(true);
});

it("refuse un maxLines non entier ou nul", () => {
  expect(parse({ blocks: [{ ...VALID.blocks[0], style: { ...VALID.blocks[0].style, maxLines: 0 } }] }).ok).toBe(false);
});

it("refuse un backgroundColor invalide", () => {
  const res = parse({
    blocks: [{ ...VALID.blocks[0], style: { ...VALID.blocks[0].style, backgroundColor: "bleu" } }],
  });
  expect(res.ok).toBe(false);
});
```

```ts
// renderer.test.tsx — render-to-json : textStyles collecte deja les traits typo ;
// ajouter fontStyle, textDecoration a la collecte, et viewPaddings (style.padding numerique).
it("rend italique, decoration, justify, maxLines, fond et padding", () => {
  const t = build(
    manifest([
      { type: "text", page: 1, x: 0, y: 0, w: 472, h: 94, text: "{event.title}",
        style: { sizePx: 38, color: "#000000", overflow: "clip", fontStyle: "italic",
                 decoration: "line-through", align: "justify", maxLines: 2,
                 backgroundColor: "#eeeeee", paddingPx: 8 } },
    ]),
  );
  const out = renderToJson(t.Component, CTX);
  expect(out.textStyles[0]).toMatchObject({ fontStyle: "italic", textDecoration: "line-through" });
  expect(out.viewPaddings).toContain(px(8));
  expect(out.fills).toContain("#eeeeee");
});
```

```ts
// fonts.test.ts (declarative)
it("enregistre une police avec son style italique", () => {
  const spy = vi.spyOn(Font, "register");
  registerTemplateFonts("tid", [{ alias: "titre", file: "fonts/A.ttf", weight: 700, style: "italic" }],
    () => "data:font/ttf;base64,AA==");
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ fonts: [expect.objectContaining({ fontStyle: "italic", fontWeight: 700 })] }),
  );
});
```

- [ ] **Step 2 : Vérifier l'échec** (vitest declarative).
- [ ] **Step 3 : Implémentation** —
  - Types : champs ci-dessus sur `TextStyle` ; `FontDeclaration.style?: "normal" | "italic"`.
  - Schéma : `fontStyle: z.enum(["italic"]).optional(), decoration: z.enum(["underline", "line-through"]).optional(), align: z.enum(["left", "center", "right", "justify"]).optional(), maxLines: z.number().int().min(1).optional(), backgroundColor: z.string().min(1).optional(), paddingPx: z.number().min(0).optional()` ; déclaration `fonts` : `style: z.enum(["normal", "italic"]).optional()` ; dans `checkTextBlock`, valider `style.backgroundColor` via `checkColor` quand présent.
  - `declarative/fonts.ts` : `fonts: [{ src: assets(font.file), fontWeight: font.weight ?? 400, fontStyle: font.style ?? "normal" }]`.
  - `src/lib/badge-templates/fonts.ts` : ajouter les entrées italiques 400 et 700 de Montserrat. Récupérer les URL exactes au moment de l'implémentation :
    `curl -s 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@1,400;1,700' -A 'Mozilla/5.0 (X11; Linux x86_64)' | grep -o 'https://[^)]*\.ttf'` (l'UA force le format TTF) ; ajouter `{ src: <url400>, fontWeight: 400, fontStyle: "italic" }` et `{ src: <url700>, fontWeight: 700, fontStyle: "italic" }`.
  - Renderer (`renderText`) : le `<View>` reçoit `backgroundColor: colorOf(style.backgroundColor, ctx)` (si présent) et `padding: px(style.paddingPx)` (si présent) ; le `<Text>` reçoit `fontStyle`, `textDecoration: style.decoration`, `maxLines: style.maxLines` (prop du composant, pas du style) et `textOverflow: style.maxLines ? "ellipsis" : undefined` ; `shrinkToFit`/`truncateToFit` reçoivent `widthPx = block.w - 2 * (style.paddingPx ?? 0)`.
- [ ] **Step 4 : Vérifier le vert** — vitest declarative, puis contrôle visuel rapide : lancer le studio (`make studio` déjà up → `docker compose -f docker-compose.dev.yml restart studio`), rendre un manifeste avec un bloc italique souligné et vérifier le PDF à l'œil.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): typo etendue du manifeste (italique, decoration, justify, maxLines, fond, padding)`

### Task 5 : `objectFit` des images

**Files:** `manifest-types.ts`, `schema.ts`, `renderer.tsx` + `schema.test.ts`, `renderer.test.tsx`.

**Interfaces:**
- Produces : `ImageBlock.objectFit?: "cover" | "contain" | "fill"` (défaut `cover`, comportement actuel inchangé). S'applique aussi au rendu du QR ? **Non** — le QR reste `cover` (toujours carré par construction).

- [ ] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts
it("accepte objectFit sur un bloc image", () => {
  const res = parse({
    blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 118, h: 118,
               source: "event.logoDataUrl", objectFit: "contain" }],
  });
  expect(res.ok, errorsOf(res)).toBe(true);
});
```

```ts
// renderer.test.tsx — render-to-json collecte objectFits: string[]
it("applique objectFit contain a une image", () => {
  const t = build(
    manifest([{ type: "image", page: 1, x: 0, y: 0, w: 331, h: 402,
                source: "participant.photoDataUrl", objectFit: "contain" }]),
  );
  expect(renderToJson(t.Component, CTX).objectFits).toContain("contain");
});
```

- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémentation** — type + `objectFit: z.enum(["cover", "contain", "fill"]).optional()` dans le bloc image du schéma ; renderer : `objectFit: block.type === "image" ? (block.objectFit ?? "cover") : "cover"`.
- [ ] **Step 4 : Vérifier le vert.**
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): objectFit configurable sur les blocs image`

### Task 6 : Documentation du format enrichi

**Files:**
- Modify: `docs/v4/features/templates-badges.md` (tableau des types de blocs, section styles, validation)
- Modify: `scripts/new-badge-template.ts` (README généré : tableau des champs)
- Modify: `badge-templates/*/README.md` s'ils existent (mêmes remplacements que le scaffold)

- [ ] **Step 1 :** Mettre à jour le tableau « Types de blocs » de la doc feature : champs communs (`opacity`, `rotate`, `border`/`borderTop|Right|Bottom|Left` `{widthPx, color, style}`, `radiusPx` nombre ou par coin) ; texte (`fontStyle`, `decoration`, `align` avec justify, `maxLines`, `backgroundColor`, `paddingPx`, `rotate` retiré de la ligne texte car devenu commun) ; image (`objectFit`) ; retirer toute mention de `borderTopPx`/`borderColor`. Ajouter une phrase : « Les ombres portées et les dégradés ne sont pas supportés (limite `@react-pdf`, décision spec 18). »
- [ ] **Step 2 :** Reporter les mêmes changements dans le README généré par `scripts/new-badge-template.ts` et les README d'atelier existants.
- [ ] **Step 3 :** Vérifier `grep -rn "borderTopPx" src scripts docs badge-templates prisma` → plus aucune occurrence hors specs historiques.
- [ ] **Step 4 :** Fin de lot : `make lint && make typecheck && make test` → tout vert.
- [ ] **Step 5 : Point de commit (proposer)** — `docs(v4): documente le format declaratif enrichi`

---

## Lot B — Serveur studio

### Task 7 : Contexte dynamique (`studio/context.ts`)

**Files:**
- Create: `studio/context.ts`
- Delete: `studio/contexts.ts`
- Modify: `studio/render.tsx`, `studio/server.ts` (import mort), `studio/public/app.js` (référence variant laissée telle quelle — remplacée en Task 11)
- Test: Create `studio/__tests__/context.test.ts` ; Modify `studio/__tests__/render.test.ts`

**Interfaces:**
- Produces:
```ts
// studio/context.ts
export type ContextInput = {
  participant?: Partial<{ firstName: string; lastName: string; structure: string; photoDataUrl: string }>;
  category?: Partial<{ name: string; color: string; neutralBadge: boolean; anonymous: boolean }>;
  event?: Partial<{ title: string; location: string; date: string; logoDataUrl: string | null }>; // date ISO
  badge?: Partial<{ id: string; verifyUrl: string }>;
};
export const DEFAULT_CONTEXT_INPUT: ContextInput;   // valeurs "Participant complet" (photo demo incluse)
export const PRESETS: Array<{ id: string; label: string; input: ContextInput }>;
export async function buildContext(input?: ContextInput): Promise<TemplateContext>; // fusion + QR reel
```
- `studio/render.tsx` : `renderManifest({ manifest, assets, context })` où `context: TemplateContext` (le paramètre `variantId` disparaît).

- [ ] **Step 1 : Tests qui échouent** — `studio/__tests__/context.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildContext, DEFAULT_CONTEXT_INPUT, PRESETS } from "../context";

describe("buildContext", () => {
  it("fusionne un contexte partiel avec les defauts", async () => {
    const ctx = await buildContext({ participant: { firstName: "Awa" } });
    expect(ctx.participant.firstName).toBe("Awa");
    expect(ctx.participant.lastName).not.toBe("");   // defaut conserve
    expect(ctx.event.date).toBeInstanceOf(Date);
  });

  it("genere un QR reel depuis verifyUrl", async () => {
    const ctx = await buildContext({ badge: { verifyUrl: "https://x/v/1" } });
    expect(ctx.badge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("expose des presets couvrant les anciens cas", () => {
    const ids = PRESETS.map((p) => p.id);
    for (const id of ["complet", "sans-photo", "anonyme", "neutre", "textes-longs"]) {
      expect(ids).toContain(id);
    }
  });

  it("sans argument, rend le contexte par defaut", async () => {
    const ctx = await buildContext();
    expect(ctx.participant.photoDataUrl).toMatch(/^data:image\/png/);
    expect(ctx).toMatchObject(await buildContext(DEFAULT_CONTEXT_INPUT));
  });
});
```

Adapter `render.test.ts` : `renderManifest({ manifest: MINIMAL, assets: [], context: await buildContext() })` ; le test « variante inconnue » disparaît ; ajouter « rend chaque preset » (boucle sur `PRESETS`, `buildContext(p.input)`).

- [ ] **Step 2 : Vérifier l'échec** — `yarn vitest run studio` → module `../context` introuvable.
- [ ] **Step 3 : Implémentation** — créer `studio/context.ts` en réutilisant le contenu de `contexts.ts` (constante `DEMO_PHOTO`, `SAMPLE_CONTEXT` comme socle des défauts, `generateQRCodeDataURL`) :

```ts
export async function buildContext(input: ContextInput = DEFAULT_CONTEXT_INPUT): Promise<TemplateContext> {
  const base = structuredClone(SAMPLE_CONTEXT);
  const merged: TemplateContext = {
    participant: { ...base.participant, ...DEFAULT_CONTEXT_INPUT.participant, ...input.participant },
    category: { ...base.category, ...DEFAULT_CONTEXT_INPUT.category, ...input.category },
    event: {
      ...base.event, ...DEFAULT_CONTEXT_INPUT.event, ...input.event,
      date: new Date(input.event?.date ?? DEFAULT_CONTEXT_INPUT.event!.date!),
    },
    badge: { ...base.badge, ...input.badge, qrCodeDataUrl: "" },
  };
  merged.badge.qrCodeDataUrl = await generateQRCodeDataURL(merged.badge.verifyUrl);
  return merged;
}
```

`PRESETS` reprend les cinq variantes actuelles sous forme d'`input` (ex. `{ id: "anonyme", label: "Catégorie anonyme", input: { category: { anonymous: true } } }` ; `textes-longs` reprend les valeurs longues de l'actuel `contexts.ts`). `renderMani​fest` prend `context` et le passe tel quel à `buildDeclarativeTemplate` (supprimer `buildVariantContext`). Supprimer `contexts.ts` et l'import `listVariants` de `server.ts` (la route `/api/variants` est retirée en Task 8 ; en attendant la faire répondre 404 en la supprimant dès maintenant si les tests serveur le permettent — sinon la neutraliser en Task 8).
- [ ] **Step 4 : Vérifier le vert** — `yarn vitest run studio`.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): contexte de previsualisation dynamique du studio`

### Task 8 : Routes `render` (contexte), `schema-info`, statiques `vendor/`–`ui/`

**Files:**
- Modify: `studio/server.ts`
- Test: `studio/__tests__/server.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/render` body `{ name: string, manifest: string, context?: ContextInput }` → 200 PDF | 422 `{errors}` | 400/404. `variant` n'existe plus.
  - `GET /api/schema-info` → 200 `{ sources: Record<string,string>, conditionPaths: string[], presets: Array<{id,label,input}>, minTextHeightRatio: 1.45 }`.
  - `GET /api/variants` supprimée (404).
  - `GET /vendor/<fichier>.mjs` et `GET /ui/<fichier>.js` servis depuis `studio/public/` (regex `/^\/(vendor|ui)\/[a-z0-9.-]+\.(mjs|js)$/`, type `text/javascript`).

- [ ] **Step 1 : Tests qui échouent** — dans `server.test.ts` (qui utilise déjà un serveur monté sur un atelier temporaire) :

```ts
it("rend avec un contexte partiel fourni", async () => {
  const res = await request("POST", "/api/render", {
    name: "t1", manifest: MANIFEST, context: { participant: { firstName: "Zoé" } },
  });
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toBe("application/pdf");
});

it("expose les informations de schema", async () => {
  const res = await request("GET", "/api/schema-info");
  expect(res.status).toBe(200);
  const body = JSON.parse(res.body.toString());
  expect(body.sources["participant.firstName"]).toBe("text");
  expect(body.conditionPaths).toContain("category.anonymous");
  expect(body.presets.map((p: { id: string }) => p.id)).toContain("anonyme");
  expect(body.minTextHeightRatio).toBe(1.45);
});

it("ne sert plus /api/variants", async () => {
  expect((await request("GET", "/api/variants")).status).toBe(404);
});

it("sert les modules statiques vendor et ui", async () => {
  // un fichier factice ecrit par le test dans studio/public/vendor est trop invasif :
  // tester le refus (403/404) d'un chemin traversant suffit ici, le contenu reel
  // etant verifie au navigateur en Task 11.
  expect((await request("GET", "/vendor/../server.ts")).status).toBe(404);
});
```

(Adapter `request()` du fichier existant : il accepte déjà method/path/body JSON.) Mettre à jour les tests render existants du serveur pour le nouveau body (`context` au lieu de `variant`).
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémentation** — dans `handle()` : route render lit `{name, manifest, context}` (context optionnel, objet → `buildContext(context)` ; refuser un `context` non-objet par 400) ; ajouter `/api/schema-info` (imports `SOURCES`, `CONDITION_PATHS` de `src/lib/badge-templates/declarative/sources`, `PRESETS` de `./context`) ; supprimer la route variants ; ajouter le service statique regex AVANT le 404 final (résoudre `join(PUBLIC_DIR, path)` puis vérifier `resolve(...)` commence par `PUBLIC_DIR` — défense chemin traversant, un échec de lecture → 404).
- [ ] **Step 4 : Vérifier le vert** — `yarn vitest run studio`.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): routes contexte, schema-info et statiques du studio`

### Task 9 : Upload de ressources vers l'atelier

**Files:**
- Modify: `src/lib/badge-templates/package-reader.ts` (exporter `checkAsset`)
- Modify: `studio/workshop.ts`, `studio/server.ts`
- Test: `studio/__tests__/workshop.test.ts` (existant ? sinon créer), `studio/__tests__/server.test.ts`, et le test existant de `package-reader` reste vert

**Interfaces:**
- Produces:
  - `package-reader.ts` : `export function checkAsset(path: string, body: Buffer): { error: string } | { contentType: string }` (fonction existante, simplement exportée).
  - `workshop.ts` : `export async function saveAsset(root: string, name: string, dir: "assets" | "fonts", filename: string, body: Buffer): Promise<{ ok: true; path: string } | { ok: false; error: string }>` — valide le nom de fichier (`/^[a-z0-9][a-z0-9._-]{0,63}$/i`, refus de `..`), applique `checkAsset`, crée le sous-dossier au besoin (`mkdir recursive`), écrit.
  - Serveur : `POST /api/templates/:name/assets` body `{ dir: "assets"|"fonts", filename: string, dataBase64: string }` → 200 `{ ok: true, path }` | 422 `{ error }` | 400/404.

- [ ] **Step 1 : Tests qui échouent** —

```ts
// workshop.test.ts (atelier temporaire mkdtemp, motif des tests studio existants)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

it("enregistre une image sniffee dans assets/", async () => {
  const saved = await saveAsset(root, "t1", "assets", "fond.png", PNG);
  expect(saved).toEqual({ ok: true, path: "assets/fond.png" });
  await expect(readFile(join(root, "t1", "assets", "fond.png"))).resolves.toBeDefined();
});

it("refuse un fichier au contenu non reconnu", async () => {
  const saved = await saveAsset(root, "t1", "assets", "note.txt", Buffer.from("bonjour"));
  expect(saved.ok).toBe(false);
});

it("refuse un webp renomme en png dans assets/", async () => {
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
  expect((await saveAsset(root, "t1", "assets", "fond.png", webp)).ok).toBe(false);
});

it("refuse un nom de fichier traversant", async () => {
  expect((await saveAsset(root, "t1", "assets", "../evil.png", PNG)).ok).toBe(false);
});

it("refuse une police dans assets/ et inversement", async () => {
  const ttf = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
  expect((await saveAsset(root, "t1", "assets", "police.ttf", ttf)).ok).toBe(false);
  expect((await saveAsset(root, "t1", "fonts", "InterVar.ttf", ttf)).ok).toBe(true);
});
```

Côté serveur : un test 200 (upload PNG base64 → fichier présent puis visible dans `GET /api/templates/t1`), un test 422 (contenu refusé), un 404 (template inconnu).
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémentation** — exporter `checkAsset` ; `saveAsset` dans workshop (`checkAsset(\`${dir}/${filename}\`, body)` applique déjà les bons formats/tailles selon le dossier) ; route serveur : décoder `Buffer.from(dataBase64, "base64")`, refuser body malformé par 400.
- [ ] **Step 4 : Vérifier le vert** — `yarn vitest run studio src/lib/badge-templates/__tests__/package-reader.test.ts`.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): upload de ressources vers l'atelier depuis le studio`

### Task 10 : Nouveau template + génération du paquet

**Files:**
- Modify: `scripts/pack-badge-template.ts` (extraire `buildArchive`)
- Create: `studio/pack.ts`
- Modify: `studio/server.ts`
- Test: `scripts/__tests__/pack-badge-template.test.ts` (reste vert), `studio/__tests__/pack.test.ts` (créer), `studio/__tests__/server.test.ts`

**Interfaces:**
- Produces:
  - `scripts/pack-badge-template.ts` : `export async function buildArchive(dir: string): Promise<Buffer>` — lit `manifest.json` + `assets/`/`fonts/` du dossier, valide (`parseManifest`), lève `Error` avec les messages joints sinon, retourne le zip en mémoire. `packTemplate(name, root)` devient un wrapper : `buildArchive` + `writeFileSync(root/name.zip)` (comportement CLI inchangé).
  - `studio/pack.ts` : `export async function packFromStudio(root: string, name: string, manifest: string): Promise<{ ok: true; zip: Buffer } | { ok: false; errors: string[] }>` — `writeManifest` d'abord (le zip reflète TOUJOURS ce qui est enregistré), puis `buildArchive`, erreurs de validation capturées.
  - Serveur : `POST /api/templates` body `{ name }` → 201 `{ ok: true }` | 409 si existe | 400 (réutilise `createSkeleton` de `scripts/new-badge-template`) ; `POST /api/templates/:name/pack` body `{ manifest: string }` → 200 zip (`content-type: application/zip`, `content-disposition: attachment; filename="<name>.zip"`) | 422 `{ errors }` | 404.

- [ ] **Step 1 : Tests qui échouent** — `pack.test.ts` : atelier temporaire contenant un template valide (manifeste minimal + `assets/apercu.png` factice PNG) → `packFromStudio` retourne `ok: true` et un buffer commençant par `PK` ; un manifeste invalide (JSON illisible, puis bloc fautif) → `ok: false` avec messages ; le manifeste passé est bien écrit sur disque avant pack (relire le fichier). Serveur : 201 sur création (`GET /api/templates` liste le nouveau), 409 sur doublon, 200 zip sur pack, 422 sinon.
- [ ] **Step 2 : Vérifier l'échec.**
- [ ] **Step 3 : Implémentation** — refactor `buildArchive` (déplacer le corps de `packTemplate`, la validation et JSZip ; `generateAsync({ type: "nodebuffer" })`) ; `studio/pack.ts` ; routes serveur (création : valider `isValidTemplateName`, `mkdir` absent → `createSkeleton(name, root)` dans un try/catch 409 sur « existe deja »).
- [ ] **Step 4 : Vérifier le vert** — `yarn vitest run studio scripts` puis fin de lot : `make lint && make typecheck && make test`.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): creation de template et generation du paquet depuis le studio`

---

## Lot C — Interface Preact

### Task 11 : Socle Preact — parité JSON + aperçu

**Files:**
- Create: `studio/public/vendor/preact-htm.mjs` (téléchargé, version figée), `studio/public/vendor/README.md` (provenance, version, licence MIT)
- Rewrite: `studio/public/index.html`, `studio/public/app.js`, `studio/public/styles.css`
- Create: `studio/public/ui/api.js` (client HTTP), `studio/public/ui/preview.js`

**Interfaces:**
- Produces (modules ES importés par `app.js`) :
  - `vendor/preact-htm.mjs` : exporte `html`, `render`, `useState`, `useEffect`, `useCallback`, `useRef` (standalone htm/preact).
  - `ui/api.js` : `listTemplates()`, `getTemplate(name)`, `putManifest(name, manifest)`, `renderPdf(name, manifest, context) → Blob|{errors}`, `getSchemaInfo()`, `createTemplate(name)`, `uploadAsset(name, dir, filename, file)`, `packTemplate(name, manifest) → Blob|{errors}` — toutes en `fetch` JSON (fichiers encodés base64 via `FileReader`).
  - État racine dans `app.js` : `{ templates, current, manifestText, context, tab: "context"|"blocks"|"json", errors, status, schemaInfo }`. L'objet manifeste parsé est dérivé de `manifestText` quand il est valide (source de vérité unique, cf. spec).

- [ ] **Step 1 : Vendoriser** — télécharger la version figée du standalone :
  `curl -sL https://unpkg.com/htm@3.1.1/preact/standalone.module.js -o studio/public/vendor/preact-htm.mjs` ; créer `vendor/README.md` (« htm 3.1.1 + preact bundlés, MIT, https://github.com/developit/htm — fichier vendorisé pour un studio sans build ni CDN »). Vérifier que le fichier exporte bien `html`, `render` et les hooks (`grep -o "export{[^}]*}" studio/public/vendor/preact-htm.mjs`).
- [ ] **Step 2 : Recrire `index.html`** — `<div id="app"></div>` + `<script type="module" src="/app.js">` seulement (le shell est rendu par Preact).
- [ ] **Step 3 : `app.js`** — reproduire la parité fonctionnelle actuelle en Preact :

```js
import { html, render, useState, useEffect, useCallback, useRef } from "/vendor/preact-htm.mjs";
import * as api from "/ui/api.js";
import { Preview } from "/ui/preview.js";

function App() {
  const [templates, setTemplates] = useState([]);
  const [current, setCurrent] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [context, setContext] = useState(null);       // null = defauts serveur
  const [tab, setTab] = useState("json");
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [schemaInfo, setSchemaInfo] = useState(null);

  useEffect(() => {
    api.listTemplates().then((list) => {
      setTemplates(list);
      if (list.length > 0) selectTemplate(list[0].name);
    });
    api.getSchemaInfo().then(setSchemaInfo);
  }, []);

  const selectTemplate = useCallback(async (name) => {
    const read = await api.getTemplate(name);
    setCurrent(name);
    setManifestText(read.manifest);
    setErrors([]);
  }, []);

  const save = useCallback(async () => {
    await api.putManifest(current, manifestText);
    setStatus("Enregistré");
    setTimeout(() => setStatus(""), 2000);
  }, [current, manifestText]);

  const TABS = [["context", "Contexte"], ["blocks", "Blocs"], ["json", "JSON"]];
  return html`
    <header>
      <h1>Studio de templates</h1>
      <select value=${current} onChange=${(e) => selectTemplate(e.target.value)}>
        ${templates.map((t) => html`<option value=${t.name}>${t.name}</option>`)}
      </select>
      <button type="button" onClick=${save}>Enregistrer</button>
      <span role="status">${status}</span>
    </header>
    <main>
      <section class="editor">
        <nav>
          ${TABS.map(([id, label]) => html`
            <button type="button" class=${tab === id ? "active" : ""} onClick=${() => setTab(id)}>${label}</button>`)}
        </nav>
        ${tab === "json" &&
        html`<textarea spellcheck="false" value=${manifestText}
          onInput=${(e) => setManifestText(e.target.value)} />`}
        ${/* tab "context" branche en Task 12, tab "blocks" en Task 13 : afficher
            d'ici la un simple paragraphe "A venir" pour chaque onglet manquant */ ""}
        <ul class="errors" hidden=${errors.length === 0}>
          ${errors.map((e) => html`<li>${e}</li>`)}
        </ul>
      </section>
      <${Preview} name=${current} manifestText=${manifestText} context=${context} onErrors=${setErrors} />
    </main>`;
}
render(html`<${App} />`, document.getElementById("app"));
```

`ui/preview.js` : composant qui débounce (400 ms, `useRef` pour le timer), appelle `api.renderPdf`, gère l'URL d'objet (`URL.createObjectURL` + `revokeObjectURL` de la précédente), affiche `<object type="application/pdf">` ; en cas de 422, remonte `onErrors(errors)` **sans** écraser le PDF affiché (règle spec 16 conservée). `ui/api.js` : wrappers `fetch` fins, `renderPdf` retourne `{ ok: true, blob }` ou `{ ok: false, errors }`.
- [ ] **Step 4 : Vérification navigateur** — `docker compose -f docker-compose.dev.yml restart studio` puis sur `http://localhost:3786` : la liste des templates charge, l'onglet JSON édite, l'aperçu se met à jour en tapant, un JSON invalide affiche l'erreur sans perdre l'aperçu, Enregistrer écrit sur disque (vérifier le fichier). Tester aussi `https://studio.badge.local`.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): socle Preact du studio (parite JSON et apercu)`

### Task 12 : Onglet Contexte

**Files:**
- Create: `studio/public/ui/context-form.js`
- Modify: `studio/public/app.js` (branch onglet), `studio/public/styles.css`

**Interfaces:**
- Produces : `ContextForm({ context, schemaInfo, onChange })` — rend les quatre sections (participant, catégorie, événement, badge) ; `onChange(nextContextInput)` remonte un `ContextInput` (voir Task 7) ; boutons presets depuis `schemaInfo.presets` (`onChange(preset.input)`).

- [ ] **Step 1 : Implémenter `context-form.js`** — champs contrôlés (`value` + `onInput`) pour : participant prénom/nom/structure + **upload photo** ; catégorie nom/couleur (`<input type="color">`)/cases anonyme + neutre ; événement titre/lieu/date (`<input type="date">` → ISO) + **upload logo** (+ bouton « retirer ») ; badge id/verifyUrl. Upload générique :

```js
function readAsDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}
// <input type="file" accept="image/png,image/jpeg" onChange=${(e) => readAsDataUrl(e.target.files[0], (url) => patch("participant", { photoDataUrl: url }))} />
```

La photo/le logo restent en mémoire client (data URL dans le contexte envoyé au rendu) — rien n'est écrit dans l'atelier ici.
- [ ] **Step 2 : Brancher dans `app.js`** — l'onglet Contexte rend `ContextForm` ; tout changement de contexte déclenche l'aperçu (même debounce que le manifeste).
- [ ] **Step 3 : Vérification navigateur** — changer le prénom → l'aperçu suit ; uploader une photo JPEG → visible sur le badge ; cocher « anonyme » → les blocs conditionnels basculent ; presets : chaque bouton remplit le formulaire et l'aperçu correspond aux cinq anciens cas ; date modifiée → date rendue formatée.
- [ ] **Step 4 : Point de commit (proposer)** — `feat(v4): formulaire de contexte libre du studio`

### Task 13 : Onglet Blocs

**Files:**
- Create: `studio/public/ui/blocks-editor.js`, `studio/public/ui/block-form.js`
- Modify: `studio/public/app.js`, `studio/public/styles.css`

**Interfaces:**
- Produces :
  - `BlocksEditor({ manifest, schemaInfo, onChange })` — `manifest` est l'objet parsé ; `onChange(nextManifest)` resérialise vers `manifestText` (2 espaces d'indentation) : la synchronisation bidirectionnelle passe par là.
  - `BlockForm({ block, index, schemaInfo, pageCount, onChange, onRemove, onDuplicate, onMove })`.
  - Défauts d'ajout par type (constante `BLOCK_DEFAULTS` exportée par `blocks-editor.js`) :

```js
export const BLOCK_DEFAULTS = {
  text: { type: "text", page: 1, x: 20, y: 20, w: 200, h: 30,
          text: "Texte", style: { sizePx: 16, color: "#0f172a", overflow: "clip" } },
  image: { type: "image", page: 1, x: 20, y: 20, w: 100, h: 100, source: "participant.photoDataUrl" },
  qr: { type: "qr", page: 1, x: 20, y: 20, w: 60, h: 60 },
  rect: { type: "rect", page: 1, x: 20, y: 20, w: 100, h: 40, fill: "#e2e8f0" },
};
```

- [ ] **Step 1 : `blocks-editor.js`** — liste repliable : chaque entrée affiche `n° · type · résumé` (texte : gabarit tronqué ; image : source/asset ; rect : fill) + `x,y w×h` ; boutons ↑ ↓ ⧉ ✕ ; barre « Ajouter : Texte Image QR Aplat » (`onChange({...manifest, blocks: [...blocks, BLOCK_DEFAULTS[type]]})`).
- [ ] **Step 2 : `block-form.js`** — formulaire du bloc déplié :
  - communs : page (select 1..pageCount), x/y/w/h (`<input type="number">`), rotate, opacity, radiusPx (nombre OU quatre champs par coin via une case « par coin »), bordures (case « bordure » → widthPx/couleur/style, + par côté en mode avancé) ;
  - texte : gabarit (`textarea` monoligne), et le style complet : sizePx, minSizePx, weight (select 400/500/600/700), fontStyle italic (case), align (select avec justify), color, overflow (select), maxLines, letterSpacing, lineHeight, transform, decoration, backgroundColor, paddingPx, font (select des alias déclarés dans `manifest.fonts`) ;
  - image : source (select des sources `image` de `schemaInfo.sources`) OU asset (select des fichiers `assets/` du template — fournis par `getTemplate`), objectFit, radius ;
  - rect : fill (couleur hexa ou select de sources `color`) ;
  - `visibleIf` : liste de conditions — chaque ligne : select du chemin (`schemaInfo.conditionPaths` pour equals, toutes les sources pour isEmpty), select `equals vrai / equals faux / est vide / n'est pas vide`, bouton ✕, bouton « + condition » ;
  - **avertissement hauteur** : si `type === "text"` et `h < style.sizePx * schemaInfo.minTextHeightRatio`, afficher « ⚠ Cadre trop bas : le texte ne s'affichera pas (h ≥ 1,45 × police). ».
  - Couleurs : composant partagé `ColorInput` (champ texte hexa + pastille `<input type="color">` synchronisée + select optionnel de sources couleur).
- [ ] **Step 3 : Synchronisation** — dans `app.js` : l'onglet Blocs ne s'affiche que si `manifestText` parse (sinon message « Corrigez le JSON pour éditer les blocs ») ; toute édition de bloc resérialise `manifestText` ; l'onglet JSON reflète immédiatement ; les erreurs 422 du rendu s'affichent sous l'aperçu et, quand le message commence par `bloc N`, aussi en rouge sur l'entrée N de la liste.
- [ ] **Step 4 : Vérification navigateur** — ajouter un bloc de chaque type, le déplacer/dupliquer/supprimer ; éditer x/y et voir l'aperçu bouger ; créer un visibleIf anonyme et le vérifier via l'onglet Contexte ; provoquer l'avertissement de hauteur ; vérifier l'aller-retour Blocs ↔ JSON dans les deux sens.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): editeur de blocs dynamique du studio`

### Task 14 : Métadonnées, polices, ressources, nouveau template

**Files:**
- Create: `studio/public/ui/meta-panel.js`
- Modify: `studio/public/app.js` (le panneau vit en tête de l'onglet Blocs ou en 4e onglet « Paquet » — choisir « Paquet », plus lisible), `studio/public/styles.css`

**Interfaces:**
- Produces : `MetaPanel({ manifest, assets, name, onChange, onAssetsChanged })` — édite `family`, `label`, `description`, `preview` (select des fichiers `assets/`), `fonts` (liste dynamique : alias, fichier — select des fichiers `fonts/` —, weight, italique, ✕ / + police) ; zone d'upload (deux boutons « Ajouter une image », « Ajouter une police ») → `api.uploadAsset` puis `onAssetsChanged()` (recharge `getTemplate` pour rafraîchir les listes). Avertissement inline si `preview` ou un fichier de police déclaré n'est plus dans la liste des fichiers présents.

- [ ] **Step 1 : Implémenter `meta-panel.js`** (formulaires contrôlés, resérialisation via `onChange` comme l'éditeur de blocs).
- [ ] **Step 2 : « Nouveau template »** dans le header : prompt du nom (valider le slug côté client avec le même motif `/^[a-z0-9]+(-[a-z0-9]+)*$/`), `api.createTemplate`, recharger la liste, sélectionner le nouveau.
- [ ] **Step 3 : Vérification navigateur** — créer un template neuf ; uploader une image dans `assets/` (elle apparaît dans les selects `preview`/asset) ; uploader une police TTF, la déclarer avec un alias, l'utiliser dans un bloc texte, la voir dans l'aperçu ; supprimer le fichier au Finder → l'avertissement inline apparaît au rechargement.
- [ ] **Step 4 : Point de commit (proposer)** — `feat(v4): panneau paquet du studio (metadonnees, polices, ressources)`

### Task 15 : Génération du paquet + parcours complet + documentation

**Files:**
- Modify: `studio/public/app.js` (bouton « Générer le paquet »), `studio/public/ui/api.js`
- Modify: `docs/v4/features/templates-badges.md` (section studio), `docs/v4/README.md` si besoin
- Modify: `docs/v4/plans/2026-08-14-studio-v2-editeur-dynamique.md` (Progression finale)

- [ ] **Step 1 : Bouton « Générer le paquet »** — header : `api.packTemplate(current, manifestText)` ; 200 → `URL.createObjectURL(blob)` + `<a download="${current}.zip">` cliqué programmatiquement puis révoqué ; 422 → erreurs affichées au même endroit que celles du rendu.
- [ ] **Step 2 : Parcours complet (critère d'acceptation 1 de la spec)** — au navigateur : créer un template vierge → uploader une photo de contexte et une image de fond → composer 3-4 blocs au formulaire (dont un pivoté et un avec bordure) → renseigner les métadonnées + aperçu → Générer le paquet → téléverser le zip obtenu dans `/platform/badge-templates` de l'app (`https://badge.local`) → l'installation passe et la page de détail montre l'épreuve.
- [ ] **Step 3 : Documentation** — dans `templates-badges.md`, réécrire la sous-section studio : onglets, contexte libre + presets, éditeur de blocs, panneau paquet, génération du zip ; noter le vendoring Preact (`studio/public/vendor/`, version figée, MIT) et l'absence de build.
- [ ] **Step 4 : Fin de chantier** — `make lint && make typecheck && make test` ; mettre à jour la table Progression du plan ; état des lieux à l'utilisateur.
- [ ] **Step 5 : Point de commit (proposer)** — `feat(v4): generation du paquet et documentation du studio v2`
