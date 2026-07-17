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

- [Plan d'implementation unique](plans/2026-07-17-v4-refonte-globale.md) — tracker de progression en tete.
- [Architecture](architecture.md) — structure des espaces, RBAC, garde-fous.
- [Installation](installation.md) — env, services, HTTPS local.
- [Spec stockage S3/MinIO](specs/2026-05-31-v4-stockage-s3-et-backups.md) — ADR (migre depuis v3-01).

## Etat d'avancement

| Chantier | Etat |
|---|---|
| HTTPS local (item 1) | Livre |
| Separation des espaces + renommage (item 7) | Livre |
| Deconnexion (item 4) | Livre |
| Roles a la creation (item 5) | Livre |
| Stockage MinIO/S3 (item 6) | Driver S3 livre ; securisation `/api/files` et champs upload en cours |
| Abonnements (items 2+3) | A faire |

Voir la section `## Progression` du plan pour le detail task par task.
