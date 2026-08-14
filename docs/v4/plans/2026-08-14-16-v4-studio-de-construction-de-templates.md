# Studio de construction de templates de badge — Plan d'implémentation

> **Pour les agents** : SOUS-SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes utilisent la syntaxe `- [ ]` pour le suivi.

**Goal :** Éditer le manifeste d'un template dans un navigateur et voir le badge rendu se rafraîchir à mesure, sans empaqueter ni installer.

**Architecture :** Un service HTTP séparé, lancé en développement par `tsx studio/server.ts` dans un conteneur bâti sur `Dockerfile.dev`. Le serveur n'aiguille que les requêtes ; la logique vit dans trois modules sans dépendance à HTTP — `workshop.ts` (accès à l'atelier `badge-templates/`), `render.ts` (validation et rendu), `contexts.ts` (variantes de données). Le rendu réutilise `parseManifest()` et `renderProof()`, exactement le code qui valide et rend un paquet à l'installation.

**Tech Stack :** Node 22 (`node:http`, `node:fs/promises`), `tsx`, `@react-pdf/renderer` via `renderProof()`, `qrcode`, Vitest 4. Aucune dépendance nouvelle. Page en HTML/CSS/JS sans framework.

**Spec :** [`docs/v4/specs/2026-08-14-16-v4-studio-de-construction-de-templates.md`](../specs/2026-08-14-16-v4-studio-de-construction-de-templates.md)

## Global Constraints

- Version active : **v4**. Outil de **développement local uniquement** : jamais déployé, aucune authentification, aucune surface publique.
- Code, identifiants et types en **anglais** ; commentaires de code et interface en **français accentué** ; noms de fichiers en **ASCII**.
- `studio/**` est **hors du périmètre de couverture** (`vitest.config.ts` ne mesure que `src/lib/**` et `src/app/api/**`), mais les tests de `studio/__tests__/` **sont exécutés** par `make test` : seul `e2e/**` est exclu.
- Atelier : `badge-templates/` à la racine du dépôt, **gitignoré** (`.gitignore:65`). Ne pas le confondre avec `prisma/badge-templates/`, qui contient les paquets de référence versionnés.
- Motif de nom de template, identique à `scripts/new-badge-template.ts:4` : `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Ports : l'application occupe `3785`, le studio prend `3786` (exposé), `3900` à l'intérieur du conteneur.
- Avant de considérer une tâche finie : `make lint`, `make typecheck`, `make test`.
- **Commits** : aucun commit à l'initiative de l'agent en session interactive — les étapes de vérification remplacent les étapes de commit. Exception unique : une exécution pilotée par `scripts/run-plans.sh`, dont le prompt impose **un commit par tâche validée** ; dans ce cas, un commit par tâche, jamais de lot, jamais après un Verify en échec.

---

## Progression

| Task | Description | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Accès à l'atelier — `workshop.ts` | [ ] | | |
| 2 | Variantes de contexte — `contexts.ts` | [ ] | | |
| 3 | Validation et rendu — `render.ts` | [ ] | | |
| 4 | Serveur HTTP — `server.ts` | [ ] | | |
| 5 | Infrastructure — docker-compose, Caddy, Makefile | [ ] | | |
| 6 | Interface — page, édition, aperçu | [ ] | | |
| 7 | Documentation | [ ] | | |

Statuts : `[ ]` pending · `[~]` in_progress · `[x]` completed · `[-]` abandoned.

---

### Task 1 : Accès à l'atelier — `workshop.ts`

**Files:**
- Create: `studio/workshop.ts`
- Modify: `src/lib/badge-templates/package-reader.ts:21` (promouvoir `sniff` en export)
- Test: `studio/__tests__/workshop.test.ts`

**Interfaces:**
- Consomme : `sniff()` de `src/lib/badge-templates/package-reader.ts`, `PackageAsset` du même module.
- Produit :

```ts
export function isValidTemplateName(name: string): boolean;
export function listTemplates(root: string): Promise<Array<{ name: string; hasManifest: boolean }>>;
export function readTemplate(root: string, name: string): Promise<{ manifest: string; assets: PackageAsset[] } | null>;
export function writeManifest(root: string, name: string, manifest: string): Promise<boolean>;
```

`readTemplate` et `writeManifest` renvoient `null` / `false` quand le nom est invalide ou le dossier absent — l'appelant répond `404` sans jamais exposer de chemin.

Pourquoi promouvoir `sniff` plutôt que déduire le type de l'extension : le studio doit appliquer **la même règle** que l'installation. Un WebP renommé `.png` s'afficherait sinon au studio et serait refusé au téléversement.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `studio/__tests__/workshop.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isValidTemplateName,
  listTemplates,
  readTemplate,
  writeManifest,
} from "../workshop";

// Un PNG 1x1 valide : sert a verifier que le type est deduit des octets d'en-tete.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-workshop-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("isValidTemplateName", () => {
  it("accepte un slug", () => {
    expect(isValidTemplateName("salon-2027")).toBe(true);
    expect(isValidTemplateName("default")).toBe(true);
  });

  it("refuse tout ce qui n'est pas un slug", () => {
    for (const name of ["", "../escape", "Salon", "a--b", "-a", "a-", "a/b", "a b"]) {
      expect(isValidTemplateName(name)).toBe(false);
    }
  });
});

