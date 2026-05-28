# Gestion des categories

## Description fonctionnelle

Les categories (anciennement "equipes") regroupent les participants par type : securite, protocole, presse, etc. Chaque categorie possede un nom, une couleur et un numero unique qui sont utilises dans la generation des identifiants de badge et dans l'affichage visuel du badge (banniere coloree).

## Acces

- **Role requis** : MODERATEUR (et superieur)
- **Route front-end** : `/admin/categories` (une seconde page `/admin/teams` expose la meme CRUD pour selectionner les catégories par leur nom)
- **Route API** : `/api/teams` (le modele en base reste `Team`)

## Fonctionnalites

### Liste des categories

- Tableau avec colonnes : couleur (pastille), numero, nom, nombre d'inscriptions
- Vue responsive : tableau sur desktop, cartes sur mobile
- Pagination 20 par defaut (selecteur de taille de page)
- Tag « Anonyme » affiche en regard du nom pour les categories anonymes
- Boutons « Modifier » et « Supprimer » sur chaque ligne

### Creation d'une categorie

- Champs :
  - **Nom** (obligatoire)
  - **Couleur** (selecteur hexadecimal, valeur par defaut `#1a3a7c`)
  - **Numero** (entier entre 0 et 999, unique en base)
  - **Badge neutre** (case a cocher) : fond blanc et couleur appliquee au texte du badge
  - **Categorie anonyme** (case a cocher) : badge sans informations personnelles, categorie masquee sur le formulaire public d'inscription
- Le numero doit etre unique dans le systeme

### Modification

- Tous les champs sont modifiables
- La modification du numero est possible tant qu'il reste unique

### Suppression

- Confirmation requise via une fenetre modale
- La suppression est definitive

## Regles metier

- Le numero de categorie (0-999) sert d'identifiant logique pour la catégorie. Seul son **dernier chiffre** est integre dans le format de l'identifiant de badge : `[dernierChiffreCat][AAMMJJ][XX][dernierChiffreCat][NNN]` ou `XX` est un nombre aleatoire 00-99 et `NNN` un compteur sequentiel par catégorie. Voir `src/lib/generate-id.ts`.
- La couleur est utilisee pour la banniere du bas du badge PDF
- Le nom apparait en majuscules sur la banniere du badge
- Le flag `neutralBadge` change le rendu du badge (fond blanc, couleur appliquee uniquement au texte)
- Le flag `anonymous` :
  - masque la categorie sur le formulaire public d'inscription (filtre `excludeAnonymous=true`)
  - rend l'inscription dans cette categorie possible uniquement par un admin (pas d'auto-inscription)
  - approuve automatiquement les inscriptions creees (pas de validation manuelle)
  - retire les informations personnelles du badge PDF
- La route front-end utilise `/admin/categories` mais l'API reste sur `/api/teams` (pas de renommage cote serveur)

## Journal d'activite

Les actions sur les categories sont enregistrees dans le journal d'activite avec les types :
- `CATEGORY_CREATED` (a la creation)
- `CATEGORY_UPDATED` (a la modification)
- `CATEGORY_DELETED` (a la suppression)

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/categories/page.tsx` | Page gestion categories |
| `src/app/api/teams/route.ts` | GET liste, POST creation |
| `src/app/api/teams/[id]/route.ts` | PATCH modif, DELETE suppression |
| `src/components/admin/TeamForm.tsx` | Composant formulaire categorie |
