# Export badges PDF

## Description fonctionnelle

L'export de badges permet de telecharger les badges PDF soit a l'unite, soit en lot depuis la page `/admin/badges`. L'export en lot genere un fichier ZIP contenant un PDF par badge. Deux modes de selection sont disponibles : selection manuelle via checkboxes ou export de tous les badges affiches dans la page courante (apres application des filtres).

L'export et le marquage "imprime" sont deux operations distinctes : l'export ne marque pas automatiquement les badges comme imprimes -- le marquage se fait soit individuellement depuis `/admin/badges/[id]`, soit en lot via `POST /api/registrations/print`.

## Modes d'export

### Export unitaire

Telechargement direct d'un PDF pour un badge individuel via le bouton "Telecharger le badge PDF" sur la page de detail (`/admin/badges/[id]`), implementation `BadgeDownload` (wrapper `PDFDownloadLink`).

### Export par selection

1. L'utilisateur coche les badges souhaites via les checkboxes sur les cartes
2. Une barre d'actions apparait avec le nombre de badges selectionnes
3. Clic sur "Exporter la selection (n)"
4. Un ZIP est genere cote client et telecharge
5. Bouton "Deselectionner" pour reinitialiser la selection

### Export par page filtree

1. L'utilisateur applique les filtres existants (categorie, statut impression, recherche)
2. Clic sur le bouton "Exporter la page (n)" affiche en haut a droite
3. Tous les badges actuellement affiches (limite : la page courante de pagination, par defaut 20) sont exportes dans un ZIP

> Note : l'export "par page" n'exporte pas l'ensemble des resultats correspondant aux filtres, mais seulement les badges visibles dans la page courante. Pour exporter davantage, augmenter la taille de page via la pagination.

## Comportement technique

La generation se fait entierement cote client :
- `@react-pdf/renderer` (existant) genere chaque PDF via `pdf(...).toBlob()`.
- Les images (photo participant, logo evenement) sont prechargees et converties en data URL PNG via `imageUrlToDataUrl` (`src/lib/image-to-dataurl.ts`) afin de garantir la compatibilite (notamment WebP -> PNG) avec `@react-pdf/renderer`.
- `jszip` construit le fichier ZIP.
- `file-saver` declenche le telechargement.
- Choix automatique du template : `BadgeDocumentAnonymous` pour les categories `anonymous`, `BadgeDocument` sinon.

Un indicateur de progression s'affiche sur le bouton pendant la generation : `Generation 3/15...`.

## Nommage des fichiers

- ZIP : `badges-export-AAAA-MM-JJ.zip` (date du jour cote client).
- PDFs dans le ZIP :
  - Nominatif : `badge-NOM-PRENOM-ID.pdf` (les espaces sont remplaces par des tirets).
  - Anonyme : `badge-ID.pdf`.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/components/badge/BadgeBatchExport.tsx` | Logique generation ZIP et boucle d'export |
| `src/app/admin/badges/page.tsx` | Checkboxes, barre d'actions, bouton "Exporter la page" |
| `src/components/badge/BadgeDownload.tsx` | Export PDF unitaire (page detail) |
| `src/lib/image-to-dataurl.ts` | Conversion image (notamment WebP) en data URL PNG |

## Dependances

- `jszip` -- generation ZIP cote client
- `file-saver` -- declenchement telechargement
- `@react-pdf/renderer` -- rendu PDF
- `qrcode` -- generation du QR code de chaque badge
