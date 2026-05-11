# API -- Evenement

## GET /api/event

Retourne les informations de l'evenement.

- **Authentification** : non requise (public)

### Reponse (200)

```json
{
  "id": "clxxx...",
  "title": "Ceremonie d'investiture du President de la Republique",
  "location": "Porto-Novo",
  "date": "2026-05-24T00:00:00.000Z",
  "logo": "logos/logo-event.png"
}
```

Retourne `null` si aucun evenement n'est configure.

---

## PUT /api/event

Cree ou met a jour l'evenement (upsert). Un seul evenement existe dans le systeme.

- **Authentification** : requise
- **Role minimum** : ADMIN

### Requete

```json
{
  "title": "Ceremonie d'investiture du President de la Republique",
  "location": "Porto-Novo",
  "date": "2026-05-24",
  "logo": "logos/logo-event.png"
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| title | string | oui | Titre de l'evenement |
| location | string | oui | Lieu |
| date | string (date) | oui | Date de l'evenement |
| logo | string | non | Chemin du fichier logo (via /api/upload) |

### Reponse (200)

Objet evenement cree ou mis a jour.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
