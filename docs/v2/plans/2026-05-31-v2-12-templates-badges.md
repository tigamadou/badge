# Templates de badges multi-faces -- Implementation Plan

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [x] | 2026-06-01 | Pre-flight : deps OK (React-PDF 4.5, qrcode 1.5), helpers auth complets, OrgSettings supprime (v2-11) -> Organization.badgeTemplateId. EVENT_SETTINGS_UPDATED + PLATFORM_SETTINGS_UPDATED dans l'enum, ORG_SETTINGS_UPDATED inexistant -> log ORG_UPDATED. CI workflow absent -> integration CI sautee (par decision user). Pas de route badges/[badgeId] preexistante. |
| 1  | [x] | 2026-06-01 | src/lib/badge-templates/types.ts : PageSize, TemplateMeta, TemplateContext, BadgeTemplate. |
| 2  | [x] | 2026-06-01 | mm.ts (mm -> pt 2.83464567) + fonts.ts (Font.register Montserrat 4 weights + MONTSERRAT_REGISTERED marqueur). |
| 3  | [x] | 2026-06-01 | default-v1 : meta CR80 paysage (85.6 x 54 mm) + template.tsx React-PDF (photo gauche 28x34mm, infos droite, QR + categorie pleine couleur en bas). Respect anonymous + neutralBadge. |
| 4  | [x] | 2026-06-01 | index.ts BADGE_TEMPLATES + getTemplate + listTemplates + DEFAULT_TEMPLATE_ID. 7 tests verts (registry, getTemplate valide/null, listTemplates, validation meta, preview PNG skip Task 7). |
| 5  | [x] | 2026-06-01 | Schema : Event.badgeTemplateId String?, Organization.badgeTemplateId String? (au lieu d'OrgSettings supprime), PlatformSettings.badgeTemplateId String @default("default-v1"). prisma db push + generate. Seed maj. |
| 6  | [x] | 2026-06-01 | resolveBadgeTemplateId(event, organization, platform) -> string. Signature adaptee : 2eme parametre = Organization (pas OrgSettings). 5 tests cascade verts (event prioritaire, fallback org, fallback platform, org null, platform alt). |
| 7  | [x] | 2026-06-01 | preview.png placeholder PNG 1x1 RGBA pour default-v1. scripts/copy-badge-previews.ts (Node fs/promises) + script "prebuild" dans package.json. /public/badge-previews/ ajoute au .gitignore. Test preview PNG reactive (skip retire) -> 7 tests verts. |
| 8  | [x] | 2026-06-01 | recto-verso-v1 : meta A7 portrait (74 x 105 mm, 2 pages) + template.tsx (recto titre + photo 50x60 + identite + QR ; verso logo + titre + bande categorie 25mm). Enregistre dans le registry. Copie previews 2/2. 9 tests verts (registry + meta + 2 previews). |
| 9  | [x] | 2026-06-01 | render.test.tsx : renderToBuffer + verification %PDF- + countPdfPages via regex `/Type /Page`. 2 tests verts (default-v1 = 1 page, recto-verso-v1 = 2 pages). |
| 10 | [x] | 2026-06-01 | build-context.ts : buildTemplateContext(registration, options) -> TemplateContext. readFileAsDataUrl + generateQRCodeDataURL via objet `internals` (export __TEST__ pour vi.spyOn). 4 tests verts (complet, logo null, photo fail -> chaine vide, anonymous propage). |
| 11 | [x] | 2026-06-01 | scripts/validate-badge-templates.ts (scan Event/Organization/PlatformSettings, exit 1 si orphelin). Cible Makefile `validate-badge-templates`. Integration CI sautee (par decision user, pas de .github/workflows/). |
| 12 | [x] | 2026-06-01 | Route GET /api/admin/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx : withEventAuth minRole VIEWER + check explicite hasEventPermission badge.print. resolveBadgeTemplateId + getTemplate + fallback DEFAULT_TEMPLATE_ID. buildTemplateContext + renderToStream + ReadableStream wrap. Header x-template-id pour debug/test. 4 tests verts (PDF, 1 page default, 2 pages recto-verso, fallback orphelin). |
| 13 | [x] | 2026-06-01 | BadgeTemplatePicker.tsx Client Component (cartes + select + clear + messages + useTransition). Route PATCH /api/admin/[orgId]/events/[eventId]/settings/badge : Zod body { badgeTemplateId: string|null }, check hasEventPermission event.settings.update, validation getTemplate, log EVENT_SETTINGS_UPDATED. Page event-admin avec resolveBadgeTemplateId + effectiveLevel + redirect si pas permission. 5 tests verts (401/403/200 valide/200 null/400 unknown). |
| 14 | [x] | 2026-06-01 | Route PATCH /api/admin/[orgId]/settings/badge : requireOrgRole MANAGER (OWNER inclus), update Organization.badgeTemplateId, log ORG_UPDATED. Page org-admin (redirect si pas role). 5 tests verts (401/403 AUDITOR/200 valide MANAGER/200 null OWNER/400 unknown). |
| 15 | [x] | 2026-06-01 | Route PATCH /api/staff/settings/badge : requireStaff STAFF_ADMIN, Zod refuse null (NOT NULL), validation getTemplate, log PLATFORM_SETTINGS_UPDATED. Page staff (canClearToInherit=false). 5 tests verts (401/403 STAFF_OBSERVER/200 valide STAFF_ADMIN/400 null/400 unknown). |
| 16 | [x] | 2026-06-01 | e2e/badge-template-selection.spec.ts : login event-admin -> /admin/.../settings/badge -> select recto-verso-v1 -> verifie persist BDD + data-selected -> clear inherit -> verifie null. 1 test vert. Doc maj : espace-evenement.md, espace-organisation.md, espace-staff.md (sous-section v2-12 chaque), docs/v2/README.md (entree v2-12). Helper db.ts enrichi : makeEventAdminUser + getEventBadgeTemplateId. Container app redemarre une fois pour rafraichir le client Prisma cache. |
| 17 | [x] | 2026-06-01 | Verifs finales : tsc clean, 598 tests Vitest (68 fichiers), lint 0 erreur (19 warnings preexistants), 9/9 E2E Playwright verts (8 v2-11 + 1 v2-12), validate-badge-templates OK (0 orphelin). |

**Derniere session** : 2026-06-01, plan **integralement termine** (toutes tasks [x]).
**Prochaine etape** : aucun plan v2 en cours. Plans disponibles : aucun (v2-13+ a planifier).

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire un registry de templates de badges multi-faces selectionnable en cascade (`Event -> Org -> Platform`), avec au minimum deux templates livres (`default-v1` mono-face CR80 et `recto-verso-v1` deux faces), une route serveur de generation PDF qui consomme le registry, et trois pages de selection UI (event, org, staff).

**Architecture:** Les templates sont du code (`src/lib/badge-templates/<id>/template.tsx`) base sur `@react-pdf/renderer`, accompagnes de `meta.ts` (`TemplateMeta`) et d'un `preview.png` copie au build dans `public/badge-previews/`. Un registry typesafe (`BADGE_TEMPLATES`) expose `getTemplate(id)` et `listTemplates()`. Trois champs Prisma (`Event.badgeTemplateId`, `OrgSettings.badgeTemplateId`, `PlatformSettings.badgeTemplateId @default("default-v1")`) portent la cascade ; `resolveBadgeTemplateId()` garantit une valeur non-null. Un helper `buildTemplateContext()` agrege photo, logo, QR en data URLs et compose un `TemplateContext` strict. La route `/api/admin/[orgId]/events/[eventId]/badges/[badgeId]` appelle `getTemplate(...)` resolu en cascade et streame le PDF via `renderToStream`. Trois pages settings/badge listent les templates par cartes avec preview PNG. Un script CI (`scripts/validate-badge-templates.ts`) verifie qu'aucun `badgeTemplateId` persiste orphelin du registry.

**Tech Stack:** `@react-pdf/renderer` 4 (deja en place v1), Prisma 6 (migration v2 add-only sur trois modeles), Next.js 16 App Router (Server Components par defaut), Vitest 4 (unit + integration), Playwright (E2E, deja en place via v3-03), `qrcode` + helper `image-to-dataurl.ts` deja existants. Pas de nouvelle dep externe.

**Spec:** [`docs/v2/specs/2026-05-31-v2-12-templates-badges.md`](../specs/2026-05-31-v2-12-templates-badges.md)

---

## File Structure

**Files to create:**

- `src/lib/badge-templates/types.ts` -- types `PageSize`, `TemplateMeta`, `TemplateContext`, `BadgeTemplate`
- `src/lib/badge-templates/index.ts` -- registry `BADGE_TEMPLATES` + helpers `getTemplate(id)`, `listTemplates()`
- `src/lib/badge-templates/build-context.ts` -- helper `buildTemplateContext(registration)` retournant `TemplateContext`
- `src/lib/badge-templates/fonts.ts` -- `Font.register()` Montserrat (un seul appel module-level partage par tous les templates)
- `src/lib/badge-templates/mm.ts` -- helper `mm(value)` qui convertit millimetres en points React-PDF
- `src/lib/badge-templates/default-v1/meta.ts` -- `TemplateMeta` du template par defaut
- `src/lib/badge-templates/default-v1/template.tsx` -- composant React-PDF mono-face CR80
- `src/lib/badge-templates/default-v1/preview.png` -- preview PNG embarquee
- `src/lib/badge-templates/recto-verso-v1/meta.ts` -- `TemplateMeta` du template 2 faces
- `src/lib/badge-templates/recto-verso-v1/template.tsx` -- composant React-PDF 2 pages (recto + verso)
- `src/lib/badge-templates/recto-verso-v1/preview.png` -- preview PNG embarquee
- `src/lib/badge-templates/__tests__/registry.test.ts` -- tests unitaires registry + meta validation + preview PNG existant
- `src/lib/badge-templates/__tests__/build-context.test.ts` -- tests unitaires `buildTemplateContext`
- `src/lib/badge-templates/__tests__/render.test.ts` -- tests integration `renderToBuffer` par template, verification nombre de pages
- `src/lib/__tests__/resolve-badge-template-id.test.ts` -- tests unitaires de cascade `Event -> Org -> Platform`
- `src/lib/settings.ts` -- helper `resolveBadgeTemplateId(event, orgSettings, platformSettings)` (fichier nouveau si `lib/settings.ts` n'existe pas encore en v2 master ; sinon ajout d'une fonction)
- `src/app/api/admin/[orgId]/events/[eventId]/badges/[badgeId]/route.ts` -- route v2 de generation PDF utilisant le registry (GET)
- `src/app/api/admin/[orgId]/events/[eventId]/badges/[badgeId]/__tests__/route.test.ts` -- tests integration de la route (vraie BDD, vraie cascade)
- `src/app/admin/[orgId]/events/[eventId]/settings/badge/page.tsx` -- page event-admin de selection template
- `src/app/admin/[orgId]/events/[eventId]/settings/badge/BadgeTemplatePicker.tsx` -- composant client de selection (form + cards)
- `src/app/api/admin/[orgId]/events/[eventId]/settings/badge/route.ts` -- PATCH event.badgeTemplateId (autorisation `event:settings:update`)
- `src/app/api/admin/[orgId]/events/[eventId]/settings/badge/__tests__/route.test.ts` -- tests integration PATCH
- `src/app/admin/[orgId]/settings/badge/page.tsx` -- page org-admin de selection template
- `src/app/api/admin/[orgId]/settings/badge/route.ts` -- PATCH org.badgeTemplateId (OWNER/MANAGER)
- `src/app/api/admin/[orgId]/settings/badge/__tests__/route.test.ts` -- tests integration PATCH
- `src/app/staff/settings/badge/page.tsx` -- page staff de selection template (PlatformSettings)
- `src/app/api/staff/settings/badge/route.ts` -- PATCH platformSettings.badgeTemplateId (SUPER_ADMIN/STAFF_ADMIN)
- `src/app/api/staff/settings/badge/__tests__/route.test.ts` -- tests integration PATCH
- `e2e/badge-template-selection.spec.ts` -- test E2E selection event-admin
- `scripts/validate-badge-templates.ts` -- script CI : verifie qu'aucun `badgeTemplateId` persiste orphelin
- `scripts/copy-badge-previews.ts` -- script `prebuild` qui copie `src/lib/badge-templates/<id>/preview.png` vers `public/badge-previews/<id>.png`

**Files to modify:**

- `prisma/schema.prisma` -- ajout `Event.badgeTemplateId String?`, `OrgSettings.badgeTemplateId String?`, `PlatformSettings.badgeTemplateId String @default("default-v1")`
- `prisma/seed.ts` -- garantir que la ligne `PlatformSettings` seedee a `badgeTemplateId = "default-v1"`
- `package.json` -- ajout du script `"prebuild": "tsx scripts/copy-badge-previews.ts"` (si un `prebuild` existe deja : merger les commandes)
- `.github/workflows/ci.yml` -- ajout d'un step `Validate badge templates` dans le job `unit` apres `Prisma db push` (`npx tsx scripts/validate-badge-templates.ts`)
- `Makefile` -- ajout cible `validate-badge-templates` qui wrappe l'exec docker dev
- `docs/v2/features/espace-evenement.md` -- ajout sous-section pour `/admin/[orgId]/events/[eventId]/settings/badge` + route API + permission `event.settings.update`
- `docs/v2/features/espace-organisation.md` -- ajout sous-section pour `/admin/[orgId]/settings/badge` + route API
- `docs/v2/features/espace-staff.md` -- ajout sous-section pour `/staff/settings/badge` + route API
- `docs/v2/README.md` -- ajouter entree v2-11 et v2-12 dans les tableaux "Sous-specifications" et "Plans d'implementation"
- `.gitignore` -- ajout `/public/badge-previews/` (generated dir, ne pas commiter les copies)

**Files removed:** aucun.

**Tests :**

- Tests unitaires Vitest : registry validation, cascade `resolveBadgeTemplateId`, `buildTemplateContext` (mock data URLs).
- Tests integration Vitest contre vraie MySQL : route GET `/api/admin/[orgId]/events/[eventId]/badges/[badgeId]` (verification du Content-Type, du PDF header, du nombre de pages), routes PATCH des 3 niveaux (validation cascade, autorisation refusee, autorisation acceptee).
- Test integration de rendu : pour chaque template du registry, `renderToBuffer(<Component ctx={fakeCtx}/>)` produit un PDF non vide commencant par `%PDF-` avec le bon nombre de pages.
- Test E2E Playwright : login event-admin, navigation `/admin/[orgId]/events/[eventId]/settings/badge`, selection d'un template alternatif, sauvegarde, verification post-reload de la persistence.

---

## Pre-flight

### Task 0: Verifier l'etat du depot et les pre-requis

**Files:** aucun. Check d'environnement.

- [ ] **Step 0.1: Confirmer la branche et l'etat git** -- `git status && git branch --show-current`. Branche attendue `feat/v2-sass`, working tree propre.

- [ ] **Step 0.2: Verifier la presence de la spec v2-12** -- `test -f /Users/amadou/Devs/projects/badge/docs/v2/specs/2026-05-31-v2-12-templates-badges.md && echo OK`.

- [ ] **Step 0.3: Verifier la presence des dependances React-PDF / Prisma** -- `grep -E '"(@react-pdf/renderer|@prisma/client|qrcode)"' /Users/amadou/Devs/projects/badge/package.json`. Les trois packages sont presents en `dependencies`.

- [ ] **Step 0.4: Identifier l'etat actuel du schema Prisma v2** -- `grep -nE "^model (Event|OrgSettings|PlatformSettings|Organization)" /Users/amadou/Devs/projects/badge/prisma/schema.prisma`. **Si les models multi-tenant v2 master ne sont pas encore appliques, arreter et demander a l'utilisateur** : ce plan suppose la migration v2 master deja realisee.

- [ ] **Step 0.5: Verifier la presence du helper `src/lib/settings.ts`** -- `test -f /Users/amadou/Devs/projects/badge/src/lib/settings.ts && echo "EXISTE" || echo "A CREER"`. Documenter le choix (creer fichier ou ajouter fonction).

- [ ] **Step 0.6: Verifier que le code v1 de badge ne sera pas casse** -- `ls /Users/amadou/Devs/projects/badge/src/components/badge/`. `BadgeDocument.tsx` etc. ne sont pas touches par ce plan.

- [ ] **Step 0.7: Verifier que les tests Vitest actuels passent** -- `make test`. Tous verts. Si KO : corriger avant.

- [ ] **Step 0.8: Lister la presence des sous-specs liees a patcher** -- les 3 sous-specs espace-evenement, espace-organisation, espace-staff existent.

- [ ] **Step 0.9: Pas de commit** -- task de check pur.

---

## Task 1: Types TypeScript du registry (`types.ts`)

**Files:** Create `src/lib/badge-templates/types.ts`.

> Definir `PageSize`, `TemplateMeta`, `TemplateContext`, `BadgeTemplate` exactement tels que decrits dans la spec Section 1.2. Aucun template ne les importe encore : on cree d'abord le contrat.

- [ ] **Step 1.1: Creer l'arborescence** -- `mkdir -p /Users/amadou/Devs/projects/badge/src/lib/badge-templates`.

- [ ] **Step 1.2: Creer `src/lib/badge-templates/types.ts`**

Contenu :

```typescript
import type { ComponentType } from "react";

export type PageSize = {
  width: string;
  height: string;
};

export type TemplateMeta = {
  id: string; // slug kebab-case, unique dans le registry
  label: string; // libelle UI
  description: string; // 1-2 phrases pour la carte de selection
  pages: number; // nombre de <Page> rendues (>= 1)
  pageSize: PageSize;
  previewSrc: string; // chemin servi par Next (ex: "/badge-previews/default-v1.png")
  version: number;
};

export type TemplateContext = {
  participant: {
    firstName: string;
    lastName: string;
    photoDataUrl: string;
    structure: string;
  };
  category: {
    name: string;
    color: string;
    neutralBadge: boolean;
    anonymous: boolean;
  };
  event: {
    title: string;
    date: Date;
    location: string;
    logoDataUrl: string | null;
  };
  badge: {
    id: string;
    verifyUrl: string;
    qrCodeDataUrl: string;
  };
};

export type BadgeTemplate = {
  meta: TemplateMeta;
  Component: ComponentType<{ ctx: TemplateContext }>;
};
```

- [ ] **Step 1.3: Verifier compilation** -- `docker compose -f docker-compose.dev.yml exec app npx tsc --noEmit`. 0 erreur.

- [ ] **Step 1.4: Commit** -- `git add src/lib/badge-templates/types.ts && git commit -m "feat(v2-12): types TemplateMeta, TemplateContext, BadgeTemplate"`.

---

## Task 2: Helpers partages (`mm.ts`, `fonts.ts`)

**Files:** Create `src/lib/badge-templates/mm.ts`, `src/lib/badge-templates/fonts.ts`.

> Deux modules infrastructure que tous les templates partagent : `mm()` (conversion mm -> pt React-PDF) et `fonts.ts` (`Font.register` Montserrat centralisee).

- [ ] **Step 2.1: Creer `mm.ts`** avec `export function mm(valueMm: number): number { return valueMm * 2.83464567; }`.

- [ ] **Step 2.2: Creer `fonts.ts`** copiant le bloc `Font.register("Montserrat", ...)` du v1 `BadgeDocument.tsx` lignes 16-24 + un `export const MONTSERRAT_REGISTERED = true` marqueur anti-treeshaking.

- [ ] **Step 2.3: Verifier compilation TypeScript** -- 0 erreur.

- [ ] **Step 2.4: Commit** -- `feat(v2-12): helpers partages mm() et Font.register Montserrat`.

---

## Task 3: Premier template `default-v1` (composant + meta)

**Files:** Create `src/lib/badge-templates/default-v1/meta.ts`, `src/lib/badge-templates/default-v1/template.tsx`.

> On porte la disposition v1 vers le contrat `TemplateContext`. La meta declare 1 page, format CR80 paysage (85.6 x 54 mm). Le composant cible un PDF fonctionnel (pas pixel-perfect v1). Le PNG preview est cree separement en Task 7.

- [ ] **Step 3.1: Creer le dossier** -- `mkdir -p /Users/amadou/Devs/projects/badge/src/lib/badge-templates/default-v1`.

- [ ] **Step 3.2: Creer `meta.ts`** avec id `"default-v1"`, label "Badge standard", pages 1, pageSize `{width: "85.6mm", height: "54mm"}`, previewSrc `"/badge-previews/default-v1.png"`, version 1.

- [ ] **Step 3.3: Creer `template.tsx`** -- Composant React-PDF qui rend une page CR80 paysage avec : photo a gauche (28mm), infos a droite (titre event en haut, nom + structure au milieu, QR code + categorie pleine couleur en bas). Respect du flag `anonymous` (masque nom/photo) et `neutralBadge` (badge blanc bordure couleur au lieu de fond plein). Import `"./fonts"` pour declencher `Font.register`. Utiliser `mm()` pour les dimensions.

- [ ] **Step 3.4: Verifier compilation TypeScript** -- 0 erreur.

- [ ] **Step 3.5: Commit** -- `feat(v2-12): template default-v1 (mono-face CR80)`.

---

## Task 4: Registry `index.ts` + tests unitaires (TDD)

**Files:** Create `src/lib/badge-templates/__tests__/registry.test.ts`, `src/lib/badge-templates/index.ts`.

> Tests **avant** le registry. Couvre : registry non vide, `getTemplate("default-v1")` non-null avec `meta` + `Component`, `getTemplate("inconnu")` null, validation de chaque meta (id == cle, label/description non-vides, pages >= 1, version >= 1, pageSize au format regex), existence de chaque preview.png sur disque.

- [ ] **Step 4.1: Creer le dossier `__tests__`**.

- [ ] **Step 4.2: Ecrire le test FAILING (red)** avec assertions enumerees ci-dessus. Inclure un `it.each(Object.values(BADGE_TEMPLATES))` pour la verification preview PNG (Node `fs.existsSync` sur `src/lib/badge-templates/<id>/preview.png`).

- [ ] **Step 4.3: Lancer test, observer red** -- erreur `Cannot find module '../index'`.

- [ ] **Step 4.4: Creer `src/lib/badge-templates/index.ts`** :

```typescript
import type { BadgeTemplate } from "./types";
import { meta as defaultV1Meta } from "./default-v1/meta";
import DefaultV1Template from "./default-v1/template";

export const BADGE_TEMPLATES = {
  "default-v1": { meta: defaultV1Meta, Component: DefaultV1Template },
} as const satisfies Record<string, BadgeTemplate>;

export type BadgeTemplateId = keyof typeof BADGE_TEMPLATES;

export function getTemplate(id: string): BadgeTemplate | null {
  return (BADGE_TEMPLATES as Record<string, BadgeTemplate>)[id] ?? null;
}

export function listTemplates(): BadgeTemplate[] {
  return Object.values(BADGE_TEMPLATES);
}

const DEFAULT_TEMPLATE_ID = "default-v1" as const;
export { DEFAULT_TEMPLATE_ID };
```

- [ ] **Step 4.5: Re-lancer test** -- toutes les assertions passent **sauf** preview PNG (le PNG sera cree Task 7).

- [ ] **Step 4.6: Marquer le test preview comme `.skip` temporaire** + commentaire `// SKIP : preview PNG cree en Task 7 -- reactiver alors`.

- [ ] **Step 4.7: Commit** -- `feat(v2-12): registry BADGE_TEMPLATES + tests unitaires (skip preview PNG)`.

---

## Task 5: Migration schema Prisma (3 champs `badgeTemplateId`)

**Files:** Modify `prisma/schema.prisma`, `prisma/seed.ts`.

> Ajout add-only des trois champs declares dans la spec Section 2.

- [ ] **Step 5.1: Lire les blocs concernes** -- `grep -nE "^model (Event|OrgSettings|PlatformSettings)" prisma/schema.prisma`. Si l'un manque, arreter (cf Task 0 Step 0.4).

- [ ] **Step 5.2: Ajouter `Event.badgeTemplateId String?`** dans le bloc `model Event`.

- [ ] **Step 5.3: Ajouter `OrgSettings.badgeTemplateId String?`**.

- [ ] **Step 5.4: Ajouter `PlatformSettings.badgeTemplateId String @default("default-v1")`** (NOT NULL avec defaut).

- [ ] **Step 5.5: Pousser le schema (dev)** -- `docker compose exec app npx prisma db push --skip-generate`. Pas d'erreur attendue (ajout de champs nullable + un avec defaut).

- [ ] **Step 5.6: Regenerer le client Prisma** -- `npx prisma generate`.

- [ ] **Step 5.7: Verifier que `PlatformSettings.badgeTemplateId` est present dans le client** via une requete tsx adhoc.

- [ ] **Step 5.8: Patcher le seed** -- ajouter `badgeTemplateId: "default-v1"` explicitement dans le `create`/`upsert` de `PlatformSettings`. Documenter le choix dans le tracker.

- [ ] **Step 5.9: Reseed et verifier** -- la valeur en BDD est `default-v1`.

- [ ] **Step 5.10: Commit** -- `feat(v2-12): schema Prisma -- ajouter badgeTemplateId sur Event, OrgSettings, PlatformSettings`.

---

## Task 6: Helper `resolveBadgeTemplateId()` + tests cascade (TDD)

**Files:** Create `src/lib/__tests__/resolve-badge-template-id.test.ts`. Modify or create `src/lib/settings.ts`.

> Helper pur, testable sans BDD. Cascade `Event > Org > Platform`, plus garde-fou pour `null` org.

- [ ] **Step 6.1: Ecrire le test FAILING** -- 5 cas (event defini, fallback org, fallback platform, null org, valeur platform alternative).

- [ ] **Step 6.2: Lancer test, observer red** -- `Cannot find module '../settings'`.

- [ ] **Step 6.3: Creer ou modifier `src/lib/settings.ts`** avec la fonction :

```typescript
export function resolveBadgeTemplateId(
  event: { badgeTemplateId: string | null } | null,
  orgSettings: { badgeTemplateId: string | null } | null,
  platformSettings: { badgeTemplateId: string }
): string {
  return (
    event?.badgeTemplateId ??
    orgSettings?.badgeTemplateId ??
    platformSettings.badgeTemplateId
  );
}
```

Si fichier existant : merger sans casser. Si types Prisma natifs deja utilises (`Pick<Event, "badgeTemplateId">` etc.), les preferer.

- [ ] **Step 6.4: Lancer test** -- `5 passed`.

- [ ] **Step 6.5: Verifier typecheck** -- 0 erreur.

- [ ] **Step 6.6: Commit** -- `feat(v2-12): helper resolveBadgeTemplateId + tests cascade`.

---

## Task 7: Preview PNG `default-v1` + script `copy-badge-previews`

**Files:** Create `src/lib/badge-templates/default-v1/preview.png`, `scripts/copy-badge-previews.ts`. Modify `package.json`, `.gitignore`.

> Le PNG ne peut etre genere par un agent. **Option B (placeholder 1x1 blanc)** pour debloquer le pipeline ; le designer fournira la version definitive plus tard via PR ciblee qui remplace uniquement le PNG.

- [ ] **Step 7.1: Generer le placeholder PNG 1x1** via `npx tsx -e` qui ecrit un buffer Base64 PNG 1x1 transparent dans `src/lib/badge-templates/default-v1/preview.png`. Verifier avec `file <path>` qu'on a bien un `PNG image data`. Marquer dans le tracker : "placeholder a remplacer".

- [ ] **Step 7.2: Creer `scripts/copy-badge-previews.ts`** qui scanne `src/lib/badge-templates/<id>/preview.png` et copie chaque fichier vers `public/badge-previews/<id>.png`. Cree le dossier si absent.

- [ ] **Step 7.3: Verifier que le script tourne** -- `npx tsx scripts/copy-badge-previews.ts` produit `1 preview(s) copiees.` + presence du PNG dans `public/badge-previews/`.

- [ ] **Step 7.4: Ajouter le script `prebuild` dans `package.json`** -- `"prebuild": "tsx scripts/copy-badge-previews.ts"`. Si `prebuild` existe deja : merger via `&&`.

- [ ] **Step 7.5: Ajouter `/public/badge-previews/` au `.gitignore`** + verifier avec `git check-ignore`.

- [ ] **Step 7.6: Reactiver le test preview PNG** -- retirer `.skip` de l'assertion dans `registry.test.ts`. Verifier que tous les tests passent.

- [ ] **Step 7.7: Commit** -- `feat(v2-12): preview PNG default-v1 + script copy-badge-previews + prebuild`.

---

## Task 8: Deuxieme template `recto-verso-v1` + preview

**Files:** Create `src/lib/badge-templates/recto-verso-v1/{meta.ts,template.tsx,preview.png}`. Modify `src/lib/badge-templates/index.ts`.

> Format A7 portrait (74 x 105 mm), 2 faces. Recto : identite + QR. Verso : titre event grand format + categorie pleine page.

- [ ] **Step 8.1: Creer le dossier** -- `mkdir -p src/lib/badge-templates/recto-verso-v1`.

- [ ] **Step 8.2: Creer `meta.ts`** -- id `"recto-verso-v1"`, label "Badge recto-verso", pages 2, pageSize `{width: "74mm", height: "105mm"}`, previewSrc `"/badge-previews/recto-verso-v1.png"`, version 1.

- [ ] **Step 8.3: Creer `template.tsx`** -- 2 `<Page>` :
  - Recto : titre event centre, photo encadree (50x60 mm centree), nom + structure centres, QR code centre.
  - Verso : logo event (si present), titre grand format, date + lieu, bande categorie pleine page (25 mm de haut, couleur de fond ou bordure si neutralBadge).
  - Respect `anonymous` (masque nom + photo).
  - Import `"../fonts"` pour Montserrat.

- [ ] **Step 8.4: Creer le PNG placeholder** -- meme technique que Task 7. Marquer dans le tracker.

- [ ] **Step 8.5: Enregistrer dans le registry** -- editer `index.ts` pour ajouter `"recto-verso-v1": { meta: rvV1Meta, Component: RvV1Template }`.

- [ ] **Step 8.6: Rejouer copy + verifier** -- 2 PNG dans `public/badge-previews/`.

- [ ] **Step 8.7: Verifier tests registry verts** -- les assertions `it.each` couvrent maintenant les 2 templates.

- [ ] **Step 8.8: Commit** -- `feat(v2-12): template recto-verso-v1 (2 faces A7) + enregistrement registry`.

---

## Task 9: Tests integration de rendu PDF (TDD)

**Files:** Create `src/lib/badge-templates/__tests__/render.test.ts` (ou `.tsx` si JSX requis).

> Pour chaque template : `renderToBuffer(<Component ctx={fakeCtx} />)` produit (1) buffer non vide, (2) header `%PDF-`, (3) nombre de pages == `meta.pages`. Pas de mock React-PDF.

- [ ] **Step 9.1: Ecrire le test FAILING** avec un `fakeCtx` complet (PNG 1x1 base64 transparent pour photo, logo, QR). Helper `countPdfPages(buffer)` qui regex-compte `/\/Type\s*\/Page(?![s])/g` sur la chaine latin1 du buffer.

- [ ] **Step 9.2: Lancer test** -- 3 cas possibles : green direct, erreur JSX (renommer `.ts` -> `.tsx`), regex faux (logger les 500 premiers chars et ajuster).

- [ ] **Step 9.3: Iterer jusqu'au green** -- corriger les templates si necessaire (le test est l'oracle).

