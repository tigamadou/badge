# Page de detail d'un template de badge — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-13-v4-page-de-detail-d-un-template-de-badge.md`](../specs/2026-08-11-13-v4-page-de-detail-d-un-template-de-badge.md)
**Depend de :** plans 11 et 12 (catalogue installe, registre retire).

**Goal:** Donner au staff un ecran de detail par template installe, montrant son apercu, qui l'utilise, ses versions successives, ses ressources et son manifeste.

**Architecture:** Un Server Component `/platform/badge-templates/[id]` agrege quatre lectures — la ligne elle-meme, les references qui la designent, les versions de sa famille, et les objets stockes sous son prefixe. Le composant d'apercu quitte `BadgeTemplatePicker` pour `src/components/ui/`, ou il devient partage entre le selecteur, la liste et le detail. Le telechargement du manifeste se fait cote client depuis le JSON deja rendu, sans route API.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript 5, Prisma 6, `@aws-sdk/client-s3` via `src/lib/storage.ts`, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » ne valent pas autorisation.
2. **Aucune modification de `src/` pour faire passer un test.**
3. **Page en lecture seule.** Aucune action mutante : l'archivage reste sur la liste (`BadgeTemplateArchiveButton` et la route PATCH sont inchanges).
4. **Acces : tout staff.** Le layout `/platform` porte deja la garde ; ne pas ajouter de controle de role.
5. **Seuils de couverture = gate a 100%** sur `src/lib/**` et `src/app/api/**`. Les composants React ne sont pas couverts par l'unitaire (politique de tests, section 1) : l'ecran est valide par l'E2E.
6. **Aucune migration Prisma.** Ce plan ne touche pas `schema.prisma`.
7. **Contrat E2E strict :** zero `page.request.*`, connexion via les helpers, URL assertee a chaque etape.
8. **Base de tests partagee :** `make test` vide la base de dev. Relancer `make db-seed` avant toute verification navigateur.
9. **Langue :** UI et documentation en francais accentue ; identifiants et types en anglais ASCII.
10. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`, plus verification navigateur pour les changements UI.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | `listPrefix` dans le stockage | [x] | 2026-08-11 | 2 tests ; meme motif de pagination que `deletePrefix` |
| 2 | Extraction du composant d'apercu | [x] | 2026-08-11 | Aucun test modifie : comportement identique |
| 3 | Page de detail | [x] | 2026-08-11 | Six sections ; l'apercu est filtre de la liste des ressources |
| 4 | Telechargement du manifeste | [x] | 2026-08-11 | Cote client, aucune route API |
| 5 | Vignette et lien sur la liste | [x] | 2026-08-11 | Le lien porte sur le libelle seul, pour ne pas englober le bouton d'archivage |
| 6 | E2E et documentation | [x] | 2026-08-11 | 5 tests e2e verts (2 nouveaux) |

### Note d'execution (2026-08-11)

Aucun ecart au plan. Un detail d'implementation merite d'etre signale : l'apercu
(`preview.pdf`) vit sous le meme prefixe de stockage que les ressources du paquet. La
section « Ressources embarquees » le filtre explicitement — ce n'est pas une ressource du
paquet, et l'afficher aurait laisse croire que les templates livres en embarquent une.

---

## Etat initial (constate le 2026-08-11)

- `src/app/platform/badge-templates/page.tsx` : liste toutes les lignes (`orderBy family asc, version desc`), affiche libelle, famille, version, dimensions, date et etat. **Aucun apercu, aucun lien vers un detail.**
- `src/components/admin/BadgeTemplatePicker.tsx:40` : `TemplatePreview({ src, label })`, non exporte, gere trois cas — image, PDF via `<object>`, vignette neutre.
- `src/lib/badge-templates/resolve.ts` : `previewUrl(previewPath)` rend `/api/files/<path>` ou `""`.
- `src/lib/storage.ts:123` : `deletePrefix` utilise deja `ListObjectsV2Command` avec pagination et porte un `/* v8 ignore */` sur la branche `IsTruncated`. **Motif a reprendre pour `listPrefix`.**
- `src/app/platform/profiles/[userId]/page.tsx` : motif d'une page de detail plateforme (Server Component, `params: Promise<{...}>`, `notFound()` si absent).
- `src/app/api/files/[...path]/route.ts` : sert les cles `badge-templates/` sans session (non sensibles).
- Modele `InstalledBadgeTemplate` : `id`, `family`, `version`, `label`, `description`, `pages`, `pageWidthMm`, `pageHeightMm`, `layout`, `assetPrefix`, `previewPath`, `formatVersion`, `installedById`, `archived`, `archivedAt`, `createdAt`.

---

## Task 1 : `listPrefix` dans le stockage

**Files:**
- Modify: `src/lib/storage.ts` (apres `deletePrefix`, l.140)
- Modify: `src/lib/__tests__/storage.test.ts` (verifier le nom exact du fichier de tests par `ls src/lib/__tests__/ | grep storage`)

**Interfaces:**
- Consomme : rien.
- Produit : `listPrefix(prefix: string): Promise<Array<{ key: string; size: number }>>`, consomme par la Task 3.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
import { describe, it, expect } from "vitest";
import { uploadFile, listPrefix, deletePrefix } from "@/lib/storage";

describe("listPrefix", () => {
  it("rend une liste vide pour un prefixe inconnu", async () => {
    expect(await listPrefix(`badge-templates/vide-${Date.now()}/`)).toEqual([]);
  });

  it("liste les objets d'un prefixe avec leur poids", async () => {
    const prefix = `badge-templates/list-${Date.now()}/`;
    await uploadFile(`${prefix}assets/a.png`, Buffer.alloc(10, 1), "image/png");
    await uploadFile(`${prefix}assets/b.png`, Buffer.alloc(20, 2), "image/png");

    const objets = await listPrefix(prefix);
    expect(objets).toHaveLength(2);
    expect(objets.map((o) => o.key).sort()).toEqual([
      `${prefix}assets/a.png`,
      `${prefix}assets/b.png`,
    ]);
    expect(objets.find((o) => o.key.endsWith("a.png"))?.size).toBe(10);

    await deletePrefix(prefix);
  });
});
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils echouent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/__tests__/storage.test.ts`
Expected: FAIL — `listPrefix` n'est pas exporte.

