# Spec maîtresse — Badge v2 (SaaS multi-organisation)

> **Statut** : conception validée — 2026-05-28
> **Type** : refonte structurelle majeure
> **Successeur de** : Badge v1 (mono-événement)

## Contexte et objectifs

Badge v1 est une application mono-événement déployée pour une cérémonie d'investiture présidentielle. La v2 la transforme en SaaS B2B multi-organisation, avec onboarding manuel par un staff applicatif, sans signup public ni facturation intégrée.

L'application doit permettre :

- À un staff applicatif (Anthropic-like) de gérer plusieurs organisations clientes.
- À chaque organisation cliente d'organiser plusieurs événements en parallèle.
- À chaque événement d'avoir ses propres administrateurs, opérateurs, catégories, inscriptions et badges.
- À un utilisateur unique d'appartenir à plusieurs organisations et événements.

## Modèle conceptuel

```
Staff applicatif (global, hors-org)
    STAFF_ADMIN | STAFF_SUPPORT | STAFF_OBSERVER
                │
                ▼ crée, gère
            USER (entité globale)
                │  ├─ isStaff: bool
                │  └─ staffRole: StaffRole?
                │
        ┌───────┴───────┐
        ▼               ▼
    OrgMembership   EventMembership
    (User × Org)    (User × Event)
        │               │
        ▼               ▼
    ORGANIZATION ──▶ EVENT
        │               │
        ├─ OrgSettings  ├─ EventSettings (override)
        ├─ CategoryTemplates  ├─ Categories
        └─ Quotas       ├─ Registrations
                        ├─ BlockedEmails/Documents
                        └─ Members (EventMembership)
```

### Principes structurants

1. **User vit en dehors des organisations.** Les droits sont reconstruits à chaque requête depuis les Memberships.
2. **OWNER hérite implicitement d'ADMIN** sur tous les events de son organisation, sans EventMembership explicite.
3. **Staff applicatif a accès complet aux données client**, avec audit obligatoire visible par les OWNERs.
4. **Settings en cascade** : `PlatformSettings → OrgSettings → EventSettings`, premier non-null en remontant.
5. **Soft delete partout** : `archived: bool`, hard delete réservé aux scripts staff.
6. **Slug global unique** pour `Event` (`/e/[slug]`), évite tout besoin de sous-domaine.
7. **NextAuth JWT minimal** : ne contient que `userId` + `isStaff`. Memberships résolus serveur à chaque requête.

## Rôles et hiérarchie

| Niveau | Rôles | Portée |
|---|---|---|
| Plateforme | `STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_OBSERVER` | Toute la plateforme (toutes les orgs) |
| Organisation | `OWNER` | Une org spécifique + héritage ADMIN sur ses events |
| Événement | `ADMIN`, `OPERATOR` | Un event spécifique |

Voir la matrice complète dans [`docs/v2/features/multi-tenancy-rbac.md`](../../v2/features/multi-tenancy-rbac.md).

## Routing

- **Public** : `/e/[slug]`, `/verify/[badgeId]`, `/edit-registration/[token]`, `/login`, `/setup-password`
- **Staff** : `/staff/*`
- **Org** : `/admin/[orgId]/*`
- **Event** : `/admin/[orgId]/events/[eventId]/*`
- **Profil** : `/profile`

Le routing post-login est dérivé du profil utilisateur (`isStaff`, nombre de memberships).

## Architecture technique (inchangé v1)

- Next.js 16 App Router (monolithe front + back)
- React 19, TypeScript, Tailwind CSS 4
- Prisma 6 / MySQL 8
- NextAuth.js (Credentials, JWT)
- @react-pdf/renderer pour les badges
- nodemailer pour les emails
- Vitest pour les tests

## Décomposition en sous-spécifications

