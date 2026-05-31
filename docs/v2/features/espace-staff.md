# Espace Staff applicatif

## Description fonctionnelle

L'espace staff (`/staff/*`) est le back-office de la plateforme, accessible uniquement aux utilisateurs ayant `isStaff=true`. La hiérarchie staff est linéaire : `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`. Il permet :

- À `SUPER_ADMIN` : tous les droits de `STAFF_ADMIN` plus les actions exclusives — promouvoir/démouvoir un user en `STAFF_ADMIN` ou `SUPER_ADMIN`, supprimer définitivement (hard delete) une organisation, modifier les valeurs sensibles de `PlatformSettings` (`smtpPassword`, `recaptchaSecretKey`).
- À `STAFF_ADMIN` : créer/archiver les organisations, créer des utilisateurs (staff jusqu'à `STAFF_SUPPORT`/`STAFF_OBSERVER`, clients), modifier les rôles staff (jusqu'à `STAFF_SUPPORT`), configurer la plateforme (hors champs sensibles), accéder à toutes les données client.
- À `STAFF_SUPPORT` : voir tous les tenants, créer des utilisateurs clients, réinitialiser des mots de passe, agir sur les données client pour assister (avec audit).
- À `STAFF_OBSERVER` : lecture seule sur tout.

L'espace staff est aussi le point d'entrée pour "agir comme staff dans une organisation client" : depuis `/staff/organizations/[orgId]`, un staff entre dans `/admin/[orgId]/*` sans avoir besoin d'OrgMembership — l'autorisation est accordée via `isStaff`.

> La [matrice complète](multi-tenancy-rbac.md) des permissions staff est la source de vérité.

## Périmètre

Inclus :

