# Espace Staff applicatif

## Description fonctionnelle

L'espace staff (`/staff/*`) est le back-office de la plateforme, accessible uniquement aux utilisateurs ayant `isStaff=true`. Il permet :

- À `STAFF_ADMIN` : créer/archiver les organisations, créer des utilisateurs (staff et clients), modifier les rôles staff, configurer la plateforme, accéder à toutes les données client.
- À `STAFF_SUPPORT` : voir tous les tenants, créer des utilisateurs clients, réinitialiser des mots de passe, agir sur les données client pour assister (avec audit).
- À `STAFF_OBSERVER` : lecture seule sur tout.

L'espace staff est aussi le point d'entrée pour "agir comme staff dans une organisation client" : depuis `/staff/organizations/[orgId]`, un staff entre dans `/admin/[orgId]/*` sans avoir besoin d'OrgMembership — l'autorisation est accordée via `isStaff`.

## Périmètre

Inclus :

- Pages `/staff/*` (dashboard, organisations, users, settings, activity)
- Routes API `/api/staff/*`
- Composant `StaffShell` (sidebar + header dédiés staff)
- Création d'utilisateur (staff ou client) avec invitation par email
- Bandeau "Mode staff" visible dans `/admin/[orgId]/*` quand l'accès vient de `isStaff` plutôt que d'une OrgMembership

Exclu :

- Pages `/admin/[orgId]/*` (spec 3, mais accessibles aux staff)
- Onboarding initial (premier staff seedé) → spec 7
- Templates email d'invitation → spec 6

## Pages

### `/staff` — Dashboard

KPI globaux (lecture pour tous staffs) :

- Nombre d'organisations (actives / archivées)
- Nombre d'events actifs (toutes orgs confondues)
- Nombre d'inscriptions cumulées (toutes orgs)
- Stockage total utilisé (Mo)
- Activité récente (10 derniers `ActivityLog` toutes orgs)
- Top 5 organisations par volume d'inscriptions (mois en cours)

### `/staff/organizations`

Liste paginée des organisations avec :

- Colonnes : nom, slug, OWNERs (avatars), nombre d'events, nombre d'inscriptions, archived (filtre)
- Recherche par nom/slug
- Action création (STAFF_ADMIN uniquement)

### `/staff/organizations/[orgId]`

Détail d'une organisation, avec onglets :

- **Vue d'ensemble** : métriques, quotas (consommé / limite), liste events récents
- **Membres** : OWNERs de l'org, possibilité d'inviter (STAFF_ADMIN)
- **Quotas** : édition (STAFF_ADMIN uniquement) — quotaMaxEvents, quotaMaxRegistrations, quotaMaxStorageMB
- **Paramètres** : nom, slug, état (archived/active)
- **Activité** : ActivityLog filtré sur cette org

Bouton **"Entrer dans l'organisation"** (visible à tous staffs) → redirige `/admin/[orgId]` avec bandeau d'avertissement.

### `/staff/users`

Liste paginée de tous les users (staff + clients) :

- Colonnes : nom, email, type (staff role badge / client), nombre d'orgs, dernier login, archived
- Filtre : staff only, clients only, archived

### `/staff/users/new`

Formulaire de création d'utilisateur (STAFF_ADMIN ou STAFF_SUPPORT pour les clients) :

- Email, nom
- Type : staff (STAFF_ADMIN uniquement) ou client
- Si staff : rôle (`STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_OBSERVER`)
- Si client : option "lier à une organisation existante" (sélecteur)
- Création :
  - Génère `inviteToken` (UUID, expiration 24h)
  - Envoie email "Bienvenue sur Badge, créez votre mot de passe" avec lien `/setup-password?token=...`
  - Activity log `USER_CREATED`

### `/staff/users/[userId]`

Détail user : nom, email, rôle, memberships, dernier login. Actions :

- Reset password (envoie un nouveau `inviteToken`)
- Changer rôle staff (STAFF_ADMIN uniquement, jamais sur soi-même)
- Archiver / désarchiver
- Voir activity log filtré sur ce user

### `/staff/settings`

`PlatformSettings` (STAFF_ADMIN uniquement) :

- SMTP par défaut (host, port, from, user, password, secure)
- reCAPTCHA par défaut (siteKey, secretKey, enabled)
- Test SMTP (bouton "Envoyer un email de test")

