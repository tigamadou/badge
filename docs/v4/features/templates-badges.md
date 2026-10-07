# Templates de badge

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md`](../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md)
> (format v1 et premier moteur) et dans
> [`../specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md`](../specs/2026-09-22-20-v4-moteur-v2-et-liaisons.md)
> (moteur v2 partagé avec pdfStudio, et liaisons de variables).

## État actuel

**Un template de badge est une donnée, jamais du code.** Il n'existe plus qu'un seul
mécanisme : la table `InstalledBadgeTemplate`, alimentée par téléversement d'une archive
depuis `/platform/badge-templates`, sans déploiement.

Les deux modèles livrés avec l'application — `default` et `recto-verso` — n'ont aucun
statut particulier : leurs manifestes sont versionnés sous
`prisma/badge-templates/<famille>/manifest.json` et **installés par le seed**, en
empruntant exactement le même chemin de code qu'un paquet téléversé (validation, rendu
d'épreuve, génération d'aperçu).

`src/lib/badge-templates/resolve.ts` est la porte d'entrée unique :

| Fonction | Rôle |
|---|---|
| `resolveTemplate(id)` | Rend le template, **quel que soit son état d'archivage**. Repli sur la famille `default` si l'identifiant ne désigne rien, avec journalisation. |
| `templateExists(id)` | Valide une saisie **sans repli** — `resolveTemplate` retombant toujours sur le défaut, il ne peut pas servir à ça. |
| `listAvailableTemplates()` | Ce qui est proposable : la version la plus récente de chaque famille non archivée. |

**La garantie qu'un template par défaut existe est portée par le seed**, plus par le
schéma. `PlatformSettings.badgeTemplateId` vaut `""` par défaut — « aucune racine
définie » — et `resolveTemplate` retombe alors sur la famille `default`. Si celle-ci est
absente, la résolution **échoue bruyamment** en nommant `make db-seed` : une base sans
template est une anomalie d'exploitation, qu'il vaut mieux voir échouer qu'imprimer un
badge vide.

Le moteur de rendu est le package `@tigamadou/pdf-engine`, publié depuis pdfStudio sur GitHub Packages. Monter de version : `yarn add @tigamadou/pdf-engine@<version>`, puis `make verify-engine` (voir « Monter de version le moteur »).
Le moteur ne connaît aucun nom métier : il rend un document sur un dictionnaire de
valeurs, que `build-values.ts` dérive du contexte d'inscription et de la table de
liaison du template.

`AssetResolver` — la fonction qui donne au moteur l'image ou la police déjà encodée
pour un chemin de ressource — est **synchrone** : `resolveTemplate`
(`src/lib/badge-templates/resolve.ts`, `blockAssets`/`referencedAssets`) précharge
donc, avant de construire le composant, **tous** les fonds `image.asset` référencés
par l'arbre de blocs, y compris ceux posés dans un `group` imbriqué à n'importe
quelle profondeur (`blockAssets` descend récursivement) — plus les fichiers de
`fonts`. Une ressource oubliée dans ce préchargement ferait échouer le rendu, pas
juste s'afficher vide.

## Installation

Le staff plateforme (`STAFF_ADMIN` ou au-dessus) dépose une archive sur
`/platform/badge-templates`, en **deux temps**.

**1. Inspection, lecture seule.** `POST /api/platform/badge-templates/inspect` lit
l'archive (contrôles + `parseManifest`) et n'écrit rien. Il rend `variables` (nom,
`kind`, libellé, tels que déclarés par le manifeste), `suggested` (pré-remplissage :
`suggestBindings` ne propose une source que si le nom de la variable est exactement
celui d'une source connue **et** que les types s'accordent — aucune heuristique sur
les noms proches) et `sources` (les 17 entrées de `SOURCE_KINDS`, avec leur type).

**2. L'écran de liaison.** `BadgeTemplateInstaller.tsx` affiche un tableau, une ligne
par variable : nom, type, et un sélecteur de source **filtré aux sources du même
type**. Trois états par ligne : non décidé (case vide, valeur `undefined`), « laisser
vide » (`null`), ou une source. Le bouton « Installer » reste grisé tant qu'une ligne
n'est pas décidée, et se grise à nouveau pendant la requête (`installing`), pour
empêcher une double soumission. Chaque sélecteur porte un nom accessible
(`aria-label="Source de la variable <nom>"`).

**3. L'installation.** `POST /api/platform/badge-templates` reçoit l'archive **et**
le champ `bindings` (JSON) — l'archive transite donc deux fois, ce que
`MAX_ARCHIVE_BYTES` borne déjà des deux côtés. La route enchaîne, et s'arrête à la
première erreur :

1. contrôles d'archive et validation du manifeste — refus 400 avec **la liste
   complète** des erreurs, pour corriger le paquet en une passe ;
2. lecture de `bindings` : un champ manquant, un JSON illisible, ou une valeur qui
   n'est pas un objet (`null` et un tableau sont du JSON valide mais invalides ici)
   refusent respectivement avec « liaisons : champ manquant. », « liaisons : JSON
   illisible. » ou « liaisons : objet attendu. » ;
3. `validateBindings(manifest.variables, bindings)` — refus 400 avec la liste
   complète des erreurs : variable non décidée (clé absente), source inconnue, type
   incompatible entre la variable et la source choisie ;
4. calcul de la version : `max(version) + 1` pour cette famille, ou 1 ;
5. **rendu d'épreuve** avec les `sample` du manifeste (`samplesOf`), pas avec les
   liaisons : une épreuve montre le template, pas un participant ;
6. écriture des ressources et de l'aperçu dans le stockage ;
7. création de la ligne (`layout` **et** `bindings`), puis
   `logActivity(BADGE_TEMPLATE_INSTALLED)`.

La ligne n'est créée qu'après une preuve de rendu réussie : aucune entrée du catalogue
ne peut être irrécupérable. Si le rendu échoue, les ressources déjà écrites sont
supprimées — un paquet refusé ne laisse rien derrière lui.

Les paquets **livrés avec l'application** (`default`, `recto-verso`) portent leur
table de liaison en dépôt, sous `prisma/badge-templates/<famille>/bindings.json` —
lue par `ensureReferenceTemplates` au seed, qui n'a pas d'administrateur devant lui
pour la choisir. pdfStudio n'en produit pas : c'est une convention propre à ce dépôt,
pour ses propres paquets.

### Versions figées

**Réinstaller ne met jamais à jour** : chaque installation crée une nouvelle ligne, et
c'est le `cuid` de cette ligne que stockent `Event.badgeTemplateId`,
`Organization.badgeTemplateId` et `PlatformSettings.badgeTemplateId`. Un cuid ne désigne
qu'une version, pour toujours : un événement ne peut pas voir son badge changer sous ses
pieds. Aucune route n'expose de modification de `layout`, `family` ou `assetPrefix` —
le schéma Zod de la route d'archivage est `.strict()`, ce qui en fait une règle appliquée
et non une convention. **Une table de liaison ne s'édite pas après installation** non
plus : il n'existe aucune route pour ça — corriger une liaison suppose de réinstaller
le paquet.

### Archivage

Archiver retire le template du sélecteur **sans supprimer ni la ligne ni ses ressources**.
`resolveTemplate` continue de le résoudre : les événements qui le référencent impriment
exactement le même badge qu'avant. Seules `listAvailableTemplates` filtre sur `archived`.

### Aperçu et PDF d'épreuve

Deux fichiers distincts, deux rôles :

| Fichier | Origine | Où il s'affiche |
|---|---|---|
| **Image d'aperçu** (`previewPath`) | Fournie par le paquet, déclarée par le champ `preview` du manifeste | La **vignette du catalogue** et le sélecteur de badge |
| **PDF d'épreuve** (`proofPath`) | Produit à l'installation | L'**aperçu de la page de détail**, affiché directement |

La répartition suit l'usage de chaque écran. Le catalogue liste des dizaines de modèles :
il lui faut des vignettes légères, et une image ordinaire s'affiche sans lecteur
intercalé. La page de détail sert au contraire à examiner **un** modèle : on y veut le
rendu réel aux dimensions exactes, donc le PDF, visible sans avoir à cliquer.

Jusqu'à la spec 14, le PDF servait aux deux, y compris comme vignette — où le lecteur du
navigateur superposait sa barre d'outils, illisible en petit.

**Le champ `preview` est optionnel.** Sans lui, l'interface affiche un placeholder — c'est
le cas des deux modèles livrés, qui ne fournissent pas d'image. Le rendu d'épreuve, lui,
reste systématique : c'est la garantie qu'un template accepté au catalogue s'imprime.

Les deux fichiers sont servis par `/api/files/[...path]`, où les clés `badge-templates/`
sont non sensibles. Le composant partagé `src/components/ui/TemplatePreview.tsx` aiguille
selon la source : image, `<object>` PDF (pour les templates installés avant la spec 14),
ou placeholder.

## Créer un template

La création se fait dans **PDF Studio**, un projet dédié qui vit à côté de ce dépôt
(`../pdfStudio`) : `make dev` là-bas, puis `http://pdfstudio.localhost` (ou
`http://localhost:3900` en accès direct). Tout s'y fait : créer le template, déposer
les images et les polices, composer les blocs, générer le paquet à téléverser ici.

