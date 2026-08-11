# Bascule des templates livres et retrait du registre code — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-08-11-12-v4-bascule-des-templates-livres-et-retrait-du-registre.md`](../specs/2026-08-11-12-v4-bascule-des-templates-livres-et-retrait-du-registre.md)
**Depend de :** plans 10 et 11.
**Troisieme de trois plans** : [10] format et moteur → [11] catalogue et installation → **[12] bascule et retrait**

> ## Condition d'entree — a verifier AVANT la Task 1
>
> Les huit tests de fidelite du plan 10 (Task 6) doivent passer :
>
> ```
> docker compose -f docker-compose.dev.yml exec -T app \
>   yarn vitest run src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx
> ```
>
> **Si un seul echoue, ne pas engager ce plan.** C'est le seul des trois qui retire
> quelque chose, donc le seul qui peut degrader des badges deja en circulation. La
> preuve de fidelite est le filet ; on ne le retire pas avant de l'avoir teste.

**Goal:** Faire de `default-v1` et `recto-verso-v1` des templates installes comme les autres, puis supprimer le registre code pour ne laisser qu'un seul chemin de rendu.

**Architecture:** Les deux manifestes de reference, deja ecrits et prouves fideles au plan 10, sont promus en donnees de seed sous `prisma/badge-templates/<famille>/`. Le seed les installe par le **meme chemin de code que l'installation** (validation, rendu d'epreuve, apercu), de facon idempotente. Un script convertit les references existantes, puis le registre `BADGE_TEMPLATES` et tout ce qui en depend disparaissent.

**Tech Stack:** TypeScript 5, Prisma 6 / MySQL 8, `tsx` pour les scripts, Vitest 4, Playwright.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.**
2. **Aucune modification de `src/` pour faire passer un test.**
3. **Condition d'entree ci-dessus respectee.**
4. **Le seed est idempotent** : deux executions ne creent jamais une version supplementaire. Une divergence d'environnement serait pire que l'absence de template.
5. **Le seed passe par le chemin d'installation**, sans court-circuit de validation ni de rendu d'epreuve : un template de base n'est pas un cas privilegie.
6. **Aucune migration de donnees automatique en production.** L'application n'est pas en production ; le script de migration sert aux bases de developpement deja peuplees.
7. **Seuils de couverture = gate a 100%** sur `src/lib/**` et `src/app/api/**`.
8. **Langue :** UI, messages et documentation en francais accentue ; identifiants et types en anglais ASCII.
9. **Verification avant de declarer une task terminee :** `make lint && make typecheck && make test`.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Paquets de reference dans le depot | [ ] | | Promus depuis les fixtures du plan 10 |
| 2 | Seed idempotent | [ ] | | Deplace la garantie du defaut de colonne vers le seed |
| 3 | Script de migration des references | [ ] | | |
| 4 | Retrait du registre code | [ ] | | Le point de non-retour |
| 5 | Nettoyage des outils du registre | [ ] | | `copy-badge-previews`, `prebuild`, script de validation |
| 6 | Documentation | [ ] | | |

---

## Etat initial (constate le 2026-08-11)

- `src/lib/badge-templates/index.ts` : `BADGE_TEMPLATES` (l.13), `getTemplate` (l.20), `listTemplates` (l.24), `DEFAULT_TEMPLATE_ID` (l.30).
- `prisma/schema.prisma:411` : `PlatformSettings.badgeTemplateId String @default("default-v1")`, precede du commentaire « NOT NULL avec default -- garantit que resolveBadgeTemplateId renvoie toujours ».
- `scripts/copy-badge-previews.ts` : copie `src/lib/badge-templates/<id>/preview.png` vers `public/badge-previews/<id>.png`, appele par le hook `prebuild` (`package.json:7`).
- `scripts/validate-badge-templates.ts:7,18` : verifie qu'aucune ligne en base ne reference un id absent de `BADGE_TEMPLATES`. Cible `make validate-badge-templates` (`Makefile:334`).
- Apres le plan 11, plus aucun fichier applicatif n'appelle `getTemplate` ou `listTemplates` directement : tout passe par `resolve.ts`.

