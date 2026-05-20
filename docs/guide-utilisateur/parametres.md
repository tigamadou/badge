# Parametres

Acces reserve aux administrateurs et super administrateurs.

## Acceder aux parametres

Cliquer sur "Parametres" dans le menu lateral.

## Configuration SMTP

Cette section configure le serveur d'envoi d'emails utilise pour toutes les notifications (confirmations, approbations, invitations, impressions).

1. Renseigner les champs :
   - **Serveur SMTP** : adresse du serveur (ex: smtp.gmail.com)
   - **Port** : port du serveur (587 par defaut)
   - **Adresse expediteur** : adresse email affichee comme expediteur
   - **Connexion securisee** : cocher si le serveur requiert TLS
2. Cliquer sur "Enregistrer"

### Tester la configuration

1. Apres avoir enregistre la configuration SMTP, cliquer sur "Tester la configuration"
2. Saisir une adresse email de test dans le champ qui apparait
3. Cliquer sur "Envoyer un email de test"
4. Verifier la reception de l'email dans la boite de reception

Si l'email n'arrive pas, verifier les parametres SMTP (serveur, port, TLS).

## Informations de contact

Ces informations sont incluses dans les emails envoyes aux participants lorsqu'un badge est marque comme imprime. Elles indiquent comment et ou recuperer le badge.

1. Renseigner les champs :
   - **Email de contact** : adresse email pour les questions des participants
   - **Telephone** : numero de telephone de contact
2. Cliquer sur "Enregistrer"

Ces informations sont obligatoires pour pouvoir marquer des badges comme imprimes. Si elles ne sont pas renseignees, un avertissement s'affiche sur la page de detail des badges.
