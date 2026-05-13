# Unicité email, historique, blocage — Plan d'implémentation

**Goal:** Empêcher les doublons par email, garder un historique des soumissions, permettre le blocage d'email.

**Architecture:** Deux nouveaux modèles Prisma (SubmissionSnapshot, BlockedEmail). Vérifications dans les routes d'inscription et de ressoumission. Historique et blocage visibles dans l'admin.

---

### Task 1: Schema Prisma

**Files:** prisma/schema.prisma

Ajouter les modèles SubmissionSnapshot et BlockedEmail. Ajouter la relation `snapshots` sur Registration.

### Task 2: Vérification unicité email + blocage dans POST /api/registrations + snapshot à la création

**Files:** src/app/api/registrations/route.ts

### Task 3: Route POST /api/registrations/resend-edit-link

**Files:** src/app/api/registrations/resend-edit-link/route.ts (create)

### Task 4: Frontend — gestion 409 canResend sur page.tsx

**Files:** src/app/page.tsx

### Task 5: Snapshot à la ressoumission + vérification blocage dans edit-registration

**Files:** src/app/api/edit-registration/[token]/route.ts, src/app/api/edit-registration/[token]/resend/route.ts

### Task 6: Admin — historique des soumissions sur page détails

**Files:** src/app/admin/registrations/[id]/page.tsx

### Task 7: Admin — blocage/déblocage email sur page détails

**Files:** src/app/admin/registrations/[id]/page.tsx, src/app/api/registrations/[id]/block-email/route.ts (create)