---

## Task 1 : Paquets de reference dans le depot

**Files:**
- Create: `prisma/badge-templates/default/manifest.json`
- Create: `prisma/badge-templates/recto-verso/manifest.json`
- Create: `src/lib/badge-templates/__tests__/reference-packages.test.ts`

**Interfaces:**
- Consomme : les fixtures du plan 10 (`declarative/__fixtures__/default.json` et `recto-verso.json`).
- Produit : les deux manifestes de seed, consommes par les Tasks 2 et 3.

- [ ] **Step 1 : Copier les manifestes**

Copier les deux fixtures vers `prisma/badge-templates/<famille>/manifest.json`. Les deux familles historiques n'embarquent **aucune ressource** : chaque dossier ne contient que son manifeste.

- [ ] **Step 2 : Ecrire le test d'egalite en echec**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Les manifestes de seed et les fixtures de fidelite decrivent les MEMES badges.
// S'ils divergent, le seed installerait un template que rien n'a prouve fidele.
const PAIRS = [
  ["default", "src/lib/badge-templates/declarative/__fixtures__/default.json"],
  ["recto-verso", "src/lib/badge-templates/declarative/__fixtures__/recto-verso.json"],
] as const;

describe("paquets de reference", () => {
  for (const [family, fixture] of PAIRS) {
    it(`${family} : le manifeste de seed est identique a la fixture de fidelite`, () => {
      const seed = JSON.parse(readFileSync(resolve(`prisma/badge-templates/${family}/manifest.json`), "utf8"));
      const ref = JSON.parse(readFileSync(resolve(fixture), "utf8"));
      expect(seed).toEqual(ref);
    });
  }
});
```

- [ ] **Step 3 : Lancer le test**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run src/lib/badge-templates/__tests__/reference-packages.test.ts`
Expected: PASS, 2 tests. S'il echoue, c'est la copie de l'etape 1 qui est en cause.

- [ ] **Step 4 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add prisma/badge-templates src/lib/badge-templates/__tests__
git commit -m "feat(v4): manifestes de reference des templates livres"
```

---

## Task 2 : Seed idempotent

**Files:**
- Create: `src/lib/badge-templates/install.ts`
- Modify: `prisma/seed.ts`
- Modify: `prisma/schema.prisma` (l.409-411 : retrait du `@default`)
- Create: `src/lib/badge-templates/__tests__/install.test.ts`

**Interfaces:**
- Consomme : `parseManifest`, `renderProof`, `uploadFile`.
- Produit :

```ts
// Chemin d'installation commun a la route POST et au seed. `assets` est vide pour
// un paquet de reference, non vide pour une archive televersee.
export async function installTemplate(args: {
  manifest: TemplateManifest;
  assets: PackageAsset[];
  installedById: string;
}): Promise<{ id: string; family: string; version: number }>;

export async function ensureReferenceTemplates(installedById: string): Promise<void>;
```

- [ ] **Step 1 : Extraire le chemin d'installation**

La Task 5 du plan 11 a implemente la sequence d'installation dans la route. L'extraire telle quelle dans `installTemplate`, et faire appeler cette fonction par la route. **Aucun changement de comportement** : les tests de la route doivent passer sans modification.

- [ ] **Step 2 : Ecrire les tests d'idempotence en echec**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates } from "../install";

describe("ensureReferenceTemplates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("installe les deux familles de reference", async () => {
    await ensureReferenceTemplates("seed");
    const families = await prisma.installedBadgeTemplate.findMany({ select: { family: true } });
    expect(families.map((f) => f.family).sort()).toEqual(["default", "recto-verso"]);
  });

  it("est idempotent : deux executions ne creent pas de version supplementaire", async () => {
    await ensureReferenceTemplates("seed");
    await ensureReferenceTemplates("seed");
    const count = await prisma.installedBadgeTemplate.count();
    expect(count).toBe(2);
  });

  it("laisse intacte une famille deja installee", async () => {
    await ensureReferenceTemplates("seed");
    const before = await prisma.installedBadgeTemplate.findFirst({ where: { family: "default" } });
    await ensureReferenceTemplates("seed");
    const after = await prisma.installedBadgeTemplate.findFirst({ where: { family: "default" } });
    expect(after!.id).toBe(before!.id);
  });
});
```

