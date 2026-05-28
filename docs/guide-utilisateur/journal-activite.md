# Journal d'activite

Acces reserve aux administrateurs et super administrateurs.

## Acceder au journal

Cliquer sur "Journal d'activite" dans le menu lateral.

## Consulter les logs

Le journal affiche toutes les actions effectuees dans l'application, des plus recentes aux plus anciennes. Chaque ligne comporte :

- Date et heure de l'action
- Type d'action (avec un badge colore par famille)
- Utilisateur ayant effectue l'action
- Description contextuelle (nom du participant, motif, etc.)
- Adresse IP du client

Cliquer sur une ligne ouvre une **modale "Detail du log"** qui affiche en plus :
- l'identifiant de la ressource concernee (`targetId`),
- l'appareil, le systeme et le navigateur deduits du User-Agent,
- le User-Agent brut,
- la charge `details` au format JSON.

### Familles d'actions

| Couleur | Famille | Exemples |
|---------|---------|----------|
| Vert | Inscriptions | Inscription creee, approuvee, rejetee, modifiee, supprimee, resoumise |
| Violet | Badges | Badge imprime, ALL ACCESS modifie, badge exporte, badge scanne |
| Orange | Utilisateurs | Utilisateur cree, modifie, supprime, mot de passe defini, connexion |
| Gris | Categories / Configuration | Categorie modifiee, evenement modifie, parametres modifies |

Note : les types `Lien d'edition envoye` (EDIT_LINK_SENT) et `Inscription resoumise` (REGISTRATION_RESUBMITTED) apparaissent dans la liste mais n'appartiennent a aucun groupe du filtre.

## Filtrer les logs

- **Par type** : selectionner une famille (Tous les types, Inscriptions, Badges, Scans, Utilisateurs, Configuration) dans le menu deroulant.
- **Par utilisateur** : selectionner un utilisateur dans le menu deroulant (les 100 premiers utilisateurs sont charges).
- **Par recherche** : saisir un texte pour rechercher dans le contenu du log (nom de participant, structure, etc.).
- **Par dates** : definir une date de debut et/ou de fin (les deux dates sont inclusives).

Toute modification d'un filtre remet la pagination a la premiere page.

## Pagination

La liste est paginee. La taille de page par defaut est de 20 entrees ; elle peut etre ajustee via le selecteur de pagination en bas de page (limite serveur : 100 par requete). Utiliser les boutons Precedent / Suivant pour naviguer.