- [ ] **Step 9.4: Verifier que toute la suite badge-templates passe** -- `npx vitest run src/lib/badge-templates/`.

- [ ] **Step 9.5: Commit** -- `test(v2-12): tests integration rendu PDF par template`.

---

## Task 10: Helper `buildTemplateContext` + tests unitaires (TDD)

**Files:** Create `src/lib/badge-templates/__tests__/build-context.test.ts`, `src/lib/badge-templates/build-context.ts`.

> Helper qui compose `TemplateContext` a partir d'une Registration Prisma : charge photo + logo en data URL via `fs/promises`, genere QR via helper existant `qrcode.ts`.

- [ ] **Step 10.1: Identifier la signature attendue** par les callers (Task 12 utilise `buildTemplateContext(registration, opts)` ou `registration` inclut `team` et `event`).

- [ ] **Step 10.2: Ecrire le test FAILING** avec mock de `@/lib/qrcode` (`generateQRCodeDataURL` returns synthetic string) et expose `__TEST__.readFileAsDataUrl` mockable. 4 cas : composition complete, logo null, photo null, anonymous propage.

- [ ] **Step 10.3: Lancer test** -- red `Cannot find module '../build-context'`.

- [ ] **Step 10.4: Creer `build-context.ts`** -- declare `RegistrationForContext`, `BuildContextOptions`, `buildTemplateContext`. Fonction interne `readFileAsDataUrl(path)` lit `process.env.UPLOADS_ROOT` + path, base64-encode, retourne `data:<mime>;base64,...`. Export `__TEST__ = { readFileAsDataUrl }` pour mocking.

