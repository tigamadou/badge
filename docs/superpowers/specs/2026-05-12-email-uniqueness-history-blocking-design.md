# Unicité email, historique de soumissions, blocage

## Contexte

Le système permet de rejeter des inscriptions et de les resoumettre via un lien unique. Il faut maintenant :
1. Empêcher les doublons d'inscription par email
2. Garder un historique complet de chaque soumission
3. Permettre à l'admin de bloquer définitivement un email

## Design

### Modèle SubmissionSnapshot

Snapshot complet des champs à chaque soumission/ressoumission.

```prisma
model SubmissionSnapshot {
  id               String       @id @default(cuid())
  registrationId   String
  registration     Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  lastName         String
  firstName        String
  email            String
  structure        String
  teamId           String
  idDocumentType   String
  idDocumentNumber String
  photo            String?
  idDocument       String?
  createdAt        DateTime     @default(now())
}
```

Créé :
- À la création initiale (POST /api/registrations)
- À chaque ressoumission (POST /api/edit-registration/[token])

### Modèle BlockedEmail

```prisma
model BlockedEmail {
  id        String   @id @default(cuid())
  email     String   @unique
  reason    String?
  createdAt DateTime @default(now())
}
```

### Vérification à l'inscription (POST /api/registrations)

1. BlockedEmail existe ? → 400 "Une erreur est survenue"
2. Registration existante pour cet email :
   - PENDING → 409 "Une inscription est déjà en cours de traitement pour cette adresse email."
   - APPROVED → 409 "Une inscription validée existe déjà pour cette adresse email."
   - REJECTED → 409 avec `canResend: true` + message

### Route POST /api/registrations/resend-edit-link

- Reçoit { email }, publique
- Vérifie inscription REJECTED pour cet email
- Génère editToken + expiration 48h
- Envoie email via sendEditLinkEmail

### Frontend page.tsx

Sur 409 avec canResend: true → bouton "Recevoir un lien de modification" → appel resend-edit-link → message succès

### Admin page détails

- Section "Historique des soumissions" avec snapshots
- Bouton "Bloquer cet email" (inscriptions rejetées) → crée BlockedEmail
- Indicateur "Email bloqué" + bouton "Débloquer"

### Vérifications blocage

POST /api/edit-registration/[token] et resend vérifient BlockedEmail.
