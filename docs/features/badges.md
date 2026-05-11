# Badges

## Description fonctionnelle

Le systeme genere des badges PDF imprimables pour les participants approuves. Chaque badge contient un QR code unique, les informations du participant et de l'evenement, et une banniere coloree selon la categorie. Les badges peuvent etre previsualises en ligne, telecharges en PDF et marques comme imprimes (avec notification au participant).

## Structure visuelle du badge

Dimensions : 100 x 140 mm, orientation portrait.

```
+----------------------------------+
|  Logo         Titre evenement    |
|              Lieu -- Date        |
+----------------------------------+
|                                  |
|  [Photo]    [QR Code]    | ID | |
|  80x103px    60x60px     | v  | |
|                           | e  | |
|                           | r  | |
|                           | t  | |
|                                  |
|    NOM Prenom                    |
|    Structure                     |
+----------------------------------+
|       ALL ACCESS (si actif)      |  <-- banniere rouge #DC2626
+----------------------------------+
|       NOM CATEGORIE              |  <-- banniere couleur categorie
+----------------------------------+
```

## Generation de l'identifiant

Format : `[numCategorie][AAMMJJ][XX][numCategorie][NNN]`

| Segment | Longueur | Description |
|---------|----------|-------------|
| numCategorie | 1 | Numero de la categorie (1-9) |
| AAMMJJ | 6 | Date de l'evenement (annee/mois/jour) |
| XX | 2 | Chiffres aleatoires (00-99) |
| numCategorie | 1 | Repetition du numero de categorie |
| NNN | 3 | Compteur sequentiel (001, 002, ...) |

Exemple : `1260524381003` -- categorie 1, date 26/05/24, aleatoire 38, categorie 1, 3e inscription.

Le compteur sequentiel est calcule en comptant les inscriptions existantes dans la meme categorie.

## QR Code

- Bibliotheque : `qrcode`
- Contenu : l'identifiant de l'inscription
- Taille : 200px
- Correction d'erreur : niveau M
- Format de sortie : Data URL (base64) pour integration dans le PDF et l'apercu web

## Fonctionnalites

### Liste des badges (`/admin/badges`)

- Grille de cartes affichant les inscriptions approuvees
- Chaque carte montre : photo (ou initiales), nom, structure, categorie, statut ALL ACCESS, statut impression
- Statistiques en haut : total badges, imprimes, non imprimes
- Recherche par nom, email ou structure
- Filtre par categorie
- Filtre par statut d'impression (Tous, Imprimes, Non imprimes)

### Detail d'un badge (`/admin/badges/[id]`)

**Panneau gauche (controles) :**
- Informations du participant : photo, nom, structure, categorie, email, ID, statut impression, statut ALL ACCESS
- Actions :
  - Toggle ALL ACCESS (disponible si approuve et non imprime) -- ajoute/retire la banniere rouge
  - Marquer comme imprime (necessite contact email + telephone dans les parametres)
  - Telecharger le badge PDF
  - Lien vers la page inscription

**Panneau droit (apercu) :**
- Rendu PDF en temps reel via `PDFViewer` de @react-pdf/renderer

### Impression

- Individuelle : bouton "Marquer comme imprime" sur la page detail
- Par lot : endpoint `POST /api/registrations/print` avec un tableau d'IDs
- Prerequis : les informations de contact (email et telephone) doivent etre configurees dans les parametres
- Effet : enregistre la date d'impression et envoie un email au participant avec les informations de recuperation

## Composants de rendu

| Composant | Description |
|-----------|-------------|
| `BadgeDocument` | Document PDF (@react-pdf/renderer), police Helvetica, mise en page 100x140mm |
| `BadgePreview` | Wrapper PDFViewer pour apercu en ligne (600px hauteur) |
| `BadgeDownload` | Wrapper PDFDownloadLink, fichier `badge-NOM-PRENOM-ID.pdf` |
| `BadgeWebPreview` | Rendu HTML/CSS du badge (283x397px), utilise pour les vignettes |

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/badges/page.tsx` | Liste des badges |
| `src/app/admin/badges/[id]/page.tsx` | Detail et controles badge |
| `src/app/badge/[id]/page.tsx` | Page de rendu badge |
| `src/app/badge-preview/[id]/page.tsx` | Page preview badge |
| `src/components/badge/BadgeDocument.tsx` | Template PDF |
| `src/components/badge/BadgePreview.tsx` | Apercu PDF en ligne |
| `src/components/badge/BadgeDownload.tsx` | Telechargement PDF |
| `src/components/badge/BadgeWebPreview.tsx` | Apercu HTML/CSS |
| `src/lib/generate-id.ts` | Generation identifiant |
| `src/lib/qrcode.ts` | Generation QR code |
| `src/app/api/registrations/[id]/route.ts` | PATCH pour impression/ALL ACCESS |
| `src/app/api/registrations/print/route.ts` | Impression batch |
