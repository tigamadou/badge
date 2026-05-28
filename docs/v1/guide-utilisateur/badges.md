# Badges

## Acceder aux badges

Cliquer sur "Badges" dans le menu. La page affiche une grille de cartes representant uniquement les inscriptions **approuvees**.

Chaque carte montre :
- Une barre de couleur de la categorie en haut
- Photo du participant (ou initiales)
- Nom et prenom, structure
- Categorie (avec un point de couleur)
- Mention "ALL ACCESS" si active
- Statut d'impression (Imprime / Non imprime)

Le nombre total de badges est affiche en haut a gauche.

## Rechercher et filtrer

- **Recherche** : par nom, prenom, email ou structure
- **Filtre par categorie** : selectionner une categorie
- **Filtre par impression** : Tous / Imprime / Non imprime (applique sur la page courante)

La liste est paginee (20 par defaut). Utiliser la pagination en bas pour naviguer.

## Selectionner et exporter en lot

1. Cocher la case en haut a gauche de chaque carte pour selectionner les badges souhaites
2. Une barre apparait avec le compteur de selection et un bouton "Exporter la selection (n)"
3. Cliquer sur le bouton : un fichier ZIP est genere cote client et telecharge automatiquement
4. Le bouton "Tout selectionner" permet de cocher / decocher tous les badges affiches

Vous pouvez aussi cliquer directement sur "Exporter la page (n)" en haut a droite pour exporter tous les badges visibles dans la page courante (apres application des filtres).

Pendant la generation, le bouton affiche la progression : `Generation 3/15...`.

> Note : l'export "par page" exporte uniquement les badges visibles dans la page courante. Pour exporter davantage, augmentez la taille de la pagination ou utilisez la selection sur plusieurs pages.

## Consulter un badge

1. Cliquer sur une carte dans la grille
2. La page de detail s'ouvre avec deux zones :
   - **A gauche** : informations du participant et boutons d'action
   - **A droite** : apercu du badge PDF en temps reel

Le badge affiche :
- Logo et informations de l'evenement (haut)
- Photo du participant et QR code (centre) -- ou un QR code centre seul pour les categories anonymes
- Identifiant du badge (vertical, a droite, sauf en mode anonyme)
- Nom et structure (formats automatiquement raccourcis : 20 caracteres max pour le nom, 28 pour la structure)
- Banniere "ALL ACCESS" en rouge (si active)
- Banniere de la categorie en couleur (bas) ; blanche avec bordure si la categorie est de type "badge neutre"

## Activer l'acces total (ALL ACCESS)

Cette option ajoute une banniere rouge "ALL ACCESS" sur le badge. Disponible aussi bien pour les badges nominatifs que pour les badges anonymes.

> Restriction : action masquee pour le role SUPER_ADMIN.

1. Ouvrir la page de detail d'un badge
2. Le bouton "Activer ALL ACCESS" est disponible si le badge est approuve et non encore imprime
3. Cliquer sur le bouton
4. Confirmer l'activation dans la fenetre de confirmation
5. L'apercu du badge se met a jour immediatement
6. Pour desactiver : meme bouton, libelle "Desactiver ALL ACCESS"

## Marquer un badge comme imprime

> Prerequis : les informations de contact (email et telephone) doivent etre configurees dans les parametres systeme. Si ce n'est pas le cas, un message d'avertissement s'affiche et le bouton est masque.

> Restriction : action masquee pour le role SUPER_ADMIN.

1. Ouvrir la page de detail d'un badge
2. Cliquer sur "Marquer comme imprime"
3. Confirmer dans la fenetre de confirmation
4. Le badge est marque comme imprime avec la date
5. Un email est envoye automatiquement au participant avec les informations pour recuperer son badge

Une fois marque comme imprime, le badge ne peut plus etre modifie (ALL ACCESS fige, le bouton "Marquer comme imprime" disparait).

## Telecharger un badge en PDF

1. Ouvrir la page de detail d'un badge
2. Cliquer sur le bouton "Telecharger le badge PDF"
3. Le fichier PDF est telecharge sous le nom :
   - Badge nominatif : `badge-NOM-PRENOM-ID.pdf`
   - Badge anonyme : `badge-ID.pdf`

Le PDF est au format 100 x 140 mm, pret pour l'impression.
