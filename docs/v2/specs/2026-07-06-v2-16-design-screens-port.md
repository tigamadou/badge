# Spec v2-16 — Port ecran-par-ecran des maquettes (design screens)

> **Statut** : conception validee — 2026-07-06
> **Type** : reskin de contenu (fidelite maquettes) — suite de v2-15
> **Perimetre** : v2 uniquement
> **Branche** : `feat/design_implementation`
> **Spec maitresse** : [`2026-05-28-v2-master-design.md`](2026-05-28-v2-master-design.md)
> **Plan design socle** : [`../plans/2026-06-17-v2-15-design-system-refonte.md`](../plans/2026-06-17-v2-15-design-system-refonte.md)
> **Checklist d'acceptation UI** : [`2026-06-01-e2e-visual-review-checklist.md`](2026-06-01-e2e-visual-review-checklist.md)
> **Plans d'implementation** :
> - [`../plans/2026-07-06-v2-16-design-screens-00-directeur.md`](../plans/2026-07-06-v2-16-design-screens-00-directeur.md)
> - [`../plans/2026-07-06-v2-16-design-screens-01-public-auth.md`](../plans/2026-07-06-v2-16-design-screens-01-public-auth.md)
> - [`../plans/2026-07-06-v2-16-design-screens-02-staff.md`](../plans/2026-07-06-v2-16-design-screens-02-staff.md)
> - [`../plans/2026-07-06-v2-16-design-screens-03-org.md`](../plans/2026-07-06-v2-16-design-screens-03-org.md)
> - [`../plans/2026-07-06-v2-16-design-screens-04-event.md`](../plans/2026-07-06-v2-16-design-screens-04-event.md)

## Contexte et objectifs

Le lot v2-15 a migre l'application vers le design system marine + vert : tokens (`globals.css`), trois shells (`StaffShell`/`OrgShell`/`EventShell`), `SidebarNav`, primitives `ui/` (`Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`), `AuthCard` et hero public. Le socle est en place sur la branche `feat/design_implementation` (non commite).

Le plan v2-15 a explicitement laisse **hors-scope** la reconstruction **ecran-par-ecran** des 44 maquettes du bundle Claude Design (dossier `template/` a la racine du repo). Concretement, les composants d'ecran specialises ne sont pas encore construits : statcards, timeline d'activite, minichart 30 jours, barres de quota, radio-cards de categorie, scanner QR plein ecran, grille de vignettes batch, dropzone, stepper de wizard, `badge-card` produit, etc. Les pages existantes affichent la logique metier correcte mais pas encore le rendu des maquettes.

**Objectif de v2-16** : porter le **contenu** de chaque page a la fidelite des maquettes `template/`, sans creer de logique metier ni casser l'existant. Le medium de design reste du HTML/CSS prototype (`template/assets/badge.css` + `shell.js`) ; on le **recree** en React + utilitaires Tailwind v4 sur le socle v2-15 (choix confirme, coherent avec v2-15 : pas d'import de `badge.css` tel quel).

Ce lot ne touche ni le schema Prisma, ni les routes API, ni les helpers d'autorisation. C'est un travail de rendu.

## Decisions tranchees (synthese ADR)