> Historique : le studio a d'abord vécu dans ce dépôt (`studio/`, specs 16, 18, 19)
> avant d'être extrait en projet autonome. Depuis la spec 20, le moteur de rendu
> **fait autorité** dans pdfStudio et l'application le consomme comme dépendance
> versionnée. Le moteur de rendu est le package `@tigamadou/pdf-engine`, publié depuis pdfStudio sur GitHub Packages. Monter de version : `yarn add @tigamadou/pdf-engine@<version>`, puis `make verify-engine` (voir « Monter de version le moteur »). Une évolution du format se fait donc dans pdfStudio, puis se reporte ici — plus jamais l'inverse.

Le studio crée les templates ; **l'application les installe et les rend** — il
n'existe côté badge ni générateur de squelette ni outil d'empaquetage : toute archive
installable sort du bouton **Générer le paquet** du studio.

Le studio est un outil de développement local, jamais déployé, qui ne connaît ni la
base ni le stockage. Son interface est organisée **en trois colonnes**, sur un thème
sombre :

| Colonne | Contenu |
|---|---|
| **Gauche** | En haut le **panneau de calques** : l'arbre des blocs, sans numéros — icône et libellé de type (Texte, Rectangle, Carré, Cercle, Groupe) ou le `name` du bloc. Il n'y a plus de type `QR Code` depuis le format v2 : un QR est une variable `image` posée dans une forme, comme n'importe quelle autre image. Sélection au clic, renommage inline (✎), déplacement, duplication, suppression au survol ; cases à cocher pour **Grouper** des frères, bouton **Dégrouper** sur un groupe. En bas le **contexte** de prévisualisation en sections repliables (participant, catégorie, événement, badge) avec ses préréglages et le dépôt de photo / logo. |
| **Centre** | Le **canevas** : l'aperçu PDF rafraîchi à chaque modification, et sous lui le bandeau des erreurs de validation — les erreurs localisées (« bloc 3 › 2 ») marquent aussi l'entrée fautive de l'arbre. |
| **Droite** | L'**inspecteur** du bloc sélectionné, dont les paramètres sont regroupés **par fonction** : Identité, Disposition, Apparence, Coins et bordures, Typographie, Contenu, Conditions. Sans sélection, la colonne affiche les propriétés du **paquet** (famille, libellé, description, aperçu, polices, dépôt de ressources). Le bouton **JSON** de la barre supérieure y bascule le manifeste brut, synchronisé dans les deux sens. |

