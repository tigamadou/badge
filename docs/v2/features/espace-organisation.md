# Espace Organisation (OWNER / MANAGER / AUDITOR)

> **Mise à jour 2026-05-31** : le modèle `OrgSettings` est supprimé et fusionné dans `Organization`. Toutes les infos administratives (`legalName`, adresse postale structurée, `taxId`, `website`, `logo`) et le contact public (`contactEmail`, `contactPhone`) vivent désormais directement sur `Organization`. Les endpoints `/api/admin/[orgId]/settings` ont été fusionnés dans `/api/admin/[orgId]`. Voir [`multi-tenancy-rbac.md`](multi-tenancy-rbac.md) pour le modèle complet.

## Description fonctionnelle

L'espace organisation (`/admin/[orgId]/*`) est le tableau de bord du client B2B. Il est partagé entre trois rôles d'OrgMembership avec des niveaux de droits différents : `OWNER` (gestion complète), `MANAGER` (gestion opérationnelle des events et templates), `AUDITOR` (lecture seule). La matrice complète des permissions vit dans [multi-tenancy-rbac.md](multi-tenancy-rbac.md) — ce document ne la duplique pas.

Synthèse de ce qui est gérable dans cet espace :

- Paramètres de l'organisation : identité (`name`, `legalName`), adresse postale structurée (`addressLine1`, `addressLine2`, `postalCode`, `city`, `country`), administratif (`taxId`, `website`, `logo`), contact public (`contactEmail`, `contactPhone`). Modification OWNER (slug réservé staff), lecture OWNER/MANAGER/AUDITOR. Tous ces champs vivent directement sur `Organization` (pas de table `OrgSettings`). **Le SMTP et le reCAPTCHA sont plateforme uniquement** (décisions 2026-05-31, cf. [`multi-tenancy-rbac.md`](multi-tenancy-rbac.md)) — aucun champ SMTP ni reCAPTCHA n'est exposé ici.
- Événements de l'org : création et archivage (OWNER ou MANAGER), lecture (tous rôles org)
- Modèles de catégories réutilisables (`CategoryTemplate`) : CRUD (OWNER ou MANAGER), lecture (tous rôles org)
- Membres de l'organisation : invitation, changement de rôle, retrait (OWNER uniquement)
- Journal d'activité scope org : lecture (tous rôles org)

Héritages importants :

- Un `OWNER` ou un `MANAGER` d'org agit implicitement comme `ADMIN` sur tous les events de son org. Dès qu'il entre dans `/admin/[orgId]/events/[eventId]/*`, il dispose des droits d'administration de l'event.
- Un `AUDITOR` d'org agit implicitement comme `VIEWER` sur tous les events de l'org (lecture seule).

Cet espace est aussi accessible au staff (en mode staff, bandeau visible).

## Périmètre

Inclus :

- Pages `/admin/[orgId]/*` (hors `/events/[eventId]/*` qui est la spec 4)
- Routes API `/api/admin/[orgId]/*` (hors events)
- Composant `OrgShell` (sidebar/header scope org)
- Sélecteur d'org dans le header si l'utilisateur a plusieurs orgs
- Wizard de création d'event
- Gestion des `CategoryTemplate`
- Gestion des membres de l'org : invitation, changement de rôle, retrait (OWNER, MANAGER, AUDITOR)

Exclu :

- Tout ce qui est scope event (spec 4)
- Inscriptions publiques (spec 5)
- Templates email (spec 6)

## Pages

### `/admin/[orgId]` — Dashboard org

- KPI : nombre d'events actifs / archivés, total inscriptions (mois en cours), taux d'approbation moyen
- Liste des 5 derniers events avec accès rapide
- Activity log récent scope org (10 dernières entrées)
- Alerte quota (si > 80% de quotaMaxEvents ou quotaMaxRegistrations)

### `/admin/[orgId]/settings`

Lecture : OWNER, MANAGER, AUDITOR.
Modification : OWNER uniquement (ou staff, audité). Le slug et les quotas restent réservés au staff.

Tous les champs ci-dessous vivent directement sur `Organization` — il n'y a plus de table `OrgSettings`, ni de mécanisme de fallback/override entre `Organization` et un éventuel sous-modèle.