- [ ] **Step 10.5: Lancer test** -- `4 passed`. Si echec : passer a `vi.spyOn(__TEST__, "readFileAsDataUrl")` dans `beforeEach`.

- [ ] **Step 10.6: Commit** -- `feat(v2-12): helper buildTemplateContext + tests unitaires`.

---

## Task 11: Script `scripts/validate-badge-templates.ts` + integration CI

**Files:** Create `scripts/validate-badge-templates.ts`. Modify `.github/workflows/ci.yml`, `Makefile`.

> Script defini par spec Section 6.3. Scanne `Event`, `OrgSettings`, `PlatformSettings`, echoue si un `badgeTemplateId` est orphelin du registry.

- [ ] **Step 11.1: Creer `scripts/validate-badge-templates.ts`** -- Prisma client + `BADGE_TEMPLATES` import. Loop sur les 3 modeles, collecte les orphelins, `process.exit(1)` si trouve. Log un rapport detaille.

- [ ] **Step 11.2: Verifier le script** -- contre la BDD dev avec defaut `default-v1` : OK. Test de regression : mettre temporairement `badgeTemplateId = "INEXISTANT"` -> exit code 1.

- [ ] **Step 11.3: Ajouter le step CI dans `.github/workflows/ci.yml`** -- nouveau step `Validate badge templates` dans le job `unit`, **entre** `Prisma db push` et `Vitest`. Si CI inexistante (v3-03 pas applique) : **arreter et signaler**.

