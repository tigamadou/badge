# Inscriptions

## Consulter la liste

1. Acceder a la section "Inscriptions" via le menu
2. La liste affiche toutes les inscriptions avec : nom, structure, categorie, date, statut
3. Sur mobile, la liste s'affiche en cartes au lieu d'un tableau

### Rechercher

Utiliser la barre de recherche en haut de la liste pour filtrer par nom, prenom, email ou structure.

### Filtrer

- **Par statut** : selectionner "En attente", "Valide" ou "Rejete" dans le menu deroulant
- **Par categorie** : selectionner une categorie dans le menu deroulant

### Naviguer

- La liste est paginee (20 inscriptions par defaut). Utiliser les controles en bas pour changer de page ou ajuster la taille de page.

## Approuver ou rejeter une inscription

> Prerequis : les informations de contact (email + telephone) doivent etre configurees dans les **Parametres**. Sans cela, les boutons "Valider" et "Rejeter" sont desactives.

> Restriction : le role SUPER_ADMIN ne peut ni valider ni rejeter une inscription. Les actions sont visibles uniquement pour les roles MODERATEUR et ADMIN.

### Depuis la page de detail

1. Cliquer sur une inscription pour ouvrir sa page de detail
2. Consulter les informations completes, la photo et le document d'identite
3. Cliquer sur "Valider" ou "Rejeter"
4. Pour un rejet, une fenetre vous demande de choisir un motif dans la liste deroulante :
   - Photo non conforme
   - Document d'identite illisible
   - Document d'identite expire
   - Informations incorrectes
   - Doublon d'inscription
   - Categorie non autorisee
   - Autre
5. Vous pouvez aussi saisir des details libres
6. Confirmer

Un email de notification est automatiquement envoye au participant. En cas de rejet, l'email contient un lien de modification valable 48h.

> Important : un rejet est irreversible. Une inscription rejetee ne peut pas etre repassee directement en "Valide". Le participant peut neanmoins corriger ses informations via le lien de modification, ce qui repasse l'inscription en "En attente".

## Voir le detail d'une inscription

1. Cliquer sur une inscription dans la liste
2. La page de detail affiche :
   - Photo du participant (ou initiales si pas de photo)
   - Nom, prenom, structure, categorie avec indicateur de couleur, statut, date d'inscription
   - Email, type et numero de piece d'identite, ID inscription
   - Document d'identite (cliquer dessus pour l'agrandir)
   - Motif du rejet (si rejetee)
   - **Historique des soumissions** : si l'inscription a deja ete modifiee, toutes les versions precedentes sont listees avec leur date.
3. Si l'inscription est approuvee, un lien vers la page Badges est disponible.

### Detection automatique de doublons

Si d'autres inscriptions ressemblent a celle affichee (meme email, meme document, meme nom et prenom, nom/prenom inverses, ou correspondance entre email et nom), un bandeau d'alerte apparait en haut de la page et une colonne "Inscriptions similaires" s'affiche a droite avec les detail des matches. La couleur du bandeau indique le niveau d'attention :

- 1 match -> jaune (verification recommandee)
- 2 matches -> orange (doublon possible)
- 3+ matches -> rouge (risque eleve)

## Envoyer un lien de modification

### A une inscription validee

1. Ouvrir la page de detail d'une inscription "Valide"
2. Dans le panneau de droite, cliquer sur "Envoyer un lien de modification"
3. Confirmer l'envoi
4. Le participant recoit un email avec un lien valable 48h. Apres modification et resoumission, l'inscription repasse en "En attente".

### A une inscription rejetee

Lors du rejet, un lien de modification est genere automatiquement et envoye au participant. Sur la page de detail d'une inscription rejetee non bloquee, vous pouvez :

- Copier le lien actuellement valide (date d'expiration affichee)
- Renvoyer un nouveau lien si l'ancien est expire

## Bloquer un email ou un numero de document

Disponible uniquement sur les inscriptions au statut "Rejete".

1. Ouvrir la page de detail
2. Dans le panneau de droite, cliquer sur "Bloquer cet email" ou "Bloquer ce N de document"
3. Confirmer dans la fenetre d'avertissement

Une fois bloque, toute nouvelle tentative d'inscription (publique ou via lien de modification) avec cet email ou ce numero de document sera silencieusement ignoree (aucune erreur visible cote utilisateur, aucune inscription creee).

Pour debloquer, cliquer sur "Debloquer" dans le meme panneau.

## Creer une inscription manuellement

1. Cliquer sur le bouton "Nouvelle inscription"
2. Remplir le formulaire :
   - Nom, prenom, email, structure
   - Categorie
   - Type et numero de piece d'identite
   - Photo du participant
   - Document d'identite
3. Valider le formulaire
4. L'inscription est creee avec le statut "En attente" (ou "Valide" pour une categorie anonyme)

## Supprimer une inscription

> Restriction : refusee pour le role SUPER_ADMIN.

1. Ouvrir la page de detail de l'inscription
2. Cliquer sur le bouton de suppression
3. Confirmer la suppression

La suppression est definitive.
