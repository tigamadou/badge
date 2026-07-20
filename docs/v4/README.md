# Documentation - Badge v4

> **Statut : en construction**

La v4 regroupe sept chantiers appliques a la base v2/v3 :

1. HTTPS local (Caddy `tls internal`)
2. Retrait des quotas ad-hoc au profit d'un systeme d'abonnements
3. Systeme d'abonnements (plans catalogue + overrides, facturation manuelle)
4. Deconnexion via modal de confirmation
5. Choix du role a la creation/invitation d'utilisateurs
6. Stockage objet MinIO/S3 + champs upload fonctionnels
7. Separation complete des espaces (staff / organisation / evenement)

## Documents

Trois plans en cours, numerotes selon leur ordre d'execution (suffixe `-NN-` apres la date) :

- [01 — Corrections bugs pre-E2E](plans/2026-07-20-01-v4-fixes-bugs-pre-e2e.md) — **d'abord** : verify-email, acces PRINTER badges, suppression /badge/[id].
- [02 — Abonnements (periodicite, slug auto, blocage org)](plans/2026-07-20-02-v4-abonnements-periodicite-slug-blocage.md) — tracker de progression en tete.
- [03 — Reorganisation E2E par page](plans/2026-07-20-03-v4-e2e-reorg-par-page.md) — un fichier de specs par page, toutes les actions testees, tous les espaces (suppose 01 termine).
- [Politique de tests](features/politique-tests.md) — 3 couches (unitaire / integration / E2E), seuils, matrice RBAC.
- [Architecture](architecture.md) — structure des espaces, RBAC, garde-fous.
- [Installation](installation.md) — env, services, HTTPS local, commandes de test, CI.
- [Spec backups hebdomadaires](specs/2026-05-31-v4-stockage-s3-et-backups.md) — ADR (migre depuis v3-01) ; volet stockage S3/MinIO implemente et retire du document.

## Etat d'avancement

| Chantier | Etat |
|---|---|
| HTTPS local (item 1) | Livre |
| Separation des espaces + renommage (item 7) | Livre |
| Deconnexion (item 4) | Livre |
| Roles a la creation (item 5) | Livre |
| Stockage MinIO/S3 (item 6) | Driver S3 livre ; securisation `/api/files` et champs upload en cours |
| Abonnements (items 2+3) | A faire |
| Couverture de tests (plan v4-02) | Unitaire lib + integration API a **100%** (gate vert) ; cibles make + CI livrees ; E2E (Phase 3) a faire |

Voir la section `## Progression` du plan pour le detail task par task.