Les contrôles suivent la nature de la donnée : grille **X Y L H** pour la géométrie,
sliders pour la rotation et l'opacité, boutons segmentés pour les choix fermés
(alignement, casse, cadrage, débordement), bascules **I U S** pour le style de texte,
pastille + hexadécimal + menu de sources pour les couleurs, zones de dépôt avec
vignette pour les fichiers.

Le rendu porte sur le texte de l'éditeur, donc avant enregistrement ; un manifeste
invalide affiche ses erreurs sans effacer l'aperçu précédent. Un avertissement signale
un cadre texte trop bas pour sa police.

**Grouper** calcule le cadre englobant des blocs choisis et convertit leurs
coordonnées en relatif : le PDF ne bouge pas d'un pixel. **Dégrouper** fait l'inverse,
et refuse de s'appliquer à un groupe portant une rotation, une opacité ou une
condition — ces effets de conteneur ne se reportent pas sur les enfants sans changer
le rendu.

Deux boutons complètent la barre supérieure : **Nouveau** (un squelette v2 minimal)
et **Générer le paquet**, qui enregistre le manifeste puis télécharge le zip prêt à
téléverser dans `/platform/badge-templates` — l'empaquetage suit les mêmes règles de
validation que l'installation, donc aucun écart possible. C'est le chemin normal :
le studio crée, l'application installe et rend.

L'interface est écrite en **Preact + htm sans étape de build** : la bibliothèque est
vendorisée (version figée, licence MIT) dans le projet pdfStudio (`src/public/vendor/`),
les composants dans `src/public/ui/`.

L'atelier est `templates/<nom>/` côté pdfStudio (non versionné). Côté badge, le seul
dossier de paquets est `prisma/badge-templates/`, qui contient les paquets de référence
installés par le seed.

> Historique : jusqu'à cette bascule, un atelier gitignoré `badge-templates/<nom>/` et
> la commande `make pack-badge-template` permettaient d'empaqueter un manifeste écrit à
> la main sans passer par le studio. Ils ont été retirés : le studio est désormais
> l'unique chemin de création.

### Où consulter un template

| Écran | Ce qu'on y voit |
|---|---|
| `/platform/badge-templates` | Le catalogue : vignette, libellé, famille, version, état, action d'archivage |
| `/platform/badge-templates/<id>` | Le détail (voir ci-dessous) |
| Les trois écrans de réglage de badge | Le sélecteur, qui rend l'aperçu de chaque modèle proposable |

La **page de détail** est en lecture seule, accessible à tout staff, et rassemble :

- l'aperçu en grand — le **PDF d'épreuve**, donc le rendu réel — avec un lien pour
  l'ouvrir en plein écran ;
- **qui utilise cette version** — événements, organisations, défaut de la plateforme.
  Zéro utilisation est affiché explicitement : c'est l'information qui permet d'archiver
  sans risque ;
- les **versions de la famille**, avec un lien vers chacune, ce qui rend le versionnement
  figé tangible ;
- les **ressources embarquées** et leur poids, lues depuis le stockage — donc ce qui est
  réellement présent, pas seulement ce que le manifeste déclare. Section masquée si le
  paquet n'en a aucune ;
- le **manifeste**, affiché et téléchargeable. C'est le chemin pour dériver un modèle :
  télécharger, modifier, réinstaller en nouvelle version.

L'archivage reste sur le catalogue : la page de détail n'expose aucune action mutante.

## Structure d'un paquet

```
mon-badge.zip
├── manifest.json          (obligatoire, à la racine)
├── assets/                (images : JPEG et PNG)
└── fonts/                 (polices : TTF et OTF)
```

Trois emplacements et rien d'autre. Toute autre entrée fait échouer la validation : une
archive dont on ignore une partie du contenu est une archive dont on ne maîtrise pas le
comportement.

`bindings.json` n'apparaît **pas** dans cette liste : un `.zip` téléversé n'en porte
jamais, sa table de liaison se décide sur l'écran d'installation (voir plus haut).
Ce fichier est **propre aux paquets livrés avec l'application**
(`prisma/badge-templates/<famille>/`) — pdfStudio n'en produit pas.

**Les images sont limitées à JPEG et PNG.** `@react-pdf/image` ne reconnaît pas WebP,
que le reste du projet accepte pourtant pour les uploads utilisateur : un WebP dans un
paquet produirait un badge cassé.

### Contrôles appliqués à l'archive

`@tigamadou/pdf-engine/package` (`readTemplatePackage`, dans le package du moteur) est le **seul** module autorisé à ouvrir une
archive. Tout est vérifié avant extraction.

