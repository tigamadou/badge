# Catalogue et installation de templates de badge — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-11-v4-catalogue-et-installation-de-templates.md`](../specs/2026-08-11-11-v4-catalogue-et-installation-de-templates.md)
**Depend de :** plan 10 (moteur declaratif) — `buildDeclarativeTemplate` et `parseManifest` doivent exister.
**Deuxieme de trois plans** : [10] format et moteur → **[11] catalogue et installation** → [12] bascule et retrait

**Goal:** Permettre au staff plateforme de televerser une archive de template depuis son espace, et rendre le template installe selectionnable au meme titre que ceux livres avec l'application.

**Architecture:** Une table `InstalledBadgeTemplate` dont chaque ligne est une **version figee** — reinstaller cree une ligne, jamais une mise a jour. Un module unique `package-reader.ts` est seul autorise a ouvrir une archive et applique toutes les bornes de securite avant extraction. Une fonction `resolveTemplate(id)` unifie registre code et base, de sorte que les six consommateurs actuels ne verront pas le retrait du registre au plan 12.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 6 / MySQL 8, Zod, `jszip` 3.10 (deja dependance), `@aws-sdk/client-s3` via `src/lib/storage.ts`, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » ne valent pas autorisation.
2. **Aucune modification de `src/` pour faire passer un test.**
3. **Le layout d'une ligne installee est immuable.** Aucune route ne doit exposer de modification de `layout`, `assetPrefix` ou `family`. Seul `archived` change.
4. **`resolveTemplate` doit resoudre les templates archives.** C'est ce qui fige les badges des evenements deja configures : ne jamais filtrer sur `archived` dans la resolution, uniquement dans la liste des templates proposables.
5. **Le moteur reste pur** : `src/lib/badge-templates/declarative/` ne doit importer ni Prisma, ni `storage`, ni `jszip`. Tout cela vit dans `package-reader.ts` et `resolve.ts`.
6. **Images JPEG et PNG uniquement**, type verifie sur les **octets d'en-tete**, jamais sur l'extension. WebP est refuse : `@react-pdf/image` ne le lit pas.
7. **Aucune migration de donnees.** L'application n'est pas en production : `make db-push` suffit, suivi de `make db-seed`. Ne jamais lancer `make db-reset` sans demander.
8. **Seuils de couverture = gate a 100%** sur `src/lib/**` et `src/app/api/**`.
9. **Contrat minimal par route API** (politique de tests) : 1 golden path, 1 cas 401, 1 cas 403 par frontiere de role, 1 cas 400 de validation, 1 cas 404 le cas echeant, et l'assertion `logActivity` pour toute action sensible.
10. **Contrat E2E strict :** zero `page.request.*`, connexion via `loginAndEnter` ou le formulaire reel, URL assertee a chaque etape, succes **et** echec asseres.
11. **Base de tests partagee :** `make test` vide la base de dev. Relancer `make db-seed` avant toute verification navigateur.
12. **Langue :** UI, messages et documentation en francais accentue ; identifiants et types en anglais ASCII.
13. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, plus verification navigateur pour les changements UI.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Modele Prisma et types d'activite | [x] | 2026-08-11 | `installedById` sans relation, comme `ProfileSubmission.reviewedById` |
| 2 | Lecteur d'archive securise | [x] | 2026-08-11 | 20 tests, dont une vraie bombe de decompression |
| 3 | Contexte fictif et rendu d'epreuve | [x] | 2026-08-11 | 6 tests |
| 4 | Resolution unifiee | [x] | 2026-08-11 | 15 tests. `templateExists` ajoute : `resolveTemplate` retombe toujours sur le defaut, donc ne peut pas valider une saisie |
| 5 | Route d'installation | [x] | 2026-08-11 | 10 tests, dont le nettoyage du stockage apres echec de rendu |
| 6 | Route d'archivage | [x] | 2026-08-11 | 8 tests. Schema `.strict()` : l'immuabilite du layout est appliquee par le validateur |
| 7 | Bascule des six consommateurs | [x] | 2026-08-11 | **Aucun test existant modifie** — critere de reussite atteint |
| 8 | Ecran plateforme et E2E | [x] | 2026-08-11 | 3 tests e2e verts : installation, refus d'archive invalide, lecture seule pour STAFF_OBSERVER |
| 9 | Documentation | [x] | 2026-08-11 | Fiche feature completee, section architecture creee |

### Ecarts constates a l'execution (2026-08-11)

