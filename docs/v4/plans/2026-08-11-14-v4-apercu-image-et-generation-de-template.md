# Apercu en image et generation d'un squelette de template — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-14-v4-apercu-image-et-generation-de-template.md`](../specs/2026-08-11-14-v4-apercu-image-et-generation-de-template.md)
**Depend de :** plans 10 a 13.

**Goal:** Remplacer la vignette PDF par une image fournie dans le paquet, tout en conservant le PDF d'epreuve comme validation et comme telechargement, et outiller la creation d'un template par deux commandes make.

**Architecture:** Le manifeste gagne un champ `preview` optionnel, valide comme les autres ressources. Le modele distingue desormais deux fichiers : `previewPath` (l'image) et `proofPath` (le PDF). Deux scripts `tsx` produisent un squelette de paquet puis l'empaquettent, en reutilisant `parseManifest` pour refuser d'empaqueter un manifeste invalide.

**Tech Stack:** TypeScript 5, Prisma 6 / MySQL 8, Zod, `jszip` (deja dependance), `tsx`, React 19, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » ne valent pas autorisation.
2. **Aucune modification de `src/` pour faire passer un test.**
3. **Le rendu d'epreuve reste une validation d'installation.** Ne jamais le retirer de `installTemplate` : c'est lui qui garantit qu'un template accepte au catalogue s'imprime.
4. **`TemplatePreview` conserve sa branche PDF.** Les lignes installees avant ce changement pointent encore vers un `preview.pdf` et doivent continuer de s'afficher.
5. **`badge-templates/` (racine) est un atelier gitignore**, a ne pas confondre avec `prisma/badge-templates/`, qui contient les paquets de reference installes par le seed.
6. **Aucune migration de donnees.** L'application n'est pas en production : `make db-push` puis `make db-seed`. Ne jamais lancer `make db-reset` sans demander.
7. **Seuils de couverture = gate a 100%** sur `src/lib/**` et `src/app/api/**`. Les composants React ne sont pas couverts par l'unitaire (politique de tests, section 1).
8. **Images : JPEG et PNG uniquement**, type verifie sur les octets d'en-tete. WebP est refuse : `@react-pdf` ne le lit pas.
9. **Contrat E2E strict :** zero `page.request.*`, URL assertee a chaque etape.
10. **Base de tests partagee :** `make test` vide la base de dev. Relancer `make db-seed` avant toute verification navigateur.
11. **Langue :** UI et documentation en francais accentue ; identifiants et types en anglais ASCII.
12. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Champ `preview` dans le manifeste | [x] | 2026-08-11 | 3 tests |
| 2 | Modele et installation | [x] | 2026-08-11 | `proofPath` distinct de `previewPath` |
| 3 | Affichage et telechargement du PDF | [x] | 2026-08-11 | Le filtre de la liste des ressources vise desormais `proof.pdf` |
| 4 | Commande de generation d'un squelette | [x] | 2026-08-11 | 7 tests ; README documentant le format complet |
| 5 | Commande d'empaquetage | [x] | 2026-08-11 | 6 tests ; refuse un manifeste invalide ou un apercu declare sans image |
| 6 | E2E et documentation | [x] | 2026-08-11 | 6 tests e2e verts |

### Ecarts constates a l'execution (2026-08-11)

**Trois tests assertaient l'ancien contrat** (`previewPath` pointant vers un PDF) : un dans
`install.test.ts`, un dans les tests de la route d'installation, un dans l'E2E. Tous
adaptes pour asserter `proofPath` et un `previewPath` nul quand le paquet ne fournit pas
d'image.

**Le serveur dev a du etre redemarre**, comme au plan 11 : `make db-push` regenere le
client Prisma sur disque, mais le process Next garde l'ancien en memoire et ignore
`proofPath`. Les tests Vitest passaient, l'installation echouait en E2E.

**Le squelette declare `preview` alors que le dossier `assets/` est cree vide.** C'est
delibere : `make pack-badge-template` refuse alors d'empaqueter tant que l'image n'a pas
ete deposee, ce qui constitue le rappel le plus utile possible. Le test « produit un
manifeste valide » passe donc `["assets/apercu.png"]` comme entrees, reflet de l'etat
attendu apres depot.

---

## Etat initial (constate le 2026-08-11)

- `src/lib/badge-templates/declarative/schema.ts` : `manifestSchema` porte `formatVersion`, `family`, `label`, `description`, `page`, `fonts`, `blocks`. `parseManifest(input, entries)` verifie que chaque `asset` et chaque `fonts[].file` figure dans `entries`.
- `src/lib/badge-templates/install.ts:38` : `installTemplate` appelle `renderProof`, nettoie par `deletePrefix` en cas d'echec, puis ecrit les ressources et `${assetPrefix}preview.pdf` dans `previewPath`.
- `src/lib/badge-templates/resolve.ts` : `previewUrl(previewPath)` rend `/api/files/<path>` ou `""`.
- `src/components/ui/TemplatePreview.tsx` : image, `<object>` PDF, ou placeholder — les trois cas sont deja geres.
- `src/app/platform/badge-templates/[id]/page.tsx` : la section « Ressources embarquees » filtre `preview.pdf` du listing (`o.key.endsWith("/preview.pdf")`).
- `src/app/api/platform/badge-templates/route.ts` : la route delegue entierement a `installTemplate`.
- `Makefile` : les cibles sont declarees dans `.PHONY` (l.6-11) ; motif d'appel `docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/<x>.ts`.
- `jszip@3.10.1` est deja une dependance.
- `prisma/badge-templates/<famille>/manifest.json` : les deux paquets de reference, sans dossier `assets/`.

---

## Task 1 : Champ `preview` dans le manifeste

**Files:**
- Modify: `src/lib/badge-templates/declarative/manifest-types.ts` (type `TemplateManifest`)
- Modify: `src/lib/badge-templates/declarative/schema.ts` (`manifestSchema` et `parseManifest`)
- Modify: `src/lib/badge-templates/declarative/__tests__/schema.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit : `TemplateManifest.preview?: string`, consomme par les Tasks 2 et 5.

- [ ] **Step 1 : Ecrire les tests en echec**

Ajouter a `schema.test.ts` :

```ts
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
    expect(errorsOf(res)).toMatch(/apercu|aperçu/i);
  });
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/schema.test.ts`
Expected: FAIL sur « refuse un apercu absent du paquet » — le champ n'est pas encore verifie.

- [ ] **Step 3 : Ajouter le champ au type**

Dans `manifest-types.ts`, au type `TemplateManifest`, apres `description` :

```ts
  // Image d'apercu du badge, fournie par l'auteur du paquet et affichee au catalogue.
  // Optionnelle : sans elle, l'interface montre un placeholder.
  preview?: string;
