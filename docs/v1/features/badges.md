# Badges

## Description fonctionnelle

Le systeme genere des badges PDF imprimables pour les participants approuves. Chaque badge contient un QR code unique, les informations du participant et de l'evenement, et une banniere coloree selon la categorie. Les badges peuvent etre previsualises en ligne, telecharges en PDF et marques comme imprimes (avec notification au participant).

Deux variantes coexistent :
- **Badge nominatif** (`BadgeDocument`) -- nom, prenom, structure, photo et QR code.
- **Badge anonyme** (`BadgeDocumentAnonymous`) -- uniquement un QR code centre + l'identifiant. Utilise pour les categories marquees `anonymous`.

## Structure visuelle du badge nominatif

Dimensions : 100 x 140 mm, orientation portrait (~283 x 397 pt). Police Montserrat (chargee via Google Fonts).

```
+----------------------------------+
|  Logo         Titre evenement    |
|              Lieu, le Date       |
+----------------------------------+  <-- separateur bleu #1a3a7c
|                                  |
|  [Photo]    [QR Code]    | ID | |
|  80x103pt    60x60pt     | v  | |
|                           | e  | |
|                           | r  | |
|                           | t  | |
|                                  |
|    NOM Prenom (formate)          |
|    Structure (formatee)          |
+----------------------------------+
|       ALL ACCESS (si actif)      |  <-- banniere rouge #DC2626
+----------------------------------+
|       NOM CATEGORIE              |  <-- banniere couleur categorie
+----------------------------------+
```

La hauteur de la banniere categorie passe de 120 a 80 quand la banniere ALL ACCESS est presente, afin de conserver les proportions du badge.

Si la categorie a `neutralBadge = true`, la banniere du bas est blanche avec une bordure superieure grise et le nom de la categorie est ecrit dans la couleur de l'equipe au lieu de blanc.

## Structure visuelle du badge anonyme

```
+----------------------------------+
|  Logo         Titre evenement    |
|              Lieu, le Date       |
+----------------------------------+
|                                  |
|          [QR Code 120x120]       |
|                                  |
|              Identifiant         |
|                                  |
+----------------------------------+
|       ALL ACCESS (si actif)      |  <-- banniere rouge
+----------------------------------+
|       NOM CATEGORIE              |
+----------------------------------+
```

Pas de photo, ni de nom, ni de structure -- la categorie est masquee dans le formulaire public et le badge ne contient aucune information personnelle.

## Banniere ALL ACCESS

- Champ `allAccessGranted: boolean` sur l'inscription.
- Toggle disponible sur `/admin/badges/[id]` tant que le badge n'est pas marque comme imprime.
- Disponible aussi bien sur les badges nominatifs que sur les badges anonymes (commit `03f09d3 all access added to anonymous badge`, `29be724 feat: add ALL ACCESS banner to anonymous badges`).
- Bandeau rouge `#DC2626` (`#C00707` dans la variante anonyme), texte "ALL ACCESS" en blanc, lettrage 26pt, espacement de 3.
- La modification est tracee dans le journal d'activite (`BADGE_ALL_ACCESS_TOGGLED`).

## Formatage du nom et de la structure

Implemente dans `src/lib/format-badge-name.ts`.

### `formatBadgeName(firstName, lastName)`

- Le nom de famille est toujours en majuscules et systematiquement preserve en entier tant que possible.
- Longueur max cible : **20 caracteres** (`MAX_BADGE_NAME_LENGTH`).
- Strategie de troncature progressive :
  1. Forme complete `Prenoms NOM`. Si elle tient en 20 caracteres, elle est conservee.
  2. Sinon, les prenoms sont abreges en initiales `X.` un par un, de droite a gauche, jusqu'a tenir la limite.
  3. Si tous les prenoms sont deja en initiales et le resultat depasse encore, les initiales sont supprimees une par une depuis la droite.
  4. Si seul un prenom abrege + nom depasse encore, on conserve uniquement le nom (majuscules).
  5. En dernier recours, le nom seul est tronque a 20 caracteres (sans ellipsis).
