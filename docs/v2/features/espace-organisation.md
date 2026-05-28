# Espace Organisation (OWNER)

## Description fonctionnelle

L'espace organisation (`/admin/[orgId]/*`) est le tableau de bord du client B2B. Le OWNER y gère :

- Les paramètres de son organisation (nom, slug, OrgSettings = override SMTP/contact/reCAPTCHA)
- Ses événements (création, archivage, configuration)
- Les modèles de catégories réutilisables (`CategoryTemplate`)
- Les co-OWNERs (multi-OWNER possible)
- Le journal d'activité de son org

Un OWNER hérite implicitement d'`EVENT_ADMIN` sur tous les events de son org (voir spec 1). Donc dès qu'il entre dans `/admin/[orgId]/events/[eventId]/*`, il peut tout faire.

Cet espace est aussi accessible au staff (en mode staff, bandeau visible).

## Périmètre

Inclus :

- Pages `/admin/[orgId]/*` (hors `/events/[eventId]/*` qui est la spec 4)
- Routes API `/api/admin/[orgId]/*` (hors events)
- Composant `OrgShell` (sidebar/header scope org)
- Sélecteur d'org dans le header si l'utilisateur a plusieurs orgs
- Wizard de création d'event
- Gestion des `CategoryTemplate`
- Gestion des co-OWNERs (invitation, retrait)

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

`OrgSettings` (override de `PlatformSettings`) :

- SMTP override (host, port, from, user, password, secure) — tous nullable, null = hérite de Platform
- Contact public (email, téléphone) — affichés dans les emails et le footer des pages publiques
- reCAPTCHA override (siteKey, secretKey, enabled)

Section "Paramètres généraux" :

- Nom de l'organisation
- Slug (lecture seule, modifiable par le staff uniquement)

Bouton "Tester SMTP" : envoie un email test depuis l'expéditeur résolu en cascade.

### `/admin/[orgId]/members`

Liste des OWNERs de l'org :

- Tableau : nom, email, date d'invitation, dernier login
- Action "Inviter un OWNER" (formulaire email + nom) :
  - Si user existe déjà → ajoute OrgMembership directement, envoie email d'information
  - Sinon → crée le user avec inviteToken (24h), envoie email "Bienvenue, vous avez été invité comme OWNER de [Org]"
- Action "Retirer" : supprime l'OrgMembership (refuse si c'est le dernier OWNER)

### `/admin/[orgId]/templates`

Liste des `CategoryTemplate` :

- Tableau : nom, couleur, numéro, neutralBadge, anonymous
- Actions : créer, éditer, supprimer
- Les templates servent au wizard de création d'event : le OWNER peut "appliquer ce template" pour préremplir les Categories du nouvel event.

### `/admin/[orgId]/events`

Liste des events de l'org :

- Filtres : actifs / archivés / inscriptions ouvertes / fermées
- Colonnes : titre, slug, date, lieu, registrationOpen, nombre d'inscriptions, archived
- Action "Nouvel événement"
- Action "Archiver" / "Restaurer" par event

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

## Routes API

```
GET    /api/admin/[orgId]                    → infos org
PATCH  /api/admin/[orgId]                    → nom (OWNER), slug (staff uniquement)
GET    /api/admin/[orgId]/settings           → OrgSettings sans secrets
PATCH  /api/admin/[orgId]/settings           → OWNER ou staff (audité)
POST   /api/admin/[orgId]/settings/test-smtp → OWNER
GET    /api/admin/[orgId]/members            → liste OrgMembership
POST   /api/admin/[orgId]/members            → invite ou ajoute OWNER (OWNER ou staff)
DELETE /api/admin/[orgId]/members/[userId]   → retire (refuse si dernier)
GET    /api/admin/[orgId]/templates
POST   /api/admin/[orgId]/templates
PATCH  /api/admin/[orgId]/templates/[id]
DELETE /api/admin/[orgId]/templates/[id]
GET    /api/admin/[orgId]/events             → liste events de l'org
POST   /api/admin/[orgId]/events             → créer (OWNER, vérifie quota)
POST   /api/admin/[orgId]/events/[eventId]/archive
POST   /api/admin/[orgId]/events/[eventId]/restore
GET    /api/admin/[orgId]/activity           → log filtré orgId
```

## Composants

### `OrgShell`

Layout commun pour `/admin/[orgId]/*` :

- Sidebar : Dashboard, Événements, Membres, Modèles catégories, Paramètres, Journal
- Header : nom org + sélecteur org (si user a plusieurs orgs) + avatar user
- Bandeau staff (`StaffBanner`) si l'accès vient de `isStaff` sans OrgMembership

### `EventCreationWizard`

Composant 3 étapes (form state local + submit final unique). Validation Zod.

### `OrgSelector`

Dropdown affichant les orgs où l'utilisateur a une OrgMembership. Persiste le choix en LocalStorage. Si staff, ajoute "Toutes les organisations (mode staff)".

## Critères d'acceptation

1. Un OWNER voit uniquement les orgs où il a une OrgMembership (sauf staff qui voit tout).
2. Un OWNER ne peut pas modifier le slug de l'org (réservé staff).
3. Si quota events atteint, la création échoue avec message clair.
4. Le slug d'event suggéré dérive du titre (slugify, suffixe numérique si collision globale).
5. Création event avec un template applique correctement les Categories (nom, color, number copiés).
6. Suppression du dernier OWNER d'une org est refusée (HTTP 409).
7. Invitation d'un OWNER déjà existant ajoute la OrgMembership sans recréer le user.
8. OrgSettings.smtpPassword n'est jamais retourné dans `GET /api/admin/[orgId]/settings`.
9. Toute action audit-log avec `staffActor=true` si effectuée par un staff sans OrgMembership.

## Dépendances

- Spec 1 (Multi-tenancy & RBAC) : helpers d'autorisation, middleware
- Spec 6 (Emails) : email d'invitation OWNER, test SMTP
