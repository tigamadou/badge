# Scanner QR

## Acceder au scanner

Cliquer sur "Scanner" dans le menu ou acceder directement a l'adresse `/scan`. L'authentification est requise (role OPERATOR minimum).

## Autoriser la camera

A l'arrivee sur la page, un ecran d'accueil rappelle le nom de l'operateur connecte et propose un bouton **« Autoriser la camera et scanner »**. Appuyer sur ce bouton declenche la demande d'autorisation camera du navigateur. Accepter pour pouvoir scanner les badges.

Si la camera n'est pas accessible, un message d'erreur s'affiche :
- **Permission refusee** : « Acces a la camera refuse. Veuillez autoriser l'acces dans les parametres du navigateur. »
- **Camera occupee par une autre application** : « Impossible de demarrer la camera. Verifiez que la camera n'est pas utilisee par une autre application. »

Un bouton **« Reessayer »** permet de relancer la procedure apres avoir corrige le probleme.

## Scanner un badge

1. Pointer la camera (arriere par defaut) vers le QR code du badge
2. Le QR code est detecte automatiquement (10 images par seconde dans une zone de 250x250 px)
3. Le scanner se met en pause des qu'un code est detecte, puis le resultat s'affiche en plein ecran

### Resultat du scan

- **Fond vert** + grande coche : le badge est valide (inscription approuvee)
- **Fond rouge** + grande croix : le badge est invalide (inscription non trouvee, en attente ou rejetee)

Informations affichees lorsque l'inscription existe :
- Photo du participant
- Nom (en majuscules) et prenom
- Structure
- Categorie avec pastille de couleur
- Statut de l'inscription (PENDING / APPROVED / REJECTED)
- Mention « ALL ACCESS » si le badge a ete promu acces general
- Identifiant du badge
- Heure du scan

Un bouton **« Scanner un autre badge »** relance la camera pour un nouveau scan.

Chaque scan est automatiquement enregistre dans le journal d'activite avec l'identite de l'operateur, le statut de l'inscription scannee et le nom de la categorie.

## Historique des scans

L'historique des scans est consultable depuis le [Journal d'activite](journal-activite.md) en filtrant par type "Scans" (accessible aux administrateurs).

## Verification publique

L'URL `/verify/<identifiant-badge>` est accessible sans connexion et permet a quiconque de verifier la validite d'un badge. Cette URL est encodee dans le QR code du badge.

La page affiche :
- Photo et informations du participant
- Statut de l'inscription
- Informations de l'evenement
