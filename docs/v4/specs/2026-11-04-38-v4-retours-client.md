# Spec v4 — Retours client : images des badges, abonnements, paiements, tarifs, pagination, page commande

> **Statut** : validée — 2026-11-04
> **Type** : lot d'améliorations fonctionnelles (6 volets indépendants)
> **Branche** : `feat/retours-client-v3`
> **Plans** : [`1-socle`](../plans/2026-11-04-1-socle-retours-client.md), [`2a-images`](../plans/2026-11-04-2a-images-badge.md),
> [`2b-abonnement`](../plans/2026-11-04-2b-abonnement-paiements-tarifs.md), [`2c-pagination-commande`](../plans/2026-11-04-2c-pagination-page-commande.md),
> [`3-fusion`](../plans/2026-11-04-3-fusion-et-pr.md)
> **Features existantes** : [`features/templates-badges.md`](../features/templates-badges.md),
> [`features/validation-profils.md`](../features/validation-profils.md),
> [`features/abonnements.md`](../features/abonnements.md),
> [`features/paiements-fedapay.md`](../features/paiements-fedapay.md),
> [`features/impression-demandes.md`](../features/impression-demandes.md)

## Contexte

Retours du client après la mise en préproduction de la v3.0.0 (pre-v3.0.0). Six volets, sans
dépendance fonctionnelle forte entre eux, qui touchent des zones de code distinctes.

Légende : **[U]** = décidé par l'utilisateur ; **[C]** = choix proposé par l'agent et accepté
sans objection (à vérifier en relecture) ; **[B]** = laissé au constructeur.

---

## Volet 1 — Exigences de dimensions des images du badge

### Pourquoi

Un logo ou une bannière dont le ratio ne correspond pas au cadre du template est déformé ou
rogné à l'impression ; une photo de participant non conforme produit un badge inutilisable.

### Logo et bannière de l'évènement

- **[U]** Le ratio attendu est **lu dans le template effectif de l'évènement** (cascade
  `Event → Org → Platform`, `resolveEventTemplateId`) : c'est le cadre (largeur × hauteur) du
  ou des blocs du manifeste dont l'image est la variable liée à `event.logoDataUrl` (resp.
  `event.bannerDataUrl`).
- **[U]** L'envoi passe par un **outil de recadrage** verrouillé sur le ratio du cadre : on
  choisit l'image, on cadre, le fichier envoyé est au bon ratio. Même outil que pour la photo
  du participant (composant unique, ratio en paramètre).
- **[U]** Côté serveur, un fichier dont le ratio ne correspond pas est **rejeté** (protection
  des appels directs), avec un message qui donne le format attendu (« Ratio attendu 3:1, par
  ex. 1500 × 500 px »).
- **[C]** L'original est conservé à côté de la version recadrée : après un changement de
  template, l'organisateur **recadre l'image existante** au nouveau ratio sans la renvoyer.
  La résolution minimale s'applique à la zone recadrée ; si l'original est trop petit pour le
  nouveau cadre, il faut en envoyer un autre.
- **[C]** Tolérance de ratio : ± 2 %. Résolution minimale : 2 × la taille du cadre en px du
  manifeste, sur chaque dimension.
- **[C]** L'interface d'envoi affiche le format attendu **avant** l'envoi.
- Cas limites :
  - le template n'utilise pas la variable → aucune contrainte ;
  - la variable est utilisée dans plusieurs blocs de ratios différents → **[B]** retenir une
    règle (premier bloc, ou rejet si incompatibles) et la documenter ;
  - ratio lu côté serveur à partir des octets du fichier (pas de confiance au client) **[B]**
    (choix de la lib de lecture des dimensions).

### Changement de template

- **[U]** Changer de template (au niveau évènement, ou implicitement via l'org ou la
  plateforme) reste autorisé.