- [ ] **Step 3 : Implementer**

`ensureReferenceTemplates` lit les deux dossiers de `prisma/badge-templates/`, et pour chaque famille **absente** de la base appelle `installTemplate`. Une famille deja presente est ignoree sans lecture ni rendu.

- [ ] **Step 4 : Brancher le seed**

Dans `prisma/seed.ts`, apres la creation de `PlatformSettings` (l.222-238) :

```ts
  // v4 (plan 12) : les templates de base sont installes, plus compiles. Le seed
  // porte desormais la garantie qu'un template par defaut existe toujours --
  // garantie qui vivait dans le @default("default-v1") de la colonne.
  await ensureReferenceTemplates(adminUserId);

  const defaultTemplate = await prisma.installedBadgeTemplate.findFirst({
    where: { family: "default", archived: false },
    orderBy: { version: "desc" },
  });
  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const pointsToExisting =
    settings && (await prisma.installedBadgeTemplate.count({ where: { id: settings.badgeTemplateId } })) > 0;
  if (!pointsToExisting && defaultTemplate) {
    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { badgeTemplateId: defaultTemplate.id },
    });
  }
```

`adminUserId` est l'identifiant du staff seede : le reprendre depuis la section qui cree `admin@badge.local`, plus haut dans le fichier.

- [ ] **Step 5 : Retirer le defaut de colonne**

Dans `prisma/schema.prisma`, l.409-411, remplacer le commentaire et le `@default` :

```prisma
  // v4 (plan 12) : plus de @default litteral -- l'identifiant designe desormais une
  // ligne InstalledBadgeTemplate. La garantie qu'un template par defaut existe est
  // portee par le seed (ensureReferenceTemplates), pas par la colonne.
  badgeTemplateId    String
```

Run: `make db-push` puis `make db-seed`.

- [ ] **Step 6 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe. Verifier en base qu'apres seed, `PlatformSettings.badgeTemplateId` designe bien une ligne existante.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add prisma src/lib/badge-templates
git commit -m "feat(v4): installation des templates de reference par le seed"
```

---

## Task 3 : Script de migration des references

**Files:**
- Create: `scripts/migrate-badge-template-refs.ts`
- Create: `scripts/__tests__/migrate-badge-template-refs.test.ts`
- Modify: `Makefile` (nouvelle cible)

**Interfaces:**
- Consomme : `ensureReferenceTemplates` (Task 2).
- Produit : une fonction exportee `migrateRefs(): Promise<{ events: number; orgs: number; platform: number; unknown: string[] }>`, testable sans passer par la ligne de commande.

- [ ] **Step 1 : Ecrire les tests en echec**

```ts
it("convertit default-v1 en cuid dans les trois colonnes", async () => {});
it("convertit recto-verso-v1", async () => {});
it("est idempotent : une seconde execution ne change rien", async () => {});
it("signale une valeur inconnue sans interrompre", async () => {});
```

- [ ] **Step 2 : Lancer et verifier l'echec**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/migrate-badge-template-refs.test.ts`

- [ ] **Step 3 : Implementer**

Le script appelle `ensureReferenceTemplates`, construit la correspondance
`{ "default-v1": <cuid default>, "recto-verso-v1": <cuid recto-verso> }`, applique un
`updateMany` par ancienne valeur sur `Event.badgeTemplateId`,
`Organization.badgeTemplateId` et `PlatformSettings.badgeTemplateId`, puis liste les
valeurs restantes qui ne correspondent a aucune ligne installee. Il journalise le
nombre de lignes touchees par colonne.

- [ ] **Step 4 : Ajouter la cible Makefile**

```make
migrate-badge-template-refs:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/migrate-badge-template-refs.ts
```