| Contrôle | Valeur | Raison |
|---|---|---|
| Taille de l'archive | 10 Mo | Borne d'entrée |
| Volume décompressé | 30 Mo | Bombe de décompression : une archive minuscule peut gonfler à plusieurs gigaoctets |
| Nombre d'entrées | 50 | Même objectif, sur l'axe du nombre de fichiers |
| Chemins | Ni absolus, ni `..`, ni `\` | Écriture hors du dossier cible (*zip slip*) |
| Emplacements | `manifest.json`, `assets/`, `fonts/` | Une entrée inattendue fait échouer |
| Images | JPEG, PNG — 5 Mo par fichier | Formats lisibles par le moteur PDF |
| Polices | TTF, OTF — 2 Mo par fichier | Formats acceptés par `Font.register` |

Le type est déduit des **octets d'en-tête**, jamais de l'extension : une image WebP
renommée en `.png` est refusée.

## Manifeste

Le moteur v2 ne connaît **aucun nom métier** : un manifeste déclare son propre
vocabulaire dans `variables`, et les blocs y font référence par leur nom. La source
de vérité du format est le schéma Zod et les types du package `@tigamadou/pdf-engine` (`declarative/schema` et
`declarative/manifest-types`) — ce document en donne une lecture,
pas une resynthèse : en cas d'écart, le schéma fait foi.

```json
{
  "formatVersion": 2,
  "family": "salon-2027",
  "label": "Badge Salon 2027",
  "description": "Badge recto-verso avec fond personnalisé.",
  "preview": "assets/apercu.png",
  "page": { "widthPx": 323.53, "heightPx": 204.09, "count": 1 },
  "fonts": [{ "alias": "titre", "file": "fonts/Inter-Bold.ttf", "weight": 700 }],
  "variables": [
    { "name": "participant.firstName", "kind": "text", "label": "Prénom", "sample": "Awa" },
    { "name": "participant.lastName", "kind": "text", "label": "Nom", "sample": "Diallo" },
    { "name": "participant.photoDataUrl", "kind": "image", "label": "Photo" },
    { "name": "category.anonymous", "kind": "boolean", "label": "Badge anonyme", "sample": false },
    { "name": "event.date", "kind": "date", "label": "Date", "format": "long",
      "sample": "2027-12-15T00:00:00.000Z" }
  ],
  "presets": [
    { "label": "Sans photo", "values": { "participant.photoDataUrl": "" } }
  ],
  "blocks": [
    { "type": "rect", "page": 1, "x": 0, "y": 0, "w": 323.53, "h": 204.09,
      "image": { "asset": "assets/fond.png" } },
    { "type": "text", "page": 1, "x": 136, "y": 30, "w": 174, "h": 27,
      "text": "{participant.firstName} {participant.lastName}",
      "style": { "font": "titre", "sizePx": 16, "color": "#0f172a",
                 "overflow": "shrink", "minSizePx": 11 },
      "visibleIf": { "variable": "category.anonymous", "equals": false } },
    { "type": "group", "page": 1, "x": 12, "y": 12, "w": 100, "h": 120, "name": "Photo",
      "blocks": [
        { "type": "circle", "x": 0, "y": 0, "w": 100, "h": 100,
          "image": { "source": "participant.photoDataUrl", "fit": "cover" } }
      ] }
  ]
}
```

Le type de bloc `qr` **a disparu en v2** : un QR code est une variable `image`
(`badge.qrCodeDataUrl` côté application) posée dans une forme, comme n'importe quelle
autre image — `fond.png` ci-dessus, ou la photo dans le groupe. Un manifeste v1
(`formatVersion: 1`) est refusé par `parseManifest` avec un message renvoyant vers la
migration (voir « Migration d'une base antérieure » plus bas) ; il ne descend plus au
détail des erreurs de schéma pour ce cas précis.

### Champ `variables`

Chaque entrée déclare une référence utilisable par les blocs : `name` (grammaire
`^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$`, trois segments au plus, 60 caractères au
plus — un nom pointé comme `participant.firstName` ou un nom plat comme `mention`
sont tous deux valides), `kind` (`text`, `image`, `boolean`, `date`, `color`),
`label` (affiché à l'écran de liaison), `sample` optionnel (alimente l'aperçu du
studio et le rendu d'épreuve — pour une variable `image`, un chemin d'asset du
paquet, validé comme l'est `preview`), et `format` (uniquement pour `kind: "date"`,
voir plus bas). 40 variables au plus par manifeste.

### Champ `conditions`

Des conditions **nommées**, réutilisables par plusieurs blocs via `visibleIf: { "use":
"<nom>" }` :

```json
"conditions": [
  { "name": "estAnonyme", "when": { "variable": "category.anonymous", "equals": true } }
]
```

`when` accepte une condition ou une liste (conjonction), exactement comme un
`visibleIf` littéral — mais sans `use` : une condition nommée ne peut pas en référencer
une autre, ce qui exclut tout cycle par construction. 40 conditions au plus.

### Champ `presets`

Un jeu de valeurs partiel, proposé dans le studio pour éprouver un cas limite (sans
photo, textes très longs, catégorie anonyme…). Chaque clé de `values` désigne une
variable déclarée, avec un type cohérent — une valeur d'image s'y écrit comme un
`sample` d'image (un chemin d'asset du paquet, ou `""` pour l'absence de valeur).
Aucun effet sur le rendu réel : `presets` ne sert qu'à l'aperçu côté studio.

Toutes les coordonnées et dimensions — tailles de police comprises — sont en
**pixels CSS à 96 dpi**, la convention de Figma et du web (1 px = 1/96 pouce,
converti en points PDF au rendu : 1 px = 0,75 pt). Une carte CR80 paysage fait
323,53 × 204,09 px. L'auteur d'un template reporte telles quelles les valeurs de sa
maquette Figma, positionnées en absolu depuis le coin supérieur gauche de la page.
Un bloc peut déborder de la page sans que la validation s'y oppose — le fond perdu
est un cas print légitime, et le dépassement se juge à l'œil dans l'aperçu du studio.
Le trop-plein est simplement coupé : une page déclarée = une page rendue, le rendu ne
crée jamais de page supplémentaire (les blocs vivent dans une `View` insécable qui
couvre exactement la page — `wrap={false}` posé sur la `Page` elle-même lui ferait
adopter la hauteur du flux, c'est-à-dire zéro).

Piège connu : `@react-pdf` n'affiche pas un texte dont le cadre est plus bas que sa
ligne — il le supprime sans erreur ni rognage. Donner à chaque bloc `text` une
hauteur d'au moins **1,45 × la taille de police** (par ligne de texte).

### Types de blocs

| Type | Rôle | Champs propres |
|---|---|---|
| `text` | Un texte | `text` (gabarit), `style` |
| `rect` | Un rectangle | fond : `fill` et/ou `image` |
| `square` | Un carré — la validation exige `w = h` | fond : `fill` et/ou `image` |
| `circle` | Un cercle — rayon implicite `min(w,h)/2`, une ellipse si `w ≠ h` ; `radiusPx` interdit | fond : `fill` et/ou `image` |
| `group` | Un conteneur : les coordonnées de ses enfants sont **relatives** à lui, et ils n'ont pas de `page`. Déplacer, pivoter, atténuer (`opacity`) ou masquer (`visibleIf`) le groupe agit sur tout son contenu ; l'imbrication est libre. | `blocks` |

#### Fond des formes

Une forme (`rect`, `square`, `circle`) porte **au moins un** fond :

- `fill` — une couleur hexadécimale ou une variable de type couleur ;
- `image` — `{ source | asset, fit }` : une source image du contexte **ou** une
  ressource du paquet (jamais les deux), cadrée par `fit` (`cover` par défaut,
  `contain`, `fill`).

Déclarer les deux laisse la couleur visible sous une image `contain` ou transparente.
**L'image est rognée par la forme** : coins arrondis et cercles la découpent, ce qui
suffit à poser une photo ronde en un seul bloc.

#### Champs communs à tous les blocs

Outre `page`, `x`, `y`, `w`, `h` et `visibleIf` :

| Champ | Effet |
|---|---|
| `rotate` | Rotation en degrés (sens horaire, ±360) autour du centre du cadre. Déclarer le cadre **non pivoté**, comme dans Figma |
| `opacity` | Opacité du bloc entier, de 0 à 1 |
| `radiusPx` | Coins arrondis : un nombre (les quatre coins) ou un objet `{ topLeft, topRight, bottomRight, bottomLeft }` |
| `border` | Bordure des quatre côtés : `{ widthPx, color, style }` où `style` vaut `solid` (défaut), `dashed` ou `dotted` |
| `borderTop`, `borderRight`, `borderBottom`, `borderLeft` | Même forme que `border`, et **prime** sur lui pour le côté concerné |

Les couleurs de bordure acceptent, comme `fill`, une valeur hexadécimale ou le nom
d'une variable de type couleur.

Les **ombres portées et les dégradés ne sont pas supportés** : `@react-pdf` n'a ni
ombre ni flou (limite du moteur, décision de la spec 18).

### Gabarits de texte

Le champ `text` mélange littéraux et références : les segments `{nom}` sont remplacés
par la valeur de la **variable déclarée** de ce nom, le reste est écrit tel quel. Le
nom référencé peut être pointé (`participant.firstName`) ou plat (`mention`) : les
deux formes sont légales depuis le format v2.

```
"{participant.firstName} {participant.lastName}"   →  Awa Diallo
"#{badge.id}"                                       →  #BDG-1
"Participant anonyme"                               →  Participant anonyme
```

### Liaisons et sources

Un manifeste **ne référence plus** de vocabulaire câblé dans le moteur : il déclare
des variables aux noms libres (`variables`, ci-dessus), et c'est une **table de
liaison** — propre à l'application, choisie à l'installation — qui dit quelle donnée
métier alimente chaque variable. Le moteur (`@tigamadou/pdf-engine`) ne connaît aucune de ces 17
entrées ; elles vivent dans `src/lib/badge-templates/bindings.ts`
(`SOURCE_KINDS`), hors du dossier scellé :

| Source | Type |
|---|---|
| `participant.firstName`, `participant.lastName`, `participant.structure` | texte |
| `participant.photoDataUrl` | image |
| `category.name` | texte |
| `category.color` | couleur |
| `category.neutralBadge`, `category.anonymous` | booléen |
| `event.title`, `event.location` | texte |
| `event.date` | date, transmise **brute** (voir plus bas) |
| `event.logoDataUrl` | image |
| `badge.id`, `badge.verifyUrl` | texte |
| `badge.qrCodeDataUrl` | image |

Deux sources ont été ajoutées après les quinze d'origine :

| Source | Type | Donnée |
|---|---|---|
| `badge.allAccess` | booléen | All Access accordé à l'inscription (bouton All Access de la fiche participant) |
| `event.securityInstructions` | liste | Consignes de sécurité saisies dans les paramètres de l'événement (une par ligne, 30 au plus, 500 caractères) |

L'initiale d'une catégorie ne demande aucune source : le template l'obtient avec `{categoryName|initiale}` (moteur ≥ 1.1.0), `categoryName` étant lié à `category.name`.

`validateBindings` refuse une variable liée à une source d'un type différent — la
même garde que portait autrefois le `kind` de l'ancienne liste blanche `SOURCES`,
déplacée d'un cran, à l'installation plutôt qu'à la validation du manifeste. Une
variable **« laissée vide »** (`null` dans la table de liaison) n'est pas écrite :
`buildValues` saute cette clé, `resolveVariable` retombe sur le vide du type, et
`isEmpty` joue son rôle de repli exactement comme pour une variable jamais renseignée.

`event.date` est transmise **brute**, en ISO : **le format d'affichage appartient à
la variable**, pas à la source. `formatFrenchDate` ne sert plus le rendu du badge —
il reste inchangé pour les e-mails, qui restent en français local (voir « Dates » plus
bas). Les champs `fill` et `color` acceptent soit une couleur hexadécimale
(`#4f46e5`), soit le nom d'une variable de type `color`.