- **[U]** Les images devenues non conformes sont signalées **« à recadrer »** sur la page de
  l'évènement, et la **génération des badges est bloquée** tant qu'elles ne sont pas
  conformes (rendu, export, commande d'impression).
- **[C]** Points bloqués (réponse 4xx avec message explicite, et bandeau sur la page de
  l'évènement) : génération/export des badges, envoi d'une nouvelle commande d'impression,
  impression sur place. L'aperçu du template reste possible, avec un avertissement. Les
  planches déjà générées et les commandes déjà envoyées ne sont pas remises en cause.
- **[C]** La conformité est **calculée** à la lecture (template effectif + dimensions de
  l'image), pas stockée : aucun état à resynchroniser quand la cascade change. Les dimensions
  de l'image peuvent être mémorisées à l'envoi pour éviter de relire le fichier **[B]**.

### Photo du participant

- **[U]** Ratio **photo d'identité 7:9** (35 × 45 mm), fixe, indépendant du template.
- **[U]** Un **outil de recadrage** est intégré à l'envoi de la photo (profil du compte
  participant `/account/...`, et partout où la photo est envoyée) : l'utilisateur cadre, le
  fichier envoyé est déjà au bon ratio. Le serveur revérifie le ratio (± 2 %).
- **[C]** Ce contrôle serveur s'applique à **tous** les chemins d'envoi d'une photo de
  participant (inventaire au plan), chacun doté du recadrage dans son interface. Les photos
  déjà en base ne sont pas remises en cause (pas de blocage rétroactif ; le staff peut les
  rejeter à la validation). Ajout d'une dépendance front de recadrage accepté **[C]**.
- **[U]** Les **règles de la photo d'identité** sont affichées sur le compte du participant, à
  côté de l'envoi : visage de face et centré, fond blanc uni, tête nue (sauf motif religieux)
  et sans lunettes de soleil, net et bien éclairé, photo récente, pas de filtre ni retouche.
- **[U]** Une photo non conforme peut être **rejetée** par le staff via le circuit existant de
  validation des profils (`ProfileSubmission`, `RejectionReason` de portée profil).
- **[C]** Des motifs de rejet dédiés sont ajoutés au catalogue (« Fond non blanc », « Visage
  non visible ou non centré », « Photo floue ou sombre », « Couvre-chef ou lunettes de
  soleil ») : par le seed (dev/démo) ; en prod, le staff les crée dans les paramètres
  plateforme (documenté dans le guide).

---

## Volet 2 — Renouvellement et changement d'abonnement

Règle actuelle (`planChangeFor`) : même plan → EXTENSION ; plan moins cher → SCHEDULED ; plan
plus cher → IMMEDIATE (nouvelle période, sans crédit).

- **[U]** **Même plan, abonnement actif** : paiement **bloqué** (UI et API).
  **[U]** Exception : le renouvellement est autorisé dans les **7 derniers jours** avant
  l'échéance ; la nouvelle période s'ajoute à la fin de l'actuelle (EXTENSION actuelle).
  Hors fenêtre, l'UI affiche « Votre abonnement est actif jusqu'au JJ/MM/AAAA, renouvelable à
  partir du JJ/MM/AAAA ».
- **[U]** **Plan moins cher** : inchangé (programmé à l'échéance).
- **[U]** **Plan plus cher** : démarre **immédiatement**, avec un **prorata** :
  - **[C]** montant dû = prix du nouveau plan − crédit restant (plancher 0) ;
  - **[U]** le crédit se calcule sur le **montant réellement payé** (pas sur le prix du plan) :
    une période offerte par le staff ne donne aucun crédit ;
  - **[C]** pour cela, chaque `Payment` d'abonnement approuvé enregistre la période qu'il a
    achetée (`coversFrom`, `coversTo`, fixés à l'application du paiement). Crédit restant =
    Σ, sur les paiements d'abonnement approuvés de l'org pour le plan courant dont
    `coversTo > maintenant`, de `amount × (coversTo − max(maintenant, coversFrom)) ÷
    (coversTo − coversFrom)`, arrondi à l'entier XOF inférieur. Une période déjà prolongée
    (EXTENSION) est ainsi créditée en entier pour sa partie future ;
  - **[C]** pas de reprise des paiements existants : la v4 n'est pas en production, un paiement
    sans `coversFrom`/`coversTo` ne compte pas dans le crédit ;
  - **[C]** le montant (prix plein, crédit, montant dû) est calculé et **figé sur le `Payment`
    à sa création** ; à la confirmation FedaPay, si l'abonnement a changé entre-temps
    (crédit différent), le paiement est quand même appliqué au montant figé et l'écart est
    tracé dans l'audit **[B]** (ou refus et remboursement manuel, à arbitrer au plan) ;
  - **[C]** « plus cher / moins cher » reste la comparaison du prix brut actuelle, quelle que soit
    la périodicité (mensuel → annuel plus cher = immédiat ; annuel → mensuel moins cher =
    programmé) ;
  - **[C]** la nouvelle période démarre à la date du paiement, pour une période complète du
    nouveau plan ; un plan programmé (SCHEDULED) est annulé ;
  - **[C]** le détail (prix plein, crédit, jours restants) est affiché avant le paiement et
    **enregistré sur le `Payment`** (champs à ajouter), repris sur la fiche du paiement.
- **[C]** « Actif » = `isRunning` (ACTIVE et échéance future ou nulle). Un abonnement sans
  échéance ne se renouvelle pas (bloqué). EXPIRED / CANCELLED : paiement libre (IMMEDIATE).
  Un plan déjà programmé n'empêche ni la montée en gamme (qui l'annule) ni le renouvellement
  dans la fenêtre des 7 jours.
- **[B]** Paiement PENDING déjà ouvert : vérifier le comportement actuel, empêcher deux
  paiements d'abonnement simultanés s'il ne l'est pas.
- Les changements faits par le staff depuis `/platform/organizations/[orgId]/subscription`
  ne sont pas concernés (pas de paiement) **[C]**.

---

## Volet 3 — Module Paiements

- **[U]** Pour le **staff** et pour les **organisations**.
- **[C]** Staff : `/platform/payments` — liste de tous les paiements ; filtres organisation,
  statut, type (abonnement / impression), période ; recherche par référence FedaPay.
  Fiche `/platform/payments/[paymentId]`.
- **[C]** Organisation : `/org/[orgId]/payments` — ses paiements, mêmes filtres sauf
  organisation ; fiche `/org/[orgId]/payments/[paymentId]`. Mêmes droits que la page
  abonnement de l'org **[B]** (vérifier les rôles réels). Les paiements d'impression y
  figurent aussi ; un membre d'évènement qui n'a pas ces droits d'org continue de voir les
  paiements de sa commande sur la page de la commande, sans accès au module **[C]**.
- **[C]** Fiche : montant, devise, statut et dates (création, approbation), type, plan ou
  commande d'impression liée (lien), détail du prorata (volet 2), référence et identifiant
  FedaPay, payeur, organisation (staff).
- **[C]** Reçu imprimable pour un paiement approuvé : page HTML dédiée, optimisée pour
  l'impression du navigateur (pas de passage par le service de rendu).
- Entrées de menu dans les deux espaces. Lecture seule : aucune action de modification.

---

## Volet 4 — Page tarifs publique dynamique

- **[U]** `/tarifs` affiche les plans **depuis la base** au lieu d'un contenu en dur.
- **[C]** Champs ajoutés à `Plan`, édités par le staff dans `/platform/plans` :
  `publicVisible` (bool), `position` (ordre), `description` (courte), `features` (liste de
  libellés), `highlighted` (plan mis en avant).
- **[C]** Affichés : plans non archivés et `publicVisible`, triés par `position`. Bascule
  mensuel / annuel s'il existe des plans des deux périodes. Limites (évènements,
  participants) affichées, « Illimité » pour null. Plan sans prix → « Nous contacter » (lien
  contact). Montants en FCFA.
- **[C]** `publicVisible` vaut `false` par défaut ; le seed rend visibles les plans de démo ; en
  préprod/prod, le staff choisit les plans visibles. Aucun plan visible → état vide « Tarifs
  sur demande » avec lien contact (le contenu en dur actuel est supprimé).
- **[B]** Stratégie de cache de la page (rendu dynamique ou revalidation).

---

## Volet 5 — Pagination des listes

- **[U]** Choix du nombre d'éléments par page : **10, 20, 50, 100, 500**.
- **[C]** Un composant unique (évolution de `src/components/ui/Pagination.tsx`) et un helper
  de lecture des paramètres (généralisation de `src/lib/badge-list-query.ts`) ; `page` et
  `pageSize` dans l'URL ; pagination côté serveur.
- **[C]** Par défaut 20, sauf la liste des badges qui garde 100. Valeur hors liste → défaut.
- **[C]** Appliqué à **toutes** les listes paginables des espaces connectés (inscriptions,
  badges, membres, organisations, utilisateurs, profils, évènements, commandes, planches,
  journaux d'activité, tâches, paiements…). **[B]** Inventaire exhaustif à dresser au plan ;
  les listes aujourd'hui non paginées le deviennent. Les filtres et tris aujourd'hui faits
  côté client sur ces listes passent côté serveur, dans l'URL **[C]**.

---

## Volet 6 — Page d'une commande d'impression

Concerne la page staff (`/platform/print/orders/[requestId]`) et la page organisateur
(`/event/[eventId]/print/[requestId]`). Schéma validé par l'utilisateur le 2026-11-04 :

- **[U]** **En-tête fixe** : référence, statut, et tous les boutons d'action (« Voir les
  badges (N) », « Modifier le devis », action principale du statut). Ils restent visibles en
  permanence.
- **[U]** La page tient dans la hauteur de l'écran ; **chaque colonne défile seule**.
- **[U]** **Colonne gauche** réorganisée : frise des étapes de la commande en tête, puis
  l'essentiel (évènement, badges, livraison, contact), détails techniques (template, dates,
  remarques) repliés.
- **[U]** **Chat au centre**, zone de saisie **collée en bas**.
  - message client : fond neutre ;
  - message staff : fond teinté, **différent** de celui du client ;
  - message de devis : couleur propre, distincte des deux autres, **présenté en tableau**
    (lignes, quantités, prix, total).
- **[U]** **Modification du devis dans une modale** (ouverte depuis l'en-tête).
- **[U]** **Liste des badges dans une modale**, avec recherche et la pagination du volet 5.
- **[C]** Colonne droite : résumé du devis, crédit, paiements, planche, impression sur place.
- **[C]** Mobile : trois onglets (Infos / Discussion / Devis), Discussion ouvert par défaut.
- Aucun changement de règle métier ni d'API sur ce volet (présentation uniquement), sauf
  besoin d'une route existante côté modale.

---

## Hors périmètre

- Refonte visuelle générale (chantier design séparé, dossier `docs/v4/design/`).
- Remboursements, factures fiscales.

## Contraintes

- Règles du projet : RBAC via `src/lib/auth.ts`, audit `logActivity` pour toute action
  sensible (rejet d'upload non requis ; changement d'abonnement oui), uploads JPEG/PNG/WebP
  5 Mo (le moteur ne lit pas le WebP : un logo/bannière WebP doit rester refusé si le
  template l'imprime **[B]** vérifier l'état actuel).
- Tests : base `_test`, pas de mock Prisma, fabriques, couverture 100 % `src/lib` et
  `src/app/api` ; e2e pour les parcours clés (rejet d'image, recadrage, upgrade au prorata,
  page commande).
- Documentation impactée mise à jour dans le même changement (features listées en tête).

---

## Organisation du travail (chantier `retours-client`)

- Branche d'intégration **`feat/retours-client-v3`** (depuis `development`).
- **Vague 1 — socle** (séquentielle, dossier principal) : `plans/2026-11-04-1-socle-retours-client.md`.
- **Vague 2 — 3 lots parallèles**, chacun dans son worktree (`feat/retours-client-v3-2a|2b|2c`) et
  sa stack (`scripts/agent-stack.sh up <lot> <branche>`) :
  - **2a — Images du badge** (volet 1) : `plans/2026-11-04-2a-images-badge.md`
  - **2b — Abonnement, paiements, tarifs** (volets 2, 3, 4) : `plans/2026-11-04-2b-abonnement-paiements-tarifs.md`
  - **2c — Pagination et page commande** (volets 5, 6) : `plans/2026-11-04-2c-pagination-page-commande.md`
- **Vague 3 — fusion et PR** : `plans/2026-11-04-3-fusion-et-pr.md`. Ordre de fusion 2b → 2a → 2c
  (2c touche le plus de pages). Vérification complète après chaque fusion.
- Modèle des sous-agents d'exécution, de revue et de correction : **Sonnet** (`model: "sonnet"`).

### Socle (vague 1) — fige les contrats

1. **Schéma Prisma** (`prisma/schema.prisma`, seul lot à y toucher) :
   - `Event` : `logoOriginal String?`, `bannerOriginal String?` (clé de l'original avant
     recadrage), `logoWidth/logoHeight/bannerWidth/bannerHeight Int?` (dimensions de la version
     recadrée, mémorisées à l'enregistrement) ;
   - `Payment` : `listPrice Int?` (prix plein du plan), `prorataCredit Int?` (crédit déduit),
     `coversFrom DateTime?`, `coversTo DateTime?` (période achetée, fixée à l'application) ;
   - `Plan` : `publicVisible Boolean @default(false)`, `position Int @default(0)`,
     `description String? @db.Text`, `features Json?` (tableau de libellés),
     `highlighted Boolean @default(false)` ;
   - `ActivityType` : les nouveaux types dont les lots ont besoin (ex. `EVENT_IMAGE_UPDATED`) et
     leurs libellés dans `src/lib/activity-labels.ts` (seul lot à toucher ce fichier).
2. **Lecture de dimensions** : `src/lib/image-dimensions.ts` —
   `readImageDimensions(buf: Buffer): { width: number; height: number; format: "jpeg" | "png" | "webp" } | null`
   (lecture des en-têtes, sans dépendance) et
   `ratioMatches(width, height, targetWidth, targetHeight, tolerance = 0.02): boolean`.
   Constante `ID_PHOTO_RATIO = { width: 7, height: 9 }`.
3. **Pagination** : `src/lib/list-query.ts` — `PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500]`,
   `DEFAULT_PAGE_SIZE = 20`,
   `parseListPage(params: URLSearchParams | Record<string, string | string[] | undefined>, opts?: { defaultSize?: number }): { page: number; pageSize: number; skip: number; take: number }`
   (valeur hors liste → défaut) ; `src/lib/badge-list-query.ts` réécrit sur cette base (même API
   exportée). `src/components/ui/Pagination.tsx` : options par défaut `PAGE_SIZE_OPTIONS`,
   plus un composant `UrlPagination` (client, met à jour `page`/`pageSize` dans l'URL, remet `page`
   à 1 quand la taille change).
4. **Seeds** : `prisma/seed/minimal.ts` (4 motifs de rejet de portée profil ; plans par défaut
   `publicVisible`) et son test.
5. **Fabriques** : `src/test/factories.ts` couvre les nouveaux champs. En vague 2, un lot qui a
   besoin d'une fabrique nouvelle l'écrit dans `src/test/factories-<lot>.ts` ; idem pour les
   helpers e2e dans `e2e/helpers/<lot>.ts`. `src/test/factories.ts` et `e2e/helpers/db.ts` sont en
   lecture seule en vague 2.

### Fichiers par lot (vague 2) — exclusifs

- **2a — Images** :
  `src/app/api/org/[orgId]/upload/**`, `src/app/api/org/[orgId]/events/[eventId]/route.ts`,
  `src/app/api/org/[orgId]/events/route.ts`, `src/app/api/org/[orgId]/events/[eventId]/upload/**`,
  `src/app/api/upload/**`, `src/app/api/account/upload/**`, `src/app/api/account/profile/**`,
  `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts` et `.../[regId]/route.ts`
  (contrôle de la photo seulement), `src/app/api/org/[orgId]/events/[eventId]/badges/**` (sauf
  pagination : le GET liste reste tel quel), `.../print-requests/[requestId]/submit/**`,
  `src/app/api/platform/print/sheets/**`, `src/app/api/platform/print/requests/[requestId]/onsite/**`,
  `src/lib/badge-templates/image-frames.ts` [nouveau], `src/lib/badge-templates/render-badge.ts`,
  `src/lib/event-image-compliance.ts` [nouveau], `src/lib/print-requests/lifecycle.ts`,
  `src/lib/print-requests/onsite.ts`, `src/lib/print-requests/onsite-station.ts`,
  `src/lib/print-sheets/generations.ts`, `src/lib/print-sheets/run-generation.ts`,
  `src/lib/storage.ts`, `src/lib/upload-token.ts`, `src/lib/validators/registration.ts`,
  `src/components/ui/ImageCropper.tsx` [nouveau], `src/components/ui/FileBox.tsx`,
  `src/components/event/EventSettingsForm.tsx`, `src/components/event/RegistrationForm.tsx`,
  `src/components/event/EventImageAlert.tsx` [nouveau],
  `src/app/event/[eventId]/settings/**`, `src/app/event/[eventId]/page.tsx`,
  `src/app/event/[eventId]/registrations/new/**`, `src/app/account/profile/**`,
  `src/components/account/IdPhotoRules.tsx` [nouveau], `prisma/seed/demo/images.ts`,
  `prisma/seed/demo/png.ts`, `e2e/fixtures/**`, `package.json` et lockfiles (bibliothèque de
  recadrage), les tests de ces fichiers, `e2e/event/settings.spec.ts`,
  `e2e/public/account-profile.spec.ts`, `e2e/event/registrations-new.spec.ts`,
  `docs/v4/features/templates-badges.md`, `docs/v4/features/validation-profils.md`.
- **2b — Abonnement, paiements, tarifs** :
  `src/lib/subscription-changes.ts`, `src/lib/payments.ts`, `src/lib/payment-return.ts`,
  `src/lib/payment-history.ts`, `src/lib/subscription-path.ts`, `src/lib/payments-query.ts`
  [nouveau], `src/app/api/org/[orgId]/subscription/**`, `src/app/api/webhooks/fedapay/**`,
  `src/app/api/platform/plans/**`, `src/app/api/org/[orgId]/payments/**` et
  `src/app/api/platform/payments/**` [nouveaux, si besoin],
  `src/app/org/[orgId]/subscription/**`, `src/app/org/[orgId]/payments/**` [nouveau],
  `src/app/platform/payments/**` [nouveau], `src/app/platform/plans/**`,
  `src/app/platform/organizations/[orgId]/subscription/**`, `src/app/(marketing)/tarifs/**`,
  `src/app/(marketing)/page.tsx` (usage de `PricingCards` seulement),
  `src/components/admin/PlanCatalog.tsx`, `src/components/admin/PaymentHistory.tsx` (props
  existantes conservées), `src/components/admin/OrgShell.tsx`, `src/components/staff/StaffShell.tsx`,
  `src/components/staff/PlanManager.tsx`, `src/components/marketing/PricingCards.tsx`,
  `src/components/marketing/ComparisonTable.tsx`, `src/components/payments/**` [nouveau],
  `prisma/seed/demo/billing/**`, `e2e/helpers/nav.ts`, les tests de ces fichiers,
  `e2e/org/subscription.spec.ts`, `e2e/platform/subscription-flow.spec.ts`,
  `e2e/platform/organization-subscription.spec.ts`, `e2e/platform/plans.spec.ts`,
  `e2e/public/marketing.spec.ts`, e2e nouveaux `e2e/*/payments*.spec.ts`,
  `docs/v4/features/abonnements.md`, `docs/v4/features/paiements-fedapay.md`.
- **2c — Pagination et page commande** :
  toutes les pages de liste des espaces connectés **non citées en 2a/2b** et leurs composants de
  table (inventaire dans le plan : org events/members/templates/activity ; event registrations/
  badges/categories/members/blocked-*/activity/print ; platform organizations (+ events/members/
  activity d'une org)/profiles/users/badge-templates/print orders/sheets/layouts/catalog/jobs/
  activity ; account), leurs routes API de liste (`src/app/api/platform/{organizations,users,activity}/route.ts`,
  `src/app/api/org/[orgId]/events/[eventId]/{registrations,activity}/route.ts` — GET seulement,
  `src/app/api/platform/print/requests/route.ts`, `.../badges/route.ts` GET),
  `src/lib/jobs/admin.ts`, `src/components/event/BadgeListTable.tsx`,
  `src/components/event/RegistrationTable.tsx`, `src/components/staff/print/**` (hors
  `OnsiteStation.tsx`), `src/components/event/print/**`, `src/components/print/**`,
  `src/app/platform/print/orders/**` (hors `[requestId]/onsite/**`), `src/app/event/[eventId]/print/**`,
  `src/app/api/platform/print/requests/[requestId]/route.ts`,
  `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/registrations/**`,
  `src/components/layout/AppShell.tsx` (option « pleine hauteur » seulement), les tests de ces
  fichiers, `e2e/event/print-request-detail.spec.ts`, `e2e/event/print-conversation.spec.ts`,
  `e2e/platform/print-request-detail.spec.ts`, e2e de pagination nouveaux,
  `docs/v4/features/impression-demandes.md`.

**Lecture seule pour tous en vague 2** : `prisma/schema.prisma`, `src/lib/image-dimensions.ts`,
`src/lib/list-query.ts`, `src/lib/badge-list-query.ts`, `src/components/ui/Pagination.tsx`,
`src/lib/activity-labels.ts`, `src/test/factories.ts`, `e2e/helpers/db.ts`,
`prisma/seed/minimal.ts`. Besoin d'y toucher → s'arrêter et le signaler.

### Table de contrôle des interfaces partagées

| Lots | Fichier / interface | Produit par | Consommé par | Verdict |
|---|---|---|---|---|
| socle → 2a, 2b, 2c | `prisma/schema.prisma` | socle | tous | figé en vague 1 |
| socle → 2a | `readImageDimensions`, `ratioMatches`, `ID_PHOTO_RATIO` | socle | 2a | figé |
| socle → 2b, 2c | `parseListPage`, `UrlPagination`, `PAGE_SIZE_OPTIONS` | socle | 2b (listes de paiements), 2c | figé |
| 2b → 2c | `PaymentHistory` (props) | 2b | 2c (colonnes devis) | 2b conserve les props ; peut ajouter un lien optionnel vers la fiche |
| 2a ↔ 2c | `BadgeListTable.tsx`, `RequestStatusActions.tsx`, `PrintRequestActions.tsx` | 2c | 2a (erreurs 4xx « images à recadrer ») | à 2c ; 2a renvoie un code d'erreur `EVENT_IMAGES_NONCOMPLIANT` avec message, affiché par l'affichage d'erreur existant ; le bandeau est sur le tableau de bord évènement (2a) |
| 2a ↔ 2c | `.../badges/route.ts` | 2c (GET liste) | 2a (rendu `[badgeId]`, exports) | GET liste à 2c ; `[badgeId]/**`, `exports/**`, `batch/**`, `ids/**` à 2a |
| 2a ↔ 2c | `src/app/event/[eventId]/page.tsx` | 2a | — | 2c n'y touche pas (pas une liste) |
| 2b ↔ 2c | listes de paiements | 2b | — | 2b les pagine lui-même avec le socle |

### Journal des arbitrages (relecture croisée des plans, 2026-11-04)

- `scripts/agent-stack.sh up <lot> feat/retours-client-v3` (le script suffixe la branche) : 2b corrigé.
- `UrlPagination` : props `{ page, totalPages, total, pageSize, pageSizeOptions? }` (socle) ; 2b aligné.
- Types d'audit figés par le socle : `EVENT_IMAGE_UPDATED`, `PAYMENT_PRORATA_MISMATCH` ; 2b journalise
  l'écart de prorata avec ce dernier.
- `src/lib/print-requests/thread.ts` attribué à 2c : `lines` ajouté à la liste blanche organisateur de
  `QUOTE_SENT` (devis en tableau sur toutes les versions).
- `registrations/route.ts` (POST) : ne reçoit pas de photo, non touché par 2a ; GET à 2c.
- Tailles de page héritées (jobs 30, badges 200) remplacées par la liste commune : 2c.
- Crédit ≥ prix du nouveau plan : refus `NOTHING_TO_PAY` (409) avec message invitant à contacter le
  support (FedaPay n'encaisse pas 0) — cas rare, revu si besoin.
- 2a : premier bloc retenu si plusieurs cadres ; WebP refusé pour logo et bannière ; photo minimale
  210 × 270 px ; image illisible en stockage ignorée ; valeur inchangée non revalidée ;
  bibliothèque `react-easy-crop` ; `fixtures.jpeg` e2e devient un PNG 7:9 conforme.
- `package-lock.json` périmé (Yarn fait foi) : seul `yarn.lock` est mis à jour ; nettoyage éventuel
  hors chantier.
