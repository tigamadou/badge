# Spec v4 — Bascule des templates livrés et retrait du registre code

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : migration + suppression d'un sous-système
> **Périmètre** : v4
> **Dépend de** : [`…-10-…format-et-moteur…`](2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md) et [`…-11-…catalogue-et-installation…`](2026-08-11-11-v4-catalogue-et-installation-de-templates.md)
> **Troisième de trois specs** : [10] format et moteur → [11] catalogue et installation → **[12] bascule et retrait**

## Contexte et objectifs

À l'issue des specs 10 et 11, deux mécanismes coexistent : les templates livrés rendent
par leur code React, les templates installés par le moteur déclaratif. Cette spec
supprime la dualité. `default-v1` et `recto-verso-v1` deviennent des templates
installés comme les autres, le registre `BADGE_TEMPLATES` disparaît, et il ne reste
qu'un seul chemin de rendu.

C'est la seule des trois specs qui **retire** quelque chose, donc la seule qui peut
casser des badges existants. Elle est délibérément placée en dernier : la spec 10 a
déjà démontré, par comparaison d'arbres de rendu, que le moteur reproduit exactement
les deux templates historiques. Cette spec consomme cette preuve, elle ne la refait pas.

**Condition d'entrée** : les tests de fidélité de la spec 10 passent. Si ce n'est pas
le cas, ce document ne doit pas être engagé.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Devenir des deux templates livrés | Convertis en paquets JSON, **installés par le seed** | Arbitrage utilisateur du 2026-08-11 : tout devient installable, sans exception. |
| Garantie d'un défaut | Le seed installe la famille `default` et **fait pointer `PlatformSettings` dessus** | Aujourd'hui, `PlatformSettings.badgeTemplateId` est `NOT NULL @default("default-v1")` précisément pour garantir que la cascade renvoie toujours un id. Si tout vit en base, une base vide signifierait plus aucun badge imprimable : la garantie doit se déplacer du défaut de colonne vers le seed. |
| Références existantes | Migrées par script : `"default-v1"` et `"recto-verso-v1"` deviennent les cuid correspondants | Sans cela, tout événement déjà configuré retomberait sur le défaut, c'est-à-dire changerait d'aspect — exactement ce qu'on veut éviter. |
| Registre code | `BADGE_TEMPLATES`, `getTemplate`, `listTemplates`, `DEFAULT_TEMPLATE_ID` **supprimés** | Une seule représentation. Les consommateurs sont déjà passés par `resolveTemplate` en spec 11, donc la suppression ne les touche pas. |
| Repli ultime | `resolveTemplate` retombe sur la **version courante de la famille `default`** | Le repli ne peut plus viser une constante de code. Il vise une famille dont le seed garantit l'existence. |
| Paquets de référence | Versionnés dans le dépôt sous `prisma/badge-templates/<famille>/`, en **arborescence** et non en archive | Le seed doit pouvoir réinstaller à l'identique sur une base neuve, en dev comme en CI. Une arborescence se relit et se compare en revue, là où un binaire ZIP versionné serait opaque. Les deux familles historiques n'embarquant aucune ressource, chaque dossier ne contient qu'un `manifest.json`. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Conserver le registre code en repli de secours | Non retenue | Maintiendrait deux chemins de rendu et deux formats à faire évoluer, ce que cette spec vise justement à supprimer. |
| Laisser les références pointer sur les anciens ids texte | Non retenue | Imposerait de conserver une table de correspondance indéfiniment, et donc une forme de registre déguisé. |
| Recréer les templates de base à chaque `db-seed` | Non retenue | Créerait une nouvelle version à chaque exécution, faisant diverger les environnements. Le seed est **idempotent** : il n'installe que si la famille est absente. |

## Architecture cible

### Paquets de référence

`prisma/badge-templates/default/manifest.json` et
`prisma/badge-templates/recto-verso/manifest.json` : les mêmes manifestes que les
fixtures de fidélité de la spec 10, promus au rang de données de seed. Un test vérifie
qu'ils sont identiques aux fixtures, pour qu'ils ne puissent pas diverger silencieusement.

Le seed passe par le **même chemin de code que l'installation** (validation du manifeste,
rendu d'épreuve, génération de l'aperçu), en court-circuitant seulement l'ouverture
d'archive puisque les fichiers sont déjà sur disque. Un template de base n'est donc pas
un cas particulier : il subit exactement les mêmes vérifications qu'un paquet téléversé.

### Seed

`prisma/seed.ts` installe chaque paquet **si et seulement si** sa famille n'existe pas
encore, puis fait pointer `PlatformSettings.badgeTemplateId` sur la version courante de
`default` si le champ ne désigne aucune ligne existante. Idempotent : une seconde
exécution ne crée pas de version supplémentaire.

