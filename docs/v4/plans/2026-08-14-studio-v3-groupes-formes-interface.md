# Plan d'implémentation — Studio v3 : groupes, formes et interface en trois colonnes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Étendre le format déclaratif (noms de blocs, groupes-conteneurs imbriquables, formes `rect`/`square`/`circle` à fond couleur et/ou image remplaçant le type `image`) et refondre l'interface du studio façon Figma : trois colonnes (Blocs + Contexte | canvas PDF | inspecteur), liste de calques sans numéros, renommage, grouper/dégrouper, contrôles adaptés à leur nature, thème sombre.

**Architecture :** **Lot A** (tasks 1–5) : format déclaratif en TDD. La task 3 est **breaking** (le type `image` disparaît au profit du fond des formes) : les manifestes du dépôt migrent dans la même task et les templates installés en BDD dev sont re-seedés. **Lot B** (tasks 6–10) : logique d'arbre pure testée en TDD (`blocks-tree.js`), puis refonte UI Preact par panneaux. Chaque task laisse le studio fonctionnel.

**Tech Stack :** TypeScript 5, Zod, @react-pdf/renderer 4, Vitest 4 (`docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`), Preact + htm vendorisé (`studio/public/vendor/preact-htm.mjs`), serveur `studio/server.ts` (tsx).

**Spec :** `docs/v4/specs/2026-08-14-19-v4-studio-v3-groupes-formes-interface.md`

## Progression

| Task | Statut | Date | Notes |
|---|---|---|---|
| 1. `name` sur tout bloc | [x] | 2026-08-14 | |
| 2. Types `square` et `circle` | [x] | 2026-08-14 | |
| 3. Fond des formes (couleur/image) et retrait du type `image` | [x] | 2026-08-14 | Manifestes du depot migres ; BDD non touchee (re-seed manuel a faire) |
| 4. Type `group` (conteneur récursif) | [x] | 2026-08-14 | |
| 5. Doc du format (feature + scaffold) | [x] | 2026-08-14 | Lot A termine, lint/typecheck/test verts |
| 6. `blocks-tree.js` : opérations d'arbre pures (TDD) | [x] | 2026-08-14 | |
| 7. Layout 3 colonnes + thème sombre + bascule JSON | [x] | 2026-08-14 | Verif visuelle navigateur a faire a la main |
| 8. Panneau Blocs : arbre, renommage, grouper/dégrouper | [x] | 2026-08-14 | Verif visuelle navigateur a faire a la main |
| 9. Inspecteur : contrôles par nature + Paquet par défaut | [x] | 2026-08-14 | Sections fonctionnelles ; verif visuelle a faire a la main |
| 10. Contexte en bas à gauche + erreurs canvas + doc + vérif finale | [x] | 2026-08-14 | Parcours API valide (groupe + cercle a fond image + carre + QR rendus) ; passe visuelle navigateur des criteres 2/3/4 a faire a la main |

## Global Constraints