| Sujet | Decision | Pourquoi |
|---|---|---|
| Nature du travail | Reskin de contenu, **aucune nouvelle route ni logique metier** | Quasi toutes les routes existent et fonctionnent (data, server actions, RBAC). Le seul manque est le rendu fidele. Minimise le risque. |
| Fidelite | Port **fidele** des maquettes en React/Tailwind sur le socle v2-15 | Les maquettes sont validees et matchent l'app 1:1. Fidelite = coherence produit. Confirme par l'utilisateur. |
| Technique de style | Utilitaires Tailwind + tokens, **jamais** `badge.css` importe | Coherent avec le parti pris v2-15. Un double systeme de style (custom CSS + Tailwind) serait une dette. Chaque classe `badge.css` -> composant React. |
| Structure des plans | 1 plan directeur (composants transverses) + 4 sous-plans par espace | 44 ecrans : la decomposition rend chaque lot livrable et reviewable. Confirme par l'utilisateur. |
| Ordre | Directeur (lib partagee) -> Public/Auth -> Staff -> Org -> Evenement | Les composants partages d'abord ; l'espace le plus riche (Evenement) en dernier, quand la lib est mure. |
| Preservation logique | Data-fetching, server actions, RBAC **inchanges** | Si une maquette revele une affordance UI manquante, on la cable a l'API **existante** ; on n'invente pas de logique. |
| Landing `accueil.html` | **Dans le scope** : nouvelle page marketing publique | Decision utilisateur. Page vitrine pour visiteur non authentifie (le `/` authentifie continue de rediriger). |
| Journal detail `journal-detail.html` | **Ajouter** une vue detail d'entree de journal, partagee aux 3 niveaux (staff/org/event) | La maquette existe, pas la route. Vue detail reutilisable (avant/apres, payload, auteur, contexte). |
| Blocklists | **Fusionner en onglets** : un seul ecran emails/documents | Decision utilisateur. La maquette `event-blocklists.html` presente 2 tables en 1 ecran. Les deux API (`blocked-emails`, `blocked-documents`) sont conservees. |
| Styleguide `styleguide.html` | Page `/styleguide` **dev-only optionnelle** | Reference vivante du DS, utile pour la revue visuelle. Non prioritaire, portee dans le directeur. |
| Doublons badge V1/V2 | Reconciliation lors du composant `BadgeCard` | `src/components/badge/` a des doublons `*V2` ; le port du `badge-card` est l'occasion de clarifier le canonique. |
| Criteres d'acceptation | Checklist de revue visuelle (3 viewports x 3 etats x roles) + `make lint && typecheck && test` verts | Reutilise `2026-06-01-e2e-visual-review-checklist.md`. L'evidence avant l'affirmation. |
| Commit / git | Aucun commit sans demande explicite de l'utilisateur | Regle projet. Le socle v2-15 reste la base (non commite) — prerequis du lot. |

## Prerequis

- Le socle v2-15 (tokens, shells, `SidebarNav`, primitives `ui/`, `AuthCard`) reste la base. Il est non commite ; ce lot suppose qu'il est conserve.
- Conteneurs Docker dev up (`make dev`). Verification via `make lint`/`typecheck`/`test`.
- Le dossier `template/` (44 ecrans + `assets/badge.css` + `shell.js` + `icons.js` + `_ds/`) est la reference visuelle autoritaire.

## Correspondance ecran (template) -> page (app)

Statut : **[ok]** page existante a reskiner · **[new]** page/vue a creer · **[merge]** fusion de routes.

### Public & Authentification + Compte participant (sous-plan 01)

| Ecran template | Route app | Statut |
|---|---|---|
| `accueil.html` | landing publique (nouvelle) | [new] |
| `connexion.html` | `/login` | [ok] |
| `mot-de-passe.html` (5 etats) | `/forgot-password`, `/forgot-password` (succes), `/reset-password/[token]`, `/setup-password`, `/verify-email/[token]` | [ok] |
| `inscription-publique.html` | `/e/[slug]` + `/e/[slug]/register` | [ok] |
| `confirmation.html` | `/e/[slug]/success` | [ok] |
| `apercu-badge.html` | `/badge/[id]` | [ok] |
| `verification-badge.html` | `/verify/[badgeId]` | [ok] |
| `participant-dashboard.html` | `/account` | [ok] |
| `participant-inscription.html` | `/account/registrations/[id]` | [ok] |
| `participant-profil.html` | `/account/profile` (+ `/account/profile/complete`) | [ok] |
| `selecteur-organisation.html` | `/select` | [ok] |

### Espace Staff (sous-plan 02)

| Ecran template | Route app | Statut |
|---|---|---|
| `staff-dashboard.html` | `/staff` | [ok] |
| `staff-orgs.html` | `/staff/organizations` | [ok] |
| `staff-org-create.html` | `/staff/organizations/new` | [ok] |
| `staff-org-detail.html` | `/staff/organizations/[orgId]` | [ok] |
| `staff-users.html` | `/staff/users` | [ok] |
| `staff-user-create.html` | `/staff/users/new` | [ok] |
| `staff-user-detail.html` | `/staff/users/[userId]` | [ok] |
| `staff-settings.html` | `/staff/settings` | [ok] |
| `staff-badge-template.html` | `/staff/settings/badge` | [ok] |
| `staff-log.html` | `/staff/activity` | [ok] |

### Espace Organisation (sous-plan 03)

