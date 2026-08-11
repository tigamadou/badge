# Spec v4 — Validation des documents par le staff plateforme

> **Statut** : conception validée — 2026-08-07 — **à implémenter**
> **Type** : évolution de modèle + RBAC + parcours
> **Périmètre** : v4
> **Source** : `Todo.md` item 3
> **Dépend de** : spec 06 (composant `DocumentPreview`)

## Contexte et objectifs

Aujourd'hui, la photo et la pièce d'identité d'un participant ne sont jamais validées en tant que telles : elles sont figées dans le snapshot d'une inscription, et c'est l'**inscription** qui est approuvée ou rejetée par les membres de l'organisation. Quatre conséquences :

1. Un même participant fait re-contrôler ses pièces à chaque événement, par des organisations différentes, avec des critères différents.
2. Les organisations manipulent des pièces d'identité alors que le contrôle d'accès de `/api/files` réserve déjà les documents de profil au staff plateforme (cf. spec 06, cause B) : le parcours actuel est en contradiction avec le modèle de sécurité.
3. Le motif de rejet est saisi librement (`rejectionReason`, 200 caractères) : pas de vocabulaire commun, pas de statistiques exploitables.
4. La resoumission écrase le snapshot sans laisser de trace : aucun historique des documents soumis.

Cette spec introduit une validation du **profil** par le staff plateforme, en amont et indépendamment des inscriptions, avec historique complet des soumissions et catalogue de motifs de rejet.

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Objet validé | Le **profil** (photo + pièce d'identité) par le staff plateforme, **et** l'inscription par l'organisation | Deux natures de contrôle distinctes : l'identité est un contrôle plateforme mutualisé ; la pertinence métier (catégorie, quota, invitation) reste la décision de l'organisation. Arbitrage utilisateur du 2026-08-07. |
| Gate d'inscription | Profil non approuvé ⇒ inscription impossible | Formulé explicitement dans la demande. Évite qu'une organisation reçoive des inscriptions dont l'identité n'est pas établie. |
| Historique | Nouvelle table `ProfileSubmission`, lignes **immuables** | Une soumission est un fait daté ; la réécriture in situ (modèle actuel du snapshot) détruit l'information. Le versionnage des snapshots d'inscription est écarté (périmètre retenu : profil uniquement). |
| Statut du profil | Champ dénormalisé `User.profileStatus`, maintenu par un helper unique | Le gate est évalué à chaque inscription et à chaque affichage de liste ; recalculer la dernière soumission à chaque lecture coûterait une jointure inutile. La source de vérité reste la dernière `ProfileSubmission`. |
| Motifs de rejet | Table `RejectionReason` avec **portée par motif** (`PROFILE`, `REGISTRATION`, `BOTH`), administrée dans les paramètres plateforme | Arbitrage utilisateur du 2026-08-07 : un seul catalogue, filtré par contexte. Évite deux référentiels à maintenir. |
| Libellé du motif sur l'enregistrement | Conservé en clair **en plus** de la clé étrangère | Renommer ou désactiver un motif ne doit pas réécrire l'historique des décisions passées. |
| Détails libres | Conservés, optionnels, en complément du motif | Le motif catalogué donne la catégorie, le texte libre donne le cas particulier. |
| Effet d'un rejet de profil | Les inscriptions `PENDING` sont **gelées** ; les `APPROVED` et les badges imprimés ne bougent pas | Arbitrage utilisateur du 2026-08-07. Invalider des badges déjà imprimés créerait un problème opérationnel le jour de l'événement. |
| Documents côté organisation | L'organisation ne voit plus la pièce d'identité, seulement l'état « Documents vérifiés le JJ/MM » | Cohérent avec le contrôle d'accès existant de `/api/files` et avec la décision de centraliser la validation. |
| Migration | **Aucune** | Application hors production (décision utilisateur du 2026-08-07). `make db-push` + `make db-seed`. |
| Alternative écartée : validation du profil ET de l'inscription par le staff | Non retenue | Retirerait à l'organisation la maîtrise de son propre événement (catégories, quotas) sans bénéfice de sécurité. |
| Alternative écartée : historique via `ActivityLog` | Non retenue | Les `details` JSON ne garantissent pas la conservation des fichiers ni un requêtage sérieux de la file d'attente. |

> **Révision 2026-08-11** — Les lignes « Gate d'inscription » et « Objet validé »
> de ce tableau sont révisées par
> [`2026-08-11-09-v4-parcours-court-inscription.md`](2026-08-11-09-v4-parcours-court-inscription.md) :
> le gate passe de l'entrée (interdire l'inscription tant que le profil n'est pas
> `APPROVED`) à la sortie (interdire l'approbation de l'inscription). Un profil
> `PENDING` peut désormais s'inscrire. Le reste de cette spec — historique
> immuable, catalogue de motifs, gel côté organisation, documents invisibles à
> l'organisation — reste en vigueur.