- Unités : **pixels CSS à 96 dpi** (1 px = 0,75 pt, helper `px()`).
- `formatVersion` reste `1` (breaking pré-déploiement accepté) : la task 3 supprime le type `image` — tout manifeste du dépôt (seeds `prisma/badge-templates/`, ateliers `badge-templates/`, scaffold) migre **dans la même task**. `parseManifest` reste le seul juge.
- **NE PAS toucher à la base de données** : ce chantier ne concerne que le studio et les fichiers du dépôt. Aucune commande `prisma db execute` / `db seed` / `db push` — les templates installés en base seront rafraîchis par un re-seed manuel de l'utilisateur, hors plan.
- Règle du texte avalé : h ≥ 1,45 × sizePx par ligne (avertissement UI existant, à conserver).
- Langue : UI/erreurs en français accentué ; code en anglais ; commentaires en français ; commits en français ASCII conventional commits.
- Tests : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ; en fin de lot : `make lint && make typecheck && make test`. Gates de couverture 100 % actives sur `src/lib`.
- Le studio tourne dans le conteneur `studio` : après un changement de code serveur ou lib, `docker compose -f docker-compose.dev.yml restart studio` avant toute vérification HTTP (le code n'est pas rechargé à chaud). Les fichiers `studio/public/` sont servis à la volée (un simple rechargement navigateur suffit).
- Vérifications navigateur : en session headless, vérifier au mieux par `curl` (le HTML sert les modules, `/api/render` répond) et **noter dans la Progression que la passe visuelle reste à faire à la main**.

---

## Lot A — Format déclaratif

### Task 1 : `name` sur tout bloc

**Files:**
- Modify: `src/lib/badge-templates/declarative/manifest-types.ts`, `schema.ts`
- Test: `src/lib/badge-templates/declarative/__tests__/schema.test.ts`

**Interfaces:**
- Produces : `BlockBase.name?: string` (1–60 caractères). Purement descriptif : ni le renderer ni la validation sémantique n'y touchent.

- [x] **Step 1 : Test qui échoue** — dans `schema.test.ts` :

```ts
it("accepte un nom de bloc et refuse un nom hors bornes", () => {
  expect(parse({ blocks: [{ ...VALID.blocks[0], name: "Titre principal" }] }).ok).toBe(true);
  expect(parse({ blocks: [{ ...VALID.blocks[0], name: "" }] }).ok).toBe(false);
  expect(parse({ blocks: [{ ...VALID.blocks[0], name: "x".repeat(61) }] }).ok).toBe(false);
});
```

- [x] **Step 2 : Vérifier l'échec** — `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates/declarative` : le cas `name: ""` passe à tort (Zod strippe la clé inconnue), donc le test échoue.
- [x] **Step 3 : Implémentation** — `manifest-types.ts` : `name?: string;` dans `BlockBase` (commentaire : « Nom d'affichage dans le studio ; aucun effet sur le rendu. ») ; `schema.ts` : `name: z.string().min(1).max(60).optional(),` dans `baseShape`.
- [x] **Step 4 : Vérifier le vert** — même commande.
- [x] **Step 5 : Point de commit** — `feat(v4): nom d'affichage optionnel sur les blocs du manifeste`

### Task 2 : Types `square` et `circle`

**Files:**
- Modify: `manifest-types.ts`, `schema.ts`, `renderer.tsx`
- Test: `schema.test.ts`, `renderer.test.tsx`

**Interfaces:**
- Produces :

```ts
export type SquareBlock = BlockBase & { type: "square"; fill: string }; // w = h valide
export type CircleBlock = BlockBase & { type: "circle"; fill: string }; // radiusPx interdit
export type Block = TextBlock | ImageBlock | QrBlock | RectBlock | SquareBlock | CircleBlock;
```

Rendu : `square` = comme `rect` ; `circle` = comme `rect` avec `borderRadius = px(min(w, h) / 2)` (ellipse si w ≠ h), `radiusStyles` ignoré.

- [x] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts
it("accepte un carre et refuse un carre non carre", () => {
  expect(parse({ blocks: [{ type: "square", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#112233" }] }).ok).toBe(true);
  const res = parse({ blocks: [{ type: "square", page: 1, x: 0, y: 0, w: 80, h: 60, fill: "#112233" }] });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/carre/i);
});

it("accepte un cercle et refuse son radiusPx", () => {
  expect(parse({ blocks: [{ type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "category.color" }] }).ok).toBe(true);
  const res = parse({ blocks: [{ type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#112233", radiusPx: 4 }] });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/rayon implicite/i);
});

it("valide la couleur de remplissage des formes", () => {
  expect(parse({ blocks: [{ type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "rouge" }] }).ok).toBe(false);
});
```

```ts
// renderer.test.tsx
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
```

- [x] **Step 2 : Vérifier l'échec** (vitest declarative).
- [x] **Step 3 : Implémentation** —
  - Types : les deux nouveaux types + union `Block` étendue.
  - Schéma : deux membres d'union `z.object({ type: z.literal("square"), fill: z.string(), ...baseShape })` (idem `circle`) ; dans `checkBlock` :

```ts
if (block.type === "square" && block.w !== block.h) {
  errors.push(`${label} : un carre exige w = h (${block.w}×${block.h} recus).`);
}
if (block.type === "circle" && block.radiusPx !== undefined) {
  errors.push(`${label} : un cercle a un rayon implicite, radiusPx n'y est pas admis.`);
}
if (block.type === "rect" || block.type === "square" || block.type === "circle") {
  checkColor(block.fill, `${label} (remplissage)`, errors);
}
```

  (remplace la ligne `rect` seule existante).
  - Renderer : le cas `rect` devient `rect | square | circle` :

```tsx
if (block.type === "rect" || block.type === "square" || block.type === "circle") {
  const circleRadius =
    block.type === "circle" ? { borderRadius: px(Math.min(block.w, block.h) / 2) } : radiusStyles(block);
  return (
    <View key={key}
      style={{ ...frame(block), ...borderStyles(block, ctx), ...circleRadius,
               backgroundColor: colorOf(block.fill, ctx) }} />
  );
}
```

- [x] **Step 4 : Vérifier le vert.**
- [x] **Step 5 : Point de commit** — `feat(v4): types square et circle dans le manifeste`

### Task 3 : Fond des formes (couleur/image) et retrait du type `image`

**Files:**
- Modify: `manifest-types.ts`, `schema.ts`, `renderer.tsx`
- Modify (migration mécanique `type: "image"` → forme + fond) : `prisma/badge-templates/default/manifest.json`, `prisma/badge-templates/recto-verso/manifest.json`, `badge-templates/*/manifest.json` (ateliers, si présents)
- Modify (tests utilisant des blocs image) : `schema.test.ts`, `renderer.test.tsx`, `src/lib/badge-templates/__tests__/{install,resolve,render-proof,package-reader}.test.*`, `src/app/api/platform/badge-templates/**/__tests__/*.test.ts`, `studio/__tests__/*.test.ts` (grep `"image"` pour la liste exacte)

**Interfaces:**
- Produces :

```ts
export type ShapeImage = { source?: string; asset?: string; fit?: "cover" | "contain" | "fill" };
export type RectBlock   = BlockBase & { type: "rect";   fill?: string; image?: ShapeImage };
export type SquareBlock = BlockBase & { type: "square"; fill?: string; image?: ShapeImage };
export type CircleBlock = BlockBase & { type: "circle"; fill?: string; image?: ShapeImage };
// ImageBlock et objectFit DISPARAISSENT ; le QR reste un type a part.
```

Validation : une forme exige **au moins un** de `fill`/`image` ; un `image` porte **exactement un** de `source` (source de type image) / `asset` (présent dans le paquet) ; `fit` optionnel (`cover` par défaut au rendu). Rendu : `View` (fond couleur, bordures, coins, `overflow: "hidden"`) contenant l'`Image` 100 % × 100 % avec son `objectFit` — le rognage (coins, cercle) est porté par la `View`.

- [x] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts — remplacer les tests des blocs image par ceux du fond de forme.
it("accepte une forme a fond image, couleur, ou les deux", () => {
  expect(parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80,
    image: { source: "participant.photoDataUrl" } }] }).ok).toBe(true);
  expect(parse({ blocks: [{ type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80,
    fill: "#e2e8f0", image: { source: "event.logoDataUrl", fit: "contain" } }] }).ok).toBe(true);
});

it("refuse une forme sans fond", () => {
  const res = parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80 }] });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/fond/i);
});

it("refuse un fond image sans source ni asset, ou avec les deux", () => {
  expect(parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80, image: {} }] }).ok).toBe(false);
  expect(parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80,
    image: { source: "participant.photoDataUrl", asset: "assets/f.png" } }] }, ["assets/f.png"]).ok).toBe(false);
});

it("valide la source et l'asset d'un fond image", () => {
  expect(parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80,
    image: { source: "participant.firstName" } }] }).ok).toBe(false);          // type texte
  expect(parse({ blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 80, h: 80,
    image: { asset: "assets/absent.png" } }] }, []).ok).toBe(false);           // absent du paquet
});

it("refuse le type image, disparu du format", () => {
  expect(parse({ blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 80, h: 80,
    source: "participant.photoDataUrl" }] }).ok).toBe(false);
});
```

```ts
// renderer.test.tsx — remplacer les tests image par :
it("rend le fond image d'une forme, rogne par elle", () => {
  const t = build(
    manifest([{ type: "circle", page: 1, x: 0, y: 0, w: 80, h: 80, fill: "#e2e8f0",
      image: { asset: "assets/fond.png", fit: "contain" } }]),
  );
  const out = renderToJson(t.Component, CTX);
  expect(out.images).toContain("data:image/png;base64,assets/fond.png");
  expect(out.objectFits).toContain("contain");
  expect(out.fills).toContain("#e2e8f0");
});
```

- [x] **Step 2 : Vérifier l'échec** (vitest declarative).
- [x] **Step 3 : Implémentation moteur** — types ci-dessus (`fill` devient optionnel, `ImageBlock` supprimé de l'union) ; schéma : `fill: z.string().min(1).optional(), image: z.object({ source: z.string().optional(), asset: z.string().optional(), fit: z.enum(["cover", "contain", "fill"]).optional() }).optional()` sur les trois formes, membre `image` retiré de l'union ; dans `checkBlock`, pour les trois formes :

```ts
if (block.fill === undefined && block.image === undefined) {
  errors.push(`${label} : une forme exige un fond (fill et/ou image).`);
}
if (block.fill !== undefined) checkColor(block.fill, `${label} (remplissage)`, errors);
if (block.image) {
  const hasSource = block.image.source !== undefined;
  const hasAsset = block.image.asset !== undefined;
  if (hasSource === hasAsset) {
    errors.push(`${label} : un fond image porte soit source, soit asset, jamais les deux ni aucun.`);
  }
  if (hasSource) checkSource(block.image.source!, "image", label, errors);
  if (hasAsset && !entries.includes(block.image.asset!)) {
    errors.push(`${label} : ressource "${block.image.asset}" absente du paquet.`);
  }
}
```

  (`checkImageBlock` disparaît). Renderer : le cas des formes devient :

```tsx
if (block.type === "rect" || block.type === "square" || block.type === "circle") {
  const radius = block.type === "circle"
    ? { borderRadius: px(Math.min(block.w, block.h) / 2) } : radiusStyles(block);
  const src = block.image
    ? (block.image.asset !== undefined
        ? assets(block.image.asset)
        : String(resolveSource(ctx, block.image.source!)))
    : null;
  return (
    <View key={key}
      style={{ ...frame(block), ...borderStyles(block, ctx), ...radius,
               backgroundColor: block.fill ? colorOf(block.fill, ctx) : undefined,
               overflow: "hidden" }}>
      {src ? <Image src=${src}
        style={{ width: "100%", height: "100%", objectFit: block.image.fit ?? "cover" }} /> : null}
    </View>
  );
}
```

  Le cas `image` du renderer disparaît ; le QR garde son rendu `Image` direct.
- [x] **Step 4 : Migration des manifestes** — script jetable (scratchpad) transformant chaque bloc `{ type: "image", source?, asset?, objectFit?, ...reste }` en `{ type: "rect", image: { source?, asset?, fit: objectFit }, ...reste }` (omettre `fit` si `objectFit` absent) sur les seeds et les ateliers ; adapter les tests annexes listés (grep `type: "image"` et `type: \"image\"`), y compris les manifestes en dur des tests serveur/studio.
- [x] **Step 5 : Vérifier le vert** — `yarn vitest run src/lib/badge-templates studio scripts src/app/api/platform/badge-templates`. **Ne pas toucher à la base de données** (pas de purge ni de re-seed : opération manuelle de l'utilisateur, hors plan).
- [x] **Step 6 : Point de commit** — `feat(v4): fond couleur ou image sur les formes, retrait du type image`

### Task 4 : Type `group` — conteneur récursif

**Files:**
- Modify: `manifest-types.ts`, `schema.ts`, `renderer.tsx`
- Test: `schema.test.ts`, `renderer.test.tsx`

**Interfaces:**
- Produces :

```ts
// BlockBase.page devient OPTIONNEL dans le type ; la validation l'exige a la racine
// et le refuse sur les enfants d'un groupe.
export type GroupBlock = BlockBase & { type: "group"; blocks: Block[] }; // coordonnees enfants RELATIVES
export type Block = ... | GroupBlock;
```

Validation : `MAX_BLOCKS` (60) compte l'arbre aplati ; toutes les vérifications descendent récursivement, messages « bloc 3 › 2 : … ». Rendu : `View` conteneur (frame = position/taille/opacité/rotation), enfants filtrés par `visibleIf` et rendus récursivement ; le filtre de page ne s'applique qu'à la racine.

- [x] **Step 1 : Tests qui échouent** —

```ts
// schema.test.ts
const CHILD = { type: "text", x: 4, y: 4, w: 200, h: 40, text: "{participant.firstName}",
  style: { sizePx: 16, color: "#0f172a", overflow: "clip" } };

it("accepte un groupe imbrique sur deux niveaux", () => {
  const res = parse({
    blocks: [
      { type: "group", page: 1, x: 10, y: 10, w: 300, h: 100,
        blocks: [CHILD, { type: "group", x: 0, y: 50, w: 200, h: 50, blocks: [CHILD] }] },
    ],
  });
  expect(res.ok, errorsOf(res)).toBe(true);
});

it("refuse une page sur un enfant de groupe, avec un chemin localise", () => {
  const res = parse({
    blocks: [
      { type: "group", page: 1, x: 0, y: 0, w: 300, h: 100, blocks: [{ ...CHILD, page: 1 }] },
    ],
  });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/bloc 1 › 1 : page interdite/i);
});

it("refuse un bloc racine sans page", () => {
  const res = parse({ blocks: [{ ...CHILD }] });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/page manquante/i);
});

it("valide recursivement le contenu des groupes", () => {
  const res = parse({
    blocks: [
      { type: "group", page: 1, x: 0, y: 0, w: 300, h: 100,
        blocks: [{ ...CHILD, text: "{participant.secretField}" }] },
    ],
  });
  expect(res.ok).toBe(false);
  expect(errorsOf(res)).toMatch(/bloc 1 › 1 : source inconnue/i);
});

it("plafonne les blocs sur l'arbre aplati", () => {
  const children = Array.from({ length: 60 }, () => ({ ...CHILD }));
  const res = parse({
    blocks: [{ type: "group", page: 1, x: 0, y: 0, w: 300, h: 100, blocks: children }],
  });
  expect(res.ok).toBe(false); // 1 groupe + 60 enfants = 61
});
```

```ts
// renderer.test.tsx
it("rend recursivement les enfants d'un groupe", () => {
  const t = build(
    manifest([
      { type: "group", page: 1, x: 10, y: 10, w: 300, h: 100, opacity: 0.5,
        blocks: [
          { type: "text", x: 0, y: 0, w: 200, h: 40, text: "{participant.firstName}",
            style: { sizePx: 16, color: "#0f172a", overflow: "clip" } },
          { type: "group", x: 0, y: 50, w: 100, h: 50,
            blocks: [{ type: "qr", x: 0, y: 0, w: 40, h: 40 }] },
        ] },
    ]),
  );
  const out = renderToJson(t.Component, CTX);
  expect(out.texts).toEqual(["Awa"]);
  expect(out.images).toContain("data:image/png;base64,BBB"); // le QR imbrique
  expect(out.opacities).toContain(0.5);
});

it("masque tout un groupe via sa condition", () => {
  const t = build(
    manifest([
      { type: "group", page: 1, x: 0, y: 0, w: 100, h: 50,
        visibleIf: { path: "category.anonymous", equals: true },
        blocks: [{ type: "text", x: 0, y: 0, w: 80, h: 30, text: "{participant.firstName}",
          style: { sizePx: 16, color: "#0f172a", overflow: "clip" } }] },
    ]),
  );
  expect(renderToJson(t.Component, CTX).texts).toEqual([]); // CTX n'est pas anonyme
});
```

- [x] **Step 2 : Vérifier l'échec.**
- [x] **Step 3 : Implémentation** —
  - Types : `page?: number` dans `BlockBase` ; `GroupBlock` + union.
  - Schéma : `page` optionnelle dans `baseShape` (`z.number().int().positive().optional()`) ; membre d'union récursif :

```ts
const groupShape = { type: z.literal("group"), ...baseShape };
// z.lazy pour la recursion : un groupe contient des blocs, dont des groupes.
const blockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    textBlockSchema, imageBlockSchema, qrBlockSchema, rectBlockSchema,
    squareBlockSchema, circleBlockSchema,
    z.object({ ...groupShape, blocks: z.array(blockSchema).min(1) }),
  ]),
);
```

  (nommer les membres existants en constantes pour les réutiliser). Retirer `.max(MAX_BLOCKS)` du tableau racine (le plafond passe sur l'arbre aplati) — garder `.min(1)`.
  - Validation : remplacer la boucle racine par une descente récursive :

```ts
function countBlocks(blocks: Block[]): number {
  return blocks.reduce((n, b) => n + 1 + (b.type === "group" ? countBlocks(b.blocks) : 0), 0);
}

function walkBlocks(blocks: Block[], parentLabel: string | null, isRoot: boolean,
  manifest: ParsedManifest, entries: string[], errors: string[]): void {
  blocks.forEach((block, i) => {
    const label = parentLabel ? `${parentLabel} › ${i + 1}` : `bloc ${i + 1}`;
    if (isRoot && block.page === undefined) errors.push(`${label} : page manquante a la racine.`);
    if (!isRoot && block.page !== undefined) errors.push(`${label} : page interdite dans un groupe.`);
    checkBlock(block, label, manifest, entries, errors);
    if (block.type === "group") walkBlocks(block.blocks, label, false, manifest, entries, errors);
  });
}
```

  `checkBlock` prend désormais `label: string` au lieu de `index` ; sa vérification `block.page > page.count` ne s'applique que si `block.page !== undefined`. Dans `parseManifest` : `if (countBlocks(blocks) > MAX_BLOCKS) errors.push(\`manifeste : plus de ${MAX_BLOCKS} blocs (groupes et enfants compris).\`);` puis `walkBlocks(blocks, null, true, ...)`.
  - Renderer : cas `group` dans `renderBlock` (avant les autres) :

```tsx
if (block.type === "group") {
  return (
    <View key={key} style={{ ...frame(block) }}>
      {block.blocks
        .filter((child) => isBlockVisible(ctx, child.visibleIf))
        .map((child, i) => renderBlock(child, ctx, assets, fontMap, `${key}-${i}`))}
    </View>
  );
}
```

  Le filtre racine de `DeclarativeDocument` (`block.page === pageNumber`) reste inchangé — les enfants n'ont pas de page.
- [x] **Step 4 : Vérifier le vert** — vitest declarative, puis `yarn vitest run src/lib/badge-templates studio scripts` (les manifestes migrés en Task 3 restent valides).
- [x] **Step 5 : Point de commit** — `feat(v4): groupes de blocs imbriquables dans le manifeste`

### Task 5 : Documentation du format

**Files:**
- Modify: `docs/v4/features/templates-badges.md`, `scripts/new-badge-template.ts` (README généré), `badge-templates/*/README.md` (mêmes remplacements s'ils existent)

- [x] **Step 1 :** Doc feature — tableau des types : **retirer la ligne `image`** ; ajouter `square` (« un carré, w = h »), `circle` (« un cercle — rayon implicite min(w,h)/2, ellipse si w ≠ h »), `group` (« conteneur : enfants en coordonnées relatives, sans `page` ; `opacity`/`rotate`/`visibleIf` s'appliquent à l'ensemble ; imbrication libre ») ; documenter le **fond des formes** (`fill` couleur et/ou `image: { source | asset, fit }`, rognage par la forme) ; mentionner `name` (champ commun, affichage studio uniquement) et le plafond de 60 blocs compté à plat. Adapter l'exemple de manifeste (le bloc image d'exemple devient un `rect` à fond image).
- [x] **Step 2 :** Reporter dans le README du scaffold et les README d'atelier.
- [x] **Step 3 :** `make lint && make typecheck && make test` verts (fin de lot A).
- [x] **Step 4 : Point de commit** — `docs(v4): documente groupes, formes a fond et noms de blocs`

---

## Lot B — Interface trois colonnes

### Task 6 : `blocks-tree.js` — opérations d'arbre pures (TDD)

**Files:**
- Create: `studio/public/ui/blocks-tree.js` (module ES **sans aucun import** : importable par Vitest comme par le navigateur)
- Test: Create `studio/__tests__/blocks-tree.test.ts` (`import * as tree from "../public/ui/blocks-tree.js"`)

**Interfaces:**
- Produces (chemins = tableaux d'indices, `[2, 0]` = enfant 0 du bloc racine 2) :

```js
export function getAt(blocks, path)                 // -> bloc ou undefined
export function setAt(blocks, path, next)           // -> nouvel arbre (immutabilite)
export function removeAt(blocks, path)              // -> nouvel arbre
export function insertAfter(blocks, path, block)    // -> nouvel arbre
export function moveWithin(blocks, path, delta)     // echange avec le frere path[-1]+delta
export function flatten(blocks)                     // -> [{ path, block }] en profondeur
export function groupSiblings(blocks, parentPath, indices)
//   -> { ok: true, blocks } | { ok: false, reason }  (>= 2 indices, cadre englobant,
//      conversion des x/y en relatif, page retiree des enfants, groupe insere au
//      premier indice ; a la racine les blocs choisis doivent partager la meme page)
export function ungroupAt(blocks, path)
//   -> { ok: true, blocks } | { ok: false, reason }  (refuse si le groupe porte
//      rotate, opacity ou visibleIf ; sinon reconvertit en absolu et restitue page
//      quand le parent est la racine)
```

- [x] **Step 1 : Tests qui échouent** — `studio/__tests__/blocks-tree.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import * as tree from "../public/ui/blocks-tree.js";

const rect = (x, y, extra = {}) => ({ type: "rect", page: 1, x, y, w: 40, h: 20, fill: "#112233", ...extra });

describe("blocks-tree", () => {
  it("lit, remplace et supprime par chemin, sans muter l'original", () => {
    const blocks = [rect(0, 0), { type: "group", page: 1, x: 10, y: 10, w: 100, h: 50, blocks: [rect(5, 5)] }];
    expect(tree.getAt(blocks, [1, 0]).x).toBe(5);
    const replaced = tree.setAt(blocks, [1, 0], rect(9, 9));
    expect(tree.getAt(replaced, [1, 0]).x).toBe(9);
    expect(tree.getAt(blocks, [1, 0]).x).toBe(5);
    expect(tree.removeAt(blocks, [0])).toHaveLength(1);
  });

  it("groupe des freres racine : cadre englobant et coordonnees relatives exactes", () => {
    const blocks = [rect(10, 20), rect(60, 40), rect(200, 200)];
    const res = tree.groupSiblings(blocks, [], [0, 1]);
    expect(res.ok).toBe(true);
    const group = res.blocks[0];
    expect(group).toMatchObject({ type: "group", page: 1, x: 10, y: 20, w: 90, h: 40 });
    expect(group.blocks[0]).toMatchObject({ x: 0, y: 0 });
    expect(group.blocks[1]).toMatchObject({ x: 50, y: 20 });
    expect(group.blocks[0].page).toBeUndefined();
    expect(res.blocks).toHaveLength(2); // le groupe + le rect(200,200)
  });

  it("refuse de grouper des blocs racine de pages differentes", () => {
    const res = tree.groupSiblings([rect(0, 0), rect(0, 0, { page: 2 })], [], [0, 1]);
    expect(res.ok).toBe(false);
  });

  it("degrouper restitue l'etat initial au pixel", () => {
    const blocks = [rect(10, 20), rect(60, 40)];
    const grouped = tree.groupSiblings(blocks, [], [0, 1]).blocks;
    const back = tree.ungroupAt(grouped, [0]);
    expect(back.ok).toBe(true);
    expect(back.blocks).toEqual(blocks);
  });

  it("refuse de degrouper un groupe porteur d'effets", () => {
    const grouped = tree.groupSiblings([rect(0, 0), rect(10, 10)], [], [0, 1]).blocks;
    const withRotate = tree.setAt(grouped, [0], { ...grouped[0], rotate: 45 });
    expect(tree.ungroupAt(withRotate, [0]).ok).toBe(false);
  });

  it("aplati l'arbre avec les chemins", () => {
    const blocks = [rect(0, 0), { type: "group", page: 1, x: 0, y: 0, w: 10, h: 10, blocks: [rect(1, 1)] }];
    expect(tree.flatten(blocks).map((e) => e.path)).toEqual([[0], [1], [1, 0]]);
  });
});
```

- [x] **Step 2 : Vérifier l'échec** — `yarn vitest run studio/__tests__/blocks-tree.test.ts` (module absent).
- [x] **Step 3 : Implémentation** — récursion immuable simple (`structuredClone` interdit sur les branches non touchées : reconstruire uniquement le chemin) ; `groupSiblings` : cadre = `minX/minY` et `max(x + w)/max(y + h)` des blocs choisis ; enfants : `{ ...bloc, x: bloc.x - minX, y: bloc.y - minY }` avec `page` retirée (`delete`) ; le groupe hérite de `page` du premier bloc quand `parentPath` est vide. `ungroupAt` : rejette (`reason` en français) si `rotate`/`opacity`/`visibleIf` présents ; sinon `{ ...enfant, x: +group.x, y: +group.y, page: group.page }` (page seulement si le parent est la racine) ; réinsère les enfants à l'indice du groupe.
- [x] **Step 4 : Vérifier le vert.**
- [x] **Step 5 : Point de commit** — `feat(v4): operations d'arbre des blocs du studio (grouper, degrouper, chemins)`

### Task 7 : Layout trois colonnes, thème sombre, bascule JSON

**Files:**
- Rewrite: `studio/public/styles.css`
- Modify: `studio/public/app.js`, `studio/public/ui/preview.js`

**Interfaces:**
- Produces — état racine ajouté dans `app.js` : `selection` (chemin de bloc ou `null`), `rightView` (`"inspector"` | `"json"`). Structure rendue :

```
<header>  logo · select template · Nouveau · Enregistrer · Générer le paquet · [JSON] · statut
<main class="cols">
  <aside class="left">   <BlocksPanel/> (Task 8)  <ContextPanel/> (Task 10)
  <section class="canvas"> <Preview/> + bandeau d'erreurs
  <aside class="right">  rightView === "json" ? <textarea JSON> : selection ? <BlockInspector/> : <MetaPanel/>
```

- [x] **Step 1 : `styles.css`** — réécriture complète, thème sombre unique via variables :

```css
:root {
  color-scheme: dark;
  --bg: #1e1e1e; --panel: #2c2c2c; --panel-2: #383838;
  --border: #444; --text: #e4e4e4; --text-dim: #9a9a9a;
  --accent: #30d59b; --danger: #f87171; --warning: #eab308;
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px;
}
body { margin: 0; height: 100vh; display: flex; flex-direction: column;
       background: var(--bg); color: var(--text); }
main.cols { flex: 1; display: grid; grid-template-columns: 280px 1fr 300px; min-height: 0; }
.left, .right { background: var(--panel); overflow-y: auto; display: flex;
                flex-direction: column; min-height: 0; }
.left { border-right: 1px solid var(--border); }
.right { border-left: 1px solid var(--border); }
.canvas { display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 1.5rem; min-height: 0; }
.canvas object { flex: 1; width: 100%; max-width: 900px; border: none;
                 box-shadow: 0 8px 32px rgba(0,0,0,.5); border-radius: 4px; }
.panel-title { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
               color: var(--text-dim); padding: .6rem .75rem .3rem; }
```

  (+ styles boutons/inputs/selects sombres, `.errors-strip` en bandeau bas du canvas, `.tabs` supprimés).
- [x] **Step 2 : `app.js`** — retirer l'état `tab` et le rendu par onglets ; ajouter `selection`/`rightView` ; le header gagne un bouton `JSON` (classe `active` quand `rightView === "json"`) ; colonne droite :

```js
${rightView === "json"
  ? html`<textarea class="json" spellcheck="false" value=${manifestText}
      onInput=${(e) => setManifestText(e.target.value)}></textarea>`
  : selection && manifest
    ? html`<${BlockInspector} ... />`   /* branche en Task 9 ; d'ici la, BlockForm existant */
    : manifest
      ? html`<${MetaPanel} ... />`
      : html`<p class="placeholder">Corrigez le JSON.</p>`}
```

  La colonne gauche rend `BlocksEditor` existant (restylé en Task 8) et, dessous, `ContextForm` existant (repositionné en Task 10) — le studio reste fonctionnel à chaque task. `selection` est remis à `null` quand le template change ou quand le JSON devient invalide.
- [x] **Step 3 : `preview.js`** — le composant rend dans `.canvas` ; les erreurs ne s'affichent plus dans la colonne éditeur mais remontent à `app.js` qui les rend en `.errors-strip` sous l'aperçu (max ~3 lignes, défilement).
- [x] **Step 4 : Vérification** — `curl -s http://localhost:3786/ | grep app.js` (le shell sert), `curl` sur `/styles.css` (nouvelles variables présentes) ; noter la passe visuelle manuelle dans la Progression.
- [x] **Step 5 : Point de commit** — `feat(v4): studio en trois colonnes, theme sombre et bascule JSON`

### Task 8 : Panneau Blocs — arbre, renommage, grouper/dégrouper

**Files:**
- Rewrite: `studio/public/ui/blocks-editor.js` (devient le panneau gauche « Blocs »)
- Modify: `studio/public/app.js`, `studio/public/styles.css`

**Interfaces:**
- Produces : `BlocksPanel({ manifest, selection, checked, blockErrors, onSelect, onCheck, onChange })` —
  - `selection` : chemin sélectionné (inspecteur) ; `checked` : Set de chemins JSON.stringifiés pour la sélection multiple ;
  - libellés/icônes : `TYPE_LABELS = { text: "Texte", qr: "QR Code", rect: "Rectangle", square: "Carré", circle: "Cercle", group: "Groupe" }`, glyphes `{ text: "T", qr: "▩", rect: "▭", square: "◻", circle: "◯", group: "▣" }` — le type `image` n'existe plus (fond d'une forme) ;
  - `BLOCK_DEFAULTS` : retirer `image`, ajouter `square: { type: "square", page: 1, x: 20, y: 20, w: 80, h: 80, fill: "#e2e8f0" }` et `circle: { type: "circle", page: 1, x: 20, y: 20, w: 80, h: 80, fill: "#e2e8f0" }` ;
  - toutes les mutations passent par `blocks-tree.js` (`setAt`, `removeAt`, `insertAfter`, `moveWithin`, `groupSiblings`, `ungroupAt`).

- [x] **Step 1 : Arbre** — composant récursif : une entrée par bloc, indentée par profondeur (`padding-left: depth * 14px`), **sans numéro** : case à cocher (sélection multiple), glyphe du type, libellé = `block.name ?? TYPE_LABELS[block.type]`, coordonnées en `dim` ; un groupe a un chevron plier/déplier (état local Set de chemins repliés) ; clic sur l'entrée → `onSelect(path)` (surbrillance `.selected`) ; actions au survol (`.row-actions`, visibles par `:hover`) : ↑ ↓ (via `moveWithin`), ⧉ (via `insertAfter` d'un `structuredClone`), ✕ (via `removeAt`, désélectionne).
- [x] **Step 2 : Renommage** — bouton ✎ dans les actions → l'entrée passe en `<input>` inline (état local `renaming: path`) ; Entrée/blur valide (`setAt(path, { ...block, name: value || undefined })`), Échap annule ; champ vide = retour au libellé de type.
- [x] **Step 3 : Grouper / dégrouper** — barre du panneau : bouton **Grouper** actif quand ≥ 2 cases cochées **de même parent** (comparer les chemins moins le dernier segment) → `groupSiblings(blocks, parentPath, indices)` ; en cas de `ok: false`, la `reason` s'affiche dans le bandeau d'erreurs ; **Dégrouper** actif quand la sélection est un groupe → `ungroupAt` (même gestion de `reason`). Après groupement, sélectionner le groupe créé et vider `checked`.
- [x] **Step 4 : Ajout** — rangée de boutons `+ T  + ▭  + ◻  + ◯  + ▩` (title = libellé) ; si la sélection est un groupe, l'ajout se fait DANS le groupe (enfant sans `page`), sinon à la racine.
- [x] **Step 5 : Vérification** — parcours curl du HTML + noter la passe visuelle ; `yarn vitest run studio` (les tests d'arbre couvrent la logique).
- [x] **Step 6 : Point de commit** — `feat(v4): panneau de calques du studio (arbre, renommage, groupes)`

### Task 9 : Inspecteur — contrôles par nature, sections fonctionnelles, Paquet par défaut

**Files:**
- Rewrite: `studio/public/ui/block-form.js` (devient `BlockInspector`)
- Create: `studio/public/ui/controls.js` (contrôles réutilisables)
- Modify: `studio/public/ui/meta-panel.js` (restylage léger : sections `.panel-title`, zones de dépôt), `studio/public/app.js`, `studio/public/styles.css`

**Interfaces:**
- Produces — `controls.js` :

```js
export function NumField({ label, value, onValue, step, min, max })   // petit champ a libelle integre
export function XYWH({ block, onPatch })     // grille 2x2 : X Y / W H
export function Slider({ label, value, onValue, min, max, step, format }) // slider + valeur affichee
export function Segmented({ value, options, onValue })  // [{value, label|glyph, title}]
export function Toggles({ items })          // boutons-bascules independants (I, U, S)
export function ColorField({ label, value, colorSources, onValue }) // swatch + hexa + menu source
export function Dropzone({ label, accept, preview, onFile })        // zone de depot avec vignette
```

  `BlockInspector({ block, path, schemaInfo, pageCount, assets, fonts, onChange })` — **les paramètres sont regroupés par fonction**, une section titrée (`.panel-title`) par groupe, toujours dans le même ordre :
  1. **Identité** : nom, type (lecture seule), page (blocs racine uniquement) ;
  2. **Disposition** : grille `XYWH`, `Slider` rotation −180..180 ;
  3. **Apparence** : `Slider` opacité 0–100 % (stockée /100), et pour les formes : `ColorField` fond couleur + fond image (`Segmented` source/ressource, select correspondant, `Segmented` cadrage cover/contain/fill) ;
  4. **Coins** (masqué pour `circle`) et **Bordures** ;
  5. **Typographie** (texte uniquement) : taille/min, police, `Segmented` graisse, `Toggles` italique/souligné/barré, `ColorField` couleur, `Segmented` alignement (gauche/centre/droite/justifié), interlettrage, interligne, `Segmented` casse ;
  6. **Contenu** (texte uniquement) : gabarit, `Segmented` débordement, lignes max, fond du cadre + marge interne ;
  7. **Conditions** (`visibleIf`).

  Un groupe n'affiche que Identité, Disposition, Apparence (opacité seule) et Conditions. L'avertissement de hauteur de texte existant est conservé (affiché en tête de Typographie).

- [x] **Step 1 : `controls.js`** — implémenter les sept contrôles (composition des primitives existantes : `Slider` = `<input type="range">` + `<span>` valeur ; `Segmented` = rangée de boutons `.seg` avec `.active` ; `Dropzone` = `<label>` stylée contenant l'`<input type="file">` masqué et la vignette `<img>` quand `preview` est fourni).
- [x] **Step 2 : `BlockInspector`** — réécrire `block-form.js` en l'organisant par sections `.panel-title`, en remplaçant chaque champ par le contrôle adapté (mapping ci-dessus). L'opacité s'affiche 0–100 % mais reste stockée 0–1 (`onValue: (v) => patch({ opacity: v === 100 ? undefined : v / 100 })`). La rotation à 0 s'enregistre `undefined` (pas de bruit dans le manifeste).
- [x] **Step 3 : `app.js`** — brancher `BlockInspector` sur `selection` (bloc résolu par `getAt`) ; `MetaPanel` s'affiche sans sélection ; passer `page` seulement pour un bloc racine (chemin de longueur 1).
- [x] **Step 4 : `meta-panel.js`** — habiller aux classes du thème (sections, `Dropzone` pour les uploads avec vignette du fichier fraîchement déposé).
- [x] **Step 5 : Vérification** — curl + noter la passe visuelle ; `yarn vitest run studio`.
- [x] **Step 6 : Point de commit** — `feat(v4): inspecteur du studio avec controles par nature`

### Task 10 : Contexte en bas à gauche, erreurs canvas, doc, vérification finale

**Files:**
- Modify: `studio/public/ui/context-form.js` (sections repliables + presets en puces), `studio/public/app.js`, `studio/public/styles.css`
- Modify: `docs/v4/features/templates-badges.md` (section studio)
- Modify: `docs/v4/plans/2026-08-14-studio-v3-groupes-formes-interface.md` (Progression)

- [x] **Step 1 : `context-form.js`** — envelopper chaque section (Participant, Catégorie, Événement, Badge) dans un `<details>` stylé (`<summary>` en `.panel-title`, Participant ouvert par défaut) ; presets en rangée de puces cliquables en tête ; uploads photo/logo en `Dropzone` avec vignette. Le panneau vit sous le panneau Blocs dans la colonne gauche (séparateur `border-top`).
- [x] **Step 2 : Bandeau d'erreurs** — sous l'aperçu dans `.canvas` : `.errors-strip` (fond `--danger` translucide, max 3 lignes avec défilement) ; les erreurs localisées « bloc N › M » marquent aussi l'entrée correspondante de l'arbre (classe `.faulty` — adapter `groupErrorsByBlock` pour parser les chemins : `/^bloc ([\d ›]+)/` → tableau d'indices).
- [x] **Step 3 : Documentation** — dans `templates-badges.md`, réécrire la description du studio : trois colonnes (calques + contexte | canvas | inspecteur/Paquet/JSON), groupes (créer, imbriquer, renommer, dégrouper et sa restriction), formes carré/cercle, contrôles par nature, thème sombre.
- [x] **Step 4 : Vérification finale** — `make lint && make typecheck && make test` ; parcours curl complet (templates, render avec un manifeste contenant un groupe + carré + cercle nommés, pack) ; mettre à jour la table Progression en notant que **la passe visuelle navigateur (critères 2, 3, 4 de la spec) reste à faire à la main**.
- [x] **Step 5 : Point de commit** — `feat(v4): contexte repliable, erreurs sur canvas et doc du studio v3`
