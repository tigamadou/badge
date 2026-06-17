# API publique — `/api/public/*` et `/api/upload`

> **Statut** : implémentée via [Plan v2-05](../plans/2026-05-28-v2-05-inscription-publique.md) le 2026-05-31.

Cette page documente les routes API non authentifiées exposées au participant final (inscription publique, vérification de badge, édition après rejet) ainsi que la route d'upload contextualisée. Le *pourquoi* du design vit dans [`features/inscription-publique.md`](../features/inscription-publique.md) et dans la spec d'implémentation. Les codes ci-dessous reflètent le code actuel — en cas de divergence, le code fait foi.

## Pages associées

| Page | Description |
|---|---|
| `/e/[slug]` | Formulaire d'inscription publique (Server Component + `PublicRegistrationForm` client). |
| `/e/[slug]/success` | Confirmation post-soumission (contact résolu en cascade). |
| `/edit-registration/[token]` | Réédition d'une inscription après rejet (snapshot + repasse en `PENDING`). |
| `/edit-registration/expired` | Page de secours avec bouton « demander un nouveau lien ». |
| `/verify/[badgeId]` | Vérification publique du badge (masque le nom si la catégorie est anonyme). |

## Routes API

### 1. `POST /api/upload`

Upload contextualisé sans authentification. Source : `src/app/api/upload/route.ts`.

| Aspect | Détail |
|---|---|
| Query | `context=event:<slug>` (obligatoire), `kind=photo` ou `kind=document` (obligatoire) |
| Body | `multipart/form-data` avec un champ `file` |
| Succès | `200` `{ token, originalName, kind, size }` — `token` est un `uploadToken` HMAC à TTL 1 h |
| Rate-limit | clé `upload` — 10 req/min/IP |

Codes d'erreur :

| Code | Symbole | Cause |
|---|---|---|
| 400 | `BAD_CONTEXT` | `context` mal formé ou `kind` invalide |
| 400 | `NO_FILE` | champ `file` absent |
| 403 | `CLOSED` | événement archivé ou `registrationOpen=false` |
| 404 | `NOT_FOUND` | slug inexistant |
| 413 | `TOO_LARGE` | fichier > 5 Mo |
| 415 | `BAD_TYPE` | MIME non autorisé (voir `isAllowedMime` dans `src/lib/storage.ts`) |
| 429 | `RATE_LIMITED` | dépassement de la fenêtre de rate-limit |

Le fichier est écrit dans `uploads/events/<eventId>/{photos,idDocuments}/<uuid>.<ext>` via `src/lib/storage.ts` (`eventPhotoKey` / `eventIdDocumentKey`). Le nom original est sanitizé via `safeFilename` (anti path-traversal).

### 2. `GET /api/public/events/[slug]`

Charge le contexte public d'un événement (méta + catégories + settings publics). Source : `src/app/api/public/events/[slug]/route.ts`.

| Aspect | Détail |
|---|---|
| Succès | `200` `{ event: { id, slug, title, ... }, categories: [...], publicSettings: { contactEmail, contactPhone, recaptcha }, branding }` |
| Rate-limit | clé `public-event-get` |

Codes d'erreur : `403 CLOSED`, `404 NOT_FOUND`, `429 RATE_LIMITED`.

Le contact est résolu en cascade `Event → Organization → Platform` via `resolvePublicSettings`. La clé site reCAPTCHA est lue séparément via `getPlatformPublicRecaptcha()` (jamais la secret key).

### 3. `POST /api/public/events/[slug]/registrations`

Création d'une inscription publique. Source : `src/app/api/public/events/[slug]/registrations/route.ts`.

| Aspect | Détail |
|---|---|
| Body (JSON) | données du formulaire + `photoUploadToken`, `idDocumentUploadToken`, `recaptchaToken?` |
| Succès | `201` `{ id }` |
| Rate-limit | clé `public-registration:<slug>` |

Codes d'erreur :