## Architecture cible

### Modèle de données

```prisma
model ProfileSubmission {
  id               String                  @id @default(cuid())
  userId           String
  user             User                    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Snapshot immuable des pièces soumises
  photo            String
  idDocumentType   String
  idDocumentNumber String
  idDocument       String

  status           ProfileSubmissionStatus @default(PENDING)
  rejectionReasonId    String?
  rejectionReasonLabel String?
  rejectionDetails     String?             @db.Text
  reviewedById     String?
  reviewedAt       DateTime?
  createdAt        DateTime                @default(now())

  @@index([userId, createdAt])
  @@index([status])
}

enum ProfileSubmissionStatus { PENDING APPROVED REJECTED }

model RejectionReason {
  id         String         @id @default(cuid())
  label      String
  scope      RejectionScope
  sortOrder  Int            @default(0)
  archived   Boolean        @default(false)   // soft delete = motif retiré des listes
  archivedAt DateTime?
}

enum RejectionScope { PROFILE REGISTRATION BOTH }

model User {
  // …
  profileStatus ProfileStatus @default(INCOMPLETE)
  profileSubmissions ProfileSubmission[]
}

enum ProfileStatus { INCOMPLETE PENDING APPROVED REJECTED }
```

`Registration` reçoit `rejectionReasonId String?` ; `rejectionReason` existant devient le libellé dénormalisé.

Nouveaux `ActivityType` : `PROFILE_SUBMITTED`, `PROFILE_APPROVED`, `PROFILE_REJECTED`, `REJECTION_REASON_CREATED`, `REJECTION_REASON_UPDATED`, `REJECTION_REASON_DELETED`.

### Cycle de vie du profil

```
INCOMPLETE ──(profil complété, soumission créée)──► PENDING
   ▲                                                 │
   │                                    ┌────────────┴────────────┐
   │                              (approuvé)                 (rejeté)
   │                                    ▼                         ▼
   └──────────────────────────────► APPROVED               REJECTED
                                                                  │
                                          (nouvelle soumission) ──┘
```

Un helper unique `src/lib/profile-review.ts` porte les trois transitions (`submitProfile`, `approveProfile`, `rejectProfile`) et est le **seul** endroit qui écrit `User.profileStatus`. Toute autre écriture est interdite.

### Points de contrôle (gate)

