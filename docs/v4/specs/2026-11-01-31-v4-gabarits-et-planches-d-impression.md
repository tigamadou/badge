# Spec v4 — Gabarits d'impression et planches de badges

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : nouvelle fonctionnalité
> **Périmètre** : v4 — espace `/platform` (nouveau groupe « Impression »), `src/lib/print-sheets/**`, worker
> **Plan** : à rédiger
> **Chantier** : service d'impression, spec 1 sur 5 — voir aussi les specs
> [32](2026-11-01-32-v4-catalogue-produits-d-impression.md),
> [33](2026-11-01-33-v4-demandes-d-impression-et-devis.md),
> [34](2026-11-01-34-v4-paiement-des-devis-d-impression.md),
> [35](2026-11-01-35-v4-impression-pendant-l-evenement.md)

## Contexte

Badge rend chaque badge en PDF, à la taille exacte de son template (recto en page 1, verso en
page 2), via le service Chromium de `@tigamadou/pdf-engine` (`renderBadgePdf`,
`src/lib/badge-templates/render-badge.ts`). Le seul export groupé est un ZIP d'un PDF par
badge, pensé pour une imprimante à badges (`…/badges/print-zip`, 200 badges au plus).

L'admin de la plateforme imprime les badges des évènements chez un **imprimeur
professionnel**, sur des feuilles grand format (A3), découpées **au massicot**. Il lui faut un
PDF de **planches** : plusieurs badges par feuille, placés au point près, avec traits de coupe.
Aucune fonction d'imposition ni de fusion de PDF n'existe aujourd'hui.

Cette spec est la première du **service d'impression** : les organisateurs demanderont
l'impression de leurs badges (spec 33), l'admin la réalisera avec les planches décrites ici.

## Objectif

Un admin définit une fois pour toutes quelques **gabarits** (format de feuille, marges,
espaces, orientations). Pour imprimer les badges d'un évènement, il choisit un gabarit : Badge
calcule seul la grille à partir de la taille du badge et produit un PDF de planches, avec un
aperçu.

## Décisions (validées par l'utilisateur le 2026-11-01)

1. **Imprimeur professionnel, découpe au massicot.**
2. **Un format de badge par évènement**, mais le format change d'un évènement à l'autre : le
   gabarit **ne dépend pas du badge**. La grille se calcule à partir des dimensions du badge
   reçu. Pas un gabarit par document.
3. Sur une feuille A3 (par exemple), on place autant de badges que possible et on produit
   **autant de feuilles que nécessaire** pour tous les badges.
4. **Recto-verso en option.**
5. **Aucun décalage toléré** : un décalage ruine l'impression et la découpe.
6. **Pas de fond perdu.** Les badges sont posés tels quels, rien n'est prolongé.
7. **Badges espacés**, jamais collés. Espace horizontal et espace vertical **réglables**, ainsi
   que les **marges** du gabarit.
8. **Rotation automatique des badges** si elle permet d'en placer davantage, et **orientation
   réglable** : celle de la feuille et celle des badges.
9. **Tout vit dans Badge**, rien dans pdfStudio.
10. **C'est l'admin qui règle les gabarits**, puisque c'est lui qui imprime. Les organisateurs
    n'y ont pas accès.
11. Il faut un **aperçu** des planches.
12. Pour l'instant, **seulement les badges**.

## Choix de conception (arbitrages de l'agent, à relire)

### Le gabarit