- [ ] **Step 11.4: Ajouter cible Makefile** -- `validate-badge-templates` dans `.PHONY` + cible qui wrappe `docker compose exec app npx tsx scripts/validate-badge-templates.ts`.

- [ ] **Step 11.5: Verifier YAML** -- `ruby -ryaml -e "YAML.load_file('.github/workflows/ci.yml')" && echo OK`.

- [ ] **Step 11.6: Commit** -- `feat(v2-12): script validate-badge-templates + step CI + cible make`.

---

## Task 12: Route serveur de generation PDF (TDD)

**Files:** Create `src/app/api/admin/[orgId]/events/[eventId]/badges/[badgeId]/route.ts` (ou `.tsx` si JSX requis pour route) + tests.

> Route v2 GET qui charge Registration + cascade settings, resout le templateId, appelle `getTemplate()` (fallback `default-v1` si id orphelin), build `TemplateContext`, streame le PDF via `renderToStream`. Path final coherent avec v2-04.

- [ ] **Step 12.1: Verifier que la route n'existe pas deja** -- `find src/app/api -path "*badges*badgeId*" -name route.ts`. Si conflit : coordonner.

- [ ] **Step 12.2: Ecrire le test FAILING** avec `beforeAll` qui seede une `Organization` + `Event` + `Team` + `Registration`, `beforeEach` qui reset `Event.badgeTemplateId`. 4 cas :
  - PDF avec Content-Type `application/pdf`.
  - 1 page quand template effectif = `default-v1`.
  - 2 pages quand `Event.badgeTemplateId = "recto-verso-v1"`.
  - Fallback `default-v1` (1 page) quand `Event.badgeTemplateId = "id-inexistant-xyz"`.

