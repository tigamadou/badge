# Spec v4 — Envoi des emails par une queue MySQL et écran d'admin des jobs

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : infrastructure (queue de jobs) + écran staff
> **Périmètre** : v4 — envoi de tous les emails applicatifs ; espace `/platform`
> **Plan** : [`plans/2026-10-24-queue-emails.md`](../plans/2026-10-24-queue-emails.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md) — contrat C1
> **Source** : échange utilisateur du 2026-10-24 (« traiter l'envoi des emails dans une queue »)

## Contexte

`src/lib/mail.ts` expose une douzaine de fonctions `send*` (confirmation d'inscription,
statut, badge imprimé, vérification de compte, réinitialisation de mot de passe,
invitation, profil approuvé ou rejeté…), appelées depuis 19 fichiers de `src/`.
L'envoi SMTP se fait **dans la requête HTTP** :

- la plupart des routes font `await send…()` : un SMTP lent ralentit l'action de
  l'utilisateur ; un SMTP en panne la fait échouer ou perd l'email ;
- quelques routes font `send…().catch(log)` : l'email est perdu sans possibilité de
  relance, et personne ne le voit.

## Objectifs

1. Aucun email applicatif n'est envoyé dans la requête HTTP : il est **mis en file** et
   un **worker** séparé l'envoie.
2. Un email n'est jamais perdu silencieusement : retries automatiques, puis état d'échec
   visible et relançable.
3. Le staff plateforme voit l'état des envois et peut agir (relancer, annuler).
4. La table est **générique** (`Job` avec un `type`) pour accueillir plus tard la
   génération des PDF de badges sans migration de structure.

## Non-objectifs

- **Génération des PDF de badges** en asynchrone : prévue plus tard (décision utilisateur
  du 2026-10-24). Seul le type `EMAIL` est implémenté.
- RabbitMQ, Redis, BullMQ : écartés (voir *Options envisagées*).
- Préférences d'abonnement aux emails côté utilisateur.

## Options envisagées

| Option | Verdict |
|---|---|
| RabbitMQ | Écartée : un service de plus à opérer, sauvegarder et surveiller en prod, pour quelques centaines d'emails par jour. Pas de transaction commune avec l'action métier. |
| BullMQ + Redis | Écartée : ajoute Redis ; le job n'est pas créé dans la même transaction que l'action. |
| **Table `Job` dans MySQL + worker** | **Retenue** : zéro infra nouvelle, job créé dans la transaction de l'action, visible et administrable en BDD. Le polling (quelques secondes) suffit à l'échelle du produit. |

La signature `enqueueEmail()` (contrat C1) isole le stockage : passer à BullMQ plus tard
ne changerait que son implémentation et le worker.

## Conception

### Modèle de données

```prisma
enum JobType {
  EMAIL
}

enum JobStatus {
  PENDING     // en attente (y compris en attente d'un nouvel essai)
  RUNNING     // pris par un worker
  SUCCEEDED
  FAILED      // échec définitif (tentatives épuisées)
  CANCELLED   // annulé par le staff
}

model Job {
  id          String    @id @default(cuid())
  type        JobType
  status      JobStatus @default(PENDING)
  priority    Int       @default(0)     // plus grand = plus prioritaire
  // EMAIL : { to, subject, html, kind, ctx?, replyTo? }. Purgé (html vidé) après succès.
  payload     Json
  // Champs dénormalisés pour l'écran d'admin (filtres, recherche) sans lire le payload.
  kind        String                    // ex. "registration.approved"
  recipient   String?
  attempts    Int       @default(0)
  maxAttempts Int       @default(5)
  runAt       DateTime  @default(now()) // prochain essai
  lockedAt    DateTime?
  lockedBy    String?
  lastError   String?   @db.Text
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status, runAt, priority])
  @@index([type, createdAt])
}
```

Ajouts à `ActivityType` : `JOB_RETRIED`, `JOB_CANCELLED`.

### Mise en file

- `enqueueEmail(message, tx?)` (contrat C1) insère un `Job` `EMAIL`. Avec `tx`, l'insertion
  fait partie de la transaction de l'appelant ; c'est le cas de `notify()` (spec 24).
- Priorité : `high` (= 10) pour les emails de **sécurité** (vérification de compte,
  réinitialisation de mot de passe, invitation) ; `normal` (= 0) pour le reste.
- Le **rebranchement des `send*`** de `mail.ts` sur `enqueueEmail` (avec `kind` et
  `priority`) est fait par le **socle** (spec 22, C1). Les `send*` restent appelées après
  la validation de l'action, sans `tx`. **Ce chantier ne modifie ni `mail.ts` ni les
  appelants.**
- **Les routes qui faisaient `send…().catch(log)`** (approbation et rejet de profil,
  confirmation d'inscription) passent naturellement par la queue ; l'insertion du job
  étant rapide, on peut les repasser en `await` (au choix du constructeur).
- **Exception : `sendSmtpTest`** reste **synchrone** — le staff qui teste sa configuration
  SMTP attend un résultat immédiat.
- Le contenu est **rendu à la mise en file** (HTML figé) : l'email reflète l'état au moment
  de l'action, et le worker n'a pas besoin de la logique métier.

### Worker

- Processus Node séparé (`src/worker/index.ts`), **même image Docker** que l'app, lancé
  avec une autre commande. Un service `worker` est ajouté à `docker-compose.dev.yml`,
  `docker-compose.preprod.yml` et `docker-compose.yml`, et le `Dockerfile` est adapté si
  le mode d'exécution choisi l'exige. **L'utilisateur a autorisé ces modifications le
  2026-10-24.** Rien n'est déployé : les fichiers seront prêts pour la prochaine release.
- **E2E** : dès que les `send*` passent par la queue, les tests qui lisent Mailpit
  exigent que le worker tourne. Le service dev est donc ajouté **avant** de brancher
  l'insertion en table.
- Boucle : toutes les **2 s** (configurable `JOB_POLL_INTERVAL_MS`), réserve jusqu'à
  `JOB_EMAIL_CONCURRENCY` (défaut 5) jobs `PENDING` avec `runAt <= now()`, triés par
  `priority DESC, runAt ASC`, via `SELECT … FOR UPDATE SKIP LOCKED` (MySQL 8) dans une
  transaction qui les passe en `RUNNING` (`lockedAt`, `lockedBy` = identifiant du worker).
- Succès : `SUCCEEDED`, `completedAt`, et le `html` du payload est **vidé** (on garde `to`,
  `subject`, `kind`). Motif : les emails de sécurité contiennent des liens à jeton en
  clair, qui ne doivent pas rester en base.
- Échec : `attempts + 1`, `lastError`, retour en `PENDING` avec `runAt` décalé selon un
  backoff **1 min, 5 min, 30 min, 2 h** ; au-delà de `maxAttempts`, `FAILED`. Le `html` est
  conservé tant que le job peut être relancé.
- **Récupération des jobs orphelins** : un job `RUNNING` dont `lockedAt` date de plus de
  10 min (worker mort) repasse en `PENDING`.
- Arrêt propre sur `SIGTERM` : termine les envois en cours, ne réserve plus.
- Le worker logge sur la sortie standard (pas de `logActivity`, qui trace des actions
  d'utilisateurs).

### Écran d'admin `/platform/jobs`

- Le lien « Emails » de `StaffShell` et une page d'attente sont posés par le socle ; ce
  chantier remplace la page.
- **Accès** : lecture pour tout le staff plateforme ; **actions** (relancer, annuler)
  réservées à `STAFF_ADMIN` et au-dessus. Contrôles via `requireStaff` côté API.
- **Liste** paginée (composant `Pagination` existant, `TableFrame`) : date, type, `kind`,
  destinataire, statut, tentatives, dernière erreur (tronquée). Filtres : statut, `kind`,
  période ; recherche par destinataire.
- **Compteurs** en tête (`StatCard`) : en attente, en échec, envoyés sur 24 h.
- **Détail** d'un job : métadonnées, historique (tentatives, dernière erreur complète),
  sujet. Le **corps HTML n'est jamais affiché** pour les `kind` sensibles
  (vérification, réinitialisation, invitation) — il contient des jetons ; pour les autres,
  un aperçu dans une iframe `sandbox` est autorisé.
- **Relancer** un job `FAILED` ou `CANCELLED` : `PENDING`, `attempts = 0`, `runAt = now()`.
  Impossible si le `html` a été purgé. Log `JOB_RETRIED`.
- **Annuler** un job `PENDING` : `CANCELLED`. Log `JOB_CANCELLED`.
- Les réponses API n'exposent jamais le `payload` brut des `kind` sensibles.

### Rétention

Les jobs `SUCCEEDED` et `CANCELLED` de plus de **30 jours** sont supprimés par le worker
(une passe par heure). Les `FAILED` sont conservés jusqu'à action du staff.

## Critères d'acceptation

- Approuver une inscription renvoie la réponse sans attendre le SMTP ; l'email arrive
  dans Mailpit quelques secondes plus tard via le worker.
- SMTP coupé : le job passe en retry puis `FAILED` ; il est visible dans `/platform/jobs`,
  relançable une fois le SMTP rétabli, et l'email arrive.
- Deux workers lancés en parallèle n'envoient jamais deux fois le même email.
- Un `STAFF_SUPPORT` voit la liste mais n'a ni bouton ni accès API aux actions.
- Le corps d'un email de réinitialisation n'apparaît ni à l'écran ni dans une réponse API,
  et est purgé de la base après envoi.
- Le test SMTP de `/platform/settings` reste immédiat.
- Couverture 100 % maintenue sur `src/lib` et les routes API.

## Laissé au constructeur

- Comment exécuter le worker en prod (bundle `esbuild`, `tsx` en dépendance de runtime, ou
  sortie compilée) : `tsx` n'est aujourd'hui qu'une dépendance de dev.
- La forme exacte des tests d'intégration du worker (fonction `processBatch()` testable
  sans boucle infinie recommandée).
- La mise à jour de `docs/v4/installation.md` (nouveau service, nouvelles variables).
