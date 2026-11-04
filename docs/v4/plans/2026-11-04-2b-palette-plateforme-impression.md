# Vague 2 · Lot 2b — Espace plateforme et impression — Plan d'implémentation

> **Pour les agents :** sous-skill requis : `superpowers:subagent-driven-development` (recommandé)
> ou `superpowers:executing-plans`. Les étapes utilisent des cases `- [ ]`.
>
> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2b feat/nouvelle-palette` (le script crée la branche
> `feat/nouvelle-palette-2b`, depuis `feat/nouvelle-palette`, **après** la vague 1). Toutes les
> commandes `make` se lancent **dans le worktree**. En exécution automatisée (tâche planifiée),
> **un commit par tâche est autorisé** sur la branche du plan, messages en français ASCII, style
> conventional commits, sans co-auteur IA ; sinon aucun commit sans demande explicite de
> l'utilisateur. Modèle des sous-agents : `sonnet`. Test ciblé : `make test FILE=<chemin>` ; e2e
> ciblé : `make test-e2e FILE=<chemin>`.

**Objectif :** migrer les couleurs de l'espace plateforme, des écrans staff, de l'impression et des
notifications vers la palette « Deep Navy & Soft Gold », sans changer aucune structure.

**Architecture :** remplacement des classes Tailwind en dur **par rôle** (bouton principal → marine,
décision positive/succès → turquoise, en attente → or, avertissement → `warn`, info/bleus → `mist`,
fonds gris internes → `mist`), en consommant les couleurs du socle. Aucun nouveau composant, aucune
logique modifiée.

**Tech Stack :** Next.js 16, Tailwind 4, Vitest 4, Playwright.

**Spec :** [`specs/2026-11-04-39-v4-nouvelle-palette.md`](../specs/2026-11-04-39-v4-nouvelle-palette.md)
— « Décisions », « Lisibilité », « Arbitrages », « Organisation du travail » (lot 2b).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|------|----------|--------|------|-------|
| 1 | Vérifier le socle et fixer la table de correspondance | [x] | 2026-11-04 | 68 fichiers a migrer (mesure initiale), socle present |
| 2 | Statuts et tons d'impression (`PrintRequestStatusBadge`, `entry-tone`, `JobStatusBadge`) | [x] | 2026-11-04 | ton interne (amber) classe or ; statuts reclasses par sens |
| 3 | Composants `src/components/print/**` (hors statuts) | [x] | 2026-11-04 | compteur: barre ok turquoise, warn bg-warn |
| 4 | `src/components/notifications/**` | [x] | 2026-11-04 | cloche sur fond blanc : ring navy |
| 5 | Pages `src/app/platform/**` | [x] | 2026-11-04 | progression dashboard en marine ; pastilles neutres slate-100 conservees |
| 6 | Composants staff hors `print/` | [x] | 2026-11-04 | classes mist/navy uniquement |
| 7 | Staff `print/` — listes, éditeurs, catalogue | [ ] | | |
| 8 | Staff `print/` — gabarits, planches, commande, sur place | [ ] | | |
| 9 | Passe de contrôle (grep) et tests existants | [ ] | | |
| 10 | e2e, contrôle visuel, vérification | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Après chaque task
validée : statut `[x]` + date ; en cas d'interruption : `[~]`, date et état précis (step en
cours, fichiers touchés).

## Fichiers du lot (exclusifs)

Source : spec, « Organisation du travail — 2b ». Rien d'autre ne se modifie.

- `src/app/platform/**` (pages, `_components`, actions client) et leurs `__tests__`.
- `src/components/staff/**` **sauf** `StaffShell.tsx` (socle) et **sauf**
  `src/components/staff/print/SheetPreview.tsx` (exception : couleurs de planches, ne pas toucher).
- `src/components/print/**`.
- `src/components/platform/**` **sauf** `PlatformOrgShell.tsx` (socle) ; seul
  `PlatformOrgMemberInviteForm.tsx` est concerné.
- `src/components/notifications/**`.
- Tests : les `__tests__` de ces dossiers ; e2e : `e2e/platform/**` et `e2e/transverse/notifications.spec.ts`
  (seulement si un sélecteur par classe casse — aucune structure ne change).

**Lecture seule** : `src/app/globals.css`, `src/lib/brand-colors.ts`, `src/components/ui/**`,
`src/components/layout/**`, `src/components/staff/StaffShell.tsx`,
`src/components/platform/PlatformOrgShell.tsx`, `src/components/staff/print/SheetPreview.tsx`,
tout fichier des lots 2a et 2c. **Besoin d'y toucher (couleur manquante, composant `ui` à
adapter) → s'arrêter et le signaler.**

## Contrat du socle consommé

Couleurs Tailwind : `navy`, `navy-hover`, `gold`, `gold-strong`, `gold-soft`, `turquoise`,
`turquoise-strong`, `turquoise-soft`, `mist`, `line`, `nav-muted`, `warn`, `warn-soft`
(valeurs : spec, « Arbitrages »). Les anciennes variables restent définies jusqu'à la vague 3 : ne
plus les utiliser. Le fond de page blanc est géré par le socle.

Correspondance par rôle (à appliquer avec jugement, jamais par simple recherche/remplacement) :

| Rôle | Avant | Après |
|------|-------|-------|
| Bouton principal plein | `bg-green-600 hover:bg-green-700 text-white` | `bg-navy hover:bg-navy-hover text-white` |
| Décision positive (Approuver, Valider, Accepter le devis, Marquer payé) | bouton vert | `bg-turquoise hover:bg-turquoise-strong text-navy` (texte marine, jamais blanc) |
| Lien, texte d'accent, survol de lien | `text-green-600/700/800`, `hover:text-green-*` | `text-navy hover:text-navy-hover` (ou `hover:underline`) |
| Succès / réussi (texte) | `text-green-*`, `text-emerald-*` | `text-turquoise-strong` |
| Pastille réussie | `bg-green-50/100`, `bg-emerald-50/100` + texte vert | `bg-turquoise-soft text-turquoise-strong` |
| En attente | `bg-amber-50 text-amber-700/800` (statut) | `bg-gold-soft text-gold-strong` |
| Avertissement / alerte | `amber-*` (message, encart, icône) | `bg-warn-soft text-warn` (bordure `border-warn/30`) |
| Info, bleus, indigo, sky, teal-info | `bg-blue/sky/indigo-50`, `text-*-600/700/900`, `border/ring-*-100/200` | `bg-mist text-navy` (bordure `border-line`) |
| Teal | `teal-*` | turquoise (même règle que succès) |
| Focus | `focus:ring-green-500`, `focus-visible:ring-green-500` | `focus:ring-navy` ; sur fond marine/sombre `focus:ring-gold` |
| Contrôles natifs | `accent-green-600` | `accent-navy` |
| Sélection / bordure active | `border-green-600`, `ring-green-600`, `border-green-500` | `border-navy`, `ring-navy` |
| Fond interne | `bg-slate-50`, `bg-slate-100`, `hover:bg-slate-50/100` | `bg-mist`, `hover:bg-mist` |
| Point/indicateur « en direct » | `bg-green-400` | `bg-turquoise` |

Exceptions : `bg-slate-100` utilisé comme **pastille neutre de statut** (brouillon, annulé,
archivé…) ou comme placeholder d'image reste `bg-mist` si c'est un fond de zone, mais une pastille
de statut neutre garde `bg-slate-100 text-slate-600` (lisibilité : `mist` est trop proche du
blanc). Le rouge, `slate` (texte/bordures) et les couleurs de données ne changent pas.

## Global Constraints

Règles de test (`CLAUDE.md`, « Règles de test »), valables pour ce lot :

- **Base de test dédiée** : Vitest tourne sur `badge_<lot>_test` (`make test` crée et met la base
  au schéma) ; jamais sur la base de dev.
- **Pas de mock de la base ni de Prisma** ; seuls les services externes se mockent.
- **Fabriques** : toute donnée de test passe par `src/test/factories.ts`.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander. Ici, seuls les **tests qui vérifient des classes en dur**
  (`entry-tone.test.ts`, `NotificationsView.test.tsx`…) sont mis à jour, jamais l'inverse.
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**` (gate dans `vitest.config.ts`) ;
  ce lot ne touche aucun de ces dossiers, la gate doit rester verte.
- **e2e** (Playwright) : contre l'app du worktree, fixtures préfixées et nettoyées.
- Structure inchangée : ni élément, ni texte, ni espacement, ni icône modifiés ; couleurs seulement.
- Lisibilité (spec) : blanc sur turquoise **interdit** pour du texte ; or **interdit** en texte sur
  blanc (trait, point, fond seulement) ; conventions de langue : texte UI en français accentué.
- Commits : français ASCII, conventional commits, sans co-auteur IA.

## Review Focus

1. **Texte blanc sur turquoise** : chaque bouton ou pastille à fond `turquoise` doit porter
   `text-navy` ; chercher `bg-turquoise` accompagné de `text-white` (échec de contraste 2,5).
2. **`gold` ou `gold-soft` utilisé en texte sur blanc** : seul `gold-strong` est permis en texte.
3. **Amber mal classé** : un statut « en attente » doit être or, un message d'alerte `warn` ; une
   file d'attente `OrderQueueTable` / `GenerationList` / `CatalogList` mélange les deux rôles.
4. **Variantes sur fond sombre** (`BadgeWitnessPicker`, `SheetPreview` exclu) : ring de focus
   `gold`, pas `navy` (invisible sur marine).
5. **Légende ≠ rendu** dans `LayoutEditor` (bleu « Zone utile », vert « Emplacement ») : la
   légende et la zone dessinée doivent changer ensemble, sinon la légende ment.

---

### Task 1 : Vérifier le socle et fixer la table de correspondance

**Files:**
- Lecture : `src/app/globals.css`, `src/lib/brand-colors.ts`, `src/components/ui/**`
- Aucun fichier modifié.

**Interfaces:**
- Consumes : couleurs Tailwind du socle (voir « Contrat du socle »).
- Produces : état de référence (compte de classes par dossier) utilisé par la Task 9.

- [ ] **Step 1 : Vérifier que le worktree contient le socle** — `grep -E "navy|turquoise|gold|mist|warn" src/app/globals.css` doit lister les 13 couleurs. Sinon : s'arrêter et le signaler (la vague 1 n'est pas fusionnée).
- [ ] **Step 2 : Mesurer l'état initial** :
  `grep -rEc "green-|emerald-|amber-|blue-|sky-|indigo-|teal-|brand-navy|var\(--accent|bg-slate-50|bg-slate-100|#004d74" src/app/platform src/components/staff src/components/print src/components/platform src/components/notifications | grep -v ":0$"`
  Noter le résultat dans la colonne Notes de la Task 1 (≈ 18 pages plateforme, 29 fichiers staff, 15 fichiers print, 3 notifications, 1 formulaire plateforme).
- [ ] **Step 3 : Lancer le test ciblé de référence** — `make test FILE=src/components/print` et `make test FILE=src/components/notifications` : verts avant toute modification.

### Task 2 : Statuts et tons d'impression

**Files:**
- Modify : `src/components/print/PrintRequestStatusBadge.tsx`, `src/components/print/entry-tone.ts`, `src/components/print/QuoteMessageCard.tsx`, `src/app/platform/jobs/_components/JobStatusBadge.tsx`
- Test : `src/components/print/__tests__/entry-tone.test.ts` (+ tout test de ces composants qui vérifie des classes)

**Interfaces:**
- Consumes : correspondance par rôle.
- Produces : `entry-tone.ts` garde ses exports et ses clés de ton ; seules les valeurs de classes changent.

- [ ] **Step 1 : Mettre à jour d'abord `entry-tone.test.ts`** pour attendre les nouvelles classes : ton succès → `bg-turquoise-soft`, `text-turquoise-strong`, `ring-turquoise-strong/20` ; ton en attente → `bg-gold-soft`, `text-gold-strong` ; ton info (indigo) → `bg-mist`, `text-navy`, `ring-line` ; ton neutre `bg-slate-100` inchangé. Lancer : FAIL.
- [ ] **Step 2 : Modifier `entry-tone.ts`** : `emerald-50/200/900` → `turquoise-soft` / `ring-turquoise-strong/20` / `text-navy` (texte de corps d'un message de succès) ; `amber-50/200/900` → `gold-soft` / `ring-gold` / `text-gold-strong` ; `indigo-50/200/900` → `mist` / `line` / `text-navy`. Ajuster le test sur les valeurs exactes retenues.
- [ ] **Step 3 : Modifier `PrintRequestStatusBadge.tsx`** statut par statut : chaque couple `bg-X-50 text-X-700` est reclassé selon le **sens du statut** (brouillon/neutre → `bg-slate-100 text-slate-600` inchangé ; en attente de devis / de réponse → or ; devis envoyé / en cours / en production (blue, sky, indigo) → `bg-mist text-navy` ; prêt / terminé / payé / livré (emerald, teal) → `bg-turquoise-soft text-turquoise-strong`). Un statut `emerald-100` (clôturé) passe en `bg-turquoise-soft`, pas plus foncé. Lire la table de statuts du fichier avant de classer ; conserver une teinte distincte entre « en production » (mist) et « prêt » (turquoise).
- [ ] **Step 4 : `QuoteMessageCard.tsx`** : `text-indigo-700`, `border-indigo-100` → `text-navy`, `border-line`.
- [ ] **Step 5 : `JobStatusBadge.tsx`** : `emerald` (terminé) → turquoise ; `blue` (en cours) → `bg-mist text-navy` ; `amber` (en attente) → or ; `bg-slate-100` (autre) inchangé.
- [ ] **Step 6 : Lancer** `make test FILE=src/components/print` : PASS. Commit : `style(palette): statuts et tons d'impression`.

### Task 3 : Composants `src/components/print/**` (hors statuts)

**Files:**
- Modify : `OrderSteps.tsx`, `OrderTabs.tsx`, `OrderModal.tsx`, `OrderBadgesDialog.tsx`, `OnsiteCounterCard.tsx`, `ProductCard.tsx`, `ProductConfigurator.tsx`, `ProductGallery.tsx`, `PrintThread.tsx`, `QuoteLinesTable.tsx`, `RelatedRequestLinks.tsx` (tous sous `src/components/print/`)
- Test : `src/components/print/__tests__/ProductConfigurator.test.tsx` et tests voisins qui lisent des classes.

**Interfaces:** Consumes : correspondance par rôle. Produces : rien (feuilles).

- [ ] **Step 1 : Parcours/étapes** — `OrderSteps` : `bg-green-600` (étape active/faite) → `bg-navy` (texte blanc conservé) ; `ring-green-100` → `ring-mist`. `OrderTabs` : `border-green-600 text-green-700` (onglet actif) → `border-navy text-navy`.
- [ ] **Step 2 : Sélection produit** — `ProductCard` : `border-green-600`, `ring-green-600`, `hover:border-green-600`, `focus:ring-green-500` → `border-navy`, `ring-navy`, `hover:border-navy`, `focus:ring-navy` ; `bg-slate-100` (placeholder d'image) → `bg-mist`. `ProductGallery` : `border-green-600` (vignette active) → `border-navy` ; `bg-slate-100` → `bg-mist`. `ProductConfigurator` : `ring-green-600` → `ring-navy`, `bg-slate-50` (×2) → `bg-mist`, `text-amber-700` (avertissement de configuration) → `text-warn`.
- [ ] **Step 3 : Dialogues et tableaux** — `OrderModal` : `hover:bg-slate-100` → `hover:bg-mist` (bouton fermer), `focus-visible:ring-green-500` → `focus-visible:ring-navy`. `OrderBadgesDialog` : `focus:ring-green-500` → `focus:ring-navy`, `bg-slate-50` → `bg-mist`. `QuoteLinesTable` : `bg-slate-50` (en-tête et pied) → `bg-mist`. `OnsiteCounterCard` : traiter les 2 occurrences selon leur rôle (compteur/succès → turquoise-strong, fond gris → `mist`).
- [ ] **Step 4 : Fil de commande** — `PrintThread` : `text-green-700` (lien/action) → `text-navy`, `focus:ring-green-500` → `focus:ring-navy`. `RelatedRequestLinks` : `text-green-700` → `text-navy hover:underline`.
- [ ] **Step 5 : Mettre à jour les tests qui attendent des classes** (`ProductConfigurator.test.tsx` mentionne une classe de sélection : adapter à `ring-navy` / `border-navy`). Lancer `make test FILE=src/components/print` : PASS.
- [ ] **Step 6 : Vérifier** `grep -rE "green-|emerald-|amber-|blue-|sky-|indigo-|teal-|bg-slate-(50|100)" src/components/print --include=*.tsx --include=*.ts` : seules subsistent les pastilles neutres `bg-slate-100` légitimes (Task 2). Commit : `style(palette): composants d'impression`.

### Task 4 : Notifications

**Files:**
- Modify : `src/components/notifications/NotificationsView.tsx`, `NotificationPanel.tsx`, `NotificationBell.tsx`
- Test : `src/components/notifications/__tests__/NotificationsView.test.tsx`

**Interfaces:** Consumes : correspondance par rôle. Produces : rien.

- [ ] **Step 1 : Mettre à jour le test** : `target:ring-green-600` → `target:ring-navy` (élément ciblé par l'ancre). Lancer : FAIL.
- [ ] **Step 2 : `NotificationsView`** : bouton `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover text-white` ; liens `text-green-700` (×4), `hover:text-green-800` (×3) → `text-navy`, `hover:text-navy-hover` ; `bg-green-50` (notification non lue) → `bg-mist` ; `bg-slate-100` (pastille/icône neutre) → `bg-mist` ; `target:ring-green-600` → `target:ring-navy`.
- [ ] **Step 3 : `NotificationPanel`** : `bg-green-600` (pastille de compteur non lu) → `bg-navy text-white` ; liens `text-green-700`/`hover:text-green-800` → `text-navy`/`hover:text-navy-hover` ; `hover:bg-slate-50`, `hover:bg-slate-100`, `focus-visible:bg-slate-50` → `hover:bg-mist`, `focus-visible:bg-mist`.
- [ ] **Step 4 : `NotificationBell`** : `hover:bg-slate-100` → `hover:bg-mist` ; `focus-visible:ring-green-500` → `focus-visible:ring-navy`. Si la cloche est posée sur l'en-tête marine, utiliser `focus-visible:ring-gold` (vérifier au rendu : la cloche du panel est sur fond blanc, donc `navy` attendu).
- [ ] **Step 5 : Lancer** `make test FILE=src/components/notifications` : PASS. Commit : `style(palette): notifications`.

### Task 5 : Pages `src/app/platform/**`

**Files:**
- Modify (sous `src/app/platform/`) : `page.tsx`, `organizations/page.tsx`, `organizations/[orgId]/page.tsx`, `organizations/[orgId]/members/page.tsx`, `organizations/[orgId]/events/page.tsx`, `organizations/[orgId]/activity/page.tsx`, `users/page.tsx`, `users/[userId]/page.tsx`, `users/[userId]/UserDetailActions.tsx`, `profiles/page.tsx`, `activity/page.tsx`, `jobs/page.tsx`, `badge-templates/page.tsx`, `badge-templates/[id]/page.tsx`, `print/sheets/page.tsx`, `print/layouts/page.tsx`, `payments/[paymentId]/page.tsx`
- Modify : `src/components/platform/PlatformOrgMemberInviteForm.tsx`
- Test : tests voisins sous `src/app/platform/**/__tests__` qui lisent des classes (chercher d'abord).

**Interfaces:** Consumes : correspondance par rôle. Produces : rien.

- [ ] **Step 1 : Boutons principaux** (`bg-green-600 hover:bg-green-700`) → `bg-navy hover:bg-navy-hover text-white` : `page.tsx`, `organizations/page.tsx` (Créer), `users/page.tsx`, `profiles/page.tsx`, `print/layouts/page.tsx`. Ce sont des actions de création/enregistrement : marine, pas turquoise.
- [ ] **Step 2 : Liens et survols** : `hover:text-green-600` (`users`, `users/[userId]`, `profiles`) → `hover:text-navy` ; `text-green-600` dans `page.tsx` (tableau de bord, lien « Voir tout ») et `organizations/[orgId]/page.tsx` → `text-navy` si lien, `text-turquoise-strong` si c'est un indicateur de réussite (lire le contexte avant de choisir).
- [ ] **Step 3 : Contrôles** : `accent-green-600` (`users`, `organizations`) → `accent-navy` ; `focus:ring-green-500` (`UserDetailActions.tsx`) → `focus:ring-navy` ; `PlatformOrgMemberInviteForm` : `focus:ring-brand-navy`/`focus:border-brand-navy` → `focus:ring-navy`/`focus:border-navy` (la variable `--color-brand-navy` disparaît en vague 3).
- [ ] **Step 4 : Fonds internes** : `bg-slate-50` (en-têtes de tableaux, encarts : `organizations/[orgId]/members|events|activity`, `badge-templates`, `badge-templates/[id]`, `users`, `profiles`, `jobs`) → `bg-mist` ; `hover:bg-slate-50` (lignes de tableau : `users`, `profiles`, `jobs`, `payments/[paymentId]`) → `hover:bg-mist` ; `bg-slate-100`/`hover:bg-slate-100` utilisés comme fond de zone ou de bouton secondaire (`users`, `profiles`, `jobs`, `page.tsx`, `organizations`) → `bg-mist`/`hover:bg-mist`.
- [ ] **Step 5 : Succès et statuts** : `badge-templates/page.tsx` (`text-emerald-700`) et `badge-templates/[id]/page.tsx` (`text-green-700`, `text-green-600`, `text-emerald-700` : « actif », « valide ») → `text-turquoise-strong`.
- [ ] **Step 6 : Avertissements** : `print/sheets/page.tsx` (`bg-amber-50 text-amber-800`, encart d'alerte) → `bg-warn-soft text-warn` ; `organizations/[orgId]/activity/page.tsx` (`text-amber-600`, icône d'alerte) → `text-warn`.
- [ ] **Step 7 : Lancer** `make test FILE=src/app/platform` : PASS. Commit : `style(palette): pages de l'espace plateforme`.