```

- [ ] **Step 4 : Ajouter le champ au schema**

Dans `schema.ts`, a `manifestSchema`, apres `description` :

```ts
  preview: z.string().min(1).optional(),
```

et, dans `parseManifest`, juste apres la boucle de verification des polices :

```ts
  if (parsed.data.preview && !entries.includes(parsed.data.preview)) {
    errors.push(`apercu : fichier "${parsed.data.preview}" absent du paquet.`);
  }
```

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/declarative/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 6 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/badge-templates/declarative
git commit -m "feat(v4): champ apercu dans le manifeste de template"
```

---

## Task 2 : Modele et installation

**Files:**
- Modify: `prisma/schema.prisma` (model `InstalledBadgeTemplate`)
- Modify: `src/lib/badge-templates/install.ts` (`installTemplate`)
- Modify: `src/lib/badge-templates/__tests__/install.test.ts`

**Interfaces:**
- Consomme : `TemplateManifest.preview` (Task 1).
- Produit : `InstalledBadgeTemplate.proofPath`, et un `previewPath` qui designe desormais l'image.

- [ ] **Step 1 : Ajouter le champ au modele**

Dans `prisma/schema.prisma`, au model `InstalledBadgeTemplate`, apres `previewPath` :

```prisma
  // v4 (spec 14) : previewPath designe l'IMAGE d'apercu declaree par le manifeste
  // (null si le paquet n'en fournit pas) ; proofPath le PDF produit a l'installation,
  // conserve pour verifier le rendu aux dimensions reelles.
  proofPath     String?
```

