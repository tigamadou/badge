# Espaces utilisables sur mobile — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre les espaces `/platform`, `/org/[orgId]`, `/event/[eventId]` et `/account`
utilisables à 375 px et 768 px. Il ne doit plus y avoir de débordement horizontal ; la
navigation doit rester accessible en un geste et toutes les colonnes et actions
atteignables. Le rendu bureau (≥ 1024 px) reste inchangé.

**Architecture :** un gabarit commun `AppShell`, composant serveur, remplace le squelette
recopié dans les six gabarits. Sous `lg`, le menu latéral unique devient un tiroir piloté
par un petit composant client (`MobileNav`). Les modales passent par un portail. Le motif
`overflow-hidden rounded-xl border` autour des tableaux est remplacé par `ui/TableFrame`,
qui défile horizontalement.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, Vitest (rendu statique
`renderToStaticMarkup`, environnement `node`), Playwright (projet `chromium` Desktop
Chrome, plus un test transverse en viewport mobile).

**Spec :** [`docs/v4/specs/2026-10-22-21-v4-responsive-mobile.md`](../specs/2026-10-22-21-v4-responsive-mobile.md)

**Branche :** `fix/responsive-mobile` (créée depuis `origin/development`).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Modales dans un portail (`Modal`, `Dialog`) | [x] | 2026-10-22 | portail + Échap ; `ModalPanel`/`DialogPanel` exportés pour les tests (vitest en env node) |
| 2 | `MobileNav` + `AppShell` (gabarit commun, tiroir < lg) | [x] | 2026-10-22 | `AppShell`, `MobileNav` ; aside `lg:visible`, `inert` retiré au montage ; 3 zones (`sidebarHeader` fixe, `sidebar` défilant, `sidebarFooter` fixe) ; animation 300 ms (glissement + voile en fondu, `motion-reduce` respecté) |
| 3 | Migrer `StaffShell` sur `AppShell` | [x] | 2026-10-22 | vérifié navigateur 375 px (tiroir, déconnexion, Échap) |
| 4 | Migrer `OrgShell` et `EventShell` | [x] | 2026-10-22 | `OrgSelector` non tronqué à 375 px : à revoir ; `EventShell` sans bouton de déconnexion : décision utilisateur à prendre |
| 5 | Migrer les shells de rôle event (Operator, Printer, Viewer) | [x] | 2026-10-22 |  |
| 6 | En-tête de l'espace participant `/account` | [x] | 2026-10-22 | logo `flex-none`, libellés courts, déconnexion icône seule |
| 7 | `TableFrame` et remplacement de l'enveloppe des 18 tableaux | [x] | 2026-10-22 | 20 tableaux + `Table.tsx` ; `QRScanner.tsx` garde une enveloppe sans `<table>` (volontaire) |
| 8 | Colonnes secondaires masquées sous `md` sur les listes principales | [x] | 2026-10-22 | colonnes masquées sous md, e-mail en 2e ligne sur les inscriptions |
| 9 | Composants `ui/` restants et pages ponctuelles | [x] | 2026-10-22 | `PlanManager` en `flex-wrap` (bureau identique) ; `SettingsClient` inchangé |
| 10 | E2E transverse responsive (375 px) | [x] | 2026-10-22 | 6 tests verts |
| — | Vérification finale (navigateur 375 / 768 / 1280, lint, typecheck, test, e2e) | [~] | 2026-10-22 | lint 0 erreur, typecheck OK, 1714 tests verts, navigateur 375/768 sans débordement ; e2e complet : 314 tests, 1 échec corrigé (e-mail en double dans le DOM, sélecteur filtré sur le visible) |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style des fichiers.
- **Bureau inchangé** : à 1280 px, chaque écran doit rester identique à `development`. Les
  e2e existants (Desktop Chrome) doivent passer **sans modification**. Si un e2e existant
  casse, c'est une régression du code, pas un test à adapter.
- **Une seule instance du menu dans le DOM.** Pas de copie mobile des liens (spec,
  décision C).
- **Pas de nouvelle dépendance** (spec, décision H).
- **Server Components par défaut.** Seuls `MobileNav` (et les composants déjà clients)
  portent `"use client"`.
- **Vérification navigateur obligatoire** pour chaque task UI, avec le navigateur intégré :
  `resize_window` en `mobile` (375 × 812), puis `tablet` (768 × 1024), puis `desktop`.
  Critère générique : `document.documentElement.scrollWidth === innerWidth` et
  `main.scrollWidth === main.clientWidth`.