**L'apercu a demande un arbitrage non prevu.** La spec disait « apercu genere, stocke via
`storage.ts` », sans trancher son format ni son mode de service. Or `@react-pdf` ne
produit que du PDF, tandis que `BadgeTemplatePicker` affichait l'apercu via `next/image`,
qui refuse une cle de stockage nue **et** un PDF : l'ecran de reglage badge plantait.
Decision du 2026-08-11 : servir le PDF via `/api/files/[...path]` (les cles
`badge-templates/` y sont non sensibles, aucune route a creer) et aiguiller le selecteur
selon la source — image, `<object>` PDF, ou vignette neutre.

**`TemplateSummary` n'a pas ete reimporte du picker.** Le plan le demandait, mais
`src/lib/` ne doit pas dependre de `src/components/`. Le type est defini dans
`resolve.ts` ; les deux sont structurellement identiques.

**Deux surprises de bibliotheque, cote tests :** `JSZip` normalise `assets/../evil.png` en
`evil.png` (le zip slip est neutralise en amont, la garde du lecteur reste une defense en
profondeur), et `generateAsync` ne compresse pas par defaut — sans `DEFLATE` explicite,
une « bombe » de 40 Mo pese 40 Mo et heurte la mauvaise borne.

**Le serveur dev a du etre redemarre et son cache purge.** `db-push` regenere le client
Prisma sur disque, mais le process Next garde l'ancien en memoire :
`prisma.installedBadgeTemplate` etait `undefined` en page, alors que les tests Vitest
passaient. Le cache Turbopack s'est en outre revele corrompu (`Failed to restore task
data`), ce qui bloquait la recompilation ; `rm -rf .next` l'a resolu.

---

## Etat initial (constate le 2026-08-11)

- `jszip@3.10.1` est **deja** une dependance (`package.json:dependencies`). Aucune lib a ajouter.
- `src/lib/storage.ts` expose `uploadFile(key, body: Buffer, contentType): Promise<string>`, `getFile(key): Promise<{ body: Buffer; contentType: string }>`, `deleteFile(key)`, `deletePrefix(prefix): Promise<number>`, et la constante `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`.
- `src/app/api/platform/settings/badge/route.ts:16-28` : motif de garde staff — session obligatoire (401), puis `requireStaff(session.user.id, "STAFF_ADMIN")`, `AuthError` traduite en code et statut.
- `prisma/schema.prisma` : l'enum `ActivityType` se termine l.512-525 par le bloc « v4 (plan 08) ». `ProfileSubmission.reviewedById` (l.318) est un `String` **sans relation** — motif a suivre pour `installedById`.
- Six consommateurs du registre : `src/app/platform/settings/badge/page.tsx:7,31`, `src/app/org/[orgId]/settings/badge/page.tsx:7,52`, `src/app/event/[eventId]/settings/badge/page.tsx:7,62`, `src/app/api/platform/settings/badge/route.ts:7,37`, `src/app/api/org/[orgId]/settings/badge/route.ts:7,43`, `src/app/api/org/[orgId]/events/[eventId]/settings/badge/route.ts:5,33`, plus `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx:7,61,68`.
- `src/components/admin/BadgeTemplatePicker.tsx:12-20` : le type `TemplateSummary` porte `id`, `label`, `description`, `pages`, `pageSize`, `previewSrc`. **Inchange** par ce plan.
- `@react-pdf/font` accepte une data URL comme `src` (l.249) : images **et** polices passent par le meme canal.

---

## Task 1 : Modele Prisma et types d'activite

**Files:**
- Modify: `prisma/schema.prisma` (nouveau model ; enum `ActivityType` l.525)

**Interfaces:**
- Consomme : rien.
- Produit : le model `InstalledBadgeTemplate` et deux `ActivityType`, consommes par les tasks 4 a 8.

- [ ] **Step 1 : Ajouter le model**

Dans `prisma/schema.prisma`, apres le model `RejectionReason` :

```prisma
// v4 (plan 11) : une ligne = une VERSION FIGEE d'un template installe.
// Reinstaller cree une nouvelle ligne : `layout` et `assetPrefix` ne sont JAMAIS
// mis a jour. C'est ce qui garantit qu'un evenement ne voit pas son badge changer.
// `installedById` est un identifiant nu, sans relation, comme
// ProfileSubmission.reviewedById : c'est une donnee d'audit.
model InstalledBadgeTemplate {
  id            String    @id @default(cuid())
  family        String
  version       Int
  label         String
  description   String    @db.Text
  pages         Int
  pageWidthMm   Float
  pageHeightMm  Float
  layout        Json
  assetPrefix   String
  previewPath   String?
  formatVersion Int
  installedById String
  archived      Boolean   @default(false)
  archivedAt    DateTime?
  createdAt     DateTime  @default(now())

  @@unique([family, version])
  @@index([archived])
}
```

- [ ] **Step 2 : Ajouter les types d'activite**

A la fin de l'enum `ActivityType` (avant l'accolade fermante, l.525) :

```prisma
  // v4 (plan 11) : catalogue des templates de badge installes
  BADGE_TEMPLATE_INSTALLED
  BADGE_TEMPLATE_ARCHIVED