### Dates

Chaque variable `date` porte un `format` (`long` par défaut) :

| `format` | Rendu | Options `Intl.DateTimeFormat("fr-FR")` |
|---|---|---|
| `long` | 15 décembre 2027 | `day: numeric, month: long, year: numeric` |
| `court` | 15/12/2027 | `day: 2-digit, month: 2-digit, year: numeric` |
| `moisAnnee` | décembre 2027 | `month: long, year: numeric` |
| `annee` | 2027 | `year: numeric` |
| `iso` | 2027-12-15 | — |

Toutes les options (sauf `iso`) forcent `timeZone: "UTC"` : une date de manifeste est
**calendaire**, pas un instant — le 15 décembre reste le 15 décembre quel que soit le
fuseau du serveur qui rend le PDF. `long` reproduit exactement l'ancien
`formatFrenchDate`, à cette réserve de fuseau près (voir la spec 20, § « Dates », pour
la portée exacte de cette différence sur un template migré).

### Conditions d'affichage

`visibleIf` accepte une condition littérale, une référence `{ "use": "<nom>" }` vers
une condition déclarée dans `conditions` (voir plus haut), ou une liste — de l'un ou
l'autre — dont **toutes** les entrées doivent être vraies.

```json
"visibleIf": [
  { "variable": "category.anonymous", "equals": false },
  { "variable": "participant.photoDataUrl", "isEmpty": false }
]
```

