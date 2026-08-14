# Spec v4 — Studio v2 : éditeur dynamique de badges

> **Statut** : conception validée — 2026-08-14 — **à implémenter**
> **Type** : outil de développement (studio, service séparé non déployé) + extension du format déclaratif
> **Périmètre** : v4
> **Dépend de** : [`2026-08-14-16-…studio-de-construction-de-templates`](2026-08-14-16-v4-studio-de-construction-de-templates.md) et [`2026-08-14-17-…manifeste-en-pixels`](2026-08-14-17-v4-manifeste-en-pixels.md)
> **Source** : demande utilisateur du 2026-08-14

## Contexte et objectifs

Le studio de la spec 16 est un éditeur JSON brut avec cinq variantes de contexte figées.
L'usage réel (alignement d'`ex-305v` sur sa maquette Figma) a confirmé le besoin pressenti :
éditer les blocs à la main dans du JSON est laborieux, les variantes figées ne couvrent pas
« montrer CE badge avec CETTE photo », et il faut sortir du studio pour empaqueter.

Objectif : un studio complet de **création** de badge — formulaire de contexte libre
(photo comprise), éditeur de blocs dynamique, métadonnées et ressources du paquet gérées
sur place, et génération du zip à téléverser dans l'application. Le tout en exposant le
**maximum de paramètres que le PDF sait réellement afficher**.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| JSON vs formulaires | **Double vue synchronisée** (onglets Blocs / JSON sur le même état) | Arbitrage utilisateur du 2026-08-14. Le formulaire pour le confort, le JSON pour les cas fins (copier-coller, diff, visibleIf complexes). JSON invalide → l'état et l'aperçu ne sont pas écrasés (règle spec 16 conservée). |
| Stack UI | **Preact + htm, sans build**, fichiers vendorisés dans `studio/public/vendor/` (~25 Ko, MIT) | Arbitrage utilisateur du 2026-08-14. L'état réactif rend la double vue et les listes dynamiques maintenables ; pas de CDN, pas d'étape de compilation, l'esprit « outil simple » de la spec 16 est conservé. |
| Contexte de prévisualisation | **Formulaire libre** remplaçant les variantes ; les anciennes variantes deviennent des **presets** qui préremplissent le formulaire | On peut générer un badge complet en fournissant le maximum d'informations : identité, structure, photo (upload → dataURL), logo, titre/lieu/date, catégorie et ses interrupteurs anonyme/neutre, id et URL de vérification (QR généré réellement côté serveur). |
| Export du paquet | **Téléchargement navigateur** : « Générer le paquet » enregistre le manifeste puis packe **depuis le disque** en réutilisant `packTemplate` | Arbitrage utilisateur du 2026-08-14. Un seul chemin de vérité, celui de `make pack-badge-template` ; le zip reste le sas vers l'application. |
| Ombres (`box-shadow`) | **Non supporté, assumé** | Arbitrage utilisateur du 2026-08-14. `@react-pdf` n'a ni ombre portée ni flou ; pas de simulacre. |
| Dégradés | **Reportés** | Arbitrage utilisateur du 2026-08-14. Possibles via SVG `LinearGradient`, à spécifier si une maquette réelle le demande. |
| Ressources du paquet | **Upload depuis le studio** vers `assets/` / `fonts/` avec les garde-fous existants (sniff d'en-têtes, 5 Mo JPEG/PNG, 2 Mo TTF/OTF) ; pas de suppression ni renommage | Nécessaire pour un studio autonome ; la suppression se fait dans le Finder. |
| Polices | Le dossier de l'atelier est la **source unique** : upload → `fonts/`, déclaration au formulaire (alias, fichier choisi dans la liste des fichiers présents, graisse, italique), aperçu avec la vraie police, zip embarquant `fonts/` tel quel via `packTemplate`. Montserrat (défaut, Google Fonts) ne voyage jamais dans le paquet. Le studio avertit inline si une déclaration pointe un fichier absent du disque. | Aucun stockage parallèle : ce qui est dans l'atelier est ce qui part dans le zip, et `parseManifest` reste le seul juge à l'empaquetage. |
| Nouveau template | Bouton dans le studio, réutilise `createSkeleton` | La brique existe (`make new-badge-template`). |

### Alternatives écartées

| Alternative | Raison |
|---|---|
| Formulaire seul (JSON retiré de l'interface) | Perd l'accès aux cas que le formulaire ne couvre pas encore. |
| JSON principal + inspecteur latéral | Moins ambitieux que le besoin exprimé (construction complète au formulaire). |
| Vanilla JS renforcé | Synchronisation formulaires/JSON et listes dynamiques verbeuses et fragiles sans état réactif. |
| Vite + React | Build et configuration disproportionnés (déjà écarté en spec 16). |
| Drag & drop des blocs sur l'aperçu | Hors périmètre — manipulation directe = produit distinct (position spec 16 maintenue). |
| Installation directe dans l'application depuis le studio | Le zip téléversé reste le sas ; pas de couplage studio ↔ base. |

## Enrichissement du format déclaratif

Nouveaux paramètres, cantonnés à ce que `@react-pdf` rend réellement :

**Communs à tous les blocs** (`text`, `image`, `qr`, `rect`) :
- `opacity` (0–1) ;
- `rotate` (degrés, sens horaire, ±360) — étendu du texte à tous les types ;
- bordures complètes : `borderWidthPx`, `borderColor`, `borderStyle` (`solid`/`dashed`/`dotted`), déclinables par côté — **remplace `borderTopPx`**, qui disparaît (breaking pré-déploiement, migration des manifestes du dépôt dans le même changement) ;
- coins arrondis par coin : `radiusPx` accepte un nombre ou `{topLeft, topRight, bottomRight, bottomLeft}` — et s'étend aux blocs `qr`.

**Blocs `text`** :
- `fontStyle: "italic"` (Montserrat italique enregistrée par défaut ; une police embarquée peut déclarer `style: "italic"` dans sa déclaration `fonts`) ;
- `textDecoration` : `underline` / `line-through` ;
- `align: "justify"` en plus de left/center/right ;
- `maxLines` (entier ≥ 1) avec ellipsis natif — complète `shrink`/`truncate` pour le multi-ligne ;
- `backgroundColor` et `paddingPx` (nombre unique, appliqué aux quatre côtés) sur le cadre (étiquettes, pastilles).

**Blocs `image`** :
- `objectFit` : `cover` (défaut actuel) / `contain` / `fill` — indispensable pour les logos.

La règle de hauteur minimale des cadres texte (h ≥ 1,45 × police par ligne, sous peine de
texte avalé) reste documentée ; le studio affichera un avertissement quand un bloc la viole.

## Architecture cible

```
studio/
  server.ts        — aiguillage des routes, fichiers statiques (inchangé dans son role)
  workshop.ts      — atelier : liste, lecture, ecriture, creation, upload de ressources
  render.tsx       — validation + rendu PDF depuis {manifest, context}
  context.ts       — TemplateContext par defaut + presets (ex-variantes) + fusion des
                     valeurs du formulaire (QR genere cote serveur depuis verifyUrl)
  pack.ts          — enregistre puis delegue a scripts/pack-badge-template.packTemplate
  public/
    index.html     — squelette + montage Preact
    app.js         — application Preact/htm (onglets, etat, apercu)
    vendor/        — preact.mjs, htm.mjs (copies locales, MIT, versions figees)
```

### API du serveur (ajouts / changements)

| Route | Rôle |
|---|---|
| `POST /api/render` | `{name, manifest, context}` → PDF. **`variant` disparaît** ; `context` est un `TemplateContext` partiel fusionné aux défauts, QR généré du `verifyUrl`. |
| `GET /api/schema-info` | Sources (`SOURCES`), chemins de condition (`CONDITION_PATHS`), types de blocs et bornes — alimente les listes déroulantes du client. |
| `POST /api/templates` | `{name}` → scaffold via `createSkeleton`. |
| `POST /api/templates/:name/assets` | Upload d'une ressource (`assets/` ou `fonts/`), sniff + limites de taille. |
| `POST /api/templates/:name/pack` | Enregistre le manifeste fourni puis renvoie le zip (`packTemplate`). |

### Synchronisation de l'état (client)

Un seul état source : l'objet manifeste. Onglet **Blocs** : liste (résumé par bloc,
ajouter par type, dupliquer, supprimer, monter/descendre) + formulaire typé par bloc
(champs communs, spécifiques, éditeur `visibleIf` en liste de conditions, listes
déroulantes alimentées par `/api/schema-info`). Onglet **JSON** : textarea sérialisant le
même état ; parse à l'édition, erreurs affichées sans écraser l'état. Les erreurs
`parseManifest` remontent sous l'aperçu, rattachées au bloc quand l'index est présent
dans le message.

## Tests

- **TDD serveur et logique** : routes (`render` avec contexte, `schema-info`, scaffold, upload avec sniff et limites, pack), `context.ts` (fusion défauts/partiel, presets), enrichissements du format (schéma + renderer, y compris migration `borderTopPx` → bordures complètes).
- **UI Preact** : vérification manuelle au navigateur (golden path + cas limites), comme aujourd'hui — pas de harnais de test UI pour un outil de dev.
- Migration des manifestes du dépôt et des squelettes dans le même changement que le schéma.

## Hors périmètre

Drag & drop sur l'aperçu, édition visuelle directe, installation directe dans
l'application, suppression/renommage de ressources, ombres, dégradés, multi-sélection.

## Critères d'acceptation

1. Depuis un studio vierge : créer un template, uploader une photo de contexte et un fond, composer des blocs au formulaire, voir l'aperçu à chaque étape, télécharger un zip qui s'installe sans erreur dans `/platform/badge-templates`.
2. L'onglet JSON et l'onglet Blocs restent cohérents dans les deux sens ; un JSON invalide n'écrase ni l'état ni l'aperçu.
3. Tous les nouveaux paramètres de style rendent dans le PDF (bordures par côté, coins par coin, opacité, rotation sur tout type, italic, décoration, justify, maxLines, padding/fond de texte, objectFit).
4. `make lint && make typecheck && make test` verts ; garde-fous d'upload respectés.
