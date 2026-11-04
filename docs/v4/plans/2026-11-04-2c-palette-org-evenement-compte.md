# Vague 2 · Lot 2c — Organisation, évènement, compte — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2b, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2c feat/nouvelle-palette` (le script crée la branche
> `feat/nouvelle-palette-2c` depuis `feat/nouvelle-palette`, **après** la vague 1). Toutes les
> commandes `make` se lancent **dans le worktree**. Sous-skill :
> `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. En
> exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan, messages en français ASCII, style conventional commits, sans co-auteur IA ; sinon aucun
> commit sans demande explicite de l'utilisateur. Modèle des sous-agents : `sonnet`.
> Commande de test ciblé : `make test FILE=<chemin>` ; e2e ciblé : `make test-e2e FILE=<chemin>`.

**Objectif :** migrer vers la palette « Deep Navy & Soft Gold » tout l'espace organisation
(`/org/**`), l'espace évènement (`/event/**`, y compris scanner), le compte participant
(`/account/**`) et les composants associés. **Couleurs seulement** : aucune structure, icône,
contenu, mise en page ni espacement ne change.

**Architecture :** remplacement des classes Tailwind en dur **par rôle**, jamais par teinte, en
consommant les couleurs du socle (`navy`, `navy-hover`, `gold`, `gold-strong`, `gold-soft`,
`turquoise`, `turquoise-strong`, `turquoise-soft`, `mist`, `line`, `nav-muted`, `warn`,
`warn-soft`) et les composants de `src/components/ui/**`. Les cinq shells de ce lot passent au menu
latéral clair défini par le socle (`AppShell` fournit le fond blanc et le trait `line` ; le lot
règle uniquement les couleurs de texte et d'état de ce qu'il injecte dans les slots).

**Tech Stack :** Next.js 16 (App Router), React 19, Tailwind CSS 4, Vitest 4, Playwright.

**Spec :** [`specs/2026-11-04-39-v4-nouvelle-palette.md`](../specs/2026-11-04-39-v4-nouvelle-palette.md)
— « Décisions », « Lisibilité », « Arbitrages », « Organisation du travail » (lot 2c). Plan du
socle : il prime sur ce plan en cas d'écart de nom de couleur ou de signature de composant : le
signaler dans la progression.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|------|----------|--------|------|-------|
| 1 | Shells et menu latéral clair (`SidebarNav`, `OrgShell`, 4 shells évènement) | [-] | 2026-11-04 | Déplacée au socle (tâche 4b) : navigation partagée avec StaffShell. Ne pas exécuter. |
| 2 | Pages `src/app/org/**` | [x] | 2026-11-04 |  |
| 3 | Pages `src/app/event/**` | [x] | 2026-11-04 |  |
| 4 | Compte (`src/app/account/**`, `components/account`, `components/activity`) | [x] | 2026-11-04 |  |
| 5 | `components/event` — formulaires, tableaux, actions, fonds | [x] | 2026-11-04 |  |
| 6 | `components/event/print/**` — assistant et conversation | [x] | 2026-11-04 |  |
| 7 | Scanner (`ScannerFrame`, `QRScanner`) et tests | [x] | 2026-11-04 | Test ScannerFrame : non-regression text-rose-700 ajoutee. |
| 8 | `components/admin` — hors shells | [x] | 2026-11-04 |  |
| 9 | `components/badge` et test `MiniBadge` | [x] | 2026-11-04 | BadgeDocumentView garde bg-[#8b8b90]. |
| 10 | Balayage final, contrôle des tests de classes | [x] | 2026-11-04 | Balayage vide hors exceptions. |
| 11 | e2e, contrôle visuel, vérification | [-] | 2026-11-04 | Differee a la vague 3 (e2e et passes completes interdits au lot). |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Après chaque task
validée : statut `[x]` + date ; en cas d'interruption : `[~]`, date et état précis (step en
cours, fichiers touchés).

## Fichiers du lot (exclusifs)

Source : spec, « Organisation du travail — 2c ». Les `__tests__` de ces dossiers sont inclus.

- `src/app/org/**`
- `src/app/event/**`
- `src/app/account/**`
- `src/components/event/**` (dont `print/**`, `ScannerFrame`, `QRScanner`) **sauf** `EventShell`,
  `EventViewerShell`, `EventOperatorShell`, `EventPrinterShell` (socle)
- `src/components/admin/**` (dont `PlanCatalog`, `PaymentHistory`) **sauf** `SidebarNav`, `OrgShell` (socle)
- `src/components/badge/**`
- **Dossiers de `src/components/**` non attribués ailleurs, pris par ce lot :**
  `src/components/account/**` et `src/components/activity/**` (les quinze dossiers présents sont
  `account`, `activity`, `admin`, `auth`, `badge`, `event`, `layout`, `marketing`, `notifications`,
  `payments`, `platform`, `print`, `public`, `staff`, `ui` : seuls `account` et `activity` ne
  sont attribués à personne d'autre). Tout dossier créé plus tard dans `src/components/**` sans
  attribution revient aussi à ce lot.
- Tests e2e existants de ce lot (mise à jour uniquement si un sélecteur casse, jamais pour la
  couleur) : `e2e/org/**`, `e2e/event/**`, `e2e/public/account*.spec.ts`.

**Lecture seule** (besoin d'y toucher → **s'arrêter et le signaler**, ne pas contourner) :
`src/app/globals.css`, `src/lib/brand-colors.ts`, `src/components/ui/**`,
`src/components/layout/**`, et tout ce qui est attribué ailleurs : socle
(`src/components/staff/StaffShell.tsx`, `src/components/platform/PlatformOrgShell.tsx`,
`src/app/styleguide/**`), lot 2a (`src/components/marketing/**`, `src/components/public/**`,
`src/components/auth/**`, `src/components/payments/**`, pages publiques, e-mails), lot 2b
(`src/components/staff/**`, `src/components/print/**`, `src/components/platform/**`,
`src/components/notifications/**`, `src/app/platform/**`). Les pages `/org/.../payments` utilisent
`src/components/payments/**` (2a) : ne pas y toucher.

## Global Constraints

Reprise de `CLAUDE.md` (« Règles de test » et règles d'écriture) — valables pour chaque task :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (`badge_<lot>_test` pour un agent),
  jamais sur la base de dev ; `make test` crée et met au schéma la base (`make test-db`).
- **Pas de mock de la base ni de Prisma** ; seuls les services externes se mockent. Ce lot
  n'ajoute pas de logique : aucun nouveau test d'intégration n'est attendu.
- **Fabriques** : si un test touché prépare des données, utiliser `src/test/factories.ts`
  (`@faker-js/faker`, graine fixée par fichier), pas de `prisma.*.create` dupliqués.
- **Ne jamais modifier le code de production pour faire passer un test** ni atteindre la
  couverture : s'arrêter et demander. Ici, on **met à jour le test** quand il affirme une classe de
  l'ancienne palette (`MiniBadge.test`, `ScannerFrame.test`, `EventCover.test`) ; on ne
  retouche jamais le composant pour garder une ancienne classe.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (gate `vitest.config.ts`) : ce lot ne
  touche aucun de ces dossiers.
- **e2e** (Playwright) contre l'app en cours d'exécution ; les specs existants doivent rester
  verts sans changement de sélecteur (rôles et textes inchangés).
- **Structure inchangée** : ne pas ajouter, retirer ni déplacer un élément, une icône, un texte ou
  un espacement ; seules les classes de couleur changent (et `text-white` → `text-navy` quand le
  fond devient turquoise ou or).
- **Contraste (spec, « Lisibilité »)** : jamais de texte blanc sur turquoise ; jamais de texte or
  (`gold`) sur blanc (texte « en attente » = `gold-strong`) ; or en trait, point ou fond seulement.
- Code et identifiants en anglais, commentaires en français ; aucune action git destructive.

## Règles de transformation (référence pour toutes les tasks)

Chaque occurrence est classée **par rôle**. Le tableau fixe la décision ; en cas d'occurrence
non prévue, appliquer le rôle le plus proche et la noter dans la progression.

| Ancien | Rôle | Nouveau |
|--------|------|---------|
| `bg-green-600 … text-white hover:bg-green-700` (bouton plein : Nouvelle commande, Nouvelle inscription, Créer un évènement, S'inscrire, raccourci du tableau de bord) | action principale | `bg-navy … text-white hover:bg-navy-hover` |
| `text-green-600/700` + `hover:underline` (liens « Voir », « Retour », « Tout voir ») | lien | `text-navy hover:underline` |
| `hover:text-green-600/700` seul (liens de ligne et de titre) | survol de lien | `hover:text-navy hover:underline` |
| `hover:border-green-500 hover:text-green-700` (bouton bordé « Paramètres du badge ») | survol secondaire | `hover:border-navy hover:text-navy` |
| `focus:ring-green-500`, `focus-visible:ring-green-500` | contour de focus | `focus:ring-navy`, `focus-visible:ring-navy` |
| `border-brand-navy`, `focus:ring-brand-navy` | marque | `border-navy`, `ring-navy` (l'ancienne variable est supprimée en vague 3) |
| `border-green-600 ring-1 ring-green-600` (carte sélectionnée) | sélection | `border-navy ring-1 ring-navy` ; `hover:border-green-500` → `hover:border-navy` |
| `text-green-600` d'une coche « sélectionné » / case à cocher (`text-green-600 … focus:ring-green-500`) | sélection | `text-navy` (+ `focus:ring-navy`) |
| `emerald-50/700`, `green-*` d'un état réussi (« Inscriptions ouvertes », « Imprimé », « Hérité », « Plan actuel », « Profil validé ») | succès | fond `bg-turquoise-soft`, texte `text-turquoise-strong` |
| `amber-*` d'un avertissement (« Profil non validé », « À renseigner », « identifiants ignorés », « Déjà imprimé », « Fermées », message hors-ligne d'impression, alerte de gabarit verrouillé, « Toujours en attente : traitement retardé ») | avertissement | `text-warn`, pastille `bg-warn-soft text-warn`, encart `border-warn/30 bg-warn-soft text-warn` |
| `amber-*` / `sky-*` d'un statut **en attente** (profil « en cours de vérification », pastille de compteur d'actions en attente) | en attente | texte `text-gold-strong`, fond `bg-gold-soft` ; pastille pleine de compteur `bg-gold text-navy` |
| `blue-600` (liens `PaymentHistory`, page Abonnement) | lien | `text-navy hover:underline` |
| `bg-slate-50` / `bg-slate-100` de zone interne (en-têtes de tableau, encarts, vignettes, état sélectionné) | fond secondaire | `bg-mist` |
| `hover:bg-slate-50`, `hover:bg-slate-100` (lignes, boutons secondaires, boutons-icônes) | survol | `hover:bg-mist` |
| `bg-slate-100 … hover:bg-slate-200` (bouton secondaire plein : Copier, Annuler la demande) | secondaire | `bg-mist text-navy hover:bg-line` |
| `file:bg-slate-100 file:text-slate-700` (champ fichier) | secondaire | `file:bg-mist file:text-navy` |
| `bg-slate-900 … hover:bg-slate-800` d'un bouton principal (`SubscriptionBlockedNotice`) | action principale | `bg-navy text-white hover:bg-navy-hover` |
| `bg-slate-50` plein écran de page (`account/layout`) | fond de page | `bg-white` (le trait `border-slate-200` de l'en-tête reste) |

**Ce qui ne change jamais** : `slate-*` de texte et de bordures (dont `text-slate-400/500/600/700`,
`border-slate-200/300`), le rouge et le `rose-*` des erreurs et des refus, `bg-black/40` des
fonds de modale, `bg-slate-900` du cadre caméra, les couleurs de données (voir ci-dessous).

**Couleurs de données (décision) :**

- Couleurs de catégorie, d'équipe et de modèle saisies par l'utilisateur
  (`CategoryForm`, `CategoryTemplateForm`, `TeamForm`, `EventCreationWizard` : valeurs initiales
  `#0066cc`, `#1a3a7c`, `<input type="color">`) : **données, intactes**. Ce sont des valeurs
  par défaut de couleur choisie, pas des couleurs d'interface ; elles ne sont pas migrées (et le
  garde-fou de la vague 3 les exclut). Idem `categoryColor` de `MiniBadge` et des pastilles de
  catégorie, issues de la base.
- Aperçus de badges (`BadgeTemplateTiles`, `BadgeTemplatePicker`, `MiniBadge`,
  `BadgeDocumentView`) : le **contenu** (document du moteur, vignette) n'est pas touché ; seul
  l'**habillage d'interface** (bordure de sélection, coche, spinner, fond de vignette) migre.
  `BadgeDocumentView` garde son fond neutre `bg-[#8b8b90]` (support gris derrière un document
  imprimable : une couleur de marque fausserait la lecture du rendu) : exception justifiée, à
  signaler à la vague 3 pour la liste du garde-fou si celui-ci le refuse.
- **Scanner** : le cadre caméra reste sombre (`bg-slate-900` : fond de flux vidéo). Le réticule et
  le laser passent du vert au **turquoise** (couleur d'action « positive », bien visible sur
  fond sombre, `bg-turquoise` / `border-turquoise` ; le laser garde son halo avec
  `shadow-turquoise`). Résultat d'un scan : **valide = turquoise** (fond `bg-turquoise-soft`,
  bordure `border-turquoise/30`, pastille ronde `bg-turquoise` avec icône **marine**, titre
  `text-turquoise-strong`) ; **refusé = rouge inchangé** (`rose-*`, icône blanche sur `rose-600`).
  Le sens ne repose jamais sur la seule couleur : l'icône (`check` / `x`) et le titre restent.
  Historique de scans : point `bg-turquoise` (autorisé) / `bg-rose-500` (refusé).

## Review Focus

Risques propres à un lot « classes en dur », du plus probable au moins probable :

1. **Occurrence oubliée ou mal classée** : un `green-*` / `emerald-*` / `amber-*` / `blue-*` /
   `sky-*` / `indigo-*` / `teal-*` / `brand-navy` / `var(--accent` restant dans le périmètre
   (Task 10 : balayage `grep` systématique), ou un avertissement passé en or (confusion
   « en attente » / « avertissement », spec 4 bis).
2. **Contraste** : texte blanc sur turquoise (pastille valide du scanner, `MiniBadge` « terminé »),
   or utilisé comme couleur de texte sur blanc, compteur de menu : `bg-gold text-navy`.
3. **Menu latéral clair** : les cinq shells injectent encore `text-white` / `text-slate-300` /
   `text-white/45` pensés pour le fond sombre ; texte invisible sur fond blanc si l'un est oublié
   (Task 1), y compris le bouton de déconnexion et le pied (`email`).
4. **Structure intacte** : le diff ne contient que des changements de classes de couleur
   (revue du diff ligne à ligne ; aucun changement de `className` structurel).
5. **Tests de classes** : un test mis à jour doit refléter le **rôle** (`bg-turquoise`), pas
   copier la valeur ; aucun test supprimé ni affaibli.
6. **Bascule `bg-slate-50` → `mist` trop large** : les gris de **texte** et de **bordure** ne
   changent pas ; seules les zones de fond internes passent en `mist`.

## Task 1 : Shells et menu latéral clair — ABANDONNÉE, déplacée au socle (tâche 4b)

> Ne pas exécuter : ces six fichiers appartiennent au socle. Le texte ci-dessous est conservé
> comme référence de ce que le socle doit couvrir.

**Fichiers :** `src/components/admin/SidebarNav.tsx`, `src/components/admin/OrgShell.tsx`,
`src/components/event/EventShell.tsx`, `EventViewerShell.tsx`, `EventOperatorShell.tsx`,
`EventPrinterShell.tsx` ; tests : `src/components/admin/__tests__/SidebarNav.test.tsx`,
`OrgShell.test.tsx`.

- [ ] **Step 1 — `SidebarNav`** (lien actif, groupes, compteur) :
  - libellé de groupe : `text-white/45` → `text-nav-muted`.
  - lien actif : `border-green-400 bg-green-500/15 font-medium text-green-400` →
    `border-gold bg-mist font-medium text-navy` (trait or à gauche, fond `mist`).
  - lien inactif : `border-transparent text-slate-300 hover:bg-white/10 hover:text-white` →
    `border-transparent text-nav-muted hover:bg-mist hover:text-navy`.
  - compteur d'actions en attente : `bg-green-500 … text-white` → `bg-gold … text-navy`
    (« en attente » = or ; marine sur or = 9,4).
- [ ] **Step 2 — `OrgShell`** : nom « Badge » `text-white` → `text-navy` ; nom d'organisation
  `text-white/80` → `text-nav-muted` ; bouton de déconnexion (`LogoutButton className`) :
  `text-slate-300 … hover:bg-white/10 hover:text-white` → `text-nav-muted … hover:bg-mist
  hover:text-navy` ; email du pied `text-slate-400` → `text-nav-muted`.
- [ ] **Step 3 — `EventShell`** : « Badge » `text-white` → `text-navy` ; lien « retour »
  `text-slate-400 hover:text-slate-200` → `text-nav-muted hover:text-navy` ; titre d'évènement
  `text-white` → `text-navy` ; email du pied `text-nav-muted` ; bandeau mode staff
  (`bg-amber-50 border-amber-200 text-amber-700`) → bande marine `bg-navy text-white` (sans
  bordure) conformément à la spec (« le bandeau staff reste une bande marine, texte blanc ») ;
  pastille de rôle du header `bg-green-500/15 text-green-700` → `bg-mist text-navy`.
- [ ] **Step 3 bis — shells Viewer, Operator, Printer** : nom de l'organisation
  `text-slate-400` → `text-nav-muted` ; titre d'évènement `text-white` → `text-navy` ; liens
  « Notifications » / « Profil » / « Scanner » / « Badges » : `text-slate-300 hover:bg-white/10
  hover:text-white` → `text-nav-muted hover:bg-mist hover:text-navy` ; nom utilisateur du pied
  `text-slate-400` → `text-nav-muted`.
- [ ] **Step 4 — tests** : `SidebarNav.test` n'affirme pas de classes (rien à changer) ; ajouter
  une assertion que le lien actif porte `border-gold` et le compteur `bg-gold` (nouveau test, rôle
  visible) ; `OrgShell.test` vérifie les liens, inchangé. Lancer
  `make test FILE=src/components/admin/__tests__` puis `FILE=src/components/event/__tests__`.
- [ ] **Step 5 — Vérifier** `grep -nE "text-white|white/|slate-300|green-|amber-" ` sur ces six
  fichiers : plus aucune occurrence de menu sombre (les `text-white` de boutons pleins marine
  restent légitimes).

## Task 2 : Pages `src/app/org/**`

**Fichiers :** `src/app/org/[orgId]/page.tsx`, `events/page.tsx`, `settings/SettingsClient.tsx`,
`subscription/page.tsx`, `payments/[paymentId]/page.tsx`, `templates/TemplatesClient.tsx`,
`members/MembersClient.tsx`, `activity/page.tsx`.

- [ ] **Step 1 — `page.tsx` (tableau de bord)** : liens « Tout voir » `text-green-600
  hover:underline` → `text-navy hover:underline` (l. 79) ; lignes `hover:text-green-600` →
  `hover:text-navy` (l. 94).
- [ ] **Step 2 — `events/page.tsx`** : en-tête de tableau `bg-slate-50` → `bg-mist` ; ligne
  `hover:bg-slate-50` → `hover:bg-mist` ; titre `hover:text-green-600` → `hover:text-navy
  hover:underline` ; pastille « Archivé » `bg-slate-100` → `bg-mist text-slate-600` ;
  « Inscriptions ouvertes » `bg-emerald-50 text-emerald-700` → `bg-turquoise-soft
  text-turquoise-strong` ; « Fermées » `bg-amber-50 text-amber-700` → `bg-warn-soft text-warn`
  (état à surveiller, pas « en attente ») ; lien « Gérer » `text-green-600` → `text-navy`.
- [ ] **Step 3 — `subscription/page.tsx`** : lien « Paiements » `text-blue-600` → `text-navy`
  (+ `hover:underline` déjà présent).
- [ ] **Step 4 — `settings/SettingsClient.tsx`** (l. 96) : `hover:border-green-500
  hover:text-green-700` → `hover:border-navy hover:text-navy`.
- [ ] **Step 5 — `payments/[paymentId]/page.tsx`** : `hover:bg-slate-50` → `hover:bg-mist`
  (le reste vient de `components/payments`, lot 2a : n'y toucher pas).
- [ ] **Step 6 — `templates/TemplatesClient.tsx`, `members/MembersClient.tsx`,
  `activity/page.tsx`** : en-têtes `bg-slate-50` → `bg-mist` ; lignes `hover:bg-slate-50` →
  `hover:bg-mist` ; boutons-icônes `hover:bg-slate-100` → `hover:bg-mist` (le `border-t
  border-slate-100` de séparation de ligne reste : c'est une bordure).
- [ ] **Step 7 — Vérifier** : `make test FILE=src/app/org` ; grep de l'étape finale (Task 10).

## Task 3 : Pages `src/app/event/**`

**Fichiers :** `src/app/event/[eventId]/page.tsx`, `print/page.tsx`, `settings/page.tsx`,
`badges/[badgeId]/page.tsx`, `activity/page.tsx`.

- [ ] **Step 1 — `page.tsx` (tableau de bord)** : raccourci `bg-green-600 … text-white
  hover:bg-green-700` (l. 65) → `bg-navy … text-white hover:bg-navy-hover` ; liens « Tout voir »
  (l. 176) → `text-navy hover:underline` ; lignes `hover:text-green-600` (l. 192) →
  `hover:text-navy`.
- [ ] **Step 2 — `print/page.tsx`** : bouton « Nouvelle commande » `bg-green-600` (l. 66) →
  `bg-navy text-white hover:bg-navy-hover` ; lien de commande `text-green-700` →
  `text-navy` ; pastille de compteur (l. 92, `bg-green-600 text-white`, = actions en attente
  côté organisateur) → `bg-gold text-navy`.
- [ ] **Step 3 — `settings/page.tsx`** (l. 65) : `hover:border-green-500 hover:text-green-700` →
  `hover:border-navy hover:text-navy`.
- [ ] **Step 4 — `badges/[badgeId]/page.tsx`** (l. 86) : lien `text-green-600` → `text-navy`.
- [ ] **Step 5 — `activity/page.tsx`** : en-tête `bg-slate-50` → `bg-mist` ; `hover:bg-slate-50` /
  `hover:bg-slate-100` → `hover:bg-mist`.
- [ ] **Step 6 — Vérifier** : `make test FILE=src/app/event`.

## Task 4 : Compte participant

**Fichiers :** `src/app/account/layout.tsx`, `page.tsx`, `profile/page.tsx`,
`profile/ProfileForm.tsx`, `registrations/[id]/page.tsx` ; `src/components/account/IdPhotoRules.tsx` ;
`src/components/activity/**` (revue : aucune occurrence actuelle, vérifier et ne rien changer
si c'est le cas).

- [ ] **Step 1 — `layout.tsx`** : `min-h-screen bg-slate-50` → `bg-white` ; lien « Se déconnecter »
  `text-slate-500 hover:text-green-600` → `text-slate-500 hover:text-navy` ; l'en-tête garde
  `bg-white border-slate-200`.
- [ ] **Step 2 — `page.tsx`** : bouton `bg-green-600 … hover:bg-green-700` (l. 75) →
  `bg-navy text-white hover:bg-navy-hover` ; vignette de date `bg-slate-50` → `bg-mist`.
- [ ] **Step 3 — `profile/page.tsx`** (état du profil, texte seul, textes inchangés) :
  `INCOMPLETE` `text-amber-700` → `text-warn` (action requise = avertissement) ; `PENDING`
  `text-sky-700` → `text-gold-strong` (vérification en cours = en attente) ; `APPROVED`
  `text-emerald-700` → `text-turquoise-strong` ; `REJECTED` rose inchangé.
- [ ] **Step 4 — `profile/ProfileForm.tsx`** : `focus:ring-green-500` → `focus:ring-navy` ;
  champs fichier `file:bg-slate-100 file:text-slate-700` → `file:bg-mist file:text-navy`.
- [ ] **Step 5 — `registrations/[id]/page.tsx`** : lien « Retour » (l. 94) `text-green-600` →
  `text-navy` ; liens vers le profil (l. 113, 157) `text-green-700 underline` /
  `text-green-600` → `text-navy`.
- [ ] **Step 6 — `IdPhotoRules.tsx`** : encart `bg-slate-50` → `bg-mist`.
- [ ] **Step 7 — Vérifier** : `make test FILE=src/app/account` et
  `FILE=src/components/account`.

## Task 5 : `components/event` — formulaires, tableaux, actions

**Fichiers :** `RegistrationForm`, `RegistrationActions`, `RegistrationTable`, `RegistrationHistory`
(revue), `MemberTable`, `CategoryTable`, `BadgeListTable`, `BadgeOptionsFields`, `BadgeBatchPanel`,
`BlockedDocumentsForm`, `BlockedEmailsForm`, `EventSettingsForm`, `PublicLinkCard`, `EventCover`
(tous sous `src/components/event/`) ; tests : `__tests__/EventCover.test.tsx`,
`BadgeBatchPanel.test.tsx`, `BadgeOptionsFields.test.tsx`.

- [ ] **Step 1 — Focus et cases** : dans `RegistrationForm`, `RegistrationActions` (deux
  champs), `BadgeOptionsFields` (champ + case `text-green-600 focus:ring-green-500`),
  `EventSettingsForm` (deux champs) : `focus:ring-green-500` → `focus:ring-navy` ; case à cocher
  `text-green-600` → `text-navy`.
- [ ] **Step 2 — Tableaux** (`RegistrationTable`, `MemberTable`, `CategoryTable`, `BadgeListTable`,
  `BlockedDocumentsForm`, `BlockedEmailsForm`) : `bg-slate-50` d'en-tête → `bg-mist` ;
  `hover:bg-slate-50` / `hover:bg-slate-100` (lignes, boutons-icônes, boutons secondaires) →
  `hover:bg-mist`.
- [ ] **Step 3 — Liens et boutons** : `RegistrationTable` bouton « Nouvelle inscription »
  `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover` (texte blanc conservé), lien
  de nom `hover:text-green-600` → `hover:text-navy hover:underline`, lien d'action
  `text-green-600` → `text-navy` ; `BadgeListTable` lien « Voir » `text-green-600` → `text-navy`.
- [ ] **Step 4 — Avertissements** : `RegistrationActions` « Profil non validé par la plateforme »
  `text-amber-700` → `text-warn` ; `BadgeOptionsFields` « À renseigner » → `text-warn` ;
  `BadgeBatchPanel` « identifiants ignorés » et « Toujours en attente : le traitement peut être
  retardé » (`text-amber-700`) → `text-warn` (ce second message est un retard, donc un
  avertissement ; « en attente » or est réservé aux statuts) ; `BadgeBatchPanel` « Imprimé »
  `text-emerald-700` → `text-turquoise-strong` ; ligne courante `bg-slate-100` → `bg-mist`,
  `hover:bg-slate-50` → `hover:bg-mist`.
- [ ] **Step 5 — Fonds** : `PublicLinkCard` champ `bg-slate-50` → `bg-mist`, bouton Copier
  `bg-slate-100 … hover:bg-slate-200` → `bg-mist text-navy hover:bg-line` ; `EventCover`
  (`hero`, `thumb`) `bg-slate-100` → `bg-mist` ; `RegistrationTable` `Tag` (composant `ui`,
  lecture seule) inchangé.
- [ ] **Step 6 — Tests** : `EventCover.test` (l. 34 et 47) : `bg-slate-100` → `bg-mist` ;
  `BadgeBatchPanel.test` : `categoryColor: "#4f46e5"` est une **donnée de test** (couleur de
  catégorie), à laisser ; `BadgeOptionsFields.test` : vérifier qu'il n'affirme aucune classe.
- [ ] **Step 7 — Vérifier** : `make test FILE=src/components/event`.

## Task 6 : `components/event/print/**` — assistant et conversation

**Fichiers :** `print/BadgeSelectionStep.tsx`, `print/NewPrintRequestForm.tsx`,
`print/PrintRequestWizard.tsx`, `print/PrintRequestActions.tsx`,
`print/order/OrganizerConversation.tsx`, `print/order/OrganizerComposer.tsx`
(sous `src/components/event/`).

- [ ] **Step 1 — Focus** : `PrintRequestWizard` (constante de champ l. 69) et `OrganizerComposer`
  (l. 78) : `focus:ring-green-500` → `focus:ring-navy`.
- [ ] **Step 2 — Avertissements** : `BadgeSelectionStep` pastille « Déjà imprimé » `bg-amber-50
  text-amber-700` → `bg-warn-soft text-warn` ; `NewPrintRequestForm` message hors-ligne
  `text-amber-700` → `text-warn` (le lien `font-medium underline` hérite).
- [ ] **Step 3 — Liens** : `PrintRequestWizard` (l. 502) et `OrganizerConversation` (pièce jointe,
  l. 27) `text-green-700` → `text-navy`.
- [ ] **Step 4 — Bouton « Nouveaux messages »** (`OrganizerConversation` l. 215) :
  `bg-green-600 … hover:bg-green-700` → `bg-navy text-white hover:bg-navy-hover` ; évènement de
  fil `bg-slate-50` (l. 60) → `bg-mist`.
- [ ] **Step 5 — `PrintRequestActions`** (bouton secondaire plein, l. 71) :
  `bg-slate-100 … hover:bg-slate-200` → `bg-mist text-navy hover:bg-line`.
- [ ] **Step 6 — Vérifier** : `make test FILE=src/components/event/print`.

## Task 7 : Scanner (`ScannerFrame`, `QRScanner`)

**Fichiers :** `src/components/event/ScannerFrame.tsx`, `QRScanner.tsx` ; test :
`src/components/event/__tests__/ScannerFrame.test.tsx`. Décision de couleur : voir « Couleurs de
données — Scanner » ci-dessus.

- [ ] **Step 1 — `ScannerFrame`** : les quatre coins `border-green-400` → `border-turquoise` ;
  laser `bg-green-400 shadow-green-400` → `bg-turquoise shadow-turquoise` ; commentaire de tête
  « reticule vert » → « reticule turquoise ». Le cadre `bg-slate-900` est conservé.
- [ ] **Step 2 — `ScanResult`** : valide → `border-turquoise/30 bg-turquoise-soft`, pastille
  `bg-turquoise text-navy`, titre `text-turquoise-strong` ; refusé inchangé (`border-rose-200
  bg-rose-50`, pastille `bg-rose-600 text-white`, titre `text-rose-700`). Le `text-white` fixe de
  la pastille devient conditionnel (`valid ? "bg-turquoise text-navy" : "bg-rose-600
  text-white"`).
- [ ] **Step 3 — `QRScanner`** : point d'historique `bg-green-500` → `bg-turquoise` ; reste (cadre
  caméra `bg-slate-900`, bordures) inchangé.
- [ ] **Step 4 — Tests** : `ScannerFrame.test` : `border-green-400` → `border-turquoise` ;
  `text-emerald-700` → `text-turquoise-strong` ; ajouter l'assertion que le résultat refusé garde
  `text-rose-700` (non-régression du refus).
- [ ] **Step 5 — Vérifier** : `make test FILE=src/components/event/__tests__/ScannerFrame.test.tsx`.

## Task 8 : `components/admin` — hors shells

**Fichiers :** `OrgMemberForm`, `BadgeTemplateTiles`, `BadgeTemplatePicker`, `TeamForm`,
`EventCreationWizard`, `CreateEventButton`, `SubscriptionBlockedNotice`, `OrgSelector`,
`PlanCatalog`, `PaymentHistory` (sous `src/components/admin/`) ; tests existants du dossier.
`CategoryTemplateForm` : couleur choisie par l'utilisateur, rien à migrer.

- [ ] **Step 1 — `OrgMemberForm`** : `focus:border-brand-navy focus:ring-brand-navy` →
  `focus:border-navy focus:ring-navy`.
- [ ] **Step 2 — Sélection de gabarit** (`BadgeTemplateTiles`, `BadgeTemplatePicker`) :
  `hover:border-green-500 focus-visible:ring-green-500` → `hover:border-navy
  focus-visible:ring-navy` ; carte sélectionnée `border-green-600 ring-1 ring-green-600` →
  `border-navy ring-1 ring-navy` ; coche `text-green-600` → `text-navy` ; vignette
  `bg-slate-50` → `bg-mist` ; `Picker` : bouton « Revenir à l'héritage » `className="text-green-600"`
  → `text-navy` ; « Hérité à ce niveau » `text-emerald-700` → `text-turquoise-strong` ; alerte de
  gabarit verrouillé `border-amber-300 bg-amber-50 text-amber-900` → `border-warn/30
  bg-warn-soft text-warn`.
- [ ] **Step 3 — `TeamForm`, `EventCreationWizard`** : `focus:ring-green-500` → `focus:ring-navy` ;
  cases `text-green-600` → `text-navy`. Les valeurs de couleur initiales (`#1a3a7c`,
  `#0066cc`) restent (données).
- [ ] **Step 4 — `CreateEventButton`** : bouton `bg-green-600 hover:bg-green-700` →
  `bg-navy text-white hover:bg-navy-hover` ; lien `text-green-600` → `text-navy`.
- [ ] **Step 5 — `SubscriptionBlockedNotice`** : bouton principal `bg-slate-900 hover:bg-slate-800`
  → `bg-navy hover:bg-navy-hover` ; bouton secondaire `hover:bg-slate-50` → `hover:bg-mist`.
- [ ] **Step 6 — `OrgSelector`** : `hover:bg-slate-50` → `hover:bg-mist` (trois occurrences).
- [ ] **Step 7 — `PlanCatalog`, `PaymentHistory`** : « Plan actuel » `text-green-600` →
  `text-turquoise-strong` ; lien de détail `text-blue-600` → `text-navy` (props et structure
  intactes, ce sont des composants consommés par les pages d'abonnement).
- [ ] **Step 8 — Vérifier** : `make test FILE=src/components/admin`.

## Task 9 : `components/badge`

**Fichiers :** `MiniBadge.tsx`, `BadgePrintActions.tsx`, `BadgeDocumentView.tsx` ; test
`__tests__/MiniBadge.test.tsx`.

- [ ] **Step 1 — `MiniBadge`** : pastille « terminé » `bg-green-600 text-white` → `bg-turquoise
  text-navy` (le blanc sur turquoise est interdit ; l'icône `check` hérite) ; spinner
  `border-t-green-600` → `border-t-navy` ; `categoryColor` (donnée) intact.
- [ ] **Step 2 — `BadgePrintActions`** : `hover:bg-slate-50` → `hover:bg-mist`.
- [ ] **Step 3 — `BadgeDocumentView`** : `hover:bg-slate-50` → `hover:bg-mist` ; fond
  `bg-[#8b8b90]` **conservé** (support neutre du rendu, voir décision « Couleurs de données »).
- [ ] **Step 4 — Test** : `MiniBadge.test` l. 11 `bg-green-600` → `bg-turquoise` ; la couleur
  `#2563eb` de la catégorie reste (donnée).
- [ ] **Step 5 — Vérifier** : `make test FILE=src/components/badge`.

## Task 10 : Balayage final et tests de classes

- [ ] **Step 1 — Balayage** (dans le worktree) sur le périmètre du lot :

```bash
grep -rnE "green-|emerald-|amber-|blue-|sky-|indigo-|teal-|brand-navy|var\(--accent|var\(--brand|#004d74|#16a34a|#4f46e5|bg-slate-50|bg-slate-100|hover:bg-slate-(50|100)|white/|text-slate-300" \
  src/app/org src/app/event src/app/account \
  src/components/event src/components/admin src/components/badge \
  src/components/account src/components/activity \
  --include='*.ts' --include='*.tsx'
```

  Attendu : **aucune** occurrence hors des exceptions listées ci-dessous.
  Exceptions tolérées et documentées : `#4f46e5` de `BadgeBatchPanel.test` (donnée de test),
  `#0066cc` / `#1a3a7c` (couleurs de catégorie, données), `border-t border-slate-100` de
  séparation de ligne (bordure, non listée par le motif `bg-`), `bg-[#8b8b90]`
  (`BadgeDocumentView`). Toute autre occurrence est corrigée selon le tableau de transformation.
- [ ] **Step 2 — Contrôle des rôles** : relire `git diff --stat` puis le diff : seules des classes
  de couleur changent (Review Focus 4) ; aucun `amber` converti en or ; aucun `text-white` restant
  sur fond turquoise ou or.
- [ ] **Step 3 — Tests de classes** : `grep -rnE "toContain\(\"(bg|text|border)-" src/components/event
  src/components/admin src/components/badge src/app/org src/app/event src/app/account` : tout test
  affirmant une classe de l'ancienne palette est à jour (Tasks 5, 7, 9) ; aucun autre ne doit
  rester.
- [ ] **Step 4 — Vérifier** : `make lint && make typecheck && make test`.

## Task 11 : e2e, contrôle visuel, vérification

- [ ] **Step 1 — Stack** : `scripts/agent-stack.sh up 2c feat/nouvelle-palette` ; `make db-seed`
  dans le worktree si la base d'agent est vide (le SMTP du seed pointe vers Mailpit : voir la
  mémoire « e2e rouge = vérifier le SMTP d'abord »).
- [ ] **Step 2 — e2e du lot** (dans le worktree, jamais en parallèle sur la même stack) :
  `make test-e2e FILE=e2e/org` ; `make test-e2e FILE=e2e/event` ; compte :
  `make test-e2e FILE=e2e/public/account.spec.ts`, `account-profile.spec.ts`,
  `account-registration.spec.ts`, `account-pagination.spec.ts`, `account-notifications.spec.ts` ;
  transverse touchant le lot : `e2e/transverse/responsive.spec.ts`. Tous doivent passer sans
  changement de sélecteur. Un sélecteur cassé = un changement de structure involontaire : le
  corriger dans le composant, pas dans le spec.
- [ ] **Step 3 — Contrôle visuel** à **375**, **1024** et **1280 px** (le menu latéral occupe
  ~224 px dès `lg` : à 1024 px, vérifier qu'aucun texte clair ne reste sur fond blanc) — outil
  `mcp__Claude_Browser__resize_window` (`mobile`, `1024×768`, `1280×800`) + captures :
  1. **Tableau de bord org** (`/org/<id>`) : menu clair, trait or du lien actif, liens
     « Tout voir » marine, fond blanc, menu mobile (375 px) aux mêmes couleurs.
  2. **Inscriptions d'un évènement** (`/event/<id>/registrations`) : en-tête de tableau `mist`,
     bouton « Nouvelle inscription » marine, pastilles de statut (approuvé turquoise, en attente
     or, rejeté rouge), bandeau « Mode staff » marine en connexion staff.
  3. **Scanner** (`/event/<id>/scan`) : cadre sombre, réticule et laser turquoise ; résultat
     valide (turquoise, icône marine lisible) et refusé (rouge) en saisie manuelle.
  4. **Compte** (`/account`, `/account/profile`) : fond blanc, bouton marine, état du profil
     (avertissement orange, en attente or, validé turquoise).
  Vérifier aussi `/event/<id>/print`, `/org/<id>/events` (pastilles) et la sélection de gabarit.
  Aucun texte illisible, aucun vert résiduel.
- [ ] **Step 4 — Vérification complète** : `make lint && make typecheck && make test-coverage`
  (gate 100 % de `src/lib/**` et `src/app/api/**` inchangé : ce lot n'y touche pas), puis relancer
  les e2e du Step 2 une dernière fois.
- [ ] **Step 5 — Clôture** : mettre la table `## Progression` à jour (`[x]` + date) ; consigner
  dans les notes les écarts avec le socle (nom de couleur ou composant manquant) et la liste
  d'exceptions à transmettre à la vague 3 (garde-fou) : `BadgeDocumentView` (`#8b8b90`), couleurs
  de catégorie/équipe saisies (`#0066cc`, `#1a3a7c`), `bg-slate-900` du cadre caméra.

## Auto-revue (couverture de la spec)

- Décision 1 (marine remplace bleu et vert d'accent : boutons, liens, focus) : Tasks 2 à 8.
- Décision 2 (turquoise pour succès et positif) : Tasks 2, 4, 5, 7, 8, 9.
- Décision 3 (or réservé au lien actif et à « en attente », jamais une action) : Tasks 1, 3, 4.
- Décisions 4 / 4 bis (rouge inchangé ; en attente or, avertissement orange) : Tasks 2, 4, 5, 6, 8.
- Décisions 6 / 7 / 8 (fond blanc, menu clair, boutons, pastilles) : Tasks 1, 4, 5.
- Décision 9 (structure inchangée) : Global Constraints, Review Focus 4, Task 10 Step 2.
- Arbitrages « autres bleus » et « fonds » : tableau de transformation.
- Exceptions (couleurs de données, aperçus de badges, scanner) : section dédiée.
