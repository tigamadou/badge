# Documentation - Badge

Cette documentation est versionnee. Chaque version majeure de l'application a
sa propre documentation autonome.

> **Nettoyage du 2026-07-17** : les documentations v1, v2 et v3 (plans et specs
> deja implementes ou abandonnes) ont ete supprimees. Seule la **v4** est
> conservee. L'historique reste accessible via git si besoin.

## Versions disponibles

| Version | Statut | Documentation |
|---------|--------|---------------|
| **v4** | En construction | [docs/v4/](v4/) |

## Quelle version consulter ?

- **Vous travaillez sur l'application** : consultez la documentation
  [v4](v4/), seule version active.

Si vous etes un outil IA et que la version n'est pas explicite dans la demande
de l'utilisateur, **demandez avant de coder**.

## Convention de versionnement

La version de la documentation suit la version majeure de l'application. Les
changements mineurs (corrections, ajouts non rupteurs) sont integres dans la
version courante. Une nouvelle version de la doc est creee uniquement lors
d'une refonte fonctionnelle majeure.

## Statuts possibles

| Statut | Signification | Regles de modification |
|--------|---------------|------------------------|
| **Production** | Version actuellement deployee en production. | Modifications conservatrices uniquement (corrections, clarifications, ajouts non rupteurs). Pas de refonte. |
| **En construction** | Version en cours de redaction ou d'implementation. | Refontes autorisees dans le perimetre de la spec. Toute evolution est documentee dans la version cible. |
| **Archivee** | Version superseded par une plus recente. | Lecture seule. Ne jamais modifier. Conservee a titre historique. |

## Structure attendue d'une version

Chaque version contient au minimum :

```
docs/<version>/
  README.md                 # Index, vue d'ensemble, etat d'avancement
  architecture.md           # Stack, structure du projet, securite, RBAC, garde-fous metier
  installation.md           # Env vars, services, commandes, dependances externes
  features/                 # Une spec par feature majeure
  specs/                    # ADR : decisions de design (capture du *pourquoi*)
  plans/                    # Plans d'implementation avec tracker de progression en tete
  api/                      # (optionnel) Reference API
  guide-utilisateur/        # (optionnel) Documentation utilisateur final
```

Les details exacts par version sont indiques dans son propre `README.md`.

## Contenu actuel de la v4

- **Plans** : [`v4/plans/2026-07-17-v4-refonte-globale.md`](v4/plans/2026-07-17-v4-refonte-globale.md)
  — plan unique couvrant les 7 chantiers v4 (HTTPS local, separation des
  espaces, deconnexion, roles a la creation, stockage MinIO/S3, abonnements).
- **Specs** : [`v4/specs/2026-05-31-v4-stockage-s3-et-backups.md`](v4/specs/2026-05-31-v4-stockage-s3-et-backups.md)
  — ADR stockage S3/MinIO + backups (migree depuis l'ancienne spec v3-01).