Ajouter la cible a la liste `.PHONY` (`Makefile:8`).

- [ ] **Step 5 : Lancer les tests puis le script**

Run: `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run scripts/__tests__/migrate-badge-template-refs.test.ts`
Run: `make migrate-badge-template-refs`
Expected: le rapport indique le nombre de lignes converties et **aucune** valeur inconnue.

- [ ] **Step 6 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add scripts Makefile
git commit -m "feat(v4): migration des references de template vers le catalogue"
```

---

## Task 4 : Retrait du registre code

**Files:**
- Delete: `src/lib/badge-templates/index.ts`
- Delete: `src/lib/badge-templates/default-v1/`
- Delete: `src/lib/badge-templates/recto-verso-v1/`
- Delete: `src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx`
- Modify: `src/lib/badge-templates/resolve.ts`
- Modify: `src/lib/badge-templates/__tests__/resolve.test.ts`

**Interfaces:**
- Consomme : tout ce qui precede.
- Produit : `resolveTemplate` et `listAvailableTemplates` n'interrogent plus que la base.

- [ ] **Step 1 : Adapter la resolution**

Dans `resolve.ts`, retirer la consultation du registre. Le repli ne vise plus une
constante mais la version courante de la famille `default` :

```ts
// v4 (plan 12) : le repli ne peut plus viser une constante de code. Il vise la
// famille `default`, dont le seed garantit l'existence (ensureReferenceTemplates).
async function fallbackTemplate(): Promise<BadgeTemplate> {
  const row = await prisma.installedBadgeTemplate.findFirst({
    where: { family: "default" },
    orderBy: { version: "desc" },
  });
  if (!row) {
    throw new Error(
      "resolveTemplate : aucune famille `default` en base. Le seed n'a pas ete execute (make db-seed).",
    );
  }
  return buildFromRow(row);
}
```

L'echec est **explicite** : une base sans template est une anomalie d'exploitation qu'il vaut mieux voir echouer bruyamment qu'imprimer un badge vide.

- [ ] **Step 2 : Adapter les tests de resolution**

Dans `resolve.test.ts`, les cas « resout un identifiant du registre code » et
« inclut les templates du registre » n'ont plus d'objet. Les remplacer par :

```ts
it("retombe sur la famille default pour un identifiant inconnu", async () => {});
it("leve explicitement si aucune famille default n'existe", async () => {});
```

Les autres cas — template installe actif, **template archive qui resout**, une seule
version par famille — restent inchanges et sont la garantie de non-regression.

- [ ] **Step 3 : Supprimer le registre et les templates code**

```bash
rm -rf /Users/amadou/Devs/projects/badge/src/lib/badge-templates/default-v1
rm -rf /Users/amadou/Devs/projects/badge/src/lib/badge-templates/recto-verso-v1
rm /Users/amadou/Devs/projects/badge/src/lib/badge-templates/index.ts
rm /Users/amadou/Devs/projects/badge/src/lib/badge-templates/declarative/__tests__/fidelity.test.tsx
```

Le test de fidelite disparait avec sa reference : il comparait le moteur aux composants
historiques, qui n'existent plus. Sa valeur a ete consommee — c'est lui qui a autorise
cette task. Le test d'egalite manifestes/fixtures de la Task 1 devient sans objet lui
aussi : le supprimer, les fixtures ayant disparu, et ne conserver que
`prisma/badge-templates/`.

Le type `BadgeTemplate` (`types.ts`) **reste** : c'est le contrat que `resolveTemplate`
renvoie.

- [ ] **Step 4 : Verifier qu'aucune reference ne subsiste**

Run:
```bash
grep -rn "BADGE_TEMPLATES\|DEFAULT_TEMPLATE_ID\|getTemplate\|listTemplates" \
  /Users/amadou/Devs/projects/badge/src /Users/amadou/Devs/projects/badge/scripts
