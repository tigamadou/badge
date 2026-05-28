# API -- Inscriptions

Toutes les routes administratives exigent un role minimum `MODERATEUR` (sauf indication contraire). Les actions de validation, rejet, marquage badge imprime et suppression sont egalement refusees pour le role `SUPER_ADMIN` (403). Les actions qui declenchent un email exigent que `contactEmail` et `contactPhone` soient configures dans les parametres ; sinon l'API renvoie 400.

## GET /api/registrations

Liste paginee des inscriptions.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Parametres de requete

| Parametre | Type | Defaut | Description |
|-----------|------|--------|-------------|
| `page` | int | 1 | Numero de page (>=1) |
| `limit` | int | 20 | Taille de page (1-100) |
| `status` | string | -- | `PENDING` / `APPROVED` / `REJECTED` |
| `teamId` | string | -- | Filtre par categorie |
| `search` | string | -- | Recherche dans lastName, firstName, email, structure |

### Reponse (200)

```json
{
  "data": [
    {
      "id": "1260524381003",
      "email": "participant@example.com",
      "lastName": "Dupont",
      "firstName": "Jean",
      "structure": "Ministere X",
      "photo": "photos/1260524381003.jpg",
      "idDocumentType": "CNI",
      "idDocumentNumber": "123456",
      "idDocument": "documents/1260524381003.pdf",
      "status": "APPROVED",
      "badgePrinted": false,
      "badgePrintedAt": null,
      "allAccessGranted": false,
      "rejectionReason": null,
      "rejectionDetails": null,
      "editToken": null,
      "editTokenExpiresAt": null,
      "teamId": "clxxx...",
      "team": {
        "id": "clxxx...",
        "name": "Protocole",
        "color": "#2563EB",
        "number": 2
      },
      "createdAt": "2026-05-10T10:00:00.000Z"
    }
  ],
  "total": 124,
  "page": 1,
  "totalPages": 7
}
```

---

## POST /api/registrations

Cree une nouvelle inscription (publique ou admin).

- **Authentification** : optionnelle
  - Sans session : inscription publique. reCAPTCHA exige uniquement si `settings.recaptchaEnabled = true`.
  - Avec session : creation admin (`MODERATEUR` au minimum). Pas de reCAPTCHA. Indispensable pour les categories `anonymous` (refus 403 sinon).