- [ ] **Step 3 : Implementer**

Dans `src/lib/storage.ts`, apres `deletePrefix` :

```ts
// Liste les objets sous un prefixe, avec leur poids. Meme motif de pagination que
// deletePrefix, dont la branche IsTruncated est egalement inatteignable en unitaire.
export async function listPrefix(prefix: string): Promise<Array<{ key: string; size: number }>> {
  await ensureBucket();
  const out: Array<{ key: string; size: number }> = [];
  let token: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    for (const o of list.Contents ?? []) {
      out.push({ key: o.Key!, size: o.Size ?? 0 });
    }
    /* v8 ignore next -- branche IsTruncated=true : exige >1000 objets sous un prefixe (impraticable en unitaire) */
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return out;
}
```

- [ ] **Step 4 : Lancer les tests et verifier qu'ils passent**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/__tests__/storage.test.ts`
Expected: PASS.

- [ ] **Step 5 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/lib/storage.ts src/lib/__tests__
git commit -m "feat(v4): listage des objets d'un prefixe de stockage"
```

---

## Task 2 : Extraction du composant d'apercu

**Files:**
- Create: `src/components/ui/TemplatePreview.tsx`
- Modify: `src/components/admin/BadgeTemplatePicker.tsx` (retrait de la fonction locale l.40-64, ajout de l'import)

**Interfaces:**
- Consomme : rien.
- Produit : `<TemplatePreview src={string} label={string} />`, consomme par les Tasks 3 et 5.

- [ ] **Step 1 : Deplacer le composant**

Creer `src/components/ui/TemplatePreview.tsx` avec le contenu **exact** de la fonction
locale de `BadgeTemplatePicker.tsx:40-64`, exporte :

```tsx
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";

// Trois origines d'apercu : une image, un PDF d'epreuve servi depuis le stockage
// (templates installes), ou rien du tout. Un PDF ne passe pas par next/image, d'ou
// l'aiguillage. Partage entre le selecteur, le catalogue et la page de detail.
export function TemplatePreview({ src, label }: { src: string; label: string }) {
  if (!src) {
    return (
      <span className="flex flex-col items-center gap-1 text-slate-400">
        <Icon name="id-card" size={28} />
        <span className="text-xs">Aperçu indisponible</span>
      </span>
    );
  }

  if (src.endsWith(".pdf")) {
    return (
      <object data={src} type="application/pdf" className="h-full w-full" aria-label={`Aperçu ${label}`}>
        <a href={src} className="text-xs text-green-700 underline">
          Ouvrir l&apos;aperçu PDF
        </a>
      </object>
    );
  }

  return (
    <Image src={src} alt={`Aperçu ${label}`} width={400} height={300} className="object-contain" />
  );
}
```

- [ ] **Step 2 : Adapter le selecteur**

Dans `BadgeTemplatePicker.tsx` : supprimer la fonction locale, ajouter
`import { TemplatePreview } from "@/components/ui/TemplatePreview";`, et retirer l'import
`Image` s'il n'est plus utilise ailleurs dans le fichier (le lint le signalera).

- [ ] **Step 3 : Verifier l'absence de regression**

Run: `make lint && make typecheck && make test`
Expected: tout passe. **Aucun test ne doit changer** : le comportement est identique.

Run: `docker compose -f docker-compose.dev.yml exec -T -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/badge-templates.spec.ts`
Expected: 3 tests verts — le selecteur rend toujours l'apercu.

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/components/ui/TemplatePreview.tsx src/components/admin/BadgeTemplatePicker.tsx
git commit -m "refactor(v4): apercu de template en composant partage"
```