describe("listTemplates", () => {
  it("liste les dossiers de l'atelier et signale la presence du manifeste", async () => {
    await mkdir(join(root, "avec-manifeste"));
    await writeFile(join(root, "avec-manifeste", "manifest.json"), "{}");
    await mkdir(join(root, "sans-manifeste"));
    await writeFile(join(root, "fichier-isole.txt"), "x");

    expect(await listTemplates(root)).toEqual([
      { name: "avec-manifeste", hasManifest: true },
      { name: "sans-manifeste", hasManifest: false },
    ]);
  });

  it("renvoie une liste vide quand l'atelier n'existe pas", async () => {
    expect(await listTemplates(join(root, "absent"))).toEqual([]);
  });
});

describe("readTemplate", () => {
  it("rend le manifeste en texte brut et les ressources typees par leurs octets", async () => {
    await mkdir(join(root, "salon", "assets"), { recursive: true });
    await writeFile(join(root, "salon", "manifest.json"), '{\n  "family": "salon"\n}');
    // Extension mensongere : le type doit venir des octets, donc image/png.
    await writeFile(join(root, "salon", "assets", "fond.jpg"), PNG_1PX);

    const read = await readTemplate(root, "salon");

    expect(read?.manifest).toBe('{\n  "family": "salon"\n}');
    expect(read?.assets).toEqual([
      { path: "assets/fond.jpg", body: expect.any(Buffer), contentType: "image/png" },
    ]);
  });

  it("ignore une ressource dont le type est indetectable", async () => {
    await mkdir(join(root, "salon", "assets"), { recursive: true });
    await writeFile(join(root, "salon", "manifest.json"), "{}");
    await writeFile(join(root, "salon", "assets", "note.txt"), "pas une image");

    const read = await readTemplate(root, "salon");

    expect(read?.assets).toEqual([]);
  });

  it("renvoie null pour un nom invalide ou un dossier absent", async () => {
    expect(await readTemplate(root, "../escape")).toBeNull();
    expect(await readTemplate(root, "inconnu")).toBeNull();
  });
});

describe("writeManifest", () => {
  it("ecrit le manifeste tel quel", async () => {
    await mkdir(join(root, "salon"));
    await writeFile(join(root, "salon", "manifest.json"), "{}");

    expect(await writeManifest(root, "salon", '{\n  "a": 1\n}')).toBe(true);
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe('{\n  "a": 1\n}');
  });

  it("refuse un nom invalide ou un dossier absent", async () => {
    expect(await writeManifest(root, "../escape", "{}")).toBe(false);
    expect(await writeManifest(root, "inconnu", "{}")).toBe(false);
  });
});
```

- [ ] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/workshop.test.ts
```

Attendu : ÉCHEC à la résolution — `Cannot find module '../workshop'`.

- [ ] **Étape 3 : Exporter `sniff`**

Dans `src/lib/badge-templates/package-reader.ts`, ligne 21, ajouter le mot-clé `export` et compléter le commentaire existant :

```ts
// Le type est deduit des octets d'en-tete, jamais de l'extension : une image WebP
// renommee en .png doit etre refusee, car @react-pdf ne sait pas la lire.
// Exporte depuis la spec 16 : le studio applique la meme regle que l'installation.
export function sniff(body: Buffer): "image/png" | "image/jpeg" | "font/ttf" | null {
```

- [ ] **Étape 4 : Écrire `workshop.ts`**

Créer `studio/workshop.ts` :

```ts
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { sniff, type PackageAsset } from "../src/lib/badge-templates/package-reader";

// Meme motif que scripts/new-badge-template.ts : un nom valide ne peut contenir
// ni separateur, ni point, ce qui exclut par construction toute remontee de chemin.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ASSET_DIRS = ["assets", "fonts"] as const;

export function isValidTemplateName(name: string): boolean {
  return SLUG.test(name);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function listTemplates(
  root: string,
): Promise<Array<{ name: string; hasManifest: boolean }>> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Array<{ name: string; hasManifest: boolean }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    out.push({
      name: entry.name,
      hasManifest: await fileExists(join(root, entry.name, "manifest.json")),
    });
  }
  return out;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function collectAssets(dir: string): Promise<PackageAsset[]> {
  const out: PackageAsset[] = [];
  for (const sub of ASSET_DIRS) {
    let entries;
    try {
      entries = await readdir(join(dir, sub), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const body = await readFile(join(dir, sub, entry.name));
      const contentType = sniff(body);
      // Une ressource au type indetectable serait refusee a l'installation :
      // l'ignorer ici fait echouer la validation au meme endroit qu'en vrai.
      if (!contentType) continue;
      out.push({ path: `${sub}/${entry.name}`, body, contentType });
    }
  }
  return out;
}

export async function readTemplate(
  root: string,
  name: string,
): Promise<{ manifest: string; assets: PackageAsset[] } | null> {
  if (!isValidTemplateName(name)) return null;
  const dir = join(root, name);
  if (!(await isDirectory(dir))) return null;
  let manifest = "";
  try {
    manifest = await readFile(join(dir, "manifest.json"), "utf8");
  } catch {
    manifest = "";
  }
  return { manifest, assets: await collectAssets(dir) };
}

export async function writeManifest(
  root: string,
  name: string,
  manifest: string,
): Promise<boolean> {
  if (!isValidTemplateName(name)) return false;
  const dir = join(root, name);
  if (!(await isDirectory(dir))) return false;
  await writeFile(join(dir, "manifest.json"), manifest, "utf8");
  return true;
}
```