### Task 6 : Composants staff hors `print/`

**Files:**
- Modify (sous `src/components/staff/`) : `OrganizationsTable.tsx`, `PlanManager.tsx`, `SubscriptionForm.tsx`, `SubscriptionRightsForm.tsx`, `OnsitePrintSettingsForm.tsx`, `UserCreationForm.tsx`, `InstallSummaryStep.tsx`, `RejectionReasonsManager.tsx`
- Ne pas toucher : `StaffShell.tsx`.
- Test : `src/components/staff/__tests__/**` (ex. `InstallSteps.test.tsx` : vérifier s'il lit des classes).

**Interfaces:** Consumes : correspondance par rôle. Produces : rien.

- [ ] **Step 1 :** `OrganizationsTable` : `bg-slate-50` (en-tête) → `bg-mist` ; `hover:bg-slate-50`, `hover:bg-slate-100` → `hover:bg-mist` ; `hover:text-green-600` → `hover:text-navy`.
- [ ] **Step 2 :** `PlanManager`, `InstallSummaryStep`, `SubscriptionForm` (×3), `OnsitePrintSettingsForm` : `bg-slate-50` / `hover:bg-slate-50` → `bg-mist` / `hover:bg-mist` ; `RejectionReasonsManager` : `hover:bg-slate-50` → `hover:bg-mist`.
- [ ] **Step 3 :** `accent-green-600` (`SubscriptionRightsForm`, `OnsitePrintSettingsForm`) → `accent-navy` ; `focus:ring-green-500` (`UserCreationForm`, `OnsitePrintSettingsForm`) → `focus:ring-navy`.
- [ ] **Step 4 : Lancer** `make test FILE=src/components/staff` : PASS (adapter uniquement un test qui lit une classe de couleur). Commit : `style(palette): formulaires et tableaux staff`.

### Task 7 : Staff `print/` — listes, éditeurs, catalogue

**Files:**
- Modify (sous `src/components/staff/print/`) : `CatalogList.tsx`, `ProductEditor.tsx`, `ProductOptionsEditor.tsx`, `ProductTiersEditor.tsx`, `LayoutList.tsx`, `RequestList.tsx`, `RequestStatusActions.tsx`, `QuoteEditor.tsx`
- Test : `src/components/staff/print/__tests__/**` qui lisent des classes (ex. `Labels.test`, `BatchBar.test` : seulement si présents dans ce dossier).

**Interfaces:** Consumes : correspondance par rôle. Produces : rien.

- [ ] **Step 1 : `CatalogList` et `ProductEditor`** : pastille « actif » `bg-emerald-50 text-emerald-700` → `bg-turquoise-soft text-turquoise-strong` ; pastille « masqué/épuisé » `bg-amber-50 text-amber-700` → **or** (`bg-gold-soft text-gold-strong`) si c'est un état d'attente, sinon `warn` ; trancher d'après le libellé et le noter dans la progression. `bg-slate-100`/`bg-slate-50`/`hover:bg-slate-50` → `bg-mist`/`hover:bg-mist` (pastille neutre « inactif » : conserver `bg-slate-100 text-slate-600`). `focus:ring-green-500` → `focus:ring-navy`. Les couleurs de **catalogue saisies** (échantillons, `style={{ backgroundColor }}`) ne changent pas.
- [ ] **Step 2 : `ProductOptionsEditor`** : `bg-slate-50` → `bg-mist`. `ProductTiersEditor`, `QuoteEditor` : `focus:ring-green-500` → `focus:ring-navy`.
- [ ] **Step 3 : `LayoutList`** : `bg-green-600 hover:bg-green-700` (Créer) → `bg-navy hover:bg-navy-hover` ; `hover:border-green-300` → `hover:border-navy/40` ; `text-green-700` → `text-navy` ; `bg-slate-100` (vignette) → `bg-mist`.
- [ ] **Step 4 : `RequestList`** : `bg-slate-100` (pastille neutre) inchangé si pastille de statut, sinon `bg-mist` ; `bg-slate-50`/`hover:bg-slate-50` → `bg-mist`/`hover:bg-mist` ; `text-green-700` → `text-navy`. `RequestStatusActions` : `focus:ring-green-500` → `focus:ring-navy` ; `bg-slate-100` (bouton secondaire) → `bg-mist` ; **vérifier les boutons de décision** (Accepter, Valider, Marquer payé) : s'il en existe en `bg-green-*` ils passent en `bg-turquoise text-navy`.
- [ ] **Step 5 : Lancer** `make test FILE=src/components/staff` : PASS. Commit : `style(palette): catalogue et demandes d'impression staff`.

### Task 8 : Staff `print/` — gabarits, planches, commande, sur place

**Files:**
- Modify (sous `src/components/staff/print/`) : `LayoutEditor.tsx`, `GenerationForm.tsx`, `GenerationList.tsx`, `OrderSheetPanel.tsx`, `BadgeWitnessPicker.tsx`, `OnsiteStation.tsx`, `OnsiteRequestPanel.tsx`, `order/OrderComposer.tsx`, `order/OrderConversation.tsx`, `sheets/OrderQueueTable.tsx`, `sheets/GenerateOrderSheetDialog.tsx`
- Ne pas toucher : `SheetPreview.tsx`.

**Interfaces:** Consumes : correspondance par rôle. Produces : rien.

- [ ] **Step 1 : `LayoutEditor`** (12 occurrences) : pastille `bg-green-50 text-green-700` → `bg-turquoise-soft text-turquoise-strong` ; sélection `border-green-500 bg-green-50 ring-1 ring-green-500` → `border-navy bg-mist ring-1 ring-navy` ; `focus:ring-green-500` → `focus:ring-navy` ; `hover/disabled:bg-slate-50`, `bg-slate-50`, `bg-slate-100` → `mist` ; indicateur « Mis à jour à chaque saisie » `bg-green-400` → `bg-turquoise`. **Légende et rendu ensemble** : « Zone utile » (`border-sky-400`, ligne 309, et la zone pointillée ligne ≈ 392, texte `text-sky-600` associé) → `border-navy`/`text-navy` ; « Emplacement » (`border-green-600 bg-green-100`, ligne 312, et la zone dessinée) → `border-turquoise-strong bg-turquoise-soft`. Rechercher toutes les occurrences de ces deux couples dans le fichier pour qu'aucune ne reste en ancien ton. Ce ne sont pas des couleurs de données : ce sont des repères d'éditeur.
- [ ] **Step 2 : `GenerationForm`** : `text-amber-700` (avertissement) → `text-warn` ; `text-green-600` (ok) → `text-turquoise-strong`. **`GenerationList`** : pastilles `amber` (en attente) → or ; `sky` (en cours) → `bg-mist text-navy` ; `emerald` (terminée) → turquoise ; `text-amber-700` isolé → `text-warn` ; `text-green-600` (×2) → `text-turquoise-strong`.
- [ ] **Step 3 : `sheets/OrderQueueTable`** : mêmes trois pastilles que `GenerationList` (même mapping, même rendu : les deux écrans doivent concorder) ; `text-green-700` → `text-navy` (lien), `text-green-600` (×2) → `text-turquoise-strong` ; `bg-slate-100` → `mist`/pastille neutre. **`GenerateOrderSheetDialog`** : `text-amber-700` → `text-warn`.
- [ ] **Step 4 : `OrderSheetPanel`** : `bg-green-600 hover:bg-green-700` (Générer) → `bg-navy hover:bg-navy-hover` ; `bg-slate-100` → `bg-mist` ; `text-green-700` → `text-navy`. **`OnsiteRequestPanel`** : bouton `bg-green-600 hover:bg-green-700` → marine (action de création). **`OnsiteStation`** : `hover:bg-slate-50` → `hover:bg-mist` ; `text-green-700` → `text-navy`.
- [ ] **Step 5 : `BadgeWitnessPicker`** — les deux jeux de classes (clair et sombre) : clair : `focus:ring-green-500` → `focus:ring-navy`, `bg-green-100 text-green-700` (pastille recto-verso) → `bg-turquoise-soft text-turquoise-strong`, `bg-slate-100` → `bg-mist` ; **sombre** : `focus:ring-green-400` → `focus:ring-gold`, `bg-green-400/15 text-green-300` → `bg-turquoise/15 text-turquoise` (texte sur fond sombre, contraste suffisant ; `turquoise` seul est interdit sur blanc).
- [ ] **Step 6 : `order/OrderComposer`** : encart `border-amber-300 bg-amber-50` → `border-warn/30 bg-warn-soft` ; `text-amber-600` (icône) → `text-warn` ; `focus:ring-amber-500` et `focus:ring-green-500` → `focus:ring-navy`. **`order/OrderConversation`** : `border-amber-200 bg-amber-50 text-amber-900` → `border-warn/30 bg-warn-soft text-warn` ; `text-green-700` → `text-navy` ; `bg-slate-100` → `bg-mist`.
- [ ] **Step 7 : Lancer** `make test FILE=src/components/staff` : PASS. Commit : `style(palette): gabarits, planches, commande et sur place`.

### Task 9 : Passe de contrôle et tests existants

**Files:** tous ceux du lot (lecture) ; tests existants à ajuster.

- [ ] **Step 1 : Grep résiduel** :
  `grep -rEn "green-|emerald-|amber-|blue-|sky-|indigo-|teal-|brand-navy|var\(--accent|#004d74" src/app/platform src/components/staff src/components/print src/components/platform src/components/notifications`
  Attendu : seulement `StaffShell.tsx`, `PlatformOrgShell.tsx` (socle, lecture seule) et `SheetPreview.tsx` (exception). Toute autre ligne : corriger.
- [ ] **Step 2 : `bg-slate-50|100` restants** : revue ligne à ligne ; ne subsistent que les pastilles de statut neutres (`bg-slate-100 text-slate-600`) et les couleurs de planches.
- [ ] **Step 3 : Contraste** : `grep -rEn "bg-turquoise[^ ]*.*text-white|text-white.*bg-turquoise" src/app/platform src/components/staff src/components/print src/components/notifications` : aucun résultat. `grep -rEn "text-gold[^-]" ...` : aucun résultat (texte or interdit hors `gold-strong`).
- [ ] **Step 4 : Tests** : `make test FILE=src/components/print`, `…/notifications`, `…/staff`, `make test FILE=src/app/platform` : verts. Un test qui échoue pour une classe de couleur est mis à jour ; tout autre échec → s'arrêter et demander (ne jamais modifier le code de production pour un test).
- [ ] **Step 5 : Commit** si des corrections : `style(palette): corrections de la passe de controle`.

### Task 10 : e2e, contrôle visuel, vérification

**Files:** aucun en production ; `e2e/platform/**` et `e2e/transverse/notifications.spec.ts` uniquement si un sélecteur par classe casse (aucun attendu : sélecteurs par rôle/texte).

- [ ] **Step 1 : e2e du lot** (sur la stack du worktree, pas en parallèle d'autres e2e) : `make test-e2e FILE=e2e/platform` — en particulier `organizations-list`, `print-requests`, `print-request-detail`, `print-request-onsite`, `print-sheets`, `print-layouts`, `print-catalog*`, `payments`, `jobs`, `notifications`. Attendu : tout vert. Rouge → vérifier d'abord le SMTP de la base dev (`make db-seed`), puis le 404 Turbopack (redémarrer le conteneur app) avant de chercher dans le code.
- [ ] **Step 2 : Contrôle visuel** à **375**, **1024** et **1280 px** (menu latéral ≈ 224 px dès `lg`), via le navigateur sur l'app du worktree, pour : la **liste des organisations** (`/platform/organizations`), la **page d'une commande d'impression** (`/platform/print/requests/<id>` : pastilles de statut, fil, encart d'alerte), les **planches** (`/platform/print/sheets` : file d'attente, génération, aperçu inchangé), les **paiements staff** (`/platform/payments` et la fiche d'un paiement), les notifications (cloche + page) et l'éditeur de gabarit (légende ↔ zones). Vérifier : boutons marine texte blanc, décisions turquoise texte marine, « en attente » or, alertes orange, aucun vert/bleu résiduel, focus visible au clavier, pas de défilement horizontal.
- [ ] **Step 3 : Vérification complète** : `make lint && make typecheck && make test-coverage` : verts, gates 100 % `src/lib/**` et `src/app/api/**` inchangées. Reporter les sorties dans la progression.
- [ ] **Step 4 : Clôture** : statuts `[x]` datés dans la table, dernier commit du lot ; prévenir l'orchestrateur que la branche `feat/nouvelle-palette-2b` est prête à fusionner (ordre 2a → 2b → 2c).