---

## Task 3 : Page de detail

**Files:**
- Create: `src/app/platform/badge-templates/[id]/page.tsx`

**Interfaces:**
- Consomme : `listPrefix` (Task 1), `TemplatePreview` (Task 2), `previewUrl` de `@/lib/badge-templates/resolve`.
- Produit : la route `/platform/badge-templates/[id]`, ciblee par les Tasks 4, 5 et 6.

- [ ] **Step 1 : Ecrire la page**

Server Component. Reprendre le motif de `src/app/platform/profiles/[userId]/page.tsx` :
`params: Promise<{ id: string }>`, `notFound()` si la ligne est absente.

Les quatre lectures, en parallele :

```tsx
const template = await prisma.installedBadgeTemplate.findUnique({ where: { id } });
if (!template) notFound();

const [events, orgs, platformCount, versions, objets] = await Promise.all([
  prisma.event.findMany({
    where: { badgeTemplateId: id },
    select: { id: true, title: true, orgId: true },
    orderBy: { title: "asc" },
  }),
  prisma.organization.findMany({
    where: { badgeTemplateId: id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }),
  prisma.platformSettings.count({ where: { badgeTemplateId: id } }),
  prisma.installedBadgeTemplate.findMany({
    where: { family: template.family },
    orderBy: { version: "desc" },
    select: { id: true, version: true, archived: true, createdAt: true },
  }),
  listPrefix(template.assetPrefix),
]);
```

Les six sections de la spec, dans l'ordre. Points d'attention :

- **Apercu** : `<TemplatePreview src={previewUrl(template.previewPath)} label={template.label} />`
  dans un cadre plus large que celui du selecteur, plus un lien « Ouvrir en plein ecran »
  vers `previewUrl(template.previewPath)` avec `target="_blank"`, affiche seulement si un
  apercu existe.
- **Utilise par** : afficher le total (`events.length + orgs.length + platformCount`), puis
  les listes. Un total de zero affiche « Aucun evenement ni organisation n'utilise cette
  version » — c'est une information utile, pas un etat vide a masquer.
- **Versions** : marquer la version courante (la premiere du tableau, `version` le plus
  eleve et non archivee) et lier chaque autre vers `/platform/badge-templates/<id>`.
- **Ressources** : **masquer entierement la section** si `objets` ne contient que l'apercu
  (`preview.pdf`) ou est vide. Filtrer l'apercu de la liste : ce n'est pas une ressource du
  paquet. Afficher le poids en kilo-octets.
- **Manifeste** : `JSON.stringify(template.layout, null, 2)` dans un `<pre>` defilant
  (`max-h-96 overflow-auto`).

- [ ] **Step 2 : Verifier dans le navigateur**