```

- [ ] **Step 3 : Appliquer le schema**

Run: `make db-push`
Expected: schema applique sans perte. `make db-reset` est **interdit** ici.

- [ ] **Step 4 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe (le client Prisma est regenere par `db-push`).

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add prisma/schema.prisma
git commit -m "feat(v4): modele des templates de badge installes"
```

---

## Task 2 : Lecteur d'archive securise

**Files:**
- Create: `src/lib/badge-templates/package-reader.ts`
- Create: `src/lib/badge-templates/__tests__/package-reader.test.ts`

**Interfaces:**
- Consomme : `parseManifest(input, entries)` du plan 10.
- Produit :

```ts
export type PackageAsset = { path: string; body: Buffer; contentType: string };
export type ReadResult =
  | { ok: true; manifest: TemplateManifest; assets: PackageAsset[] }
  | { ok: false; errors: string[] };
export async function readTemplatePackage(archive: Buffer): Promise<ReadResult>;
```

Les bornes sont exportees pour etre testables et documentees :
`MAX_ARCHIVE_BYTES = 10 * 1024 * 1024`, `MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024`,
`MAX_ENTRIES = 50`, `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `MAX_FONT_BYTES = 2 * 1024 * 1024`.

- [ ] **Step 1 : Ecrire les tests en echec**

Les fixtures sont construites a la volee avec `jszip`, ce qui evite de versionner des binaires :

```ts
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readTemplatePackage, MAX_ENTRIES } from "../package-reader";

// Octets d'en-tete reels : c'est sur eux que le type est verifie, jamais sur
// l'extension. PNG = 89 50 4E 47, JPEG = FF D8 FF, WebP = RIFF....WEBP.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
const TTF = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);

const MANIFEST = {
  formatVersion: 1,
  family: "salon-2027",
  label: "Badge Salon",
  description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 85.6, h: 54, asset: "assets/fond.png" }],
};