- [ ] **Step 12.3: Lancer test** -- red `Cannot find module '../route'`.

- [ ] **Step 12.4: Creer la route** -- `GET` handler qui :
  1. `requireEventPermission(eventId, "badge.print")` (si helper absent : arreter et demander).
  2. Charge `registration` avec `include: { team: true, event: true }`.
  3. Charge `orgSettings` + `platformSettings` en parallele.
  4. `resolveBadgeTemplateId(...)`.
  5. `getTemplate(resolvedId) ?? getTemplate(DEFAULT_FALLBACK_ID)`. Log warn si fallback.
  6. `buildTemplateContext(...)`.
  7. `renderToStream(<Component ctx={ctx} />)` -> Response avec `Content-Type: application/pdf`, `Content-Disposition: inline`.

  Si JSX echoue dans `.ts` route : renommer `.tsx`.

- [ ] **Step 12.5: Iterer jusqu'au green** -- adapter imports / signature `requireEventPermission` / types Prisma.

- [ ] **Step 12.6: Verifier qu'on n'a pas casse les autres tests** -- `make test` tout vert.

- [ ] **Step 12.7: Commit** -- `feat(v2-12): route GET badge PDF v2 utilisant le registry de templates`.

---

## Task 13: Page event-admin de selection + PATCH API (TDD)

