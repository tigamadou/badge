# Templates de badge

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md`](../specs/2026-08-11-10-v4-format-et-moteur-de-templates-declaratifs.md).

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

## Installation

Le staff plateforme (`STAFF_ADMIN` ou au-dessus) dépose une archive sur
`/platform/badge-templates`. `POST /api/platform/badge-templates` enchaîne, et s'arrête
à la première erreur :

1. contrôles d'archive et validation du manifeste — refus 400 avec **la liste complète**
   des erreurs, pour corriger le paquet en une passe ;
2. refus si la famille collisionne avec un identifiant du registre compilé ;
3. calcul de la version : `max(version) + 1` pour cette famille, ou 1 ;
4. **rendu d'épreuve** avec un contexte de démonstration figé ;
5. écriture des ressources et de l'aperçu dans le stockage ;
6. création de la ligne, puis `logActivity(BADGE_TEMPLATE_INSTALLED)`.

La ligne n'est créée qu'après une preuve de rendu réussie : aucune entrée du catalogue
ne peut être irrécupérable. Si le rendu échoue, les ressources déjà écrites sont
supprimées — un paquet refusé ne laisse rien derrière lui.

### Versions figées

**Réinstaller ne met jamais à jour** : chaque installation crée une nouvelle ligne, et
c'est le `cuid` de cette ligne que stockent `Event.badgeTemplateId`,
`Organization.badgeTemplateId` et `PlatformSettings.badgeTemplateId`. Un cuid ne désigne
qu'une version, pour toujours : un événement ne peut pas voir son badge changer sous ses
pieds. Aucune route n'expose de modification de `layout`, `family` ou `assetPrefix` —
le schéma Zod de la route d'archivage est `.strict()`, ce qui en fait une règle appliquée
et non une convention.

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
> avant d'être extrait en projet autonome. Il embarque sa **propre copie** du moteur
> déclaratif : toute évolution du format (`src/lib/badge-templates/declarative/`) doit
> être **reportée dans pdfStudio**, et réciproquement, tant que l'application ne
> consomme pas ce projet directement.

Les commandes locales restent disponibles pour un usage hors interface :

```bash
make new-badge-template NAME=salon-2027   # cree le squelette
make pack-badge-template NAME=salon-2027  # produit l'archive
```

Le studio est un outil de développement local, jamais déployé, qui ne connaît ni la
base ni le stockage. Son interface est organisée **en trois colonnes**, sur un thème
sombre :

| Colonne | Contenu |
|---|---|
| **Gauche** | En haut le **panneau de calques** : l'arbre des blocs, sans numéros — icône et libellé de type (Texte, Rectangle, Carré, Cercle, QR Code, Groupe) ou le `name` du bloc. Sélection au clic, renommage inline (✎), déplacement, duplication, suppression au survol ; cases à cocher pour **Grouper** des frères, bouton **Dégrouper** sur un groupe. En bas le **contexte** de prévisualisation en sections repliables (participant, catégorie, événement, badge) avec ses préréglages et le dépôt de photo / logo. |
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

Deux boutons complètent la barre supérieure : **Nouveau** (même squelette que
`make new-badge-template`) et **Générer le paquet**, qui enregistre le manifeste puis
télécharge le zip prêt à téléverser dans `/platform/badge-templates` — l'empaquetage
suit les mêmes règles de validation que l'installation, donc aucun écart possible.

L'interface est écrite en **Preact + htm sans étape de build** : la bibliothèque est
vendorisée (version figée, licence MIT) dans le projet pdfStudio (`src/public/vendor/`),
les composants dans `src/public/ui/`.

Côté pdfStudio, l'atelier est `templates/<nom>/` (non versionné) ; côté badge, le
squelette de `make new-badge-template` naît dans `badge-templates/<nom>/` — un dossier
**gitignoré**, atelier de travail à ne pas confondre avec `prisma/badge-templates/`, qui
contient les paquets de référence installés par le seed. Il contient un `manifest.json`
minimal mais fonctionnel, un `README.md` documentant le format, et un dossier `assets/`.

`pack-badge-template` **valide le manifeste avant d'écrire l'archive** et refuse d'en
produire une invalide : mieux vaut échouer à l'empaquetage, où le message est immédiat,
qu'au téléversement. En particulier, un `preview` déclaré sans image déposée fait échouer
l'empaquetage — c'est le rappel le plus utile possible.

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

**Les images sont limitées à JPEG et PNG.** `@react-pdf/image` ne reconnaît pas WebP,
que le reste du projet accepte pourtant pour les uploads utilisateur : un WebP dans un
paquet produirait un badge cassé.

### Contrôles appliqués à l'archive

`src/lib/badge-templates/package-reader.ts` est le **seul** module autorisé à ouvrir une
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

```json
{
  "formatVersion": 1,
  "family": "salon-2027",
  "label": "Badge Salon 2027",
  "description": "Badge recto-verso avec fond personnalisé.",
  "page": { "widthPx": 323.53, "heightPx": 204.09, "count": 1 },
  "fonts": [{ "alias": "titre", "file": "fonts/Inter-Bold.ttf", "weight": 700 }],
  "blocks": [
    { "type": "rect", "page": 1, "x": 0, "y": 0, "w": 323.53, "h": 204.09,
      "image": { "asset": "assets/fond.png" } },
    { "type": "text", "page": 1, "x": 136, "y": 30, "w": 174, "h": 27,
      "text": "{participant.firstName} {participant.lastName}",
      "style": { "font": "titre", "sizePx": 16, "color": "#0f172a",
                 "overflow": "shrink", "minSizePx": 11 },
      "visibleIf": { "path": "category.anonymous", "equals": false } },
    { "type": "qr", "page": 1, "x": 234, "y": 113, "w": 68, "h": 68 },
    { "type": "group", "page": 1, "x": 12, "y": 12, "w": 100, "h": 120, "name": "Photo",
      "blocks": [
        { "type": "circle", "x": 0, "y": 0, "w": 100, "h": 100,
          "image": { "source": "participant.photoDataUrl", "fit": "cover" } }
      ] }
  ]
}
```

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
| `qr` | Le QR code du badge | — |
| `rect` | Un rectangle | fond : `fill` et/ou `image` |
| `square` | Un carré — la validation exige `w = h` | fond : `fill` et/ou `image` |
| `circle` | Un cercle — rayon implicite `min(w,h)/2`, une ellipse si `w ≠ h` ; `radiusPx` interdit | fond : `fill` et/ou `image` |
| `group` | Un conteneur : les coordonnées de ses enfants sont **relatives** à lui, et ils n'ont pas de `page`. Déplacer, pivoter, atténuer (`opacity`) ou masquer (`visibleIf`) le groupe agit sur tout son contenu ; l'imbrication est libre. | `blocks` |

#### Fond des formes

Une forme (`rect`, `square`, `circle`) porte **au moins un** fond :

- `fill` — une couleur hexadécimale ou une source de type couleur ;
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

Les couleurs de bordure acceptent, comme `fill`, une valeur hexadécimale ou un chemin
de source de type couleur.

Les **ombres portées et les dégradés ne sont pas supportés** : `@react-pdf` n'a ni
ombre ni flou (limite du moteur, décision de la spec 18).

### Gabarits de texte

Le champ `text` mélange littéraux et références : les segments `{chemin}` sont remplacés
par la valeur, le reste est écrit tel quel.

```
"{participant.firstName} {participant.lastName}"   →  Awa Diallo
"#{badge.id}"                                       →  #BDG-1
"Participant anonyme"                               →  Participant anonyme
```

### Sources disponibles

| Chemin | Type |
|---|---|
| `participant.firstName`, `participant.lastName`, `participant.structure` | texte |
| `participant.photoDataUrl` | image |
| `category.name` | texte |
| `category.color` | couleur |
| `category.neutralBadge`, `category.anonymous` | booléen |
| `event.title`, `event.location` | texte |
| `event.date` | date (formatée comme dans les e-mails) |
| `event.logoDataUrl` | image |
| `badge.id`, `badge.verifyUrl` | texte |
| `badge.qrCodeDataUrl` | image |

Un bloc consommant une source d'un type incompatible est refusé à la validation : le
fond image d'une forme ne peut pas pointer sur `participant.firstName`.

Les champs `fill` et `color` acceptent soit une couleur hexadécimale (`#4f46e5`), soit
un chemin de source de type couleur (`category.color`).

