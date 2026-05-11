# API -- Fichiers

## POST /api/upload

Upload un fichier (photo, document d'identite ou logo).

- **Authentification** : conditionnelle
  - Upload de logo : requiert une session authentifiee
  - Upload de photo ou document : pas d'authentification requise (inscription publique)
- **Content-Type** : `multipart/form-data`

### Requete

| Champ | Type | Description |
|-------|------|-------------|
| file | File | Fichier a uploader |

### Reponse (200)

```json
{
  "path": "photos/abc123def456.jpg"
}
```

Le chemin retourne est relatif au repertoire `uploads/` et doit etre utilise tel quel dans les autres endpoints.

### Contraintes

- Taille maximale : 5 Mo
- Types acceptes : JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`), PDF (`application/pdf`)
- Stockage : repertoire local `/uploads`

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Aucun fichier fourni |
| 400 | Type de fichier non supporte |
| 400 | Fichier trop volumineux |

---

## GET /api/files/[...path]

Sert un fichier uploade.

- **Authentification** : non requise (public)
- **Cache** : `Cache-Control: public, max-age=3600` (1 heure)

### Parametres

Le chemin complet du fichier est passe dans l'URL. Exemples :

- `GET /api/files/photos/abc123.jpg`
- `GET /api/files/logos/logo-event.png`
- `GET /api/files/documents/abc123.pdf`

### Reponse

Le fichier est retourne avec le type MIME appropriate (detection automatique selon l'extension).

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Fichier non trouve |
