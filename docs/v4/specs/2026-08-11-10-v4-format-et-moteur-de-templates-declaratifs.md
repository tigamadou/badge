# Spec v4 — Format de paquet et moteur de templates déclaratifs

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : nouveau sous-système (addition pure, ne modifie aucun comportement existant)
> **Périmètre** : v4
> **Source** : demande utilisateur du 2026-08-11 — installer un template de badge depuis l'espace staff, « comme un thème WordPress »
> **Première de trois specs** : **[10] format et moteur** → [11] catalogue et installation → [12] bascule et retrait du registre code

## Contexte et objectifs

Un template de badge est aujourd'hui du **code React compilé** : un couple
`meta.ts` / `template.tsx` sous `src/lib/badge-templates/<id>/`, référencé dans le
registre statique `BADGE_TEMPLATES` (`index.ts:13`). Deux templates sont livrés,
`default-v1` et `recto-verso-v1`. Ajouter un modèle impose de modifier le dépôt et de
redéployer.

L'objectif d'ensemble est de faire d'un template un **paquet installable**, sur le
modèle d'un thème : une archive que le staff téléverse, qui embarque sa mise en page et
ses ressources visuelles. Cette première spec ne livre que le socle : le **format du
paquet** et le **moteur de rendu** qui le transforme en badge. Elle n'ajoute aucune
table, ne modifie aucune route, ne retire rien.

À la fin de cette spec, l'application se comporte exactement comme avant ; ce qui change,
c'est qu'on dispose d'un moteur prouvé fidèle, sur lequel les specs 11 et 12 s'appuieront
sans risque. Ce séquencement est délibéré : la spec 12 retire le registre code, et il
serait imprudent de retirer le filet avant d'avoir démontré que le moteur reproduit les
badges existants.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Nature du paquet | **Archive ZIP** : un manifeste JSON et des ressources. Jamais de JavaScript | Un paquet contenant du code serait de l'exécution arbitraire côté serveur : contrainte non négociable. Les ressources permettent des badges réellement distincts, ce qu'un manifeste nu ne permet pas. Arbitrage du 2026-08-11. |
| Modèle de mise en page | **Blocs positionnés en absolu**, coordonnées en millimètres | Validable par schéma, prévisualisable, et directement manipulable par un futur éditeur visuel. |
| Conditions d'affichage | Chaque bloc porte un `visibleIf` optionnel | Sans cela, impossible de reproduire les badges **anonyme** et **neutre**, règles métier existantes (`default-v1:96-97`, `recto-verso-v1:128-129`). |
| Débordement du texte | Politique explicite par bloc : `shrink`, `truncate` ou `clip` | Le rendu actuel s'appuie sur flexbox (`justifyContent: space-between`, `flex: 1`) pour absorber un nom long. En absolu, il faut le déclarer. |
| Images embarquées | **JPEG et PNG uniquement** | `@react-pdf/image` (lignes 188-190) ne reconnaît que ces deux formats. Le garde-fou projet autorise WebP pour les uploads utilisateur, mais un WebP dans un badge produirait un rendu cassé : la restriction est technique, pas arbitraire. |
| Polices embarquées | **Autorisées**, TTF et OTF, déclarées dans le manifeste | Arbitrage du 2026-08-11. Révise le garde-fou « Montserrat via Google Fonts » du `CLAUDE.md`, qui devient le **défaut** et non plus l'unique possibilité. |
| Espace de noms des polices | La famille enregistrée est préfixée par le template | `Font.register` est global au process et indexé par nom de famille (`fonts.ts:7`) : sans préfixe, deux paquets déclarant « Helvetica » s'écraseraient mutuellement. |
| Fidélité attendue | **Rendu identique** aux templates actuels | Arbitrage du 2026-08-11 : aucun badge déjà en circulation ne doit changer d'aspect. |
| Contrat de données | `TemplateContext` **inchangé** | `build-context.ts` reste l'unique producteur du contexte. Le moteur n'invente aucune donnée. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Manifeste JSON nu, sans ressource | Non retenue | Écartée le 2026-08-11 au profit de l'archive : sans image de fond ni police, deux badges ne peuvent guère se distinguer que par leurs couleurs. |
| Arbre de conteneurs flexbox dans le manifeste | Non retenue | Plus expressif, mais validation, messages d'erreur et futur éditeur nettement plus complexes. Le besoin réel est couvert par l'absolu plus les conditions et la politique de débordement. |
| HTML/CSS rendu par un navigateur headless | Non retenue | `@react-pdf/renderer` ne comprend ni HTML ni CSS ; basculer signifierait remplacer toute la chaîne PDF et embarquer un Chromium en production. |
| Refonte visuelle assumée des deux badges | Non retenue | Écartée explicitement le 2026-08-11 au profit d'un rendu identique. |
| Polices choisies dans une liste fournie par l'application | Non retenue | Écartée le 2026-08-11 : limiterait la liberté typographique que l'analogie du thème suppose. |

