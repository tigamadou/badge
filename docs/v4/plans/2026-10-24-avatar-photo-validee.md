# Photo validée affichée comme avatar — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une fois le profil validé par le staff, la photo de la **dernière
`ProfileSubmission` au statut `APPROVED`** remplace les initiales dans l'en-tête des
espaces `/account`, `/platform`, `/org/[orgId]` et `/event/[eventId]`, y compris dans les
gabarits opérateur, imprimeur et lecteur. Sans soumission approuvée, ou si l'image ne
charge pas, l'en-tête garde les initiales.

**Architecture :** un helper serveur `getApprovedPhotoUrl(userId)`, dans le nouveau
fichier `src/lib/approved-photo.ts`, renvoie `/api/files/<clé>` ou `null`. Les quatre
`layout.tsx` d'espace l'appellent une fois et passent le résultat à la prop
`photoUrl` des gabarits, livrée par le socle. Le composant client `UserAvatar`
(contrat C3) affiche la photo en cercle et revient aux initiales sur `onError`. Il
détecte aussi une image déjà en échec avant l'hydratation. **Les gabarits ne sont pas
modifiés.** La route `/api/files/[...path]` non plus : les photos de profil restent
publiques.

**Tech Stack :** Next.js 16 App Router (Server Components pour les layouts), React 19,
Tailwind CSS 4, Prisma 6 / MySQL 8, Vitest 4 (environnement `node`, rendu
`renderToStaticMarkup`, vraie base de test), Playwright (projet `chromium`).

**Spec :** [`docs/v4/specs/2026-10-24-27-v4-avatar-photo-validee.md`](../specs/2026-10-24-27-v4-avatar-photo-validee.md)
— coordination : [spec 22, contrat C3](../specs/2026-10-24-22-v4-lot-notifications-coordination.md)