| Code | Symbole | Cause |
|---|---|---|
| 400 | `BAD_JSON` | body non parseable |
| 400 | `VALIDATION` | échec du schéma Zod (`src/lib/validators/registration.ts`) |
| 400 | `BAD_CATEGORY` | `categoryId` n'appartient pas à l'event |
| 400 | `RECAPTCHA_MISSING` / `RECAPTCHA_INVALID` / `RECAPTCHA_LOW_SCORE` | reCAPTCHA activé mais token absent ou invalide / score < 0.5 |
| 400 | `UPLOAD_TOKEN_INVALID` / `UPLOAD_TOKEN_EXPIRED` / `UPLOAD_TOKEN_MISMATCH` | token HMAC invalide, expiré ou ne référence pas le bon `(eventId, kind)` |
| 403 | `CLOSED` | événement archivé ou fermé |
| 404 | `NOT_FOUND` | slug inexistant |
| 409 | `EMAIL_BLOCKED` | présent dans `BlockedEmail` |
| 409 | `DOCUMENT_BLOCKED` | présent dans `BlockedDocument` |
| 429 | `QUOTA_EXCEEDED` | quota org atteint (compte `PENDING`+`APPROVED`) |
| 429 | `RATE_LIMITED` | dépassement de la fenêtre |

Action logguée : `REGISTRATION_CREATED` avec IP et user-agent.

### 4. `GET /api/public/verify/[badgeId]`

Vérification publique d'un badge (consommée par le scan QR depuis n'importe quel appareil). Source : `src/app/api/public/verify/[badgeId]/route.ts`.

| Aspect | Détail |
|---|---|
| Succès | `200` `{ valid: true, event, category?, participant? }` (le participant est masqué si `category.anonymous=true`) ou `{ valid: false }` si statut non `APPROVED` ou badge non imprimé |
| Rate-limit | clé `public-verify` |

Codes d'erreur : `404 NOT_FOUND`, `429 RATE_LIMITED`.

Action logguée : `BADGE_SCANNED` avec IP et user-agent.

### 5. `GET /api/public/edit-registration/[token]`

Charge l'inscription à éditer après rejet. Source : `src/app/api/public/edit-registration/[token]/route.ts`.

| Aspect | Détail |
|---|---|
| Succès | `200` `{ registration, event, categories }` (avec valeurs pré-remplies, sans `editToken` ni hash) |
| Rate-limit | clé `public-edit-get` |

Codes d'erreur : `404 NOT_FOUND` (token inconnu), `410 GONE` (token expiré ou consommé), `429 RATE_LIMITED`.

### 6. `POST /api/public/edit-registration/[token]`

Resoumission d'une inscription rejetée. Source : `src/app/api/public/edit-registration/[token]/route.ts`.

| Aspect | Détail |
|---|---|
| Body (JSON) | même format que la création publique |
| Succès | `200` `{ id }` |
| Rate-limit | clé `public-edit-post` |

Codes d'erreur identiques à la création publique, **sans** `QUOTA_EXCEEDED` (la resoumission ne consomme pas de nouveau slot — l'inscription existe déjà).

Comportement spécifique :

- Snapshot de l'état précédent (`SubmissionSnapshot`).
- Statut remis à `PENDING`.
- `editToken` et `editTokenExpiresAt` effacés (single-use).
- Action logguée : `REGISTRATION_RESUBMITTED` avec IP, user-agent, `registrationId`.

### 7. `POST /api/public/edit-registration/[token]/resend`

Régénération du lien d'édition (cas du lien expiré). Source : `src/app/api/public/edit-registration/[token]/resend/route.ts`.

| Aspect | Détail |
|---|---|
| Succès | `200` (toujours, par anti-énumération, même si le token est inconnu) |
| Rate-limit | clé `public-edit-resend` (IP) + cooldown 60 s par `registrationId` |

Codes d'erreur :

| Code | Symbole | Cause |
|---|---|---|
| 429 | `COOLDOWN` | un envoi a déjà eu lieu il y a moins de 60 s pour cette inscription |
| 429 | `RATE_LIMITED` | dépassement de la fenêtre IP |

Action logguée : `EDIT_LINK_SENT` avec IP et user-agent.

## Notes transverses

### Protocole d'upload en deux phases