- [ ] **Étape 5 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/workshop.test.ts
```

Attendu : SUCCÈS sur les neuf tests.

- [ ] **Étape 6 : Vérifier que l'export de `sniff` n'a rien cassé**

```bash
make lint && make typecheck && docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/badge-templates
```

Attendu : tout au vert — `sniff` gagne un mot-clé, son comportement est inchangé.

---

### Task 2 : Variantes de contexte — `contexts.ts`

**Files:**
- Create: `studio/contexts.ts`
- Test: `studio/__tests__/contexts.test.ts`

**Interfaces:**
- Consomme : `TemplateContext` de `src/lib/badge-templates/types.ts`, `SAMPLE_CONTEXT` de `src/lib/badge-templates/declarative/sample-context.ts`, `generateQRCodeDataURL` de `src/lib/qrcode.ts`.
- Produit :

```ts
export type PreviewVariant = { id: string; label: string };
export function listVariants(): PreviewVariant[];
export function buildVariantContext(id: string): Promise<TemplateContext | null>;
```

`buildVariantContext` est asynchrone parce que le QR est réellement produit. Elle renvoie `null` pour un identifiant inconnu, ce qui donne un `422` côté serveur.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `studio/__tests__/contexts.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { listVariants, buildVariantContext } from "../contexts";

describe("listVariants", () => {
  it("expose les cinq cas de la spec, dans l'ordre", () => {
    expect(listVariants().map((v) => v.id)).toEqual([
      "complet",
      "sans-photo",
      "anonyme",
      "neutre",
      "textes-longs",
    ]);
    expect(listVariants().every((v) => v.label.length > 0)).toBe(true);
  });
});

