# Lot 2c — Pagination et page commande : plan d'implémentation

> **Pour les agents d'exécution** : SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. Les étapes utilisent des cases `- [ ]`.

**Objectif :** paginer côté serveur (taille 10/20/50/100/500, défaut 20, badges 100, `page`/`pageSize` dans l'URL) toutes les listes des espaces connectés qui ne sont pas aux lots 2a/2b, puis refondre la page d'une commande d'impression (staff et organisateur) en écran pleine hauteur à colonnes indépendantes.

**Architecture :** les contrats du socle (`parseListPage`, `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `UrlPagination`, `badge-list-query.ts` réécrit) sont consommés tels quels. Un helper local `src/lib/paginate.ts` factorise « compter, borner la page, lire la tranche ». Les listes à état local (membres, catégories…) lisent leurs lignes dans les props et appellent `router.refresh()` après chaque mutation. La page commande devient un `FullHeightPage` (en-tête fixe, colonnes qui défilent seules, composer collé en bas) ; modales pour le devis et la liste des badges ; onglets sous `xl`.

**Stack :** Next.js 16 (App Router), React 19, Tailwind 4, Prisma 6 / MySQL, Vitest 4, Playwright.

**Spec :** `docs/v4/specs/2026-11-04-38-v4-retours-client.md` (volets 5 et 6, « Organisation du travail », table de contrôle).

## Exécution

- Ce plan tourne dans son worktree : `scripts/agent-stack.sh up 2c feat/retours-client-v3` (branche `feat/retours-client-v3-2c`, worktree `../badge-wt-2c`). **Toutes les commandes `make` se lancent dans ce worktree.**
- Commande ciblée : `make test FILE=<chemin>` (Vitest, base `badge_2c_test`) ; `make test-e2e FILE=<chemin>` (Playwright). Ne jamais lancer deux e2e en parallèle sur la même stack.
- En exécution automatisée, **un commit par tâche est autorisé** sur la branche du plan (messages en français ASCII, conventional commits, sans co-auteur IA) ; sinon **aucun commit sans demande**. Ne pas relancer lint/typecheck/tests déjà passés au moment du commit.
- Le socle (vague 1) est supposé fait et fusionné dans la branche de base. Ne pas continuer s'il manque : `src/lib/list-query.ts`, `src/components/ui/Pagination.tsx` exportant `UrlPagination`, `src/lib/badge-list-query.ts` réécrit (Task 1 le vérifie).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|------|----------|--------|------|-------|
| 1 | Vérification du socle, helper `paginate`, helpers e2e | [x] | 2026-11-04 | UrlPagination = { page, totalPages, total, pageSize, pageSizeOptions? } (conforme) |
| 2 | Espace évènement — badges et inscriptions | [x] | 2026-11-04 | RegistrationTable/BadgeListTable : etat dans l'URL (router.replace), page bornee cote client |
| 3 | Espace évènement — catégories, membres, blocage, journal, impression | [x] | 2026-11-04 | listes a etat local : lignes en props + router.refresh(); onglets de blocage via ?tab=; allCategories charge hors tranche pour la reaffectation |
| 4 | Espace organisation — évènements, membres, templates, journal | [ ] | | |
| 5 | Espace plateforme — organisations (liste + 3 sous-pages) | [ ] | | |
| 6 | Espace plateforme — profils, utilisateurs, templates, journal, emails | [ ] | | |
| 7 | Espace plateforme — impression : commandes, gabarits, catalogue, planches | [ ] | | |
| 8 | Compte participant | [ ] | | |
| 9 | Affichage des erreurs `EVENT_IMAGES_NONCOMPLIANT` | [ ] | | |
| 10 | Routes de liste des badges d'une commande (staff + organisateur) | [ ] | | |
| 11 | `AppShell` / `FullHeightPage` et fonctions pures de la page commande | [ ] | | |
| 12 | Composants communs de la page commande | [ ] | | |
| 13 | Page commande staff | [ ] | | |
| 14 | Page commande organisateur | [ ] | | |
| 15 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Chemins vérifiés dans le dépôt (état du 2026-11-04). `[nouveau]` = à créer.

- `src/lib/print-requests/thread.ts` et son test (ajouté à la relecture croisée : liste blanche `ORGANIZER_DETAILS` de `QUOTE_SENT` étendue à `lines`).

**Pagination — pages et composants**
- Évènement : `src/app/event/[eventId]/{badges,registrations,categories,members,blocked-emails,activity,print}/page.tsx` (+ `blocked-documents/page.tsx`, simple redirection, inchangé), `src/components/event/{BadgeListTable,RegistrationTable,CategoryTable,MemberTable,BlocklistTabs,BlockedEmailsForm,BlockedDocumentsForm}.tsx`.
- Organisation : `src/app/org/[orgId]/{events,members,templates,activity}/page.tsx`, `src/app/org/[orgId]/events/EventArchiveActions.tsx`, `src/app/org/[orgId]/members/MembersClient.tsx`, `src/app/org/[orgId]/templates/TemplatesClient.tsx`.
- Plateforme : `src/app/platform/organizations/page.tsx`, `src/app/platform/organizations/[orgId]/{events,members,activity}/page.tsx`, `src/components/staff/OrganizationsTable.tsx`, `src/app/platform/{profiles,users,badge-templates,activity}/page.tsx`, `src/app/platform/jobs/page.tsx`, `src/app/platform/jobs/_components/JobsPagination.tsx`, `src/lib/jobs/admin.ts`, `src/lib/jobs/__tests__/admin.test.ts`.
- Impression plateforme : `src/app/platform/print/orders/page.tsx`, `src/app/platform/print/{layouts,catalog}/page.tsx`, `src/app/platform/print/sheets/{pending,generated,free}/page.tsx`, `src/components/staff/print/{RequestList,LayoutList,CatalogList,GenerationList,GenerationsScreen}.tsx`, `src/components/staff/print/sheets/OrderQueueTable.tsx`.
- Compte : `src/app/account/page.tsx`.
- Routes API de liste (GET seulement) : `src/app/api/platform/{organizations,users,activity}/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/{registrations,activity}/route.ts`, `src/app/api/platform/print/requests/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts` (GET liste ; `[badgeId]/**`, `exports/**`, `batch/**`, `ids/**` restent à 2a), et leurs tests.
- **Ajouts au lot (nouveaux fichiers, sans conflit)** : `src/lib/paginate.ts` [nouveau] et `src/lib/__tests__/paginate.test.ts` [nouveau], `e2e/helpers/pagination.ts` [nouveau], `e2e/event/pagination.spec.ts` [nouveau], `e2e/org/pagination.spec.ts` [nouveau], `e2e/platform/pagination.spec.ts` [nouveau], `e2e/public/account-pagination.spec.ts` [nouveau].

**Page commande**
- Staff : `src/app/platform/print/orders/[requestId]/page.tsx` (hors `onsite/**`), `src/components/staff/print/{RequestDetail,QuoteEditor,RequestStatusActions,request-actions,request-types}.ts(x)`, `src/components/staff/print/order/*` (+ `OrderBadgesButton.tsx` [nouveau]), `src/app/api/platform/print/requests/[requestId]/route.ts` (inchangé en principe) et `src/app/api/platform/print/requests/[requestId]/items/route.ts` [nouveau].
- Organisateur : `src/app/event/[eventId]/print/[requestId]/page.tsx` (hors `edit/`, `return/` si autres lots n'y touchent pas : non modifiés), `src/components/event/print/order/*`, `src/components/event/print/{PrintRequestActions,PrintPayButton}.tsx`, `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/registrations/route.ts`.
- Communs : `src/components/print/**` dont `PrintThread.tsx`, `QuoteLinesTable.tsx`, et nouveaux `OrderModal.tsx`, `OrderBadgesDialog.tsx`, `OrderSteps.tsx`, `OrderTabs.tsx`, `QuoteMessageCard.tsx`, `order-steps.ts`, `quote-message.ts`, `entry-tone.ts` (tous [nouveau]).
- Mise en page : `src/components/layout/AppShell.tsx` (ajout minimal), `src/components/layout/FullHeightPage.tsx` [nouveau].
- Tests de tous ces fichiers (`__tests__/` voisins) ; `e2e/event/print-request-detail.spec.ts`, `e2e/event/print-conversation.spec.ts`, `e2e/platform/print-request-detail.spec.ts` ; e2e existants des pages listées si leurs attentes changent (`e2e/event/{badges,registrations,categories,members,blocklist,activity,print}.spec.ts`, `e2e/org/{events,members,templates,activity}.spec.ts`, `e2e/platform/{organizations-list,organization-detail,organization-members,profiles,users-list,badge-templates,activity,jobs,print-requests,print-layouts,print-catalog,print-sheets}.spec.ts`) ; `docs/v4/features/impression-demandes.md`.

**En lecture seule (besoin d'y toucher → s'arrêter et le signaler)** : `prisma/schema.prisma`, `src/lib/list-query.ts`, `src/lib/badge-list-query.ts`, `src/components/ui/Pagination.tsx` (et tout `src/components/ui/**`), `src/lib/activity-labels.ts`, `src/lib/toast.ts`, `src/hooks/**`, `src/test/factories.ts`, `e2e/helpers/db.ts`, `e2e/helpers/nav.ts`, `prisma/seed/minimal.ts`, `src/components/admin/PaymentHistory.tsx` (lot 2b : consommé avec ses props actuelles), `src/lib/print-requests/**` sauf `thread.ts` (dont `content.ts`, `quote.ts`, `onsite*.ts`, `lifecycle.ts`), `src/lib/print-sheets/**`, `src/lib/print-catalog/**`, `src/app/api/platform/jobs/**`, `src/app/api/platform/print/sheets/**` (2a), `src/components/staff/print/OnsiteStation.tsx`, `src/app/platform/print/orders/[requestId]/onsite/**`, `src/app/event/[eventId]/page.tsx`, `src/components/event/{EventSettingsForm,RegistrationForm}.tsx` (2a), pages et composants de paiements/plans/abonnement (2b).

## Global Constraints

Règles de test de `CLAUDE.md` (« Règles de test »), valables pour tout test écrit dans ce lot :
- **Base de test dédiée** : Vitest tourne sur une base finissant par `_test` (`badge_2c_test` pour ce lot) ; jamais sur une base de dev. Le garde-fou de `src/test-setup.ts` refuse toute autre base.
- **Pas de mock de la base ni de Prisma** : les tests d'intégration utilisent le vrai MySQL. Seuls les services externes se mockent (FedaPay, SMTP réel, renderer via `fakeExporter`, session NextAuth).
- **Fabriques** : préparer les données avec `src/test/factories.ts` (`@faker-js/faker`, graine fixée par fichier). Fabrique manquante → `src/test/factories-2c.ts` [nouveau], jamais de `prisma.*.create` dupliqué ; `src/test/factories.ts` et `e2e/helpers/db.ts` restent en lecture seule (helpers e2e nouveaux : `e2e/helpers/pagination.ts`).
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture : s'arrêter et demander.
- **Couverture** 100 % sur `src/lib/**` et `src/app/api/**` (gate `vitest.config.ts`). Les composants ne sont pas dans le périmètre de couverture ; Vitest tourne en environnement `node` (pas de DOM) : un composant qui n'utilise pas les hooks de `next/navigation` se teste par `renderToStaticMarkup`, le comportement interactif se couvre en e2e.
- **e2e** (Playwright) : contre l'app en cours d'exécution, fixtures préfixées et nettoyées (`e2e/helpers/db.ts`), contrat « test UI » de `e2e/README.md` (zéro `page.request.*`, URL vérifiée à chaque étape, message d'erreur UI).
- Règles projet : Server Components par défaut ; `"use client"` seulement si l'interactivité l'exige ; UI en français avec accents ; code en anglais ; commentaires en français ; aucune règle métier modifiée ; ne jamais exposer de secret en réponse API.
- **Mise en page** : le menu latéral occupe ~224 px dès `lg` (1024 px) ; les points de rupture se calculent sur la largeur utile (viewport − 224 px).
- Taille de page : valeurs `10, 20, 50, 100, 500` ; hors liste → défaut (20 ; 100 pour les badges). `page` et `pageSize` toujours dans l'URL.

## Review Focus

1. **Page hors bornes** (`?page=999`, `?page=0`, `?pageSize=7`, `?pageSize=abc`) : la page affichée est bornée à la dernière page non vide, jamais d'erreur 500 ni de tableau vide trompeur (test : Task 1 `paginate`, e2e Task 2/4/6).
2. **Filtre ou recherche changé avec `page>1`** : retour à la page 1 et conservation des autres paramètres de l'URL (e2e Task 2, 6, 7).
3. **Mutation sur la dernière ligne d'une page** (supprimer/archiver le seul élément de la page 3) : après `router.refresh()` la page est bornée, pas de tableau vide (e2e Task 3, 4).
4. **Polling (planches, génération libre) sur une page ≠ 1** : le rafraîchissement ne remplace pas la page par la liste non paginée de l'API ; seules les lignes visibles sont mises à jour (test unitaire de la fonction de fusion, Task 7).
5. **Commande volumineuse** (plusieurs milliers de badges) : la liste des badges ne charge jamais tout dans la modale ; recherche et pagination côté serveur ; devis et en-tête restent utilisables sur 375 px (tests API Task 10, e2e Task 13/14).

---

### Task 1: Vérification du socle, helper `paginate`, helpers e2e

**Files:**
- Create: `src/lib/paginate.ts`, `src/lib/__tests__/paginate.test.ts`, `e2e/helpers/pagination.ts`
- Lire seulement : `src/lib/list-query.ts`, `src/components/ui/Pagination.tsx`, `src/lib/badge-list-query.ts`

**Interfaces:**
- Consomme (socle) : `parseListPage(params, opts?: { defaultSize?: number }) => { page; pageSize; skip; take }`, `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, composant client `UrlPagination`.
- Produit :
  - `paginate<T>(p: { page: number; pageSize: number }, count: () => Promise<number>, find: (range: { skip: number; take: number }) => Promise<T[]>): Promise<{ rows: T[]; total: number; page: number; pageSize: number; totalPages: number }>` — compte d'abord, borne `page` à `max(1, ceil(total / pageSize))`, puis lit la tranche (aucune lecture si `total === 0`).
  - `paginateArray<T>(items: T[], p: { page: number; pageSize: number }): { rows: T[]; total; page; pageSize; totalPages }` — même contrat pour les listes dérivées en mémoire.
  - e2e : `selectPageSize(page, size)`, `expectPagination(page, { total, pageSize, page? })`, `expectNoHorizontalOverflow(page)`, `seedMany<T>(n, make: (i: number) => Promise<T>)`.

- [ ] **Step 1: Vérifier le socle**

Run: `ls src/lib/list-query.ts && grep -n "export" src/lib/list-query.ts src/components/ui/Pagination.tsx`
Expected: `parseListPage`, `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `Pagination`, `UrlPagination` listés. Sinon : s'arrêter et signaler (socle absent).

- [ ] **Step 2: Relever la signature réelle de `UrlPagination`**

La spec ne fige pas ses props. Le plan suppose `<UrlPagination page totalPages total pageSize />` (les props de `Pagination` sans les callbacks). Si la signature réelle diffère, **ne pas modifier le composant** (ni `Pagination` ni `UrlPagination` ; `BadgeListTable` utilise `Pagination` avec callbacks, voir Task 2 Step 4) : écrire dans la section Progression (Notes) la forme réelle et l'utiliser partout ; si elle est inutilisable, s'arrêter et signaler.

- [ ] **Step 3: Écrire le test de `paginate` (échoue)**

`src/lib/__tests__/paginate.test.ts`, base réelle, lignes créées avec les fabriques (créer des organisations via la fabrique de `src/test/factories.ts`, lire ses noms exportés). Cas :
  - `paginate` avec 45 lignes, `pageSize 20`, `page 2` → 20 lignes, `total 45`, `totalPages 3` ;
  - `page 99` → `page === 3` et 5 lignes (bornage) ;
  - `page 0` ou négative reçue telle quelle → `page === 1` ;
  - table vide → `rows []`, `total 0`, `totalPages 1`, `find` jamais appelé (espion `vi.fn()` sur la fonction `find`, pas sur Prisma) ;
  - `paginateArray([1..45], { page: 3, pageSize: 20 })` → `[41..45]` ; `paginateArray([], …)` → `rows []`.

- [ ] **Step 4: Lancer le test, constater l'échec**

Run: `make test FILE=src/lib/__tests__/paginate.test.ts`
Expected: FAIL (`Cannot find module '../paginate'`).

- [ ] **Step 5: Implémenter `src/lib/paginate.ts`** selon les signatures ci-dessus.

- [ ] **Step 6: Relancer le test**

Run: `make test FILE=src/lib/__tests__/paginate.test.ts`
Expected: PASS.

- [ ] **Step 7: Écrire `e2e/helpers/pagination.ts`**

`selectPageSize` sélectionne dans le `<select>` d'`aria-label` « Nombre de résultats par page » puis attend l'URL `pageSize=<size>&…` sans `page` > 1 ; `expectPagination` vérifie le texte « N résultat(s) », le `<select>` et `aria-current="page"` ; `expectNoHorizontalOverflow` vérifie `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 8: Commit** — `git add src/lib/paginate.ts src/lib/__tests__/paginate.test.ts e2e/helpers/pagination.ts && git commit -m "feat(pagination): helper paginate et helpers e2e"`

---

### Task 2: Espace évènement — badges et inscriptions

**Files:**
- Modify: `src/components/event/BadgeListTable.tsx`, `src/components/event/RegistrationTable.tsx`, `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` (GET), `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts` (GET, vérification), `src/app/event/[eventId]/{badges,registrations}/page.tsx` si besoin d'un `Suspense`
- Test: tests API existants de ces routes (`src/app/api/org/[orgId]/events/[eventId]/registrations/__tests__/…`), `e2e/event/badges.spec.ts`, `e2e/event/registrations.spec.ts`, `e2e/event/pagination.spec.ts`

**Interfaces:**
- Consomme : `parseListPage(searchParams, { defaultSize })`, `Pagination` (avec callbacks, pour `BadgeListTable`) et `UrlPagination` (autres listes), `parseBadgePage` / `buildBadgeWhere` (socle, API inchangée).
- Produit : `GET …/registrations?status&q&categoryId&page&pageSize` → `{ registrations, total, page, pageSize }` (le paramètre `limit` disparaît ; plus aucun appelant : `grep -rn "limit=" src` pour le confirmer).

- [ ] **Step 1: Test API (échoue)** — dans le test de la route registrations : `pageSize=10` renvoie 10 lignes ; `pageSize=7` retombe sur 20 ; `pageSize=500` accepté ; réponse contient `pageSize` et plus `limit`.
Run: `make test FILE="src/app/api/org/[orgId]/events/[eventId]/registrations"`
Expected: FAIL.

- [ ] **Step 2: Route registrations** : lire `page`/`pageSize` via `parseListPage(url.searchParams)` (défaut 20) ; conserver filtres et tri. Relancer : PASS.

- [ ] **Step 3: Route badges (GET)** : vérifier qu'elle appelle `parseBadgePage` (défaut 100) ; si le test existant suppose une taille hors `PAGE_SIZE_OPTIONS` (ex. 200), l'adapter (pas de code de production modifié pour un test : si la route doit changer, c'est pour consommer le socle). Run: `make test FILE="src/app/api/org/[orgId]/events/[eventId]/badges"` — Expected: PASS.

- [ ] **Step 4: `BadgeListTable`** — l'état `filter`, `q`, `page`, `pageSize` vient de l'URL (`useSearchParams`) et s'écrit par `router.replace(`?${params}`, { scroll: false })` ; supprimer `PAGE_SIZES` locale et utiliser le composant `Pagination` **avec callbacks** (`onPageChange` / `onPageSizeChange` qui appellent ce `router.replace`), **pas** `UrlPagination` (il fait `router.push` avec scroll et écrit toujours `page`/`pageSize` ; le composant ne doit pas être modifié) ; au changement de taille, retirer `page` (défaut 100 : `pageSize` absent de l'URL = 100). Changer filtre ou recherche → `page` retiré. Conserver la recherche différée (300 ms), `latest`/`epoch` et la sélection globale. La page bornée par le serveur : si `page > lastPage`, remplacer l'URL par la dernière page. Les erreurs d'API passent par `useAsyncAction` (message `message` de l'API affiché en priorité — voir Task 9).

- [ ] **Step 5: `RegistrationTable`** — mêmes principes : `status`, `q`, `page`, `pageSize` dans l'URL, `Pagination` avec callbacks (`router.replace`, `scroll: false`) à la place des boutons maison, bouton « Rafraîchir » conservé (`router.refresh()` ne suffit pas pour un fetch client : rappeler `load()`).

- [ ] **Step 6: e2e** — `e2e/event/pagination.spec.ts` (section badges/inscriptions) : seed de 45 inscriptions approuvées (`seedMany`) ; défaut 20 lignes pour les inscriptions, 45 pour les badges (défaut 100) ; choisir 10 → URL `pageSize=10`, 10 lignes ; page suivante ; recharger : l'état persiste ; filtre « Imprimés » remet `page` à 1 ; `?page=99` affiche la dernière page ; `expectNoHorizontalOverflow` à 375, 1024 et 1280 px.
Run: `make test-e2e FILE=e2e/event/pagination.spec.ts` puis `make test-e2e FILE=e2e/event/badges.spec.ts` puis `…registrations.spec.ts`
Expected: PASS (ajuster les attentes des specs existantes qui supposaient 25/100 lignes).

- [ ] **Step 7: Commit** — `feat(pagination): badges et inscriptions de l'evenement`

---

### Task 3: Espace évènement — catégories, membres, blocage, journal, impression

**Files:**
- Modify: `src/app/event/[eventId]/{categories,members,blocked-emails,activity,print}/page.tsx`, `src/components/event/{CategoryTable,MemberTable,BlocklistTabs,BlockedEmailsForm,BlockedDocumentsForm}.tsx`, `src/app/api/org/[orgId]/events/[eventId]/activity/route.ts` (GET)
- Test: test API activity existant, `e2e/event/{categories,members,blocklist,activity,print}.spec.ts`, `e2e/event/pagination.spec.ts`

**Interfaces:**
- Consomme : `paginate`, `parseListPage`, `UrlPagination`.
- Produit : `GET …/activity?type&page&pageSize` → `{ logs, total, page, pageSize }` (le paramètre `limit` disparaît).

**Approche des listes à état local (règle de ce lot)** : le composant ne garde plus les lignes dans `useState(initial)` ; il lit les props et appelle `router.refresh()` après chaque création/édition/suppression réussie. La page serveur relit la tranche de l'URL courante (bornée par `paginate`).

- [ ] **Step 1: Test API activity (échoue)** — `pageSize=10` → 10 lignes ; `pageSize=3` → 20 ; `total` correct ; filtre `type` conservé ; rôle OPERATOR toujours limité à `BADGE_SCANNED`. Run: `make test FILE="src/app/api/org/[orgId]/events/[eventId]/activity"` — Expected: FAIL.
- [ ] **Step 2: Route activity** — `parseListPage`, renvoyer `pageSize`. Relancer : PASS.
- [ ] **Step 3: Pages `categories`, `members`, `activity`, `print`** : `searchParams` → `parseListPage` → `paginate` (même `where`/`orderBy` qu'aujourd'hui, `take: 100` supprimé) → `<UrlPagination …/>` sous le tableau. La page `print` garde `OrgPrintCreditCard` au-dessus et `unreadByRequest` calculé sur la tranche seulement.
- [ ] **Step 4: `CategoryTable`, `MemberTable`** — retirer l'état local des lignes, `router.refresh()` après chaque mutation (création, édition, import de templates, réassignation, suppression, invitation, changement de rôle, retrait). Les modales restent inchangées.
- [ ] **Step 5: Listes de blocage** — `BlocklistTabs` passe l'onglet actif dans l'URL (`tab=emails|documents`, défaut `emails`) ; la page `blocked-emails` ne lit et ne pagine **que la liste de l'onglet actif** (`page`/`pageSize` s'y appliquent) et fournit les **deux totaux** via `count()` pour les pastilles ; changer d'onglet retire `page`. `BlockedEmailsForm`/`BlockedDocumentsForm` : lignes en props + `router.refresh()`.
- [ ] **Step 6: e2e** — compléter `e2e/event/pagination.spec.ts` : 45 catégories (ou membres) → 20 lignes par défaut, taille 10, page 3 ; **supprimer l'unique ligne de la dernière page** → la page se rabat sur la précédente (Review Focus 3) ; onglets de blocage : `tab=documents` pagine indépendamment. Mettre à jour `categories/members/blocklist/activity/print` specs si nécessaire.
Run: `make test-e2e FILE=e2e/event/pagination.spec.ts` puis chaque spec modifiée — Expected: PASS.
- [ ] **Step 7: Commit** — `feat(pagination): listes de l'espace evenement`

---

### Task 4: Espace organisation — évènements, membres, templates, journal

**Files:**
- Modify: `src/app/org/[orgId]/{events,members,templates,activity}/page.tsx`, `src/app/org/[orgId]/members/MembersClient.tsx`, `src/app/org/[orgId]/templates/TemplatesClient.tsx`, `src/app/org/[orgId]/events/EventArchiveActions.tsx`
- Test: `e2e/org/{events,members,templates,activity}.spec.ts`, `e2e/org/pagination.spec.ts`

**Interfaces:** consomme `paginate`, `parseListPage`, `UrlPagination`. Même règle « lignes en props + `router.refresh()` » pour `MembersClient` et `TemplatesClient`.

- [ ] **Step 1:** pages `events` (tri `date desc`, filtre `orgId`), `members` (tri `createdAt asc`), `templates` (tri `number, name`), `activity` (supprimer `take: 100`) : `paginate` + `UrlPagination`. Les gardes de rôle et `canManageRoles` restent calculés dans la page.
- [ ] **Step 2:** `MembersClient` et `TemplatesClient` : supprimer `useState(initial)` des lignes ; `router.refresh()` après invitation, changement de rôle, retrait, création/édition/suppression de template. `EventArchiveActions` appelle déjà un rafraîchissement : le vérifier.
- [ ] **Step 3: e2e** `e2e/org/pagination.spec.ts` : 45 évènements → 20/page, taille 50 → 45 lignes ; archiver le seul évènement de la page 3 → retour page 2 ; `?page=99` borné ; `expectNoHorizontalOverflow` à 375/1024/1280. Mettre à jour les specs `e2e/org/*` touchées.
Run: `make test-e2e FILE=e2e/org/pagination.spec.ts` puis les specs org modifiées — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(pagination): listes de l'espace organisation`

---

### Task 5: Espace plateforme — organisations (liste + 3 sous-pages)

**Files:**
- Modify: `src/app/platform/organizations/page.tsx`, `src/components/staff/OrganizationsTable.tsx`, `src/app/platform/organizations/[orgId]/{events,members,activity}/page.tsx`, `src/app/api/platform/organizations/route.ts` (GET)
- Test: test API organisations, `e2e/platform/{organizations-list,organization-detail,organization-members}.spec.ts`, `e2e/platform/pagination.spec.ts`

**Interfaces:** consomme `paginate`, `parseListPage`, `UrlPagination`. Produit : `GET /api/platform/organizations?q&archived&page&pageSize` → `{ …, total, page, pageSize }` (forme existante conservée, ajouter `total/page/pageSize` si absents).

- [ ] **Step 1: Test API (échoue)** : `pageSize=10`, valeur invalide → 20, `total` correct, filtres `q`/`archived` conservés. Run: `make test FILE=src/app/api/platform/organizations` — Expected: FAIL.
- [ ] **Step 2: Route** via `parseListPage` + `skip/take`. PASS.
- [ ] **Step 3: Pages** : `organizations` (filtres `q`/`archived` dans l'URL, `take: 100` supprimé) ; les filtres conservent leurs paramètres quand la page change ; soumettre un filtre retire `page`. Sous-pages `events`, `members`, `activity` (`take: 50` supprimé) : `paginate` + `UrlPagination`. `OrganizationsTable` reçoit la tranche inchangée.
- [ ] **Step 4: e2e** (`e2e/platform/pagination.spec.ts`, section organisations) : 45 organisations, taille 10, filtre `q` + page ; sous-page membres. Run: `make test-e2e FILE=e2e/platform/pagination.spec.ts` — Expected: PASS ; relancer `organizations-list` et `organization-detail` specs.
- [ ] **Step 5: Commit** — `feat(pagination): organisations de la plateforme`

---

### Task 6: Espace plateforme — profils, utilisateurs, templates, journal, emails

**Files:**
- Modify: `src/app/platform/{profiles,users,badge-templates,activity}/page.tsx`, `src/app/platform/jobs/page.tsx`, `src/app/platform/jobs/_components/JobsPagination.tsx`, `src/lib/jobs/admin.ts`, `src/lib/jobs/__tests__/admin.test.ts`, `src/app/api/platform/users/route.ts` (GET), `src/app/api/platform/activity/route.ts` (GET)
- Test: tests API users et activity, `e2e/platform/{profiles,users-list,badge-templates,activity,jobs}.spec.ts`, `e2e/platform/pagination.spec.ts`

**Interfaces:**
- Consomme : `parseListPage`, `paginate`, `UrlPagination`.
- Produit : `parseJobListFilters(params)` — **signature et valeurs de retour inchangées** (`{ ok: true, filters: JobListFilters } | { ok: false, code: "INVALID_STATUS" }`) car `src/app/api/platform/jobs/route.ts` (hors lot) l'appelle ; `page`/`pageSize` y sont lus par `parseListPage`. `JOB_PAGE_SIZES` supprimé (plus d'import externe : `grep -rn JOB_PAGE_SIZES src`).

- [ ] **Step 1: Tests (échouent)** — `admin.test.ts` : `pageSize=500` accepté (avant : retombait sur 20), `pageSize=30` retombe sur 20, `page` invalide → 1. API users : `pageSize=500` accepté (avant : plafonné à 100), défaut 20. API activity : idem. Run: `make test FILE=src/lib/jobs/__tests__/admin.test.ts` — Expected: FAIL.
- [ ] **Step 2: Implémentation** — `admin.ts`, routes users/activity via `parseListPage`. Vérifier que le test de la route `api/platform/jobs` (hors lot, lecture seule) passe encore ; s'il suppose `pageSize=30`, **s'arrêter et signaler** (ne pas le modifier). Run: `make test FILE=src/lib/jobs` puis `make test FILE=src/app/api/platform` — Expected: PASS.
- [ ] **Step 3: Pages** — `profiles` (filtre `status` défaut `PENDING`, `q`), `users` (`q`, `type`, `archived` ; l'API déjà paginée n'est pas appelée par la page, qui lit Prisma via `paginate`), `badge-templates` (la liste devient paginée ; le bloc `BadgeTemplateInstaller` reste au-dessus), `activity` (supprimer `pageSize = 50` en dur et la pagination maison), `jobs` : `JobsPagination` devient un fin wrapper de `UrlPagination` (ou est supprimé et remplacé) en conservant les filtres.
- [ ] **Step 4: e2e** — section « profils/utilisateurs/emails » de `e2e/platform/pagination.spec.ts` ; relancer les specs modifiées.
Run: `make test-e2e FILE=e2e/platform/pagination.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(pagination): profils, utilisateurs, templates, journal et emails`

---

### Task 7: Espace plateforme — impression : commandes, gabarits, catalogue, planches

**Files:**
- Modify: `src/app/platform/print/orders/page.tsx`, `src/components/staff/print/RequestList.tsx`, `src/app/api/platform/print/requests/route.ts` (GET), `src/app/platform/print/layouts/page.tsx`, `src/components/staff/print/LayoutList.tsx` (si besoin), `src/app/platform/print/catalog/page.tsx`, `src/app/platform/print/sheets/{pending,generated,free}/page.tsx`, `src/components/staff/print/sheets/OrderQueueTable.tsx`, `src/components/staff/print/{GenerationList,GenerationsScreen}.tsx`
- Create: `src/components/staff/print/sheets/merge-rows.ts`, `src/components/staff/print/sheets/__tests__/merge-rows.test.ts`
- Test: test API requests, `e2e/platform/{print-requests,print-layouts,print-catalog,print-sheets}.spec.ts`, `e2e/platform/pagination.spec.ts`

**Interfaces:**
- Consomme : `paginate`, `paginateArray`, `parseListPage`, `UrlPagination`.
- Produit : `mergeRowsById<T extends { id: string }>(visible: T[], fresh: T[]): T[]` — renvoie `visible` dont chaque ligne est remplacée par la ligne de même `id` de `fresh` quand elle existe (ordre et ensemble de `visible` conservés).

- [ ] **Step 1: Test `mergeRowsById` (échoue)** : ligne présente dans les deux → version fraîche ; ligne absente de `fresh` → conservée ; ligne de `fresh` absente de `visible` → ignorée ; ordre de `visible` conservé. Run: `make test FILE=src/components/staff/print/sheets/__tests__/merge-rows.test.ts` — Expected: FAIL puis PASS après implémentation (Step 2).
- [ ] **Step 2: Implémenter `merge-rows.ts`.**
- [ ] **Step 3: Test API requests (échoue) puis route** : `GET /api/platform/print/requests` lit `page`/`pageSize` par `parseListPage` (vérifier la forme actuelle de la réponse et l'étendre de `pageSize`). Run: `make test FILE=src/app/api/platform/print/requests` — Expected: FAIL puis PASS.
- [ ] **Step 4: Commandes** — `orders/page.tsx` : supprimer `PAGE_SIZE = 50` et le calcul de `page` maison, utiliser `parseListPage` + `paginate` ; `RequestList` : remplacer les liens Précédent/Suivant et `pageHref` par `UrlPagination` (le formulaire GET de filtres garde `status/orgId/type/wantedFrom/wantedTo` et **n'envoie pas `page`** ; il conserve `pageSize` via un `<input type="hidden">`).
- [ ] **Step 5: Gabarits et catalogue** — `layouts/page.tsx` : `paginate` sur `printSheetLayout` (`archived: false`). `catalog/page.tsx` : `listProducts` (lib hors lot) renvoie tout → `paginateArray` dans la page (tranche passée à `CatalogList`) ; filtres `kind`/`archived` conservés dans l'URL.
- [ ] **Step 6: Planches** — `pending` et `generated` : `listOrdersToGenerate()` etc. (lib hors lot) → `paginateArray` dans la page ; `OrderQueueTable` : le polling `/api/platform/print/sheets/orders` renvoie la liste **complète** (route 2a, inchangée) → ne garder que les lignes de la page courante avec `mergeRowsById(rows, fresh)` (Review Focus 4). `free` : `paginate` sur `printSheetGeneration` (même `where`, `take: 50` supprimé) ; `GenerationsScreen` : `onChange` et `reload()` ne remplacent plus les lignes par la liste non paginée de `/api/platform/print/sheets` : `onChange={(fresh) => setRows((r) => mergeRowsById(r, fresh))}`, et après création d'une génération `router.refresh()` + retour à la page 1 (`page` retiré de l'URL). Ajouter `UrlPagination` sous chaque liste.
- [ ] **Step 7: e2e** — section impression de `e2e/platform/pagination.spec.ts` (45 commandes via `createTestPrintRequest` en boucle : taille 10, filtre statut + page, `?page=99`) ; relancer `print-requests`, `print-layouts`, `print-catalog`, `print-sheets`.
Run: `make test-e2e FILE=e2e/platform/pagination.spec.ts` — Expected: PASS.
- [ ] **Step 8: Commit** — `feat(pagination): listes d'impression de la plateforme`

---

### Task 8: Compte participant

**Files:**
- Modify: `src/app/account/page.tsx`
- Test: `e2e/public/account-pagination.spec.ts` [nouveau] ; `NotificationsView` (curseur) inchangés.

**Interfaces:** consomme `paginate`, `parseListPage`, `UrlPagination`.

- [ ] **Step 1:** paginer `registration.findMany({ where: { userId } })` (tri `createdAt desc`) ; `UrlPagination` sous la grille ; le reste de la page (profil incomplet, etc.) inchangé.
- [ ] **Step 2: e2e** : participant avec 25 inscriptions → 20 cartes, page 2 → 5 ; `expectNoHorizontalOverflow` à 375 px. Run: `make test-e2e FILE=e2e/public/account-pagination.spec.ts` — Expected: PASS.
- [ ] **Step 3: Commit** — `feat(pagination): inscriptions du compte`

---

### Task 9: Affichage des erreurs `EVENT_IMAGES_NONCOMPLIANT`

**Files:**
- Create: `src/components/staff/print/__tests__/api-error-display.test.ts`
- Vérifier (modifier seulement si le test échoue pour une cause locale) : `src/components/staff/print/RequestStatusActions.tsx`, `src/components/event/print/PrintRequestActions.tsx`, `src/components/event/BadgeListTable.tsx`

**Interfaces:** consomme `apiErrorMessage` (`src/lib/toast.ts`, lecture seule), `staffRequest` (`request-fetch.ts`). Le lot 2a renvoie `{ error: "EVENT_IMAGES_NONCOMPLIANT", message: "<texte français>" }` en 4xx.

- [ ] **Step 1: Test** : `apiErrorMessage(new Response(JSON.stringify({ error: "EVENT_IMAGES_NONCOMPLIANT", message: "Le logo doit être recadré." }), { status: 409 }))` renvoie le `message` ; sans `message`, le repli est affiché (le code technique sans espace n'est jamais montré). Test de `staffRequest` (mock de `fetch` global, pas de Prisma) : sans `codeMessages`, le toast reçoit le message de l'API ; avec `codeMessages` ne contenant pas ce code, idem (le message de l'API passe).
Run: `make test FILE=src/components/staff/print/__tests__/api-error-display.test.ts` — Expected: PASS (comportement existant : le test le verrouille).
- [ ] **Step 2: Vérifier à la lecture** que `PrintRequestActions` (`post()` lève la `Response` → `useAsyncAction` → `toastApiError`) et `BadgeListTable` (`batchPrint`) ne passent jamais un `codeMessages` qui masquerait ce code. Si `RequestStatusActions` appelle `run(..., MARK_PAID_ERRORS)`, ce dictionnaire ne contient que `PAYMENT_IN_PROGRESS` : aucune action.
- [ ] **Step 3: Commit** — `test(impression): verrouille l'affichage des erreurs d'images non conformes`

---

### Task 10: Routes de liste des badges d'une commande (staff + organisateur)

**Files:**
- Create: `src/app/api/platform/print/requests/[requestId]/items/route.ts`, test `src/app/api/platform/print/requests/[requestId]/items/__tests__/route.test.ts`
- Modify: `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/registrations/route.ts`, son test
- Inchangé : `src/app/api/platform/print/requests/[requestId]/route.ts` (continue de renvoyer `items` complets : `RequestStatusActions` a besoin de `unprintedIds(items)` pour la clôture).

**Interfaces:**
- Consomme : `withStaffAuth`, `loadStaffRequest`, `guarded`, `json` (`@/lib/print-requests/staff-api`), `organizerRoute`, `loadRequest` ; `parseListPage`.
- Produit :
  - `GET /api/platform/print/requests/{requestId}/items?q&page&pageSize` → `{ items: { registrationId: string; position: number; firstName: string; lastName: string; categoryName: string; status: RegistrationStatus; badgePrinted: boolean }[]; total: number; page: number; pageSize: number }`, tri `position asc` ; `q` : chaque mot présent dans prénom ou nom (comme `buildBadgeWhere`).
  - `GET …/print-requests/{requestId}/registrations?scope=items&q&page&pageSize` → même forme (accessible à tout rôle ayant accès à la commande, `allowArchived: true`) ; **sans `scope`, comportement actuel inchangé** (`{ candidates }`, consommé par `BadgeSelectionStep`).

- [ ] **Step 1: Tests staff (échouent)** — fabriques : commande ADVANCE avec 45 items ; `pageSize=10&page=2` → 10 items positions 11-20 ; `q` filtre sur un nom ; `page=99` borné ; commande d'une autre ressource/inexistante → 404 comme la route parente ; STAFF_OBSERVER autorisé (lecture) ; non-staff refusé. Run: `make test FILE="src/app/api/platform/print/requests/[requestId]/items"` — Expected: FAIL.
- [ ] **Step 2: Route staff** : garde identique à la route parente, `paginate` sur `printRequestItem` (`where: { requestId, registration: tokenFilter }`), DTO ci-dessus. PASS.
- [ ] **Step 3: Tests + route organisateur** : `scope=items` renvoie la tranche paginée des items **de cette commande** (jamais ceux d'une autre commande du même évènement) ; sans `scope`, test existant de `candidates` toujours vert ; staff en consultation autorisé comme aujourd'hui.
Run: `make test FILE="src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/registrations"` — Expected: FAIL puis PASS.
- [ ] **Step 4: Couverture** — `make test-coverage` ne doit pas faire baisser `src/app/api/**` sous 100 %. Expected: seuils OK.
- [ ] **Step 5: Commit** — `feat(impression): liste paginee des badges d'une commande`

---

### Task 11: `AppShell` / `FullHeightPage` et fonctions pures de la page commande

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/FullHeightPage.tsx`, `src/components/print/order-steps.ts`, `src/components/print/quote-message.ts`, `src/components/print/entry-tone.ts`, tests `src/components/print/__tests__/{order-steps,quote-message,entry-tone}.test.ts`, `src/components/layout/__tests__/FullHeightPage.test.tsx`

**Interfaces — Produit :**
- `AppShell` : `<main>` reçoit `relative` (et rien d'autre : aucun effet sur les autres pages). **Écart avec la spec** (« option pleine hauteur ») : le layout serveur est partagé par toutes les pages, une prop ne peut pas venir de la page ; l'option est donc le composant `FullHeightPage` rendu **par la page** :
  `FullHeightPage({ children }): JSX` → `<div className="absolute inset-0 flex min-h-0 flex-col">` ; il remplit le `<main>` (padding compris, bandeau staff déduit) et masque le padding de `main` pour cette page seulement.
- `orderSteps(status: PrintRequestStatus, type: PrintRequestType): { key: PrintRequestStatus; label: string; state: "done" | "current" | "todo" | "stopped" }[]` — frise ADVANCE : SUBMITTED « Envoyée » → QUOTED « Devis » → ACCEPTED « Accepté » → PAID « Payée » → IN_PRODUCTION « Production » → READY « Prête » → COMPLETED « Terminée ». REJECTED/CANCELLED : étapes passées `done`, l'étape courante `stopped` et aucune suivante. DRAFT : tout `todo`. (Même frise pour ONSITE ; libellés depuis `PRINT_REQUEST_STATUS_LABELS` quand ils existent.)
- `parseQuoteMessage(body: string): { version: number; total: string; rows: string[] } | null` — reconnaît le récapitulatif produit par `summarizeQuoteDiff` (`Devis v{n} : …`, lignes `• …`, `Total : …`) ; `null` sinon.
- `entryTone(entry: { side: "ORGANIZER" | "STAFF" | "SYSTEM"; kind: "MESSAGE" | "EVENT"; eventType: string | null; internal?: boolean }, viewer: "STAFF" | "ORGANIZER"): "client" | "staff" | "quote" | "internal" | "event"` — message client → `client` (fond neutre `bg-slate-100`), message staff → `staff` (teinté vert), `QUOTE_SENT` (et son récapitulatif) → `quote` (couleur propre, indigo), note interne → `internal` (ambre), tout évènement système → `event`. Les classes Tailwind associées sont exportées par `toneClasses: Record<Tone, string>`.

- [ ] **Step 1: Tests (échouent)** : `orderSteps("PAID", "ADVANCE")` → 3 `done`, `PAID` `current`, 3 `todo` ; `orderSteps("REJECTED", …)` → marque stoppée, rien après ; `parseQuoteMessage` reconnaît un récapitulatif complet et une v2 « modifications depuis la version précédente », renvoie `null` pour « Bonjour » ; `entryTone` : les 5 cas, y compris message staff vu par l'organisateur (`staff`) et `QUOTE_SENT` (`quote`) ; `FullHeightPage` rend la classe `absolute inset-0` (`renderToStaticMarkup`).
Run: `make test FILE=src/components/print/__tests__ && make test FILE=src/components/layout/__tests__/FullHeightPage.test.tsx` — Expected: FAIL.
- [ ] **Step 2: Implémenter** les trois modules et `FullHeightPage`, ajouter `relative` à `main` dans `AppShell`. PASS.
- [ ] **Step 3: Vérifier** qu'aucune page existante ne change : `make test-e2e FILE=e2e/platform/dashboard.spec.ts` — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(impression): socle de mise en page de la page commande`

---

### Task 12: Composants communs de la page commande

**Files:**
- Create (dans `src/components/print/`) : `OrderModal.tsx`, `OrderBadgesDialog.tsx`, `OrderSteps.tsx`, `OrderTabs.tsx`, `QuoteMessageCard.tsx` ; tests `src/components/print/__tests__/{OrderSteps,QuoteMessageCard}.test.tsx`
- Modify: `src/components/print/QuoteLinesTable.tsx` (variante compacte optionnelle `compact?: boolean`, API existante conservée), `src/components/print/PrintThread.tsx` (utilise `entryTone` / `QuoteMessageCard` pour son rendu des messages)

**Interfaces — Produit :**
- `OrderModal({ open, title, onClose, size?: "md" | "xl", children, footer? })` — calque `fixed inset-0 z-50` en portail, boîte `max-w-2xl` (md) ou `max-w-4xl` (xl), `role="dialog"`, Échap et bouton « Fermer ». (`ui/Dialog` est en lecture seule et limité à 2xl : le devis éditable demande plus de largeur.)
- `OrderBadgesDialog({ open, onClose, fetchUrl: string })` — client ; charge `fetchUrl?q&page&pageSize` (shape de la Task 10), champ de recherche différé 300 ms, tableau Nom / Catégorie / Statut / Imprimé, pagination **locale à la modale** (états `page`/`pageSize` internes, `Pagination` du socle avec `PAGE_SIZE_OPTIONS`, pas d'URL), défaut 20, état de chargement et « Aucun badge ».
- `OrderSteps({ status, type })` — frise horizontale (verticale sous `sm`) issue de `orderSteps`, `aria-current="step"` sur l'étape courante.
- `OrderTabs({ tabs: { id: string; label: string; panel: ReactNode }[]; defaultId: string })` — client ; visible sous `xl` (`xl:hidden`), un seul panneau monté à la fois ; le conteneur des colonnes reste responsable de l'affichage ≥ `xl`.
- `QuoteMessageCard({ version, total, rows, lines?: { label: string; quantity: number; unitPrice: number }[] })` — carte couleur `toneClasses.quote` ; avec `lines` : tableau Ligne / Qté / Prix unitaire / Total ligne + total ; sans `lines` : tableau Ligne / Évolution construit depuis `rows` (texte brut, jamais de HTML).

- [ ] **Step 1: Tests (échouent)** : `renderToStaticMarkup` de `OrderSteps` (étape courante, étapes futures) ; de `QuoteMessageCard` avec `lines` (en-têtes « Quantité », total formaté `formatFcfa`) et sans `lines` (lignes `rows` rendues en texte, `<script>` échappé).
Run: `make test FILE=src/components/print/__tests__` — Expected: FAIL.
- [ ] **Step 2: Implémenter** les cinq composants ; `PrintThread` : bulle client neutre, staff teintée, `QuoteMessageCard` pour `QUOTE_SENT` + son récapitulatif (le récapitulatif texte qui suit immédiatement l'évènement du même numéro de version n'est pas affiché deux fois : l'évènement `QUOTE_SENT` porte la carte, le message récapitulatif associé alimente `rows` quand `details.lines` est absent). **Chaîne de repli des lignes** : `details.lines` de l'évènement (toujours présent côté staff) → sinon lignes courantes du devis passées par la page si `version === quoteVersion` → sinon `rows` du récapitulatif.
- [ ] **Step 3: Relancer** : `make test FILE=src/components/print/__tests__` — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(impression): composants communs de la page commande`

---

### Task 13: Page commande staff

**Files:**
- Modify: `src/app/platform/print/orders/[requestId]/page.tsx` (enveloppe le rendu dans `FullHeightPage` via `RequestDetail`), `src/components/staff/print/RequestDetail.tsx`, `src/components/staff/print/order/{OrderSummaryColumn,OrderConversation,OrderComposer,OrderQuoteColumn}.tsx`, `src/components/staff/print/QuoteEditor.tsx` (rendu sans `Card` quand utilisé en modale : prop `bare?: boolean`), `src/components/staff/print/RequestStatusActions.tsx` (placement en en-tête, logique inchangée)
- Create: `src/components/staff/print/order/OrderBadgesButton.tsx`
- Test: `e2e/platform/print-request-detail.spec.ts` (étendu), tests unitaires existants de `request-actions`

**Interfaces:**
- Consomme : `FullHeightPage`, `OrderSteps`, `OrderTabs`, `OrderModal`, `OrderBadgesDialog` (fetchUrl = `requestUrl(id, "/items")`), `QuoteMessageCard`, `entryTone`, `canEditQuote(status, role)`, `PaymentHistory` (props actuelles, lecture seule).
- Produit : aucune API ; props de `RequestDetail` **inchangées** (la page serveur ne change pas de données).

**Disposition (validée par l'utilisateur)** :
- En-tête `flex-none` : lien retour « Commandes », `request.reference`, `PrintRequestStatusBadge`, puis les boutons : « Voir les badges (N) » (ADVANCE, N = `items.length`) → `OrderBadgesDialog`, « Modifier le devis » (si `canEditQuote`) → `OrderModal size="xl"` contenant `QuoteEditor bare`, et `RequestStatusActions` (action principale du statut). En-tête repliable en 2 lignes sous `sm` (`flex-wrap`).
- ≥ `xl` : grille `[260px_minmax(0,1fr)_340px]` ; **chaque colonne `min-h-0 overflow-y-auto`**, la colonne centrale étant un `flex flex-col` : zone des messages `flex-1 min-h-0 overflow-y-auto`, `OrderComposer` `flex-none` collé en bas.
- Colonne gauche : `OrderSteps` en tête, puis l'essentiel (évènement, organisation, badges, livraison / sur place, contact), puis `<details>` « Détails » repliés (template, dates, total accepté, remarques).
- Colonne droite : résumé du devis (lecture seule, `QuoteLinesTable compact`), `RequestCreditPanel`, `OnsiteRequestPanel`, `OrderSheetPanel`, `PaymentHistory`.
- < `xl` : `OrderTabs` Infos / Discussion / Devis, **Discussion par défaut** ; le composer reste collé en bas de l'onglet Discussion. Le polling du fil ne se déclenche que si le panneau Discussion est monté (ou continue de marquer lu : conserver `onFirstRead`).
- Suppression de l'ancienne carte « Badges » en bas de page (remplacée par la modale).

- [ ] **Step 1: e2e (échoue)** — étendre `e2e/platform/print-request-detail.spec.ts` : en-tête contient référence, statut et boutons et **reste visible après défilement du fil** (position `y` inchangée) ; « Voir les badges (N) » ouvre la modale, la recherche filtre, la taille 10 et la page 2 fonctionnent (commande à 45 items) ; « Modifier le devis » ouvre la modale et l'édition d'une ligne persiste (reprendre les assertions existantes d'édition de devis) ; le message de devis s'affiche en tableau (`role="table"` dans la carte) ; couleurs : bulle client / staff / devis ont des classes distinctes ; composer collé en bas (bas du composer ≈ bas du viewport) ; à 1280 px, trois colonnes visibles simultanément (`boundingBox` côte à côte) et `window.scrollY === 0` (la page ne défile pas) ; à 1024 et 375 px, onglets présents, **Discussion actif par défaut**, `expectNoHorizontalOverflow`. Conserver tous les tests existants (adapter seulement les localisateurs déplacés).
Run: `make test-e2e FILE=e2e/platform/print-request-detail.spec.ts` — Expected: FAIL.
- [ ] **Step 2: `QuoteEditor`** : prop `bare` (pas de `Card`/`CardHead`) ; logique inchangée.
- [ ] **Step 3: `OrderBadgesButton`** : bouton + `OrderBadgesDialog`, props `{ requestId: string; count: number }`.
- [ ] **Step 4: Restructurer `RequestDetail` et les colonnes** selon la disposition ci-dessus ; la page serveur enveloppe dans `FullHeightPage` (et **retire** le `space-y-4` extérieur de `RequestDetail`). `OrderConversation` : retirer `max-h-[60vh]`/`lg:max-h-[calc(100vh-22rem)]` (la hauteur vient du conteneur flex), garder `stick`, « Nouveaux messages » et le polling ; `OrderComposer` sans bordure de carte propre (barre collée).
- [ ] **Step 5: Relancer** — `make test-e2e FILE=e2e/platform/print-request-detail.spec.ts` — Expected: PASS. Puis `make test-e2e FILE=e2e/platform/print-request-onsite.spec.ts` — Expected: PASS (page `onsite` non modifiée, non-régression).
- [ ] **Step 6: Commit** — `feat(impression): page commande staff en pleine hauteur`

---

### Task 14: Page commande organisateur

**Files:**
- Modify: `src/app/event/[eventId]/print/[requestId]/page.tsx`, `src/components/event/print/order/{OrganizerConversation,OrganizerComposer,OrganizerOrderSummary,OrganizerQuoteColumn}.tsx`, `src/components/event/print/{PrintRequestActions,PrintPayButton}.tsx` (placement seulement)
- Test: `e2e/event/print-request-detail.spec.ts`, `e2e/event/print-conversation.spec.ts`

**Interfaces:**
- Consomme : mêmes composants communs ; `OrderBadgesDialog` avec `fetchUrl = ${base}/${requestId}/registrations?scope=items` (Task 10) — la modale **ajoute** `&q&page&pageSize` ; `PrintRequestActions` et `PrintPayButton` gardent leurs props.
- Produit : aucune API.

**Disposition** : identique à la Task 13 côté organisateur : en-tête fixe (retour « Impression », `Commande d'impression {reference}`, statut, « Voir les badges (N) » pour ADVANCE, `PrintRequestActions` — Accepter / Modifier / Annuler — et `PrintPayButton`) ; alertes de crédit / template inadapté placées en tête de la colonne gauche ; colonne gauche `OrganizerOrderSummary` + `OrderSteps` + compteur sur place ; centre `OrganizerConversation` (liste scrollable, `OrganizerComposer` collé en bas ; l'`initialEntries` rendu serveur et `markRead` inchangés) ; droite `OrganizerQuoteColumn` (devis en lecture, paiements). **Pas de modale d'édition du devis** (l'organisateur ne l'édite pas) ; le bouton « Modifier » existant mène à la page `edit/` (non modifiée). Messages : client = « mine » (neutre), équipe Badge teintée, devis en `QuoteMessageCard` (**arbitrage relecture croisée** : `src/lib/print-requests/thread.ts` est attribué au lot 2c ; ajouter `"lines"` à la liste blanche `ORGANIZER_DETAILS` de `QUOTE_SENT`, avec test, pour que l'organisateur ait le tableau sur toutes les versions ; les replis restent pour les évènements anciens).

- [ ] **Step 1: e2e (échoue)** — étendre `print-request-detail.spec.ts` et `print-conversation.spec.ts` : en-tête fixe et boutons visibles après défilement ; bouton « Accepter le devis » présent dans l'en-tête quand le statut est QUOTED ; modale des badges (commande 45 badges) avec recherche et pagination ; message de devis en tableau ; bulles de couleurs distinctes ; composer collé en bas ; 3 colonnes à 1280 px, onglets avec Discussion par défaut à 1024 et 375 px, `expectNoHorizontalOverflow` aux trois tailles ; un staff en consultation voit la page sans composer (`postUrl` nul) et sans boutons d'action (`readOnly`). Conserver les assertions existantes (non-lus, polling, pièces jointes, paiement).
Run: `make test-e2e FILE=e2e/event/print-request-detail.spec.ts` — Expected: FAIL.
- [ ] **Step 2: Restructurer** la page serveur (enveloppe `FullHeightPage`, calculs de données inchangés) et les composants selon la disposition.
- [ ] **Step 3: Relancer** — `make test-e2e FILE=e2e/event/print-request-detail.spec.ts`, `make test-e2e FILE=e2e/event/print-conversation.spec.ts`, `make test-e2e FILE=e2e/event/print-new.spec.ts`, `make test-e2e FILE=e2e/event/print-payment-return.spec.ts` — Expected: PASS (les deux derniers : non-régression du wizard et du retour de paiement).
- [ ] **Step 4: Commit** — `feat(impression): page commande organisateur en pleine hauteur`

---

### Task 15: e2e, doc, vérification

**Files:**
- Modify: `docs/v4/features/impression-demandes.md` (sections concernées seulement : liste des commandes paginée, page commande refondue, modales, routes `…/items` et `…/registrations?scope=items`)
- Modifier aussi si besoin la doc de pagination déjà posée par le socle : **ne pas** (hors lot).

- [ ] **Step 1: Documentation** — décrire : disposition de la page commande (en-tête fixe, trois colonnes ≥ 1280 px, onglets en dessous), codes couleur des messages, modale des badges et sa route paginée, règle de la liste des badges non paginée dans `GET …/requests/{id}` (nécessaire à la clôture), `?scope=items`. Français, style existant du fichier.
- [ ] **Step 2: Vérification complète**

Run: `make lint && make typecheck && make test-coverage`
Expected: lint sans warning, typecheck OK, Vitest vert avec seuils 100 % (`src/lib/**`, `src/app/api/**`) respectés.

- [ ] **Step 3: e2e du lot**

Run (un par un) : `make test-e2e FILE=e2e/event/print-request-detail.spec.ts`, `FILE=e2e/event/print-conversation.spec.ts`, `FILE=e2e/platform/print-request-detail.spec.ts`, `FILE=e2e/event/pagination.spec.ts`, `FILE=e2e/org/pagination.spec.ts`, `FILE=e2e/platform/pagination.spec.ts`, `FILE=e2e/public/account-pagination.spec.ts`, puis les specs existantes modifiées listées en tête.
Expected: PASS. Une erreur en masse sur plusieurs specs : vérifier d'abord le SMTP du seed (`make db-seed`) et un éventuel 404 Turbopack (redémarrer le conteneur app) avant de déboguer le code.

- [ ] **Step 4: Contrôle visuel manuel** — via le navigateur sur la stack du lot : page commande staff et organisateur à 375, 1024 et 1280 px (en-tête, défilement indépendant, composer, modales), et une liste par espace à 375 px. Noter les anomalies dans Progression ; ne rien affirmer sans l'avoir vu.
- [ ] **Step 5: Journal** — mettre la table Progression à jour (`[x]`, dates). Commit : `docs(impression): page commande et pagination`.
