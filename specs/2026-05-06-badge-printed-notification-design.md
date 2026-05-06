# Design : Notification "Badge imprime et pret a retirer"

## Contexte

Les badges sont imprimables. Une fois imprime, l'admin doit pouvoir notifier la personne inscrite que son badge est pret a etre retire. La notification indique un mail et un telephone de contact (parametrables par evenement) et rappelle de se munir de sa piece d'identite.

## Modifications du modele de donnees

### Modele `Registration`

Ajout de deux champs :

- `badgePrinted: Boolean @default(false)` — indique si le badge a ete imprime
- `badgePrintedAt: DateTime?` — date/heure de l'impression

### Modele `Event`

Ajout de deux champs parametrables :

- `contactEmail: String?` — adresse email de contact pour le retrait
- `contactPhone: String?` — numero de telephone de contact pour le retrait

## Nouvelle fonction email

Dans `/src/lib/mail.ts`, ajouter `sendBadgePrintedNotification(to, fullName, registrationId, contactEmail, contactPhone)` :

- **Sujet :** "Badge pret — Ceremonie d'investiture"
- **Contenu :**
  - Informe que le badge est imprime et pret a retirer
  - Indique le mail de contact (`contactEmail`)
  - Indique le telephone de contact (`contactPhone`)
  - Rappelle de se munir de la piece d'identite fournie lors de l'inscription
  - Lien vers le badge en ligne

## API

### PATCH `/api/registrations/[id]`

Etendre le handler existant pour accepter `badgePrinted: true` dans le body :

- Met a jour `badgePrinted = true` et `badgePrintedAt = new Date()`
- Recupere les infos de l'evenement (contactEmail, contactPhone)
- Appelle `sendBadgePrintedNotification`
- Condition : le statut doit etre `APPROVED`

### POST `/api/registrations/print` (nouveau)

Endpoint pour l'action en lot :

- **Body :** `{ ids: string[] }`
- **Auth :** requiert role OPERATOR minimum
- Pour chaque ID :
  - Verifie que le statut est `APPROVED` et `badgePrinted === false`
  - Met a jour `badgePrinted = true` et `badgePrintedAt = new Date()`
  - Envoie la notification
- **Response :** `{ success: number, skipped: number, errors: number }`

## Interface admin

### Page detail inscription (`/admin/registrations/[id]`)

- Bouton "Marquer comme imprime" visible quand :
  - `status === "APPROVED"`
  - `badgePrinted === false`
- Apres clic : appel PATCH, affichage de confirmation, le bouton disparait et un indicateur "Badge imprime" s'affiche avec la date

### Liste des inscriptions (`/admin/registrations`)

- Ajout de checkboxes sur chaque ligne
- Bouton "Marquer comme imprimes" (action en lot) visible quand des inscriptions approuvees non imprimees sont selectionnees
- Indicateur visuel de l'etat d'impression sur chaque ligne
- Filtre supplementaire par etat d'impression

### Formulaire evenement (`/admin/event`)

- Deux nouveaux champs :
  - "Email de contact" (type email, optionnel)
  - "Telephone de contact" (type tel, optionnel)

## Tests

- Test unitaire de `sendBadgePrintedNotification` dans `/src/lib/__tests__/mail.test.ts`
- Test de l'endpoint batch POST `/api/registrations/print`

## Fichiers impactes

| Fichier | Modification |
|---------|-------------|
| `/prisma/schema.prisma` | Ajout champs `badgePrinted`, `badgePrintedAt` sur Registration, `contactEmail`, `contactPhone` sur Event |
| `/src/lib/mail.ts` | Nouvelle fonction `sendBadgePrintedNotification` |
| `/src/lib/__tests__/mail.test.ts` | Tests de la nouvelle fonction |
| `/src/app/api/registrations/[id]/route.ts` | Gestion de `badgePrinted` dans PATCH |
| `/src/app/api/registrations/print/route.ts` | Nouvel endpoint batch (a creer) |
| `/src/app/admin/registrations/[id]/page.tsx` | Bouton "Marquer comme imprime" |
| `/src/app/admin/registrations/page.tsx` | Checkboxes, action en lot, filtre, indicateur |
| `/src/app/admin/event/page.tsx` | Champs contactEmail et contactPhone |
| `/src/components/admin/EventForm.tsx` | Nouveaux champs dans le formulaire |