describe("buildVariantContext", () => {
  it("produit un QR reel dans toutes les variantes", async () => {
    for (const variant of listVariants()) {
      const ctx = await buildVariantContext(variant.id);
      expect(ctx?.badge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it("donne une photo au cas complet et aucune au cas sans photo", async () => {
    const complet = await buildVariantContext("complet");
    const sansPhoto = await buildVariantContext("sans-photo");
    expect(complet?.participant.photoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(sansPhoto?.participant.photoDataUrl).toBe("");
  });

  it("positionne les drapeaux de categorie attendus", async () => {
    const anonyme = await buildVariantContext("anonyme");
    const neutre = await buildVariantContext("neutre");
    expect(anonyme?.category.anonymous).toBe(true);
    expect(neutre?.category.neutralBadge).toBe(true);
    expect(neutre?.category.anonymous).toBe(false);
  });

  it("produit des textes debordants dans la variante dediee", async () => {
    const ctx = await buildVariantContext("textes-longs");
    expect(ctx!.participant.lastName.length).toBeGreaterThan(30);
    expect(ctx!.event.title.length).toBeGreaterThan(60);
  });

  it("renvoie null pour un identifiant inconnu", async () => {
    expect(await buildVariantContext("inexistant")).toBeNull();
  });
});
```

- [ ] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/contexts.test.ts
```

Attendu : ÉCHEC à la résolution — `Cannot find module '../contexts'`.

- [ ] **Étape 3 : Écrire `contexts.ts`**

Créer `studio/contexts.ts` :

```ts
import { generateQRCodeDataURL } from "../src/lib/qrcode";
import { SAMPLE_CONTEXT } from "../src/lib/badge-templates/declarative/sample-context";
import type { TemplateContext } from "../src/lib/badge-templates/types";

export type PreviewVariant = { id: string; label: string };

// Portrait uni de demonstration (PNG 2x3, gris ardoise). Constante en dur : aucun
// binaire n'entre au depot, et deux rendus successifs sont identiques.
const DEMO_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAAN71ZuAAAAFElEQVR4nGNkYGD4z0AEYCJG0WBWCAAaGAIBHUAIiwAAAABJRU5ErkJggg==";

const VARIANTS: Array<PreviewVariant & { apply: (ctx: TemplateContext) => TemplateContext }> = [
  {
    id: "complet",
    label: "Participant complet",
    apply: (ctx) => ({ ...ctx, participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO } }),
  },
  {
    id: "sans-photo",
    label: "Sans photo",
    apply: (ctx) => ({ ...ctx, participant: { ...ctx.participant, photoDataUrl: "" } }),
  },
  {
    id: "anonyme",
    label: "Catégorie anonyme",
    apply: (ctx) => ({
      ...ctx,
      participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO },
      category: { ...ctx.category, anonymous: true },
    }),
  },
  {
    id: "neutre",
    label: "Badge neutre",
    apply: (ctx) => ({
      ...ctx,
      participant: { ...ctx.participant, photoDataUrl: DEMO_PHOTO },
      category: { ...ctx.category, neutralBadge: true, anonymous: false },
    }),
  },
  {
    id: "textes-longs",
    label: "Textes très longs",
    apply: (ctx) => ({
      ...ctx,
      participant: {
        ...ctx.participant,
        firstName: "Marie-Christine Élisabeth",
        lastName: "Ouédraogo-Zoungrana Kaboré",
        structure:
          "Direction générale de la coopération internationale et des partenariats institutionnels",
        photoDataUrl: DEMO_PHOTO,
      },
      event: {
        ...ctx.event,
        title:
          "Forum international sur la transformation numérique des administrations publiques",
      },
      category: { ...ctx.category, name: "Délégation officielle accompagnante" },
    }),
  },
];

export function listVariants(): PreviewVariant[] {
  return VARIANTS.map(({ id, label }) => ({ id, label }));
}

export async function buildVariantContext(id: string): Promise<TemplateContext | null> {
  const variant = VARIANTS.find((v) => v.id === id);
  if (!variant) return null;
  // Le QR est produit pour de vrai : SAMPLE_CONTEXT le laisse vide, ce qui masque
  // le cadrage du bloc et sa lisibilite a la taille choisie.
  const qrCodeDataUrl = await generateQRCodeDataURL(SAMPLE_CONTEXT.badge.verifyUrl);
  return variant.apply({
    ...SAMPLE_CONTEXT,
    badge: { ...SAMPLE_CONTEXT.badge, qrCodeDataUrl },
  });
}
```

- [ ] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/contexts.test.ts
```

Attendu : SUCCÈS. Si `DEMO_PHOTO` est refusée par `@react-pdf` à la Task 3, la remplacer par un PNG de mêmes caractéristiques (encodage base64 d'un PNG 2×3 opaque) — jamais par un JPEG, `@react-pdf` étant plus strict sur ce format.

- [ ] **Étape 5 : Vérifier lint et types**

```bash
make lint && make typecheck
```

---

### Task 3 : Validation et rendu — `render.ts`

**Files:**
- Create: `studio/render.tsx` (extension `.tsx` : le fichier contient du JSX ; les appelants importent `./render`)
- Test: `studio/__tests__/render.test.ts`

**Interfaces:**
- Consomme : `parseManifest()` de `src/lib/badge-templates/declarative`, `renderProof()` de `src/lib/badge-templates/render-proof`, `buildVariantContext()` (Task 2), `PackageAsset` (Task 1).
- Produit :

```ts
export type RenderResult =
  | { ok: true; pdf: Buffer }
  | { ok: false; errors: string[] };

export function renderManifest(args: {
  manifest: string;
  assets: PackageAsset[];
  variantId: string;
}): Promise<RenderResult>;
```

`renderProof()` rend avec `SAMPLE_CONTEXT` ; le studio a besoin d'un contexte choisi. La fonction reconstruit donc le même enchaînement — `buildDeclarativeTemplate()` puis `renderToBuffer()` — avec le contexte de la variante, en réutilisant `assetsToResolver()` exporté par `render-proof.tsx`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `studio/__tests__/render.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { renderManifest } from "../render";

const MINIMAL = JSON.stringify({
  formatVersion: 1,
  family: "test-mini",
  label: "Test minimal",
  description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 2,
      y: 2,
      w: 40,
      h: 6,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePt: 10, color: "#0f172a", overflow: "clip" },
    },
  ],
});

describe("renderManifest", () => {
  it("rend un PDF pour un manifeste valide", async () => {
    const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId: "complet" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.pdf.length).toBeGreaterThan(500);
  });

  it("rend chaque variante", async () => {
    for (const variantId of ["complet", "sans-photo", "anonyme", "neutre", "textes-longs"]) {
      const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId });
      expect(res.ok).toBe(true);
    }
  });

  it("signale un JSON illisible sans lever", async () => {
    const res = await renderManifest({ manifest: "{ pas du json", assets: [], variantId: "complet" });

    expect(res).toEqual({ ok: false, errors: ["Manifeste invalide : JSON illisible."] });
  });

  it("remonte les erreurs de validation du manifeste", async () => {
    const horsPage = JSON.parse(MINIMAL);
    horsPage.blocks[0].x = 200;
    const res = await renderManifest({
      manifest: JSON.stringify(horsPage),
      assets: [],
      variantId: "complet",
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.join(" ")).toContain("hors de la page");
  });

  it("signale une variante inconnue", async () => {
    const res = await renderManifest({ manifest: MINIMAL, assets: [], variantId: "inexistant" });

    expect(res).toEqual({ ok: false, errors: ['Variante inconnue : "inexistant".'] });
  });
});
```

- [ ] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/render.test.ts
```

Attendu : ÉCHEC à la résolution — `Cannot find module '../render'`.

- [ ] **Étape 3 : Écrire `render.tsx`**

Créer `studio/render.tsx` :

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { buildDeclarativeTemplate, parseManifest } from "../src/lib/badge-templates/declarative";
import { assetsToResolver } from "../src/lib/badge-templates/render-proof";
import type { PackageAsset } from "../src/lib/badge-templates/package-reader";
import { buildVariantContext } from "./contexts";

export type RenderResult = { ok: true; pdf: Buffer } | { ok: false; errors: string[] };

// Identifiant de template arbitraire : il ne sert qu'a prefixer les familles de
// polices enregistrees aupres de @react-pdf, et n'a pas a etre stable ici.
const STUDIO_TEMPLATE_ID = "studio-preview";

export async function renderManifest(args: {
  manifest: string;
  assets: PackageAsset[];
  variantId: string;
}): Promise<RenderResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(args.manifest);
  } catch {
    return { ok: false, errors: ["Manifeste invalide : JSON illisible."] };
  }

  const parsed = parseManifest(
    raw,
    args.assets.map((a) => a.path),
  );
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const ctx = await buildVariantContext(args.variantId);
  if (!ctx) return { ok: false, errors: [`Variante inconnue : "${args.variantId}".`] };

  const { Component } = buildDeclarativeTemplate(
    parsed.manifest,
    assetsToResolver(args.assets),
    STUDIO_TEMPLATE_ID,
  );
  const pdf = await renderToBuffer(<Component ctx={ctx} />);
  return { ok: true, pdf };
}
```

Le fichier porte l'extension `.tsx` parce qu'il contient du JSX ; l'import reste `./render`.

- [ ] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/render.test.ts
```