## Architecture cible

Un nouveau dossier `src/lib/badge-templates/declarative/`, **sans dépendance à Prisma
ni au réseau**. Cinq unités, chacune testable seule :

| Fichier | Responsabilité |
|---|---|
| `schema.ts` | Schéma Zod du manifeste. Seul endroit décrivant ce qu'un manifeste valide contient. Exporte `parseManifest(input)` et le type `TemplateManifest`. |
| `resolve-source.ts` | Traduit un chemin de source (`participant.firstName`) en valeur depuis un `TemplateContext`. Liste blanche stricte : un chemin inconnu est une erreur de validation, pas un `undefined` silencieux. |
| `conditions.ts` | Évalue le `visibleIf` d'un bloc contre le contexte. |
| `fonts.ts` | Enregistre les polices d'un paquet sous un nom de famille préfixé, et expose la correspondance manifeste → famille réelle. |
| `renderer.tsx` | Traduit manifeste + contexte + résolveur de ressources en arbre `@react-pdf`. Fonction pure. |

Porte d'entrée unique, de la même forme que ce que le registre fournit déjà, afin que
les consommateurs ne voient pas la différence en spec 12 :

```ts
export function buildDeclarativeTemplate(
  manifest: TemplateManifest,
  assets: AssetResolver,
): BadgeTemplate;
```

`AssetResolver` est une simple fonction `(name: string) => string` qui rend le chemin
ou la data URL d'une ressource. **C'est elle qui garde le moteur pur** : le moteur ne
sait ni lire un ZIP, ni interroger `src/lib/storage.ts`. La spec 11 lui injectera un
résolveur adossé au stockage ; les tests lui injectent des chemins de fixtures.

### Structure de l'archive

```
mon-badge.zip
├── manifest.json          (obligatoire, à la racine)
├── assets/
│   ├── fond.png
│   └── filigrane.jpg
└── fonts/
    └── Inter-Bold.ttf
```

Trois emplacements et rien d'autre : un manifeste à la racine, `assets/` pour les
images, `fonts/` pour les polices. Toute autre entrée fait échouer la validation — une
archive dont on ignore silencieusement le contenu est une archive dont on ne maîtrise
pas le comportement.

### Manifeste

```json
{
  "formatVersion": 1,
  "family": "salon-2027",
  "label": "Badge Salon 2027",
  "description": "Badge recto-verso avec fond personnalisé.",
  "page": { "widthMm": 85.6, "heightMm": 54, "count": 1 },
  "fonts": [
    { "alias": "titre", "file": "fonts/Inter-Bold.ttf", "weight": 700 }
  ],
  "blocks": [
    { "type": "image", "page": 1, "x": 0, "y": 0, "w": 85.6, "h": 54,
      "asset": "assets/fond.png" },
    { "type": "rect", "page": 1, "x": 0, "y": 46, "w": 85.6, "h": 8,
      "fill": "category.color" },
    { "type": "image", "page": 1, "x": 4, "y": 6, "w": 28, "h": 34,
      "source": "participant.photoDataUrl", "radiusMm": 1,
      "visibleIf": { "path": "category.anonymous", "equals": false } },
    { "type": "text", "page": 1, "x": 36, "y": 8, "w": 46, "h": 7,
      "text": "{participant.firstName} {participant.lastName}",
      "style": { "font": "titre", "sizePt": 12, "align": "left",
                 "color": "#0f172a", "overflow": "shrink", "minSizePt": 8 },
      "visibleIf": { "path": "category.anonymous", "equals": false } },
    { "type": "qr", "page": 1, "x": 62, "y": 30, "w": 18, "h": 18 }
  ]
}
```

