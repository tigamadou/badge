# Gestion des categories

## Description fonctionnelle

Les categories (anciennement "equipes") regroupent les participants par type : securite, protocole, presse, etc. Chaque categorie possede un nom, une couleur et un numero unique qui sont utilises dans la generation des identifiants de badge et dans l'affichage visuel du badge (banniere coloree).

## Acces

- **Role requis** : ADMIN
- **Route front-end** : `/admin/categories`
- **Route API** : `/api/teams` (le modele en base reste `Team`)

## Fonctionnalites

### Liste des categories

- Tableau avec colonnes : couleur (pastille), numero, nom, nombre d'inscriptions
- Vue responsive : tableau sur desktop, cartes sur mobile

### Creation d'une categorie

- Champs : nom, couleur (selecteur hexadecimal), numero (1-9, unique)
- Le numero doit etre unique dans le systeme

### Modification

- Tous les champs sont modifiables
- La modification du numero est possible tant qu'il reste unique

### Suppression

- Confirmation requise
- La suppression est definitive

## Regles metier

- Le numero de categorie (1-9) est integre dans le format de l'identifiant de badge : `[numCat][AAMMJJ][XX][numCat][NNN]`
- La couleur est utilisee pour la banniere du bas du badge PDF
- Le nom apparait en majuscules sur la banniere du badge
- La route front-end utilise `/admin/categories` mais l'API reste sur `/api/teams` (pas de renommage cote serveur)

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/categories/page.tsx` | Page gestion categories |
| `src/app/api/teams/route.ts` | GET liste, POST creation |
| `src/app/api/teams/[id]/route.ts` | PATCH modif, DELETE suppression |
| `src/components/admin/TeamForm.tsx` | Composant formulaire categorie |