Modèle `PrintSheetLayout` (« gabarit d'impression »), soft delete comme le reste :

| Champ | Contenu |
|---|---|
| `name` | libellé unique, ex. « A3 imprimeur Cotonou » |
| `sheetWidthMm`, `sheetHeightMm` | format de la feuille ; préréglages A3 (297 × 420), A4, SRA3 (320 × 450), ou libre |
| `sheetOrientation` | `PORTRAIT` \| `LANDSCAPE` (le format est stocké en portrait, l'orientation le tourne) |
| `marginTopMm`, `marginRightMm`, `marginBottomMm`, `marginLeftMm` | marges de la feuille |
| `gapHorizontalMm`, `gapVerticalMm` | espace entre deux colonnes, entre deux lignes |
| `badgeOrientation` | `AUTO` \| `ORIGINAL` \| `ROTATED` (pivoté de 90°) |
| `duplexFlip` | `LONG_EDGE` \| `SHORT_EDGE` : bord de retournement de la feuille en recto-verso, à régler selon la presse de l'imprimeur (défaut `LONG_EDGE`) |
| `cropMarks` | booléen, défaut vrai |
| `archived`, `archivedAt`, `createdById`, dates | comme les autres catalogues |

- **Unités** : toutes les longueurs sont stockées en **dixièmes de millimètre** (entiers) pour
  éviter les arrondis flottants ; l'interface saisit des millimètres avec une décimale.
- Le badge, lui, est connu en px CSS à 96 dpi (`InstalledBadgeTemplate.pageWidthPx/HeightPx`) ;
  conversion px → mm : × 25,4 / 96 ; mm → pt PDF : × 72 / 25,4.

### Le calcul de la grille

Une fonction pure, sans base ni réseau, partagée par l'aperçu et la génération :
`computeSheetLayout(layout, badge: { widthMm, heightMm, pages: 1 | 2 })` dans
`src/lib/print-sheets/compute-layout.ts`. Elle renvoie :

- l'orientation retenue pour les badges, le nombre de colonnes et de lignes, le nombre de
  badges par feuille ;
- la position exacte (en pt, origine en bas à gauche comme en PDF) de chaque emplacement du
  recto et du verso ;
- la position des traits de coupe ;
- des avertissements (traits de coupe impossibles, place perdue importante…).

Règles :

1. Zone utile = feuille moins les marges. Colonnes = `floor((utile + gap) / (largeur + gap))`,
   idem pour les lignes.
2. `AUTO` calcule les deux orientations et garde celle qui place le plus de badges ; à égalité,
   l'orientation d'origine.
3. **La grille est centrée** dans la zone utile (les marges sont des minimums), pour que la
   feuille reste équilibrée.
4. **Jamais de mise à l'échelle** : un badge est posé à 100 %. Si aucun badge ne tient, le
   gabarit est refusé pour ce badge (`BADGE_TOO_LARGE`).
5. **Traits de coupe** : dans les marges, dans le prolongement de chaque bord de badge (deux
   traits par colonne en haut et en bas, deux par ligne à gauche et à droite), longueur 5 mm,
   décalés de 2 mm de la zone des badges, filet 0,25 pt noir de repérage. Si une marge fait
   moins de 7 mm, les traits de ce côté sont omis et l'aperçu l'indique. Rien n'est tracé entre
   les badges.
6. **Recto-verso** : la feuille de versos est la symétrique de la feuille de rectos selon
   l'axe de retournement (`duplexFlip`). Chaque verso est posé exactement derrière son recto,
   avec la rotation qui le remet à l'endroit une fois la feuille retournée. Le constructeur
   dérive les transformations ; elles sont couvertes par les tests (voir critères).
7. Dernière feuille : partiellement remplie, emplacements remplis dans l'ordre de lecture
   (gauche à droite, haut en bas) ; au verso, les mêmes emplacements en miroir.

### La génération

- **Entrée** : un évènement, un gabarit, une liste d'inscriptions (toutes les `APPROVED`, une
  catégorie, ou une sélection), et le recto-verso (voir plus bas).
- **Ordre des badges** : catégorie (`number`), puis nom, puis prénom ; l'ordre est figé à la
  création de la génération et affiché, pour que l'admin retrouve un badge sur une planche.
  Pour une génération lancée depuis une demande d'impression (spec 33), l'ordre est celui de
  la demande (`PrintRequestItem.position`, calculé à l'envoi avec la même règle).
- **Recto-verso** : il suit le template (2 pages = recto-verso). Une génération autonome
  permet de ne tirer que les rectos ; une génération liée à une demande suit la demande.
- **Rendu** : chaque badge est rendu par `renderBadgePdf` (inchangé, concurrence
  `BATCH_RENDER_CONCURRENCY`), puis les pages sont **posées comme objets vectoriels** sur les
  feuilles avec **`pdf-lib`** (nouvelle dépendance, JavaScript pur) : `embedPdf` / `drawPage`
  aux positions calculées, avec rotation. Aucun re-rendu, aucune rastérisation.
- **Ordre des pages du PDF** : en recto-verso, feuille 1 recto, feuille 1 verso, feuille 2
  recto… ; sinon, une page par feuille.
- **Asynchrone** : un évènement peut compter des milliers de badges (le rendu prend plusieurs
  minutes). Nouveau `JobType` `PRINT_SHEETS` traité par le worker existant. Le résultat est
  stocké en S3 (`print-sheets/{generationId}.pdf`) et servi seulement au staff (nouvelle
  famille de clés sensibles dans `/api/files` : `print-sheets/` réservé au staff, `no-store`).
- **Le worker ne sait aujourd'hui traiter que des emails** (vérifié le 2026-11-01) : à faire
  dans ce chantier :
  - `claimEmailJobs` filtre `type = 'EMAIL'` et `processJob` lit un payload d'email : la
    boucle doit réclamer et aiguiller les jobs par type ; `failJob` ne notifie
    `EMAIL_FAILED` que pour les emails (un échec de génération passe la génération en
    `FAILED` et notifie son auteur) ;
  - le conteneur `worker` n'a ni `RENDERER_URL` ni accès au réseau `rendu` dans les
    `docker-compose*.yml` (dev, preprod, prod) : les ajouter ;
  - `STALE_LOCK_MS` (10 min) est plus court qu'une grosse génération : le job
    `PRINT_SHEETS` renouvelle son verrou à chaque lot de badges rendus, pour ne jamais être
    repris et rendu deux fois.
- Modèle `PrintSheetGeneration` : évènement, gabarit, **copie figée des réglages du gabarit**
  (JSON), recto-verso, liste ordonnée des inscriptions, statut (`PENDING`, `RUNNING`, `DONE`,
  `FAILED`), nombre de feuilles et de badges, clé du fichier, erreur, auteur, dates, et plus
  tard la demande d'impression liée (spec 33, champ nullable).
- **Contrôle d'homogénéité** : tous les badges sont rendus avec le template effectif de
  l'évènement ; chaque PDF rendu est vérifié (taille de page égale à celle attendue, à 0,01 mm
  près). Un écart fait échouer la génération (aucune planche fausse ne sort).
- Une inscription qui n'est plus `APPROVED` au moment du rendu est **écartée** et listée dans
  le résultat.
- Générer des planches **ne marque pas** les badges comme imprimés : le marquage reste l'action
  explicite existante (« Marquer imprimés »).

### Aperçu

- **Schéma immédiat** : sur la page du gabarit et à la génération, un SVG dessiné côté
  navigateur à partir de `computeSheetLayout` : feuille, marges, emplacements numérotés,
  traits de coupe, cotes, et le résumé « 6 badges par feuille, 34 feuilles ». Il se met à jour
  à chaque réglage. Sur la page d'un gabarit, l'admin choisit un template installé ou saisit
  une taille pour voir le résultat.
- **Aperçu réel** : une fois la génération terminée, le PDF s'ouvre dans `DocumentPreview`
  avant téléchargement.

### Écrans et droits

- Nouveau groupe **« Impression »** dans la navigation staff (`StaffShell`, constante `NAV`),
  avec ici l'entrée **« Gabarits »** ; les specs 32 et 33 y ajoutent « Catalogue » et
  « Demandes ».
- `/platform/print/layouts` : liste, création, modification, archivage des gabarits, avec le
  schéma d'aperçu. Lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` (comme les plans).
- `/platform/print/sheets` : historique des générations et bouton « Générer des planches »
  (choix organisation → évènement → badges → gabarit → recto-verso). Lancer une génération et
  télécharger : `STAFF_SUPPORT` minimum.
- Modifier un gabarit ne change pas les générations passées (copie figée).
- `ActivityType` : `PRINT_LAYOUT_CREATED`, `PRINT_LAYOUT_UPDATED`, `PRINT_LAYOUT_ARCHIVED`,
  `PRINT_SHEETS_GENERATED`, avec les libellés dans `activity-labels.ts`.

## Non-objectifs

- Fond perdu, prolongement des aplats, repères de calage couleur, gestion CMJN.
- Badges collés (coupe commune).
- Badges de tailles différentes sur une même planche.
- Imposition d'autres documents que les badges.
- Envoi automatique du PDF à l'imprimeur.
- Toute modification de pdfStudio ou du moteur.

## Critères d'acceptation

- Badge 84 × 120 mm sur A3 portrait, marges 10 mm, espaces 5 mm, orientation `AUTO` : le
  calcul donne la grille qui place le plus de badges et l'aperçu l'affiche.
- Les positions calculées sont vérifiées par des tests unitaires au centième de millimètre,
  pour chaque combinaison d'orientation de feuille, d'orientation de badge et de bord de
  retournement.
- **Test de superposition recto-verso** : un PDF de contrôle où chaque face porte son numéro et
  une flèche « haut ». En retournant (virtuellement) la feuille selon `duplexFlip`, chaque
  verso est exactement derrière son recto et à l'endroit (test automatisé sur les positions,
  plus une vérification papier par l'utilisateur avant la première vraie commande).
- Un PDF généré a des pages au format exact de la feuille et chaque badge y est à 100 %
  (dimensions de l'objet posé égales à celles du badge).
- 1 000 badges : la génération aboutit dans le worker sans bloquer l'application.
- Un gabarit dans lequel le badge ne tient pas est refusé avec un message clair.
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**` ; e2e de la page des
  gabarits et d'une génération.