**Quatre types de blocs** — `text`, `image`, `qr`, `rect` — qui couvrent exactement ce
que les deux templates actuels dessinent.

> **Révision du 2026-08-11, découverte à l'implémentation.** La première version de ce
> format donnait à un bloc `text` une `source` unique. La lecture ligne à ligne des deux
> templates a montré que c'était insuffisant : ils composent
> `` `${firstName} ${lastName}` ``, `#${badge.id}` et `` `${date}\n${location}` ``. Un
> format incapable d'écrire « Prénom Nom » sur une ligne serait inutilisable, quels que
> soient les templates historiques. Quatre capacités ont donc été ajoutées :
>
> 1. **`text` est un gabarit** : les segments `{chemin}` sont interpolés, le reste est
>    littéral. Un texte purement littéral (« Participant anonyme ») est valide.
> 2. **`visibleIf` accepte une seconde forme**, `{ path, isEmpty }`, qui teste l'absence
>    de valeur — nécessaire au rectangle de remplacement affiché quand le participant n'a
>    pas de photo. La forme `{ path, equals }` reste réservée aux deux chemins booléens.
> 3. **Styles de texte étendus** : `transform` (`uppercase` / `lowercase` / `none`),
>    `letterSpacing`, `lineHeight`.
> 4. **Bordures sur `rect`** : `borderTopPt` et `borderColor`, qui portent la bande de
>    catégorie en mode neutre.
>
> Les conditionnels de couleur (`categoryBg`, `categoryTextColor`) et le texte de
> substitution « Participant anonyme » n'ont **pas** demandé de capacité nouvelle : deux
> blocs superposés portant des `visibleIf` inverses suffisent.