Run: `make db-push`

- [ ] **Step 2 : Ecrire les tests en echec**

Ajouter a `install.test.ts`, dans le `describe("installTemplate")` :

```ts
  it("stocke l'image d'apercu declaree et le PDF d'epreuve separement", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const manifest: TemplateManifest = {
      formatVersion: 1,
      family: "avec-apercu",
      label: "Avec apercu",
      description: "",
      preview: "assets/apercu.png",
      page: { widthMm: 85.6, heightMm: 54, count: 1 },
      blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }],
    };

    const created = await installTemplate({
      manifest,
      assets: [{ path: "assets/apercu.png", body: png, contentType: "image/png" }],
      installedById: "u1",
    });

    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.previewPath).toBe(`badge-templates/${created.id}/assets/apercu.png`);
    expect(row?.proofPath).toBe(`badge-templates/${created.id}/proof.pdf`);
  });

  it("laisse previewPath nul quand le paquet ne declare pas d'apercu", async () => {
    const manifest: TemplateManifest = {
      formatVersion: 1,
      family: "sans-apercu",
      label: "Sans apercu",
      description: "",
      page: { widthMm: 85.6, heightMm: 54, count: 1 },
      blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }],
    };

    const created = await installTemplate({ manifest, assets: [], installedById: "u1" });

    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.previewPath).toBeNull();
    // Le PDF est produit meme sans apercu : c'est la preuve que le paquet s'imprime.
    expect(row?.proofPath).toBe(`badge-templates/${created.id}/proof.pdf`);
  });
```

- [ ] **Step 3 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/install.test.ts`
Expected: FAIL — `previewPath` vaut encore le chemin du PDF.

- [ ] **Step 4 : Adapter `installTemplate`**

Remplacer le bloc d'ecriture de l'apercu :

```ts
  const proofPath = `${assetPrefix}proof.pdf`;
  await uploadFile(proofPath, preview, "application/pdf");
  // L'apercu affiche est l'image fournie par le paquet ; le PDF ne sert plus que de
  // preuve d'impression, telechargeable depuis la page de detail.
  const previewPath = manifest.preview ? `${assetPrefix}${manifest.preview}` : null;
```

et passer `previewPath` et `proofPath` au `create`.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/install.test.ts`
Expected: PASS.

- [ ] **Step 6 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe. **Les tests de la route d'installation ne doivent pas changer** :
seule la destination des fichiers evolue, pas le contrat de la route.

Puis `make db-seed` et verifier en base que les deux templates livres ont `previewPath`
nul et un `proofPath` renseigne.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add prisma/schema.prisma src/lib/badge-templates
git commit -m "feat(v4): distingue l'image d'apercu du PDF d'epreuve"
```

---

## Task 3 : Affichage et telechargement du PDF

**Files:**
- Modify: `src/app/platform/badge-templates/[id]/page.tsx`
- Modify: `src/app/platform/badge-templates/page.tsx`

**Interfaces:**
- Consomme : `proofPath` (Task 2), `previewUrl`, `TemplatePreview`.
- Produit : rien.

- [ ] **Step 1 : Retirer le filtrage devenu inutile**

Dans la page de detail, la liste des ressources filtrait le PDF :

```tsx
const ressources = objets.filter((o) => !o.key.endsWith("/preview.pdf"));
```

Le PDF s'appelle desormais `proof.pdf` et l'image est une ressource legitime du paquet.
Remplacer par :

```tsx
// proof.pdf est produit a l'installation, pas fourni par le paquet : il n'a pas sa
// place dans la liste des ressources embarquees.
const ressources = objets.filter((o) => !o.key.endsWith("/proof.pdf"));
```

- [ ] **Step 2 : Ajouter le telechargement du PDF d'epreuve**

Dans la section Manifeste, a cote de `ManifestDownloadButton` :

```tsx
{template.proofPath && (
  <a
    href={previewUrl(template.proofPath)}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
  >
    <Icon name="download" size={15} /> PDF d&apos;épreuve
  </a>
)}
```

`previewUrl` construit `/api/files/<cle>` pour n'importe quelle cle de stockage : son nom
parle d'apercu, mais sa fonction est de prefixer une cle. L'utiliser ici evite de dupliquer
le prefixe.

- [ ] **Step 3 : Verifier dans le navigateur**

Apres `make db-seed`, ouvrir le detail d'un template livre : l'apercu doit montrer le
**placeholder** (aucune image fournie), et le bouton « PDF d'épreuve » doit ouvrir le PDF.

- [ ] **Step 4 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/platform/badge-templates
git commit -m "feat(v4): apercu en image et PDF d'epreuve telechargeable"
```

