# Utilisateurs

Acces reserve au super administrateur (`/admin/users`).

## Prerequis : informations de contact

Avant de pouvoir inviter un utilisateur, les informations de contact (email et telephone) doivent etre renseignees dans la section Parametres (`/admin/settings`). Sans elles, le bouton "Nouvel utilisateur" est desactive et un message d'avertissement "Contacts non configures" est affiche.

## Consulter la liste des utilisateurs

1. Acceder a la section "Utilisateurs" via le menu
2. La liste affiche pour chaque utilisateur : nom, email, role
3. La pagination en bas de tableau permet de naviguer (20 entrees par page par defaut, modifiable)

Les comptes Super Administrateur ne sont jamais visibles dans la liste.

## Inviter un nouvel utilisateur

1. Cliquer sur le bouton "Nouvel utilisateur"
2. Remplir le formulaire :
   - **Nom** : nom complet de l'utilisateur
   - **Email** : adresse email (servira d'identifiant de connexion)
   - **Role** : Operateur, Moderateur, Administrateur ou Super Administrateur
3. Valider

Un email d'invitation est automatiquement envoye a l'adresse indiquee. Cet email contient un lien securise valable 48 heures permettant a l'utilisateur de definir son mot de passe.

Si l'email est deja utilise par un autre compte, la creation est refusee.

## Modifier un utilisateur

1. Cliquer sur le bouton "Modifier" sur la ligne de l'utilisateur
2. Modifier les champs souhaites :
   - Nom
   - Email
   - Role
   - Mot de passe (optionnel, pour le reinitialiser sans passer par le mail d'invitation)
3. Valider

## Supprimer un utilisateur

1. Cliquer sur le bouton "Supprimer" sur la ligne de l'utilisateur
2. Confirmer dans la fenetre de confirmation

Il est impossible de supprimer votre propre compte. La suppression est definitive.

## Roles disponibles

| Role | Description |
|------|-------------|
| Operateur | Scan des QR codes uniquement |
| Moderateur | Gestion des inscriptions, badges, categories ; approbation et rejet des inscriptions |
| Administrateur | + configuration de l'evenement, parametres SMTP / contact, journal d'activite |
| Super Administrateur | + gestion des comptes utilisateurs et ouverture/fermeture des inscriptions |

> Voir [Connexion et profil](connexion.md) pour le parcours d'invitation et de premiere connexion.
