# API -- Parametres

## GET /api/settings

Retourne les parametres du systeme.

- **Authentification** : non requise (public)
- **Note** : la cle secrete reCAPTCHA (`recaptchaSecretKey`) est exclue de la reponse.

### Reponse (200)

```json
{
  "id": "clxxx...",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpFrom": "noreply@example.com",
  "smtpUser": "noreply@example.com",
  "smtpPassword": "******",
  "smtpSecure": false,
  "contactEmail": "contact@example.com",
  "contactPhone": "+229 97 00 00 00",
  "recaptchaEnabled": false,
  "recaptchaSiteKey": ""
}
```

Retourne `null` si aucun enregistrement `Settings` n'existe.

---

## PUT /api/settings

Cree ou met a jour les parametres du systeme (upsert).

- **Authentification** : requise
- **Role minimum** : ADMIN
- **Note** : seul un SUPER_ADMIN peut modifier les champs `recaptchaEnabled`, `recaptchaSiteKey`, `recaptchaSecretKey`. Si un ADMIN passe ces champs, ils sont silencieusement ignores.

### Requete

```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpFrom": "noreply@example.com",
  "smtpUser": "noreply@example.com",
  "smtpPassword": "secret",
  "smtpSecure": true,
  "contactEmail": "contact@example.com",
  "contactPhone": "+229 97 00 00 00",
  "recaptchaEnabled": true,
  "recaptchaSiteKey": "6Lc...",
  "recaptchaSecretKey": "6Lc..."
}
```

| Champ | Type | Role minimum | Description |
|-------|------|--------------|-------------|
| smtpHost | string | ADMIN | Serveur SMTP |
| smtpPort | int | ADMIN | Port (defaut 587) |
| smtpFrom | string | ADMIN | Adresse expediteur |
| smtpUser | string | ADMIN | Login SMTP (optionnel) |
| smtpPassword | string | ADMIN | Mot de passe SMTP (optionnel) |
| smtpSecure | boolean | ADMIN | TLS |
| contactEmail | string | ADMIN | Email de contact |
| contactPhone | string | ADMIN | Telephone de contact |
| recaptchaEnabled | boolean | SUPER_ADMIN | Activer reCAPTCHA |
| recaptchaSiteKey | string | SUPER_ADMIN | Cle publique reCAPTCHA |
| recaptchaSecretKey | string | SUPER_ADMIN | Cle secrete reCAPTCHA |

### Reponse (200)

Objet `Settings` complet (mis a jour). Cette reponse, contrairement a `GET`, contient bien `recaptchaSecretKey`.

### Activity log

Toute modification ecrit une entree `SETTINGS_UPDATED` (avec `details.changes` indiquant `"SMTP et contact"` ou `"SMTP, contact et reCAPTCHA"`).

---

## POST /api/settings

Envoie un email de test pour valider la configuration SMTP.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Requete

```json
{
  "testEmail": "test@example.com"
}
```

### Reponse (200)

```json
{
  "success": true
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Aucune configuration SMTP en base (`smtpHost` vide) |
| 400 | Informations de contact non configurees (`contactEmail` ou `contactPhone` manquant) |
| 403 | Role insuffisant |
| 500 | Echec d'envoi (configuration SMTP invalide) — le message d'erreur retourne le message d'exception nodemailer |
