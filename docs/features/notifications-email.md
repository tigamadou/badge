# Notifications email

## Description fonctionnelle

L'application envoie des emails transactionnels a differentes etapes du cycle de vie : confirmation d'inscription, notification de statut, invitation d'utilisateur et notification d'impression de badge. Les emails sont envoyes via nodemailer avec une configuration SMTP dynamique (lue depuis la base de donnees, avec fallback sur les variables d'environnement).

## Types d'emails

### 1. Confirmation d'inscription

- **Fonction** : `sendRegistrationConfirmation()`
- **Declencheur** : soumission d'une inscription publique
- **Destinataire** : le participant inscrit
- **Contenu** : confirmation que l'inscription a ete recue, en attente de validation

### 2. Notification de statut

- **Fonction** : `sendStatusNotification()`
- **Declencheur** : changement de statut d'une inscription (APPROVED ou REJECTED)
- **Destinataire** : le participant concerne
- **Contenu** : notification d'approbation ou de rejet

### 3. Invitation utilisateur

- **Fonction** : `sendUserInvitation()`
- **Declencheur** : creation d'un nouvel utilisateur par le super administrateur
- **Destinataire** : le nouvel utilisateur
- **Contenu** : lien `/setup-password?token=<token>` pour definir le mot de passe, valable 48h

### 4. Notification badge imprime

- **Fonction** : `sendBadgePrintedNotification()`
- **Declencheur** : marquage d'un badge comme imprime
- **Destinataire** : le participant concerne
- **Contenu** : notification que le badge est pret, avec les informations de contact (email et telephone) pour la recuperation

## Configuration SMTP

La configuration est lue en priorite depuis la table `Settings` en base de donnees. Si aucune configuration n'est trouvee, les variables d'environnement sont utilisees en fallback :

| Parametre | Table Settings | Variable d'environnement |
|-----------|---------------|--------------------------|
| Serveur | smtpHost | SMTP_HOST |
| Port | smtpPort | SMTP_PORT |
| Expediteur | smtpFrom | SMTP_FROM |
| TLS | smtpSecure | -- |

### Test SMTP

L'endpoint `POST /api/settings` permet d'envoyer un email de test pour valider la configuration avant utilisation en production.

## Templates

Les emails utilisent des templates HTML inline avec :
- Header avec gradient de couleur
- Logo de l'evenement (si configure)
- Corps du message
- Style coherent entre tous les types d'email

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/lib/mail.ts` | Toutes les fonctions d'envoi d'email |
| `src/app/api/settings/route.ts` | Test SMTP (POST) |
| `src/app/api/registrations/route.ts` | Declenchement email confirmation |
| `src/app/api/registrations/[id]/route.ts` | Declenchement emails statut et impression |
| `src/app/api/registrations/print/route.ts` | Declenchement emails impression batch |
| `src/app/api/users/route.ts` | Declenchement email invitation |
