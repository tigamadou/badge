# Documentation - Badge v2

> **Statut : en conception (spec validée 2026-05-28)**

Badge v2 transforme l'application mono-événement v1 en SaaS B2B multi-organisation. Le staff applicatif onboard manuellement les clients (sans signup public), chaque organisation cliente peut organiser plusieurs événements en parallèle, et les utilisateurs ont des rôles distincts par organisation et par événement.

## Vue d'ensemble

| Concept | Description |
|---|---|
| **Staff applicatif** | 4 rôles linéaires (SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER), accès global à toutes les organisations |
| **Organisation** | Client B2B, géré par OWNER (gestion complète), MANAGER (events + membres event), AUDITOR (lecture seule). Possède des events, settings (override plateforme), templates de catégories, quotas |
| **Événement** | Appartient à une organisation. Possède des catégories, inscriptions, badges, settings (override org). 4 rôles par événement : ADMIN, OPERATOR, PRINTER (impression badge), VIEWER (vue agrégée) |
| **Multi-rôle natif** | Un user peut être OWNER de plusieurs orgs, MANAGER d'une autre, ADMIN d'un event, OPERATOR d'un autre |
| **Cascade settings** | `PlatformSettings → OrgSettings → EventSettings`, premier non-null gagne |
| **URLs publiques** | `/e/[slug]` (slug global unique), `/verify/[id]`, `/edit-registration/[token]` |
| **Pas de billing** | Facturation hors-app, quotas configurés par le staff sur chaque org |
| **Pas de migration v1** | Reset complet de la prod, redéploiement propre |

## Documentation

### Spec maîtresse

- [Conception v2 — spec maîtresse](specs/2026-05-28-v2-master-design.md) — vue d'ensemble, principes, décomposition

### Architecture

- [Architecture technique](architecture.md) — stack, structure, sécurité, flux

### Sous-spécifications fonctionnelles

| # | Sous-spec | Description |
|---|---|---|
| 1 | [Multi-tenancy & RBAC](features/multi-tenancy-rbac.md) | Modèles Prisma, helpers d'autorisation, middleware de scoping |
| 2 | [Espace Staff applicatif](features/espace-staff.md) | Routes `/staff/*`, création org/user, gestion plateforme |
| 3 | [Espace Organisation (OWNER / MANAGER / AUDITOR)](features/espace-organisation.md) | Routes `/admin/[orgId]/*`, events, OrgSettings, templates |
| 4 | [Espace Événement (ADMIN / OPERATOR / PRINTER / VIEWER)](features/espace-evenement.md) | Inscriptions, badges, catégories, scan, journal, members |
| 5 | [Inscription publique scopée](features/inscription-publique.md) | `/e/[slug]`, branding, cascade settings, edit-link, verify |
| 6 | [Notifications email multi-tenant](features/notifications-email.md) | Résolveur SMTP en cascade, templates, expéditeur dynamique |
| 7 | [Reset & déploiement initial](features/deploiement-initial.md) | Reset prod, seed staff, smoke tests, rollback |

### Plans d'implémentation

Un plan par sous-spec, dans `docs/v2/plans/` (avec tracker de progression en tête) :

| # | Plan | Lignes | Tasks |
|---|---|---|---|
| 1 | [Multi-tenancy & RBAC](plans/2026-05-28-v2-01-multi-tenancy-rbac.md) | 1 862 | 12 |
| 2 | [Espace Staff applicatif](plans/2026-05-28-v2-02-espace-staff.md) | 5 296 | 16 |
| 3 | [Espace Organisation](plans/2026-05-28-v2-03-espace-organisation.md) | 3 847 | 18 |
| 4 | [Espace Événement](plans/2026-05-28-v2-04-espace-evenement.md) | 8 154 | 23 |
| 5 | [Inscription publique scopée](plans/2026-05-28-v2-05-inscription-publique.md) | 3 575 | 19 |
| 6 | [Notifications email multi-tenant](plans/2026-05-28-v2-06-notifications-email.md) | 2 017 | 12 |
| 7 | [Reset & déploiement initial](plans/2026-05-28-v2-07-deploiement-initial.md) | 1 194 | 7 |

## Différences majeures avec la v1

| Aspect | v1 | v2 |
|---|---|---|
| Événements | 1 seul (singleton) | N événements multi-organisation |
| Rôles | 4 globaux (SUPER_ADMIN, ADMIN, MODERATEUR, OPERATOR) avec séparation forte (SUPER_ADMIN sans actions métier) | 3 niveaux : staff (4 : SUPER_ADMIN/STAFF_ADMIN/SUPPORT/OBSERVER), org (3 : OWNER/MANAGER/AUDITOR), event (4 : ADMIN/OPERATOR/PRINTER/VIEWER). Pas de séparation forte : SUPER_ADMIN v2 a tous les droits |
| Settings | Globaux (singleton) | Cascade Platform / Org / Event |
| Catégories | Globales (anciennement "Team") | Par event + templates au niveau org |
| Blocages email/doc | Globaux | Par event |
| URL d'inscription | Page d'accueil | `/e/[event-slug]` |
| Stockage | `/uploads/` plat | `/uploads/events/[eventId]/` |
| Migration | — | Pas de migration : reset complet |

## État d'avancement

- [x] Brainstorming et validation du design (2026-05-28)
- [x] Spec maîtresse rédigée
- [x] 7 sous-spécifications rédigées
- [x] Plans d'implémentation (7/7 rédigés — 2026-05-29)
- [ ] Implémentation
- [ ] Smoke tests
- [ ] Mise en production

## Voir aussi

- [Documentation v1](../v1/README.md) — version actuelle en production (sera remplacée)
- [Index racine](../README.md) — sélection de la version
- [Instructions IA](../../CLAUDE.md) — méthode de travail pour les agents