**Files:** Create `src/app/admin/[orgId]/events/[eventId]/settings/badge/{page.tsx,BadgeTemplatePicker.tsx}`, `src/app/api/admin/[orgId]/events/[eventId]/settings/badge/route.ts` + tests.

> Premier des trois ecrans. `BadgeTemplatePicker` est partage (import par Tasks 14-15). Pas d'extraction generique prematuree (YAGNI).

- [ ] **Step 13.1: Creer arborescences** -- les 2 dossiers.

- [ ] **Step 13.2: Ecrire le test FAILING PATCH** -- 3 cas : valid templateId persiste, null pour heritage, id inconnu -> 400.

- [ ] **Step 13.3: Lancer test** -- red.

- [ ] **Step 13.4: Creer la route PATCH** -- `requireEventPermission(eventId, "event.settings.update")`, validation via `getTemplate()`, update + `logActivity({ type: "EVENT_SETTINGS_UPDATE", ... })`. Si l'`ActivityType` n'existe pas : l'ajouter au schema + push.

- [ ] **Step 13.5: Iterer jusqu'au green** -- `3 passed`.

- [ ] **Step 13.6: Creer `BadgeTemplatePicker.tsx` (Client Component)** -- props `{templates, currentValue, effectiveId, effectiveLevel, patchUrl, canClearToInherit}`. UI : grid de cartes (preview + label + description + format + nb faces + bouton "Selectionner"), bouton "Utiliser le defaut herite" conditionnel, ligne "Template effectif : X (niveau Y)", messages succes/erreur. `useTransition` pour le PATCH fetch.