> **Pas de section SMTP ni reCAPTCHA** : le SMTP et le reCAPTCHA sont plateforme uniquement (décisions 2026-05-31). Aucun champ SMTP, aucun champ reCAPTCHA, aucun bouton "Test SMTP" n'est exposé dans cet espace. Pour modifier ces configs, voir l'espace staff (`/staff/settings`).

**Paramètres de l'organisation** :

- **Identité**
  - Nom commercial (`name`) — OWNER
  - Nom légal (`legalName`, optionnel) — OWNER
  - Slug (`slug`) — lecture seule, modifiable par le staff uniquement
- **Adresse postale** (tous optionnels, OWNER)
  - `addressLine1`, `addressLine2`
  - `postalCode`, `city`
  - `country` (ISO-3166-1 alpha-2 : FR, CI, SN…)
- **Administratif** (OWNER)
  - `taxId` (SIRET, IFU, VAT, EIN… format libre)
  - `website` (URL `https://…`)
  - `logo` (upload image, max 5 Mo, JPEG/PNG/WebP ; stocké dans `uploads/org-assets/[orgId]/logo.*`)
- **Contact public** (OWNER) — affichés dans les emails et le footer des pages publiques. Première étape de la cascade Event → Organization → Platform.
  - `contactEmail`
  - `contactPhone`
- **Quotas** (lecture seule pour OWNER/MANAGER/AUDITOR, édition staff uniquement)
  - `quotaMaxEvents`
  - `quotaMaxRegistrations`
  - `quotaMaxStorageMB`

Pour MANAGER et AUDITOR, le formulaire est affiché en mode lecture seule.

### `/admin/[orgId]/members`

Membres de l'organisation (tous rôles confondus) :

- Tableau : nom, email, **rôle** (OWNER / MANAGER / AUDITOR), date d'invitation, dernier login
- Lecture : OWNER, MANAGER, AUDITOR
- Action "Inviter un membre" (OWNER uniquement) : formulaire email + nom + **sélecteur de rôle** (OWNER / MANAGER / AUDITOR)
  - Si user existe déjà → ajoute `OrgMembership` directement avec le rôle choisi, envoie email d'information
  - Sinon → crée le user avec inviteToken (24h), envoie email "Bienvenue, vous avez été invité comme [Rôle] de [Org]"
- Action "Changer rôle" (OWNER uniquement) : modifie le rôle d'une `OrgMembership` existante. Promotion d'un `MANAGER` ou d'un `AUDITOR` vers `OWNER` autorisée. Rétrogradation d'un `OWNER` refusée si c'est le dernier OWNER actif de l'org (HTTP 409, `code=LAST_OWNER`).
- Action "Retirer" (OWNER uniquement) : supprime l'`OrgMembership`. Refusée si la cible est le dernier `OWNER` actif d'une org non archivée (HTTP 409, `code=LAST_OWNER`). Les MANAGER et AUDITOR peuvent être retirés librement.

Les MANAGER ne peuvent pas inviter, modifier ou retirer des membres de l'organisation (la gestion des membres d'event reste possible pour eux dans `/admin/[orgId]/events/[eventId]/*`).

### `/admin/[orgId]/templates`

Liste des `CategoryTemplate` :

- Tableau : nom, couleur, numéro, neutralBadge, anonymous
- Lecture : OWNER, MANAGER, AUDITOR
- Actions (créer, éditer, supprimer) : OWNER ou MANAGER
- Les templates servent au wizard de création d'event : un OWNER ou un MANAGER peut "appliquer ce template" pour préremplir les `Categories` du nouvel event.
- Pour AUDITOR, la liste est affichée sans boutons d'action.

### `/admin/[orgId]/events`

Liste des events de l'org :

- Filtres : actifs / archivés / inscriptions ouvertes / fermées
- Colonnes : titre, slug, date, lieu, registrationOpen, nombre d'inscriptions, archived
- Lecture : OWNER, MANAGER, AUDITOR
- Action "Nouvel événement" : OWNER ou MANAGER (vérifie quota)
- Action "Archiver" / "Restaurer" par event : OWNER ou MANAGER
- Pour AUDITOR, la liste est affichée en lecture seule, sans bouton de création ni d'archivage.