```
Expected: aucune occurrence. Si le grep renvoie quelque chose, c'est un consommateur oublie par la Task 7 du plan 11.

- [ ] **Step 5 : Verifier**

Run: `make lint && make typecheck && make test`
Expected: tout passe.

- [ ] **Step 6 : Verification navigateur**

Apres `make db-seed`, imprimer un badge d'un evenement issu du seed et le comparer
visuellement a un badge imprime avant la bascule. **C'est le controle final** : les tests
comparent des arbres de rendu, l'oeil compare des badges.

- [ ] **Step 7 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add -A src/lib/badge-templates
git commit -m "refactor(v4): retrait du registre de templates compiles"
```

---

## Task 5 : Nettoyage des outils du registre

**Files:**
- Delete: `scripts/copy-badge-previews.ts`
- Modify: `package.json` (hook `prebuild`, l.7)
- Modify: `scripts/validate-badge-templates.ts`
- Modify: `src/components/admin/BadgeTemplatePicker.tsx` (si `previewSrc` suppose `/badge-previews/`)

- [ ] **Step 1 : Retirer la copie des apercus**

`scripts/copy-badge-previews.ts` copie les `preview.png` des dossiers de template, qui
n'existent plus. Le supprimer et retirer le hook `prebuild` de `package.json:7`.

Verifier ensuite que `public/badge-previews/` n'est plus reference nulle part :

```bash
grep -rn "badge-previews" /Users/amadou/Devs/projects/badge/src /Users/amadou/Devs/projects/badge/scripts /Users/amadou/Devs/projects/badge/package.json
```

Si `BadgeTemplatePicker` construit une URL `/badge-previews/<id>.png`, la remplacer par
le `previewSrc` fourni par `listAvailableTemplates`, qui pointe vers le stockage.

- [ ] **Step 2 : Reorienter le script de validation**

`scripts/validate-badge-templates.ts` verifiait qu'aucune ligne ne reference un id
absent de `BADGE_TEMPLATES`. Le reecrire pour verifier qu'aucune des trois colonnes ne
reference un `InstalledBadgeTemplate` inexistant. **Conserver le nom de la cible**
`make validate-badge-templates` (`Makefile:334`) : la CI et les habitudes en dependent.

- [ ] **Step 3 : Verifier**

Run: `make validate-badge-templates`
Expected: aucune reference orpheline.

Run: `make lint && make typecheck && make test`

- [ ] **Step 4 : Verifier que le build passe sans le hook prebuild**

Run: `make build` (ou la cible de build du projet — verifier dans le `Makefile`)
Expected: build reussi, aucune erreur d'apercu manquant.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add -A scripts package.json src/components
git commit -m "chore(v4): retrait des outils du registre de templates"
```

---

## Task 6 : Documentation

**Files:**
- Modify: `docs/v4/features/templates-badges.md`
- Modify: `docs/v4/architecture.md`
- Modify: `docs/v4/installation.md`
- Modify: `CLAUDE.md` (si une mention du registre y subsiste)

- [ ] **Step 1 : Mettre a jour la fiche feature**

Le registre code n'existe plus : l'unique facon d'ajouter un template est d'installer un
paquet. Documenter que les deux templates de base sont installes par le seed et ne sont
pas des cas particuliers.

- [ ] **Step 2 : Mettre a jour l'architecture**

Chemin de rendu unique ; ou vit la garantie du template par defaut.

- [ ] **Step 3 : Mettre a jour la doc d'installation**

`make db-seed` installe les templates de base ; mentionner
`make migrate-badge-template-refs` pour une base de developpement anterieure.

- [ ] **Step 4 : Verifier les sources de verite**

Run:
```bash
grep -rn "badge-templates/index\|BADGE_TEMPLATES\|registre" /Users/amadou/Devs/projects/badge/docs/v4 /Users/amadou/Devs/projects/badge/CLAUDE.md
```
Corriger toute mention devenue fausse.

- [ ] **Step 5 : Commit** *(uniquement si l'utilisateur le demande)*

```bash
git add docs CLAUDE.md
git commit -m "docs(v4): un seul chemin de rendu pour les templates de badge"
```
