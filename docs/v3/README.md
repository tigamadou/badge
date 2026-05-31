# Documentation - Badge v3

> **Statut : en conception**
>
> v3 est une **extension de la v2**, pas une refonte. Elle regroupe les
> fonctionnalités secondaires non essentielles au MVP v2 et reportées dans
> une version ultérieure pour ne pas alourdir la livraison initiale.

## Vue d'ensemble

La v3 ne change ni le modèle métier ni l'architecture applicative
multi-organisation introduite en v2. Elle ajoute trois chantiers transverses :
qualité (tests + CI), infrastructure (stockage objet centralisé), et
déploiement zero-downtime.

| Chantier | Description |
|---|---|
| **Politique de tests et CI** | Trois couches de tests obligatoires (unitaires Vitest, intégration API Vitest + vraie MySQL, E2E Playwright) + workflow GitHub Actions 4 jobs parallèles bloquants |
| **Stockage S3 (MinIO)** | Migration de `uploads/` vers un bucket S3-compatible avec préfixes multi-tenants, plus pipeline de backups hebdomadaires chiffrés |
| **Déploiement Kamal** | Bascule du `docker-compose + Caddy` vers `kamal-proxy`, déploiement zero-downtime via swap atomique, accessoires (mysql/minio/phpmyadmin) gérés par Kamal |

## Pourquoi v3 et pas v2 ?

Au démarrage v2, ces trois chantiers étaient prévus dans la même livraison
(v2-08 stockage, v2-09 Kamal, v2-10 tests/CI). À la revue de scope, ils ont
été repoussés en v3 :

- Ils ne **bloquent pas** la livraison fonctionnelle v2 (la prod peut tourner
  avec stockage disque local, déploiement `make deploy` actuel, et tests
  manuels).
- Ils introduisent chacun une **dépendance infra non triviale** (S3, Kamal,
  GitHub Actions) qui mérite son propre cycle de validation, indépendant du
  rush MVP v2.
- Une fois la v2 stabilisée en prod, ces trois chantiers peuvent être
  appliqués séquentiellement avec un risque maîtrisé.

L'ordre d'exécution recommandé est : **v3-01 (stockage) → v3-02 (déploiement)
→ v3-03 (tests/CI)** — chacune est conçue pour fonctionner indépendamment,
mais l'ordre minimise les patches croisés (v3-02 intègre les scripts backup
de v3-01, v3-03 valide les workflows déployés par v3-02).

## Documentation

### Sous-spécifications

| # | Sous-spec | Description |
|---|---|---|
| 1 | [Stockage S3 (MinIO) + backups hebdomadaires](specs/2026-05-31-v3-01-stockage-s3-et-backups.md) | Migration `uploads/` → MinIO, préfixes multi-tenants, backups chiffrés, rotation, restauration |
| 2 | [Déploiement Kamal (Phase 1 local)](specs/2026-05-31-v3-02-deploiement-kamal.md) | Bascule docker-compose → Kamal, zero-downtime, kamal-proxy, accessoires |
| 3 | [Politique de tests et CI GitHub Actions](specs/2026-05-31-v3-03-tests-et-ci.md) | 3 couches Vitest/Playwright, CI 4 jobs parallèles, branch protection |

### Plans d'implémentation

Un plan par sous-spec, dans `docs/v3/plans/` (tracker de progression en tête) :

| # | Plan | Tasks |
|---|---|---|
| 1 | [Stockage S3 et backups](plans/2026-05-31-v3-01-stockage-s3-et-backups.md) | -- |
| 2 | [Déploiement Kamal (Phase 1 local)](plans/2026-05-31-v3-02-deploiement-kamal.md) | 18 |
| 3 | [Politique de tests et CI](plans/2026-05-31-v3-03-tests-et-ci.md) | 12 |

## Relation avec la v2

- **Schéma Prisma** : v3 ne modifie pas le schéma. Il reste celui défini en
  v2 (cf [`docs/v2/specs/2026-05-28-v2-master-design.md`](../v2/specs/2026-05-28-v2-master-design.md)).
- **Architecture applicative** : inchangée. v3 touche uniquement
  l'infrastructure (stockage, déploiement, CI).
- **RBAC, multi-tenancy, flux métier** : tout est défini en v2 et reste
  valide en v3.
- **Dépendance d'exécution** : v3 suppose que les chantiers v2 (notamment
  v2-01 multi-tenancy, v2-04 espace événement) sont implémentés ou en cours.

## Convention de versionnement

v3 hérite de la convention multi-versions définie dans
[`docs/README.md`](../README.md). Conséquences pratiques :

- La doc v3 vit dans son propre dossier (`docs/v3/`).
- Les références à des fichiers v2 restent valides (architecture, modèles
  métier) — voir les chemins relatifs `../v2/...` dans les specs v3.
- Tant que v2 n'est pas en production, v3 reste en conception. Une fois v2
  livrée, v3 peut entrer en implémentation.

## État d'avancement

- [x] Spec v3-01 (stockage S3) — validée 2026-05-31
- [x] Spec v3-02 (déploiement Kamal) — validée 2026-05-31
- [x] Spec v3-03 (tests + CI) — validée 2026-05-31
- [x] Plan v3-01 — rédigé 2026-05-31
- [x] Plan v3-02 — rédigé 2026-05-31
- [x] Plan v3-03 — rédigé 2026-05-31
- [ ] Implémentation
- [ ] Smoke tests
- [ ] Mise en production

## Voir aussi

- [Documentation v2](../v2/README.md) — version active de conception (multi-tenant)
- [Documentation v1](../v1/README.md) — version actuellement déployée
- [Index racine](../README.md) — sélection de version
- [Instructions IA](../../CLAUDE.md) — méthode de travail pour les agents
