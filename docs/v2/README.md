# Documentation - Badge v2

> **Statut : en conception (spec validée 2026-05-28)**

Badge v2 transforme l'application mono-événement v1 en SaaS B2B multi-organisation. Le staff applicatif onboard manuellement les clients (sans signup public), chaque organisation cliente peut organiser plusieurs événements en parallèle, et les utilisateurs ont des rôles distincts par organisation et par événement.

## Vue d'ensemble

| Concept | Description |
|---|---|
| **Staff applicatif** | 3 rôles (STAFF_ADMIN, STAFF_SUPPORT, STAFF_OBSERVER), accès global à toutes les organisations |
| **Organisation** | Client B2B, géré par un ou plusieurs OWNERs. Possède des events, settings (override plateforme), templates de catégories, quotas |
| **Événement** | Appartient à une organisation. Possède des catégories, inscriptions, badges, settings (override org). Membres ADMIN/OPERATOR par événement |
| **Multi-rôle natif** | Un user peut être OWNER de plusieurs orgs, ADMIN d'un event, OPERATOR d'un autre |
| **Cascade settings** | `PlatformSettings → OrgSettings → EventSettings`, premier non-null gagne |
| **URLs publiques** | `/e/[slug]` (slug global unique), `/verify/[id]`, `/edit-registration/[token]` |
| **Pas de billing** | Facturation hors-app, quotas configurés par le staff sur chaque org |
| **Pas de migration v1** | Reset complet de la prod, redéploiement propre |

## Documentation

### Spec maîtresse

- [Conception v2 — spec maîtresse](../superpowers/specs/2026-05-28-v2-master-design.md) — vue d'ensemble, principes, décomposition

### Architecture

- [Architecture technique](architecture.md) — stack, structure, sécurité, flux

### Sous-spécifications fonctionnelles

| # | Sous-spec | Description |
|---|---|---|
| 1 | [Multi-tenancy & RBAC](features/multi-tenancy-rbac.md) | Modèles Prisma, helpers d'autorisation, middleware de scoping |
| 2 | [Espace Staff applicatif](features/espace-staff.md) | Routes `/staff/*`, création org/user, gestion plateforme |
| 3 | [Espace Organisation (OWNER)](features/espace-organisation.md) | Routes `/admin/[orgId]/*`, events, OrgSettings, templates |
| 4 | [Espace Événement (ADMIN/OPERATOR)](features/espace-evenement.md) | Inscriptions, badges, catégories, scan, journal, members |
| 5 | [Inscription publique scopée](features/inscription-publique.md) | `/e/[slug]`, branding, cascade settings, edit-link, verify |
| 6 | [Notifications email multi-tenant](features/notifications-email.md) | Résolveur SMTP en cascade, templates, expéditeur dynamique |
| 7 | [Reset & déploiement initial](features/deploiement-initial.md) | Reset prod, seed staff, smoke tests, rollback |

### Plans d'implémentation

À venir — un plan par sous-spec, dans `docs/superpowers/plans/`.

## Différences majeures avec la v1

| Aspect | v1 | v2 |
|---|---|---|
| Événements | 1 seul (singleton) | N événements multi-organisation |
| Rôles | 4 globaux (SUPER_ADMIN, ADMIN, MODERATEUR, OPERATOR) | 3 niveaux : staff (3), org (1), event (2) |
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
- [ ] Plans d'implémentation (writing-plans)
- [ ] Implémentation
- [ ] Smoke tests
- [ ] Mise en production

## Voir aussi

- [Documentation v1](../v1/README.md) — version actuelle en production (sera remplacée)
- [Index racine](../README.md) — sélection de la version
- [Instructions IA](../../CLAUDE.md) — méthode de travail pour les agents