Champs sensibles (smtpPassword, recaptchaSecretKey) :

- Masqués par défaut (input type=password)
- Toggle "Afficher" requiert ré-authentification ou délai
- Jamais retournés par `GET /api/staff/settings`

### `/staff/activity`

ActivityLog global avec filtres :

- Type d'action (REGISTRATION_*, USER_*, ORG_*, EVENT_*, ...)
- Période (plage de dates)
- Organisation (sélecteur)
- Utilisateur
- `staffActor` (oui/non/tous)

## Routes API

### Organisations

```
GET    /api/staff/organizations              → liste (staff lecture)
POST   /api/staff/organizations              → créer (STAFF_ADMIN)
GET    /api/staff/organizations/[orgId]
PATCH  /api/staff/organizations/[orgId]      → STAFF_ADMIN (modifie nom/slug/quotas)
POST   /api/staff/organizations/[orgId]/archive    → STAFF_ADMIN
POST   /api/staff/organizations/[orgId]/restore    → STAFF_ADMIN
DELETE /api/staff/organizations/[orgId]      → script staff (hard delete avec confirmation)
GET    /api/staff/organizations/[orgId]/owners
POST   /api/staff/organizations/[orgId]/owners     → ajoute un OrgMembership(OWNER) (STAFF_ADMIN)
DELETE /api/staff/organizations/[orgId]/owners/[userId] → STAFF_ADMIN
```

### Utilisateurs

```
GET    /api/staff/users                      → liste (staff lecture)
POST   /api/staff/users                      → créer (STAFF_ADMIN pour staff, _ADMIN+_SUPPORT pour client)
GET    /api/staff/users/[userId]
PATCH  /api/staff/users/[userId]             → nom, archived (STAFF_ADMIN), staffRole (STAFF_ADMIN)
POST   /api/staff/users/[userId]/reset-password → envoie un inviteToken (STAFF_ADMIN+SUPPORT)
DELETE /api/staff/users/[userId]             → soft delete = archive (STAFF_ADMIN)
```

### Settings & activity

```
GET    /api/staff/settings                   → PlatformSettings sans secrets (staff lecture)
PATCH  /api/staff/settings                   → STAFF_ADMIN
POST   /api/staff/settings/test-smtp         → STAFF_ADMIN
GET    /api/staff/activity                   → filtres queryString (staff lecture)
```

## Composants

### `StaffShell`

Layout commun pour `/staff/*` :

- Sidebar : Dashboard, Organisations, Utilisateurs, Paramètres, Journal
- Header : avatar staff + email + rôle, bouton "Quitter mode staff" si en train d'agir dans une org

### `StaffBanner`

Bandeau visible dans `/admin/[orgId]/*` quand l'accès vient de `isStaff` :

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠ Mode staff — Vous agissez en tant que [nom staff] sur l'org   │
│   [nom org]. Toute action est tracée et visible par le client.   │
│   [Quitter mode staff]                                          │
└─────────────────────────────────────────────────────────────────┘
```

Calcul : `isStaff=true` ET l'utilisateur n'a *pas* d'OrgMembership sur cette org.

## Critères d'acceptation

1. Un non-staff qui tape `/staff/*` est redirigé vers son espace (ou login si déconnecté).
2. `STAFF_OBSERVER` voit toutes les pages mais n'a aucun bouton d'action.
3. `STAFF_ADMIN` peut créer une org, créer un user, modifier les quotas, et ces actions apparaissent dans `/staff/activity`.
4. Un staff qui clique "Entrer dans l'organisation" arrive sur `/admin/[orgId]` avec le bandeau staff visible.
5. Une mutation effectuée en mode staff (ex: approuver une inscription) a `staffActor=true` dans `ActivityLog`.
6. `PlatformSettings.smtpPassword` et `.recaptchaSecretKey` ne sortent jamais d'une réponse API.
7. Le bouton "Test SMTP" envoie un email avec sujet "Test SMTP — Badge" à l'email staff connecté.
8. La création d'un user envoie un email d'invitation contenant `setup-password?token=...` (24h de validité).

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers `requireStaff`, middleware
- Spec 6 (Emails) : template d'invitation, test SMTP
- Spec 7 (Deploiement) : premier staff seedé