Attendu : SUCCÈS sur les cinq tests. Le premier rendu prend quelques secondes — `@react-pdf` charge Montserrat depuis Google Fonts au premier appel.

- [ ] **Étape 5 : Vérifier lint et types**

```bash
make lint && make typecheck
```

---

### Task 4 : Serveur HTTP — `server.ts`

**Files:**
- Create: `studio/server.ts`
- Test: `studio/__tests__/server.test.ts`

**Interfaces:**
- Consomme : `listTemplates`, `readTemplate`, `writeManifest`, `isValidTemplateName` (Task 1) ; `listVariants` (Task 2) ; `renderManifest` (Task 3).
- Produit :

```ts
export function createStudioServer(root: string): import("node:http").Server;
```

Le serveur est créé par une fonction prenant la racine de l'atelier en paramètre : les tests le lancent sur un dossier temporaire et un port éphémère, sans toucher au dépôt.

Routes, telles que fixées par la spec :

| Méthode | Chemin | Réponse |
|---|---|---|
| `GET` | `/`, `/app.js`, `/styles.css` | fichiers de `studio/public` |
| `GET` | `/api/variants` | `{ variants: [{ id, label }] }` |
| `GET` | `/api/templates` | `{ templates: [{ name, hasManifest }] }` |
| `GET` | `/api/templates/:name` | `{ manifest, assets: string[] }` ou `404` |
| `PUT` | `/api/templates/:name` | `{ ok: true }` ou `404` |
| `POST` | `/api/render` | PDF, ou `422` `{ errors }` |

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `studio/__tests__/server.test.ts` :

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createStudioServer } from "../server";

const MINIMAL = JSON.stringify({
  formatVersion: 1,
  family: "test-mini",
  label: "Test minimal",
  description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 2,
      y: 2,
      w: 40,
      h: 6,
      text: "{participant.firstName}",
      style: { sizePt: 10, color: "#0f172a", overflow: "clip" },
    },
  ],
});

let root: string;
let server: Server;
let base: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-server-"));
  await mkdir(join(root, "salon"));
  await writeFile(join(root, "salon", "manifest.json"), MINIMAL);
  server = createStudioServer(root);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
});

describe("GET /api/templates", () => {
  it("liste l'atelier", async () => {
    const res = await fetch(`${base}/api/templates`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ templates: [{ name: "salon", hasManifest: true }] });
  });
});

describe("GET /api/variants", () => {
  it("expose les variantes", async () => {
    const res = await fetch(`${base}/api/variants`);
    const body = await res.json();
    expect(body.variants[0]).toEqual({ id: "complet", label: "Participant complet" });
  });
});

describe("GET /api/templates/:name", () => {
  it("rend le manifeste et les ressources", async () => {
    const res = await fetch(`${base}/api/templates/salon`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ manifest: MINIMAL, assets: [] });
  });

  it("repond 404 pour un nom invalide ou inconnu", async () => {
    expect((await fetch(`${base}/api/templates/inconnu`)).status).toBe(404);
    expect((await fetch(`${base}/api/templates/Salon`)).status).toBe(404);
  });
});

