# Parametres systeme

## Description fonctionnelle

La page de parametres permet aux administrateurs de configurer :

- le serveur SMTP utilise pour l'envoi de tous les emails transactionnels,
- les informations de contact (email + telephone) qui apparaissent dans les emails et sont requises pour valider/rejeter des inscriptions et imprimer des badges,
- la protection reCAPTCHA du formulaire d'inscription public (SUPER_ADMIN uniquement).

Ces parametres sont stockes dans la table singleton `Settings` et lus dynamiquement par le systeme d'email et l'API.

## Acces

- **Role requis** : ADMIN
- **Section reCAPTCHA** : SUPER_ADMIN uniquement (lecture et ecriture)
- **Route** : `/admin/settings`

## Sections

### Configuration SMTP

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| Serveur SMTP (`smtpHost`) | texte | "" | Adresse du serveur SMTP |
| Port (`smtpPort`) | entier | 587 | Port du serveur |
| Adresse expediteur (`smtpFrom`) | email | "" | Adresse "From" des emails |
| Utilisateur (`smtpUser`) | texte | "" | Login SMTP (optionnel) |
| Mot de passe (`smtpPassword`) | password | "" | Mot de passe SMTP (optionnel) |
| Connexion securisee (`smtpSecure`) | booleen | false | Activer TLS |

L'authentification SMTP n'est utilisee que si `smtpUser` et `smtpPassword` sont tous deux renseignes.

### Test d'envoi

Un bouton "Tester la configuration" revele un champ pour saisir une adresse email de test. L'envoi appelle `POST /api/settings` avec `{ testEmail }`. Conditions :

- Les parametres SMTP doivent etre enregistres en base (`smtpHost` non vide).
- Les informations de contact (`contactEmail`, `contactPhone`) doivent etre completes.

Le bouton est desactive tant que les informations de contact ne sont pas configurees.

### Informations de contact

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| Email de contact (`contactEmail`) | email | "" | Inclus dans le pied des emails et dans la notification badge imprime |
| Telephone (`contactPhone`) | texte | "" | Inclus dans le pied des emails et dans la notification badge imprime |

Ces informations sont communiquees aux participants pour qu'ils sachent comment et ou recuperer leur badge.

### reCAPTCHA (SUPER_ADMIN uniquement)

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| Activer (`recaptchaEnabled`) | booleen | false | Active la verification reCAPTCHA sur le formulaire public d'inscription |
| Cle du site (`recaptchaSiteKey`) | texte | "" | Cle publique (cote client) |
| Cle secrete (`recaptchaSecretKey`) | password | "" | Cle privee (serveur uniquement, jamais renvoyee par `GET /api/settings`) |

Quand `recaptchaEnabled = true`, la page publique `/` charge le widget Google reCAPTCHA et `POST /api/registrations` rejette toute soumission sans token CAPTCHA valide.

## Note : ouverture/fermeture des inscriptions

La desactivation des inscriptions publiques n'est **pas** un parametre systeme : c'est un champ de l'evenement (`Event.registrationOpen`). Il se configure depuis `/admin/event` et n'est modifiable que par un SUPER_ADMIN. Voir [Configuration evenement](./configuration-evenement.md).

## Regles metier

- Les informations de contact (email et telephone) sont **requises** pour valider/rejeter une inscription, marquer un badge comme imprime, ou envoyer un email de test SMTP. Les actions sont bloquees (HTTP 400) avec un message demandant de completer les contacts.
- La configuration SMTP en base de donnees est **prioritaire** sur les variables d'environnement (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`).
- Un seul enregistrement `Settings` existe dans le systeme (singleton : create si absent, update sinon).
- `GET /api/settings` n'expose **jamais** la cle secrete reCAPTCHA (`recaptchaSecretKey` est exclue de la reponse).
- Un ADMIN non SUPER_ADMIN qui envoie des champs reCAPTCHA dans `PUT /api/settings` voit ces champs silencieusement ignores.
- Toute modification ecrit une entree `SETTINGS_UPDATED` dans le journal d'activite (avec `details.changes` indiquant le perimetre modifie).

## Fichiers source

| Fichier | Role |
|---------|------|
| `src/app/admin/settings/page.tsx` | Page parametres (affiche section reCAPTCHA si SUPER_ADMIN) |
| `src/app/api/settings/route.ts` | GET lecture (public, sans `recaptchaSecretKey`), PUT modification (ADMIN, reCAPTCHA SUPER_ADMIN), POST test SMTP |
| `src/lib/mail.ts` | Helpers `getContactInfo()`, `areContactsConfigured()` |
