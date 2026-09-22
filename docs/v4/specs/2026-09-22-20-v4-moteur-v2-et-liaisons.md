# Spec v4 — Moteur v2 dans l'application badge, et liaisons de variables

> **Statut** : conception validée — 2026-09-22 — **à implémenter**
> **Type** : remplacement du moteur de rendu + extension du modèle d'installation
> **Périmètre** : v4
> **Dépend de** : [`2026-08-14-19-…studio-v3-groupes-formes-interface`](2026-08-14-19-v4-studio-v3-groupes-formes-interface.md)
> **Chantier jumeau** : pdfStudio — sélecteur de page du studio (spec propre, **implémentée en premier**)
> **Source** : demandes utilisateur du 2026-09-22

## Contexte et objectifs

pdfStudio est né en extraction de ce projet (specs 16, 18, 19) et embarque une **copie**
du moteur déclaratif. Cette copie a depuis divergé : le studio a livré le **format v2**,
où un manifeste **déclare ses propres variables** au lieu de puiser dans une liste blanche
de sources câblées dans le moteur. Le moteur du studio ne connaît plus le mot
« participant » ; celui de l'application, resté en v1, ne connaît que lui.

**Objectif : un template conçu dans le studio doit être installable et utilisable
directement dans l'application badge.** Ce qui suppose un moteur identique des deux côtés,
et un moyen — propre à l'application — de dire quelle donnée métier alimente quelle
variable déclarée.

### L'écart, en une table

| | `src/lib/badge-templates` (v1, actuel) | `pdfStudio/src/engine` (v2, cible) |
|---|---|---|
| Vocabulaire | liste blanche `SOURCES` câblée dans le moteur | variables **déclarées par le manifeste**, noms libres |
| Contrat de rendu | `Component({ ctx: TemplateContext })` | `Component({ values: VariableValues })` |
| Conditions | `visibleIf` sur 2 chemins métier (`category.anonymous`, `category.neutralBadge`) | conditions **nommées**, `equals` / `isEmpty` sur toute variable |
| Dates | `formatFrenchDate` unique, appliquée par le moteur | 5 formats, `format` porté par la variable, calendaire en UTC |
| Absent ici | — | `variables.ts`, `format-date.ts`, presets, `DocumentTemplate` |
| Absent là-bas | `sources.ts`, `resolve-source.ts`, `sample-context.ts` | — |

Structurellement, rien ne s'oppose déjà à l'objectif : `family`, `preview` et
`package-reader.ts` sont **identiques** des deux côtés, donc un `.zip` sorti du studio
entre dans `readTemplatePackage` sans retouche.

## Décisions tranchées

### Raccordement des données au vocabulaire du template

| Sujet | Décision | Pourquoi |
|---|---|---|
| Où vit la liaison | Une **table de liaison stockée en base**, par template installé : `bindings Json @default("{}")` sur `InstalledBadgeTemplate`. `Bindings = Record<string, string \| null>` — nom de variable → chemin de source, `null` = « laisser vide ». | Arbitrage utilisateur du 2026-09-22. Les noms de variables restent libres côté studio, et l'application n'a pas à imposer son vocabulaire à un outil qui vient justement de s'en affranchir (commit `38105f1`). |
| Qui connaît les sources | `SOURCE_KINDS` (les 15 sources et leur `VariableKind`) **remonte** de `declarative/sources.ts` vers `src/lib/badge-templates/bindings.ts`. | Le moteur cesse de connaître le domaine badge ; l'application le connaît toujours, mais depuis l'extérieur du dossier copié. |
| Règle de validité | `validateBindings(variables, bindings)` rend la liste des erreurs : variable **non décidée** (clé absente), source inconnue, **type incompatible**. `null` est un choix, pas une omission. | Une variable `image` liée à `participant.firstName` doit être refusée : c'est la garde que portait le `kind` de l'ancien `SOURCES`, déplacée d'un cran. Une seule fonction sert l'installation, la migration et le contrôle défensif. |
| Moment de la liaison | **Écran de liaison au téléversement**, pré-rempli, avant toute écriture. L'installation est refusée tant qu'une variable n'est ni liée ni marquée « laisser vide ». | Arbitrage utilisateur du 2026-09-22. Une variable oubliée s'imprime vide sur un badge : l'oubli doit être impossible, pas rattrapable. |
| Pré-remplissage | `suggestBindings` propose l'**identité** quand le nom de la variable est exactement une source connue **et** que les types s'accordent. Aucune heuristique sur les noms proches. | Une suggestion fausse validée d'un clic est pire qu'une case vide. L'heuristique s'ajoutera si l'usage la réclame. |
| `CONDITION_PATHS` | **Supprimé sans remplacement.** | En v2 une condition porte sur n'importe quelle variable booléenne déclarée : la restriction aux deux notions métier n'a plus de lieu où s'exprimer. |