describe("PUT /api/templates/:name", () => {
  it("ecrit le manifeste sur le disque", async () => {
    const res = await fetch(`${base}/api/templates/salon`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: '{"a":1}' }),
    });

    expect(res.status).toBe(200);
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe('{"a":1}');
  });

  it("repond 404 pour un dossier absent", async () => {
    const res = await fetch(`${base}/api/templates/inconnu`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: "{}" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/render", () => {
  it("rend le texte recu, pas le fichier", async () => {
    const modifie = JSON.parse(MINIMAL);
    modifie.label = "Jamais enregistre";
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "salon", manifest: JSON.stringify(modifie), variant: "complet" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Le fichier sur disque n'a pas bouge.
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe(MINIMAL);
  });

  it("repond 422 avec les erreurs pour un manifeste invalide", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "salon", manifest: "{ pas du json", variant: "complet" }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ errors: ["Manifeste invalide : JSON illisible."] });
  });

  it("repond 404 pour un template inconnu", async () => {
    const res = await fetch(`${base}/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "inconnu", manifest: MINIMAL, variant: "complet" }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Étape 2 : Lancer les tests et vérifier qu'ils échouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/server.test.ts
```

Attendu : ÉCHEC à la résolution — `Cannot find module '../server'`.

- [ ] **Étape 3 : Écrire `server.ts`**

Créer `studio/server.ts` :

```ts
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { listTemplates, readTemplate, writeManifest } from "./workshop";
import { listVariants } from "./contexts";
import { renderManifest } from "./render";

// Resolu depuis la racine du depot plutot que depuis le fichier : `package.json` ne
// declare pas `"type": "module"`, donc `import.meta.dirname` n'est pas disponible sous
// tsx, et `__dirname` n'existe pas quand Vitest charge le module en ESM. Le studio est
// toujours lance depuis la racine, par `make studio` comme par les tests.
const PUBLIC_DIR = resolve(process.cwd(), "studio", "public");

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function handle(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://studio");
  const path = url.pathname;

  const asset = req.method === "GET" ? STATIC_FILES[path] : undefined;
  if (asset) {
    const body = await readFile(join(PUBLIC_DIR, asset.file));
    res.writeHead(200, { "content-type": asset.type });
    res.end(body);
    return;
  }

  if (req.method === "GET" && path === "/api/variants") {
    sendJson(res, 200, { variants: listVariants() });
    return;
  }

  if (req.method === "GET" && path === "/api/templates") {
    sendJson(res, 200, { templates: await listTemplates(root) });
    return;
  }

  const templateMatch = /^\/api\/templates\/([^/]+)$/.exec(path);
  if (templateMatch) {
    const name = decodeURIComponent(templateMatch[1]);
    if (req.method === "GET") {
      const read = await readTemplate(root, name);
      if (!read) {
        sendJson(res, 404, { error: "TEMPLATE_NOT_FOUND" });
        return;
      }
      sendJson(res, 200, { manifest: read.manifest, assets: read.assets.map((a) => a.path) });
      return;
    }
    if (req.method === "PUT") {
      const body = (await readBody(req)) as { manifest?: unknown } | null;
      if (typeof body?.manifest !== "string") {
        sendJson(res, 400, { error: "INVALID_BODY" });
        return;
      }
      const written = await writeManifest(root, name, body.manifest);
      sendJson(res, written ? 200 : 404, written ? { ok: true } : { error: "TEMPLATE_NOT_FOUND" });
      return;
    }
  }

  if (req.method === "POST" && path === "/api/render") {
    const body = (await readBody(req)) as
      | { name?: unknown; manifest?: unknown; variant?: unknown }
      | null;
    if (
      typeof body?.name !== "string" ||
      typeof body.manifest !== "string" ||
      typeof body.variant !== "string"
    ) {
      sendJson(res, 400, { error: "INVALID_BODY" });
      return;
    }
    const read = await readTemplate(root, body.name);
    if (!read) {
      sendJson(res, 404, { error: "TEMPLATE_NOT_FOUND" });
      return;
    }
    // Le manifeste rendu est celui de l'editeur : on veut voir l'effet d'une
    // modification avant de l'enregistrer. Seules les ressources viennent du disque.
    const result = await renderManifest({
      manifest: body.manifest,
      assets: read.assets,
      variantId: body.variant,
    });
    if (!result.ok) {
      sendJson(res, 422, { errors: result.errors });
      return;
    }
    res.writeHead(200, { "content-type": "application/pdf", "cache-control": "no-store" });
    res.end(result.pdf);
    return;
  }

  sendJson(res, 404, { error: "NOT_FOUND" });
}

export function createStudioServer(root: string): Server {
  return createServer((req, res) => {
    handle(root, req, res).catch((err) => {
      console.error("[studio]", err);
      if (!res.headersSent) sendJson(res, 500, { error: "INTERNAL" });
      else res.end();
    });
  });
}

// Point d'entree : `yarn tsx studio/server.ts`. L'atelier est celui de
// make new-badge-template, a la racine du depot.
if (process.env.VITEST === undefined) {
  const port = Number(process.env.STUDIO_PORT ?? 3900);
  const root = resolve(process.cwd(), "badge-templates");
  createStudioServer(root).listen(port, () => {
    console.log(`Studio de templates : http://localhost:${port} (atelier ${root})`);
  });
}
```

La garde `process.env.VITEST` évite qu'importer le module dans un test ouvre un port : Vitest positionne cette variable.

- [ ] **Étape 4 : Lancer les tests et vérifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run studio/__tests__/server.test.ts
```

Attendu : SUCCÈS sur les neuf tests. Ce fichier n'exerce que les routes d'API ; les fichiers statiques n'existent qu'à partir de la Task 6 et ne sont pas testés ici.

- [ ] **Étape 5 : Vérifier lint et types**

```bash
make lint && make typecheck
```

---

### Task 5 : Infrastructure — docker-compose, Caddy, Makefile

**Files:**
- Modify: `docker-compose.dev.yml` (nouveau service, après `app`)
- Modify: `Caddyfile.dev`
- Modify: `Makefile:1-14` (`.PHONY`) et section des cibles de développement

**Interfaces:**
- Consomme : `studio/server.ts` (Task 4).
- Produit : la commande `make studio` et les accès `http://localhost:3786` / `https://studio.badge.local`.

- [ ] **Étape 1 : Déclarer le service**

Dans `docker-compose.dev.yml`, après le service `app` :

```yaml
  # v4 (spec 16) : studio de construction de templates. Outil de developpement
  # uniquement, jamais deploye. Meme image que `app`, meme depot monte.
  studio:
    build:
      context: .
      dockerfile: Dockerfile.dev
    restart: unless-stopped
    command: yarn tsx studio/server.ts
    ports:
      - "3786:3900"
    volumes:
      - .:/app
      - /app/node_modules
    env_file:
      - docker/compose.dev.env
      - path: .env
        required: false
```

Aucune dépendance à `mysql` ou `minio` : le studio ne touche ni la base ni le stockage.

- [ ] **Étape 2 : Publier via Caddy**

Ajouter à la fin de `Caddyfile.dev` :

```
studio.badge.local {
	tls internal
	reverse_proxy studio:3900
}
```

