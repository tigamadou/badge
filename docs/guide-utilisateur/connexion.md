# Connexion et profil

## Premiere connexion

Lorsqu'un super administrateur cree votre compte, vous recevez un email d'invitation contenant un lien securise.

1. Ouvrir l'email d'invitation
2. Cliquer sur le lien (valable 48 heures)
3. Sur la page qui s'ouvre, definir votre mot de passe (minimum 6 caracteres)
4. Confirmer le mot de passe
5. Valider

Une fois le mot de passe configure, un bouton "Se connecter" apparait et vous redirige vers la page de connexion.

Si le lien a expire ou est invalide, demander au super administrateur de recreer votre compte. Aucune fonctionnalite de mot de passe oublie n'est disponible : la reinitialisation passe par un super administrateur (modification du compte avec un nouveau mot de passe).

## Se connecter

1. Acceder a l'application via l'URL fournie par votre administrateur
2. Sur la page de connexion, saisir votre adresse email et votre mot de passe
3. Cliquer sur "Se connecter"
4. Vous etes redirige vers le tableau de bord (`/admin`)

En cas d'erreur de saisie, le message "Email ou mot de passe incorrect" s'affiche sous le formulaire. Aucun indice n'est donne sur la cause (email inconnu ou mot de passe errone) pour des raisons de securite.

## Gerer son profil

Le profil est accessible via la page `/admin/profile` (lien depuis le menu).

### Modifier ses informations

1. Acceder a la page Profil
2. Modifier le nom ou l'email
3. Cliquer sur "Enregistrer"

Si l'adresse email est deja utilisee par un autre compte, le changement est refuse.

### Changer son mot de passe

1. Acceder a la page Profil
2. Dans la section "Modifier le mot de passe", renseigner :
   - Le mot de passe actuel
   - Le nouveau mot de passe
   - La confirmation du nouveau mot de passe
3. Cliquer sur "Modifier le mot de passe"

Le mot de passe actuel est verifie cote serveur. En cas d'erreur, un message s'affiche et le mot de passe reste inchange.

## Se deconnecter

Cliquer sur le bouton "Deconnexion" dans le bandeau superieur. Vous etes redirige vers la page de connexion.
