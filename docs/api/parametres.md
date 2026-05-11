# API -- Parametres

## GET /api/settings

Retourne les parametres du systeme.

- **Authentification** : non requise (public)

### Reponse (200)

```json
{
  "id": "clxxx...",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpFrom": "noreply@example.com",
  "smtpSecure": false,
  "contactEmail": "contact@example.com",
  "contactPhone": "+229 97 00 00 00"
}
```

---

## PUT /api/settings

Met a jour les parametres du systeme.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Requete

```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpFrom": "noreply@example.com",
  "smtpSecure": true,
  "contactEmail": "contact@example.com",
  "contactPhone": "+229 97 00 00 00"
}
```

### Reponse (200)

Objet parametres mis a jour.

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
  "message": "Email de test envoye"
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Adresse email de test manquante |
| 500 | Echec d'envoi (configuration SMTP invalide) |