C'est ce qui déplace la garantie « la cascade renvoie toujours un template valide » du
défaut de colonne vers le seed. Le `@default("default-v1")` du schéma est retiré, son
commentaire mis à jour pour dire où vit désormais la garantie.

### Migration des références

Un script `scripts/migrate-badge-template-refs.ts`, exécuté une fois :

1. installe les paquets de référence s'ils sont absents ;
2. remplace `"default-v1"` par le cuid de la version courante de `default`, et
   `"recto-verso-v1"` par celui de `recto-verso`, dans les trois colonnes
   `Event.badgeTemplateId`, `Organization.badgeTemplateId`,
   `PlatformSettings.badgeTemplateId` ;
3. journalise le nombre de lignes touchées par colonne ;
4. signale toute valeur restante qui ne correspond ni à un cuid connu ni à un ancien
   id — il ne doit pas y en avoir, et le savoir vaut mieux que le découvrir en
   production.

L'application n'étant pas en production, `make db-push` suivi de `make db-seed`
suffirait sur un environnement neuf ; le script existe pour les bases de développement
déjà peuplées, et parce qu'il documente la correspondance.

### Suppressions

- `src/lib/badge-templates/index.ts`, `default-v1/`, `recto-verso-v1/` ;
- `scripts/validate-badge-templates.ts` et la cible `make validate-badge-templates`
  (`Makefile:334`) : ce script vérifiait qu'aucune ligne ne référence un id orphelin du
  registre. Sans registre, la contrainte est portée par la base elle-même. Il est
  remplacé par une vérification équivalente sur `InstalledBadgeTemplate`, conservée
  sous le même nom de cible pour ne pas casser les habitudes ni la CI.
- `scripts/copy-badge-previews.ts` **et le hook `prebuild` qui l'appelle**
  (`package.json:7`). Son seul objet est de copier les `preview.png` du registre vers
  `public/badge-previews/` : sans dossier de template en dépôt, il n'a plus d'entrée.
  Les aperçus sont désormais générés à l'installation et servis depuis
  `src/lib/storage.ts`, ce qui suppose de vérifier que le `previewSrc` transmis au
  `BadgeTemplatePicker` pointe vers l'URL de stockage et non plus vers
  `/badge-previews/<id>.png`.

Le type TypeScript `BadgeTemplate` (`types.ts`) **reste** : c'est le contrat que
`resolveTemplate` renvoie, désormais toujours construit par
`buildDeclarativeTemplate`.

## Risques et parades

| Risque | Parade |
|---|---|
| Un badge existant change d'aspect | Les tests de fidélité de la spec 10 sont la condition d'entrée ; la migration des références empêche tout basculement silencieux vers le défaut. |
| Base neuve sans template | Le seed installe les paquets de référence et est exécuté par `make db-seed`, déjà obligatoire après `make test` (qui vide la base de dev). Un test d'intégration vérifie qu'après seed, `resolveTemplate` sur la valeur de `PlatformSettings` renvoie un template rendu. |
| Environnement où le seed n'a pas tourné | `resolveTemplate` journalise explicitement l'absence de la famille `default` au lieu d'échouer silencieusement. |
| Divergence entre paquets de seed et fixtures de test | Test d'égalité entre les deux emplacements. |

## Tests

- Seed : deux exécutions successives ne créent pas de version supplémentaire ;
  `PlatformSettings` pointe sur une ligne existante après seed.
- Script de migration : sur une base portant les anciens ids texte, les trois colonnes
  sont converties ; une seconde exécution ne change rien ; une valeur inconnue est
  signalée sans interrompre.
- `resolveTemplate` après retrait : un cuid installé résout ; une valeur inconnue
  retombe sur la version courante de `default` ; l'absence totale de la famille
  `default` est journalisée.
- Non-régression de bout en bout : un événement configuré avant migration produit,
  après migration, un badge dont l'arbre de rendu est identique.
- E2E : impression d'un badge sur un événement issu du seed, sans aucun template
  installé manuellement.

## Documentation impactée

- `docs/v4/features/templates-badges.md` — le registre code n'existe plus ; la
  procédure d'ajout est désormais l'installation d'un paquet.
- `docs/v4/architecture.md` — chemin de rendu unique.
- `docs/v4/installation.md` — le seed installe les templates de base ; mention du
  script de migration.
- `CLAUDE.md` — la ligne « Rendu PDF des badges » des garde-fous métier a déjà été
  réécrite en spec 10 (Montserrat devient la police **par défaut**, un paquet pouvant
  embarquer les siennes). Il reste à vérifier qu'aucune mention du registre code ne
  subsiste dans les sources de vérité.
