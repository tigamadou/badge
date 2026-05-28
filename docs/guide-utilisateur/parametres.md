# Parametres

Acces reserve aux administrateurs (ADMIN et SUPER_ADMIN). La section reCAPTCHA est visible uniquement par les super administrateurs.

## Acceder aux parametres

Cliquer sur "Parametres" dans le menu lateral.

## Configuration SMTP

Cette section configure le serveur d'envoi d'emails utilise pour toutes les notifications (confirmations d'inscription, approbations/rejets, invitations utilisateurs, badges imprimes, liens de modification).

1. Renseigner les champs :
   - **Serveur SMTP** : adresse du serveur (ex: `smtp.gmail.com`)
   - **Port SMTP** : port du serveur (587 par defaut)
   - **Adresse d'expedition** : adresse email affichee comme expediteur (`From`)
   - **Utilisateur SMTP** : login d'authentification (optionnel — laisser vide si le serveur n'exige pas d'authentification)
   - **Mot de passe SMTP** : mot de passe d'authentification (optionnel)
   - **Connexion securisee (TLS)** : cocher si le serveur requiert TLS
2. Cliquer sur "Enregistrer"

### Tester la configuration

Le bouton "Tester la configuration" est **desactive** tant que les informations de contact ci-dessous ne sont pas renseignees.

1. Configurer d'abord les informations de contact
2. Cliquer sur "Tester la configuration"
3. Saisir une adresse email de test dans le champ qui apparait
4. Cliquer sur "Envoyer le test"
5. Verifier la reception de l'email dans la boite de reception

Si l'email n'arrive pas, le message d'erreur affiche detaille la raison (serveur inaccessible, authentification refusee, etc.). Verifier les parametres SMTP (serveur, port, TLS, utilisateur, mot de passe).

## Informations de contact

Ces informations sont incluses dans le pied des emails envoyes aux participants et explicitement dans l'email de notification lorsqu'un badge est marque comme imprime. Elles indiquent comment et ou recuperer le badge.

1. Renseigner les champs :
   - **Email de contact** : adresse email pour les questions des participants
   - **Telephone de contact** : numero de telephone de contact
2. Cliquer sur "Enregistrer"

Les **deux champs** doivent etre remplis pour :
- valider ou rejeter une inscription,
- marquer un badge comme imprime,
- envoyer un email de test SMTP.

Si l'un des champs est vide, ces actions sont bloquees avec un message demandant de completer les informations de contact.

## reCAPTCHA (super administrateurs uniquement)

Cette section protege le formulaire d'inscription public contre les soumissions automatisees. Elle n'est visible que pour les super administrateurs.

1. Cocher **"Activer le reCAPTCHA"** pour faire apparaitre les champs de cles.
2. Renseigner :
   - **Cle du site (Site Key)** : cle publique fournie par Google reCAPTCHA
   - **Cle secrete (Secret Key)** : cle privee (jamais renvoyee par l'API)
3. Cliquer sur "Enregistrer"

Une fois actif, le widget reCAPTCHA s'affiche sur la page publique `/` et toute soumission sans token valide est refusee.

## Ouverture/fermeture des inscriptions

Le controle de l'ouverture des inscriptions publiques se trouve dans **"Evenement"** (et non dans Parametres). Voir [Evenement](./evenement.md).

## Journalisation

Toute modification des parametres est enregistree dans le journal d'activite sous le type `SETTINGS_UPDATED`.
