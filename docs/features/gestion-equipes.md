# Gestion des equipes

## Description fonctionnelle

Les "equipes" et les "categories" designent la meme ressource metier en base de donnees (modele Prisma `Team`). Deux pages d'administration permettent de gerer cette ressource :

- `/admin/categories` -- page principale et complete, integree au menu lateral. Documentee dans [Gestion des categories](gestion-categories.md).
- `/admin/teams` -- page alternative simplifiee, conservee pour compatibilite.

Cette page distincte est presente dans le code source mais n'est pas referencee dans le menu de navigation principal. Elle peut etre atteinte directement via son URL.

## Acces

- **Role requis** : MODERATEUR
- **Route front-end** : `/admin/teams`
- **Route API** : `/api/teams` (identique a la page Categories)

## Difference avec /admin/categories

| Aspect | `/admin/categories` | `/admin/teams` |
|--------|---------------------|----------------|
| Listee dans le menu | oui | non |
| Pagination UI | oui | non |
| Champ `number` | edite | non edite via le formulaire simplifie |
| Champ `neutralBadge` / `anonymous` | edites | non edites |
| Compteur d'inscriptions | oui | oui |

> Note : la page `/admin/teams` consomme `/api/teams` sans le parametre `limit`, l'API renvoie donc 20 elements par defaut sous la forme `{ data, total, page, totalPages }`. Au-dela de 20 categories, toutes les entrees ne seront pas visibles depuis cette page (utiliser `/admin/categories` pour la gestion complete).

## Fonctionnalites (page simplifiee)

- Liste des equipes avec couleur, nom et nombre d'inscriptions
- Vue responsive (tableau desktop / cartes mobile)
- Creation, modification, suppression via le composant `TeamForm`
- Confirmation modale avant suppression

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/teams/page.tsx` | Page simplifiee de gestion des equipes |
| `src/app/api/teams/route.ts` | API partagee avec `/admin/categories` |
| `src/app/api/teams/[id]/route.ts` | API partagee |
| `src/components/admin/TeamForm.tsx` | Formulaire partage |

## Voir aussi

- [Gestion des categories](gestion-categories.md) -- documentation complete de la ressource
- [API Categories](../api/categories.md) -- reference des endpoints `/api/teams`