- `equals` compare une variable de `kind: "boolean"` à une valeur ; la validation
  refuse un `equals` sur une variable d'un autre type. **Aucune restriction de nom** :
  la v1 n'admettait cette forme que sur `category.anonymous` et `category.neutralBadge`
  (`CONDITION_PATHS`) ; ce garde-fou n'existe plus en v2, `equals` s'applique à
  n'importe quelle variable booléenne déclarée.
- `isEmpty` teste l'absence de valeur, sur n'importe quel type. C'est ce qui permet
  les blocs de repli — le rectangle gris affiché quand le participant n'a pas de
  photo, ou quand la variable qui l'alimente a été laissée vide à l'installation.

Un badge dont l'apparence change selon une condition se décrit avec **deux blocs
superposés portant des conditions inverses**. C'est ainsi que la bande de catégorie
passe de pleine couleur à blanche bordée en mode neutre.

### Débordement du texte

La mise en page étant absolue, un texte trop long ne se replace pas tout seul : chaque
bloc `text` déclare ce qu'il faut faire.

| `overflow` | Effet |
|---|---|
| `shrink` | Réduit la police jusqu'à `minSizePx` (obligatoire dans ce mode) |
| `truncate` | Coupe et ajoute une ellipse |
| `clip` | Laisse déborder — comportement brut de `@react-pdf` |

`maxLines` complète ces modes pour le multiligne : au-delà du nombre de lignes
déclaré, `@react-pdf` coupe avec une ellipse.

### Style du texte

| Champ | Effet |
|---|---|
| `sizePx`, `minSizePx` | Taille de police, et plancher du mode `shrink` |
| `font`, `weight` | Alias d'une police déclarée dans `fonts` ; graisse 400 / 500 / 600 / 700 |
| `fontStyle` | `italic` (Montserrat italique est enregistrée par défaut) |
| `color` | Hexadécimale ou variable de type couleur |
| `align` | `left`, `center`, `right`, `justify` |
| `transform` | `uppercase`, `lowercase`, `none` |
| `decoration` | `underline`, `line-through` |
| `letterSpacing`, `lineHeight` | Interlettrage en px ; interligne en multiplicateur (sans unité) |
| `maxLines` | Nombre maximal de lignes, ellipse au-delà |
| `backgroundColor`, `paddingPx` | Fond et marge interne du **cadre** du texte (étiquettes, pastilles). La marge est retranchée de la largeur utile pour `shrink` / `truncate` |

### Polices

Montserrat est la police **par défaut** (romaine et italique, graisses 400 à 700).
Un paquet peut embarquer les siennes en les déclarant dans `fonts`, chaque entrée
portant un `alias` réutilisé par `style.font`, une `weight` et un `style`
(`normal` par défaut, ou `italic`). Une famille complète se déclare en plusieurs
entrées partageant le même alias.

Les polices sont enregistrées sous une famille préfixée `tpl-<templateId>-<alias>` :
`Font.register` étant global au process et indexé par nom de famille, deux paquets
déclarant le même alias s'écraseraient sans ce préfixe.

## Validation