### Dates

| Sujet | Décision | Pourquoi |
|---|---|---|
| Qui formate | **Le template.** `buildValues` passe la date **brute en ISO** ; le `format` déclaré par la variable est appliqué par `resolveVariable`. | Arbitrage utilisateur du 2026-09-22. |
| Invariant e-mail | **Abandonné**, explicitement. `formatFrenchDate` quitte la chaîne du badge et reste intacte pour les e-mails. | Un badge est une pièce graphique composée dans le studio, un e-mail est une phrase. Les aligner coûtait plus qu'il ne rapportait — et privait le format v2 de ses cinq formats de date. |
| Fuseau | Le `long` du v2 reproduit `formatFrenchDate` **avec `timeZone: "UTC"` en plus**. | Une date d'événement est **calendaire**, pas un instant : le 15 décembre reste le 15 décembre. Le v1 lisait le fuseau du serveur et imprimait la veille à l'ouest de l'UTC. Correction assumée, pas régression. |

**Réserve à connaître pour la recette** : un template migré rend donc sa date à l'identique
du v1 **sauf** si le serveur tourne à l'ouest de l'UTC, auquel cas la date avance d'un jour —
vers la bonne valeur. `formatFrenchDate` gardant le fuseau local pour les e-mails, badge et
e-mail peuvent diverger d'un jour dans cette configuration : c'est la contrepartie directe de
l'invariant abandonné ci-dessus.

### Templates déjà installés