- [ ] **Step 13.7: Creer la page server `page.tsx`** -- `requireEventPermission`, charge event + orgSettings + platformSettings, calcule `effectiveId` + `effectiveLevel`, transforme `listTemplates()` en `TemplateSummary[]`, rend `<BadgeTemplatePicker ... />`.

- [ ] **Step 13.8: Verifier typecheck + smoke navigateur** -- 0 erreur. Page accessible visuellement avec un user event-admin.

- [ ] **Step 13.9: Commit** -- `feat(v2-12): page event-admin selection template badge + PATCH API`.

---

## Task 14: Page org-admin de selection + PATCH API (TDD)

**Files:** Create `src/app/admin/[orgId]/settings/badge/page.tsx`, `src/app/api/admin/[orgId]/settings/badge/route.ts` + tests.

> Memes patterns que Task 13, scope org. RBAC : `requireOrgRole(orgId, ['OWNER', 'MANAGER'])`. Reutilise `BadgeTemplatePicker` de Task 13 via import.

- [ ] **Step 14.1: Creer arborescences**.

- [ ] **Step 14.2: Ecrire le test FAILING PATCH** -- 3 cas : valid templateId persiste sur `OrgSettings`, null pour heritage platform, id inconnu -> 400. Le `beforeAll` upsert Organization + OrgSettings.

- [ ] **Step 14.3: Creer la route PATCH** -- `requireOrgRole`, validation `getTemplate()`, `upsert` sur OrgSettings, `logActivity({ type: "ORG_SETTINGS_UPDATE", ... })`.

- [ ] **Step 14.4: Creer la page** -- charge orgSettings + platformSettings, calcule `effectiveId` + `effectiveLevel` (`"org"` ou `"platform"`), rend `<BadgeTemplatePicker patchUrl={...} canClearToInherit />`.

- [ ] **Step 14.5: Lancer tests + typecheck** -- `3 passed`, 0 erreur.

- [ ] **Step 14.6: Commit** -- `feat(v2-12): page org-admin selection template badge + PATCH API`.

---

## Task 15: Page staff de selection + PATCH API (TDD)

**Files:** Create `src/app/staff/settings/badge/page.tsx`, `src/app/api/staff/settings/badge/route.ts` + tests.

> Idem Task 14, scope plateforme. RBAC : `requireStaff(['SUPER_ADMIN', 'STAFF_ADMIN'])`. **Pas d'option "heriter"** : `canClearToInherit={false}`. `badgeTemplateId` est NOT NULL en BDD.

- [ ] **Step 15.1: Creer arborescences**.

- [ ] **Step 15.2: Ecrire le test FAILING PATCH** -- 3 cas : valid templateId persiste, null -> 400 (NOT NULL), id inconnu -> 400.

- [ ] **Step 15.3: Creer la route PATCH** -- `requireStaff`, refus si value null/undefined, validation `getTemplate()`, update PlatformSettings, `logActivity({ type: "PLATFORM_SETTINGS_UPDATE", ... })`.

- [ ] **Step 15.4: Creer la page** -- charge platformSettings, `effectiveLevel: "platform"`, `canClearToInherit={false}`.

- [ ] **Step 15.5: Lancer tests + typecheck** -- verts.

- [ ] **Step 15.6: Commit** -- `feat(v2-12): page staff selection template badge defaut plateforme + PATCH API`.

---

## Task 16: Test E2E Playwright + mises a jour sous-specs + index

**Files:** Create `e2e/badge-template-selection.spec.ts`. Modify `docs/v2/features/espace-evenement.md`, `espace-organisation.md`, `espace-staff.md`, `docs/v2/README.md`.

> Cloture du plan : test E2E sur le selecteur event-admin + propagation doc dans les 3 sous-specs + index v2.

- [ ] **Step 16.1: Ecrire le test E2E** -- login `superAdmin` (fixtures v3-03), naviguer sur `/admin/<orgId>/events/<eventId>/settings/badge` (env `E2E_DEMO_ORG_ID` et `E2E_DEMO_EVENT_ID`), cliquer `getByTestId("select-recto-verso-v1")`, attendre `success`, recharger, verifier que `template-card-recto-verso-v1` a `data-selected="true"`. Cleanup : cliquer `clear-inherit`.

- [ ] **Step 16.2: Lancer `make test-e2e`** -- tous verts. Si fixture event manquante : enrichir `prisma/seed.ts` ou creer `prisma/seed-e2e.ts`.

- [ ] **Step 16.3: Mettre a jour `docs/v2/features/espace-evenement.md`** -- ajouter sous-section `/admin/[orgId]/events/[eventId]/settings/badge` + route PATCH dans la liste API + reference spec v2-12.

- [ ] **Step 16.4: Mettre a jour `docs/v2/features/espace-organisation.md`** -- ajouter sous-section `/admin/[orgId]/settings/badge` + route PATCH.

- [ ] **Step 16.5: Mettre a jour `docs/v2/features/espace-staff.md`** -- ajouter sous-section `/staff/settings/badge` + route PATCH. Mentionner explicitement "pas d'option heriter, c'est la racine".

- [ ] **Step 16.6: Mettre a jour `docs/v2/README.md`** -- ajouter lignes v2-11 et v2-12 dans les tableaux "Sous-specifications fonctionnelles" et "Plans d'implementation".

- [ ] **Step 16.7: Verifier coherence finale** -- `grep -E "v2-12" docs/v2/README.md | wc -l` >= 2. `make lint && make typecheck && make test && make test-e2e` -- tout vert.

- [ ] **Step 16.8: Commit** -- `docs(v2-12): sous-specs espace-evenement/org/staff + index README + test E2E selection`.

---

## Post-implementation : verification globale

> Cette section n'est pas une task numerotee. Checklist final mappe aux criteres d'acceptation Section 8 de la spec.

