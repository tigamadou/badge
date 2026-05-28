# Espace Événement (ADMIN / OPERATOR)

## Description fonctionnelle

L'espace événement (`/admin/[orgId]/events/[eventId]/*`) est le cœur métier : la refonte des fonctionnalités de la v1 (inscriptions, badges, catégories, scan, journal) sous le scope d'un événement multi-tenant.

Trois profils peuvent y accéder :

- **EVENT_ADMIN** (membre explicite) : tout sauf modifier l'org parente
- **EVENT_OPERATOR** (membre explicite) : scan uniquement + son profil + son tableau de bord limité
- **OWNER** de l'org parent : équivalent ADMIN par héritage (spec 1)
- **STAFF** : accès complet avec audit (spec 2)

## Périmètre

Inclus :

- Toutes les pages `/admin/[orgId]/events/[eventId]/*`
- Routes API `/api/admin/[orgId]/events/[eventId]/*`
- Composant `EventShell` (sidebar/header scope event)
- Gestion des `EventMembership` (inviter ADMIN, OPERATOR)
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

KPI :

- Nombre d'inscriptions par statut (PENDING / APPROVED / REJECTED)
- Nombre de badges imprimés / total
- Nombre de scans (aujourd'hui / total)
- Quota inscriptions consommé / limite
- Liste des 10 dernières inscriptions
- Mini-chart : inscriptions par jour (30 derniers jours)

Variante OPERATOR : seulement "Mes scans" et "Accès au scanner".

### `/admin/[orgId]/events/[eventId]/registrations`

Liste paginée des inscriptions :

- Filtres : statut, catégorie, blocked, recherche (nom, email, document)
- Tri : date création, nom, statut
- Actions par ligne : Voir détail, Approuver, Rejeter, Imprimer badge, Marquer batch
- Action batch : "Approuver tout", "Imprimer batch", "Exporter PDF" (sélection multi-lignes)

### `/admin/[orgId]/events/[eventId]/registrations/new`

Formulaire de création manuelle d'inscription (par EVENT_ADMIN) :

- Mêmes champs que le formulaire public (mais sans reCAPTCHA)
- Statut par défaut : `APPROVED` (pas besoin de modération si saisi par admin)

### `/admin/[orgId]/events/[eventId]/registrations/[regId]`

Détail d'une inscription :

- Informations personnelles (lecture, modification possible avec snapshot)
- Photo + document d'identité (preview)
- Historique des `SubmissionSnapshot` (sous-onglet)
- Actions :
  - Approuver / Rejeter (motif obligatoire si rejet)
  - Bloquer cet email (ajoute `BlockedEmail`)
  - Bloquer ce document (ajoute `BlockedDocument`)
  - Voir doublons (recherche par email + nom + document, dans cet event)
  - Renvoyer le lien d'édition (génère nouveau editToken, envoie email)
  - Supprimer l'inscription (confirmation forte)

### `/admin/[orgId]/events/[eventId]/badges`

Liste des badges (alias de la liste inscriptions APPROVED) :

- Filtre : non imprimé / imprimé / all-access
- Action par ligne : Voir badge, Imprimer, Toggle all-access
- Action batch : Export PDF (zip)

### `/admin/[orgId]/events/[eventId]/badges/[badgeId]`

- Aperçu PDF en temps réel (`@react-pdf/renderer`)
- Toggle "ALL ACCESS"
- Bouton "Télécharger"
- Bouton "Marquer comme imprimé" → email participant + log

### `/admin/[orgId]/events/[eventId]/categories`

CRUD des `Category` de cet event :

- Tableau : nom, couleur (preview), numéro, neutralBadge, anonymous
- Action "Importer depuis un template" → modal avec sélecteur de `CategoryTemplate` de l'org
- Modification : refuse si modification de `number` qui crée une collision avec une autre Category du même event

### `/admin/[orgId]/events/[eventId]/members`

Liste des `EventMembership` :

- Tableau : nom, email, rôle (ADMIN/OPERATOR), date d'ajout
- Action "Inviter" :
  - Champ email (recherche autocomplete des users existants de la même org)
  - Choix rôle (ADMIN / OPERATOR)
  - Si user existe → ajoute EventMembership
  - Sinon → crée user + inviteToken + email d'invitation contextualisé "Vous avez été invité à participer à [Event] en tant que [Rôle]"
- Action "Retirer" : supprime EventMembership

### `/admin/[orgId]/events/[eventId]/settings`

Édition des informations event :

- Titre, lieu, date, logo
- Slug (lecture seule, modification par staff uniquement)
- Toggle `registrationOpen`
- Section "EventSettings" (override OrgSettings/PlatformSettings) :
  - smtpFrom override
  - contactEmail / contactPhone override
- Bouton "Tester SMTP" (résolution cascade)
- Section "Blocages" :
  - Lien vers `/admin/[orgId]/events/[eventId]/blocked-emails`
  - Lien vers `/admin/[orgId]/events/[eventId]/blocked-documents`

### `/admin/[orgId]/events/[eventId]/blocked-emails` et `/blocked-documents`

CRUD simples (liste + ajout + suppression). Champ raison optionnel.

### `/admin/[orgId]/events/[eventId]/activity`

ActivityLog scope event (filtre `eventId=...`). Filtres : type, période, user. Pour OPERATOR : voit uniquement ses propres actions (scans).

### `/admin/[orgId]/events/[eventId]/scan`

Scanner QR (accessible OPERATOR + ADMIN + OWNER + staff) :

- Caméra HTML5 (`html5-qrcode`)
- Affichage résultat (vert/rouge) avec infos participant
- Historique session (dernières lectures)
- Bouton "Saisie manuelle" (au cas où le QR est endommagé) → input du badgeId

## Routes API

### Inscriptions

```
GET    /api/admin/[orgId]/events/[eventId]/registrations
POST   /api/admin/[orgId]/events/[eventId]/registrations              → création manuelle (ADMIN)
GET    /api/admin/[orgId]/events/[eventId]/registrations/[regId]
PATCH  /api/admin/[orgId]/events/[eventId]/registrations/[regId]      → status, infos, allAccess
DELETE /api/admin/[orgId]/events/[eventId]/registrations/[regId]
POST   /api/admin/[orgId]/events/[eventId]/registrations/print        → marquer batch imprimé
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-email
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-document
GET    /api/admin/[orgId]/events/[eventId]/registrations/[regId]/duplicates
POST   /api/admin/[orgId]/events/[eventId]/registrations/[regId]/resend-edit-link
```

### Catégories

```
GET    /api/admin/[orgId]/events/[eventId]/categories
POST   /api/admin/[orgId]/events/[eventId]/categories
PATCH  /api/admin/[orgId]/events/[eventId]/categories/[id]
DELETE /api/admin/[orgId]/events/[eventId]/categories/[id]
POST   /api/admin/[orgId]/events/[eventId]/categories/import-templates → batch
```

### Membres event

```
GET    /api/admin/[orgId]/events/[eventId]/members
POST   /api/admin/[orgId]/events/[eventId]/members
PATCH  /api/admin/[orgId]/events/[eventId]/members/[membershipId]      → rôle
DELETE /api/admin/[orgId]/events/[eventId]/members/[membershipId]
```

### Settings event & blocages

```
GET    /api/admin/[orgId]/events/[eventId]
PATCH  /api/admin/[orgId]/events/[eventId]               → titre, lieu, date, logo, registrationOpen
GET    /api/admin/[orgId]/events/[eventId]/settings
PATCH  /api/admin/[orgId]/events/[eventId]/settings      → EventSettings
POST   /api/admin/[orgId]/events/[eventId]/settings/test-smtp
GET    /api/admin/[orgId]/events/[eventId]/blocked-emails
POST   /api/admin/[orgId]/events/[eventId]/blocked-emails
DELETE /api/admin/[orgId]/events/[eventId]/blocked-emails/[id]
GET    /api/admin/[orgId]/events/[eventId]/blocked-documents
POST   /api/admin/[orgId]/events/[eventId]/blocked-documents
DELETE /api/admin/[orgId]/events/[eventId]/blocked-documents/[id]
```

### Scan & activity

```
POST   /api/admin/[orgId]/events/[eventId]/scan          → enregistre un scan, retourne infos
GET    /api/admin/[orgId]/events/[eventId]/activity
```

## Composants

### `EventShell`

Layout commun pour `/admin/[orgId]/events/[eventId]/*` :

- Sidebar : Dashboard, Inscriptions, Badges, Catégories, Membres, Paramètres, Journal, Scanner
- Header : nom event + breadcrumb (org > event), sélecteur event si l'utilisateur a plusieurs events
- Bandeau staff si applicable
- Sidebar simplifiée pour OPERATOR (Scanner + Profil uniquement)

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

1. Un OPERATOR ne voit que `/scan` et `/profile` dans la sidebar.
2. Un OPERATOR qui tape `/admin/.../registrations` reçoit 403.
3. Une inscription scannée d'un autre event affiche "Badge appartient à un autre événement".
4. Création d'une catégorie avec un `number` déjà utilisé dans l'event est refusée.
5. Suppression d'une catégorie qui a des inscriptions liées : refusée (HTTP 409). L'UI propose une modale de réaffectation des inscriptions vers une autre catégorie avant de retenter la suppression.
6. Approbation d'inscription envoie l'email avec le titre de l'event résolu correctement.
7. Le badge PDF inclut le logo de l'event (résolu depuis `Event.logo`).
8. Le QR code du badge encode `https://[host]/verify/[badgeId]` (la route `/verify/[id]` est globale, pas scope event — voir spec 5).
9. Toute mutation génère `ActivityLog` avec `orgId` + `eventId` correctement remplis.
10. Une OperatorMembership ne suffit pas pour entrer dans `/registrations` (defense in depth dans la route API).

## Décisions explicites

- **Suppression de Category avec inscriptions** : refusée par l'API (HTTP 409 avec `code=CATEGORY_HAS_REGISTRATIONS`). L'UI propose une modale de réaffectation préalable.
- **Quota inscriptions atteint** : la création d'inscription publique est bloquée (`POST /api/public/events/[slug]/registrations` retourne HTTP 429 avec `code=QUOTA_EXCEEDED`). L'UI publique affiche "Inscriptions complètes". Les admins peuvent toujours créer des inscriptions manuellement (bypass quota côté admin avec audit).

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers, middleware
- Spec 3 (Espace org) : navigation parent
- Spec 5 (Public) : route `/verify/[id]`, route `/edit-registration/[token]`
- Spec 6 (Emails) : templates de notification (approbation, rejet, badge imprimé, lien d'édition)
