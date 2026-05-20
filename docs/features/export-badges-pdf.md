# Export badges PDF

## Description fonctionnelle

L'export de badges permet de telecharger les badges PDF soit a l'unite soit en lot depuis la page `/admin/badges`. L'export en lot genere un fichier ZIP contenant un PDF par badge. Deux modes de selection sont disponibles : selection manuelle via checkboxes ou export de tous les badges correspondant aux filtres actifs.

## Modes d'export

### Export unitaire

Telechargement direct d'un PDF pour un badge individuel. Deja disponible depuis la page de detail (`/admin/badges/[id]`).

### Export par selection

1. L'utilisateur coche les badges souhaites via les checkboxes sur les cartes
2. Une barre d'actions apparait avec le nombre de badges selectionnes
3. Clic sur "Exporter la selection"
4. Un ZIP est genere et telecharge

### Export par filtres

1. L'utilisateur applique les filtres existants (categorie, statut impression, recherche)
2. Clic sur le bouton "Exporter"
3. Tous les badges correspondant aux filtres sont exportes dans un ZIP

## Comportement technique

La generation se fait entierement cote client :
- `@react-pdf/renderer` (existant) genere chaque PDF via `pdf().toBlob()`
- `jszip` construit le fichier ZIP
- `file-saver` declenche le telechargement

Un indicateur de progression s'affiche pendant la generation ("Generation 3/15...").

## Nommage des fichiers

- ZIP : `badges-export-AAAA-MM-JJ.zip`
- PDFs dans le ZIP : `badge-NOM-PRENOM-ID.pdf`

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/components/badge/BadgeBatchExport.tsx` | Nouveau -- logique generation ZIP |
| `src/app/admin/badges/page.tsx` | Modifie -- checkboxes, barre d'actions, boutons export |

## Dependances ajoutees

- `jszip` -- generation ZIP cote client
- `file-saver` -- declenchement telechargement
