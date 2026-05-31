# Documentation - Badge

Cette documentation est versionnee. Chaque version majeure de l'application a
sa propre documentation autonome.

## Versions disponibles

| Version | Statut | Documentation |
|---------|--------|---------------|
| **v1** | Production | [docs/v1/](v1/README.md) |
| **v2** | En construction | [docs/v2/](v2/README.md) |
| **v3** | En conception (extension v2) | [docs/v3/](v3/README.md) |

## Quelle version consulter ?

- **Vous utilisez l'application actuellement deployee** : consultez la
  [documentation v1](v1/README.md).
- **Vous travaillez sur la prochaine version** : consultez la
  [documentation v2](v2/README.md) (en cours de redaction).
- **Vous travaillez sur les chantiers post-MVP** (tests/CI, stockage S3,
  deploiement Kamal) : consultez la [documentation v3](v3/README.md). v3
  est une extension de v2 et suppose v2 implementee.

Si vous etes un outil IA et que la version n'est pas explicite dans la demande
de l'utilisateur, **demandez avant de coder**. Ne supposez jamais la version
active.

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

## Regles multi-versions

Ces regles s'appliquent a toute personne (humaine ou agent IA) qui touche la
documentation :

- Une PR ne touche jamais simultanement plusieurs versions de doc sans
  validation explicite de l'utilisateur. La doc d'une version evolue dans son
  propre changement.
- Avant de creer ou modifier une feature, verifier si elle existe deja dans
  une autre version, pour eviter les divergences non intentionnelles entre
  versions.
- Si une feature est reprise ou refondue dans une nouvelle version, la lier
  explicitement a la version precedente dans la nouvelle spec (mention
  "evolution de [spec v(N-1)](../vN-1/features/<nom>.md)").
- Lors de la creation d'une nouvelle version `vX`, suivre la meme structure
  de dossier que la derniere version stable (`README.md`, `architecture.md`,
  `installation.md`, `features/`, `api/`, `guide-utilisateur/`).
- Le schema Prisma (`prisma/schema.prisma`) est **partage** entre versions.
  Il evolue avec la version en construction et reste retrocompatible avec
  la version en production tant que celle-ci est deployee.

## Structure attendue d'une version

Chaque version contient au minimum :

```
docs/<version>/
  README.md                 # Index, vue d'ensemble, etat d'avancement
  architecture.md           # Stack, structure du projet, securite, RBAC, garde-fous metier
  base-de-donnees.md        # (optionnel) Modele de donnees detaille
  installation.md           # (ou equivalent) Env vars, services, commandes, dependances externes
  features/                 # Une spec par feature majeure
  specs/                    # ADR : decisions de design (capture du *pourquoi*)
  plans/                    # Plans d'implementation avec tracker de progression en tete
  api/                      # (optionnel) Reference API
  guide-utilisateur/        # (optionnel) Documentation utilisateur final
```

Les details exacts par version sont indiques dans son propre `README.md`.