async function zipOf(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("readTemplatePackage", () => {
  it("accepte une archive valide", async () => {
    const buf = await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/fond.png": PNG });
    const res = await readTemplatePackage(buf);
    expect(res.ok).toBe(true);
    expect(res.ok === true && res.assets.map((a) => a.path)).toEqual(["assets/fond.png"]);
  });

  it("refuse une archive sans manifeste", async () => {
    const res = await readTemplatePackage(await zipOf({ "assets/fond.png": PNG }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/manifest\.json/i);
  });

  it("refuse un manifeste illisible", async () => {
    const res = await readTemplatePackage(await zipOf({ "manifest.json": "{ pas du json" }));
    expect(res.ok).toBe(false);
  });

  it("refuse une entree hors des trois emplacements autorises", async () => {
    const buf = await zipOf({
      "manifest.json": JSON.stringify(MANIFEST),
      "assets/fond.png": PNG,
      "README.md": "coucou",
    });
    const res = await readTemplatePackage(buf);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/emplacement/i);
  });

  it("refuse un chemin remontant hors du dossier", async () => {
    const buf = await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/../../evil.png": PNG });
    const res = await readTemplatePackage(buf);
    expect(res.ok).toBe(false);
  });

  it("refuse une archive comptant trop d'entrees", async () => {
    const files: Record<string, Buffer | string> = { "manifest.json": JSON.stringify(MANIFEST) };
    for (let i = 0; i < MAX_ENTRIES + 1; i++) files[`assets/f${i}.png`] = PNG;
    const res = await readTemplatePackage(await zipOf(files));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/entrees/i);
  });

  it("refuse une bombe de decompression", async () => {
    // 40 Mo de zeros se compressent en quelques kilo-octets : l'archive passe la
    // borne d'entree, mais pas celle du volume decompresse.
    const buf = await zipOf({
      "manifest.json": JSON.stringify(MANIFEST),
      "assets/fond.png": Buffer.concat([PNG, Buffer.alloc(40 * 1024 * 1024, 0)]),
    });
    const res = await readTemplatePackage(buf);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/volume|decompress/i);
  });

  it("refuse une image WebP", async () => {
    const manifest = { ...MANIFEST, blocks: [{ ...MANIFEST.blocks[0], asset: "assets/fond.webp" }] };
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.webp": WEBP }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/format/i);
  });

  it("refuse une image dont l'extension ment sur le contenu", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/fond.png": WEBP }),
    );
    expect(res.ok).toBe(false);
  });

  it("accepte une image JPEG", async () => {
    const manifest = { ...MANIFEST, blocks: [{ ...MANIFEST.blocks[0], asset: "assets/fond.jpg" }] };
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.jpg": JPEG }),
    );
    expect(res.ok).toBe(true);
  });

  it("accepte une police TTF declaree", async () => {
    const manifest = { ...MANIFEST, fonts: [{ alias: "titre", file: "fonts/A.ttf" }] };
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.png": PNG, "fonts/A.ttf": TTF }),
    );
    expect(res.ok).toBe(true);
  });

  it("refuse une ressource declaree mais absente de l'archive", async () => {
    const res = await readTemplatePackage(await zipOf({ "manifest.json": JSON.stringify(MANIFEST) }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/absente/i);
  });

  it("refuse une archive trop lourde", async () => {
    const res = await readTemplatePackage(Buffer.alloc(11 * 1024 * 1024, 1));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errors.join()).toMatch(/taille/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/package-reader.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

Creer `src/lib/badge-templates/package-reader.ts`. Ordre imperatif : **toutes les bornes avant toute lecture de contenu**, et le manifeste analyse en dernier, une fois la liste des entrees connue.

```ts
import JSZip from "jszip";
import { parseManifest } from "./declarative/schema";
import type { TemplateManifest } from "./declarative/manifest-types";

export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
export const MAX_ENTRIES = 50;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

const MANIFEST_PATH = "manifest.json";

// Signatures binaires. Le type est deduit des octets, jamais de l'extension :
// une image WebP renommee en .png doit etre refusee.
function sniff(body: Buffer): "image/png" | "image/jpeg" | "font" | null {
  if (body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return "image/png";
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  // TTF : 00 01 00 00 ou "true" ; OTF : "OTTO".
  const head = body.subarray(0, 4).toString("latin1");
  if (head === "OTTO" || head === "true" || (body[0] === 0x00 && body[1] === 0x01 && body[2] === 0x00 && body[3] === 0x00)) return "font";
  return null;
}

function isSafePath(path: string): boolean {
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  return path === MANIFEST_PATH || path.startsWith("assets/") || path.startsWith("fonts/");
}
```

La fonction principale enchaine : borne de taille d'archive → ouverture `JSZip.loadAsync` (entouree d'un `try` : une archive corrompue rend une erreur de validation, pas une exception) → borne du nombre d'entrees → verification de chaque chemin → lecture des contenus avec accumulation du volume decompresse et arret des depassement de `MAX_UNCOMPRESSED_BYTES` → typage par `sniff` avec bornes par categorie → lecture et analyse du manifeste avec `parseManifest(json, entries)`.

Les erreurs sont **accumulees** : l'installateur doit pouvoir corriger son paquet en une passe.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/package-reader.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/package-reader.ts src/lib/badge-templates/__tests__
git commit -m "feat(v4): lecture securisee des archives de template"
```

---

## Task 3 : Contexte fictif et rendu d'epreuve

**Files:**
- Create: `src/lib/badge-templates/declarative/sample-context.ts`
- Create: `src/lib/badge-templates/render-proof.ts`
- Create: `src/lib/badge-templates/__tests__/render-proof.test.ts`

**Interfaces:**
- Consomme : `buildDeclarativeTemplate` (plan 10), `PackageAsset` (Task 2).
- Produit :
  `SAMPLE_CONTEXT: TemplateContext` — **constant**, sans date du jour ni alea.
  `renderProof(manifest, assets, templateId): Promise<Buffer>` — rend un PDF ou leve.
  `assetsToResolver(assets: PackageAsset[]): AssetResolver` — construit un resolveur en memoire.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect } from "vitest";
import { renderProof, assetsToResolver } from "../render-proof";
import { SAMPLE_CONTEXT } from "../declarative/sample-context";
import type { TemplateManifest } from "../declarative/manifest-types";

const OK: TemplateManifest = {
  formatVersion: 1, family: "t", label: "T", description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [{ type: "text", page: 1, x: 4, y: 4, w: 40, h: 8, source: "participant.firstName",
             style: { sizePt: 12, color: "#0f172a", overflow: "clip" } }],
};

describe("renderProof", () => {
  it("produit un PDF non vide", async () => {
    const pdf = await renderProof(OK, [], "t1");
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("le contexte de demonstration est constant", () => {
    expect(SAMPLE_CONTEXT.event.date.toISOString()).toBe(SAMPLE_CONTEXT.event.date.toISOString());
    expect(SAMPLE_CONTEXT.participant.firstName).toBeTruthy();
  });
});

describe("assetsToResolver", () => {
  it("rend une data URL pour une ressource connue", () => {
    const resolve = assetsToResolver([
      { path: "assets/f.png", body: Buffer.from([1, 2, 3]), contentType: "image/png" },
    ]);
    expect(resolve("assets/f.png")).toMatch(/^data:image\/png;base64,/);
  });

  it("leve pour une ressource inconnue", () => {
    expect(() => assetsToResolver([])("assets/absent.png")).toThrow(/inconnue/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/render-proof.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3 : Implementer le contexte fictif**

```ts
import type { TemplateContext } from "../types";

// Constant : deux installations du meme paquet doivent produire le meme apercu.
// Aucune date du jour, aucun aleatoire.
export const SAMPLE_CONTEXT: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    structure: "Organisation de démonstration",
    photoDataUrl: "",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: {
    title: "Événement de démonstration",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: {
    id: "DEMO-0001",
    verifyUrl: "https://badge.local/verify/DEMO-0001",
    qrCodeDataUrl: "",
  },
};
```

- [ ] **Step 4 : Implementer le rendu d'epreuve**

```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { buildDeclarativeTemplate, type AssetResolver } from "./declarative";
import type { TemplateManifest } from "./declarative/manifest-types";
import { SAMPLE_CONTEXT } from "./declarative/sample-context";
import type { PackageAsset } from "./package-reader";

export function assetsToResolver(assets: PackageAsset[]): AssetResolver {
  const map = new Map(assets.map((a) => [a.path, `data:${a.contentType};base64,${a.body.toString("base64")}`]));
  return (name: string) => {
    const url = map.get(name);
    if (!url) throw new Error(`assetsToResolver : ressource inconnue "${name}"`);
    return url;
  };
}

// Rend le paquet avec le contexte de demonstration. Leve si le rendu echoue :
// l'appelant refuse alors l'installation. C'est la preuve qu'un paquet accepte
// au catalogue est un paquet qui s'imprime.
export async function renderProof(
  manifest: TemplateManifest,
  assets: PackageAsset[],
  templateId: string,
): Promise<Buffer> {
  const template = buildDeclarativeTemplate(manifest, assetsToResolver(assets), templateId);
  return renderToBuffer(createElement(template.Component, { ctx: SAMPLE_CONTEXT }));
}
```

Verifier que `renderToBuffer` est bien exporte par la version installee de `@react-pdf/renderer` (4.5.1) ; sinon reprendre le motif deja utilise par `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx`, qui produit deja un PDF cote serveur.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/render-proof.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates
git commit -m "feat(v4): rendu d'epreuve des paquets de template"
```

---

## Task 4 : Resolution unifiee

**Files:**
- Create: `src/lib/badge-templates/resolve.ts`
- Create: `src/lib/badge-templates/__tests__/resolve.test.ts`

**Interfaces:**
- Consomme : le registre code (`getTemplate`, `listTemplates`, `DEFAULT_TEMPLATE_ID`), `buildDeclarativeTemplate`, `storage.getFile`.
- Produit :

```ts
export async function resolveTemplate(id: string): Promise<BadgeTemplate>;
export async function listAvailableTemplates(): Promise<TemplateSummary[]>;
```

`TemplateSummary` est **le type deja exporte** par `src/components/admin/BadgeTemplatePicker.tsx:12` : le reimporter, ne pas le redefinir.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveTemplate, listAvailableTemplates } from "../resolve";
import { DEFAULT_TEMPLATE_ID } from "../index";

const LAYOUT = {
  formatVersion: 1, family: "salon", label: "Salon", description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }],
};