**Un bloc `image` porte soit `source`** (une image venant des données : photo du
participant, logo de l'événement) **soit `asset`** (une ressource du paquet), jamais les
deux. La distinction est explicite dans le schéma : elle évite qu'un nom de fichier soit
confondu avec un chemin de contexte.

**`fill` et `color`** acceptent une couleur hexadécimale littérale ou un chemin de
source de type couleur (`category.color`) — c'est ce qui permet la bande de catégorie
colorée sans conditionnelle.

**`visibleIf`** prend la forme `{ "path": <chemin booléen>, "equals": <bool> }`. Seuls
`category.anonymous` et `category.neutralBadge` sont acceptés : les deux notions métier
existantes. Un format plus général (opérateurs, combinaisons) n'est pas justifié
aujourd'hui et durcirait la validation pour rien.

**`overflow`** vaut `shrink` (réduit la police jusqu'à `minSizePt`), `truncate` (coupe
avec ellipse) ou `clip` (laisse déborder, comportement brut de `@react-pdf`). C'est le
mécanisme qui remplace le `flex` du rendu actuel.

**`fonts[].alias`** est le nom utilisé dans les blocs. Le moteur enregistre la police
sous `tpl-<templateId>-<alias>` pour éviter toute collision entre paquets. Un bloc sans
`font` utilise Montserrat, qui reste la police par défaut.

### Sources autorisées

Liste blanche reprenant le `TemplateContext` existant, sans ajout :
`participant.firstName`, `participant.lastName`, `participant.structure`,
`participant.photoDataUrl`, `category.name`, `category.color`,
`category.neutralBadge`, `category.anonymous`, `event.title`, `event.date`,
`event.location`, `event.logoDataUrl`, `badge.id`, `badge.verifyUrl`,
`badge.qrCodeDataUrl`.

Chaque source porte un **type** (texte, couleur, image, booléen, date) et la validation
refuse un bloc consommant une source de type incompatible : un bloc `image` ne peut pas
pointer sur `participant.firstName`. C'est cette vérification qui évite qu'un manifeste
syntaxiquement valide échoue au rendu.

### Validation du manifeste

`parseManifest` refuse, en une passe et avec un message par erreur :

- un `formatVersion` inconnu ;
- un bloc dont le rectangle sort de la page (`x + w > widthMm`, `y + h > heightMm`) ;
- un bloc dont le `page` dépasse `page.count` ;
- plus de 60 blocs (borne large, elle protège du manifeste dégénéré) ;
- une couleur ni hexadécimale ni source de type couleur ;
- une source hors liste blanche ou de type incompatible ;
- un bloc `image` portant à la fois `source` et `asset`, ou aucun des deux ;
- un `asset` ou un `fonts[].file` ne figurant pas dans l'archive ;
- un `style.font` ne correspondant à aucun `alias` déclaré ;
- un `minSizePt` supérieur au `sizePt`, ou `overflow: "shrink"` sans `minSizePt`.

Le validateur ne fait **aucun** accès réseau ni base : fonction pure, intégralement
testable, et réutilisable côté client par un futur éditeur.

> La validation de l'**archive** elle-même — chemins, bombes de décompression, formats
> et poids des fichiers — relève de la spec 11, qui est le seul endroit où une archive
> est ouverte. La présente spec valide le manifeste et la cohérence de ses références,
> à partir de la liste des entrées qu'on lui fournit.

## Preuve de fidélité

C'est le livrable qui justifie cette spec. Les deux templates actuels sont réécrits en
manifeste, placés dans `src/lib/badge-templates/declarative/__fixtures__/`, et un test
de non-régression compare, pour chaque cas métier, l'arbre React produit par le
composant historique et celui produit par le moteur.

La comparaison porte sur l'arbre React, **pas sur les octets du PDF** : `@react-pdf`
rend de façon déterministe depuis cet arbre, alors que les octets varient (horodatage,
identifiants internes). Comparer l'arbre est donc à la fois plus stable et plus précis
qu'une comparaison d'images.

Quatre contextes au minimum, dérivés des branches réelles du code :

1. participant nominal, catégorie standard ;
2. `category.anonymous = true` ;
3. `category.neutralBadge = true` ;
4. nom et structure anormalement longs, pour valider `overflow`.

Chacun joué sur les deux familles, soit huit comparaisons. Un écart de style calculé ou
de structure fait échouer le test. **Tant que ces tests ne passent pas, la spec 12 ne
doit pas être engagée** — c'est la condition de sortie de ce document.

Ces deux manifestes de référence n'embarquent **aucune ressource** : les templates
actuels n'utilisent ni image de fond ni police autre que Montserrat. Ils valident donc
le cœur du moteur ; le chemin des ressources est validé par ses propres tests avec des
fixtures dédiées.

## Ce que cette spec ne fait pas

- Aucune table Prisma, aucune migration.
- Aucune route API, aucun écran.
- **Aucune ouverture d'archive** : lecture du ZIP, extraction et stockage relèvent de la
  spec 11.
- Le registre `BADGE_TEMPLATES` et `DEFAULT_TEMPLATE_ID` restent en place et inchangés ;
  les templates livrés continuent de rendre par leur code React.

## Tests

Le seuil de couverture du projet est de **100 %** sur `src/lib/**`, ce qui couvre
l'intégralité de ce sous-système.

- `schema.test.ts` : un manifeste valide accepté ; un cas de refus par règle énumérée
  ci-dessus.
- `resolve-source.test.ts` : chaque source de la liste blanche résolue ; chemin inconnu
  et type incompatible refusés.
- `conditions.test.ts` : `visibleIf` absent, vrai, faux, sur les deux chemins admis.
- `fonts.test.ts` : deux paquets déclarant le même alias produisent deux familles
  distinctes ; un bloc sans `font` retombe sur Montserrat.
- `renderer.test.tsx` : un bloc de chaque type ; `image` par `source` et par `asset` ;
  `overflow` dans ses trois modes ; bloc masqué par condition absent de l'arbre ;
  multi-pages ; `AssetResolver` appelé avec le nom déclaré.
- `fidelity.test.tsx` : les huit comparaisons décrites plus haut.

Les composants React ne sont pas couverts par l'unitaire dans ce projet (politique de
tests, section 1), mais le moteur vit dans `src/lib/**` et produit un arbre comparable
sans navigateur : il est testable en Vitest, et il doit l'être.

## Documentation impactée

- Création de `docs/v4/features/templates-badges.md` — la fiche n'existe pas
  aujourd'hui, la procédure d'ajout n'étant documentée que dans le commentaire en tête
  de `src/lib/badge-templates/index.ts`. Elle décrira la structure de l'archive, le
  manifeste, ses règles de validation et la liste des sources.
- `CLAUDE.md`, garde-fous métier : la ligne « Rendu PDF des badges : utilise Montserrat
  via Google Fonts » devient « Montserrat est la police **par défaut** ; un paquet de
  template peut embarquer ses propres polices ». L'accès sortant à `fonts.googleapis.com`
  reste requis.