- [ ] **Étape 3 : Ajouter la cible make**

Dans `Makefile`, ajouter `studio` à la liste `.PHONY` (ligne 11, à côté de `new-badge-template pack-badge-template`), puis la cible près des cibles de développement :

```makefile
# v4 (spec 16) : studio de construction de templates (outil de dev, non deploye).
# Edite badge-templates/<NAME>/manifest.json avec apercu instantane.
studio:
	docker compose -f docker-compose.dev.yml up -d studio
	@echo "Studio : http://localhost:3786 (ou https://studio.badge.local apres make dev-https)"
```

- [ ] **Étape 4 : Enregistrer le domaine local**

Rien à modifier dans le `Makefile` : `DEV_DOMAINS` (ligne 155) est **dérivé du `Caddyfile.dev`** par `grep -oE '^[A-Za-z0-9.-]+\.local'`. L'ajout de l'étape 2 suffit ; il reste à propager l'entrée dans `/etc/hosts` :

```bash
make dev-https-hosts
```

Attendu : la commande signale l'ajout de `studio.badge.local` (mot de passe administrateur demandé), ou indique que le fichier est déjà à jour.

- [ ] **Étape 5 : Démarrer et vérifier**

```bash
make studio
docker compose -f docker-compose.dev.yml logs studio --tail=20
curl -s http://localhost:3786/api/templates
```

Attendu : le journal affiche « Studio de templates : http://localhost:3900 (atelier /app/badge-templates) », et l'appel renvoie `{"templates":[...]}` — liste vide si l'atelier n'existe pas encore.

- [ ] **Étape 6 : Créer un template d'essai**

```bash
make new-badge-template NAME=essai-studio
curl -s http://localhost:3786/api/templates
```

Attendu : `essai-studio` apparaît avec `hasManifest: true`.

---

### Task 6 : Interface — page, édition, aperçu

**Files:**
- Create: `studio/public/index.html`, `studio/public/styles.css`, `studio/public/app.js`

**Interfaces:**
- Consomme : les routes de la Task 4.
- Produit : rien dont dépend une autre tâche.

Pas de test automatisé ici : outil de développement local, non déployé, et la politique de tests ne couvre pas les interfaces en unitaire. La vérification est visuelle, à l'étape 4.

- [ ] **Étape 1 : Écrire la page**

Créer `studio/public/index.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio de templates</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header>
      <h1>Studio de templates</h1>
      <select id="template" aria-label="Template"></select>
      <button id="save" type="button">Enregistrer</button>
      <span id="status" role="status"></span>
    </header>
    <main>
      <section class="editor">
        <textarea id="manifest" spellcheck="false" aria-label="Manifeste"></textarea>
        <ul id="errors" class="errors" hidden></ul>
      </section>
      <section class="preview">
        <select id="variant" aria-label="Jeu de données"></select>
        <object id="pdf" type="application/pdf" data=""></object>
      </section>
    </main>
    <script src="/app.js" type="module"></script>
  </body>
</html>
```

- [ ] **Étape 2 : Écrire la feuille de style**

Créer `studio/public/styles.css` :

```css
:root {
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

body {
  margin: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.35);
}

header h1 {
  font-size: 1rem;
  margin: 0;
  margin-right: auto;
}

main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
}

.editor,
.preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.75rem;
  gap: 0.5rem;
}

.editor {
  border-right: 1px solid rgba(128, 128, 128, 0.35);
}

textarea {
  flex: 1;
  resize: none;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.5;
  tab-size: 2;
}

.errors {
  margin: 0;
  padding: 0.5rem 0.75rem 0.5rem 1.5rem;
  max-height: 30%;
  overflow: auto;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 4px;
  font-size: 13px;
}

object {
  flex: 1;
  width: 100%;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 4px;
}

#status {
  font-size: 13px;
  opacity: 0.75;
}
```

- [ ] **Étape 3 : Écrire la logique client**

Créer `studio/public/app.js` :

```js
const $ = (id) => document.getElementById(id);
const els = {
  template: $("template"),
  variant: $("variant"),
  manifest: $("manifest"),
  errors: $("errors"),
  pdf: $("pdf"),
  save: $("save"),
  status: $("status"),
};

let lastObjectUrl = null;
let timer = null;

function setStatus(text) {
  els.status.textContent = text;
}

function showErrors(errors) {
  els.errors.innerHTML = "";
  for (const error of errors) {
    const li = document.createElement("li");
    li.textContent = error;
    els.errors.append(li);
  }
  els.errors.hidden = errors.length === 0;
}

// Un manifeste invalide n'efface pas l'apercu : sans cette regle, le rendu
// disparaitrait des la premiere accolade ouverte pendant la frappe.
async function render() {
  const name = els.template.value;
  if (!name) return;
  setStatus("Rendu…");
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, manifest: els.manifest.value, variant: els.variant.value }),
  });
  if (res.status === 422) {
    showErrors((await res.json()).errors);
    setStatus("Manifeste invalide");
    return;
  }
  if (!res.ok) {
    showErrors([`Erreur ${res.status}`]);
    setStatus("");
    return;
  }
  showErrors([]);
  const blob = await res.blob();
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(blob);
  els.pdf.data = lastObjectUrl;
  setStatus("À jour");
}

function scheduleRender() {
  clearTimeout(timer);
  timer = setTimeout(render, 600);
}

async function loadTemplate(name) {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`);
  if (!res.ok) {
    showErrors([`Template introuvable : ${name}`]);
    return;
  }
  els.manifest.value = (await res.json()).manifest;
  await render();
}