---

## Task 4 : Commande de generation d'un squelette

**Files:**
- Create: `scripts/new-badge-template.ts`
- Create: `scripts/__tests__/new-badge-template.test.ts`
- Modify: `Makefile` (nouvelle cible + `.PHONY`)
- Modify: `.gitignore`

**Interfaces:**
- Consomme : rien.
- Produit : `createSkeleton(name: string, root: string): string` — cree l'arborescence et
  rend le chemin du dossier cree. Le point d'entree CLI lit `NAME` dans l'environnement.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkeleton } from "../new-badge-template";
import { parseManifest } from "@/lib/badge-templates/declarative/schema";

let racine: string;

afterEach(() => {
  if (racine && existsSync(racine)) rmSync(racine, { recursive: true, force: true });
});

describe("createSkeleton", () => {
  it("cree le manifeste, le README et le dossier assets", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);

    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
    expect(existsSync(join(dir, "README.md"))).toBe(true);
    expect(existsSync(join(dir, "assets"))).toBe(true);
  });

  it("produit un manifeste valide", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

    const res = parseManifest(manifest, []);
    expect(res.ok, res.ok === false ? res.errors.join(" | ") : "").toBe(true);
  });

  it("nomme la famille d'apres le nom demande", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    expect(manifest.family).toBe("salon-2027");
  });

  it("refuse un nom qui n'est pas un slug", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    expect(() => createSkeleton("Salon 2027", racine)).toThrow(/slug/i);
  });

  it("refuse d'ecraser un dossier existant", () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    createSkeleton("salon-2027", racine);
    expect(() => createSkeleton("salon-2027", racine)).toThrow(/existe/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/new-badge-template.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

`createSkeleton` ecrit trois choses. Le manifeste d'exemple doit etre **minimal mais
reellement valide** — il passe `parseManifest`, donc il s'installe tel quel :

```ts
const MANIFEST = (family: string) => ({
  formatVersion: 1,
  family,
  label: `Badge ${family}`,
  description: "Decrivez ici le badge en une phrase.",
  preview: "assets/apercu.png",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [
    { type: "rect", page: 1, x: 0, y: 46, w: 85.6, h: 8, fill: "category.color" },
    {
      type: "text", page: 1, x: 4, y: 6, w: 60, h: 8,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePt: 12, weight: 700, color: "#0f172a", overflow: "shrink", minSizePt: 8 },
    },
    { type: "qr", page: 1, x: 64, y: 30, w: 16, h: 16 },
  ],
});
```

**Attention** : ce manifeste declare `preview: "assets/apercu.png"`, mais le dossier
`assets/` est cree vide. Un `parseManifest(manifest, [])` echouerait donc. Deux facons de
concilier squelette utile et manifeste valide — retenir la seconde :

1. omettre `preview` du squelette : valide, mais l'auteur ne sait pas que le champ existe ;
2. **inclure `preview` et documenter dans le README qu'il faut deposer l'image** ; le test
   « produit un manifeste valide » appelle alors `parseManifest(manifest, ["assets/apercu.png"])`,
   ce qui reflete l'etat attendu une fois l'image deposee.

Adapter le test de la Step 1 en consequence : passer `["assets/apercu.png"]` comme entrees.

Le `README.md` documente le format : les quatre types de blocs, la liste des sources
autorisees, les trois modes d'`overflow`, les conditions `visibleIf`, et la marche a
suivre (deposer `assets/apercu.png`, puis `make pack-badge-template NAME=<nom>`).

Garde-fous : `name` doit matcher `/^[a-z0-9]+(-[a-z0-9]+)*$/`, et le dossier cible ne doit
pas exister.

Le point d'entree CLI, entoure de `/* v8 ignore start */` … `/* v8 ignore stop */` comme
`scripts/migrate-badge-template-refs.ts`, lit `process.env.NAME` et echoue avec un message
clair s'il est absent.

- [ ] **Step 4 : Ajouter la cible Makefile**

```make
# v4 (spec 14) : cree un squelette de template dans badge-templates/<NAME>/ (atelier
# gitignore, distinct de prisma/badge-templates/ qui contient les paquets de reference).
new-badge-template:
	docker compose -f docker-compose.dev.yml exec -e NAME=$(NAME) app yarn tsx scripts/new-badge-template.ts
```

Ajouter `new-badge-template` a la liste `.PHONY`.

- [ ] **Step 5 : Ignorer l'atelier**

Dans `.gitignore` :

```
# v4 (spec 14) : atelier de creation de templates (make new-badge-template).
# Les paquets de reference versionnes vivent dans prisma/badge-templates/.
/badge-templates/
```

- [ ] **Step 6 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/new-badge-template.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7 : Essayer la commande**

Run: `make new-badge-template NAME=essai-2027`
Expected: `badge-templates/essai-2027/` contient `manifest.json`, `README.md` et `assets/`.

- [ ] **Step 8 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 9 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add scripts Makefile .gitignore
git commit -m "feat(v4): generation d'un squelette de template de badge"
```

---

## Task 5 : Commande d'empaquetage

**Files:**
- Create: `scripts/pack-badge-template.ts`
- Create: `scripts/__tests__/pack-badge-template.test.ts`
- Modify: `Makefile` (nouvelle cible + `.PHONY`)

**Interfaces:**
- Consomme : `createSkeleton` (Task 4) pour les tests, `parseManifest`, `readTemplatePackage`.
- Produit : `packTemplate(name: string, root: string): Promise<string>` — rend le chemin de
  l'archive produite, ou leve si le manifeste est invalide.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkeleton } from "../new-badge-template";
import { packTemplate } from "../pack-badge-template";
import { readTemplatePackage } from "@/lib/badge-templates/package-reader";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let racine: string;

afterEach(() => {
  if (racine && existsSync(racine)) rmSync(racine, { recursive: true, force: true });
});

describe("packTemplate", () => {
  it("produit une archive installable depuis un squelette complete", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "assets", "apercu.png"), PNG);

    const zip = await packTemplate("salon-2027", racine);
    expect(existsSync(zip)).toBe(true);

    // L'archive produite doit franchir exactement les controles du televersement.
    const lu = await readTemplatePackage(readFileSync(zip));
    expect(lu.ok, lu.ok === false ? lu.errors.join(" | ") : "").toBe(true);
    expect(lu.ok === true && lu.manifest.family).toBe("salon-2027");
  });

  it("refuse d'empaqueter un manifeste invalide", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ formatVersion: 9 }));

    await expect(packTemplate("salon-2027", racine)).rejects.toThrow(/invalide/i);
  });

  it("refuse d'empaqueter un dossier inexistant", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    await expect(packTemplate("absent", racine)).rejects.toThrow(/introuvable/i);
  });

  it("signale un apercu declare mais absent du dossier", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    createSkeleton("salon-2027", racine);
    // L'image n'est pas deposee : le squelette la declare pourtant.
    await expect(packTemplate("salon-2027", racine)).rejects.toThrow(/apercu|aperçu/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/pack-badge-template.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implementer**

`packTemplate` lit le dossier, collecte `manifest.json`, `assets/*` et `fonts/*`, appelle
`parseManifest` avec la liste des chemins collectes — ce qui detecte a la fois un manifeste
mal forme et un `preview` declare sans fichier — puis construit l'archive avec `jszip` et
l'ecrit dans `<root>/<name>.zip`.

Levees explicites : dossier introuvable, manifeste invalide (message reprenant les erreurs
de `parseManifest`).

Point d'entree CLI entoure de `/* v8 ignore start */` … `/* v8 ignore stop */`, lisant
`process.env.NAME`.

- [ ] **Step 4 : Ajouter la cible Makefile**

```make
# v4 (spec 14) : empaquette badge-templates/<NAME>/ en une archive installable.
# Valide le manifeste avant d'ecrire l'archive : mieux vaut echouer ici qu'au televersement.
pack-badge-template:
	docker compose -f docker-compose.dev.yml exec -e NAME=$(NAME) app yarn tsx scripts/pack-badge-template.ts
```

Ajouter `pack-badge-template` a la liste `.PHONY`.

- [ ] **Step 5 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/pack-badge-template.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6 : Essayer le cycle complet**

```bash
make new-badge-template NAME=essai-2027
# deposer une image dans badge-templates/essai-2027/assets/apercu.png
make pack-badge-template NAME=essai-2027
```

Puis installer `badge-templates/essai-2027.zip` depuis `/platform/badge-templates` et
verifier que l'image apparait comme vignette au catalogue.

- [ ] **Step 7 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 8 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add scripts Makefile
git commit -m "feat(v4): empaquetage d'un template de badge"
```

---

## Task 6 : E2E et documentation

**Files:**
- Modify: `e2e/platform/badge-templates.spec.ts`
- Modify: `docs/v4/features/templates-badges.md`
- Modify: `docs/v4/installation.md`

- [ ] **Step 1 : Adapter la spec E2E**

Le helper `manifestOf(family)` du fichier ne declare pas d'apercu : les templates installes
par les tests afficheront donc le placeholder. Ajouter un test qui couvre le cas contraire :

```ts
test("un template qui fournit une image l'affiche au catalogue", async ({ page }) => {
  const family = `e2e-image-${Date.now()}`;
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const manifest = JSON.parse(manifestOf(family));
  manifest.preview = "assets/apercu.png";

  const archive = await writeArchive(`${family}.zip`, {
    "manifest.json": JSON.stringify(manifest),
    "assets/apercu.png": PNG,
  });

  const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-image" });
  await loginAs(page, staff);

  await page.goto("/platform/badge-templates");
  await page.setInputFiles('input[type="file"]', archive);
  await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

  const prisma = getDb();
  const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });
  expect(installed?.previewPath).toBe(`badge-templates/${installed!.id}/assets/apercu.png`);
  expect(installed?.proofPath).toBeTruthy();

  await page.goto(`/platform/badge-templates/${installed!.id}`);
  await expect(page.getByRole("link", { name: /pdf d'épreuve/i })).toBeVisible();
});
```

- [ ] **Step 2 : Lancer les tests**

Run: `docker compose -f docker-compose.dev.yml exec -T -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/badge-templates.spec.ts`
Expected: 6 tests verts. En cas d'echec sur un selecteur, corriger le **test** d'apres le
composant reel.

- [ ] **Step 3 : Mettre a jour la fiche feature**

Dans `docs/v4/features/templates-badges.md` : le champ `preview` dans le manifeste, la
distinction entre l'image d'apercu (fournie, affichee) et le PDF d'epreuve (produit,
telechargeable), et la section « Creer un template » decrivant les deux commandes.

- [ ] **Step 4 : Mettre a jour la doc d'installation**

Ajouter les deux cibles au tableau des commandes de `docs/v4/installation.md`.

- [ ] **Step 5 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add e2e docs
git commit -m "test(v4): couverture de l'apercu en image et des commandes de template"
```