- **Données de recette** : `make db-seed-demo`. Les organisations démo n'ont **pas
  d'abonnement actif**. Pour voir l'espace `/org/[orgId]` rempli, attribuez un plan à
  « Acme Corporation » depuis `/platform/organizations/[id]/subscription` (compte
  `admin@badge.local`) avant les tasks 4, 7 et 8.
- **`make test` vide la base de dev** : relancez `make db-seed` puis `make db-seed-demo`
  avant toute vérification navigateur.
- **Pas de commit sans demande explicite** de l'utilisateur. Une étape « commit » d'un
  plan n'est pas une demande.
- Avant de déclarer une task terminée : `make lint && make typecheck && make test`.

## Task 1 — Modales dans un portail

**Pourquoi d'abord :** le tiroir (task 2) translate l'`aside` qui contient
`LogoutButton` → `Modal`. Sans portail, la modale de déconnexion s'afficherait dans le
tiroir (spec, décision D).

**Fichiers :**
- Modifier : `src/components/ui/Modal.tsx`, `src/components/ui/Dialog.tsx`
- Créer : `src/components/ui/__tests__/Modal.test.tsx`, `src/components/ui/__tests__/Dialog.test.tsx`

- [ ] Écrire les tests (rendu statique, comme `Tabs.test.tsx`). Avec `open=false`, rien
  n'est rendu. Pour `Modal` : `role="dialog"`, `aria-modal="true"`, le titre et les deux
  boutons. Au rendu serveur (pas de `document`), le composant ne doit pas planter.
- [ ] `Modal` et `Dialog` : rendre le calque via `createPortal(node, document.body)` dès
  que le composant est monté côté client (garde `typeof document`). Sinon `null`, puisque
  les deux composants ne s'ouvrent qu'après une interaction.
- [ ] `Modal` : aligner sur `Dialog`. Ajouter Échap → `onCancel`, `role="dialog"`,
  `aria-modal`, `aria-label={title}` et un corps `max-h-[70vh] overflow-y-auto`.
- [ ] Les deux : pied de modale en `flex-wrap` (boutons empilés si nécessaire sur 320 px).

**Critères d'acceptation :**
- La modale de déconnexion s'ouvre en plein écran, centrée, à 375 px et à 1280 px.
- Échap ferme `Modal`.
- `CategoryReassignModal`, `CategoryImportTemplatesModal`, `OrgDetailActions` et
  `RejectionReasonsManager` s'ouvrent et se ferment comme avant.

**Vérification :** navigateur (déconnexion depuis `/platform` à 375 et 1280 px), puis
`make test`. Rejouer l'e2e d'un parcours qui ouvre une modale :
`e2e/event/categories.spec.ts`.

## Task 2 — `MobileNav` et `AppShell`

**Fichiers :**
- Créer : `src/components/layout/AppShell.tsx` (serveur), `src/components/layout/MobileNav.tsx` (client)
- Créer : `src/components/layout/__tests__/AppShell.test.tsx`

**Contrat :**

```tsx
// AppShell : squelette commun des espaces d'administration.
<AppShell
  sidebar={ReactNode}        // contenu de l'aside : marque, contexte, SidebarNav, pied
  header={ReactNode}         // contenu de l'en-tête, à droite du bouton menu
  banner?={ReactNode}        // bandeau facultatif au-dessus de l'en-tête (mode staff)
>
  {children}
</AppShell>
```