**Branche :** `feat/avatar-photo-validee` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | `UserAvatar` affiche la photo, repli sur les initiales | [x] | 2026-10-24 | `UserAvatarView` + `failedUrl`/`imgRef` ; 7 tests verts |
| 2 | Helper `getApprovedPhotoUrl` (`src/lib/approved-photo.ts`) | [x] | 2026-10-24 | 7 tests verts, 100 % sur le fichier |
| 3 | Brancher `photoUrl` dans les quatre layouts (e2e d'abord) | [x] | 2026-10-24 | `avatar.spec.ts` 4/4 ; e2e responsive/logout verts |
| 4 | Documentation | [x] | 2026-10-24 | validation-profils.md + README |
| — | Vérification finale | [~] | 2026-10-24 | commandes vertes ; reste la vérification navigateur (lead) |

## Contraintes globales

- **Lire avant de coder** : `CLAUDE.md` (racine) et `.claude/CLAUDE.md`.
- **Pré-requis** : le socle (vague 0, spec 22) est fusionné dans `development`. Vérifier
  avant la task 1 que `src/components/layout/UserAvatar.tsx` existe avec la signature
  C3. Vérifier aussi que les six gabarits (`StaffShell`, `OrgShell`, `EventShell`,
  `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell`) acceptent
  `photoUrl?: string | null` et que `src/app/account/layout.tsx` rend `<UserAvatar />`.
  Si l'un manque, **s'arrêter et signaler** : ce chantier ne modifie pas les gabarits.
- **Périmètre de fichiers (spec 22)** : ce chantier possède `UserAvatar.tsx` et
  `src/lib/approved-photo.ts`. Il ne touche les quatre `layout.tsx` d'espace **que pour
  calculer et passer `photoUrl`**. Aucune autre modification de `src/`.
- **Commandes** : toutes passent par le conteneur dev (`make dev` démarré).
  - Lint, types, tests : `make lint`, `make typecheck`, `make test`.
  - Un seul fichier Vitest (pas de cible `make` dédiée) :
    `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`.
  - Un seul fichier e2e :
    `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test <chemin>`.
- **`make test` vide la base de dev**, comme tout lancement de Vitest, même sur un seul
  fichier (`src/test-setup.ts`). Lancer `make db-seed` avant toute vérification navigateur.
- **Couverture 100 %** obligatoire sur `src/lib/**` et `src/app/api/**` (seuils Vitest).
  Le nouveau helper doit être couvert à 100 %. **Pas de mock de Prisma** : les tests
  tournent sur la vraie base.
- **Server Components par défaut** : seul `UserAvatar` porte `"use client"`. Le helper
  est appelé côté serveur uniquement.
- **Pas de nouvelle dépendance.** `<img>` natif, avec
  `// eslint-disable-next-line @next/next/no-img-element`, comme dans
  `src/components/ui/FileBox.tsx`. `next/image` passerait la route de fichiers par
  l'optimiseur sans bénéfice pour une pastille de 30 px.
- **Langue** : UI en français avec accents ; code et identifiants en anglais ;
  commentaires en français, dans le style du fichier.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Une étape « commit » de
  ce plan n'est pas une demande. Message en conventional commit, français ASCII, **sans
  trailer de co-auteur IA**. Avant tout commit : `make lint && make typecheck && make test`.
- **Aucune étape de déploiement ni de SSH.** Le plan s'arrête à `development` vert en local.

## Points de vigilance de revue

Cas que la spec implique sans les nommer dans ses critères. Chacun a son test dans la
task indiquée.

1. **Plusieurs soumissions approuvées** : c'est la plus récente (`createdAt` décroissant)
   qui gagne, pas la première trouvée. Les tests fixent `createdAt` explicitement :
   MySQL arrondit à la milliseconde, et deux insertions successives peuvent avoir la
   même date. → Task 2, test `returns the most recent approved submission`.
2. **Soumission approuvée, puis nouvelle soumission rejetée** : la règle « dernière
   `APPROVED` » garde l'ancienne photo, alors que `User.profileStatus` vaut `REJECTED`.
   Le plan suit la section *Conception* de la spec (voir la décision à confirmer dans le
   rapport). → Task 2, test `keeps the previous approved photo when a newer submission is
   rejected`.
3. **Soumission approuvée, puis nouvelle en attente** (critère 3 de la spec) : l'avatar
   reste l'ancienne photo. → Task 2 (helper) et Task 3 (e2e, la `src` est celle de
   l'ancienne clé).
4. **Fichier manquant ou illisible**, y compris quand l'image échoue **avant
   l'hydratation**. Dans ce cas React n'appelle pas `onError` : l'événement a eu lieu
   avant que l'écouteur soit attaché. C'est le cas du seed, dont les clés
   `uploads/profile/seed/*.jpg` n'existent pas sur le disque. → Task 1 (rendu de
   `UserAvatarView` en mode échec) et Task 3 (e2e : aucune `<img>`, initiales visibles).
5. **Isolation par utilisateur** : la soumission approuvée d'un autre utilisateur ne doit
   jamais être renvoyée. Un utilisateur sans soumission obtient `null`. → Task 2, tests
   `returns null when the user has no submission` et `ignores other users' approved
   submissions`.

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/components/layout/UserAvatar.tsx` | Modifier | Photo en cercle, repli `onError` et détection d'échec avant hydratation |
| `src/components/layout/__tests__/UserAvatar.test.tsx` | Modifier (ou créer si le socle ne l'a pas livré) | Rendu statique photo / initiales / échec |
| `src/lib/approved-photo.ts` | Créer | `getApprovedPhotoUrl(userId)` |
| `src/lib/__tests__/approved-photo.test.ts` | Créer | Tests d'intégration sur la vraie base |
| `src/app/platform/layout.tsx` | Modifier | Passe `photoUrl` à `StaffShell` |
| `src/app/org/[orgId]/layout.tsx` | Modifier | Passe `photoUrl` à `OrgShell` |
| `src/app/event/[eventId]/layout.tsx` | Modifier | Passe `photoUrl` aux quatre gabarits d'évènement |
| `src/app/account/layout.tsx` | Modifier | Passe `photoUrl` à `<UserAvatar />` |
| `e2e/helpers/db.ts` | Modifier | `createTestProfileSubmission` accepte `photo` et `createdAt` |
| `e2e/transverse/avatar.spec.ts` | Créer | Parcours dans les quatre espaces |
| `docs/v4/features/validation-profils.md`, `docs/v4/README.md` | Modifier | Documentation |

---

## Task 1 — `UserAvatar` affiche la photo, repli sur les initiales

**Fichiers :**
- Modifier : `src/components/layout/UserAvatar.tsx`
- Modifier ou créer : `src/components/layout/__tests__/UserAvatar.test.tsx`

**Interfaces :**

```ts
// Inchangé (contrat C3)
export function UserAvatar(props: {
  name: string | null;
  photoUrl?: string | null;
  size?: number; // défaut 32
}): JSX.Element;