- Exemples :
  - `Jean Dupont` -> `Jean DUPONT`
  - `Jean François Alain Dupond` -> `Jean F. A. DUPOND`
  - `Marie Claire Duval` -> `Marie Claire DUVAL`
  - `Jean François Alain Kouassi-Barry` -> `J. F. KOUASSI-BARRY`
  - `Jean-Baptiste Kouassi-Diallo` -> `J. KOUASSI-DIALLO`
  - `Jean Abcdefghijklmnopqrs` -> `ABCDEFGHIJKLMNOPQRS`
  - `("", "Dupont")` -> `DUPONT`

### `formatBadgeStructure(structure)`

- Longueur max : **28 caracteres** (`MAX_BADGE_STRUCTURE_LENGTH`).
- Si la structure depasse, elle est tronquee a 28 caracteres puis suffixee par `...` (longueur finale 31).
- Exemple :
  - `Ministere de la Sante` (21) -> `Ministere de la Sante`
  - `Ministere de l'Enseignement Superieur et de la Recherche` -> `Ministere de l'Enseignement ...`

Historique : limites successives `18` (commit `6147fb4`), `30` chars structure (`289a78a`), ellipsis a 28 (`367deea`), troncature progressive nom a 20 (`da87586`), edge-cases (`e039ad6`).

## Generation de l'identifiant

Format : `[lastDigitCategorie][AAMMJJ][XX][lastDigitCategorie][NNN]` (12 caracteres).

| Segment | Longueur | Description |
|---------|----------|-------------|
| lastDigitCategorie | 1 | Dernier chiffre du numero de categorie (`number % 10`) |
| AAMMJJ | 6 | Date de l'evenement (annee/mois/jour) |
| XX | 2 | Chiffres aleatoires (00-99) |
| lastDigitCategorie | 1 | Repetition du dernier chiffre du numero de categorie |
| NNN | 3 | Compteur sequentiel par categorie (`count + 1`) |

Exemple : categorie numero 17, 2026-05-24, 3e inscription -> `7260524XX73003` (XX aleatoire). Le numero de categorie peut etre 0-999 ; seul le dernier chiffre est encode dans l'ID.

Implementation : `src/lib/generate-id.ts`. Le compteur est obtenu par `prisma.registration.count({ where: { teamId } })`.

## QR Code

- Bibliotheque : `qrcode`
- Contenu : l'identifiant de l'inscription
- Taille : 200px, marge 1, correction d'erreur niveau M
- Format de sortie : Data URL (base64) pour integration dans le PDF et l'apercu web

## Fonctionnalites administrateur

### Liste des badges (`/admin/badges`)