- [ ] **C1** : `test -d /Users/amadou/Devs/projects/badge/src/lib/badge-templates/default-v1 && test -d /Users/amadou/Devs/projects/badge/src/lib/badge-templates/recto-verso-v1 && echo OK` -> `OK`. (Critere #1)
- [ ] **C2** : `test -f .../default-v1/preview.png && test -f .../recto-verso-v1/preview.png && echo OK` -> `OK`. Et `curl -sI http://localhost:3000/badge-previews/default-v1.png` retourne `200 OK` apres build. (Critere #2)
- [ ] **C3** : `grep -E "TemplateMeta|TemplateContext|BadgeTemplate" src/lib/badge-templates/types.ts | wc -l` -> >= `3`. (Critere #3)
- [ ] **C4** : `npx vitest run src/lib/badge-templates/` tous verts. (Critere #4)
- [ ] **C5** : `grep "badgeTemplateId" prisma/schema.prisma | wc -l` -> `3`. (Critere #5)
- [ ] **C6** : `npx vitest run src/lib/__tests__/resolve-badge-template-id.test.ts` tous verts. (Critere #6)
- [ ] **C7** : `make test && make test-e2e` -- verts. Suite `src/app/api/admin/**/badges/**/route.test.ts` valide nombre de pages PDF selon cascade. (Critere #7)
- [ ] **C8** : Smoke navigateur sur les 3 pages. Carte selectionnee visible, ligne "Template effectif" visible, bouton "heriter" present sur event/org (absent sur staff). (Critere #8)
- [ ] **C9** : `test -f scripts/validate-badge-templates.ts && grep "Validate badge templates" .github/workflows/ci.yml && echo OK` -> `OK`. (Critere #9)
- [ ] **C10** : `grep -E "settings/badge" docs/v2/features/{espace-evenement,espace-organisation,espace-staff}.md | wc -l` >= `3`. (Critere #10)
- [ ] **C11** : `npx tsx -e "..."` retourne `default-v1`. (Critere #11)
- [ ] **Final** : `make lint && make typecheck && make test && make test-e2e && make validate-badge-templates` -- tout vert.

Si un critere n'est pas rempli : remonter la task concernee, corriger, re-cocher. Une fois les 11 criteres OK + final tout vert, le plan est termine -- mettre a jour le tracker Progression avec dates de cloture.

---

## Risques connus et garde-fous

1. **Schema Prisma v2 master non encore applique** : si les models `Organization`, `OrgSettings`, `PlatformSettings`, `Event(orgId)` ne sont pas presents avant Task 5, le plan ne peut pas s'executer. Mitigation : Step 0.4 bloque et redirige vers la migration master.
2. **Helpers `requireEventPermission` / `requireOrgRole` / `requireStaff` absents** : specifies v2-01 mais peut-etre non livres. Si manquant : **arreter et demander** plutot que hard-coder un check ad-hoc.
3. **Preview PNG = placeholder 1x1** : pipeline OK mais qualite UI nulle. Mitigation : tracker explicite + PR designer dediee qui remplace les `preview.png` (changement isolable).
4. **`@react-pdf/renderer` cote serveur vs client** : `BadgeDocument.tsx` v1 utilise `"use client"`. Les templates v2 sont importes cote serveur. **Ne pas mettre `"use client"`** sur les `template.tsx` v2. Seul `BadgeTemplatePicker.tsx` doit l'avoir.
5. **`Font.register` execute plusieurs fois** : module Node cache -> evalue 1 fois. `Font.register` idempotent React-PDF. Pas de probleme connu.
6. **`Promise.resolve({...})` pour params Next 16** : App Router promet `params`. Si Vitest tourne sur Next 15- : adapter en passant l'objet direct.
7. **Route `/api/admin/[orgId]/events/[eventId]/badges/[badgeId]` creee par v2-04** : Step 12.1 verifie l'absence. Si conflit : coordonner avec auteur prealable, merger en un seul fichier.
8. **`ActivityType` manquants** (`EVENT_SETTINGS_UPDATE`, `ORG_SETTINGS_UPDATE`, `PLATFORM_SETTINGS_UPDATE`) : verifier l'enum dans Tasks 13-15 et ajouter au schema + push si manquants AVANT de coder la route.
9. **Helper `image-to-dataurl.ts` cote client uniquement** : utilise DOM canvas. Impossible en Node. Mitigation : Task 10 cree `readFileAsDataUrl` cote serveur dans `build-context.ts`. Ne pas importer le helper v1 cote serveur.
10. **`scripts/copy-badge-previews.ts` ne tourne pas en dev** : seulement au `prebuild`. Si l'admin charge la page en dev sans avoir fait `yarn build`, les preview `<img>` 404. Mitigation : documenter dans `make dev` ou ajouter un lifecycle hook.

---

## Notes pour l'agent qui execute ce plan

- **Ordre strict** : Tasks 1-2 (types + helpers) avant tout. Task 3 (default-v1) avant Task 4 (registry qui l'importe). Task 5 (schema) avant Task 6 (helper qui utilise les types Prisma). Tasks 11-15 dependent du registry + cascade + schema operationnels. Task 16 cloture (E2E + doc) en dernier.
- **TDD strict** : Tasks 4, 6, 9, 10, 12, 13, 14, 15 -- ecrire le test rouge avant l'implementation, executer pour voir le red, puis implementer, puis green. Pas de raccourci.
- **Pas d'amendement du plan en cours** : si tu decouvres un besoin non couvert, ajouter une task supplementaire (Task 17, 18, ...) avec commit dedie. Ne pas modifier silencieusement les tasks existantes.
- **Preview PNG = placeholder** : Tasks 7 et 8 livrent des PNG 1x1 deliberement nuls. C'est OK pour debloquer. Designer fournira les vrais PNG dans PR isolee qui remplace uniquement les fichiers `src/lib/badge-templates/<id>/preview.png`.
- **Pas de modification du code v1 badge** : `src/components/badge/BadgeDocument.tsx` reste intact. Ce plan ajoute une voie v2, ne migre pas v1. Coexistence temporaire jusqu'au deploiement v2.
- **Chemins absolus pour les commandes Bash mutantes** : `/Users/amadou/Devs/projects/badge/...`. Recuperer la racine via `pwd` si besoin.
- **Audit obligatoire** : les trois routes PATCH (Tasks 13, 14, 15) appellent `logActivity()`. Verifier que les `ActivityType` existent dans `prisma/schema.prisma` -- si manquants, ajouter + push avant.
- **Le commit final est manuel** : chaque task a son commit dedie pour faciliter `git revert` cible.
- **Push de branche : autorisation requise** : ne jamais pousser de votre propre chef.