async function save() {
  const name = els.template.value;
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: els.manifest.value }),
  });
  setStatus(res.ok ? "Enregistré" : `Échec de l'enregistrement (${res.status})`);
}

async function boot() {
  const [templates, variants] = await Promise.all([
    fetch("/api/templates").then((r) => r.json()),
    fetch("/api/variants").then((r) => r.json()),
  ]);

  for (const variant of variants.variants) {
    els.variant.append(new Option(variant.label, variant.id));
  }
  for (const template of templates.templates) {
    els.template.append(new Option(template.name, template.name));
  }

  els.manifest.addEventListener("input", scheduleRender);
  els.variant.addEventListener("change", render);
  els.template.addEventListener("change", () => loadTemplate(els.template.value));
  els.save.addEventListener("click", save);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      save();
    }
  });

  if (templates.templates.length > 0) {
    await loadTemplate(templates.templates[0].name);
  } else {
    setStatus("Aucun template dans l'atelier — lancez make new-badge-template NAME=…");
  }
}

boot();
```

- [ ] **Étape 4 : Vérifier dans le navigateur**

```bash
make studio
```

Ouvrir `http://localhost:3786`. Vérifier, sur le template `essai-studio` créé en Task 5 :

1. le manifeste s'affiche et l'aperçu apparaît en quelques secondes ;
2. modifier une coordonnée (`"x": 2` → `"x": 20`) déplace le bloc dans l'aperçu, sans enregistrer ;
3. casser le JSON affiche les erreurs et **laisse l'aperçu précédent** en place ;
4. le sélecteur de variante change les données : la variante « sans photo » fait apparaître le repli du bloc image, « textes longs » montre les débordements ;
5. `Ctrl/Cmd+S` affiche « Enregistré » et le fichier sur le disque contient bien la nouvelle valeur ;
6. recharger la page rouvre le manifeste enregistré.

- [ ] **Étape 5 : Vérifier lint et types**

```bash
make lint && make typecheck && make test
```

Attendu : tout au vert. `app.js` n'est pas typé ; s'il est repris par ESLint, vérifier qu'aucune règle ne le rejette (il utilise `type="module"` et des API navigateur standard).

---

### Task 7 : Documentation

**Files:**
- Modify: `docs/v4/features/templates-badges.md` (section « Créer un template », autour de la ligne 93)
- Modify: `docs/v4/installation.md` (tableau des services)
- Modify: `CLAUDE.md` (tableau des services et tableau des commandes `make`)

**Interfaces:**
- Consomme : le comportement livré par les Tasks 1 à 6.
- Produit : rien.

- [ ] **Étape 1 : Décrire la nouvelle boucle de construction**

Dans `docs/v4/features/templates-badges.md`, remplacer le bloc de commandes de la section « Créer un template » par :

```bash
make new-badge-template NAME=salon-2027   # cree le squelette
make studio                               # ouvre le studio sur http://localhost:3786
# editer le manifeste dans le studio, l'apercu se rafraichit a mesure
# deposer les images dans badge-templates/salon-2027/assets/
make pack-badge-template NAME=salon-2027  # produit l'archive
```

et ajouter juste après, avant le paragraphe sur le dossier gitignoré :

```markdown
Le **studio** (`make studio`) est un outil de développement local : il liste les templates
de l'atelier, édite leur manifeste et rend le badge à chaque modification, sans empaqueter
ni installer. Le rendu porte sur le texte de l'éditeur, donc avant enregistrement, et un
sélecteur permet de commuter entre cinq jeux de données — participant complet, sans photo,
catégorie anonyme, badge neutre, textes très longs — pour éprouver les `visibleIf` et les
modes de débordement. Il n'est jamais déployé et ne connaît ni la base, ni le stockage.
```

- [ ] **Étape 2 : Ajouter le service à la doc d'installation**

Dans `docs/v4/installation.md`, ajouter une ligne au tableau des services, en suivant la forme des lignes existantes : service `studio`, port direct `3786`, URL `https://studio.badge.local`, description « Studio de construction de templates (dev) ».

- [ ] **Étape 3 : Mettre à jour `CLAUDE.md`**

Deux tableaux : celui des services (même ligne que ci-dessus) et celui des commandes, où `make studio` rejoint les commandes de développement avec la description « Studio de templates (édition + aperçu) ».

- [ ] **Étape 4 : Vérification finale**

```bash
make lint && make typecheck && make test
```

Attendu : tout au vert. Mettre ensuite la table `## Progression` à jour, puis signaler que le travail est pret a etre relu. Le commit suit la regle des contraintes globales : rien en session interactive, un commit par tache sous `run-plans.sh`.

---

## Notes d'exécution

- `make test` vide la base de dev (les tests du studio n'y touchent pas, mais le `setupFiles` global s'exécute quand même) : relancer `make db-seed` avant toute reprise manuelle de l'application.
- Le premier rendu PDF de chaque session télécharge Montserrat depuis Google Fonts ; sans accès sortant, le rendu échoue. C'est la même contrainte qu'à l'installation d'un template.
- `studio/` n'entre pas dans les seuils de couverture, mais ses tests sont exécutés par `make test` : les garder verts.