Apres `make db-seed`, ouvrir `https://badge.local/platform/badge-templates`, puis le detail
d'un template livre. Verifier : l'apercu s'affiche, les deux versions de la famille
apparaissent, la section des ressources est **absente** (aucun paquet livre n'en a), le
manifeste est lisible.

- [ ] **Step 3 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/platform/badge-templates
git commit -m "feat(v4): page de detail d'un template de badge"
```

---

## Task 4 : Telechargement du manifeste

**Files:**
- Create: `src/components/staff/ManifestDownloadButton.tsx`
- Modify: `src/app/platform/badge-templates/[id]/page.tsx` (section Manifeste)

**Interfaces:**
- Consomme : rien.
- Produit : `<ManifestDownloadButton json={string} filename={string} />`.

- [ ] **Step 1 : Ecrire le composant**

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Telechargement cote client depuis le JSON deja rendu par le serveur : aucune route
// API a garder, et le layout est deja dans la page.
export function ManifestDownloadButton({ json, filename }: { json: string; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={download} className="flex items-center gap-1.5">
      <Icon name="download" size={15} /> Télécharger le manifeste
    </Button>
  );
}
```

`download` est bien dans la liste des icones (`src/components/ui/Icon.tsx`) — verifie le
2026-08-11.

- [ ] **Step 2 : Brancher dans la page**

Dans la section Manifeste :

```tsx
<ManifestDownloadButton
  json={JSON.stringify(template.layout, null, 2)}
  filename={`${template.family}-v${template.version}.json`}
/>
```

- [ ] **Step 3 : Verifier dans le navigateur**

Telecharger le manifeste depuis la page de detail et confirmer que le fichier obtenu est
un JSON valide portant le bon nom.

- [ ] **Step 4 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/components/staff/ManifestDownloadButton.tsx src/app/platform/badge-templates
git commit -m "feat(v4): telechargement du manifeste d'un template"
```

---

## Task 5 : Vignette et lien sur la liste

**Files:**
- Modify: `src/app/platform/badge-templates/page.tsx`

**Interfaces:**
- Consomme : `TemplatePreview` (Task 2), `previewUrl`, la route de la Task 3.
- Produit : rien.

- [ ] **Step 1 : Ajouter la vignette et le lien**

Chaque ligne du catalogue gagne une vignette d'apercu (cadre reduit, environ 96 px de
large) et son libelle devient un lien vers `/platform/badge-templates/<id>`.

Conserver le bouton d'archivage en place : il reste l'action de la liste (contrainte 3).
Veiller a ce que le lien n'englobe pas le bouton, sinon un clic sur « Archiver »
naviguerait.

- [ ] **Step 2 : Verifier dans le navigateur**

Sur `https://badge.local/platform/badge-templates` : les vignettes s'affichent, un clic sur
le libelle ouvre le detail, un clic sur « Archiver » archive sans naviguer.

- [ ] **Step 3 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add src/app/platform/badge-templates/page.tsx
git commit -m "feat(v4): apercu et lien de detail au catalogue"
```

---

## Task 6 : E2E et documentation

**Files:**
- Modify: `e2e/platform/badge-templates.spec.ts`
- Modify: `docs/v4/features/templates-badges.md`

- [ ] **Step 1 : Ajouter la spec E2E**

Dans la `describe` existante, apres le test d'installation :

```ts
test("le detail d'un template montre son apercu, ses versions et son usage", async ({ page }) => {
  const family = `e2e-detail-${Date.now()}`;
  const archive = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });

  const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-detail" });
  await loginAs(page, staff);

  await page.goto("/platform/badge-templates");
  await page.setInputFiles('input[type="file"]', archive);
  await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

  const prisma = getDb();
  const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });

  await page.goto(`/platform/badge-templates/${installed!.id}`);
  await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
  await expect(page.getByRole("heading", { name: /badge e2e/i })).toBeVisible();

  // Aucun evenement ne l'utilise encore : l'information doit etre affichee, pas masquee.
  await expect(page.getByText(/aucun évènement|aucun événement/i)).toBeVisible();

  // Le manifeste est visible et telechargeable.
  await expect(page.getByRole("button", { name: /télécharger le manifeste/i })).toBeVisible();
});

test("le detail liste les evenements qui utilisent le template", async ({ page }) => {
  const family = `e2e-usage-${Date.now()}`;
  const archive = await writeArchive(`${family}.zip`, { "manifest.json": manifestOf(family) });

  const staff = await createTestStaff({ role: "STAFF_ADMIN", scope: "bt-usage" });
  await loginAs(page, staff);

  await page.goto("/platform/badge-templates");
  await page.setInputFiles('input[type="file"]', archive);
  await expect(page.getByTestId("install-success")).toBeVisible({ timeout: 15_000 });

  const prisma = getDb();
  const installed = await prisma.installedBadgeTemplate.findFirst({ where: { family } });

  // Un evenement adopte ce template : le detail doit le nommer.
  const { eventId } = await createTestEvent({ scope: "bt-usage" });
  await prisma.event.update({
    where: { id: eventId },
    data: { badgeTemplateId: installed!.id },
  });
  const evenement = await prisma.event.findUnique({ where: { id: eventId } });

  await page.goto(`/platform/badge-templates/${installed!.id}`);
  await expect(page).toHaveURL(new RegExp(`/platform/badge-templates/${installed!.id}`));
  await expect(page.getByText(evenement!.title)).toBeVisible();
});
```

- [ ] **Step 2 : Lancer les tests**

Run: `docker compose -f docker-compose.dev.yml exec -T -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/badge-templates.spec.ts`
Expected: 5 tests verts. En cas d'echec sur un selecteur, corriger le **test** d'apres le
composant reel.

- [ ] **Step 3 : Mettre a jour la documentation**

Dans `docs/v4/features/templates-badges.md`, section « Aperçu » : mentionner l'ecran de
detail `/platform/badge-templates/<id>` et ce qu'on y trouve (apercu, usage, versions de la
famille, ressources, manifeste telechargeable).

- [ ] **Step 4 : Verifier**

Run: `make lint && make typecheck && make test`

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add e2e/platform/badge-templates.spec.ts docs/v4
git commit -m "test(v4): couverture e2e du detail d'un template"
```
