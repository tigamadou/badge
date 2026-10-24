# Queue d'emails, worker et écran `/platform/jobs`

> **Statut : livré** — spec [23 — queue d'emails](../specs/2026-10-24-23-v4-queue-emails.md) · plan [queue d'emails](../plans/2026-10-24-queue-emails.md) · contrat C1 : [socle du lot](lot-notifications-socle.md).

Aucun email applicatif n'est envoyé dans la requête HTTP : `enqueueEmail()` insère un `Job`
en base, et un worker séparé l'envoie avec des relances automatiques. Un email en échec
définitif reste visible et relançable depuis `/platform/jobs`.

## Modèle

Table générique `Job` (`prisma/schema.prisma`), seul le type `EMAIL` existe. Statuts :
`PENDING` (y compris en attente d'un nouvel essai), `RUNNING`, `SUCCEEDED`, `FAILED`
(tentatives épuisées), `CANCELLED` (annulé par le staff). Le payload d'un email est
`{ to, subject, html, kind, replyTo?, ctx? }` ; `kind` et `recipient` sont dénormalisés pour
l'écran d'admin.

Priorité : `high` = 10 (vérification de compte, réinitialisation de mot de passe,
invitation), `normal` = 0. Tri de réservation : `priority DESC, runAt ASC`.

`enqueueEmail(message, tx?)` garde la signature du contrat C1 ; avec `tx`, l'insertion fait
partie de la transaction de l'appelant. `sendSmtpTest` reste **synchrone** (le staff attend
le résultat de son test).

## Cycle de vie (worker)

Toute la logique est dans `src/lib/jobs/` (testée à 100 %) ; `src/worker/index.ts` n'est que
du câblage (configuration, signaux, boucle).

- **Réservation** : `SELECT … FOR UPDATE SKIP LOCKED` dans une transaction qui passe les jobs
  en `RUNNING` (`lockedAt`, `lockedBy`). Deux workers ne prennent jamais le même job. Le
  filesort de MySQL verrouille toutes les lignes dues avant le `LIMIT` : un second worker
  concurrent en saute donc davantage, et récupère le reste au tick suivant.
- **Succès** : `SUCCEEDED`, `completedAt`, `payload.html` vidé (les liens à jeton ne restent
  pas en base) ; `to`, `subject`, `kind` et `ctx` sont conservés.
- **Échec** : `attempts + 1`, `lastError` (tronquée à 2000 caractères), retour en `PENDING`
  avec un backoff de **1 min, 5 min, 30 min, 2 h** ; à `maxAttempts` (5), `FAILED`. Le
  `html` est conservé tant que le job peut être relancé. Un payload illisible passe
  directement en `FAILED` (`INVALID_PAYLOAD`).
- **Fin d'envoi tardive** : toute mise à jour est conditionnée à `status = RUNNING AND
  lockedBy = workerId`. Si le job a été récupéré par un autre worker, le worker logge
  « lock lost » et ne touche à rien.
- **SMTP muet** : l'envoi est coupé à 2 min (`SEND_TIMEOUT_MS`), compté comme un échec
  ordinaire. Le seuil des orphelins est à 10 min : sans cela un envoi bloqué serait doublé.
- **Orphelins** : un job `RUNNING` verrouillé depuis plus de 10 min repasse en `PENDING`.
- **Rétention** : les `SUCCEEDED` et `CANCELLED` de plus de 30 jours sont supprimés, une
  passe par heure. Les `FAILED` sont conservés.
- **Arrêt** : sur `SIGTERM` / `SIGINT`, le worker termine le lot en cours et ne réserve plus.
- Journalisation sur la sortie standard (jamais `logActivity`).

Le passage en `FAILED` est isolé dans la fonction `failJob` de `process-batch.ts` : c'est le
point d'extension de la spec 24 (notification `EMAIL_FAILED`).

## Configuration

| Variable | Défaut | Rôle |
|----------|--------|------|
| `JOB_POLL_INTERVAL_MS` | 2000 (500 en dev) | Intervalle de polling |
| `JOB_EMAIL_CONCURRENCY` | 5 | Jobs réservés par lot |

## Exécution du worker

- **Dev** : service compose `worker` (`tsx watch src/worker/index.ts`), même volume que `app`.
- **Prod / preprod** : même image runner que l'app, lancée avec `node worker.cjs`. Le
  bundle `build/worker.cjs` est produit par `yarn build:worker` (esbuild, `@prisma/client`
  externe) dans le stage `builder` du `Dockerfile`, puis copié dans le runner. Choix : l'image
  `-tools` embarque les devDependencies et n'est destinée qu'à l'outillage ponctuel, et le
  runner `standalone` ne contient ni `src/` ni `tsx`. `stop_grace_period: 150s` laisse finir
  les envois en cours.

## Écran `/platform/jobs`

Lecture pour tout le staff plateforme ; **relancer** et **annuler** réservés à `STAFF_ADMIN`
et plus (routes `/api/platform/jobs/**` protégées par `withStaffAuth`).

- Liste paginée (compteurs en attente / en échec / envoyés sur 24 h ; filtres statut, type,
  période, destinataire).
- Détail : métadonnées, dernière erreur complète, aperçu dans une `iframe sandbox=""`.
- **Relancer** : `FAILED` ou `CANCELLED` → `PENDING`, `attempts = 0`, `runAt = now()` ; refusé
  si le `html` est purgé (`JOB_PAYLOAD_PURGED`). Log `JOB_RETRIED`.
- **Annuler** : `PENDING` → `CANCELLED`. Log `JOB_CANCELLED`.
- Les mises à jour sont conditionnelles au statut attendu : une action concurrente du worker
  répond 409 (`JOB_NOT_RETRYABLE`, `JOB_NOT_CANCELLABLE`) sans rien modifier.
- **Kinds sensibles** (`account.verify-email`, `account.password-reset`,
  `user.password-reset`, `user.invitation`, voir `src/lib/jobs/email-kinds.ts`) : le corps
  HTML n'est jamais affiché ni renvoyé par l'API. Un test de `mail.test.ts` garantit que ces
  quatre envois restent en priorité haute.

## Tests

Vitest et le worker partagent la BDD de dev : `make test`, `make test-unit` et
`make test-coverage` arrêtent le worker puis le relancent, même en cas d'échec.
`make test FILE=<chemin>` et `make test-e2e FILE=<chemin>` limitent l'exécution à un fichier.
Les e2e qui lisent Mailpit exigent le worker actif ; en CI, il est lancé après `yarn start`.
Les tests d'envoi utilisent `drainEmailQueue()` (`src/lib/jobs/__tests__/helpers.ts`) à la
place du worker.
