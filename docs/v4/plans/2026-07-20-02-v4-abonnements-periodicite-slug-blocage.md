# Abonnements v4 — periodicite, slug auto et blocage org sans abonnement — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Completer le systeme d'abonnements v4 avec quatre evolutions issues de `Todo.md` : (1) slug d'organisation en lecture seule genere en direct depuis le nom, (2) periodicite d'abonnement (mensuel = 30 j, annuel = 365 j) qui pilote automatiquement les dates de debut et de fin, (3) parcours complet « creation org -> fiche detail -> attribution d'un plan » couvert par un test Playwright, (4) blocage integral de l'espace organisation tant qu'aucun abonnement actif n'est attache (seul l'onglet Abonnement reste consultable).

**Architecture:** Next.js 16 App Router + Prisma 6 + MySQL 8. Le catalogue `Plan` et la relation `Subscription` (1-1 par org) existent deja, ainsi que `src/lib/subscription.ts` (`resolveOrgLimits`, `assertCanCreateEvent`, `assertCanRegister`, `SubscriptionError`). Ce plan **etend** l'existant : un enum `SubscriptionPeriod` + un champ `period` sur `Subscription`, un helper de calcul de dates, un helper `slugify` isomorphe partage client/serveur, un gate d'abonnement dans le layout serveur `src/app/org/[orgId]/layout.tsx` (le middleware Edge n'a pas acces Prisma, il se contente de propager le pathname via un header `x-pathname`), et un composant de notice bloquante reutilisant les primitives UI existantes.

**Tech Stack:** Next.js 16, React 19, Prisma 6, TypeScript 5, Zod, Vitest 4 (unitaire + integration MySQL), Playwright (E2E), primitives `src/components/ui/*` (`Alert`, `EmptyState`, `Input`, `Select`, `Button`).

## Global Constraints

- **Version cible : v4.** Toute la doc de ces changements vit dans `docs/v4/`.
- **Periodicite = pilote unique des dates.** Le staff choisit une periode (`MONTHLY`|`ANNUAL`) ; `startDate = maintenant` et `endDate = startDate + 30|365 jours` sont **calcules cote serveur**. Le formulaire ne saisit plus ni `startDate` ni `endDate`. Duree exacte : `MONTHLY = 30`, `ANNUAL = 365` (jours calendaires).
- **Blocage org inactif** : quand `resolveOrgLimits(orgId).active === false`, toutes les routes sous `/org/[orgId]/**` affichent un ecran bloquant **sauf** `/org/[orgId]/subscription` (lecture seule, pour que l'org voie son statut/dates). Message FR : « Votre abonnement est inactif. Contactez le staff Badge pour le reactiver. »
- **Langue** : UI/messages en francais avec accents ; identifiants, types, fonctions en anglais ; commentaires en francais (style ASCII des fichiers existants).
- **Server Components par defaut** ; `"use client"` seulement pour les formulaires interactifs (`OrgCreationForm`, `SubscriptionForm`).
- **Autorisation & audit** : toute route de mutation garde son `withStaffAuth({ minRole: "STAFF_ADMIN" })` et son `logActivity(...)` existant. Ne jamais exposer de secret. Le bypass staff audite (`QUOTA_BYPASS`) reste inchange.
- **Migration Prisma destructive-sensible** : en dev via `make db-push`. Le schema est **partage avec v1 (production)** — une migration Prisma versionnee est requise avant tout deploiement prod (hors perimetre de ce plan, a noter dans la doc).
- **Ne pas modifier le code applicatif `src/` pour faire passer un test** : les tests s'adaptent au code, jamais l'inverse (les helpers e2e sous `e2e/` ne sont pas du code applicatif et peuvent evoluer).
- **Avant tout commit** : `make lint && make typecheck && make test`. Commits en francais ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur** — les etapes « Commit » ne s'executent que sur demande.
- **Environnement** : commandes `make` dans le conteneur Docker dev (`make dev` prealable). Tests e2e depuis l'hote via `make test-e2e-ui` (env `DATABASE_URL`/`MAILPIT_URL` deja injectes sur `localhost`).

---

## Etat actuel (verifie) et analyse des ecarts

| Besoin (Todo.md) | Etat actuel | Ecart a combler |
|---|---|---|
| Slug readonly, genere des la fin de saisie du nom | `OrgCreationForm.tsx` : slug saisi **manuellement**, optionnel, sans preview. Generation serveur si vide (`slugifyName` + `nextAvailableSlug` dans `route.ts`, dupliquant `slugify-event.ts`) | Slug `readOnly` + preview live cote client ; helper `slugify` isomorphe partage |
| Abonnement avec periodicite (30/365 j) | `Subscription` a `startDate`/`endDate?` **saisis a la main**, aucune notion de periode | Enum `SubscriptionPeriod` + champ `period` ; calcul auto des dates ; refonte du form + de la route |
| Redirection creation -> fiche detail pour attribuer un plan + test Playwright | Redirection **deja en place** (`OrgCreationForm.tsx:56` -> `/platform/organizations/[orgId]`). Attribution deja implementee (`SubscriptionForm` + `PUT .../subscription`) | **Test Playwright de bout en bout manquant** |
| Sans abonnement actif, org bloquee sur le dashboard | Seules la **creation d'event** et l'**inscription** sont gardees (`assertCanCreateEvent`/`assertCanRegister`). Le layout org **ne verifie pas** l'abonnement. `NO_SUBSCRIPTION` defini mais jamais leve | Gate d'abonnement dans `layout.tsx` + notice bloquante + propagation `x-pathname` |
| MAJ doc + sort des plans | Doc `abonnements.md` marquee « a implementer » | MAJ doc ; **conserver** les plans (marquer Progression, pas de suppression) |

**Fichiers cles reperes (chemins absolus)** :
- Creation org : `src/components/staff/OrgCreationForm.tsx`, `src/app/platform/organizations/new/page.tsx`, `src/app/api/platform/organizations/route.ts`.
- Slug event (a reutiliser/factoriser) : `src/lib/slugify-event.ts`.
- Fiche detail org : `src/app/platform/organizations/[orgId]/page.tsx`.
- Attribution plan : `src/components/staff/SubscriptionForm.tsx`, `src/app/api/platform/organizations/[orgId]/subscription/route.ts`, `src/app/platform/organizations/[orgId]/subscription/page.tsx`.
- Abonnement/gardes : `src/lib/subscription.ts`, `prisma/schema.prisma` (Plan L447-455, SubscriptionStatus L457-461, Subscription L463-479, Organization.subscription L109, ActivityType L435-440).
- Espace org : `src/app/org/[orgId]/layout.tsx`, `src/app/org/[orgId]/page.tsx`, `src/app/org/[orgId]/subscription/page.tsx`, `src/components/admin/OrgShell.tsx`.
- Middleware : `src/middleware.ts`. Auth helpers : `src/lib/user-context.ts`, `src/lib/auth-helpers.ts`, `src/lib/auth.ts`.
- UI : `src/components/ui/Feedback.tsx` (`Alert`, `EmptyState`).
- Helpers e2e : `e2e/helpers/db.ts` (`createTestOrgWithOwner`, `createTestStaff`, `createTestEvent`), `e2e/helpers/auth.ts` (`loginAs`).

## Structure de fichiers

**Creer :**
```
src/lib/slugify.ts                              # slugify isomorphe (pur, sans Prisma) : reutilisable client + serveur
src/lib/__tests__/slugify.test.ts               # unit Vitest
src/lib/__tests__/subscription-period.test.ts   # unit Vitest (calcul des dates)
src/components/admin/SubscriptionBlockedNotice.tsx  # ecran bloquant org inactif (server component)
e2e/platform/subscription-flow.spec.ts          # E2E parcours complet + blocage
```

**Modifier :**
```
prisma/schema.prisma                            # enum SubscriptionPeriod + champ period
src/lib/subscription.ts                         # PERIOD_DAYS + computeSubscriptionDates
src/lib/slugify-event.ts                        # deleguer a slugify() (DRY)
src/app/api/platform/organizations/route.ts     # reutiliser slugify() (DRY, retire slugifyName local)
src/components/staff/OrgCreationForm.tsx         # slug readonly + preview live
src/components/staff/SubscriptionForm.tsx        # select periode a la place de startDate/endDate
src/app/api/platform/organizations/[orgId]/subscription/route.ts  # Zod period -> calcul dates
src/app/platform/organizations/[orgId]/subscription/page.tsx      # affichage periode
src/app/org/[orgId]/subscription/page.tsx        # affichage periode cote org (read-only)
src/middleware.ts                                # propage x-pathname
src/app/org/[orgId]/layout.tsx                   # gate abonnement actif
e2e/helpers/db.ts                                # variante org sans abonnement actif
docs/v4/features/abonnements.md                  # periode + blocage, statut implemente
docs/v4/architecture.md                          # section abonnements MAJ
docs/v4/README.md                                # statuts items 2/3
```

---

## Progression

> Tracker de reference. Statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned. Mettre a jour apres chaque task validee (tests verts + criteres OK), avec la date (AAAA-MM-JJ) et une note.

| Task | Intitule | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Periodicite : schema + helper de calcul des dates | [x] | 2026-07-20 | Enum `SubscriptionPeriod` + champ `period` nullable ; `PERIOD_DAYS` + `computeSubscriptionDates`. db-push OK (ajout non destructif). 4/4 vitest. |
| 2 | Helper `slugify` isomorphe partage (DRY) | [ ] | | |
| 3 | Form creation org : slug readonly + preview live | [ ] | | |
| 4 | Attribution d'abonnement pilotee par la periode | [ ] | | |
| 5 | Blocage de l'espace org sans abonnement actif | [ ] | | |
| 6 | Test E2E complet du parcours abonnement | [ ] | | |
| 7 | Documentation v4 + verification finale | [ ] | | |

---

## Task 1 : Periodicite — schema + helper de calcul des dates

**Files:**
- Modify: `prisma/schema.prisma` (enum apres `SubscriptionStatus` L461 ; champ dans `Subscription` L463-479)
- Modify: `src/lib/subscription.ts` (ajouts en tete de module)
- Test: `src/lib/__tests__/subscription-period.test.ts`

**Interfaces:**
- Produces :
  - enum Prisma `SubscriptionPeriod { MONTHLY, ANNUAL }`
  - champ `Subscription.period SubscriptionPeriod?` (nullable : les abonnements crees avant cette evolution restent valides ; `endDate` demeure la source de verite de `active`)
  - `export const PERIOD_DAYS: Record<SubscriptionPeriod, number>` = `{ MONTHLY: 30, ANNUAL: 365 }`
  - `export function computeSubscriptionDates(period: SubscriptionPeriod, from?: Date): { startDate: Date; endDate: Date }`

- [x] **Step 1 : Ecrire le test de calcul des dates (echoue)**

Creer `src/lib/__tests__/subscription-period.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { PERIOD_DAYS, computeSubscriptionDates } from "@/lib/subscription";

describe("computeSubscriptionDates", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("mensuel = +30 jours", () => {
    const { startDate, endDate } = computeSubscriptionDates("MONTHLY", from);
    expect(startDate).toEqual(from);
    expect(endDate).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });

  it("annuel = +365 jours", () => {
    const { endDate } = computeSubscriptionDates("ANNUAL", from);
    expect(endDate).toEqual(new Date("2026-12-31T00:00:00.000Z"));
  });

  it("PERIOD_DAYS expose 30 et 365", () => {
    expect(PERIOD_DAYS).toEqual({ MONTHLY: 30, ANNUAL: 365 });
  });

  it("startDate par defaut = maintenant (endDate > startDate)", () => {
    const { startDate, endDate } = computeSubscriptionDates("MONTHLY");
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });
});
```

- [x] **Step 2 : Lancer le test, verifier l'echec**

Run : `make test -- src/lib/__tests__/subscription-period.test.ts`
Expected : FAIL — `computeSubscriptionDates`/`PERIOD_DAYS` non exportes.

- [x] **Step 3 : Modifier le schema Prisma**

Dans `prisma/schema.prisma`, apres l'enum `SubscriptionStatus` (L457-461), ajouter :

```prisma
enum SubscriptionPeriod {
  MONTHLY // 30 jours
  ANNUAL // 365 jours
}
```

Dans `model Subscription` (apres `endDate DateTime?`, L471), ajouter :

```prisma
  // v4 : periodicite qui pilote le calcul de startDate/endDate a l'assignation.
  // Nullable pour les abonnements anterieurs a cette evolution.
  period    SubscriptionPeriod?
```

- [x] **Step 4 : Pousser le schema en base de dev**

Run : `make db-push`
Expected : « Your database is now in sync with your Prisma schema » + client regenere. (Action non destructive : ajout de colonne nullable + enum.)

- [x] **Step 5 : Implementer le helper**

Dans `src/lib/subscription.ts`, en tete de module (apres les imports), ajouter :

```ts
import type { SubscriptionPeriod } from "@prisma/client";

// Duree d'un abonnement selon sa periode (jours calendaires).
export const PERIOD_DAYS: Record<SubscriptionPeriod, number> = {
  MONTHLY: 30,
  ANNUAL: 365,
};

// Calcule les bornes d'un abonnement a partir de sa periode. `startDate` par
// defaut = maintenant ; `endDate` = startDate + duree de la periode.
export function computeSubscriptionDates(
  period: SubscriptionPeriod,
  from: Date = new Date(),
): { startDate: Date; endDate: Date } {
  const startDate = new Date(from);
  const endDate = new Date(from);
  endDate.setUTCDate(endDate.getUTCDate() + PERIOD_DAYS[period]);
  return { startDate, endDate };
}
```

- [x] **Step 6 : Lancer le test, verifier le succes**

Run : `make test -- src/lib/__tests__/subscription-period.test.ts`
Expected : PASS (4 tests).

- [x] **Step 7 : Typecheck**

Run : `make typecheck`
Expected : succes (le client Prisma regenere expose `SubscriptionPeriod`).

- [x] **Step 8 : Commit** (uniquement si l'utilisateur le demande)

```bash
git add prisma/schema.prisma src/lib/subscription.ts src/lib/__tests__/subscription-period.test.ts
git commit -m "feat(v4): periodicite abonnement (enum + calcul des dates)"
```

---

## Task 2 : Helper `slugify` isomorphe partage (DRY)

**Files:**
- Create: `src/lib/slugify.ts`
- Create: `src/lib/__tests__/slugify.test.ts`
- Modify: `src/lib/slugify-event.ts` (deleguer a `slugify`)
- Modify: `src/app/api/platform/organizations/route.ts` (reutiliser `slugify`, retirer `slugifyName` local)

**Interfaces:**
- Produces : `export function slugify(input: string, opts?: { maxLength?: number; fallback?: string }): string`
  - Algo : `NFD` -> retrait diacritiques -> minuscule -> `[^a-z0-9]+` -> `-` -> trim des `-` -> `slice(0, maxLength)` -> re-trim des `-` -> `fallback` si vide.
  - Defauts : `maxLength = 60`, `fallback = "org"`.
  - **Pur** (aucun import Prisma/serveur) pour etre importable depuis un Client Component.
- Consumes : `slugify-event.ts` et la route org l'appellent ; `nextAvailableSlug`/`uniqueEventSlug` (unicite via Prisma) restent cote serveur inchanges.

- [ ] **Step 1 : Ecrire le test (echoue)**

Creer `src/lib/__tests__/slugify.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("minuscule + tirets", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
  });
  it("retire les accents", () => {
    expect(slugify("Evenement Ete a Cote")).toBe("evenement-ete-a-cote");
  });
  it("compresse les separateurs et trim les tirets", () => {
    expect(slugify("  --Hello__World!!  ")).toBe("hello-world");
  });
  it("tronque a maxLength sans tiret final", () => {
    expect(slugify("a".repeat(80), { maxLength: 5 })).toBe("aaaaa");
    expect(slugify("aaaa bbbb", { maxLength: 5 })).toBe("aaaa");
  });
  it("fallback si vide", () => {
    expect(slugify("!!!")).toBe("org");
    expect(slugify("", { fallback: "x" })).toBe("x");
  });
});
```

- [ ] **Step 2 : Lancer, verifier l'echec**

Run : `make test -- src/lib/__tests__/slugify.test.ts`
Expected : FAIL — module `@/lib/slugify` introuvable.

- [ ] **Step 3 : Implementer `src/lib/slugify.ts`**

```ts
// Slugify isomorphe (client + serveur), sans dependance Prisma.
// L'unicite (suffixe -2, -3...) est geree separement cote serveur.
export function slugify(
  input: string,
  opts: { maxLength?: number; fallback?: string } = {},
): string {
  const { maxLength = 60, fallback = "org" } = opts;
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || fallback;
}
```

- [ ] **Step 4 : Deleguer `slugify-event.ts`**

Dans `src/lib/slugify-event.ts`, remplacer le corps de `slugifyEvent` par une delegation (l'event n'a ni troncature ni fallback historiquement — on conserve ce comportement en passant une longueur large et un fallback vide-securise) :

```ts
import { slugify } from "@/lib/slugify";

export function slugifyEvent(input: string): string {
  return slugify(input, { maxLength: 200, fallback: "event" });
}
```

Garder `uniqueEventSlug` inchange (il consomme `slugifyEvent`).

- [ ] **Step 5 : Reutiliser dans la route org**

Dans `src/app/api/platform/organizations/route.ts` :
- Ajouter en tete : `import { slugify } from "@/lib/slugify";`
- Supprimer la fonction locale `slugifyName` (L63-72).
- Remplacer la ligne de base du slug (L138) par :

```ts
const baseSlug = slug ?? slugify(name);
const finalSlug = await nextAvailableSlug(baseSlug);
```

Laisser `nextAvailableSlug` et `SLUG_RE` en place.

- [ ] **Step 6 : Lancer les tests concernes + regression**

Run : `make test -- src/lib/__tests__/slugify.test.ts`
Expected : PASS (5 tests).
Run : `make test -- src/lib/__tests__/slugify-event.test.ts` (si le fichier existe)
Expected : PASS (comportement event inchange).

- [ ] **Step 7 : Typecheck**

Run : `make typecheck`
Expected : succes.

- [ ] **Step 8 : Commit** (si demande)

```bash
git add src/lib/slugify.ts src/lib/__tests__/slugify.test.ts src/lib/slugify-event.ts src/app/api/platform/organizations/route.ts
git commit -m "refactor(v4): helper slugify isomorphe partage (org + event)"
```

---

## Task 3 : Form creation org — slug readonly + preview live

**Files:**
- Modify: `src/components/staff/OrgCreationForm.tsx`

**Interfaces:**
- Consumes : `slugify` (Task 2). Le slug affiche est derive du nom via `slugify(name)` ; l'unicite finale reste garantie cote serveur (`nextAvailableSlug`). En cas de collision, le serveur suffixe (`-2`) : c'est un comportement attendu, le champ n'est qu'une **preview de base**.
- Produces : le champ `slug` du formulaire devient `readOnly`, valeur derivee ; il n'est plus saisi. La soumission continue d'envoyer `slug` (la base) au `POST /api/platform/organizations` — le serveur reste seul juge de l'unicite.

- [ ] **Step 1 : Rendre le slug derive et en lecture seule**

Dans `src/components/staff/OrgCreationForm.tsx` (`"use client"`) :
- Importer : `import { slugify } from "@/lib/slugify";`
- Deriver le slug du nom plutot que de le stocker/saisir. Remplacer le champ slug (actuellement lignes ~81-86) par un champ en lecture seule dont la valeur suit le nom en direct :

```tsx
// Slug derive en direct du nom (lecture seule). Le serveur garantit l'unicite.
const derivedSlug = slugify(form.name);
```

```tsx
<Input
  label="Slug (genere automatiquement)"
  name="slug"
  value={derivedSlug}
  readOnly
  aria-readonly="true"
  placeholder="acme-corp"
/>
```

- Retirer `slug` de l'etat `FormState` (L12-24) et tout `onChange` qui l'ecrivait.
- A la soumission (L36-61), envoyer `slug: derivedSlug || undefined` (ne rien envoyer si le nom est vide encore) :

```tsx
body: JSON.stringify({
  name: form.name,
  slug: derivedSlug || undefined,
  ownerEmail: form.ownerEmail,
  ownerName: form.ownerName || undefined,
}),
```

- Conserver la redirection succes existante (`router.push(\`/platform/organizations/${json.org.id}\`)`, L56).

- [ ] **Step 2 : Verifier le rendu manuellement (navigateur)**

Run : `make dev` (si pas deja lance), ouvrir `https://badge.local/platform/organizations/new` (connecte en staff STAFF_ADMIN).
Attendu : en tapant « Salon Emploi 2026 » dans Nom, le champ Slug affiche `salon-emploi-2026` en temps reel, non editable (clic dans le champ n'accepte aucune frappe).

- [ ] **Step 3 : Lint + typecheck**

Run : `make lint && make typecheck`
Expected : succes (pas de variable `slug` d'etat orpheline).

- [ ] **Step 4 : Commit** (si demande)

```bash
git add src/components/staff/OrgCreationForm.tsx
git commit -m "feat(v4): slug org en lecture seule genere en direct"
```

> Le test E2E de ce comportement (preview live + readonly) est ecrit en Task 6 (parcours complet).

---

## Task 4 : Attribution d'abonnement pilotee par la periode

**Files:**
- Modify: `src/app/api/platform/organizations/[orgId]/subscription/route.ts` (Zod + calcul dates)
- Modify: `src/components/staff/SubscriptionForm.tsx` (select periode)
- Modify: `src/app/platform/organizations/[orgId]/subscription/page.tsx` (affichage periode staff)
- Modify: `src/app/org/[orgId]/subscription/page.tsx` (affichage periode org read-only)

**Interfaces:**
- Consumes : `computeSubscriptionDates` + `SubscriptionPeriod` (Task 1).
- Produces : le PUT accepte desormais `{ planId, status, period, overrideMaxEvents?, overrideMaxParticipantsPerEvent? }`. `startDate`/`endDate` ne sont **plus** acceptes en entree : ils sont calcules serveur (`computeSubscriptionDates(period)`). Le champ `period` est **requis**.

- [ ] **Step 1 : Ecrire le test d'integration de la route (echoue)**

Creer/etendre `src/app/api/platform/organizations/[orgId]/__tests__/subscription.route.test.ts` (suivre le pattern d'integration existant : vraie MySQL de dev, seed via helpers). Test golden path :

```ts
import { describe, it, expect, beforeAll } from "vitest";
// ... imports du harness d'integration existant (voir un *.route.test.ts voisin)

describe("PUT /api/platform/organizations/[orgId]/subscription", () => {
  it("assigne un abonnement mensuel et calcule endDate = +30j", async () => {
    // Arrange : creer un plan + une org (helpers d'integration du repo)
    const { orgId } = await seedOrg();
    const plan = await seedPlan({ maxEvents: 5 });

    // Act : PUT avec period MONTHLY (pas de startDate/endDate)
    const res = await callRoute("PUT", `/api/platform/organizations/${orgId}/subscription`, {
      body: { planId: plan.id, status: "ACTIVE", period: "MONTHLY" },
      as: staffAdmin,
    });

    // Assert
    expect(res.status).toBe(200);
    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    expect(sub?.period).toBe("MONTHLY");
    const days = Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });

  it("refuse period manquante (400)", async () => {
    const { orgId } = await seedOrg();
    const plan = await seedPlan({});
    const res = await callRoute("PUT", `/api/platform/organizations/${orgId}/subscription`, {
      body: { planId: plan.id, status: "ACTIVE" },
      as: staffAdmin,
    });
    expect(res.status).toBe(400);
  });
});
```

> Adapter `seedOrg`/`seedPlan`/`callRoute`/`staffAdmin` aux utilitaires d'integration reels du repo (cf. un test `*.route.test.ts` voisin pour le harness exact). Ne pas mocker Prisma.

- [ ] **Step 2 : Lancer, verifier l'echec**

Run : `make test -- subscription.route.test.ts`
Expected : FAIL — la route ne connait pas `period` (Zod le rejette ou l'ignore, endDate non calcule).

> Note : `make test` utilise la MySQL de dev et **efface les donnees dev** ; re-seeder ensuite (`make db-seed`) si besoin de donnees manuelles.

- [ ] **Step 3 : Mettre a jour la route PUT**

Dans `src/app/api/platform/organizations/[orgId]/subscription/route.ts` :
- Importer : `import { computeSubscriptionDates } from "@/lib/subscription";`
- Remplacer `upsertSchema` (L7-18) : retirer `startDate`/`endDate`, ajouter `period` requis :

```ts
const upsertSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]),
  period: z.enum(["MONTHLY", "ANNUAL"]),
  overrideMaxEvents: z.number().int().min(0).nullable().optional(),
  overrideMaxParticipantsPerEvent: z.number().int().min(0).nullable().optional(),
});
```

- Avant l'`upsert` (L52-56), calculer les dates puis les inclure dans `create` et `update` :

```ts
const { startDate, endDate } = computeSubscriptionDates(data.period);
const sub = await prisma.subscription.upsert({
  where: { orgId },
  create: {
    orgId,
    planId: data.planId,
    status: data.status,
    period: data.period,
    startDate,
    endDate,
    overrideMaxEvents: data.overrideMaxEvents ?? null,
    overrideMaxParticipantsPerEvent: data.overrideMaxParticipantsPerEvent ?? null,
  },
  update: {
    planId: data.planId,
    status: data.status,
    period: data.period,
    startDate,
    endDate,
    overrideMaxEvents: data.overrideMaxEvents ?? null,
    overrideMaxParticipantsPerEvent: data.overrideMaxParticipantsPerEvent ?? null,
  },
});
```

- Conserver le `logActivity` `SUBSCRIPTION_CREATED`/`SUBSCRIPTION_UPDATED` (L58-65) et la garde `withStaffAuth({ minRole: "STAFF_ADMIN" })`.

- [ ] **Step 4 : Mettre a jour `SubscriptionForm.tsx`**

Dans `src/components/staff/SubscriptionForm.tsx` (`"use client"`) :
- Retirer les champs `startDate` et `endDate` de l'etat et du rendu.
- Ajouter un `<Select>` periode (defaut `MONTHLY`) :

```tsx
<Select
  label="Periode"
  name="period"
  value={form.period}
  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as "MONTHLY" | "ANNUAL" }))}
>
  <option value="MONTHLY">Mensuel (30 jours)</option>
  <option value="ANNUAL">Annuel (365 jours)</option>
</Select>
```

- Initialiser `form.period` depuis `current?.period ?? "MONTHLY"`.
- Le corps de `PUT` envoie `{ planId, status, period, overrideMaxEvents, overrideMaxParticipantsPerEvent }` (plus de dates).
- Conserver `router.refresh()` apres succes.

- [ ] **Step 5 : Afficher la periode (staff + org read-only)**

Dans `src/app/platform/organizations/[orgId]/subscription/page.tsx` et `src/app/org/[orgId]/subscription/page.tsx`, ajouter une ligne « Periode » a cote du statut/dates, avec un libelle FR :

```tsx
const periodLabel = sub?.period === "ANNUAL" ? "Annuel" : sub?.period === "MONTHLY" ? "Mensuel" : "—";
// ... dans le KeyValue/Card : <KeyValue k="Periode" v={periodLabel} />
```

S'assurer que la requete Prisma de ces pages selectionne bien `period` (ajouter au `select` si un select explicite existe).

- [ ] **Step 6 : Lancer le test d'integration**

Run : `make test -- subscription.route.test.ts`
Expected : PASS (golden path +30j, 400 si period manquante).

- [ ] **Step 7 : Verification navigateur**

Ouvrir `https://badge.local/platform/organizations/<id>/subscription` : choisir « Annuel », enregistrer, verifier que la fiche org affiche un abonnement actif avec periode « Annuel » et une date de fin a ~1 an. Verifier cote org (`/org/<id>/subscription`) l'affichage read-only de la periode.

- [ ] **Step 8 : Lint + typecheck**

Run : `make lint && make typecheck`
Expected : succes.

- [ ] **Step 9 : Commit** (si demande)

```bash
git add src/app/api/platform/organizations/\[orgId\]/subscription/route.ts src/components/staff/SubscriptionForm.tsx src/app/platform/organizations/\[orgId\]/subscription/page.tsx src/app/org/\[orgId\]/subscription/page.tsx
git commit -m "feat(v4): abonnement pilote par la periode (dates calculees)"
```

---

## Task 5 : Blocage de l'espace org sans abonnement actif

**Files:**
- Modify: `src/middleware.ts` (propager `x-pathname`)
- Create: `src/components/admin/SubscriptionBlockedNotice.tsx`
- Modify: `src/app/org/[orgId]/layout.tsx` (gate abonnement)

**Interfaces:**
- Consumes : `resolveOrgLimits(orgId)` (existant, retourne `{ active }`). Le pathname courant via le header `x-pathname` pose par le middleware.
- Produces : quand `active === false`, le layout rend `<SubscriptionBlockedNotice orgId={orgId} />` a la place de `{children}`, **sauf** si la route se termine par `/subscription` (onglet consultable). Le middleware garantit que `headers().get("x-pathname")` est disponible dans les Server Components sous `/org`.

- [ ] **Step 1 : Propager le pathname dans le middleware**

Dans `src/middleware.ts`, dans le flux nominal (apres les redirections auth/staff, la ou l'acces est autorise), remplacer le `NextResponse.next()` par une variante qui ajoute le pathname en header de requete :

```ts
const requestHeaders = new Headers(req.headers);
requestHeaders.set("x-pathname", req.nextUrl.pathname);
return NextResponse.next({ request: { headers: requestHeaders } });
```

Ne pas modifier les branches de redirection existantes (`/login`, `/`, 401/403 API).

- [ ] **Step 2 : Creer le composant de notice bloquante**

Creer `src/components/admin/SubscriptionBlockedNotice.tsx` (Server Component), reutilisant `EmptyState`/`Alert` de `src/components/ui/Feedback.tsx` et `Button`/`Link` :

```tsx
import Link from "next/link";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export function SubscriptionBlockedNotice({ orgId }: { orgId: string }) {
  return (
    <EmptyState
      icon={<Icon name="alert-triangle" size={28} />}
      title="Abonnement inactif"
      description="Votre abonnement est inactif. Contactez le staff Badge pour le reactiver."
      action={
        <Link
          href={`/org/${orgId}/subscription`}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Voir mon abonnement
        </Link>
      }
    />
  );
}
```

> Adapter les props exactes de `EmptyState` a sa signature reelle (`src/components/ui/Feedback.tsx:19`). Si `EmptyState` n'accepte pas `action`, envelopper l'`Alert tone="warn"` + le lien manuellement.

- [ ] **Step 3 : Ajouter le gate dans le layout org**

Dans `src/app/org/[orgId]/layout.tsx`, **apres** le gate de role existant (la ou l'acces org est confirme, ~L36-52) et avant de rendre `{children}` :

```tsx
import { headers } from "next/headers";
import { resolveOrgLimits } from "@/lib/subscription";
import { SubscriptionBlockedNotice } from "@/components/admin/SubscriptionBlockedNotice";

// ... apres resolution du role org (orgRole) :
const { active } = await resolveOrgLimits(orgId);
const pathname = (await headers()).get("x-pathname") ?? "";
const onSubscriptionTab = pathname.endsWith(`/subscription`);

const content = active || onSubscriptionTab
  ? children
  : <SubscriptionBlockedNotice orgId={orgId} />;

return (
  <OrgShell orgId={orgId} orgRole={orgRole} /* ...props existantes... */>
    {content}
  </OrgShell>
);
```

Garder `OrgShell` (header + nav) autour du contenu pour la coherence visuelle ; seul le corps (`children`) est remplace par la notice.

- [ ] **Step 4 : Verification navigateur — cas bloque**

Preparer une org dont l'abonnement est `EXPIRED` (ou sans abonnement) via Prisma Studio (`make db-studio`) ou la fiche staff. Se connecter en OWNER de cette org :
- `https://badge.local/org/<id>` -> affiche la notice « Abonnement inactif » (pas le dashboard).
- `https://badge.local/org/<id>/events` -> affiche aussi la notice.
- `https://badge.local/org/<id>/subscription` -> **accessible** (page read-only du statut).

- [ ] **Step 5 : Verification navigateur — cas actif (non-regression)**

Sur une org avec abonnement `ACTIVE` non echu : toutes les pages s'affichent normalement (dashboard, events, members...).

- [ ] **Step 6 : Lint + typecheck**

Run : `make lint && make typecheck`
Expected : succes.

- [ ] **Step 7 : Commit** (si demande)

```bash
git add src/middleware.ts src/components/admin/SubscriptionBlockedNotice.tsx src/app/org/\[orgId\]/layout.tsx
git commit -m "feat(v4): blocage espace org sans abonnement actif (hors onglet abonnement)"
```

> **Hors-scope (durcissement, a noter dans la doc, pas dans ce plan)** : le blocage est au niveau UI/pages. Un appel API direct de mutation (`POST /api/org/[orgId]/members`, `PUT .../settings`, `.../templates`) n'est pas garde par l'abonnement (seules la creation d'event et l'inscription le sont deja). Si un durcissement « API mutation bloquee si inactif » est souhaite, il fera l'objet d'un plan dedie (helper `assertActiveSubscription(orgId)` applique route par route).

---

## Task 6 : Test E2E complet du parcours abonnement

**Files:**
- Modify: `e2e/helpers/db.ts` (variante org sans abonnement actif)
- Create: `e2e/platform/subscription-flow.spec.ts`

**Interfaces:**
- Consumes : helpers `e2e/helpers/db.ts` (`createTestStaff`, `createTestOrgWithOwner`, `createTestUser`, `getDb`), `e2e/helpers/auth.ts` (`loginAs`). UI : `/platform/organizations/new`, `/platform/organizations/[orgId]/subscription`, `/org/[orgId]`, `/org/[orgId]/subscription`.
- Produces : couverture E2E du golden path (creation -> redirection fiche -> attribution plan+periode -> abonnement actif) et du cas bloque (org sans abonnement actif -> notice, onglet abonnement accessible).

- [ ] **Step 1 : Ajouter un helper org sans abonnement actif**

Dans `e2e/helpers/db.ts`, etendre `createTestOrgWithOwner` avec une option `activeSubscription` (defaut `true` pour ne pas casser les specs existantes). Quand `false`, ne pas creer de `Subscription` (l'org est alors inactive) :

```ts
export async function createTestOrgWithOwner(opts: {
  scope: string;
  maxEvents?: number;
  maxParticipantsPerEvent?: number;
  activeSubscription?: boolean; // defaut true
}): Promise<{ orgId: string; owner: TestUser }> {
  const prisma = db();
  const slugSuffix = `${opts.scope}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const org = await prisma.organization.create({
    data: { name: `E2E Org ${opts.scope}`, slug: `e2e-org-${slugSuffix}` },
  });
  if (opts.activeSubscription ?? true) {
    const plan = await prisma.plan.create({
      data: {
        name: `e2e-plan-${slugSuffix}`,
        maxEvents: opts.maxEvents ?? null,
        maxParticipantsPerEvent: opts.maxParticipantsPerEvent ?? null,
      },
    });
    await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, status: "ACTIVE", period: "MONTHLY" },
    });
  }
  const owner = await createTestUser({ scope: `org-owner-${opts.scope}`, verified: true });
  await prisma.orgMembership.create({
    data: { userId: owner.id, orgId: org.id, role: "OWNER" },
  });
  return { orgId: org.id, owner };
}
```

- [ ] **Step 2 : Ecrire le spec E2E (echoue en partie tant que Tasks 3/4/5 absentes)**

Creer `e2e/platform/subscription-flow.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import { createTestStaff, createTestOrgWithOwner, getDb } from "../helpers/db";
import { loginAs } from "../helpers/auth";

test.describe("Parcours abonnement org", () => {
  test("creation org -> slug auto -> attribution plan mensuel -> abonnement actif", async ({ page }) => {
    const staff = await createTestStaff({ scope: "sub-flow", role: "STAFF_ADMIN" });
    // Un plan doit exister au catalogue pour etre selectionnable.
    const plan = await getDb().plan.create({
      data: { name: `e2e-catalog-${Date.now()}`, maxEvents: 5, maxParticipantsPerEvent: 200 },
    });
    await loginAs(page, staff);

    // 1. Creation
    await page.goto("/platform/organizations/new");
    await page.getByLabel("Nom").fill("Salon Emploi E2E");
    // Slug genere en direct, en lecture seule
    await expect(page.getByLabel(/Slug/)).toHaveValue("salon-emploi-e2e");
    await expect(page.getByLabel(/Slug/)).toHaveAttribute("readonly", "");
    await page.getByLabel("Email de l'OWNER").fill(`owner-subflow-${Date.now()}@v2-11-e2e.test`);
    await page.getByRole("button", { name: /Creer/ }).click();

    // 2. Redirection vers la fiche detail
    await expect(page).toHaveURL(/\/platform\/organizations\/[^/]+$/);
    const orgId = page.url().split("/").pop()!;

    // 3. Attribution plan + periode mensuelle
    await page.goto(`/platform/organizations/${orgId}/subscription`);
    await page.getByLabel("Plan").selectOption(plan.id);
    await page.getByLabel("Periode").selectOption("MONTHLY");
    await page.getByLabel("Statut").selectOption("ACTIVE");
    await page.getByRole("button", { name: /Enregistrer/ }).click();

    // 4. Abonnement actif en base : endDate ~ +30j
    await expect(async () => {
      const sub = await getDb().subscription.findUnique({ where: { orgId } });
      expect(sub?.status).toBe("ACTIVE");
      expect(sub?.period).toBe("MONTHLY");
      const days = Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000);
      expect(days).toBe(30);
    }).toPass();
  });

  test("org sans abonnement actif : dashboard bloque, onglet abonnement accessible", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({
      scope: "sub-blocked",
      activeSubscription: false,
    });
    await loginAs(page, owner);

    // Dashboard bloque
    await page.goto(`/org/${orgId}`);
    await expect(page.getByText("Abonnement inactif")).toBeVisible();
    await expect(page.getByText(/Contactez le staff/)).toBeVisible();

    // Une autre sous-page est bloquee aussi
    await page.goto(`/org/${orgId}/events`);
    await expect(page.getByText("Abonnement inactif")).toBeVisible();

    // L'onglet abonnement reste consultable (pas le message de blocage plein ecran)
    await page.goto(`/org/${orgId}/subscription`);
    await expect(page.getByRole("heading", { name: /Abonnement/ })).toBeVisible();
  });
});
```

> Ajuster les libelles exacts (`getByLabel("Nom")`, `"Email de l'OWNER")`, bouton `"Creer"`/`"Enregistrer"`) aux textes reels des composants. Verifier la signature de `createTestStaff` dans `db.ts`.

- [ ] **Step 3 : Lancer le spec (doit passer une fois Tasks 3/4/5 livrees)**

Run (depuis l'hote) : `make test-e2e-ui` puis filtrer sur `subscription-flow`, ou en CLI conteneur :
`docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/subscription-flow.spec.ts`
Expected : 2 tests PASS.

- [ ] **Step 4 : Lint + typecheck**

Run : `make lint && make typecheck`
Expected : succes.

- [ ] **Step 5 : Commit** (si demande)

```bash
git add e2e/helpers/db.ts e2e/platform/subscription-flow.spec.ts
git commit -m "test(v4): parcours e2e abonnement (creation, attribution, blocage)"
```

---

## Task 7 : Documentation v4 + verification finale

**Files:**
- Modify: `docs/v4/features/abonnements.md`
- Modify: `docs/v4/architecture.md`
- Modify: `docs/v4/README.md`
- Modify: ce plan (section `## Progression`)

- [ ] **Step 1 : Mettre a jour `docs/v4/features/abonnements.md`**

- Passer le statut de « a implementer » a « implemente » (le code fait foi).
- Ajouter une sous-section « Periodicite » : `SubscriptionPeriod (MONTHLY=30j, ANNUAL=365j)`, dates calculees a l'assignation, `endDate` source de verite de `active`.
- Ajouter une sous-section « Blocage org inactif » : le layout `org/[orgId]` rend une notice bloquante quand `!active`, sauf l'onglet `subscription`. Preciser le durcissement API mutation comme hors-scope (renvoyer au point Hors-scope de Task 5).
- Mettre a jour la section « UI » (le form staff choisit une periode, plus de dates manuelles).

- [ ] **Step 2 : Mettre a jour `docs/v4/architecture.md`**

Section « Abonnements » (L81-92) : retirer « (a implementer) », ajouter la periodicite et le blocage layout, conserver la note migration Prisma prod (schema partage v1).

- [ ] **Step 3 : Mettre a jour `docs/v4/README.md`**

Passer les items 2 (retrait quotas) et 3 (abonnements) au statut adequat, referencer ce plan.

- [ ] **Step 4 : Verification finale complete**

Run : `make lint && make typecheck && make test`
Expected : lint sans warning, typecheck OK, suite Vitest verte (dont `slugify`, `subscription-period`, integration subscription route).
Run (E2E) : `make test-e2e-ui` (ou CLI conteneur) sur `e2e/platform/subscription-flow.spec.ts`.
Expected : 2 tests PASS. (Rappel memoire : la suite E2E globale a ~53 echecs pre-existants ; comparer a la baseline, ne pas se fier au compte brut.)

- [ ] **Step 5 : Mettre a jour le tracker `## Progression`**

Passer chaque Task a `[x]` avec la date du jour et une note. **Ne pas supprimer** ce plan ni les autres plans v4 (decision : conservation ; le point « supprimer les plans » de `Todo.md` est volontairement non applique, conformement a la convention projet).

- [ ] **Step 6 : Commit** (si demande)

```bash
git add docs/v4/features/abonnements.md docs/v4/architecture.md docs/v4/README.md docs/v4/plans/2026-07-20-02-v4-abonnements-periodicite-slug-blocage.md
git commit -m "docs(v4): abonnements periodicite + blocage org, tracker plan"
```

---

## Auto-revue (couverture de la spec)

- **Slug readonly + live** (Todo pt 1) -> Task 2 (helper) + Task 3 (form) + Task 6 (E2E assert readonly/preview). ✅
- **Periodicite 30/365 + dates calculees** (Todo pt 2, decision « periode uniquement ») -> Task 1 (schema+calcul) + Task 4 (route+form) + tests Task 1/4/6. ✅
- **Redirection creation -> fiche -> attribution plan + test Playwright** (Todo pt 3) -> redirection deja existante (documentee) + Task 6 (E2E complet). ✅
- **Blocage org sans abonnement actif, message contacter staff** (Todo pt 4, decision « tout sauf onglet abonnement ») -> Task 5 (middleware + layout + notice) + Task 6 (E2E bloque). ✅
- **MAJ doc + sort des plans** (Todo pt 5, decision « conserver + marquer termine ») -> Task 7. Suppression volontairement non appliquee (convention projet), tracee. ✅
- **Coherence des noms** : `SubscriptionPeriod`, `PERIOD_DAYS`, `computeSubscriptionDates`, `slugify`, `SubscriptionBlockedNotice`, header `x-pathname` — utilises identiquement d'une task a l'autre. ✅
- **Migration prod** : notee comme pre-requis hors-scope (schema partage v1). ✅
