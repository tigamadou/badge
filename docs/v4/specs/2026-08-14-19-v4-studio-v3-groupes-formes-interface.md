# Spec v4 — Studio v3 : groupes, formes et interface en trois colonnes

> **Statut** : conception validée — 2026-08-14 — **à implémenter**
> **Type** : extension du format déclaratif + refonte de l'interface du studio
> **Périmètre** : v4
> **Dépend de** : [`2026-08-14-18-…studio-v2-editeur-dynamique`](2026-08-14-18-v4-studio-v2-editeur-dynamique.md)
> **Source** : demandes utilisateur du 2026-08-14

## Contexte et objectifs

Le studio v2 (spec 18) fonctionne mais son interface reste fruste : deux colonnes, des
onglets, des formulaires bruts, des blocs numérotés dépliés dans une liste. Objectif :
une interface **façon Figma/Photoshop** — trois colonnes, panneau de calques, inspecteur
contextuel, contrôles adaptés à la nature de chaque propriété — et un modèle de
composition plus riche : **nommer** les blocs, les **grouper** et les **imbriquer**,
poser des **formes** (rectangle, carré, cercle).

## Décisions tranchées

### Format déclaratif

| Sujet | Décision | Pourquoi |
|---|---|---|
| Nom de bloc | `name?: string` (1–60 caractères) sur tout bloc | Arbitrage utilisateur du 2026-08-14. Purement descriptif : la liste l'affiche à la place du libellé de type ; aucun effet sur le rendu. |
| Groupes | Nouveau type **`group`** : vrai conteneur — `{ type, name?, page, x, y, w, h, opacity?, rotate?, visibleIf?, blocks: Block[] }`. Les **enfants ont des coordonnées relatives au groupe** ; déplacer / pivoter / atténuer / masquer le groupe agit sur tout son contenu ; **imbrication libre** (des groupes dans des groupes). | Arbitrage utilisateur du 2026-08-14 : le modèle Figma, pas un dossier visuel. `@react-pdf` positionne l'absolu relativement au parent : le groupe est une `View` et ses enfants s'y placent naturellement. |
| `page` et groupes | `page` devient **optionnel dans le type** ; la validation l'**exige à la racine** et le **refuse sur les enfants** d'un groupe (la page du groupe racine s'applique à tout l'arbre). | Un enfant portant sa propre page serait un non-sens ; l'erreur explicite vaut mieux qu'un champ ignoré. |
| Formes | Nouveaux types **`square`** et **`circle`**, mêmes champs qu'un `rect` (bordures, opacité, rotation, conditions) avec : `square` → la validation **exige w = h** (le `radiusPx` reste permis, carré arrondi) ; `circle` → **pas de `radiusPx`** (le rayon est implicite : `min(w,h)/2`, une ellipse si w ≠ h). | Arbitrage utilisateur du 2026-08-14 : de vrais types, lisibles dans le manifeste et dans la liste, plutôt que des raccourcis d'un rect. |
| Fond des formes | Chaque forme (`rect`, `square`, `circle`) porte un **fond** : `fill?: string` (couleur hexa ou source couleur) **et/ou** `image?: { source?, asset?, fit? }` (source image du contexte OU ressource du paquet, cadrage `cover`/`contain`/`fill`, `cover` par défaut). Au moins l'un des deux est exigé ; les deux ensemble = couleur visible sous une image `contain` ou transparente. L'image est **rognée par la forme** (coins arrondis, cercle). | Arbitrage utilisateur du 2026-08-14 : « une couleur de fond, ou une image comme fond ». |
| Type `image` | **Supprimé.** Une image se pose désormais via le fond d'une forme ; `objectFit` devient `image.fit`. **Breaking pré-déploiement** : les manifestes du dépôt (seeds, ateliers) migrent mécaniquement (`type: "image"` → `type: "rect"` + `image: {…}`) dans le même changement. Le QR reste un type à part. | Arbitrage utilisateur du 2026-08-14 : moins de types, un seul modèle « forme + fond ». |
| Plafond de blocs | `MAX_BLOCKS` (60) compte l'arbre **aplati** (groupes et enfants inclus, à toute profondeur). | Le coût de rendu dépend du nombre de nœuds, pas de leur nesting. |
| Validations transverses | Toutes les vérifications par bloc (sources, couleurs, polices, assets, règles texte) **descendent récursivement** dans les groupes ; les messages nomment le chemin (« bloc 3 › 2 : … »). | Une erreur enfouie dans un groupe doit rester localisable. |

