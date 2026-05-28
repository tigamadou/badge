# API -- Fichiers

## POST /api/upload

Upload un fichier (photo, document d'identite ou logo).

- **Authentification** : conditionnelle
  - `type=logo` : requiert une session authentifiee (verifiee apres la validation du fichier).
  - `type=photo` ou `type=idDocument` : pas d'authentification requise (utilise par le formulaire d'inscription publique).
- **Content-Type** : `multipart/form-data`

### Champs du `FormData`

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `file` | File | oui | Fichier a uploader |
| `type` | string | oui | Un des `logo`, `photo`, `idDocument` |
| `registrationId` | string | conditionnel | Obligatoire si `type=photo` ou `type=idDocument`. Sert a calculer la cle de stockage. Pour les inscriptions publiques, un UUID temporaire est utilise puis remplace par l'ID definitif a la creation. |

### Reponse (200)

```json
{ "path": "photos/<registrationId>.jpg" }
```

Le chemin retourne est relatif au repertoire `uploads/` et doit etre transmis tel quel dans les autres endpoints (`photo`, `idDocument`, `event.logo`).

### Cle de stockage

| `type` | Cle calculee |
|--------|---------------|
| `logo` | `logos/event-logo.<ext>` (ecrase l'ancien logo) |
| `photo` | `photos/<registrationId>.<ext>` |
| `idDocument` | `documents/<registrationId>.<ext>` |

L'extension est deduite du nom de fichier d'origine (fallback `jpg`).

### Contraintes

- Taille maximale : 5 Mo.
- Types acceptes pour `photo` et `logo` : JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`).
- Types acceptes pour `idDocument` : JPEG, PNG, WebP, PDF (`application/pdf`).
- Stockage : repertoire local `uploads/` (resolu par `process.cwd()`).

### Erreurs

| Code | Cas |
|------|-----|
| 400 | `file` ou `type` manquant |
| 400 | Type de fichier non autorise (MIME non liste) |
| 400 | Fichier trop volumineux (> 5 Mo) |
| 400 | `type=photo` ou `type=idDocument` sans `registrationId` |
| 400 | `type` invalide |
| 403 | `type=logo` sans session authentifiee |

---

## GET /api/files/[...path]

Sert un fichier uploade.

- **Authentification** : non requise (public)
- **Cache** : `Cache-Control: public, max-age=3600` (1 heure)

### Parametres

Le chemin complet du fichier est passe dans l'URL apres `/api/files/`. Exemples :

- `GET /api/files/photos/1260524381003.jpg`
- `GET /api/files/logos/event-logo.png`
- `GET /api/files/documents/1260524381003.pdf`

### Reponse

Le fichier est retourne avec son `Content-Type` deduit de l'extension (mapping `.jpg/.jpeg`, `.png`, `.webp`, `.pdf` ; `application/octet-stream` en defaut).

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Fichier non trouve sur le disque |
