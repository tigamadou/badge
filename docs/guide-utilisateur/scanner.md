# Scanner QR

## Acceder au scanner

Cliquer sur "Scanner" dans le menu ou acceder directement a l'adresse `/scan`.

## Autoriser la camera

Lors du premier acces, le navigateur demande l'autorisation d'utiliser la camera. Accepter pour pouvoir scanner les badges.

Si la camera n'est pas accessible (permission refusee ou appareil sans camera), un message d'erreur s'affiche.

## Scanner un badge

1. Pointer la camera vers le QR code du badge
2. Le QR code est detecte automatiquement
3. Le resultat s'affiche immediatement

### Resultat du scan

- **Fond vert** : le badge est valide (inscription approuvee)
- **Fond rouge** : le badge est invalide (inscription non trouvee ou non approuvee)

Informations affichees :
- Photo du participant
- Nom (en majuscules) et prenom
- Structure
- Categorie avec indicateur de couleur
- Statut de l'inscription
- Mention "ALL ACCESS" si applicable
- Identifiant du badge
- Heure du scan

Chaque scan est automatiquement enregistre dans l'historique avec l'identite de l'operateur.

## Historique des scans

Accessible via le menu "Historique des scans".

### Consulter l'historique

La page affiche la liste des scans effectues avec :
- Date et heure du scan
- Nom de l'operateur
- Nom du participant scanne
- Categorie du participant

### Filtrer l'historique

- **Par operateur** : selectionner un operateur dans le menu deroulant
- **Par participant** : rechercher par nom ou structure
- **Par dates** : definir une date de debut et/ou de fin

La liste est paginee (20 entrees par page). Utiliser les boutons Precedent / Suivant pour naviguer.

## Verification publique

L'URL `/verify/<identifiant-badge>` est accessible sans connexion et permet a quiconque de verifier la validite d'un badge. Cette URL est encodee dans le QR code du badge.

La page affiche :
- Photo et informations du participant
- Statut de l'inscription
- Informations de l'evenement
