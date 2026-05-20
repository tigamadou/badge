# API -- Inscriptions

## GET /api/registrations

Liste toutes les inscriptions.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Reponse (200)

```json
[
  {
    "id": "1260524381003",
    "email": "participant@example.com",
    "lastName": "Dupont",
    "firstName": "Jean",
    "structure": "Ministere X",
    "photo": "photos/abc123.jpg",
    "idDocumentType": "CNI",
    "idDocumentNumber": "123456",
    "status": "APPROVED",
    "badgePrinted": false,
    "allAccessGranted": false,
    "teamId": "clxxx...",
    "team": {
      "id": "clxxx...",
      "name": "Protocole",
      "color": "#2563EB",
      "number": 2
    },
    "createdAt": "2026-05-10T10:00:00.000Z"
  }
]
```

---

## POST /api/registrations

Cree une nouvelle inscription.

- **Authentification** : optionnelle
  - Sans session : requiert un token reCAPTCHA valide (inscription publique)
  - Avec session : pas de CAPTCHA requis (creation admin)

### Requete

```json
{
  "email": "participant@example.com",
  "lastName": "Dupont",
  "firstName": "Jean",
  "structure": "Ministere X",
  "idDocumentType": "CNI",
  "idDocumentNumber": "123456",
  "teamId": "clxxx...",
  "photo": "photos/abc123.jpg",
  "idDocument": "documents/abc123.pdf",
  "recaptchaToken": "token-recaptcha"
}
```

### Reponse (201)

```json
{
  "id": "1260524381003",
  "email": "participant@example.com",
  "lastName": "Dupont",
  "firstName": "Jean",
  ...
}
```

### Comportement

1. Si pas de session : valide le token reCAPTCHA aupres de Google
2. Recupere la categorie (team) pour obtenir le numero
3. Genere l'ID unique au format `[numCat][AAMMJJ][XX][numCat][NNN]`
4. Cree l'inscription en base (status: PENDING)
5. Envoie un email de confirmation au participant

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
| 400 | reCAPTCHA invalide (inscription publique) |
| 404 | Categorie (teamId) non trouvee |

---

## GET /api/registrations/[id]

Retourne le detail d'une inscription.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Reponse (200)

Objet inscription complet avec relation `team`.

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Inscription non trouvee |

---

## PATCH /api/registrations/[id]

Modifie une inscription. Permet de changer le statut, marquer comme imprime, ou activer l'acces total.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Requete (changement de statut)

```json
{
  "status": "APPROVED"
}
```

### Requete (marquer comme imprime)

```json
{
  "badgePrinted": true
}
```

### Requete (activer acces total)

```json
{
  "allAccessGranted": true
}
```

### Comportement

- **Changement de statut** : envoie un email de notification (approbation ou rejet) au participant
- **Badge imprime** : enregistre la date d'impression et envoie un email de notification avec les informations de contact pour la recuperation du badge
- **Autres champs** : mise a jour directe sans effet de bord

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Inscription non trouvee |

---

## DELETE /api/registrations/[id]

Supprime une inscription.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Reponse (200)

```json
{
  "message": "Inscription supprimee"
}
```

---

## POST /api/registrations/print

Marque plusieurs inscriptions comme imprimees en une seule operation.

- **Authentification** : requise
- **Role minimum** : OPERATOR

### Requete

```json
{
  "ids": ["1260524381003", "2260524121004"]
}
```

### Reponse (200)

```json
{
  "success": 2,
  "skipped": 0,
  "errors": 0
}
```

### Comportement

1. Verifie que les informations de contact (email et telephone) sont configurees dans les parametres
2. Pour chaque ID :
   - Verifie que l'inscription existe et est approuvee
   - Ignore les badges deja imprimes (`skipped`)
   - Marque comme imprime avec date
   - Envoie un email de notification
3. Retourne le decompte des succes, ignores et erreurs

### Erreurs

| Code | Cas |
|------|-----|
| 400 | IDs manquants ou tableau vide |
| 400 | Informations de contact non configurees dans les parametres |
