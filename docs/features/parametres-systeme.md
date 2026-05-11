# Parametres systeme

## Description fonctionnelle

La page de parametres permet aux administrateurs de configurer le serveur SMTP pour l'envoi d'emails et les informations de contact qui apparaissent dans les notifications de badge imprime. Ces parametres sont stockes en base de donnees et utilises dynamiquement par le systeme d'email.

## Acces

- **Role requis** : ADMIN
- **Route** : `/admin/settings`

## Sections

### Configuration SMTP

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| Serveur SMTP | texte | "" | Adresse du serveur SMTP |
| Port | entier | 587 | Port du serveur |
| Adresse expediteur | email | "" | Adresse "From" des emails |
| Connexion securisee | booleen | false | Activer TLS |

### Test d'envoi

Un bouton "Tester la configuration" revele un champ pour saisir une adresse email de test. L'envoi d'un email de test permet de valider que la configuration SMTP est fonctionnelle avant de l'utiliser en production.

### Informations de contact

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| Email de contact | email | "" | Inclus dans les emails de notification badge |
| Telephone | texte | "" | Inclus dans les emails de notification badge |

Ces informations sont communiquees aux participants dans l'email de notification lorsqu'un badge est marque comme imprime, afin qu'ils sachent comment et ou recuperer leur badge.

## Regles metier

- Les informations de contact (email et telephone) sont requises pour pouvoir marquer des badges comme imprimes. Si elles ne sont pas configurees, l'action d'impression est bloquee.
- La configuration SMTP en base de donnees est prioritaire sur les variables d'environnement.
- Un seul enregistrement `Settings` existe dans le systeme.

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/settings/page.tsx` | Page parametres |
| `src/app/api/settings/route.ts` | GET lecture, PUT modification, POST test SMTP |