### Conditions d'affichage

`visibleIf` accepte une condition, ou une liste dont **toutes** doivent être vraies.

```json
"visibleIf": [
  { "path": "category.anonymous", "equals": false },
  { "path": "participant.photoDataUrl", "isEmpty": false }
]
```

- `equals` compare un booléen. Seuls `category.anonymous` et `category.neutralBadge`
  sont admis sous cette forme.
- `isEmpty` teste l'absence de valeur, sur n'importe quelle source. C'est ce qui permet
  les blocs de repli — le rectangle gris affiché quand le participant n'a pas de photo.

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
| `color` | Hexadécimale ou source de type couleur |
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

- un `formatVersion` inconnu, une `family` qui n'est pas un slug kebab-case ;
- un bloc dont la page dépasse `page.count` ; une `page` manquante à la racine ou
  déclarée sur un enfant de groupe ;
- plus de 60 blocs, **groupes et enfants compris** (l'arbre est compté à plat) ;
- une source inconnue ou de type incompatible ;
- une forme sans fond, ou dont le fond `image` porte à la fois `source` et `asset`,
  ou aucun des deux ;
- un `square` dont `w ≠ h`, un `circle` portant un `radiusPx` ;
- une ressource ou une police déclarée mais absente du paquet ;
- un `style.font` sans `alias` correspondant ;
- `overflow: "shrink"` sans `minSizePx`, ou un `minSizePx` supérieur au `sizePx` ;
- une couleur ni hexadécimale ni source de couleur (remplissage, texte, fond du
  texte, bordures) ;
- un `visibleIf` de forme `equals` sur un chemin non booléen.

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

`make validate-badge-templates` vérifie qu'aucune référence n'est orpheline et que la
famille `default` existe bien.