| Ecran template | Route app | Statut |
|---|---|---|
| `org-dashboard.html` | `/admin/[orgId]` | [ok] |
| `org-events.html` | `/admin/[orgId]/events` | [ok] |
| `org-event-create.html` | `/admin/[orgId]/events/new` | [ok] |
| `org-members.html` | `/admin/[orgId]/members` | [ok] |
| `org-category-templates.html` | `/admin/[orgId]/templates` | [ok] |
| `org-badge-template.html` | `/admin/[orgId]/settings/badge` | [ok] |
| `org-settings.html` | `/admin/[orgId]/settings` | [ok] |
| `org-log.html` | `/admin/[orgId]/activity` | [ok] |

### Espace Evenement (sous-plan 04)

| Ecran template | Route app | Statut |
|---|---|---|
| `event-dashboard.html` | `.../events/[eventId]` | [ok] |
| `event-inscriptions.html` | `.../registrations` | [ok] |
| `event-inscription-detail.html` | `.../registrations/[regId]` | [ok] |
| `event-inscription-create.html` | `.../registrations/new` | [ok] |
| `event-inscriptions-viewer.html` | `.../registrations/overview` (variante VIEWER) | [ok] |
| `event-badges.html` | `.../badges` | [ok] |
| `event-badge-batch.html` | `.../badges/print` | [ok] |
| `event-badge-preview.html` | `.../badges/[badgeId]` | [ok] |
| `event-badge-template.html` | `.../settings/badge` | [ok] |
| `event-categories.html` | `.../categories` | [ok] |
| `event-blocklists.html` | `.../blocked-emails` + `.../blocked-documents` fusionnees en onglets | [merge] |
| `event-scanner.html` | `.../scan` | [ok] |
| `event-members.html` | `.../members` | [ok] |
| `event-settings.html` | `.../settings` | [ok] |
| `event-log.html` | `.../activity` | [ok] |

### Transverse

| Ecran template | Cible | Statut |
|---|---|---|
| `journal-detail.html` | vue detail d'entree de journal, partagee staff/org/event | [new] |
| `styleguide.html` | `/styleguide` dev-only (optionnel) | [new] |
| `index.html`, `export/*` | galerie de navigation du template — **pas une page app** | (ignore) |

## Bibliotheque de composants transverses (plan directeur)

Composants d'ecran absents du socle v2-15, a construire **d'abord** car partages entre espaces. En complement des primitives existantes (`Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`).

- **Data-display** : `StatCard` + `StatGrid` (delta up/down), `Card`/`CardHead`/`CardBody`, `Timeline` (dots ok/warn), `QuotaBar` + alerte stockage, `MiniChart` (sparkline 30 j), `EmptyState`, `Alert` (info/err), `Spinner`/`Progress`/`SuccessRing`.
- **Listes** : `Toolbar` + `SearchInput` + `ChipFilter`, `BatchBar` (actions par lot), `CatPill`/`CatDot`, `RoleBadge`, `Tag`.
- **Formulaires** : `FormSection`, `Switch`, `Checkbox` stylise, `RadioCards`, `FileBox` + `Dropzone` (etend `FileUploadField`), `PasswordMeter`, `Stepper` (aligne `EventCreationWizard`).
- **Produit badge** : `BadgeCard` (100x140mm) + `MiniBadge` (grille batch) — reconcilie les doublons V1/V2.
- **Specialises** : `Scanner` (frame/reticle/laser — reskin `QRScanner`), `PickCard`/`OrgLogo` (selecteur org), `PhoneMockup` + `VerifyBanner` (verif publique).
- **Optionnel** : page `/styleguide` reproduisant `styleguide.html`.

## Hors-scope

- Modification du schema Prisma, des routes API, des helpers d'autorisation.
- Nouvelle logique metier ou nouveaux flux (au-dela des affordances UI cablees sur l'API existante).
- Refonte des emails transactionnels (couvert par v2-06/notifications).
- Deploiement (v2 non deployee — cf. v2-07 abandonne).

## Criteres d'acceptation (globaux)

1. Chaque page cible reproduit fidelement sa maquette `template/` (structure, composants, hierarchie visuelle).
2. Aucune regression fonctionnelle : data, RBAC, server actions identiques ; parcours golden path OK.
3. Revue visuelle par page selon `2026-06-01-e2e-visual-review-checklist.md` : 3 viewports (375/768/1440) x 3 etats (vide/charge/erreur) x roles pertinents.
4. `make lint && make typecheck && make test` verts.
5. Contraintes DS respectees (accent vert unique, plat sauf modales, slate, Inter UI / Montserrat badges, `focus-visible` AA).