`parseManifest` refuse, en une passe et avec un message par erreur. Les vérifications
descendent récursivement dans les groupes, et les messages nomment le chemin du bloc
fautif (« bloc 3 › 2 : … ») :

- un `formatVersion` différent de `2` (un `1` renvoie vers la migration, un autre est
  simplement refusé), une `family` qui n'est pas un slug kebab-case ;
- une `variable` déclarée deux fois, un nom hors grammaire ou de plus de trois
  segments, plus de 40 variables ; un `sample` incohérent avec le `kind` (booléen
  hors booléen, hexadécimal hors couleur, ISO hors date, ressource absente du
  paquet pour une image) ; un `format` posé sur une variable non `date` ;
- une `condition` nommée déclarée deux fois, ou dont le `when` échoue les mêmes
  contrôles qu'un `visibleIf` littéral ; plus de 40 conditions ;
- un `preset` dont une clé ne désigne aucune variable déclarée, ou dont le type de
  la valeur ne correspond pas ;
- un bloc dont la page dépasse `page.count` ; une `page` manquante à la racine ou
  déclarée sur un enfant de groupe ;
- plus de 60 blocs, **groupes et enfants compris** (l'arbre est compté à plat,
  descente récursive dans les groupes imbriqués) ;
- une référence `{nom}` (texte), `image.source` ou couleur vers une variable **non
  déclarée**, ou déclarée d'un `kind` incompatible avec l'usage (`text`/`date` pour
  un gabarit de texte, `image` pour un fond, `color` — ou hexadécimal — pour une
  couleur) ; une référence `{ "use": "<nom>" }` vers une condition non déclarée ;
- une forme sans fond, ou dont le fond `image` porte à la fois `source` et `asset`,
  ou aucun des deux ;
- un `square` dont `w ≠ h`, un `circle` portant un `radiusPx` ;
- une ressource ou une police déclarée mais absente du paquet ;
- un `style.font` sans `alias` correspondant ;
- `overflow: "shrink"` sans `minSizePx`, ou un `minSizePx` supérieur au `sizePx` ;
- une couleur ni hexadécimale ni variable de type couleur (remplissage, texte, fond
  du texte, bordures) ;
- un `visibleIf` (ou un `when` de condition nommée) de forme `equals` sur une
  variable non booléenne.

Ce que `parseManifest` valide **ne couvre pas** la table de liaison : un manifeste
peut être valide alors même qu'aucune de ses variables n'a encore de source choisie.
C'est `validateBindings` (`src/lib/badge-templates/bindings.ts`), appelée séparément
à l'installation et par `validate-badge-templates`, qui porte ce second contrôle.

Le validateur est une fonction **pure** : aucun accès réseau ni base. Il est donc
réutilisable côté client par un futur éditeur visuel.

## Historique de la bascule

Jusqu'au plan 12, `default-v1` et `recto-verso-v1` étaient des composants React inscrits
dans un registre compilé (`src/lib/badge-templates/index.ts`). Leur conversion en
manifestes a été validée par un test de fidélité comparant, sur sept contextes (nominal,
anonyme, neutre, sans photo, texte long, avec et sans logo), l'arbre de rendu du composant
historique et celui du manifeste équivalent.

Ce test a été **supprimé avec le registre** : il comparait le moteur à des composants qui
n'existent plus. Sa valeur a été consommée — c'est lui qui a autorisé la suppression.

Ce que la comparaison couvrait : contenu textuel, images, couleurs de fond, tailles de
police, traits typographiques et nombre de pages. Ce qu'elle ne couvrait **pas** : le
placement. Un layout flexbox et un layout absolu atteignent le même résultat par des
moyens différents ; le placement se vérifie à l'œil, sur un badge imprimé.

## Migration d'une base antérieure

`make migrate-badge-template-refs` convertit les anciennes références texte
(`"default-v1"`, `"recto-verso-v1"`) vers les cuid des templates installés, dans les trois
colonnes de la cascade. Idempotent, et il signale toute valeur qui ne désigne aucun
template plutôt que de deviner. Une base neuve n'en a pas besoin : `make db-seed` suffit.

`make migrate-installed-templates [ARGS=--apply]` migre les lignes `InstalledBadgeTemplate`
encore au format v1 (`formatVersion = 1`) vers le v2, depuis la spec 20. Le moteur v2 ne
sait plus rendre une ligne v1 : **aucune coexistence n'est possible**. Une ligne restée en
v1 fait échouer la résolution (`resolveTemplate` lève une erreur explicite qui nomme cette
cible), donc l'impression de chaque badge qui en dépend répond 500. Pour chaque ligne : `migrateManifest` (porté de pdfStudio) convertit
le manifeste, la table de liaison est posée en **identité** (les variables produites
portent exactement le nom des 15 sources v1, aucun choix humain requis), et
`validateBindings` garde le résultat avant écriture. **Dry-run par défaut** ; `ARGS=--apply`
pour écrire. Idempotent (ne regarde que `formatVersion = 1`), et couvre les templates
**archivés** — un template archivé reste résolvable, donc migrable.

### Ordre de release obligatoire

Conséquence directe (spec 20, § « Migration des lignes en base ») : sur toute base qui
contient des lignes v1, la mise en service du moteur v2 suit **cet ordre, dans la même
fenêtre, sans trafic entre les étapes** :

1. **Pousser le schéma** (colonne `InstalledBadgeTemplate.bindings`) sur la base cible.
2. **Lancer `migrate-installed-templates-v2 --apply`** contre cette même base (un dry-run
   juste avant est recommandé), puis `validate-badge-templates` pour confirmer qu'il ne
   reste aucune ligne v1.