### Interface (trois colonnes, thème sombre)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Disposition | `280px | 1fr | 300px`. **Gauche** : panneau **Blocs** (haut) façon calques + panneau **Contexte** (bas, sections repliables + presets). **Centre** : canvas sombre, PDF centré avec ombre, erreurs en bandeau discret sous le canvas. **Droite** : **inspecteur** du bloc sélectionné ; sans sélection → propriétés du **Paquet** (famille, libellé, description, aperçu, polices, ressources). | Arbitrage utilisateur du 2026-08-14 : gauche = contexte et blocs, centre = PDF, droite = configuration. |
| Liste des blocs | **Sans numéros** : icône + libellé de type (Texte, QR Code, Rectangle, Carré, Cercle, Groupe) ou le `name` s'il existe ; **arbre indenté** pour les groupes (plier/déplier) ; sélection au clic ; actions ↑ ↓ ⧉ ✕ au survol. | Arbitrage utilisateur du 2026-08-14. |
| Renommer | Bouton crayon (ou double-clic) sur l'entrée → édition inline du `name` ; vider le champ supprime le nom (retour au libellé de type). | |
| Grouper / dégrouper | Cases de sélection multiple dans la liste → bouton **Grouper** : calcule le cadre englobant, convertit les coordonnées des blocs choisis en relatif et les enveloppe dans un `group` (même page exigée). **Dégrouper** sur un groupe sélectionné : reconvertit les enfants en absolu et les remonte d'un niveau. Refusé (avec explication) si le groupe porte `rotate`, `opacity` ou `visibleIf` : ces effets de conteneur ne se reportent pas sur les enfants sans changer le rendu — les retirer d'abord. | Alternative au drag & drop (hors périmètre) ; opérations réversibles et sans perte, jamais de dégroupage qui altère le PDF. |
| JSON | Le bouton **JSON** de la barre supérieure bascule la colonne de droite entre inspecteur et éditeur JSON synchronisé. | La double vue de la spec 18 survit au nouveau layout. |
| Contrôles par nature | Position/taille : grille compacte **X Y W H** ; opacité : **slider** 0–100 % ; rotation : slider −180/+180 + champ ; alignement, casse, débordement : **segmented controls** ; italique/souligné/barré : boutons-bascules ; couleur : swatch + hexa + menu source en un contrôle ; coins : champ global + bascule « par coin » ; bordures : section activable ; uploads : zones de dépôt avec vignette. | « Rendre les contrôles intuitifs selon leur nature » — demande utilisateur. |
| Thème | **Sombre uniquement** (panneaux `#2c2c2c`, canvas `#1e1e1e`, accent `#30d59b`, typo 12–13 px). | Outil de création local ; un seul thème soigné vaut mieux que deux moyens. |

### Alternatives écartées

| Alternative | Raison |
|---|---|
| Groupes « dossiers visuels » (coordonnées absolues conservées) | Trompeur : bouger un groupe ne bougerait rien au PDF. |
| Carré/cercle comme raccourcis d'un `rect` | Écarté par l'utilisateur : il veut des types explicites. |
| Drag & drop des blocs (canvas ou liste) | Toujours hors périmètre (position spec 16/18) ; le grouper-par-sélection couvre le besoin. |
| Thème clair/sombre suivant le système | Un seul thème sombre, assumé. |

## Rendu des groupes (moteur)

```tsx
if (block.type === "group") {
  return (
    <View key={key} style={{ ...frame(block) }}>
      {block.blocks
        .filter((child) => isBlockVisible(ctx, child.visibleIf))
        .map((child, i) => renderBlock(child, ctx, assets, fontMap, `${key}-${i}`))}
    </View>
  );
}
```

`frame()` porte déjà position, taille, opacité et rotation : l'opacité et la rotation
d'un groupe s'appliquent à la `View` conteneur, donc à tout l'arbre. Le filtre de page
ne s'applique qu'à la racine.

Une forme rend une `View` (fond couleur, bordures, coins, `overflow: "hidden"`)
contenant, si un fond image est déclaré, une `Image` à 100 % × 100 % avec son
`objectFit` — le rognage par la forme (coins, cercle) est porté par la `View`.
`circle` force `borderRadius = px(min(w, h) / 2)` et ignore `radiusStyles`.

## Hors périmètre

Drag & drop, alignements automatiques/magnétisme, multi-sélection dans l'inspecteur,
verrouillage de blocs, thème clair.

## Critères d'acceptation

1. Un manifeste avec groupes imbriqués (2 niveaux), carré, cercle (fonds couleur et image) et blocs nommés est validé et rend un PDF où déplacer/pivoter/masquer le groupe agit sur ses enfants ; un `type: "image"` est refusé.
2. Dans le studio : sélectionner des blocs → Grouper → le PDF ne change pas d'un pixel (conversion relative exacte) ; Dégrouper restitue l'état initial.
3. La liste montre types (sans numéros), noms personnalisés, arbre indenté ; l'inspecteur de droite suit la sélection ; sans sélection il montre le Paquet ; le bouton JSON bascule la colonne de droite.
4. Les contrôles reflètent leur nature (sliders, segmented, swatches, X Y W H) et le thème sombre est appliqué partout.
5. `make lint && make typecheck && make test` verts ; les manifestes du dépôt (seeds et ateliers) sont migrés vers « forme + fond » dans le même changement. La base de données n'est **pas** touchée par ce chantier : les templates installés seront rafraîchis par un re-seed manuel ultérieur.
