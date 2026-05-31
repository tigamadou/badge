# Espace Événement (ADMIN / OPERATOR / PRINTER / VIEWER)

## Description fonctionnelle

L'espace événement (`/admin/[orgId]/events/[eventId]/*`) est le cœur métier : la refonte des fonctionnalités de la v1 (inscriptions, badges, catégories, scan, journal) sous le scope d'un événement multi-tenant.

Quatre rôles event explicites coexistent (hiérarchie partielle : `ADMIN ⊃ OPERATOR ⊃ {PRINTER, VIEWER}`, `PRINTER` et `VIEWER` étant disjoints) ; s'y ajoutent les héritages org et staff :

- **EVENT_ADMIN** (membre explicite) : tout sauf modifier l'org parente
- **EVENT_OPERATOR** (membre explicite) : lecture détaillée des inscriptions, approbation/rejet, scan, impression badge, son profil
- **EVENT_PRINTER** (membre explicite) : impression badge **uniquement** (écran dédié de recherche + impression) + son profil
- **EVENT_VIEWER** (membre explicite) : vue agrégée des inscriptions (compteurs, noms, catégorie, statut) sans détails personnels + son profil
- **OWNER** ou **MANAGER** de l'org parent : équivalent ADMIN par héritage (spec 1)
- **AUDITOR** de l'org parent : équivalent VIEWER par héritage (spec 1)
- **STAFF** : accès complet avec audit (spec 2)

La [matrice complète des permissions par rôle](multi-tenancy-rbac.md) est la source de vérité ; cette spec n'en duplique pas le contenu mais y fait référence pour chaque page et chaque route.

## Périmètre

Inclus :

- Toutes les pages `/admin/[orgId]/events/[eventId]/*`
- Routes API `/api/admin/[orgId]/events/[eventId]/*`
- Composant `EventShell` (sidebar/header scope event)
- Gestion des `EventMembership` (inviter ADMIN, OPERATOR, PRINTER, VIEWER)
- Refonte des composants v1 (RegistrationForm, BadgeDocument, ScanPage, ...) pour intégrer `eventId`
- Gestion des `BlockedEmail` / `BlockedDocument` scopées event
- Activity log scope event

Exclu :

- Inscription publique (spec 5)
- Vérification publique badge `/verify/[id]` (spec 5)
- Édition par participant `/edit-registration/[token]` (spec 5)
- Templates email (spec 6)

## Pages

### `/admin/[orgId]/events/[eventId]` — Dashboard event

Variante ADMIN (et OWNER/MANAGER/staff par héritage) — KPI complets :