| # | Sous-spec | Description |
|---|---|---|
| 1 | [Multi-tenancy & RBAC](../../v2/features/multi-tenancy-rbac.md) | Modèles Prisma, helpers d'autorisation, middleware de scoping |
| 2 | [Espace Staff applicatif](../../v2/features/espace-staff.md) | Routes `/staff/*`, création org/user, gestion plateforme |
| 3 | [Espace Organisation (OWNER)](../../v2/features/espace-organisation.md) | Routes `/admin/[orgId]/*`, events, OrgSettings, templates |
| 4 | [Espace Événement (ADMIN/OPERATOR)](../../v2/features/espace-evenement.md) | Inscriptions, badges, catégories, scan, journal, members |
| 5 | [Inscription publique scopée](../../v2/features/inscription-publique.md) | `/e/[slug]`, branding, cascade Settings, edit-link, verify |
| 6 | [Notifications email multi-tenant](../../v2/features/notifications-email.md) | Résolveur SMTP, templates, expéditeur dynamique |
| 7 | [Reset & déploiement initial](../../v2/features/deploiement-initial.md) | Reset prod, seed staff, smoke tests, rollback |

## Ordre d'implémentation

```
Lot A (fondations)        : Spec 1 (multi-tenancy + RBAC)
                            ↓
Lot B (auth & staff)      : Spec 7 (reset + seed) → Spec 2 (espace staff)
                            ↓
Lot C (org & event)       : Spec 3 (espace org) → Spec 4 (espace event)
                            ↓
Lot D (public & emails)   : Spec 5 (inscription publique) + Spec 6 (emails) en parallèle
```

Chaque sous-spec aura son propre plan d'implémentation détaillé (`docs/v2/plans/`).

## Conventions transverses

- **Stockage de fichiers** : local sous `uploads/events/[eventId]/...`, interface `storage.ts` abstraite pour migration future vers S3/R2.
- **Soft delete** : `archived: bool` + `archivedAt: DateTime?` sur `User`, `Organization`, `Event`. Hard delete = script staff uniquement.
- **Audit** : toute mutation côté staff sur des données client génère un `ActivityLog` avec `staffActor=true`, visible par les OWNERs.
- **Sessions** : NextAuth JWT contient `userId` + `isStaff`. Les Memberships sont résolus serveur à chaque requête (pas dans le JWT) pour permettre des changements de droits instantanés.
- **Helpers d'autorisation** : `lib/auth.ts` expose `requireStaff()`, `requireOrgRole()`, `requireEventRole()`, `getEffectiveEventRole()`. Staff bypass et héritage OWNER y sont centralisés.
- **Tests** : Vitest sur la logique pure des helpers d'autorisation. Pas de mock Prisma sur les règles RBAC critiques — utiliser une BDD de test ou des fixtures.
- **Langue** : UI/emails en français avec accents complets, code/types/identifiants en anglais.
- **API** : REST (cohérent avec v1).
- **Pas de migration v1 → v2** : reset complet de la prod, redéploiement propre.

## Décisions hors-scope v2

Volontairement reporté à une version ultérieure :

- Billing intégré (Stripe, plans tarifaires) — facturation hors-app pour la v2.
- Self-service signup public — onboarding manuel par le staff uniquement.
- Custom domains par organisation (`badge.org-client.com`) — slug global unique suffit pour MVP.
- Stockage S3/R2 effectif — interface abstraite prête, implémentation locale.
- Multi-langue UI — français uniquement.
- API GraphQL — REST suffit.
- 2FA / SSO — login email+password uniquement (comme v1).
- Roles d'org étendus (BILLING, AUDITOR) — seul `OWNER` pour la v2.

## Risques principaux

| Risque | Mitigation |
|---|---|
| Complexité du RBAC à 3 niveaux | Centralisation dans `lib/auth.ts`, tests exhaustifs du résolveur |
| Slug global d'event = collisions | Vérification unicité côté création + suggestion auto basée sur titre |
| Accès staff aux données client = abus interne | Audit ActivityLog avec `staffActor` visible côté client |
| Cascade Settings (3 niveaux) = bugs subtils | Résolveur centralisé `resolveSettings(eventId?)`, tests par cas |
| Reset prod = perte de données v1 | Validé par l'utilisateur (décision explicite, pas un accident) |

## Suivi

- Brainstorming : 2026-05-28
- Décomposition en 8 specs : validée
- Rédaction sous-specs : en cours
- Self-review : à venir
- Validation utilisateur : à venir
- Plans d'implémentation (writing-plans) : à venir