3. **Seulement ensuite**, ouvrir le trafic sur la nouvelle version.

Faits d'outillage à connaître avant de planifier la release :

- La cible Makefile `migrate-installed-templates` vise **uniquement le conteneur de dev**
  (`docker compose -f docker-compose.dev.yml exec app …`). Il n'existe pas d'équivalent
  production.
- L'image de production (`Dockerfile`, étape `runner` en mode standalone) ne contient ni
  `scripts/`, ni `src/`, ni `tsx` : le script **ne peut pas** tourner dedans.
- `docker-entrypoint.sh` exécute `prisma db push` puis sert l'application **immédiatement** :
  démarrer la nouvelle image pousse le schéma et ouvre le trafic d'un même geste, sans
  laisser de place à l'étape 2.

Le script doit donc être lancé depuis un environnement qui dispose des sources (le
conteneur de dev, ou un conteneur d'outillage ponctuel) avec `DATABASE_URL` pointée sur la
base cible, **avant** que la nouvelle image ne reçoive du trafic — par exemple : schéma
poussé depuis cet environnement, migration, puis démarrage de la nouvelle image (son
`db push` n'a alors plus rien à faire). La mécanique concrète de production (accès à la
base, conteneur utilisé, coupure éventuelle) est **à arrêter au moment de la release** ;
elle sort du périmètre de la spec 20.

### Réserves de la migration

Deux réserves à connaître :

- Les échantillons d'image du studio (`assets/photo-demo.png`, etc.) n'existent pas dans
  les paquets v1 installés ; `migrateManifest` laisse alors ces variables sans `sample`,
  sans effet sur les badges réels. Le PDF d'épreuve (`proofPath`) existant **n'est pas
  régénéré** après migration.
- Fuseau : un template migré rend sa date **à l'identique** du v1, sauf si le serveur
  tourne à l'ouest de l'UTC — la date avance alors d'un jour, vers la bonne valeur
  calendaire (voir la spec 20, § « Dates »).

**Message trompeur à connaître** : quand `parseManifest` (moteur v2, donc aussi
pdfStudio) refuse un manifeste `formatVersion: 1`, le message renvoie vers
`make migrate-template NAME=<famille>` — la commande **de pdfStudio**, pour un
manifeste d'atelier. Pour une **ligne déjà installée** dans ce dépôt, l'équivalent
est `make migrate-installed-templates` ci-dessus : le message du moteur ne le sait
pas, il est identique des deux côtés puisque le moteur est le même package.

`make validate-badge-templates` vérifie qu'aucune référence n'est orpheline, que la
famille `default` existe bien, et — depuis la spec 20 — signale aussi toute ligne restée
au format v1 et toute table de liaison incomplète (variable non décidée, source inconnue,
type incompatible).

## Monter de version le moteur

Le moteur de rendu est le package `@tigamadou/pdf-engine` (publié depuis pdfStudio).
Les badges sont re-rendus à la demande : une nouvelle version du moteur redessine
aussi les badges déjà émis. Avant chaque déploiement d'une nouvelle version :

1. `yarn add @tigamadou/pdf-engine@<version>` (conteneur de dev), puis `make test`.
2. `make verify-engine` : rend chaque template installé (**archivés compris** : leurs
   badges déjà émis restent rendables) avec ses échantillons et ses préréglages et
   compare à la référence. Un template **refusé** bloque (code 1). Un rendu **changé**,
   ou un template installé depuis la dernière référence, régénère son épreuve
   `proof-engine-<version>.pdf` à côté de `proof.pdf` : les comparer. Les épreuves sont
   écrites dans le S3 de l'environnement **même sans `--accept`**. Pour en ouvrir une :
   `/api/files/<proofPath>` (la route sert les clés `badge-templates/`) ou la console RustFS.
3. Même vérification sur les données réelles, sans redéployer l'application :
   `make verify-engine-preprod`, puis `make verify-engine-prod`.
4. Si les changements sont acceptés : `--accept` est **par environnement** (chacun a sa
   propre référence dans son S3) : `make verify-engine-preprod ARGS=--accept` /
   `make verify-engine-prod ARGS=--accept`, seulement après examen des épreuves de cet
   environnement. Puis `make deploy-preprod` / `make deploy-prod`.

Après l'installation d'un nouveau template, lancer `make verify-engine-prod ARGS=--accept`
pour qu'il entre dans la référence.

La première fois, aucune référence n'existe : tous les templates sont « sans
référence » ; `ARGS=--accept` l'enregistre. Premier déploiement : l'application
embarquait auparavant une version plus ancienne du moteur ; la première référence est
enregistrée avec la 1.0.0. Comparer l'épreuve `proof-engine-1.0.0.pdf` de chaque
template à son `proof.pdf` avant d'accepter.

Avant le premier déploiement : vérifier que le serveur a `NPM_TOKEN` dans
`~/prod/badge/.env` et `~/preprod/badge/.env`, et `docker compose version` >= 2.23.
`make verify-engine-prod` exerce le même chemin de secret de build sans toucher à
l'application.

Pour que pdfStudio protège les templates de production dans son corpus de
non-régression : `make export-engine-corpus-prod`, puis déposer le contenu de
`backups/engine-corpus/` dans `pdfStudio/packages/engine/corpus/`.

Une version **majeure** du moteur peut exiger de migrer les layouts stockés : suivre
les instructions de sa note de version (même patron que
`scripts/migrate-installed-templates-v2.ts`), puis `make verify-engine`.