- Nombre d'inscriptions par statut (PENDING / APPROVED / REJECTED)
- Nombre de badges imprimés / total
- Nombre de scans (aujourd'hui / total)
- Quota inscriptions consommé / limite
- Liste des 10 dernières inscriptions
- Mini-chart : inscriptions par jour (30 derniers jours)

Variante OPERATOR : "Mes scans", "Accès au scanner" et boutons d'impression badge (raccourci vers `/badges`).

Variante PRINTER : **pas de dashboard avec KPI**. La page d'atterrissage par défaut est l'écran d'impression `/badges`.

Variante VIEWER : KPI agrégés (compteurs par statut, nombre de badges imprimés, nombre de scans, mini-chart inscriptions par jour) **sans aucune coordonnée nominative**. Le détail des inscriptions vit dans `/overview`.

### `/admin/[orgId]/events/[eventId]/registrations`

Liste paginée détaillée des inscriptions — accessible **ADMIN et OPERATOR** (et héritages OWNER/MANAGER/staff) :

- Colonnes : nom, email, document, catégorie, statut, dates
- Filtres : statut, catégorie, blocked, recherche (nom, email, document)
- Tri : date création, nom, statut
- Actions par ligne : Voir détail, Approuver, Rejeter, Imprimer badge, Marquer batch
- Action batch : "Approuver tout", "Imprimer batch" (sélection multi-lignes)
- Action batch "Exporter PDF/CSV" : **ADMIN uniquement**

> **Note** : pour les `VIEWER`, une vue alternative `/admin/[orgId]/events/[eventId]/overview` affiche les inscriptions en mode agrégé (nom, catégorie, statut, sans coordonnées personnelles, sans photo, sans document). Voir plus bas.

### `/admin/[orgId]/events/[eventId]/overview` — Vue VIEWER

Vue agrégée des inscriptions, accessible **VIEWER** (et héritages AUDITOR/OWNER/MANAGER/ADMIN/staff) :

- KPI : nombre d'inscriptions par statut, total badges imprimés, total scans
- Liste paginée : nom complet, catégorie, statut, badge imprimé (oui/non)
- Pas de filtres sur email/document, pas d'action par ligne, pas d'export
- Aucune photo, aucun document d'identité, aucun téléphone, aucun email affichés

C'est la **seule** vue inscriptions accessible à un VIEWER ou un AUDITOR.

### `/admin/[orgId]/events/[eventId]/registrations/new`

Formulaire de création manuelle d'inscription — **ADMIN uniquement** :

- Mêmes champs que le formulaire public (mais sans reCAPTCHA)
- Statut par défaut : `APPROVED` (pas besoin de modération si saisi par admin)

### `/admin/[orgId]/events/[eventId]/registrations/[regId]`

Détail d'une inscription. **Accessible ADMIN et OPERATOR uniquement** (PRINTER et VIEWER reçoivent 403) :

- Informations personnelles (lecture, modification possible avec snapshot)
- Photo + document d'identité (preview)
- Historique des `SubmissionSnapshot` (sous-onglet)
- Actions :
  - **Approuver / Rejeter** (motif obligatoire si rejet) : ADMIN ou OPERATOR
  - **Bloquer cet email** (ajoute `BlockedEmail`) : ADMIN uniquement
  - **Bloquer ce document** (ajoute `BlockedDocument`) : ADMIN uniquement
  - **Voir doublons** (recherche par email + nom + document, dans cet event) : ADMIN uniquement
  - **Renvoyer le lien d'édition** (génère nouveau editToken, envoie email) : ADMIN uniquement
  - **Supprimer l'inscription** (confirmation forte) : ADMIN uniquement

### `/admin/[orgId]/events/[eventId]/badges`

Écran principal d'impression badge. **Accessible ADMIN, OPERATOR, PRINTER** (et héritages OWNER/MANAGER/staff). Pour le `PRINTER`, c'est sa page d'atterrissage par défaut.

- Recherche par nom ou `badgeId`
- Filtre : non imprimé / imprimé / all-access
- Action par ligne : Voir badge, Imprimer, Toggle all-access (toggle réservé ADMIN)
- Action batch : Export PDF (zip) — **ADMIN uniquement**

Pour le `PRINTER`, l'UI est volontairement épurée : pas de filtre statut, pas de colonnes email/document, pas d'accès aux fiches inscription.

### `/admin/[orgId]/events/[eventId]/badges/[badgeId]`

- Aperçu PDF en temps réel (`@react-pdf/renderer`)
- Toggle "ALL ACCESS" (ADMIN uniquement)
- Bouton "Télécharger"
- Bouton "Marquer comme imprimé" → email participant + log (ADMIN, OPERATOR, PRINTER)

### `/admin/[orgId]/events/[eventId]/categories`

CRUD des `Category` de cet event — **ADMIN uniquement** :

- Tableau : nom, couleur (preview), numéro, neutralBadge, anonymous
- Action "Importer depuis un template" → modal avec sélecteur de `CategoryTemplate` de l'org
- Modification : refuse si modification de `number` qui crée une collision avec une autre Category du même event

### `/admin/[orgId]/events/[eventId]/members`

**ADMIN uniquement**. Liste des `EventMembership` :

- Tableau : nom, email, rôle (ADMIN / OPERATOR / PRINTER / VIEWER), date d'ajout
- Action "Inviter" :
  - Champ email (recherche autocomplete des users existants de la même org)
  - Choix rôle (ADMIN / OPERATOR / PRINTER / VIEWER)
  - Si user existe → ajoute EventMembership
  - Sinon → crée user + inviteToken + email d'invitation contextualisé "Vous avez été invité à participer à [Event] en tant que [Rôle]"
- Action "Retirer" : supprime EventMembership

### `/admin/[orgId]/events/[eventId]/settings`

**ADMIN uniquement**. Édition des informations event :

- Titre, lieu, date, logo
- Slug (lecture seule, modification par staff uniquement)
- Toggle `registrationOpen`
- Section "EventSettings" (override OrgSettings) :
  - contactEmail / contactPhone override
- Section "Blocages" :
  - Lien vers `/admin/[orgId]/events/[eventId]/blocked-emails`
  - Lien vers `/admin/[orgId]/events/[eventId]/blocked-documents`

> **Pas de section SMTP** : le SMTP est plateforme uniquement (décision 2026-05-31). Aucun champ SMTP, aucun bouton "Test SMTP" n'est exposé dans cet espace. La config SMTP vit dans `/staff/settings` (réservé staff).

### `/admin/[orgId]/events/[eventId]/blocked-emails` et `/blocked-documents`

**ADMIN uniquement**. CRUD simples (liste + ajout + suppression). Champ raison optionnel.

### `/admin/[orgId]/events/[eventId]/activity`

**ADMIN uniquement**. ActivityLog scope event (filtre `eventId=...`). Filtres : type, période, user.

> Note : un OPERATOR n'a pas accès à cette page complète mais peut consulter ses propres scans dans une vue dédiée si présente (permission atomique `event.activity.read.own`).

### `/admin/[orgId]/events/[eventId]/scan`

Scanner QR — accessible **ADMIN, OPERATOR, OWNER, MANAGER, staff**. **PAS** accessible aux `PRINTER` ni aux `VIEWER` (un PRINTER imprime mais ne check-in pas) :

- Caméra HTML5 (`html5-qrcode`)
- Affichage résultat (vert/rouge) avec infos participant
- Historique session (dernières lectures)
- Bouton "Saisie manuelle" (au cas où le QR est endommagé) → input du badgeId

## Routes API

Chaque route exprime la **permission atomique** qu'elle vérifie (cf. `requireEventPermission` dans la [matrice complète](multi-tenancy-rbac.md)).

### Inscriptions

```
GET    /api/admin/[orgId]/events/[eventId]/registrations                                    # event.read.detailed
GET    /api/admin/[orgId]/events/[eventId]/registrations/overview                           # event.read.aggregated
POST   /api/admin/[orgId]/events/[eventId]/registrations                                    # registration.create (création manuelle)
GET    /api/admin/[orgId]/events/[eventId]/registrations/[regId]                            # event.read.detailed
PATCH  /api/admin/[orgId]/events/[eventId]/registrations/[regId]                            # registration.approve (status) ou event.update (autres champs)
DELETE /api/admin/[orgId]/events/[eventId]/registrations/[regId]                            # registration.delete
POST   /api/admin/[orgId]/events/[eventId]/registrations/print                              # badge.print (batch)
POST   /api/admin/[orgId]/events/[eventId]/registrations/export                             # registration.export
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-email                # registration.block
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-document             # registration.block
GET    /api/admin/[orgId]/events/[eventId]/registrations/[regId]/duplicates                 # event.read.detailed
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/resend-edit-link           # event.update
```

### Badges

```
GET    /api/admin/[orgId]/events/[eventId]/badges                                           # badge.print (liste + recherche)
GET    /api/admin/[orgId]/events/[eventId]/badges/[badgeId]                                 # badge.print
POST   /api/admin/[orgId]/events/[eventId]/badges/[badgeId]/print                           # badge.print
PATCH  /api/admin/[orgId]/events/[eventId]/badges/[badgeId]/all-access                      # event.update
```

### Catégories

```
GET    /api/admin/[orgId]/events/[eventId]/categories                                       # event.read.detailed
POST   /api/admin/[orgId]/events/[eventId]/categories                                       # event.categories.manage
PATCH  /api/admin/[orgId]/events/[eventId]/categories/[id]                                  # event.categories.manage
DELETE /api/admin/[orgId]/events/[eventId]/categories/[id]                                  # event.categories.manage
POST   /api/admin/[orgId]/events/[eventId]/categories/import-templates                      # event.categories.manage
```

### Membres event

```
GET    /api/admin/[orgId]/events/[eventId]/members                                          # event.members.manage
POST   /api/admin/[orgId]/events/[eventId]/members                                          # event.members.manage
PATCH  /api/admin/[orgId]/events/[eventId]/members/[membershipId]                           # event.members.manage
DELETE /api/admin/[orgId]/events/[eventId]/members/[membershipId]                           # event.members.manage
```

### Settings event & blocages

```
GET    /api/admin/[orgId]/events/[eventId]                                                  # event.read.aggregated
PATCH  /api/admin/[orgId]/events/[eventId]                                                  # event.update (titre, lieu, date, logo) / event.registration_toggle (registrationOpen) / event.archive
GET    /api/admin/[orgId]/events/[eventId]/settings                                         # event.settings.update (lecture admin — contact uniquement)
PATCH  /api/admin/[orgId]/events/[eventId]/settings                                         # event.settings.update — refuse les champs SMTP (HTTP 400 si fournis)
GET    /api/admin/[orgId]/events/[eventId]/blocked-emails                                   # registration.block
POST   /api/admin/[orgId]/events/[eventId]/blocked-emails                                   # registration.block
DELETE /api/admin/[orgId]/events/[eventId]/blocked-emails/[id]                              # registration.block
GET    /api/admin/[orgId]/events/[eventId]/blocked-documents                                # registration.block
POST   /api/admin/[orgId]/events/[eventId]/blocked-documents                                # registration.block
DELETE /api/admin/[orgId]/events/[eventId]/blocked-documents/[id]                           # registration.block
```

### Scan & activity

```
POST   /api/admin/[orgId]/events/[eventId]/scan                                             # scan.check-in
GET    /api/admin/[orgId]/events/[eventId]/activity                                         # event.activity.read
```

## Composants

### `EventShell`

Layout commun pour `/admin/[orgId]/events/[eventId]/*`. La sidebar et le header varient selon le rôle effectif résolu par `getEffectiveEventRoles` :

- **Sidebar ADMIN** (et OWNER/MANAGER/staff) : Dashboard, Inscriptions, Badges, Catégories, Membres, Paramètres, Journal, Scanner
- **Sidebar OPERATOR** : Inscriptions (liste), Badges (impression), Scanner, Profil
- **Sidebar PRINTER** : Badges (impression uniquement), Profil
- **Sidebar VIEWER** (et AUDITOR) : Vue d'ensemble (overview), Profil

Le header affiche le nom event + breadcrumb (org > event) et un sélecteur event si l'utilisateur a plusieurs events. Bandeau staff si applicable.

### Composants refondus (depuis v1)

| v1 | v2 — refonte |
|---|---|
| `RegistrationForm` | inchangé sauf prop `eventId`, `categories` |
| `BadgeDocument` / `BadgeDocumentAnonymous` | inchangé sauf prop `event` (au lieu de la lecture globale) |
| `BadgeBatchExport` | inchangé sauf scope event |
| `BadgePreview` / `BadgeDownload` / `BadgeWebPreview` | inchangé sauf `eventId` |
| `AdminShell` | éclaté en `OrgShell` + `EventShell` |
| `EventForm` | inchangé sauf scope event (anciennement global) |
| `TeamForm` | renommé `CategoryForm` + prop `eventId` |
| `Sidebar` / `Header` | repensés par espace (Staff/Org/Event) |

## Critères d'acceptation

1. Un OPERATOR ne voit que Inscriptions, Badges, Scanner et son profil dans la sidebar.
2. Un OPERATOR qui tape `/admin/.../registrations` voit la liste détaillée (pas 403).
3. Un OPERATOR qui tente d'exporter les inscriptions reçoit 403.
4. Un PRINTER ne voit que `/badges` et son profil dans la sidebar.
5. Un PRINTER qui tape `/admin/.../registrations` reçoit 403.
6. Un PRINTER qui tape `/admin/.../scan` reçoit 403.
7. Un VIEWER ne voit que `/overview` et son profil dans la sidebar.
8. Un VIEWER qui tape `/admin/.../registrations/[id]` reçoit 403.
9. Un VIEWER qui tente d'imprimer un badge reçoit 403.
10. Un VIEWER ne voit ni email, ni téléphone, ni document d'identité, ni photo dans `/overview`.
11. Un AUDITOR de l'org parent accède à `/overview` de chaque event de l'org sans `EventMembership` explicite.
12. Une inscription scannée d'un autre event affiche "Badge appartient à un autre événement".
13. Création d'une catégorie avec un `number` déjà utilisé dans l'event est refusée.
14. Suppression d'une catégorie qui a des inscriptions liées : refusée (HTTP 409). L'UI propose une modale de réaffectation des inscriptions vers une autre catégorie avant de retenter la suppression.
15. Approbation d'inscription envoie l'email avec le titre de l'event résolu correctement.
16. Le badge PDF inclut le logo de l'event (résolu depuis `Event.logo`).
17. Le QR code du badge encode `https://[host]/verify/[badgeId]` (la route `/verify/[id]` est globale, pas scope event — voir spec 5).
18. Toute mutation génère `ActivityLog` avec `orgId` + `eventId` correctement remplis.
19. Les routes API re-vérifient la permission atomique attendue (defense in depth), même si le middleware a déjà filtré l'accès.

## Décisions explicites

- **Suppression de Category avec inscriptions** : refusée par l'API (HTTP 409 avec `code=CATEGORY_HAS_REGISTRATIONS`). L'UI propose une modale de réaffectation préalable.
- **Quota inscriptions atteint** : la création d'inscription publique est bloquée (`POST /api/public/events/[slug]/registrations` retourne HTTP 429 avec `code=QUOTA_EXCEEDED`). L'UI publique affiche "Inscriptions complètes". Les admins peuvent toujours créer des inscriptions manuellement (bypass quota côté admin avec audit).

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers, middleware, matrice des permissions
- Spec 3 (Espace org) : navigation parent
- Spec 5 (Public) : route `/verify/[id]`, route `/edit-registration/[token]`
- Spec 6 (Emails) : templates de notification (approbation, rejet, badge imprimé, lien d'édition)