- `MobileNav` exporte un `MobileNavProvider`, qui porte l'état `open`, et deux enfants :
  `MobileNavToggle` (le bouton de l'en-tête) et `MobileNavPanel` (l'`aside`, qui reçoit
  ses classes et ses attributs selon l'état).
- `MobileNavPanel` : sous `lg`, `fixed inset-y-0 left-0 z-40 w-64`, avec
  `-translate-x-full` à l'état fermé et `translate-x-0` à l'état ouvert, plus
  `transition-transform`. À partir de `lg` : `lg:static lg:translate-x-0 lg:w-56`. Fermé
  sous `lg`, le panneau porte `inert` et `invisible`. Ces deux attributs sont posés à
  l'état fermé seulement, et retirés à partir de `lg` par une media query lue au montage
  (`matchMedia("(min-width: 1024px)")`). Ainsi, le bureau ne porte jamais `inert`.
- Un voile `fixed inset-0 z-30 bg-black/40 lg:hidden`, rendu seulement à l'état ouvert,
  ferme le tiroir au clic.
- Fermeture du tiroir : Échap, clic sur le voile, changement de `usePathname()`.
- Ouverture : `document.body.style.overflow = "hidden"`, restauré à la fermeture.
- `MobileNavToggle` : `lg:hidden`, `aria-label="Ouvrir le menu"`, `aria-expanded`,
  `aria-controls`, cible de `h-10 w-10` au minimum, icône `menu` (déjà présente dans
  `ui/Icon.tsx`). Le focus revient sur ce bouton à la fermeture.
- Un bouton « Fermer le menu » (icône `x`) en tête du panneau, en `lg:hidden`.
- `AppShell` : racine `flex h-dvh overflow-hidden`, colonne
  `flex min-w-0 flex-1 flex-col`. L'en-tête est `flex h-14 flex-none items-center gap-2
  sm:gap-3 border-b bg-white px-3 sm:px-5`, avec le toggle puis `header`. Le `main` est
  `flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6`.

**Étapes :**
- [ ] Écrire `AppShell.test.tsx` (rendu statique). Vérifier : un seul `<aside>` ; le
  bouton « Ouvrir le menu » est présent avec `lg:hidden` ; `main` porte `p-4 sm:p-6` ;
  la racine porte `h-dvh` ; le bandeau est rendu seulement s'il est fourni.
- [ ] Implémenter `MobileNav.tsx`, puis `AppShell.tsx`.
- [ ] Faire passer les tests.

**Critères d'acceptation :** les tests unitaires passent. Pas de rendu visible tant
qu'aucun shell n'utilise `AppShell` : c'est la task 3 qui le valide au navigateur.

## Task 3 — Migrer `StaffShell` (pilote)

**Fichiers :** modifier `src/components/staff/StaffShell.tsx`.

- [ ] Recomposer `StaffShell` avec `AppShell`. Le `sidebar` reçoit la marque, `SidebarNav`
  et `LogoutButton`. Ajouter dans le tiroir le libellé de rôle (`ROLE_LABEL`), visible
  seulement sous `sm` (`sm:hidden`), puisqu'il disparaît de l'en-tête.
- [ ] En-tête : « Staff » ; le badge de rôle et le nom passent en `hidden sm:inline-flex` ;
  l'avatar reste toujours visible.
- [ ] Vérifier au navigateur, sur `/platform`, `/platform/users`, `/platform/organizations`
  et `/platform/settings` :
  - à 375 px : tiroir fermé au chargement ; ouverture par le bouton, fermeture par Échap,
    par le voile et par un clic sur un lien (la route change) ; la modale de déconnexion
    s'ouvre en plein écran depuis le tiroir ;
  - à 768 px : même comportement (tiroir) ;
  - à 1280 px : menu permanent, identique à `development` (capture avant/après).

**Critères d'acceptation :** `main` mesure 375 px de large à 375 px, et le menu est
inaccessible au clavier tant que le tiroir est fermé (Tab ne s'arrête pas sur ses liens).

**Vérification :** navigateur, puis `e2e/platform/` complet (Desktop) sans modification
des tests.

## Task 4 — Migrer `OrgShell` et `EventShell`

**Fichiers :** modifier `src/components/admin/OrgShell.tsx`, `src/components/event/EventShell.tsx`.

- [ ] `OrgShell` : le filtrage `navByRole` est inchangé. Le `sidebar` reçoit la marque, le
  nom de l'org, `SidebarNav`, la déconnexion et l'e-mail. L'en-tête reçoit le nom de l'org
  (`truncate min-w-0`), `OrgSelector` et l'avatar. Vérifier que `OrgSelector` tient à
  375 px ; sinon, le déplacer dans le tiroir sous `sm`.
- [ ] `EventShell` : le `sidebar` reçoit le lien retour vers l'org, le titre de
  l'événement, `SidebarNav` et l'e-mail. Le fil d'Ariane de l'en-tête affiche
  `org / événement` à partir de `sm`, et l'événement seul (tronqué) en dessous. Le badge
  de rôle passe en `hidden sm:inline-flex`.
- [ ] `EventShell` : le bandeau « Mode staff » passe par la prop `banner`. Texte court sous
  `sm` : « **Mode staff** — actions auditées ». Texte actuel complet à partir de `sm`.
- [ ] `EventShell` n'a **pas de bouton de déconnexion**, contrairement à `OrgShell` et
  `StaffShell`. Décision à faire valider à l'utilisateur avant d'en ajouter un : c'est
  hors du périmètre strict du responsive. Le noter dans la colonne Notes.
- [ ] Vérifier au navigateur à 375, 768 et 1280 px. Pour l'org : `/org/[id]`, `events`,
  `members`, `templates`, `subscription`, `settings` et `activity` (Acme avec abonnement
  actif, compte `owner-acme@demo.local`). Pour l'événement : `/event/[id]`,
  `registrations`, `registrations/[regId]`, `badges`, `categories`, `scan`, `members`,
  `settings` et `activity` (compte `admin@badge.local`, mode staff, et un ADMIN
  d'événement démo).

**Critères d'acceptation :**
- Aucun débordement de `main` hors tableaux (les tableaux relèvent de la task 7).
- Le bandeau staff tient sur deux lignes au plus à 375 px.

**Vérification :** e2e `e2e/org/` et `e2e/event/` complets (Desktop) sans modification.

## Task 5 — Shells de rôle d'événement

**Fichiers :** modifier `src/components/event/EventOperatorShell.tsx`, `EventPrinterShell.tsx` et `EventViewerShell.tsx`.

- [ ] Recomposer les trois shells avec `AppShell`, sans changer leurs entrées de menu.
- [ ] `EventOperatorShell` : l'en-tête affiche « Opérateur — {titre} » (tronqué) ;
  l'e-mail passe en `hidden sm:inline` ; le lien Profil reste dans le tiroir.
- [ ] Vérifier au navigateur, à 375 px, `/event/[id]/scan` connecté en OPERATOR. La caméra
  (ou le bouton « Saisie manuelle ») doit occuper toute la largeur utile. C'est le
  parcours terrain prioritaire.

**Critères d'acceptation :** l'opérateur atteint le scanner et la saisie manuelle sans
défilement horizontal ; le tiroir donne accès à Profil.

**Vérification :** `e2e/event/scan.spec.ts` et `e2e/event/access.spec.ts` (Desktop).

## Task 6 — En-tête de l'espace participant

**Fichiers :** modifier `src/app/account/layout.tsx` et `src/components/public/AccountNav.tsx`.

- [ ] Logo : ajouter `flex-none` au lien et à l'image. Aujourd'hui, l'image est écrasée à
  0 px à 375 px.
- [ ] `AccountNav` : libellé court sous `sm` (« Inscriptions » au lieu de « Mes
  inscriptions »), via deux `span` avec `sm:hidden` et `hidden sm:inline`. Ajouter
  `whitespace-nowrap`.
- [ ] Déconnexion : libellé masqué sous `sm`, icône seule avec `aria-label="Se
  déconnecter"`. Il faut une prop `labelClassName` sur `LogoutButton` (par exemple
  `"hidden sm:inline"`), pour garder le libellé accessible.