// Nouveau, exporté pour les tests (Vitest tourne en environnement node, sans DOM ni
// événement : même principe que DialogPanel / ModalPanel).
export function UserAvatarView(props: {
  name: string | null;
  photoUrl: string | null; // null => initiales
  size: number;
  onError?: () => void;
  imgRef?: React.Ref<HTMLImageElement>;
}): JSX.Element;
```

Comportement :
- La racine porte `data-testid="user-avatar"`, un cercle de `size` × `size` px (style
  inline `width`/`height`), `flex-none overflow-hidden rounded-full`. Les classes de la
  pastille d'initiales restent celles du socle.
- Si `photoUrl` est non nul, rendre
  `<img src={photoUrl} alt="Photo de profil" className="h-full w-full object-cover" />`,
  sinon les initiales du socle (helper existant, ne pas le dupliquer).
- `UserAvatar` garde l'URL en échec (`const [failedUrl, setFailedUrl] =
  useState<string | null>(null)`) et passe `photoUrl` à la vue seulement si
  `photoUrl && photoUrl !== failedUrl`. Si l'URL change, une nouvelle photo approuvée est
  donc retentée sans remontage.
- `onError` appelle `setFailedUrl(photoUrl)`.
- Échec avant hydratation : un `useEffect` lit l'`<img>` via `imgRef`. Si
  `img.complete && img.naturalWidth === 0`, il appelle `setFailedUrl(photoUrl)`.
  Commentaire attendu : l'image a pu échouer avant que React attache `onError`.

**Étapes :**

- [ ] Écrire les tests (ajouter au fichier du socle s'il existe, sans casser ses cas) :

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { UserAvatar, UserAvatarView } from "../UserAvatar";

it("affiche la photo en cercle quand photoUrl est fourni", () => {
  const html = renderToStaticMarkup(
    <UserAvatar name="Awa Diallo" photoUrl="/api/files/profile/u1/photos/p.png" size={30} />,
  );
  expect(html).toContain('src="/api/files/profile/u1/photos/p.png"');
  expect(html).toContain('alt="Photo de profil"');
  expect(html).toContain("object-cover");
  expect(html).toContain("rounded-full");
  expect(html).not.toContain(">AD<");
});

it("affiche les initiales sans photoUrl", () => {
  for (const photoUrl of [null, undefined]) {
    const html = renderToStaticMarkup(<UserAvatar name="Awa Diallo" photoUrl={photoUrl} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("AD");
  }
});

it("UserAvatarView en échec (photoUrl null) rend les initiales et la taille demandée", () => {
  const html = renderToStaticMarkup(<UserAvatarView name="Awa Diallo" photoUrl={null} size={30} />);
  expect(html).not.toContain("<img");
  expect(html).toContain("AD");
  expect(html).toContain("width:30px");
  expect(html).toContain('data-testid="user-avatar"');
});

it("nom absent : repli « ? » même sans photo", () => {
  expect(renderToStaticMarkup(<UserAvatar name={null} />)).toContain("?");
});
```

- [ ] Lancer
  `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/layout/__tests__/UserAvatar.test.tsx`.
  Échec attendu : `UserAvatarView` n'est pas exporté, et le test « affiche la photo »
  ne trouve pas `<img`.
