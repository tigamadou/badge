# Notifications email

## Description fonctionnelle

L'application envoie des emails transactionnels a differentes etapes du cycle de vie : confirmation d'inscription, notification de statut (approbation ou rejet), invitation d'utilisateur, renvoi de lien de modification d'inscription et notification d'impression de badge. Les emails sont envoyes via nodemailer avec une configuration SMTP dynamique (lue depuis la base de donnees, avec fallback sur les variables d'environnement).

Tous les emails partagent un meme gabarit HTML (`buildEmail()` dans `src/lib/mail.ts`) : en-tete sombre avec logo et titre de l'evenement, corps blanc, pied de page avec les informations de contact si elles sont configurees.

## Types d'emails

### 1. Confirmation d'inscription

- **Fonction** : `sendRegistrationConfirmation(to, fullName)`
- **Declencheur** : soumission d'une inscription publique non anonyme (`POST /api/registrations`)
- **Destinataire** : le participant inscrit
- **Sujet** : `Confirmation d'inscription — <titre evenement>`
- **Contenu** : confirmation que l'inscription a ete recue et est en attente de validation, et qu'un email sera envoye une fois traitee
- **Note** : non envoye pour les catégories anonymes (pas d'email participant)

### 2. Notification de statut — Approbation

- **Fonction** : `sendStatusNotification(to, fullName, "APPROVED", ...)`
- **Declencheur** : `PATCH /api/registrations/[id]` avec `status: "APPROVED"`
- **Destinataire** : le participant concerne
- **Sujet** : `Inscription validée — <titre evenement>`
- **Contenu** : confirmation de la validation, mention qu'un email suivra lorsque le badge sera pret a etre retire

### 3. Notification de statut — Rejet

- **Fonction** : `sendStatusNotification(to, fullName, "REJECTED", rejectionReason?, rejectionDetails?, editToken?)`
- **Declencheur** : `PATCH /api/registrations/[id]` avec `status: "REJECTED"`
- **Destinataire** : le participant concerne
- **Sujet** : `Inscription rejetée — <titre evenement>`
- **Contenu** :
  - motif du rejet (`rejectionReason`) si fourni
  - details complementaires (`rejectionDetails`) si fournis
  - bouton "Modifier et resoumettre mon inscription" pointant vers `/edit-registration/<token>` si un `editToken` est present (lien valable 48 heures)

### 4. Renvoi de lien de modification

- **Fonction** : `sendEditLinkEmail(to, fullName, editToken)`
- **Declencheur** :
  - `POST /api/registrations/resend-edit-link` (re-emission depuis la page publique pour une inscription REJECTED)
  - `PATCH /api/registrations/[id]` avec `action: "send-edit-link"` (re-emission depuis le back-office pour une inscription APPROVED ou REJECTED)
  - `POST /api/edit-registration/[token]/resend` (renouvellement du token depuis la page de modification)
- **Destinataire** : le participant concerne
- **Sujet** : `Modifier votre inscription — <titre evenement>`
- **Contenu** : nouveau lien `/edit-registration/<token>` valable 48 heures pour modifier et resoumettre l'inscription
- **Activity log** : declenche `EDIT_LINK_SENT` lorsque l'action est faite via le back-office

### 5. Invitation utilisateur

- **Fonction** : `sendUserInvitation(to, userName, setupUrl)`
- **Declencheur** : creation d'un nouvel utilisateur (`POST /api/users`)
- **Destinataire** : le nouvel utilisateur
- **Sujet** : `Invitation — <titre evenement>`
- **Contenu** : presentation et bouton "Configurer mon mot de passe" pointant vers `setupUrl` (`/setup-password?token=<token>`), valable 48 heures

### 6. Notification badge imprime

- **Fonction** : `sendBadgePrintedNotification(to, fullName, contactEmail, contactPhone)`
- **Declencheur** :
  - `PATCH /api/registrations/[id]` avec `badgePrinted: true`
  - `POST /api/registrations/print` (impression en lot)
- **Destinataire** : le participant concerne
- **Sujet** : `Badge prêt — <titre evenement>`
- **Contenu** : information que le badge est pret a etre retire, rappel de se presenter muni de la piece d'identite fournie lors de l'inscription, et informations de contact (email et telephone) pour toute question

## Configuration SMTP

La configuration est lue en priorite depuis la table `Settings` en base de donnees. Si aucune configuration n'est trouvee, les variables d'environnement sont utilisees en fallback :

| Parametre | Table Settings | Variable d'environnement |
|-----------|---------------|--------------------------|
| Serveur | smtpHost | SMTP_HOST |
| Port | smtpPort | SMTP_PORT |
| Expediteur | smtpFrom | SMTP_FROM (defaut: `noreply@badge.local`) |
| Utilisateur | smtpUser | SMTP_USER |
| Mot de passe | smtpPassword | SMTP_PASSWORD |
| TLS | smtpSecure | -- (defaut: false) |

L'authentification SMTP n'est activee que si `smtpUser` et `smtpPassword` sont tous deux renseignes.

### Test SMTP

L'endpoint `POST /api/settings` permet d'envoyer un email de test pour valider la configuration avant utilisation en production. Le test est refuse si :
- aucune configuration SMTP n'est presente en base (`smtpHost` vide)
- les informations de contact (`contactEmail`, `contactPhone`) ne sont pas configurees

## Utilitaires d'integration

`src/lib/mail.ts` expose egalement :

| Fonction | Role |
|----------|------|
| `getContactInfo()` | Retourne `{ contactEmail, contactPhone }` lus depuis `Settings`, ou `null` si pas de settings |
| `areContactsConfigured(contacts)` | Renvoie `true` si email et telephone sont tous deux renseignes |

Ces utilitaires sont utilises avant tout envoi sensible : la validation/rejet d'inscription et le marquage badge imprime sont bloques si les contacts ne sont pas configures.

## Templates

Les emails utilisent un template HTML inline commun (`buildEmail()`) avec :
- En-tete sombre (fond `#0f172a`) contenant le logo de l'evenement (si configure) et le titre
- Corps blanc avec contenu specifique a chaque email
- Pied de page affichant les informations de contact (email + telephone) si configurees, sinon le titre de l'evenement
- Style coherent inline (compatible clients mail)
- URL de base : `NEXTAUTH_URL` ou `BASE_URL` (fallback `http://localhost:3000`)

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/lib/mail.ts` | Toutes les fonctions d'envoi d'email + utilitaires contacts |
| `src/app/api/settings/route.ts` | Test SMTP (POST) |
| `src/app/api/registrations/route.ts` | Declenchement email confirmation |
| `src/app/api/registrations/[id]/route.ts` | Declenchement emails statut, impression, renvoi lien edition |
| `src/app/api/registrations/print/route.ts` | Declenchement emails impression batch |
| `src/app/api/registrations/resend-edit-link/route.ts` | Renvoi lien edition depuis page publique |
| `src/app/api/edit-registration/[token]/resend/route.ts` | Renouvellement token edition |
| `src/app/api/users/route.ts` | Declenchement email invitation |