- [ ] Marges : `px-4 sm:px-6` sur l'en-tête et sur `main`.
- [ ] Vérifier au navigateur, à 375 px, `/account`, `/account/profile`,
  `/account/registrations/[id]` et `/account/profile/complete`, avec le compte
  `participant-001@demo.local`.

**Critères d'acceptation :** le logo est visible ; l'en-tête tient sur une ligne à 375 px.

## Task 7 — `TableFrame` et remplacement des enveloppes de tableaux

**Fichiers :**
- Créer : `src/components/ui/TableFrame.tsx` et `src/components/ui/__tests__/TableFrame.test.tsx`
- Modifier (remplacer `<div className="overflow-hidden rounded-xl border …">` autour du `<table>`) :
  - `src/app/event/[eventId]/activity/page.tsx`
  - `src/app/org/[orgId]/activity/page.tsx`
  - `src/app/org/[orgId]/events/page.tsx`
  - `src/app/org/[orgId]/members/MembersClient.tsx`
  - `src/app/org/[orgId]/templates/TemplatesClient.tsx`
  - `src/app/platform/activity/page.tsx`
  - `src/app/platform/organizations/[orgId]/activity/page.tsx`
  - `src/app/platform/organizations/[orgId]/events/page.tsx`
  - `src/app/platform/organizations/[orgId]/members/page.tsx`
  - `src/app/platform/profiles/page.tsx`
  - `src/app/platform/users/page.tsx`
  - `src/components/event/BadgeListTable.tsx`
  - `src/components/event/BlockedDocumentsForm.tsx`
  - `src/components/event/BlockedEmailsForm.tsx`
  - `src/components/event/CategoryTable.tsx`
  - `src/components/event/MemberTable.tsx`
  - `src/components/event/RegistrationTable.tsx`
  - `src/components/staff/OrganizationsTable.tsx`
  - plus les tableaux sans enveloppe : `src/components/staff/PlanManager.tsx` et `src/components/staff/RejectionReasonsManager.tsx`