- [ ] Implémenter `UserAvatarView` et l'état `failedUrl` dans
  `src/components/layout/UserAvatar.tsx` (garder `"use client"`).
- [ ] Relancer le fichier : vert. Puis `make lint && make typecheck`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): UserAvatar affiche la photo avec repli sur les initiales`.

**Critères d'acceptation :** tests verts ; gabarits inchangés ; le rendu sans
`photoUrl` est identique à celui du socle (les tests du socle passent toujours).

## Task 2 — Helper `getApprovedPhotoUrl`

**Fichiers :**
- Créer : `src/lib/approved-photo.ts`, `src/lib/__tests__/approved-photo.test.ts`

**Interfaces :**

```ts
// src/lib/approved-photo.ts
// URL publique de la photo de la derniere soumission APPROVED, ou null.
export async function getApprovedPhotoUrl(userId: string): Promise<string | null>;
```

- Requête : `prisma.profileSubmission.findFirst({ where: { userId, status: "APPROVED" },
  orderBy: { createdAt: "desc" }, select: { photo: true } })`. Elle utilise l'index
  `@@index([userId, createdAt])`, dans le même ordre que `getCurrentSubmission`
  (`src/lib/profile-review.ts`).
- Retour : `` `/api/files/${submission.photo}` ``, même construction que les badges
  (`BadgeBatchExport.tsx`). Sinon `null`.
- **Ne pas lire `User.photo`** (spec) ni `User.profileStatus` (point de vigilance 2).
- Fichier séparé de `profile-review.ts` : il appartient à ce chantier (spec 22) et évite
  un conflit de fusion avec les autres chantiers.

**Étapes :**

- [ ] Écrire `src/lib/__tests__/approved-photo.test.ts`, sur le modèle de
  `src/lib/__tests__/profile-review.test.ts` : `prisma.user.create` puis
  `prisma.profileSubmission.create`, avec des pièces factices et un `createdAt` explicite.
  Cas :

```ts
it("returns null when the user has no submission", async () => {
  expect(await getApprovedPhotoUrl(user.id)).toBeNull();
});
it("returns null when the only submission is pending or rejected", async () => {
  // une PENDING, une REJECTED -> null
});
it("returns the photo URL of the approved submission", async () => {
  // APPROVED photo "profile/u1/photos/a.png"
  expect(await getApprovedPhotoUrl(user.id)).toBe("/api/files/profile/u1/photos/a.png");
});
it("returns the most recent approved submission", async () => {
  // APPROVED a.png (2026-01-01), APPROVED b.png (2026-02-01) -> b.png
});
it("keeps the previous approved photo when a newer submission is pending", async () => {
  // APPROVED a.png (janv.), PENDING b.png (fevr.) -> a.png
});
it("keeps the previous approved photo when a newer submission is rejected", async () => {
  // APPROVED a.png (janv.), REJECTED b.png (fevr.) -> a.png
});
it("ignores other users' approved submissions", async () => {
  // APPROVED pour other.id, rien pour user.id -> null
});
```

- [ ] Lancer
  `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/approved-photo.test.ts`.
  Échec attendu : module `@/lib/approved-photo` introuvable.
- [ ] Implémenter `src/lib/approved-photo.ts`.
- [ ] Relancer le fichier : vert. Puis lancer
  `docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage src/lib/__tests__/approved-photo.test.ts`
  et vérifier que `approved-photo.ts` est à 100 % (lignes, branches, fonctions). Les
  seuils globaux échoueront sur ce sous-ensemble : seul le fichier compte ici.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(profils): resolution de l'URL de la photo approuvee`.

**Critères d'acceptation :** 7 tests verts ; 100 % sur `src/lib/approved-photo.ts`.

## Task 3 — Brancher `photoUrl` dans les quatre layouts

Les layouts sont des Server Components hors périmètre de couverture : la preuve est un
e2e écrit d'abord.

