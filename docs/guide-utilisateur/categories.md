# Categories

Acces reserve aux moderateurs, administrateurs et super administrateurs (role MODERATEUR minimum).

## Consulter les categories

1. Acceder a la section « Categories » via le menu
2. La liste affiche pour chaque categorie :
   - Pastille de couleur
   - Numero
   - Nom (suivi d'un tag « Anonyme » si la categorie est anonyme)
   - Nombre d'inscriptions associees
3. La pagination (20 elements par defaut) permet de naviguer dans les longues listes

## Creer une categorie

1. Cliquer sur le bouton « Nouvelle categorie »
2. Remplir le formulaire :
   - **Nom de la categorie** : nom (ex: Securite, Protocole, Presse)
   - **Numero (0-999)** : attribuer un numero unique entre 0 et 999 (seul le **dernier chiffre** est integre dans l'identifiant des badges)
   - **Couleur** : choisir une couleur hexadecimale (cette couleur apparaitra sur le badge)
   - **Badge neutre** : si coche, le badge aura un fond blanc et la couleur sera appliquee au texte
   - **Categorie anonyme** : si coche, la categorie n'apparait pas sur le formulaire public d'inscription et les inscriptions creees pour cette categorie sont approuvees automatiquement (les badges ne contiennent pas les informations personnelles)
3. Valider

## Modifier une categorie

1. Cliquer sur le bouton de modification sur la ligne de la categorie
2. Modifier les champs souhaites (nom, couleur, numero, badge neutre, anonyme)
3. Valider

## Supprimer une categorie

1. Cliquer sur le bouton de suppression sur la ligne de la categorie
2. Confirmer la suppression dans la fenetre de confirmation

La suppression est definitive. Si des inscriptions sont associees a cette categorie, elles risquent de perdre leur reference.

## Impact sur les badges

- Le **numero** de categorie est utilise dans la generation de l'identifiant unique du badge. Seul son dernier chiffre apparait dans l'identifiant, le numero complet reste un identifiant logique en base.
- La **couleur** est utilisee pour la banniere en bas du badge (ou pour le texte si le badge est neutre)
- Le **nom** est affiche en majuscules sur cette meme banniere
- Les **categories anonymes** generent des badges sans informations personnelles (variant `BadgeDocumentAnonymous`)

## Categories anonymes

Les categories anonymes (case « Categorie anonyme » cochee) ont un comportement particulier :
- Elles n'apparaissent **pas** sur le formulaire public d'inscription
- Seuls les moderateurs/admins peuvent y inscrire des participants depuis l'interface d'administration
- Les inscriptions sont **approuvees automatiquement** des leur creation
- Le badge genere ne contient pas les informations personnelles (nom, prenom, structure, photo) ; il sert uniquement de droit d'acces