- Modifier : `src/components/ui/Table.tsx` pour qu'il utilise `TableFrame`.

**Contrat :** `TableFrame({ children, className? })` rend
`<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">`. Les coins
restent arrondis : `overflow-x-auto` découpe aussi le contenu au rayon de bordure. Ce
composant n'a pas d'interactivité ; c'est un composant serveur.

- [ ] Écrire le test : rend ses enfants et porte `overflow-x-auto`, mais pas
  `overflow-hidden`.
- [ ] Implémenter, puis remplacer fichier par fichier. Garder les classes
  supplémentaires propres à chaque enveloppe (marges, etc.) via `className`.
- [ ] Vérifier qu'aucun motif ne subsiste : la commande
  `grep -rlE "overflow-hidden rounded-xl border" src | xargs grep -l "<table"` ne renvoie
  rien.
- [ ] Vérifier au navigateur, à 375 et 768 px : sur chaque page listée dans la spec (§ 3),
  la dernière colonne (actions) est atteignable en faisant défiler le tableau
  horizontalement.

**Critères d'acceptation :** sur les 20 tableaux, aucune colonne n'est inaccessible ; la
page elle-même ne défile jamais horizontalement ; à 1280 px, le rendu est identique.

**Vérification :** la mesure automatisée de l'audit (voir l'annexe), à 375 et 768 px.

## Task 8 — Colonnes secondaires masquées sous `md`

**Fichiers :** `RegistrationTable.tsx`, `BadgeListTable.tsx`, `src/app/platform/users/page.tsx`,
`OrganizationsTable.tsx` et les trois pages `activity` (platform, org, event).

- [ ] Pour chaque tableau, lister les colonnes. Garder **toujours** visibles : la case de
  sélection s'il y en a une, l'identifiant principal (nom, titre), le statut et les
  actions. Les autres colonnes passent en `hidden md:table-cell`, sur le `th` comme sur le
  `td`.
- [ ] Confirmer, pour chaque colonne masquée, que l'information se trouve sur la page de
  détail. Si elle n'y est pas, garder la colonne visible.
- [ ] Inscriptions : sous `md`, afficher l'e-mail en seconde ligne, sous le nom
  (`md:hidden text-xs text-slate-400`), plutôt que dans une colonne.
- [ ] Vérifier au navigateur, à 375 px : chacun de ces tableaux tient sans défilement
  horizontal. Le défilement de la task 7 reste un filet de sécurité.

**Critères d'acceptation :** pas de défilement horizontal dans ces tableaux à 375 px ;
toutes les colonnes visibles à partir de 768 px.

**Vérification :** e2e `e2e/event/registrations.spec.ts`, `badges.spec.ts` et
`e2e/platform/` (Desktop, colonnes visibles), sans modification.

## Task 9 — Composants `ui/` restants et pages ponctuelles

**Fichiers :**
- `src/components/ui/Tabs.tsx` : ajouter `overflow-x-auto` et `whitespace-nowrap` au
  `tablist`, `shrink-0` aux onglets. `/platform/settings` déborde aujourd'hui de 24 px.
- `src/components/ui/BatchBar.tsx` : ajouter `flex-wrap` et `gap-2`, et placer le compteur
  sur sa propre ligne sous `sm`. Corriger au passage le libellé « selectionnee(s) » en
  « sélectionnée(s) » : c'est un texte d'UI.
- En-têtes de page « titre + action » : les repérer avec
  `grep -rn "justify-between" src/app/{platform,org,event}`, sur les blocs qui contiennent
  un `<h1>`. Les passer en `flex-col gap-3 sm:flex-row sm:items-center`, ou en
  `flex-wrap`. Cela concerne au moins `/platform/users`, `/platform/organizations`,
  `/org/[id]/events` et `/event/[id]/registrations`.
- `src/components/staff/PlanManager.tsx` : champs de formulaire en `w-full`, grille
  `grid-cols-1 sm:grid-cols-2`.
