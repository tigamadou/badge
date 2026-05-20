# Pre-requis contacts pour actions email

## Contexte

Avant de pouvoir effectuer toute action envoyant un email (sauf confirmation d'inscription), l'admin doit avoir configure les informations de contact dans les parametres : email, telephone et URL du site web.

## Modifications schema

Ajouter `websiteUrl String @default("")` au modele `Settings` dans Prisma.

## Fonction utilitaire

Creer `areContactsConfigured(settings): boolean` qui retourne `true` si les trois champs `contactEmail`, `contactPhone` et `websiteUrl` sont tous non-vides.

## Blocage API

Avant chaque envoi d'email (sauf `sendRegistrationConfirmation`), verifier que les contacts sont configures. Retourner une erreur **400** avec le message : "Veuillez configurer les informations de contact (email, telephone, site web) dans les parametres."

Actions bloquees :
- **PATCH** `/api/registrations/[id]` — validation et rejet (changement de statut)
- **POST** `/api/registrations/resend-edit-link` — renvoi du lien d'edition
- **POST** `/api/settings` — envoi d'email de test SMTP
- Notification badge imprime
- Invitation utilisateur (envoi d'email d'invitation)

Action NON bloquee :
- **POST** `/api/registrations` — creation d'inscription (confirmation recue)

## Blocage UI

Sur la page detail inscription (`admin/registrations/[id]`) et toute page concernee :
- Boutons "Valider" et "Rejeter" **grises** (`disabled`)
- Message explicatif : "Veuillez configurer les informations de contact (email, telephone, site web) dans les parametres avant de pouvoir effectuer cette action."
- Lien cliquable vers `/admin/settings`
- Meme principe pour : renvoi lien d'edition, invitation utilisateur, test SMTP

## Footer des emails

Remplacer le footer actuel (titre de l'evenement) par les informations de contact dans **tous les emails sauf la confirmation d'inscription** :

```
---
contact@example.com
+229 XX XX XX XX
https://example.com
---
```

L'email de confirmation d'inscription (`sendRegistrationConfirmation`) conserve le footer actuel sans informations de contact.

## Page parametres

Ajouter le champ "URL du site web" (`websiteUrl`) dans la section "Informations de contact" de la page settings, a cote des champs email et telephone existants.

## Definition de "contacts configures"

Les **trois** champs doivent etre remplis (non-vides) pour debloquer les actions :
- `contactEmail`
- `contactPhone`
- `websiteUrl`