### `/admin/[orgId]/events/new`

Wizard 3 étapes :

1. **Informations** : titre, date, lieu, logo (upload), slug (suggestion auto à partir du titre, vérification unicité globale)
2. **Catégories** : option "Repartir d'un template" (sélecteur multi-select) ou "Définir manuellement"
3. **Récap & création** :
   - `registrationOpen=false` par défaut (l'event est créé fermé)
   - Activity log `EVENT_CREATED`
   - Redirige `/admin/[orgId]/events/[eventId]/settings`

Vérifications :

- Quota `quotaMaxEvents` respecté (sinon erreur "Limite atteinte, contactez le support")
- Slug global unique
- Catégories ont des `number` uniques au sein de l'event

### `/admin/[orgId]/activity`

ActivityLog scope org (filtre `orgId=...`). Filtres : type, period, event, user.

Lecture : OWNER, MANAGER, AUDITOR (tous les rôles d'OrgMembership accèdent au journal d'activité de leur org).

## Routes API

```
GET    /api/admin/[orgId]                           → infos org complètes : identité, adresse, taxId, website, logo, contact, quotas (OWNER, MANAGER, AUDITOR)
PATCH  /api/admin/[orgId]                           → OWNER (ou staff audité). Accepte tous les champs Organization éditables : name, legalName, addressLine1/2, postalCode, city, country, taxId, website, logo, contactEmail, contactPhone. Le slug et les quotas (quotaMaxEvents, quotaMaxRegistrations, quotaMaxStorageMB) restent staff uniquement (HTTP 403 si OWNER les fournit). Refuse tout champ SMTP ou reCAPTCHA (HTTP 400 si fournis).
GET    /api/admin/[orgId]/members                   → liste OrgMembership (OWNER, MANAGER, AUDITOR)
POST   /api/admin/[orgId]/members                   → invite ou ajoute membre avec rôle souhaité (OWNER ou staff)
PATCH  /api/admin/[orgId]/members/[userId]          → change rôle (OWNER ; refuse si rétrogradation du dernier OWNER actif, HTTP 409 LAST_OWNER)
DELETE /api/admin/[orgId]/members/[userId]          → retire (OWNER ; refuse si dernier OWNER actif, HTTP 409 LAST_OWNER)
GET    /api/admin/[orgId]/templates                 → liste CategoryTemplate (OWNER, MANAGER, AUDITOR)
POST   /api/admin/[orgId]/templates                 → OWNER ou MANAGER
PATCH  /api/admin/[orgId]/templates/[id]            → OWNER ou MANAGER
DELETE /api/admin/[orgId]/templates/[id]            → OWNER ou MANAGER
GET    /api/admin/[orgId]/events                    → liste events de l'org (OWNER, MANAGER, AUDITOR)
POST   /api/admin/[orgId]/events                    → créer (OWNER ou MANAGER, vérifie quota)
POST   /api/admin/[orgId]/events/[eventId]/archive  → OWNER ou MANAGER
POST   /api/admin/[orgId]/events/[eventId]/restore  → OWNER ou MANAGER
POST   /api/admin/[orgId]/archive                   → OWNER (action irréversible après délai de grâce)
POST   /api/admin/[orgId]/restore                   → OWNER
GET    /api/admin/[orgId]/activity                  → log filtré orgId (OWNER, MANAGER, AUDITOR)
```

## Composants

### `OrgShell`

Layout commun pour `/admin/[orgId]/*` :

- Sidebar : Dashboard, Événements, Membres, Modèles catégories, Paramètres, Journal
- Header : nom org + sélecteur org (si user a plusieurs orgs) + avatar user
- Bandeau staff (`StaffBanner`) si l'accès vient de `isStaff` sans OrgMembership
- La sidebar et les pages sont **adaptées par rôle** : un AUDITOR ne voit aucune action de création, modification ou suppression (boutons masqués), uniquement les vues en lecture seule. Un MANAGER voit les actions sur events, templates et membres event mais pas les actions sur les paramètres de l'organisation (identité, adresse, contact public, etc.), l'archivage org ou la gestion des membres org.

### `EventCreationWizard`

Composant 3 étapes (form state local + submit final unique). Validation Zod.

### `OrgSelector`

Dropdown affichant les orgs où l'utilisateur a une OrgMembership. Persiste le choix en LocalStorage. Si staff, ajoute "Toutes les organisations (mode staff)".

## Critères d'acceptation

1. Un membre d'org (OWNER, MANAGER ou AUDITOR) voit uniquement les orgs où il a une `OrgMembership` (sauf staff qui voit tout).
2. Un OWNER ne peut pas modifier le slug de l'org (réservé staff).
3. Si quota events atteint, la création échoue avec message clair.
4. Le slug d'event suggéré dérive du titre (slugify, suffixe numérique si collision globale).
5. Création event avec un template applique correctement les `Categories` (nom, color, number copiés).
6. Suppression ou rétrogradation du dernier `OWNER` actif d'une org non archivée est refusée (HTTP 409, `code=LAST_OWNER`).
7. Invitation d'un utilisateur déjà existant ajoute la `OrgMembership` avec le rôle choisi sans recréer le user.
8. Aucun champ SMTP ni reCAPTCHA n'est jamais exposé ni accepté par les routes `/admin/*` (les configs SMTP et reCAPTCHA vivent dans `PlatformSettings` uniquement). Si un client legacy envoie un de ces champs en `PATCH /api/admin/[orgId]`, la route renvoie HTTP 400.
9. Toute action audit-log avec `staffActor=true` si effectuée par un staff sans `OrgMembership`. La modification des champs administratifs (`name`, `legalName`, adresse, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone`) est journalisée via `ORG_UPDATED`.
10. Un AUDITOR voit la liste des events et les inscriptions agrégées de l'org, mais aucun bouton d'action (création, édition, archivage, approbation) n'est rendu côté UI ; les routes mutantes correspondantes renvoient HTTP 403 si elles sont appelées directement.
11. Un MANAGER peut créer un event (sous quota) mais reçoit HTTP 403 sur `PATCH /api/admin/[orgId]` (modification des infos administratives ou du contact public), `POST /api/admin/[orgId]/archive` et toute route de gestion des membres org.
12. La modification de `legalName`, des champs d'adresse, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` est réservée à OWNER (ou staff audité). MANAGER et AUDITOR reçoivent HTTP 403 sur ces champs.
13. Un MANAGER ne peut pas inviter, modifier ou retirer un membre de l'organisation (HTTP 403 sur les routes `members`). Il garde le droit d'inviter et de gérer les membres au niveau event.
14. Promotion par un OWNER d'un `MANAGER` ou d'un `AUDITOR` vers `OWNER` est autorisée et journalisée.
15. Un AUDITOR accède à `/admin/[orgId]/activity` et y voit le journal complet de son org en lecture seule.

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers d'autorisation, middleware, [matrice complète](multi-tenancy-rbac.md)
- Spec 6 (Emails) : email d'invitation membre (OWNER / MANAGER / AUDITOR). Le test SMTP n'existe qu'au niveau staff (cf. spec 2).

## v2-12 : selection du template de badge par defaut de l'organisation

Plan v2-12 ajoute une page de selection du template de badge au niveau org :

- **Page** : `/admin/[orgId]/settings/badge`. Affiche les templates disponibles et le template effectif (org si configure, sinon platform). Bouton « Utiliser le defaut herite » pour repasser sur null.
- **API** : `PATCH /api/admin/[orgId]/settings/badge` (body `{ badgeTemplateId: string | null }`). Permission : OWNER ou MANAGER (via `requireOrgRole(userId, orgId, "MANAGER")`). Note (2026-05-31) : `OrgSettings` supprime -- le champ `badgeTemplateId` vit directement sur `Organization`. Le log utilise `ORG_UPDATED` (pas d'`ORG_SETTINGS_UPDATED` dans l'enum v2) avec `details = { field: "badgeTemplateId", value }`.
- **Cascade** : utilise par `resolveBadgeTemplateId()` ; chaque event de l'org peut surcharger ce choix au niveau event.