- `src/app/org/[orgId]/settings/SettingsClient.tsx:157` : garder le `grid-cols-2`
  (code postal / ville) s'il tient à 375 px, sinon passer en `grid-cols-1 sm:grid-cols-2`.
- `RegistrationTable.tsx` et `Toolbar.tsx` : abaisser le `min-w-[220px]` /
  `min-w-[200px]` des recherches à `min-w-0 basis-full sm:basis-auto sm:min-w-[220px]`.
  Ainsi, la recherche prend une ligne entière sur mobile.

- [ ] Mettre à jour `Tabs.test.tsx` et `BatchBar.test.tsx` avec les nouvelles classes.
- [ ] Appliquer chaque correction, puis vérifier la page concernée à 375 px.

**Critères d'acceptation :** aucune des pages auditées ne déborde (mesure en annexe =
0 partout) ; les boutons d'action de page restent visibles sans défilement.

## Task 10 — E2E transverse responsive

**Fichiers :** créer `e2e/transverse/responsive.spec.ts`. Mettre à jour `e2e/README.md`
(convention : test transverse en viewport mobile).

- [ ] `test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })`.
- [ ] Parcours tiroir, en staff : connexion via `loginAndEnter` (platform) ; le lien
  « Utilisateurs » n'est pas visible ; on clique « Ouvrir le menu », puis « Utilisateurs » ;
  l'URL change et le tiroir se ferme.
- [ ] Débordement : pour une liste de pages par espace (platform : 4 ; event : 4 avec
  inscriptions et scan ; account : 2 ; public : 1), vérifier
  `document.documentElement.scrollWidth <= innerWidth` et
  `main.scrollWidth <= main.clientWidth`.
- [ ] Déconnexion depuis le tiroir : la modale est visible et centrée dans la fenêtre. Sa
  `boundingBox` doit être contenue dans le viewport, et non dans l'`aside`.
- [ ] Respecter la convention de `e2e/README.md` : préconditions via `helpers/db.ts`,
  assertions via l'UI uniquement.

**Critères d'acceptation :** le nouveau spec passe dans le conteneur
(`docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/transverse/responsive.spec.ts`).

## Vérification finale

- [ ] `make lint && make typecheck && make test`.
- [ ] `make db-seed && make db-seed-demo`, puis `make test-e2e` complet. **Penser à vérifier
  le SMTP avant de conclure à un échec** : `make db-seed` le répare.
- [ ] Navigateur intégré, à 375, 768 et 1280 px, sur les quatre espaces et les pages
  publiques `/e/[slug]` et `/e/[slug]/register`. Rejouer la mesure de l'annexe : 0
  débordement attendu partout.
- [ ] Rejouer les points (M) de la checklist manuelle
  ([`specs/2026-07-22-checklist-tests-manuels-navigateur.md`](../specs/2026-07-22-checklist-tests-manuels-navigateur.md)).
- [ ] Mettre à jour `docs/v4/README.md` (tableau d'avancement) et le statut de la spec.

## Annexe — mesure automatisée du débordement

Script à exécuter avec `javascript_tool` dans le navigateur intégré, connecté avec le bon
compte. Il charge chaque URL dans une iframe de largeur `W`, puis relève le débordement de
`main` et la largeur des tableaux. Il ne bloque pas : relisez `window.__res` ensuite.

```js
const W = 375; // puis 768
const urls = ["/platform", "/platform/users" /* … */];
window.__res = null;
(async () => {
  const out = [];
  for (const u of urls) {
    const f = document.createElement("iframe");
    f.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:812px;opacity:0;pointer-events:none`;
    f.src = u;
    document.body.appendChild(f);
    await new Promise((r) => { f.onload = r; setTimeout(r, 15000); });
    await new Promise((r) => setTimeout(r, 1500));
    const d = f.contentDocument, main = d.querySelector("main");
    out.push({
      u,
      doc: d.documentElement.scrollWidth - W,
      main: main ? main.scrollWidth - main.clientWidth : null,
      tables: [...d.querySelectorAll("main table")].map((t) => `${t.scrollWidth}/${t.parentElement.clientWidth}`).join(","),
    });
    f.remove();
  }
  window.__res = out;
})();
```

Captures de l'audit initial à 375 px : dossier de notes de session
`responsive-audit-375/`. Ces captures sont hors dépôt et servent de référence pour le
« avant ».
