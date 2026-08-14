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

```bash
make new-badge-template NAME=salon-2027   # cree le squelette
make studio                               # ouvre le studio sur http://localhost:3786
# editer le manifeste dans le studio, l'apercu se rafraichit a mesure
# deposer les images dans badge-templates/salon-2027/assets/
make pack-badge-template NAME=salon-2027  # produit l'archive
```

Le **studio** (`make studio`) est un outil de développement local : il liste les templates
de l'atelier, édite leur manifeste et rend le badge à chaque modification, sans empaqueter
ni installer. Le rendu porte sur le texte de l'éditeur, donc avant enregistrement, et un
sélecteur permet de commuter entre cinq jeux de données — participant complet, sans photo,
catégorie anonyme, badge neutre, textes très longs — pour éprouver les `visibleIf` et les
modes de débordement. Il n'est jamais déployé et ne connaît ni la base, ni le stockage.

Le squelette naît dans `badge-templates/<nom>/`, à la racine du dépôt — un dossier
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
  "page": { "widthPx": 1011, "heightPx": 638, "count": 1 },
  "fonts": [{ "alias": "titre", "file": "fonts/Inter-Bold.ttf", "weight": 700 }],
  "blocks": [
    { "type": "image", "page": 1, "x": 0, "y": 0, "w": 1011, "h": 638,
      "asset": "assets/fond.png" },
    { "type": "text", "page": 1, "x": 425, "y": 94, "w": 543, "h": 83,
      "text": "{participant.firstName} {participant.lastName}",
      "style": { "font": "titre", "sizePx": 50, "color": "#0f172a",
                 "overflow": "shrink", "minSizePx": 33 },
      "visibleIf": { "path": "category.anonymous", "equals": false } },
    { "type": "qr", "page": 1, "x": 732, "y": 354, "w": 213, "h": 213 }
  ]
}
```

Toutes les coordonnées et dimensions — tailles de police comprises — sont en
**pixels à 300 dpi** (1 px = 1/300 pouce, converti en points PDF au rendu :
1 px = 0,24 pt). Une carte CR80 paysage fait 1011 × 638 px. L'auteur d'un template
reporte telles quelles les valeurs de sa maquette print 300 dpi, positionnées en
absolu depuis le coin supérieur gauche de la page.

### Types de blocs

| Type | Rôle | Champs propres |
|---|---|---|
| `text` | Un texte | `text` (gabarit), `style` |
| `image` | Une image | `source` **ou** `asset`, jamais les deux ; `radiusPx` |
| `qr` | Le QR code du badge | — |
| `rect` | Un aplat | `fill`, `radiusPx`, `borderTopPx`, `borderColor` |

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

Un bloc consommant une source d'un type incompatible est refusé à la validation : un
bloc `image` ne peut pas pointer sur `participant.firstName`.

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

### Polices

Montserrat est la police **par défaut**. Un paquet peut embarquer les siennes en les
déclarant dans `fonts`, chaque entrée portant un `alias` réutilisé par
`style.font`.

Les polices sont enregistrées sous une famille préfixée `tpl-<templateId>-<alias>` :
`Font.register` étant global au process et indexé par nom de famille, deux paquets
déclarant le même alias s'écraseraient sans ce préfixe.

## Validation

`parseManifest` refuse, en une passe et avec un message par erreur :

- un `formatVersion` inconnu, une `family` qui n'est pas un slug kebab-case ;
- un bloc hors des bornes de la page, ou dont la page dépasse `page.count` ;
- plus de 60 blocs ;
- une source inconnue ou de type incompatible ;
- un bloc `image` portant à la fois `source` et `asset`, ou aucun des deux ;
- une ressource ou une police déclarée mais absente du paquet ;
- un `style.font` sans `alias` correspondant ;
- `overflow: "shrink"` sans `minSizePx`, ou un `minSizePx` supérieur au `sizePx` ;
- une couleur ni hexadécimale ni source de couleur ;
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
