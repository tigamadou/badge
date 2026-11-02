# Planches d'impression

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-11-01-31-v4-gabarits-et-planches-d-impression.md`](../specs/2026-11-01-31-v4-gabarits-et-planches-d-impression.md).

## État actuel

Le staff de la plateforme compose des **planches PDF** pour l'imprimeur : plusieurs badges par
feuille grand format (A3, SRA3…), placés au point près, avec traits de coupe, prêtes pour la
découpe au massicot. Tout vit dans Badge ; les badges sont rendus par le service de rendu
(`renderBadgePdf`) puis **posés comme objets vectoriels** avec `pdf-lib`, sans re-rendu ni
rastérisation, et **jamais mis à l'échelle** (100 %).

| Écran | Rôle | Droits |
|---|---|---|
| `/platform/print/layouts` (« Gabarits ») | Liste des gabarits en cartes (miniature de la zone utile sans emplacements, format, marges et espacements), archivage | Lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` |
| `/platform/print/layouts/new`, `/platform/print/layouts/[layoutId]` | Éditeur d'un gabarit avec aperçu en direct ; lecture seule sous `STAFF_ADMIN`, `/new` redirige vers la liste | Lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` |
| `/platform/print/sheets` (« Planches ») | Lancer une génération, historique, aperçu et téléchargement | `STAFF_SUPPORT` minimum (`STAFF_OBSERVER` est redirigé vers `/platform`) |

Les deux entrées sont dans le groupe « Impression » de la navigation staff (`StaffShell`).
Les organisateurs n'ont accès ni aux gabarits ni aux planches.

## Gabarits

Modèle `PrintSheetLayout` (suppression logique : `archived`, `archivedAt`). Le nom est unique
(`NAME_TAKEN` affiché sous le champ). Toutes les longueurs sont stockées en **dixièmes de
millimètre** (entiers) ; l'interface saisit des millimètres.

| Réglage | Contenu |
|---|---|
| Format | préréglages A3 (297 × 420), A4 (210 × 297), SRA3 (320 × 450) ou libre ; stocké en portrait (largeur ≤ hauteur) |
| Orientation de la feuille | `PORTRAIT` ou `LANDSCAPE` |
| Marges | haute, droite, basse, gauche (minimums) |
| Espaces | horizontal (entre colonnes) et vertical (entre lignes) |
| Orientation des badges | `AUTO`, `ORIGINAL` ou `ROTATED` (pivoté de 90°) |
| Retournement recto-verso | `LONG_EDGE` (défaut) ou `SHORT_EDGE` |
| Traits de coupe | oui par défaut |

Seul l'éditeur affiche un **badge témoin** (template installé ou taille libre, premier
template par défaut) qui sert à annoncer « N badges par feuille » ; la liste n'en a pas et
aucun paramètre d'URL ne le transmet. Pour un template
installé, l'écran indique s'il est **recto-verso** (deux pages) ou **recto seul** ; la liste
déroulante le signale aussi (« · recto-verso »).

L'éditeur regroupe les réglages par section (identité, feuille, marges et espacements,
disposition, impression) : format et orientations se choisissent par tuiles, les quatre marges
s'éditent autour d'un schéma de la zone utile et peuvent être liées (« Marges identiques »).
L'aperçu en direct, en grande colonne collante à gauche (les réglages sont à droite), dessine la planche sur un fond sombre (`#1D2128`) ; les
cartes de la liste en reprennent une miniature. Modifier un gabarit ne change pas les
générations passées : leurs réglages sont **figés à la création** (`layoutSnapshot`). Un
gabarit archivé ne peut plus servir à générer.

Le seed (minimal comme démo) crée un gabarit par défaut, **« A3 standard »** : A3 portrait,
marges de 10 mm, **5 mm** d'espace horizontal et vertical entre les badges, orientation
automatique, retournement sur le bord long, traits de coupe. Il est créé une seule fois (par
nom) : un gabarit déjà présent, même retouché par le staff, n'est pas modifié.

## Calcul de la grille

Fonction pure partagée par l'aperçu et la génération :
`computeSheetLayout` dans `src/lib/print-sheets/compute-layout.ts`.

1. **Zone utile** = feuille moins les marges. Colonnes = `floor((utile + espace) / (largeur +
   espace))`, idem pour les lignes.
2. **`AUTO`** calcule les deux orientations et garde celle qui place le plus de badges ; à
   égalité, l'orientation d'origine. `ORIGINAL` et `ROTATED` imposent la leur.
