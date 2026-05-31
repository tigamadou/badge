# API -- Evenement

## GET /api/event

Retourne les informations de l'evenement.

- **Authentification** : non requise (public)

### Reponse (200)

```json
{
  "id": "clxxx...",
  "title": "Conference annuelle",
  "location": "Cotonou",
  "date": "2026-05-24T00:00:00.000Z",
  "logo": "logos/logo-event.png",
  "registrationOpen": true
}
```

| Champ | Type | Description |
|-------|------|-------------|
| id | string | Identifiant de l'evenement |
| title | string | Titre |
| location | string | Lieu |
| date | string (ISO) | Date de l'evenement |
| logo | string \| null | Chemin relatif du logo (servi par `/api/files/<path>`) |
| registrationOpen | boolean | `true` si le formulaire d'inscription public est ouvert |

Retourne `null` si aucun evenement n'est configure.

---

## PUT /api/event

Cree ou met a jour l'evenement (upsert). Un seul evenement existe dans le systeme.

- **Authentification** : requise
- **Role minimum** : ADMIN
- **Note** : seul un SUPER_ADMIN peut modifier `registrationOpen`. Si un ADMIN passe ce champ, il est silencieusement ignore.

### Requete

```json
{
  "title": "Conference annuelle",
  "location": "Cotonou",
  "date": "2026-05-24",
  "logo": "logos/logo-event.png",
  "registrationOpen": true
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| title | string | oui | Titre de l'evenement |
| location | string | oui | Lieu |
| date | string (date) | oui | Date de l'evenement |
| logo | string \| null | non | Chemin du fichier logo (via `/api/upload`) |
| registrationOpen | boolean | non | Ouverture des inscriptions publiques (SUPER_ADMIN uniquement) |

### Reponse (200)

Objet evenement cree ou mis a jour.

### Activity log

Toute modification ecrit une entree `EVENT_UPDATED` (avec `details: { eventTitle, location }`) dans le journal d'activite.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs obligatoires manquants |
| 403 | Role insuffisant (moins que ADMIN) |
