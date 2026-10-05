# Feature — Stockage MinIO/S3 et champs upload (item 6)

> ADR de conception : [spec S3](../specs/2026-05-31-v4-stockage-s3-et-backups.md).
> Vue d'ensemble : [architecture.md](../architecture.md#stockage).

## Driver de stockage

`src/lib/storage.ts` bascule de `fs/promises` vers `@aws-sdk/client-s3` :

- API publique inchangee : `uploadFile(key, body, contentType)`, `getFile(key)`,
  `deleteFile(key)`.
- Nouveau : `deletePrefix(prefix)` (archivage par prefixe, ex. `orgs/{orgId}/`).
- `forcePathStyle: true` pour MinIO ; `ensureBucket()` cree le bucket au besoin.
- `getFile` persiste desormais le vrai `contentType` (corrige l'ancien
  `_contentType` ignore du driver filesystem).

## Services et variables

Service `rustfs` dans `docker-compose.dev.yml` (ports 9000 data / 9001 console) et
dans la CI ; service `minio` dans `docker-compose.yml` / `docker-compose.preprod.yml`
(reseau interne, pas de port public). MinIO n'etant plus distribue, le dev est passe
sur RustFS (voir `docs/v4/installation.md`, « Stockage S3 en dev »). Variables lues par
`storage.ts` : `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
`S3_BUCKET` (`badge-dev` en dev).

## Reste a livrer (Task 5.3 / 5.4)

- Securisation de `/api/files/[...path]` : controle d'acces sur les documents
  sensibles (pieces d'identite), retrait du `Cache-Control: public` sur ceux-ci.
- Unification des contrats d'upload (`/api/upload` et `/api/account/upload`).
- Remplacement des champs texte "chemin uploads/..." par de vrais inputs fichier
  (logo org, logo event, inscription admin) via `Dropzone`.

## Tests

`src/lib/__tests__/storage.test.ts` — driver S3 exerce contre RustFS en dev/CI (upload/read/
delete/deletePrefix + validations MIME/taille). Skippe si `S3_ENDPOINT` absent.