- Filtre la liste sur les inscriptions au statut `APPROVED` uniquement.
- Grille responsive (2 a 5 colonnes selon la largeur d'ecran), avec checkbox de selection par carte.
- Chaque carte montre : photo (ou initiales), nom + prenom, structure, indicateur de couleur + nom de categorie, badge "ALL ACCESS" si actif, statut d'impression.
- Compteur d'inscriptions total en haut a gauche.
- Recherche par nom, prenom, email ou structure (parametre API `search`).
- Filtre par categorie (parametre API `teamId`).
- Filtre par statut d'impression : Tous / Imprime / Non imprime (applique cote client sur la page courante).
- Pagination configurable (defaut 20).
- Bouton "Exporter la page (n)" pour generer un ZIP de toutes les cartes affichees.
- Barre de selection avec bouton "Exporter la selection (n)" et lien "Deselectionner".

### Detail d'un badge (`/admin/badges/[id]`)

**Panneau gauche -- Informations et actions**
- Photo (avec initiales en fallback), nom, structure
- Categorie (couleur + nom), email, ID, statut impression (avec date), statut ALL ACCESS
- Actions disponibles pour les roles `MODERATEUR` et `ADMIN` (masquees pour SUPER_ADMIN) :
  - "Activer / Desactiver ALL ACCESS" (uniquement si le badge n'est pas encore imprime). Ouvre une modale de confirmation.
  - "Marquer comme imprime" (uniquement si les informations de contact email + telephone sont configurees ET si le badge n'est pas encore imprime). Ouvre une modale de confirmation rappelant que l'email sera envoye au participant.
  - Bouton de telechargement PDF (`BadgeDownload`).
  - Lien "Voir l'inscription".
- Message d'avertissement si les informations de contact ne sont pas configurees.

**Panneau droit -- Apercu**
- Rendu PDF en temps reel via `PDFViewer` de `@react-pdf/renderer` (`BadgePreview`). Switch automatique vers la variante anonyme si `team.anonymous`.

### Impression

- Individuelle : bouton "Marquer comme imprime" sur la page detail (`PATCH /api/registrations/[id]` avec `{ badgePrinted: true }`).
- Par lot : endpoint `POST /api/registrations/print` avec un tableau d'IDs (utilisable depuis l'admin).
- Prerequis : les informations de contact (email et telephone) doivent etre configurees dans les parametres, sinon les endpoints renvoient 400.
- Effet : enregistre `badgePrinted=true` + `badgePrintedAt=now()` et envoie un email au participant via `sendBadgePrintedNotification` avec les informations de recuperation.

## Pages publiques

| URL | Fichier | Description |
|-----|---------|-------------|
| `/badge/[id]` | `src/app/badge/[id]/page.tsx` | Rendu PDF du badge (apercu + lien telechargement). Acces public via `/api/verify/[id]` : ne retourne le badge que si l'inscription est `APPROVED`. |
| `/badge-preview/[id]` | `src/app/badge-preview/[id]/page.tsx` | Apercu HTML/CSS (`BadgeWebPreview`) du badge sans dependance @react-pdf/renderer. Utile pour les vignettes et les previews mobiles. |

## Composants de rendu

| Composant | Description |
|-----------|-------------|
| `BadgeDocument` | Document PDF nominatif (@react-pdf/renderer), Montserrat, 100x140mm. Utilise `formatBadgeName` / `formatBadgeStructure`. |
| `BadgeDocumentAnonymous` | Variante PDF pour les categories anonymes (QR code centre + ID, sans photo ni nom). |
| `BadgePreview` | Wrapper `PDFViewer` (hauteur 600px) -- choisit la variante en fonction de `team.anonymous`. |
| `BadgeDownload` | Wrapper `PDFDownloadLink`, nom de fichier `badge-NOM-PRENOM-ID.pdf` (ou `badge-ID.pdf` si anonyme). |
| `BadgeWebPreview` | Rendu HTML/Tailwind du badge (283x397px), utilise pour les vignettes / aperçus rapides. |
| `BadgeBatchExport` | Genere un ZIP de PDFs cote client (voir `docs/features/export-badges-pdf.md`). |

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/badges/page.tsx` | Liste des badges, filtres, exports |
| `src/app/admin/badges/[id]/page.tsx` | Detail et controles badge |
| `src/app/badge/[id]/page.tsx` | Page publique de rendu badge (PDF) |
| `src/app/badge-preview/[id]/page.tsx` | Page publique d'apercu HTML |
| `src/components/badge/BadgeDocument.tsx` | Template PDF nominatif |
| `src/components/badge/BadgeDocumentAnonymous.tsx` | Template PDF anonyme |
| `src/components/badge/BadgePreview.tsx` | Apercu PDF en ligne |
| `src/components/badge/BadgeDownload.tsx` | Telechargement PDF |
| `src/components/badge/BadgeWebPreview.tsx` | Apercu HTML/CSS |
| `src/components/badge/BadgeBatchExport.tsx` | Export ZIP lot |
| `src/lib/format-badge-name.ts` | `formatBadgeName`, `formatBadgeStructure` |
| `src/lib/generate-id.ts` | Generation identifiant |
| `src/lib/qrcode.ts` | Generation QR code |
| `src/lib/image-to-dataurl.ts` | Conversion image -> data URL (PNG) pour @react-pdf/renderer |
| `src/app/api/registrations/[id]/route.ts` | PATCH pour ALL ACCESS / impression |
| `src/app/api/registrations/print/route.ts` | Impression batch |