- **Pre-condition publique** : l'evenement doit avoir `registrationOpen = true` (sinon 403 pour les requetes non authentifiees).

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
  "photo": "photos/<id>.jpg",
  "idDocument": "documents/<id>.pdf",
  "captchaToken": "token-recaptcha"
}
```

Les champs `photo` et `idDocument` sont les chemins relatifs retournes par `POST /api/upload`.

### Reponse (201)

```json
{
  "id": "1260524381003",
  "email": "participant@example.com",
  "lastName": "Dupont",
  "firstName": "Jean",
  "structure": "Ministere X",
  "status": "PENDING",
  "team": { "id": "clxxx...", "name": "Protocole", "color": "#2563EB", "number": 2 }
}
```

Particularite : pour les **categories anonymes**, le serveur cree l'inscription avec `status: "APPROVED"` immediatement et n'envoie aucun email. Les champs personnels (email, nom, etc.) peuvent etre vides.

### Comportement

1. Si pas de session : verifie `event.registrationOpen` -> 403 si ferme.
2. Recupere la categorie (`teamId`). 400 si absente.
3. Si la categorie est `anonymous`, exige une session moderateur (sinon 403).
4. Pour les categories non anonymes : verifie que tous les champs sont presents (incluant `photo` et `idDocument`).
5. Verifie la **liste noire** (`BlockedEmail` / `BlockedDocument`). En cas de match -> reponse 201 factice `{ id: "blocked", status: "PENDING", team: { name, color } }` (rejet silencieux, l'inscription n'est pas creee).
6. Verifie l'**unicite** de l'email puis du numero de document parmi les inscriptions existantes. Selon le statut existant, renvoie 409 avec un message dedie ; pour un `REJECTED` non bloque, renvoie en plus `canResend: true` + `email` pour permettre l'envoi d'un lien d'edition.
7. Si pas de session : valide le token reCAPTCHA aupres de Google si `recaptchaEnabled` (la cle secrete provient des parametres).
8. Genere l'ID via `generateId` (voir `docs/features/badges.md`).
9. Cree la `Registration` + un `SubmissionSnapshot`.
10. Envoie l'email de confirmation (sauf pour les categories anonymes).
11. Enregistre un log `REGISTRATION_CREATED`.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | `teamId` absent |
| 400 | Categorie introuvable |
| 400 | Champs requis manquants (categorie non anonyme) |
| 400 | reCAPTCHA requis ou invalide |
| 403 | Inscriptions fermees (`registrationOpen = false`, sans session) |
| 403 | Categorie anonyme demandee sans session moderateur |
| 409 | Email ou numero de document deja utilise (avec details + `canResend` si applicable) |

---

## GET /api/registrations/[id]

Retourne le detail d'une inscription, ses snapshots et son etat de blocage.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Reponse (200)

```json
{
  "id": "1260524381003",
  "...": "...",
  "team": { "...": "..." },
  "snapshots": [
    {
      "id": "...",
      "lastName": "Dupont",
      "firstName": "Jean",
      "email": "participant@example.com",
      "structure": "Ministere X",
      "teamId": "clxxx...",
      "idDocumentType": "CNI",
      "idDocumentNumber": "123456",
      "photo": "photos/...",
      "idDocument": "documents/...",
      "createdAt": "2026-05-10T10:00:00.000Z"
    }
  ],
  "emailBlocked": false,
  "documentBlocked": false
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 403 | Role insuffisant |
| 404 | Inscription non trouvee |

---

## PATCH /api/registrations/[id]

Modifie une inscription (statut, ALL ACCESS, marquage badge imprime, divers) ou declenche une action speciale.

- **Authentification** : requise
- **Role minimum** : MODERATEUR
- **SUPER_ADMIN** : refuse pour `status`, `badgePrinted` et `allAccessGranted`.

### Variante 1 -- Changement de statut

```json
{ "status": "APPROVED" }
```

ou

```json
{
  "status": "REJECTED",
  "rejectionReason": "Photo non conforme",
  "rejectionDetails": "La photo est floue."
}
```

- Le passage `REJECTED -> APPROVED` est refuse (400).
- Lors d'un rejet, un `editToken` (UUID) + `editTokenExpiresAt` (48h) sont generes automatiquement et le lien est inclus dans l'email de notification.
- Un email est envoye via `sendStatusNotification`.

### Variante 2 -- Marquage badge imprime

```json
{ "badgePrinted": true }
```

- Met `badgePrintedAt` a la date courante.
- Envoie un email "badge imprime" avec les informations de contact.

### Variante 3 -- Toggle ALL ACCESS

```json
{ "allAccessGranted": true }
```

### Variante 4 -- Action `send-edit-link`

```json
{ "action": "send-edit-link" }
```

- Autorisee uniquement si l'inscription est `APPROVED` ou `REJECTED`.
- Genere un nouvel `editToken` (UUID) valable 48h et envoie un email via `sendEditLinkEmail`.
- Enregistre un log `EDIT_LINK_SENT`.

### Comportement transverse

- Avant tout email (statut `APPROVED`/`REJECTED`, `badgePrinted: true`, `action: send-edit-link`), l'API verifie que `contactEmail` et `contactPhone` sont configures. Sinon 400 avec message d'erreur.
- Un log d'activite est ecrit pour chaque type de modification (`REGISTRATION_APPROVED`, `REGISTRATION_REJECTED`, `BADGE_PRINTED`, `BADGE_ALL_ACCESS_TOGGLED`, `REGISTRATION_UPDATED`, `EDIT_LINK_SENT`).

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Informations de contact non configurees |
| 400 | Tentative `REJECTED -> APPROVED` |
| 400 | Action `send-edit-link` sur une inscription `PENDING` |
| 403 | SUPER_ADMIN tentant `status`, `badgePrinted` ou `allAccessGranted` |
| 404 | Inscription non trouvee |
| 500 | Echec d'envoi d'email (`send-edit-link` uniquement) |

---

## DELETE /api/registrations/[id]

Supprime une inscription.

- **Authentification** : requise
- **Role minimum** : MODERATEUR
- **SUPER_ADMIN** : refuse (403).

### Reponse (200)

```json
{ "success": true }
```

Un log `REGISTRATION_DELETED` est ecrit.

---

## POST /api/registrations/[id]/block-email
## DELETE /api/registrations/[id]/block-email

Ajoute (POST) ou retire (DELETE) l'email d'une inscription dans la table `BlockedEmail`.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

POST cree un enregistrement avec `reason = "Bloque depuis inscription <id>"`. Tant que l'email est bloque, toute nouvelle creation publique avec cet email est silencieusement ignoree (reponse 201 factice).

### Reponse

```json
{ "success": true }
```

---

## POST /api/registrations/[id]/block-document
## DELETE /api/registrations/[id]/block-document

Idem `block-email`, mais pour le numero de document (`BlockedDocument`).

---

## GET /api/registrations/[id]/duplicates

Retourne la liste des inscriptions similaires a l'inscription `id`.

- **Authentification** : requise
- **Role minimum** : MODERATEUR

### Reponse (200)

```json
[
  {
    "id": "...",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "j.dupont@example.com",
    "idDocumentNumber": "...",
    "idDocumentType": "CNI",
    "structure": "...",
    "status": "PENDING",
    "createdAt": "2026-05-10T10:00:00.000Z",
    "team": { "id": "...", "name": "...", "color": "#..." },
    "matchReasons": [
      "Meme numero de document d'identite",
      "Meme adresse email"
    ]
  }
]
```

Regles de detection (insensibles a la casse) :

1. Meme `idDocumentNumber` (trim + lowercase).
2. Meme email (trim + lowercase).
3. `firstName + lastName` strictement identiques.
4. `firstName` et `lastName` inverses (nom/prenom swap).
5. Le prefixe d'email de l'inscription comparee correspond a `<firstName>.<lastName>` ou `<lastName>.<firstName>` de l'inscription courante.
6. Symetrique : le prefixe d'email courant correspond au nom de l'inscription comparee.

Le tableau est trie par nombre decroissant de `matchReasons`.

---

## POST /api/registrations/print

Marque plusieurs inscriptions comme imprimees en une seule operation.

- **Authentification** : requise
- **Role minimum** : MODERATEUR (refuse pour SUPER_ADMIN)

### Requete

```json
{ "ids": ["1260524381003", "2260524121004"] }
```

### Reponse (200)

```json
{ "success": 2, "skipped": 0, "errors": 0 }
```

### Comportement

1. Verifie que les informations de contact (email et telephone) sont configurees.
2. Pour chaque ID :
   - Si l'inscription n'existe pas, n'est pas `APPROVED`, ou est deja imprimee -> `skipped++`.
   - Sinon, marque comme imprime + envoie l'email de notification.
3. Ecrit un log `BADGE_BATCH_PRINTED` avec les compteurs.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | `ids` absents ou tableau vide |
| 400 | Informations de contact non configurees |
| 403 | Role insuffisant ou SUPER_ADMIN |

---

## POST /api/registrations/resend-edit-link

Renvoie un lien d'edition a une adresse email donnee (utilise par la page d'accueil lorsque le retour d'inscription contient `canResend: true`).

- **Authentification** : non requise (public)

### Requete

```json
{ "email": "participant@example.com" }
```

### Reponse (200)

Toujours `{ "success": true }`, meme si l'email n'existe pas ou est bloque. Cela permet de ne pas reveler l'existence d'une inscription a un appelant externe.

### Comportement

1. Verifie les informations de contact (400 sinon).
2. Verifie que l'email n'est pas dans `BlockedEmail` et que le document associe n'est pas dans `BlockedDocument` (rejet silencieux).
3. Cherche la derniere inscription `REJECTED` pour cet email. Sinon renvoie `success: true` sans rien faire.
4. Genere un nouvel `editToken` (48h) et envoie l'email avec le lien.

---

## GET /api/edit-registration/[token]

Recupere les donnees d'une inscription a partir d'un token de modification.

- **Authentification** : non requise (public)

### Reponse (200)

```json
{
  "id": "...",
  "lastName": "...",
  "firstName": "...",
  "email": "...",
  "structure": "...",
  "teamId": "...",
  "idDocumentType": "CNI",
  "idDocumentNumber": "...",
  "photo": "photos/...",
  "idDocument": "documents/...",
  "rejectionReason": "...",
  "rejectionDetails": "..."
}
```

`rejectionReason` et `rejectionDetails` sont `null` si l'inscription est dans l'etat `APPROVED` (cas du lien envoye manuellement par un moderateur).

### Erreurs

| Code | Cas |
|------|-----|
| 404 | Token inconnu ou inscription dans un etat autre que `APPROVED` / `REJECTED` |
| 410 | Token expire. Reponse `{ "error": "expired", "registrationId": "..." }` |

---

## POST /api/edit-registration/[token]

Resoumet une inscription via un token de modification. L'inscription repasse en `PENDING`.

- **Authentification** : non requise (public)

### Requete

```json
{
  "lastName": "...",
  "firstName": "...",
  "email": "...",
  "structure": "...",
  "teamId": "...",
  "idDocumentType": "CNI",
  "idDocumentNumber": "...",
  "photo": "photos/...",
  "idDocument": "documents/..."
}
```

Tous les champs sont obligatoires. Les chemins `photo` et `idDocument` sont les valeurs renvoyees par `POST /api/upload` (l'inscrit peut conserver les anciens chemins ou en uploader de nouveaux).

### Reponse (200)

L'inscription mise a jour avec sa relation `team`. Le statut est `PENDING`, `editToken` est efface, `rejectionReason` / `rejectionDetails` sont remis a `null`, `badgePrinted` est remis a `false`.

### Comportement

1. Verifie la validite du token et de son expiration (410 si expire).
2. Si l'email ou le document est dans la liste noire (`BlockedEmail` / `BlockedDocument`) : reponse 200 factice `{ id, status: "PENDING" }` sans modifier l'inscription (rejet silencieux).
3. Verifie que tous les champs sont presents (400 sinon).
4. Verifie qu'aucune autre inscription `PENDING` ou `APPROVED` n'utilise deja ce numero de document (409 sinon).
5. Met a jour l'inscription, cree un `SubmissionSnapshot`, ecrit un log `REGISTRATION_RESUBMITTED`.
6. Envoie un email de confirmation de reception (`sendRegistrationConfirmation`).

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Champs requis manquants |
| 404 | Token inconnu |
| 409 | Numero de document deja utilise par une autre inscription `PENDING` ou `APPROVED` |
| 410 | Token expire |

---

## POST /api/edit-registration/[token]/resend

Renouvelle l'`editToken` d'une inscription (validite 48h) et renvoie l'email contenant le nouveau lien.

- **Authentification** : non requise (public)

Utilise par la page `/edit-registration/[token]` lorsque l'utilisateur voit un message "Lien expire" et clique sur "Renvoyer le lien".

### Reponse (200)

```json
{ "success": true }
```

### Comportement

1. Verifie les informations de contact (400 sinon).
2. Verifie le token et le statut (`APPROVED` / `REJECTED`). 404 sinon.
3. Si l'email est dans `BlockedEmail`, retourne 400 generique sans renouveler le token.
4. Genere un nouveau token, met a jour `editTokenExpiresAt` (48h) et envoie un email avec `sendEditLinkEmail`.

### Erreurs

| Code | Cas |
|------|-----|
| 400 | Informations de contact non configurees, ou email bloque |
| 404 | Token inconnu ou statut invalide |
| 500 | Echec d'envoi d'email |