async function install(overrides: Partial<{ family: string; version: number; archived: boolean }> = {}) {
  return prisma.installedBadgeTemplate.create({
    data: {
      family: overrides.family ?? "salon",
      version: overrides.version ?? 1,
      label: "Salon", description: "", pages: 1,
      pageWidthMm: 85.6, pageHeightMm: 54,
      layout: LAYOUT, assetPrefix: "badge-templates/x/", formatVersion: 1,
      installedById: "u1", archived: overrides.archived ?? false,
    },
  });
}

describe("resolveTemplate", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("resout un identifiant du registre code", async () => {
    const t = await resolveTemplate(DEFAULT_TEMPLATE_ID);
    expect(t.meta.id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("resout un template installe actif", async () => {
    const row = await install();
    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Salon");
  });

  it("resout un template installe ARCHIVE (badges figes)", async () => {
    const row = await install({ archived: true });
    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Salon");
  });

  it("retombe sur le defaut pour un identifiant inconnu", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = await resolveTemplate("inconnu-xyz");
    expect(t.meta.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("listAvailableTemplates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("inclut les templates du registre", async () => {
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it("exclut les templates archives", async () => {
    const row = await install({ archived: true });
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === row.id)).toBe(false);
  });

  it("ne garde que la version la plus recente d'une famille", async () => {
    const v1 = await install({ version: 1 });
    const v2 = await install({ version: 2 });
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === v2.id)).toBe(true);
    expect(list.some((t) => t.id === v1.id)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/resolve.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

Points structurants de `src/lib/badge-templates/resolve.ts` :

- `resolveTemplate` teste d'abord `getTemplate(id)` ; si trouve, renvoie tel quel.
- Sinon, `prisma.installedBadgeTemplate.findUnique({ where: { id } })` **sans filtre sur `archived`** — c'est le point qui fige les badges existants.
- Le resolveur de ressources lit depuis le stockage : `getFile(`${row.assetPrefix}${name}`)` puis conversion en data URL. Comme `AssetResolver` est synchrone, les ressources sont **prechargees** avant la construction du template : lister les `asset` du layout et les `fonts[].file`, les charger en parallele, puis construire une `Map`.
- Repli : journaliser via `console.warn` avec le meme libelle que `badges/[badgeId]/route.tsx:64`, puis `getTemplate(DEFAULT_TEMPLATE_ID)!`.
- `listAvailableTemplates` : `listTemplates().map(...)` plus les lignes non archivees regroupees par `family` en ne gardant que le `version` maximal, `previewSrc` pointant vers `previewPath`.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/resolve.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates
git commit -m "feat(v4): resolution unifiee registre et catalogue"
```

---

## Task 5 : Route d'installation

**Files:**
- Create: `src/app/api/platform/badge-templates/route.ts`
- Create: `src/app/api/platform/badge-templates/__tests__/route.test.ts`

**Interfaces:**
- Consomme : `readTemplatePackage` (Task 2), `renderProof` / `assetsToResolver` (Task 3), `uploadFile` / `deletePrefix` (`@/lib/storage`), `BADGE_TEMPLATES` (pour la collision de famille).
- Produit : `POST /api/platform/badge-templates` → `201 { id, family, version }`.

- [ ] **Step 1 : Ecrire les tests en echec**

Le contrat minimal du projet impose golden path, 401, 403, 400 de validation et assertion `logActivity`. S'y ajoutent trois cas propres a cette route : collision de famille, incrementation de version, et **absence de residu en stockage apres echec de rendu**.

```ts
// Reprendre le motif de mock de session utilise par
// src/app/api/platform/settings/badge/__tests__/route.test.ts (a relire avant
// d'ecrire : withSession y est deja outille).
it("installe un paquet valide (201) et journalise", async () => { /* golden path */ });
it("refuse sans session (401)", async () => {});
it("refuse un STAFF_SUPPORT (403)", async () => {});
it("refuse une archive invalide (400) en listant les erreurs", async () => {});
it("refuse une famille qui collisionne avec le registre code (400)", async () => {});
it("incremente la version a la reinstallation d'une meme famille", async () => {});
it("ne laisse aucune ressource en stockage si le rendu d'epreuve echoue", async () => {});
```

Chaque test construit son archive avec `jszip`, comme en Task 2.

- [ ] **Step 2 : Lancer et verifier l'echec**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/app/api/platform/badge-templates/__tests__/route.test.ts`
Expected: FAIL — route introuvable.

- [ ] **Step 3 : Implementer**

Garde identique a `src/app/api/platform/settings/badge/route.ts:16-28` : session (401), puis `requireStaff(session.user.id, "STAFF_ADMIN")`, `AuthError` traduite.

Sequence, arret a la premiere erreur :

1. lecture du `multipart/form-data`, borne `MAX_ARCHIVE_BYTES` ;
2. `readTemplatePackage` → 400 avec `errors` ;
3. refus 400 si `manifest.family` est une cle de `BADGE_TEMPLATES` ;
4. `version = (max(version) de la famille) + 1`, ou 1 ;
5. `id` genere en amont (`cuid`) pour composer `assetPrefix = badge-templates/${id}/` ;
6. `renderProof(manifest, assets, id)` — **en cas d'echec : `deletePrefix(assetPrefix)` puis 400** ;
7. `uploadFile` de chaque ressource sous `assetPrefix` ;
8. `uploadFile` de l'apercu (`${assetPrefix}preview.pdf` ou PNG selon ce que produit l'epreuve) ;
9. `prisma.installedBadgeTemplate.create` ;
10. `logActivity({ type: "BADGE_TEMPLATE_INSTALLED", userId, targetId: id, details: { family, version }, req })`.

L'ordre 6-7 importe : le rendu d'epreuve precede l'ecriture des ressources definitives, et tout echec nettoie.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/app/api/platform/badge-templates/__tests__/route.test.ts`

- [ ] **Step 5 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/api/platform/badge-templates
git commit -m "feat(v4): installation d'un paquet de template par le staff"
```

---

## Task 6 : Route d'archivage

**Files:**
- Create: `src/app/api/platform/badge-templates/[id]/route.ts`
- Create: `src/app/api/platform/badge-templates/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consomme : le model de la Task 1.
- Produit : `PATCH /api/platform/badge-templates/[id]` acceptant **uniquement** `{ archived: boolean }`.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
it("archive un template (200) et journalise", async () => {});
it("desarchive un template (200)", async () => {});
it("refuse sans session (401)", async () => {});
it("refuse un STAFF_SUPPORT (403)", async () => {});
it("renvoie 404 sur un identifiant inconnu", async () => {});
it("ignore toute tentative de modifier le layout", async () => {
  // Poster { archived: true, layout: {...} } : la ligne conserve son layout initial.
});
it("conserve les ressources en stockage apres archivage", async () => {});
```

- [ ] **Step 2 : Lancer et verifier l'echec**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/app/api/platform/badge-templates/\[id\]/__tests__/route.test.ts`

- [ ] **Step 3 : Implementer**

Schema Zod strict : `z.object({ archived: z.boolean() }).strict()` — le `.strict()` fait de l'immuabilite une regle appliquee par le validateur, pas une convention. `archivedAt` est pose ou remis a `null` selon la valeur. `logActivity` avec `BADGE_TEMPLATE_ARCHIVED`.

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/api/platform/badge-templates
git commit -m "feat(v4): archivage d'un template installe"
```

---

## Task 7 : Bascule des six consommateurs

**Files:**
- Modify: `src/app/platform/settings/badge/page.tsx` (l.7, l.31)
- Modify: `src/app/org/[orgId]/settings/badge/page.tsx` (l.7, l.52)
- Modify: `src/app/event/[eventId]/settings/badge/page.tsx` (l.7, l.62)
- Modify: `src/app/api/platform/settings/badge/route.ts` (l.7, l.37)
- Modify: `src/app/api/org/[orgId]/settings/badge/route.ts` (l.7, l.43)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/settings/badge/route.ts` (l.5, l.33)
- Modify: `src/app/api/org/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx` (l.7, l.61, l.68)

**Interfaces:**
- Consomme : `resolveTemplate`, `listAvailableTemplates` (Task 4).
- Produit : aucun changement fonctionnel visible. **C'est le critere de reussite de cette task.**

- [ ] **Step 1 : Remplacer les listes**

Dans les trois pages de reglage, `listTemplates()` devient `await listAvailableTemplates()`. Les pages sont deja des Server Components asynchrones : verifier que la fonction englobante est bien `async`.

- [ ] **Step 2 : Remplacer les validations**

Dans les trois routes de reglage, `!getTemplate(badgeTemplateId)` devient une resolution reussie via `resolveTemplate`. Attention : `resolveTemplate` **retombe toujours** sur le defaut ; pour valider, il faut savoir si l'id existe vraiment. Ajouter a `resolve.ts` :

```ts
// Distincte de resolveTemplate, qui retombe toujours sur le defaut : ici on veut
// savoir si l'identifiant designe reellement un template.
export async function templateExists(id: string): Promise<boolean>;
```

et son test (`templateExists` sur un id du registre, un cuid installe, un cuid archive, un id inconnu). Les trois routes utilisent `templateExists`.

- [ ] **Step 3 : Remplacer le rendu**

Dans `badges/[badgeId]/route.tsx`, `getTemplate(resolvedId)` puis le repli manuel (l.61-68) deviennent un seul `await resolveTemplate(resolvedId)`, qui porte deja le repli et sa journalisation.

- [ ] **Step 4 : Verifier l'absence de regression**

Run: `make lint && make typecheck && make test`
Expected: **tous les tests existants passent sans modification.** Si un test doit changer, c'est le signe d'un changement de comportement non voulu : diagnostiquer avant d'adapter.

- [ ] **Step 5 : Verification navigateur**

Apres `make db-seed`, ouvrir les trois ecrans de reglage sur `https://badge.local` et verifier que les deux templates livres sont proposes et selectionnables comme avant.

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app
git commit -m "refactor(v4): les consommateurs passent par la resolution unifiee"
```

---

## Task 8 : Ecran plateforme et couverture E2E

**Files:**
- Create: `src/app/platform/badge-templates/page.tsx`
- Create: `src/components/staff/BadgeTemplateInstaller.tsx`
- Modify: `src/components/staff/StaffShell.tsx` (tableau `NAV`, l.5-12)
- Create: `e2e/platform/badge-templates.spec.ts`

- [ ] **Step 1 : Ajouter l'entree de navigation**

Dans `src/components/staff/StaffShell.tsx`, ajouter une entree « Templates de badge » vers `/platform/badge-templates`, en suivant exactement la forme des entrees existantes.

- [ ] **Step 2 : Ecrire la page catalogue**

Server Component listant les familles avec leur version courante, leur apercu, leur date d'installation et leur etat. Un bouton d'archivage par ligne.

- [ ] **Step 3 : Ecrire le composant d'installation**

Client Component : champ de fichier, envoi en `multipart/form-data`, affichage de la **liste des erreurs** de validation le cas echeant, puis de l'apercu obtenu avant confirmation. Reprendre le motif de retour d'erreur de `src/components/admin/BadgeTemplatePicker.tsx:55-62`.

- [ ] **Step 4 : Ecrire la spec E2E**

`e2e/platform/badge-templates.spec.ts`, contrat E2E strict :

```ts
test("le staff installe une archive et un evenement l'utilise", async ({ page }) => {
  // 1. STAFF_ADMIN sur /platform/badge-templates : installe une archive construite
  //    a la volee (jszip cote test), voit l'apercu, confirme, voit la ligne.
  // 2. Un membre d'organisation ouvre les parametres de badge de son evenement,
  //    selectionne le template installe, et l'ecran confirme la selection.
  // 3. Assertion en base : Event.badgeTemplateId vaut le cuid installe.
});

test("une archive invalide est refusee avec ses erreurs", async ({ page }) => {
  // Archive sans manifeste : le message d'erreur est visible, aucune ligne creee.
});

test("un STAFF_OBSERVER ne voit pas le formulaire d'installation", async ({ page }) => {});
```

- [ ] **Step 5 : Lancer les tests**

Run: `docker compose -f docker-compose.dev.yml exec -T -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/badge-templates.spec.ts`
Expected: 3 tests verts. En cas d'echec sur un selecteur, corriger le **test** d'apres le composant reel.

- [ ] **Step 6 : Verification navigateur**

Apres `make db-seed`, installer une archive reelle depuis `https://badge.local/platform/badge-templates` et imprimer un badge d'evenement l'utilisant.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/platform/badge-templates src/components/staff e2e/platform
git commit -m "feat(v4): ecran d'installation des templates de badge"
```

---

## Task 9 : Documentation

**Files:**
- Modify: `docs/v4/features/templates-badges.md`
- Modify: `docs/v4/architecture.md`
- Create: `docs/v4/api/platform-badge-templates.md` (suivre la forme des fiches existantes de `docs/v4/api/`)

- [ ] **Step 1 : Completer la fiche feature**

Ajouter : installation, versionnement fige, archivage, tableau des bornes appliquees a l'archive (tailles, nombre d'entrees, formats), et la raison de chacune.

- [ ] **Step 2 : Mettre a jour l'architecture**

Decrire le catalogue, la resolution unifiee, et le fait qu'un template archive **reste resolvable**.

- [ ] **Step 3 : Documenter les routes**

- [ ] **Step 4 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add docs/v4
git commit -m "docs(v4): catalogue des templates de badge installes"
```