3. **La grille est centrée** dans la zone utile : les marges sont des minimums.
4. **Aucune mise à l'échelle.** Si aucun badge ne tient, le gabarit est refusé pour ce badge
   (`BADGE_TOO_LARGE`, « Ce badge ne tient pas dans ce gabarit » dans la liste).
5. **Traits de coupe** : dans les marges, dans le prolongement de chaque bord de badge, longueur
   **5 mm**, décalés de **2 mm** de la zone des badges, filet noir de 0,25 pt. Rien n'est tracé
   entre les badges. Si une marge fait **moins de 7 mm** (5 + 2), les traits de ce côté sont
   **omis** et l'aperçu l'indique par un avertissement.
6. La dernière feuille est remplie dans l'ordre de lecture (gauche à droite, haut en bas).

## Recto-verso et bord de retournement

Le recto-verso suit le template : il n'est proposé que si le template de l'évènement a deux
pages. Les pages du PDF alternent : feuille 1 recto, feuille 1 verso, feuille 2 recto, etc. ;
sans recto-verso, une page par feuille.

La feuille de versos est la **symétrique** de la feuille de rectos selon l'axe de retournement
du gabarit : `LONG_EDGE` (retournement sur le bord long) ou `SHORT_EDGE` (bord court). La règle
est **chaque verso derrière son recto**, avec la rotation qui le remet à l'endroit une fois la
feuille retournée, y compris pour les badges pivotés. Les transformations sont couvertes par
les tests unitaires.

## Rognage au format