1. Le client appelle `POST /api/upload` pour chaque fichier (photo, document). Le serveur écrit le fichier sur disque et retourne un `uploadToken` HMAC SHA-256 signé avec `UPLOAD_TOKEN_SECRET`, contenant `{ eventId, kind, storageKey, expiresAt }`. TTL : 1 h.
2. Le client envoie ensuite la création d'inscription (`POST /api/public/events/[slug]/registrations`) avec les deux tokens. Le serveur vérifie chaque token (signature, expiration, binding `eventId+kind`) puis enregistre la `Registration` en BDD avec les chemins de fichier consommés.

Ce protocole empêche les uploads orphelins, le swap cross-event et le swap cross-kind. Voir `src/lib/upload-token.ts`.

### Token d'édition (`editToken`)

- Format : `randomBytes(32).toString("hex")` (64 chars hex).
- Stockage : `Registration.editToken` (clair) + `Registration.editTokenExpiresAt` (TTL 48 h).
- Single-use : effacé après resubmit réussi.
- Régénération via `/resend` (cooldown 60 s par inscription, anti-enumération côté IP).
- Jamais exposé dans les réponses API — uniquement envoyé par email (`sendEditLinkEmail`, stub Plan 6).

Voir `src/lib/edit-token.ts`.

### reCAPTCHA

- Configuration plateforme uniquement (`PlatformSettings.recaptchaEnabled`, `recaptchaSiteKey`, `recaptchaSecretKey`). Pas de cascade.
- Côté serveur : si `recaptchaEnabled=false`, vérification skippée silencieusement (route accepte les requêtes sans token).
- Si activé : vérification serveur contre Google avec score minimal **0.5** (sinon `RECAPTCHA_LOW_SCORE`).
- Côté client : la clé site est exposée via la route `GET /api/public/events/[slug]` (`publicSettings.recaptcha.siteKey`). Le widget n'apparaît que si `enabled=true`.

Voir `src/lib/recaptcha.ts`.

### Branding (cascade)

Le contact public (`contactEmail`, `contactPhone`) suit la cascade `Event → Organization → Platform`, premier non-null gagne (`resolvePublicSettings`). Le SMTP et la clé secrète reCAPTCHA restent strictement plateforme (`getPlatformSmtp()`, `getPlatformRecaptcha()`) — voir [`features/multi-tenancy-rbac.md`](../features/multi-tenancy-rbac.md).

### Blocklists

À la création (route 3) et à la resoumission (route 6), le serveur vérifie :

- `BlockedEmail` (scope event) : 409 `EMAIL_BLOCKED`.
- `BlockedDocument` (scope event) : 409 `DOCUMENT_BLOCKED`.

### Quota

Le quota `Organization.quotaMaxRegistrations` compte les inscriptions `PENDING`+`APPROVED` sur tous les events de l'org (`REJECTED` exclues — le rejet libère un slot). Voir `src/lib/event-quota.ts`. Côté public : `429 QUOTA_EXCEEDED`. Côté admin : bypass possible avec audit `quotaBypass=true` (Plan v2-04).

### Rate-limit

Implémentation in-memory par instance (clé composite `route:IP`), fenêtre 1 min, 10 req max. Voir `src/lib/rate-limit.ts`. Limitations MVP :

- État non partagé entre processus (pas de Redis).
- IP extraite via `extractClientIp` (leftmost `x-forwarded-for`, spoofable côté client).
- Map non bornée (les buckets stales sont nettoyés à la prochaine lecture).

### Audit

Toutes les routes publiques mutent l'audit via `logActivity()` (`src/lib/activity-log.ts`) avec `ipAddress` et `userAgent`. Types utilisés : `REGISTRATION_CREATED`, `REGISTRATION_RESUBMITTED`, `BADGE_SCANNED`, `EDIT_LINK_SENT`.

### Variable d'environnement

| Variable | Rôle |
|---|---|
| `UPLOAD_TOKEN_SECRET` | Clé HMAC SHA-256 pour signer les `uploadToken`. À générer avec `openssl rand -base64 32`. Voir `.env.production.example`. |
