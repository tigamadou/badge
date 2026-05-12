# Spec : Modification d'une inscription validee apres approbation

## Objectif

Permettre a un admin d'envoyer un lien de modification a un inscrit dont l'inscription est APPROVED. Apres modification, l'inscription repasse en PENDING pour re-validation. Le badge imprime est reinitialise.

## Mecanisme

Reutiliser le systeme d'edit token existant (celui des rejets) en l'etendant au statut APPROVED.

## Changements

### 1. API — Nouvelle action `send-edit-link` sur PATCH /api/registrations/[id]

Ajouter une branche pour `action: "send-edit-link"` dans le handler PATCH existant :

- Verifier que `registration.status === "APPROVED"`
- Verifier que les contacts sont configures (`areContactsConfigured`)
- Generer `editToken = randomUUID()` et `editTokenExpiresAt = now + 48h`
- Mettre a jour l'inscription avec le token (sans changer le statut)
- Appeler `sendEditLinkEmail(registration.email, fullName, editToken)`
- Logger l'activite `EDIT_LINK_SENT`
- Retourner l'inscription mise a jour

### 2. API — Accepter APPROVED dans les routes edit-registration/[token]

**GET /api/edit-registration/[token]** :
- Changer la condition de `status === "REJECTED"` a `status === "REJECTED" || status === "APPROVED"`

**POST /api/edit-registration/[token]** :
- Meme changement de condition sur le statut
- Lors de la resoumission, ajouter la reinitialisation du badge :
  - `badgePrinted: false`
  - `badgePrintedAt: null`
- Le reste du flux existant s'applique : status -> PENDING, vider editToken/editTokenExpiresAt, creer SubmissionSnapshot, envoyer email de confirmation

### 3. UI Admin — Bouton sur la page de detail

Sur `/admin/registrations/[id]`, ajouter un bouton "Envoyer un lien de modification" visible quand :
- `registration.status === "APPROVED"`
- `contactsConfigured === true`

Le bouton appelle `PATCH /api/registrations/[id]` avec `{ action: "send-edit-link" }`.

Apres succes, afficher une confirmation.

### 4. Page d'edition — Adaptation affichage

Dans `/edit-registration/[token]/page.tsx`, le bloc affichant le motif de rejet (`rejectionReason`) ne doit s'afficher que si `rejectionReason` est present. Pas de changement si c'est deja le cas ; sinon ajouter la condition.

### 5. Route resend pour APPROVED

Dans `/api/edit-registration/[token]/resend`, accepter aussi le statut APPROVED (meme logique que pour REJECTED).

## Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/app/api/registrations/[id]/route.ts` | Ajouter action `send-edit-link` |
| `src/app/api/edit-registration/[token]/route.ts` | Accepter statut APPROVED en GET et POST, reinitialiser badge |
| `src/app/api/edit-registration/[token]/resend/route.ts` | Accepter statut APPROVED |
| `src/app/admin/registrations/[id]/page.tsx` | Bouton envoi lien de modification |
| `src/app/edit-registration/[token]/page.tsx` | Conditionner affichage motif de rejet |

## Pas de migration

Aucun changement au schema Prisma — les champs `editToken` et `editTokenExpiresAt` existent deja.