Le service de rendu produit des pages **légèrement plus grandes** que le format du template
(de l'ordre de 0,1 à 0,4 mm). Chaque page de badge est donc contrôlée puis **rognée au format
exact en conservant le coin haut-gauche**. La tolérance est de **0 à 2 mm au-dessus du format**
(plus petit que le format, à 0,01 mm près, ou plus grand de plus de 2 mm : la génération
échoue, aucune planche fausse ne sort ; message : « le badge n° N n'a pas le format attendu (le template a peut-être changé depuis la création) »). Un PDF de badge illisible ou sans la page attendue
fait aussi échouer la génération.

## Génération asynchrone

Un évènement peut compter des milliers de badges : le rendu prend plusieurs minutes. La table
`PrintSheetGeneration` sert elle-même de file, sans passer par `Job` (la file d'emails et
`/platform/jobs` restent inchangés).

- Formulaire : organisation → évènement → sélection (`ALL` = tous les approuvés, `CATEGORIES`,
  `IDS` = sélection manuelle) → gabarit → recto-verso (si le template a deux pages).
- Ordre des badges : catégorie (`number`), nom, prénom, figé à la création. Une inscription qui
  n'est plus `APPROVED` au rendu est **écartée** et listée sur la ligne (« N badges écartés »).
- Statuts : `PENDING` (« En attente »), `RUNNING` (« En cours »), `DONE` (« Terminée »),
  `FAILED` (« Échec », avec le message). Pas de notification.
- Le worker lance **au plus une génération à la fois**, en parallèle des emails. Il met à jour
  un **battement de cœur** après chaque badge rendu. Une génération `RUNNING` sans battement
  depuis **3 minutes** (`PRINT_SHEETS_STALE_MS`) est reprise ; au plus **3 tentatives**
  (`PRINT_SHEETS_MAX_ATTEMPTS`), puis `FAILED`.
- Le PDF est stocké en `print-sheets/{id}.pdf`, servi par `/api/files` aux seuls
  `STAFF_SUPPORT`+ (réponse `403` sinon, `Cache-Control: private, no-store`).
- L'historique (50 dernières générations) se rafraîchit toutes les **5 s** tant qu'une ligne
  est en attente ou en cours et que l'onglet est visible. « Aperçu » ouvre le PDF dans la page ;
  « Télécharger » le récupère.
- Générer des planches **ne marque pas** les badges comme imprimés : « Marquer imprimés » reste
  l'action explicite de l'organisateur.
- Journal d'activité : `PRINT_LAYOUT_CREATED`, `PRINT_LAYOUT_UPDATED`,
  `PRINT_LAYOUT_ARCHIVED`, `PRINT_SHEETS_GENERATED`.

## Export ZIP de l'organisateur

L'ancienne route `…/badges/print-zip` (200 badges au plus) est supprimée. L'organisateur
(permission `badge.print`) commande un export depuis le panneau de lot ; la commande est une
`PrintSheetGeneration` de sortie `ZIP` (sans gabarit), traitée par le même worker avec la même
reprise. Le ZIP (un PDF par badge) est stocké en `badge-exports/{eventId}/{id}.zip` et se
télécharge quand il est prêt. **Aucune limite de nombre.** Voir
[`templates-badges.md`](templates-badges.md#export-zip-asynchrone).

### Transport de la sélection (sans limite)

Une sélection peut compter des milliers de badges : elle ne passe **pas par l'URL**.

1. La liste des badges range les identifiants dans `sessionStorage` (clé
   `badge-batch-sel:<clé aléatoire>`, les anciennes sélections sont purgées) et ouvre
   `/event/[eventId]/badges/print?sel=<clé>` dans un nouvel onglet (qui hérite de la copie du
   `sessionStorage` à l'ouverture).
2. La page (garde `badge.print`) affiche `BadgeBatchLoader`, qui relit les identifiants et charge
   les lignes par `POST …/badges/batch` (`badge.print`, évènement archivé permis). La route
   lit par paquets de 5 000 identifiants, renvoie les inscriptions approuvées **dans l'ordre de la
   sélection** avec le strict nécessaire (id, libellé, catégorie, couleur, imprimé) et le nombre
   `ignored` (inconnus, d'un autre évènement ou non approuvés), calculé sur la liste complète.
3. Aucun plafond : plus de `MAX_IDS_READ` ni de lien `?ids=`. Clé absente ou expirée (onglet
   ouvert autrement) : « Sélection introuvable : revenez à la liste des badges. »

### Export identique déjà en cours, attente et reprise

- `POST …/badges/exports` renvoie l'export existant (`200`, sans nouvelle ligne ni entrée de
  journal) si le même utilisateur a déjà, pour le même évènement et la même liste ordonnée
  d'identifiants, un export `PENDING` ou `RUNNING` (double clic, second onglet). Sinon `201`.
- Le panneau retient l'export en cours dans `sessionStorage` (par évènement et sélection) : un
  rechargement reprend le suivi du même export (et, si fini, réaffiche le lien de téléchargement).
- Si l'export reste `PENDING` plus de **5 minutes** (`PENDING_HINT_MS`), le panneau ajoute :
  « Toujours en attente : le traitement peut être retardé. Vous pouvez fermer cette page et
  revenir plus tard. » Le suivi continue.
- L'organisateur ne reçoit **jamais** le message d'erreur du worker (S3, rendu, Prisma) : la vue
  d'export ne contient que le statut, l'écran plateforme du staff garde le détail.

### Arrêt du worker

À l'arrêt (SIGTERM/SIGINT), le worker **rend la réservation** de la génération en cours
(`releaseGeneration` : `PENDING`, `attempts − 1`, conditionnel à `RUNNING` et à son identifiant) :
un autre worker la reprend aussitôt, sans attendre les 3 minutes et sans consommer d'essai. Le run
détaché perd sa condition de propriété et n'écrit plus rien (`LOCK_LOST`). Le mode `--once`
n'amorce ni ne reprend aucune génération (il traite uniquement les emails), pour ne jamais en
laisser une à moitié faite.

## Droits

| Action | Rôle minimum |
|---|---|
| Voir les gabarits | `STAFF_OBSERVER` |
| Créer, modifier, archiver un gabarit | `STAFF_ADMIN` |
| Lancer une génération, voir l'historique, aperçu, téléchargement | `STAFF_SUPPORT` |
| Télécharger un ZIP d'export | staff, ou `badge.print` sur l'évènement |

## Tests

- Unitaires et intégration : `src/lib/print-sheets/`, routes `src/app/api/platform/print/`.
- E2E : `e2e/platform/print-layouts.spec.ts`, `e2e/platform/print-sheets.spec.ts` (génération
  réelle par le worker de dev, PDF téléchargé et pages comptées, `403` hors staff) ;
  `e2e/event/badges.spec.ts` pour le ZIP.

## Limites connues

- **Mémoire non bornée pour de très gros évènements** : les PDF de badge sont gardés en
  mémoire pendant la composition de la planche. Pour un évènement de plusieurs dizaines de
  milliers de badges, découper en plusieurs générations (par catégorie).
- **Le recto-verso doit être validé sur papier avant la première commande.** Imprimer une
  planche de contrôle chez l'imprimeur (ou sur une imprimante recto-verso) et vérifier à la
  lumière que chaque verso est derrière son recto ; régler `duplexFlip` du gabarit selon le
  résultat (`LONG_EDGE` ou `SHORT_EDGE` dépend de la presse).
- Les planches ne portent que des badges (pas d'autres supports).
