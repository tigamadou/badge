# Evenement

Acces reserve aux administrateurs et super administrateurs.

## Configurer l'evenement

1. Acceder a la section "Evenement" via le menu lateral
2. Remplir ou modifier les champs :
   - **Titre** : titre de la ceremonie
   - **Lieu** : lieu de l'evenement
   - **Date** : date de l'evenement
   - **Logo** : telecharger une image (le logo apparaitra sur les badges et dans les emails)
3. Cliquer sur "Enregistrer"

Un message "Modifications enregistrees." s'affiche en cas de succes (visible quelques secondes).

## Ouvrir ou fermer les inscriptions publiques

Reserve aux **super administrateurs** : un interrupteur "Inscriptions publiques" apparait sur la page evenement.

- Quand l'interrupteur est **active** : le formulaire d'inscription public (page `/`) est accessible aux visiteurs.
- Quand l'interrupteur est **desactive** : la page publique affiche un message indiquant que les inscriptions sont fermees, et toute soumission est refusee.

Les inscriptions creees depuis le back-office (`/admin/registrations/new`) restent possibles meme quand le formulaire public est ferme.

## Ou apparaissent ces informations

- **Page d'inscription publique** : le titre, le lieu, la date et le logo sont affiches aux visiteurs
- **Badges PDF** : le logo, le titre, le lieu et la date apparaissent dans l'en-tete du badge
- **Emails** : le logo et le titre de l'evenement sont integres dans l'en-tete des emails envoyes aux participants
- **Identifiants de badge** : la date de l'evenement est utilisee dans le format de l'identifiant (partie `AAMMJJ`)

## Journalisation

Chaque modification de l'evenement est enregistree dans le journal d'activite sous le type `EVENT_UPDATED` et visible par les administrateurs.