| Sujet | Décision | Pourquoi |
|---|---|---|
| Sort des lignes v1 | **Migration en base, moteur unique.** Aucune cohabitation de deux renderers. | Arbitrage utilisateur du 2026-09-22. Deux moteurs, deux schémas et deux jeux de tests à maintenir, avec dérive garantie du plus ancien. |
| Outil de migration | `migrateManifest` de `pdfStudio/src/server/migrate-v1.ts` **se porte tel quel** dans `src/lib/badge-templates/migrate-v1.ts` — **hors** du dossier `engine/`. | Il fait déjà tout le travail (15 variables et leurs samples, 4 presets, `visibleIf.path` → `visibleIf.variable`, bloc `qr` → `rect` portant l'image). Il contient du vocabulaire badge : il vit donc côté application, comme il vit côté `server/` dans le studio. |
| Blocs texte | **Rien à migrer.** `TextBlock.text` et la syntaxe `{participant.firstName}` sont identiques d'un format à l'autre. | Le motif v2 (`/\{([a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*)\}/g`) accepte les noms pointés v1 ; il admet en plus les noms plats. |
| Table de liaison des migrés | **L'identité**, sans intervention humaine : les variables produites portent exactement le nom des sources v1. | C'est ce qui rend la migration automatisable de bout en bout. |
| Templates archivés | Migrés eux aussi. | Un template archivé reste résolvable : c'est ce qui fige les badges des événements déjà configurés. |

### Circulation du code entre les deux dépôts

| Sujet | Décision | Pourquoi |
|---|---|---|
| Forme | **Copie + garde-fou de divergence**, pas de paquet partagé. `pdfStudio/src/engine/**` → `src/lib/badge-templates/engine/**`, tests compris. | Arbitrage utilisateur du 2026-09-22. Migrer le format et extraire un paquet en même temps double le risque sans rien accélérer. L'extraction reste possible ensuite, sur un moteur déjà identique des deux côtés. |
| Frontière | **Rien dans `engine/` ne connaît le badge ; rien hors de `engine/` n'est copié.** Vérifié : le moteur du studio n'importe aucun module hors de `src/engine/` — seulement `@react-pdf/renderer`, `zod`, `jszip`, `qrcode`, `node:zlib`, `react`. | Une frontière qui se lit à l'œil nu rend le test de parité possible **sans liste d'exclusions**. |
| Doublon assumé | `engine/qrcode.ts` duplique `src/lib/qrcode.ts` (dix lignes identiques) ; `build-context.ts` continue d'utiliser `@/lib/qrcode`. | Sortir le fichier du dossier scellé coûterait une exception dans le garde-fou, pour dix lignes. |
| Couverture | `src/lib/badge-templates/engine/**` ajouté aux `coverage.exclude`. Tout le code badge reste à **100 %**. | Le dossier est scellé : personne ne peut y ajouter la ligne de test manquante sans faire échouer le test de parité. Un seuil y serait ingérable. Les tests portés tournent et gardent leur valeur de non-régression ; ils ne comptent simplement pas dans le seuil. |

### Alternatives écartées

| Alternative | Raison |
|---|---|
| Noms de variables réservés par convention (`participant.firstName` imposé au studio) | Recouple le studio au vocabulaire badge, et une faute de frappe donne un champ vide silencieux. |
| Champ `source` dans `VariableDeclaration` | Même recouplage, au niveau du format cette fois : le studio devrait connaître les sources badge. |
| `bindings.json` écrit par le studio dans le `.zip` | Même objection. Les paquets **livrés avec l'application** en portent un, parce que c'est ce dépôt-ci qui l'écrit, pour ses propres paquets. |
| Cohabitation des moteurs v1 et v2, aiguillée par `formatVersion` | Deux renderers à maintenir ; le v1 dérive doucement. |
| Réinstallation manuelle des templates v1 | Les badges des événements passés cesseraient d'être rendables. |
| Paquet npm partagé dès maintenant | Chaîne de publication et aller-retour de release à chaque correctif, pendant la migration. À reconsidérer une fois les deux moteurs identiques. |
| Route unique répondant 409 pour réclamer la table de liaison | Un code d'erreur comme mécanisme nominal. `/inspect` est franchement en lecture seule. |
| 100 % de couverture jusque dans `engine/` | Supposerait de remonter d'abord ces tests dans pdfStudio : faisable, mais allonge le chantier sans servir l'objectif. |

## Architecture cible

```
src/lib/badge-templates/
├── engine/                   ← COPIE de pdfStudio/src/engine/, tests compris, scellée
│   ├── declarative/          ·  schema, renderer, variables, conditions,
│   │                         ·  text-template, manifest-types, fonts, index
│   ├── format-date.ts  fonts.ts  package-reader.ts  px.ts
│   ├── qrcode.ts  render-proof.tsx  types.ts
│   ├── __tests__/
│   ├── ENGINE.sha256         ← empreintes, régénérées par sync-engine
│   └── SOURCE.md             ← commit pdfStudio d'origine, date
│                             ·  ces deux fichiers sont exclus du calcul d'empreinte
│                             ·  et ne sont pas copiés depuis le studio
│
├── bindings.ts        ← NOUVEAU  SOURCE_KINDS, Bindings, validateBindings, suggestBindings
├── build-values.ts    ← NOUVEAU  TemplateContext + bindings → VariableValues
├── migrate-v1.ts      ← PORTÉ    migrateManifest (vocabulaire v1 figé)
├── build-context.ts   ← inchangé  produit TemplateContext depuis un Registration
├── install.ts         ← modifié   exige et stocke la table de liaison
├── resolve.ts         ← modifié   Component({ values })
└── types.ts           ← TemplateContext reste ici
```

**Supprimés** : `declarative/sources.ts`, `declarative/resolve-source.ts`,
`declarative/sample-context.ts` et leurs tests ; les doublons restés à la racine
(`fonts.ts`, `package-reader.ts`, `px.ts`, `render-proof.tsx`) au profit de `engine/`.

## Flux de données

```
Registration (Prisma)
   └─ buildTemplateContext()          inchangé
        └─ TemplateContext            { participant, category, event, badge }
             └─ buildValues(ctx, manifest.variables, bindings)   ← NOUVEAU
                  └─ VariableValues   { "prenom": "Awa", "estAnonyme": false, … }
                       └─ Component({ values })
```

```ts
// build-values.ts — READERS reprend la table de resolve-source.ts, mais lit BRUT :
// event.date sort en Date, plus aucun formatage ici.
const READERS: Record<string, (c: TemplateContext) => string | boolean | Date> = { … };

export function buildValues(ctx, variables, bindings): VariableValues {
  const values: VariableValues = {};
  for (const v of variables) {
    const source = bindings[v.name];
    if (!source) continue;              // « laisser vide » : on n'écrit rien
    const raw = READERS[source](ctx);
    values[v.name] = raw instanceof Date ? raw.toISOString() : raw;
  }
  return values;
}
```

Une variable non liée n'est **pas écrite** : `resolveVariable` renvoie alors son vide,
`isEmpty` se déclenche, et les blocs de repli (le rectangle gris quand il n'y a pas de
photo) fonctionnent sans une ligne de code supplémentaire.

L'épreuve PDF produite à l'installation ignore les liaisons : `samplesOf(manifest.variables,
assets)`, comme dans le studio. **Une épreuve montre le template, pas un participant.**

## Surface applicative

### Installation en deux temps

```
POST /api/platform/badge-templates/inspect     ← NOUVEAU, lecture seule, n'écrit rien
  archive → readTemplatePackage + parseManifest
  ← { variables: [...], suggested: {...}, sources: SOURCE_KINDS }

POST /api/platform/badge-templates             ← modifiée
  archive + bindings (JSON)
  → validateBindings() ; erreurs ⇒ 400 avec la liste complète
  → installTemplate({ manifest, assets, bindings, installedById })
```

L'archive transite deux fois — le client garde son `File` en mémoire, et
`MAX_ARCHIVE_BYTES` borne déjà la chose.

`BadgeTemplateInstaller.tsx` devient un composant à deux écrans : le sélecteur de
fichier, puis le tableau de liaison — nom, libellé, type, sélecteur **filtré par type
compatible**. Trois états par ligne : non décidé (bouton grisé), « laisser vide »
(`null`), ou une source.

### Paquets livrés avec l'application

`installTemplate` sert aussi le seed via `ensureReferenceTemplates`, qui n'a pas d'admin
devant lui. Les paquets livrés portent donc leur table en dépôt :

```
prisma/badge-templates/<family>/
  manifest.json      ← migré en v2, commité
  bindings.json      ← NOUVEAU, lu par readReferencePackage
  assets/
```

**Trois manifestes à migrer en dépôt** : `prisma/badge-templates/default` (13 blocs),
`prisma/badge-templates/recto-verso` (16 blocs), et `badge-templates/ex-305v` (10 blocs) —
ce dernier se reprend directement depuis `pdfStudio/templates/ex-305v`, déjà en v2 et
éprouvé dans le studio.

### Le reste

| Fichier | Changement |
|---|---|
| `badges/[badgeId]/route.tsx` | `<Component ctx={templateCtx} />` → `buildValues(...)` puis `<Component values={values} />` |
| 4 routes `settings/badge` (platform, org, event) | **inchangées** — elles ne manipulent qu'un `templateId` |
| `resolve.ts` | `buildFromRow` lit `row.bindings` ; `validateBindings` au chargement **journalise** les manquants sans jamais lever |
| `scripts/pack-badge-template.ts` | inchangé (ne collecte que `assets/` et `fonts/`) |
| `scripts/migrate-badge-template-refs.ts` | inchangé |
| `scripts/validate-badge-templates.ts` | **étendu** : en plus des `badgeTemplateId` orphelins, signale toute ligne dont la table de liaison est incomplète |
| `scripts/new-badge-template.ts` | **supprimé** avec ses tests ; le README renvoie vers le studio |
| `e2e/platform/badge-templates.spec.ts` | le parcours de téléversement traverse l'écran de liaison |

La suppression de `new-badge-template.ts` acte la répartition qui se dessine depuis
l'extraction : **le studio crée les templates, l'application les installe et les rend.**

## Migration des lignes en base

```
scripts/migrate-installed-templates-v2.ts     (--dry-run par défaut, --apply pour écrire)

  pour chaque ligne formatVersion = 1 :
    1. lister les ressources réelles sous row.assetPrefix (S3)
    2. migrateManifest(row.layout, entries)
    3. parseManifest(résultat)        ← refus ⇒ ligne sautée et rapportée
    4. bindings = identité sur les 15 noms de V1_VARIABLES
    5. validateBindings()             ← garde-fou, vide par construction
    6. UPDATE layout, bindings, formatVersion = 2    une transaction par ligne
```

Idempotent (il ne regarde que `formatVersion = 1`), reprenable ligne par ligne.

**Deux conséquences acceptées :**

1. Les samples d'images (`assets/photo-demo.png`, `logo-demo.png`, `qr-demo.png`) ont été
   ajoutés pour le studio et n'existent pas dans les paquets v1 installés. `migrateManifest`
   le détecte et laisse ces variables sans sample — sans effet sur les badges réels, mais
   une épreuve **regénérée** pour un template migré montrerait des emplacements vides.
   On ne regénère pas : `proofPath` existe déjà et reste.

2. **L'ordre de déploiement n'est pas libre.** Puisqu'il n'y a plus qu'un moteur, une ligne
   encore en v1 n'est plus rendable par le nouveau code. La séquence de release est :
   `prisma migrate deploy` → `migrate-installed-templates-v2 --apply` → **puis seulement**
   bascule du trafic. Les trois dans la même fenêtre, sans service entre les deux.

## Garde-fou de parité

Le dépôt n'a pas pdfStudio sous la main en CI ; le mécanisme se dédouble donc.

```
scripts/sync-engine.ts --from ../pdfStudio      manuel, par un humain
  → copie src/engine/** dans src/lib/badge-templates/engine/**
  → régénère engine/ENGINE.sha256
  → écrit engine/SOURCE.md : commit pdfStudio, date

engine-parity.test.ts                            à chaque CI
  → recalcule les empreintes, compare à ENGINE.sha256
  → échec : « renderer.tsx a été modifié hors sync-engine »
```

Ce que ça garantit, exactement : **le test empêche qu'on édite la copie à la main** — le
mode de divergence qui a joué jusqu'ici. Il ne détecte pas qu'un changement soit resté dans
le studio sans être reporté ; cela, c'est `sync-engine` relancé qui le montre, en laissant
un diff non vide. `SOURCE.md` dit toujours de quel commit la copie provient.

Le README de pdfStudio et celui de ce dépôt décrivent la procédure dans les mêmes termes.

## Tests

| | |
|---|---|
| **Portés** | les `__tests__` du studio viennent avec `engine/` (schéma, renderer, variables, conditions, dates) |
| **Nouveaux** | `bindings` (clé absente, source inconnue, type incompatible) · `build-values` (date en ISO, variable non liée ⇒ vide, booléens) · `install` (refus d'une table incomplète) · les deux routes · `migrate-installed-templates` (v1 → v2 + identité, idempotence) · e2e du parcours de liaison |
| **Adaptés** | `resolve.test.tsx`, `reference-packages.test.ts` (manifeste **et** `bindings.json`) |
| **Supprimés** | `resolve-source.test.ts`, les tests de `new-badge-template` |

## Découpage et point de bascule

```
1. engine/ copié + sync-engine + test de parité        rien ne le consomme encore
2. bindings.ts + build-values.ts (TDD)                 pas encore branchés
3. Prisma : colonne bindings                           additive, déployable seule
4. install.ts + /inspect + écran de liaison + e2e
5. ◆ BASCULE : resolve.ts et la route de rendu passent à values,
     sources.ts / resolve-source.ts / sample-context.ts et les doublons supprimés
6. paquets livrés migrés en v2 + bindings.json, ex-305v repris du studio
7. script de migration des lignes + validate étendu + procédure de release
8. nettoyage : new-badge-template retiré, READMEs des deux dépôts
```

Les étapes 1 à 4 sont additives : elles se commitent et se déploient sans rien casser.
L'étape 5 est le seul moment où l'application change de moteur, et elle est indissociable
des étapes 6-7 dans la même fenêtre de déploiement.

## Hors périmètre

- **Extraction du moteur en paquet partagé.** À reconsidérer une fois les deux copies
  identiques et le garde-fou en place.
- **Sélecteur de page du studio.** Chantier jumeau, spec propre côté pdfStudio,
  **implémenté avant celui-ci**. Il ne touche ni le format ni le moteur : rien de ce qui
  est copié ici n'en sera invalidé.
- **Édition des liaisons après installation.** L'écran de téléversement garantit la
  complétude ; corriger une table existante suppose de réinstaller. À ajouter si l'usage
  le réclame.
- **Heuristique de correspondance de noms** (`prenom` → `participant.firstName`).
- **Régénération des épreuves des templates migrés.**

## Critères d'acceptation

1. `sync-engine --from ../pdfStudio` ne produit aucun diff, et `engine-parity.test.ts` passe.
2. Un `.zip` exporté du studio (v2, variables aux noms libres) se téléverse, présente son
   écran de liaison pré-rempli, et s'installe une fois les liaisons complétées.
3. Un badge rendu depuis un template ainsi installé porte les bonnes valeurs, la date au
   format déclaré par le manifeste, et respecte les conditions nommées.
4. Une variable marquée « laisser vide » s'imprime vide et déclenche les blocs `isEmpty`.
5. L'installation est refusée, avec la liste des erreurs, si une variable n'est pas décidée
   ou si un type ne correspond pas.
6. `migrate-installed-templates-v2 --apply` migre toutes les lignes `formatVersion = 1`,
   est idempotent, et un badge rendu depuis un template migré est **identique** à celui que
   produisait le moteur v1 — à la réserve de fuseau documentée ci-dessous.
7. `npm test` passe, couverture 100 % hors `engine/`, `npm run typecheck` passe.
8. `validate-badge-templates` signale une table de liaison incomplète.