**Fichiers :**
- Modifier : `e2e/helpers/db.ts`. Ajouter à `createTestProfileSubmission` les options
  `photo?: string` (défaut actuel `"profile/e2e/photos/p.png"`) et `createdAt?: Date`.
  Le changement est additif : les appels existants ne bougent pas.
- Créer : `e2e/transverse/avatar.spec.ts`
- Modifier : les quatre `layout.tsx` (voir *Branchements*).

**Interfaces (branchements) :** dans chaque layout, un seul appel
`const photoUrl = await getApprovedPhotoUrl(<id>)`, placé **après** les contrôles d'accès
et les `redirect`, pour ne pas faire de requête pour un visiteur redirigé.

| Layout | Identifiant | Placement | Destination |
|---|---|---|---|
| `src/app/platform/layout.tsx` | `ctx.user.id` | après `if (!ctx.isStaff …) redirect("/")` | `<StaffShell … photoUrl={photoUrl}>` |
| `src/app/org/[orgId]/layout.tsx` | `ctx.user.id` | après le bloc `isMember` | `<OrgShell … photoUrl={photoUrl}>` |
| `src/app/event/[eventId]/layout.tsx` | `ctx.user.id` | après `if (!role) redirect("/select")`, avant les branches par rôle | les quatre retours : `EventOperatorShell` (OPERATOR), `EventPrinterShell` (PRINTER), `EventViewerShell` (VIEWER), `EventShell` (ADMIN / staff) |
| `src/app/account/layout.tsx` | `session.user.id` (le `select` de `user` n'a pas d'`id`) | après le `redirect` si `!user` | `<UserAvatar name={user.name} photoUrl={photoUrl} … />`, en remplacement du `photoUrl={null}` du socle |

Ne rien changer d'autre : ni requêtes existantes, ni `select`, ni ordre des redirections.

**Étapes :**

- [ ] Étendre `createTestProfileSubmission` (`photo`, `createdAt`).
- [ ] Écrire `e2e/transverse/avatar.spec.ts`. Avatar ciblé par
  `page.getByTestId("user-avatar").first()` (sur mobile, l'en-tête le rend une fois).
  Photo servie par `page.route("**/api/files/profile/e2e/photos/**", …)`, qui répond
  avec un PNG 1 × 1 encodé en base64 dans le fichier : aucun fichier n'est écrit sur le
  disque. `afterAll` : `cleanupE2ETestData()` puis `disconnectDb()`. Cas :
  1. **Sans soumission** (`createTestUser({ verified: true, profile: true,
     profileStatus: "INCOMPLETE" })`), `/account` : `avatar.locator("img")` a 0 élément,
     et l'avatar contient `EU` (nom « E2E User »).
  2. **Approuvée, puis nouvelle en attente** : APPROVED `profile/e2e/photos/old.png`
     (janvier) et PENDING `profile/e2e/photos/new.png` (février), route active. Sur
     `/account`, l'`<img>` est visible, a l'attribut `src` `/api/files/profile/e2e/photos/old.png`
     et `naturalWidth > 0`.
  3. **Fichier manquant** : APPROVED `profile/e2e/photos/missing.png`, **sans** route.
     Après `waitForLoadState("networkidle")`, l'avatar ne contient plus d'`<img>` et
     affiche `EU`.
  4. **Quatre espaces et trois gabarits de rôle** (route active, une soumission APPROVED
     par utilisateur). Vérifier une `<img>` visible dans l'avatar sur :
     - `/platform` pour `createTestStaff({ role: "STAFF_ADMIN" })` ;
     - `/org/<orgId>` puis `/event/<eventId>` (`EventShell`), pour un OWNER créé par
       `createTestOrgMember` sur l'org de `createTestEvent` (vérifier la signature dans
       `e2e/helpers/db.ts`) ;
     - `/event/<eventId>` pour `createTestEventMember` avec `OPERATOR`, `PRINTER` et
       `VIEWER`, une boucle et un `loginAs` par rôle, dans un `browser.newContext()`
       neuf à chaque fois.