| Emplacement | Comportement |
|---|---|
| `GET /e/[slug]/register` (page) | Profil non `APPROVED` ⇒ redirection vers `/account/profile` avec message d'état |
| `POST /api/events/[slug]/register` | Profil non `APPROVED` ⇒ `403 PROFILE_NOT_APPROVED` |
| `POST …/registrations/[regId]/approve` (org) | Profil du participant non `APPROVED` ⇒ `409 PROFILE_NOT_APPROVED` (gel) |
| `POST …/registrations` (création par le staff d'org) | Même contrôle que l'inscription publique |
| `POST /api/account/registrations/[id]/resubmit` | Même contrôle |

Le gel n'écrit rien en base : il découle du statut du profil. Une ré-approbation du profil dégèle mécaniquement les inscriptions `PENDING`.

### Espace staff plateforme

| Route | Contenu |
|---|---|
| `/platform/profiles` | File d'attente des soumissions `PENDING`, filtres par statut, recherche par nom/e-mail/numéro de pièce |
| `/platform/profiles/[userId]` | Aperçus photo + pièce (`DocumentPreview` de la spec 06), informations du profil, **historique complet** des soumissions, actions Approuver / Rejeter |
| `/platform/settings` — onglet « Motifs de rejet » | CRUD du catalogue : libellé, portée, ordre d'affichage, archivage (soft delete — un motif archivé disparaît des listes de sélection mais reste lisible dans l'historique des décisions) |

API correspondantes : `/api/platform/profiles`, `/api/platform/profiles/[userId]/approve`, `/api/platform/profiles/[userId]/reject`, `/api/platform/rejection-reasons` (+ `/[id]`).

Permissions : lecture pour tout le staff (`STAFF_OBSERVER` compris), décision réservée à `STAFF_SUPPORT` et au-dessus, administration du catalogue réservée à `STAFF_ADMIN` et au-dessus. Toutes les actions sont journalisées via `logActivity` avec `staffActor: true`.

### Espace participant

- `/account/profile` affiche l'état de validation (badge de statut), le motif en cas de rejet, et l'historique de ses soumissions.
- Toute modification de la photo, du type, du numéro ou du fichier de pièce **crée une nouvelle soumission** et repasse le profil en `PENDING`. Les champs non liés à l'identité (nom, prénom, structure) restent modifiables sans nouvelle validation.
- Un e-mail notifie chaque décision (approbation, rejet avec motif). Gabarits ajoutés à `src/lib/mail.ts`.

### Espace organisation

- Le détail d'inscription remplace le bloc pièce d'identité par l'état de vérification plateforme (date de validation, type et numéro de pièce).
- Le rejet d'inscription passe d'une saisie libre à une sélection dans le catalogue (portée `REGISTRATION` ou `BOTH`) + détails libres.
- Une inscription gelée affiche explicitement pourquoi l'approbation est indisponible.

## Tests

- **Unitaire** : `profile-review.ts` (toutes les transitions, y compris les transitions interdites) ; filtrage des motifs par portée.
- **Intégration** : gate d'inscription (403), gel de l'approbation (409), création d'une soumission à chaque modification de pièce, immuabilité des soumissions passées, RBAC des routes `/api/platform/profiles` et `/api/platform/rejection-reasons` (matrice complète des rôles staff), non-exposition des chemins de fichiers aux rôles non autorisés.
- **E2E** : parcours complet — inscription refusée profil non validé → approbation staff → inscription possible ; rejet staff avec motif → resoumission → historique à deux entrées ; gel d'une inscription `PENDING` après rejet de profil.

## Impacts documentation

- `docs/v4/README.md` — entrée de plan et état d'avancement.
- `docs/v4/architecture.md` — cycle de vie du profil, matrice RBAC staff, gate d'inscription.
- `docs/v4/features/` — nouvelle fiche `validation-profils.md`.
- `docs/v4/features/politique-tests.md` — matrice RBAC des nouvelles routes.
- `docs/v4/specs/2026-07-22-checklist-tests-manuels-navigateur.md` — nouvelles pages plateforme.

## Hors périmètre

- Versionnage des snapshots d'inscription (périmètre retenu : soumissions de profil uniquement).
- Expiration automatique d'une pièce d'identité (date de validité, re-validation périodique).
- Détection automatisée de fraude ou OCR sur les pièces.
- Rétroaction sur les inscriptions déjà approuvées et les badges imprimés.