- Pages `/staff/*` (dashboard, organisations, users, settings, activity)
- Routes API `/api/staff/*`
- Composant `StaffShell` (sidebar + header dédiés staff)
- Création d'utilisateur (staff jusqu'à `STAFF_SUPPORT`/`STAFF_OBSERVER` par `STAFF_ADMIN`, ou tout rôle par `SUPER_ADMIN` ; clients par `STAFF_ADMIN`/`STAFF_SUPPORT`/`SUPER_ADMIN`) avec invitation par email
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
- Action création (`STAFF_ADMIN` ou `SUPER_ADMIN`)
- Action **suppression définitive** (hard delete) : `SUPER_ADMIN` uniquement, avec confirmation forte (re-saisie du slug de l'org)

### `/staff/organizations/[orgId]`

Détail d'une organisation, avec onglets :

- **Vue d'ensemble** : métriques, quotas (consommé / limite), liste events récents — lecture pour tous staffs
- **Membres** : OWNERs de l'org — lecture pour tous staffs ; inviter un OWNER réservé à `STAFF_ADMIN` ou `SUPER_ADMIN`
- **Quotas** : édition `STAFF_ADMIN` ou `SUPER_ADMIN` — `quotaMaxEvents`, `quotaMaxRegistrations`, `quotaMaxStorageMB`
- **Paramètres** : édition du nom et du slug par `STAFF_ADMIN` ou `SUPER_ADMIN` ; archivage / désarchivage par `STAFF_ADMIN` ou `SUPER_ADMIN` ; bouton rouge **"Supprimer définitivement"** réservé à `SUPER_ADMIN` (hard delete, confirmation forte par re-saisie du slug)
- **Activité** : `ActivityLog` filtré sur cette org — lecture pour tous staffs

Bouton **"Entrer dans l'organisation"** (visible à tous staffs) → redirige `/admin/[orgId]` avec bandeau d'avertissement.

### `/staff/users`

Liste paginée de tous les users (staff + clients) :

- Colonnes : nom, email, type (staff role badge / client), nombre d'orgs, dernier login, archived
- Filtre : staff only, clients only, archived

### `/staff/users/new`

Formulaire de création d'utilisateur :

- Email, nom
- Type : **staff** (créateur `STAFF_ADMIN` ou `SUPER_ADMIN`) ou **client** (créateur `STAFF_ADMIN`, `STAFF_SUPPORT` ou `SUPER_ADMIN`)
- Si staff et créateur = `STAFF_ADMIN` : sélecteur de rôle limité à `STAFF_SUPPORT` ou `STAFF_OBSERVER`
- Si staff et créateur = `SUPER_ADMIN` : sélecteur de rôle complet (`SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_OBSERVER`)
- Si client : option "lier à une organisation existante" (sélecteur d'org + sélecteur d'`OrgRole` parmi `OWNER`, `MANAGER`, `AUDITOR`)
- Création :
  - Génère `inviteToken` (UUID, expiration 24h)
  - Envoie email "Bienvenue sur Badge, créez votre mot de passe" avec lien `/setup-password?token=...`
  - Activity log `USER_CREATED`

### `/staff/users/[userId]`

Détail user : nom, email, rôle, memberships, dernier login. Actions :

- **Reset password** (envoie un nouveau `inviteToken`) : `STAFF_ADMIN`, `STAFF_SUPPORT` ou `SUPER_ADMIN`
- **Changer le rôle staff** :
  - Modifier un `STAFF_SUPPORT` ou `STAFF_OBSERVER` vers `STAFF_SUPPORT` ou `STAFF_OBSERVER` : `STAFF_ADMIN` ou `SUPER_ADMIN`
  - Promouvoir un user en `STAFF_ADMIN` ou `SUPER_ADMIN` : `SUPER_ADMIN` uniquement
  - Démouvoir un `STAFF_ADMIN` ou `SUPER_ADMIN` : `SUPER_ADMIN` uniquement
  - Jamais sur soi-même
  - Refus (HTTP 409, `code=LAST_SUPER_ADMIN`) si l'opération retirerait le dernier `SUPER_ADMIN` actif de la plateforme
- **Archiver / désarchiver** : `STAFF_ADMIN` ou `SUPER_ADMIN`, jamais sur soi-même, refus si cela retirerait le dernier `SUPER_ADMIN` actif (HTTP 409, `code=LAST_SUPER_ADMIN`)
- Voir activity log filtré sur ce user

### `/staff/settings`

`PlatformSettings` — édition selon le rôle :

- **SMTP par défaut** :
  - `smtpHost`, `smtpPort`, `smtpFrom`, `smtpUser`, `smtpSecure` : `STAFF_ADMIN` ou `SUPER_ADMIN`
  - `smtpPassword` : `SUPER_ADMIN` uniquement
- **reCAPTCHA par défaut** :
  - `recaptchaSiteKey`, `recaptchaEnabled` : `STAFF_ADMIN` ou `SUPER_ADMIN`
  - `recaptchaSecretKey` : `SUPER_ADMIN` uniquement
- **Test SMTP** (bouton "Envoyer un email de test") : `STAFF_ADMIN` ou `SUPER_ADMIN`

Champs sensibles (`smtpPassword`, `recaptchaSecretKey`) :

- Masqués par défaut (input type=password)
- Toggle "Afficher" requiert ré-authentification et reste réservé à `SUPER_ADMIN`
- Jamais retournés par `GET /api/staff/settings`

### `/staff/activity`

ActivityLog global avec filtres :

- Type d'action (REGISTRATION_*, USER_*, ORG_*, EVENT_*, ...)
- Période (plage de dates)
- Organisation (sélecteur)
- Utilisateur
- `staffActor` (oui/non/tous)

## Routes API

Le rôle requis est indiqué pour chaque route. La hiérarchie est inclusive : `SUPER_ADMIN` accepte toutes les routes ouvertes à un rôle inférieur. Voir la [matrice complète](multi-tenancy-rbac.md).

### Organisations

```
GET    /api/staff/organizations                          → tout staff (lecture)
POST   /api/staff/organizations                          → STAFF_ADMIN + SUPER_ADMIN
GET    /api/staff/organizations/[orgId]                  → tout staff (lecture)
PATCH  /api/staff/organizations/[orgId]                  → STAFF_ADMIN + SUPER_ADMIN (nom, slug, quotas)
POST   /api/staff/organizations/[orgId]/archive          → STAFF_ADMIN + SUPER_ADMIN
POST   /api/staff/organizations/[orgId]/restore          → STAFF_ADMIN + SUPER_ADMIN
DELETE /api/staff/organizations/[orgId]                  → SUPER_ADMIN uniquement (hard delete, confirmation forte)
GET    /api/staff/organizations/[orgId]/owners           → tout staff (lecture)
POST   /api/staff/organizations/[orgId]/owners           → STAFF_ADMIN + SUPER_ADMIN (ajoute un OrgMembership OWNER)
DELETE /api/staff/organizations/[orgId]/owners/[userId]  → STAFF_ADMIN + SUPER_ADMIN (refus si dernier OWNER)
```

### Utilisateurs

```
GET    /api/staff/users                                  → tout staff (lecture)
POST   /api/staff/users                                  → STAFF_ADMIN + SUPER_ADMIN pour créer un staff (limites de rôle appliquées côté serveur : STAFF_ADMIN ne peut créer qu'un STAFF_SUPPORT ou STAFF_OBSERVER) ; STAFF_ADMIN + STAFF_SUPPORT + SUPER_ADMIN pour créer un client
GET    /api/staff/users/[userId]                         → tout staff (lecture)
PATCH  /api/staff/users/[userId]                         → STAFF_ADMIN + SUPER_ADMIN (changement de staffRole soumis aux règles : promotion vers STAFF_ADMIN ou SUPER_ADMIN réservée à SUPER_ADMIN ; refus si dernier SUPER_ADMIN)
POST   /api/staff/users/[userId]/reset-password          → STAFF_ADMIN + STAFF_SUPPORT + SUPER_ADMIN
DELETE /api/staff/users/[userId]                         → STAFF_ADMIN + SUPER_ADMIN (soft delete = archive, refus si dernier SUPER_ADMIN)
```

### Settings & activity

```
GET    /api/staff/settings                               → tout staff (lecture, sans secrets)
PATCH  /api/staff/settings                               → STAFF_ADMIN + SUPER_ADMIN (champs sensibles smtpPassword et recaptchaSecretKey réservés à SUPER_ADMIN)
POST   /api/staff/settings/test-smtp                     → STAFF_ADMIN + SUPER_ADMIN
GET    /api/staff/activity                               → tout staff (lecture, filtres queryString)
```

## Composants

### `StaffShell`

Layout commun pour `/staff/*` :

- Sidebar : Dashboard, Organisations, Utilisateurs, Paramètres, Journal — affiche à côté du nom de l'utilisateur connecté un badge indiquant son niveau de privilège (`SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT` ou `STAFF_OBSERVER`) pour visibilité immédiate
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
4. `STAFF_ADMIN` peut créer un `STAFF_SUPPORT` ou un `STAFF_OBSERVER`, mais une tentative de création d'un `STAFF_ADMIN` ou d'un `SUPER_ADMIN` retourne HTTP 403.
5. `SUPER_ADMIN` peut créer, promouvoir ou démouvoir un `STAFF_ADMIN` ou un `SUPER_ADMIN`.
6. Toute opération qui retirerait le dernier `SUPER_ADMIN` actif de la plateforme (changement de rôle, archivage, suppression) retourne HTTP 409 (`code=LAST_SUPER_ADMIN`).
7. La suppression définitive (hard delete) d'une organisation est réservée à `SUPER_ADMIN` et exige une confirmation forte (re-saisie du slug).
8. Les valeurs sensibles (`smtpPassword`, `recaptchaSecretKey`) ne sont éditables que par `SUPER_ADMIN`, ne sortent jamais d'une réponse API, et leur toggle "Afficher" requiert une ré-authentification.
9. Un staff qui clique "Entrer dans l'organisation" arrive sur `/admin/[orgId]` avec le bandeau staff visible.
10. Une mutation effectuée en mode staff (ex : approuver une inscription) a `staffActor=true` dans `ActivityLog`.
11. Le bouton "Test SMTP" envoie un email avec sujet "Test SMTP — Badge" à l'email staff connecté.
12. La création d'un user envoie un email d'invitation contenant `setup-password?token=...` (24h de validité).
13. Le `StaffShell` affiche dans la sidebar un badge indiquant le niveau de privilège de l'utilisateur connecté.

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers `requireStaff`, middleware
- Spec 6 (Emails) : template d'invitation, test SMTP
- Spec 7 (Deploiement) : premier staff seedé