- [ ] Lancer
  `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/transverse/avatar.spec.ts`.
  Échec attendu : cas 2 et 4 (aucune `<img>`, les layouts passent encore `null`). Les
  cas 1 et 3 passent déjà.
- [ ] Brancher les quatre layouts selon la table (import
  `import { getApprovedPhotoUrl } from "@/lib/approved-photo";`).
- [ ] Relancer l'e2e : vert. Puis `make lint && make typecheck && make test`.
- [ ] Rejouer les e2e qui traversent les gabarits, pour vérifier l'absence de régression :
  `e2e/transverse/responsive.spec.ts`, `e2e/transverse/logout.spec.ts`,
  `e2e/public/account.spec.ts`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): photo validee affichee comme avatar dans les quatre espaces`.

**Critères d'acceptation :** e2e vert ; aucun gabarit modifié (`git diff --stat` ne
liste aucun fichier de `src/components/` hors `layout/UserAvatar.tsx`) ; e2e existants
verts sans modification.

## Task 4 — Documentation

**Fichiers :**
- Modifier : `docs/v4/features/validation-profils.md`. Ajouter une section
  « Photo validée comme avatar » : source (dernière soumission `APPROVED`, pas
  `User.photo`), repli sur les initiales (pas de soumission approuvée, ou image en
  échec), espaces concernés, helper `getApprovedPhotoUrl`. Rappeler que les photos de
  profil restent servies publiquement par `/api/files` et renvoyer à la spec 27 pour ce
  choix.
- Modifier : `docs/v4/README.md`. Ajouter dans « Documents » une ligne
  `Spec 27 — Photo validée affichée comme avatar` avec les liens spec, plan et feature,
  dans le style de la ligne de la spec 21. Ajouter aussi une ligne dans « État
  d'avancement ».
- Modifier : ce plan, section `## Progression`.

**Étapes :**
- [ ] Rédiger les deux fiches (français, accents selon le style existant de chaque
  fichier).
- [ ] Vérifier que les liens relatifs se résolvent (`ls` des cibles).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `docs(v4): photo validee comme avatar`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` : verts, couverture 100 % maintenue.
  Optionnel : `make test-coverage` pour le rapport complet.
- [ ] `make db-seed` (la base a été vidée par les tests).
- [ ] Navigateur, à **375 px** puis **1280 px** :
  1. `participant@badge.local` sur `/account` : le seed a une soumission APPROVED dont le
     fichier n'existe pas, donc les initiales s'affichent, sans icône d'image cassée.
  2. Téléverser une vraie photo depuis `/account/profile`. Elle crée une soumission
     PENDING, et l'avatar ne change pas.
  3. En `admin@badge.local`, approuver le profil depuis `/platform/profiles`.
  4. De retour sur le compte participant, la photo apparaît en cercle, sans déformation
     (`object-cover`), sur `/account`.
  5. Pour un compte staff et un membre org / évènement ayant une soumission approuvée,
     vérifier `/platform`, `/org/[orgId]` et `/event/[eventId]`.
  À 375 px, pas de débordement horizontal :
  `document.documentElement.scrollWidth === innerWidth`.
- [ ] Mettre à jour la `## Progression` (statuts `[x]`, dates, notes).

## Self-review

- Couverture de la spec : source « dernière APPROVED » (Task 2) ; repli `onError`
  (Task 1, plus le cas avant hydratation) ; URL `/api/files/<clé>` sans changer la route
  (Tasks 2 et 3) ; quatre layouts et sept gabarits (Task 3, cas 4) ; critère « en
  attente → ancienne photo » (Tasks 2 et 3) ; couverture 100 % et vérification
  navigateur (Task 2, Vérification finale).
- Hors périmètre, conformément à la spec : durcissement de l'accès aux photos,
  modification des gabarits, `User.photo`.
- Cohérence des noms : `getApprovedPhotoUrl`, `UserAvatarView`, `failedUrl` et
  `data-testid="user-avatar"` sont utilisés à l'identique dans les tasks 1 à 3.
