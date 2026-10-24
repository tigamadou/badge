# Queue d'emails MySQL, worker et écran `/platform/jobs` — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** plus aucun email applicatif n'est envoyé dans la requête HTTP. `enqueueEmail()`
insère un `Job` en base, et un worker séparé l'envoie avec des relances automatiques. Un
email en échec définitif reste visible et relançable. Le staff plateforme suit les envois
dans `/platform/jobs` ; à partir de `STAFF_ADMIN`, il peut relancer ou annuler un envoi.

**Architecture :** une table générique `Job` (type `EMAIL` seul pour l'instant) dans
MySQL. Toute la logique (réservation `FOR UPDATE SKIP LOCKED`, envoi, backoff,
récupération des orphelins, rétention, requêtes de l'écran d'admin) vit dans
`src/lib/jobs/`, couverte à 100 % par la porte existante. `src/worker/index.ts` n'est
qu'un câblage (configuration, signaux, boucle). En dev, le worker tourne dans un service
compose `worker` (`tsx watch`). En prod, il tourne dans la **même image runner** que
l'app : un bundle `esbuild` (`worker.cjs`) lancé par `node`. L'écran d'admin est un
Server Component. Ses actions passent par des routes API protégées par `withStaffAuth`.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 6 / MySQL 8
(`$queryRaw` + transaction interactive), nodemailer (via `resolveTransporter` de
`mail.ts`), esbuild 0.27 (bundle prod du worker), tsx (worker dev), Vitest 4 (BDD de dev
réelle, pas de mock Prisma), Playwright (Mailpit).

**Spec :** [`docs/v4/specs/2026-10-24-23-v4-queue-emails.md`](../specs/2026-10-24-23-v4-queue-emails.md) — coordination : [spec 22](../specs/2026-10-24-22-v4-lot-notifications-coordination.md) (contrat C1)

**Branche :** `feat/queue-emails` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Modèle `Job`, enums, `ActivityType`, reset des tests | [x] | 2026-10-24 | Modèle Job + enums + ActivityType ; table créée par db-push. |
| 2 | Constantes, backoff, configuration du worker, `kind` sensibles | [x] | 2026-10-24 | constants, config, email-kinds (4 kinds sensibles = 4 envois high). |
| 3 | Lecture du payload et envoi d'un email de job | [x] | 2026-10-24 | payload (replyTo persisté) + sendEmailPayload (timeout 2 min). |
| 4 | Réservation `SKIP LOCKED` et `processBatch()` | [x] | 2026-10-24 | SKIP LOCKED ; test de concurrence en tours successifs (filesort verrouille toutes les lignes dues). |
| 5 | Récupération des orphelins et rétention | [x] | 2026-10-24 | recoverStaleJobs, purgeOldJobs. |
| 6 | Boucle du worker et point d'entrée `src/worker/index.ts` | [x] | 2026-10-24 | worker-loop + src/worker/index.ts (--once vérifié). |
| 7 | Service `worker` en dev, script `build:worker`, cibles `make` | [x] | 2026-10-24 | Service worker dev, build:worker, make FILE=/arrêt worker. .dockerignore : .pnp.cjs périmé exclu. |
| 8 | `enqueueEmail()` insère en table ; migration des tests d'envoi | [x] | 2026-10-24 | enqueueEmail insère en table ; mail.test.ts et contact migrés (drainEmailQueue) ; e2e Mailpit verts. |
| 9 | Worker en prod/preprod : `Dockerfile`, compose, (deploy.sh, CI) | [x] | 2026-10-24 | Dockerfile, 3 compose, deploy.sh, ci.yml ; image runner construite et worker.cjs --once OK (image supprimée). |
| 10 | Requêtes et actions d'admin (`src/lib/jobs/admin.ts`) | [x] | 2026-10-24 | admin.ts (mises à jour conditionnelles). |
| 11 | Routes API `/api/platform/jobs/**` | [x] | 2026-10-24 | 4 routes + jobs-api.test.ts ; couverture 100 %. |
| 12 | Écran liste `/platform/jobs` | [x] | 2026-10-24 | Page liste ; vérification navigateur 375/1280 px à faire par le lead. |
| 13 | Écran détail `/platform/jobs/[jobId]`, actions, E2E | [x] | 2026-10-24 | Détail + JobActions + e2e (5 verts) ; recette SMTP coupé OK ; navigateur à faire par le lead. |
| 14 | Documentation | [x] | 2026-10-24 | queue-emails.md, installation.md, DEPLOYMENT.md, README, socle. |
| — | Vérification finale (lint, typecheck, test, e2e, navigateur 375 / 1280 px) | [~] | 2026-10-24 | lint 0 erreur, typecheck, 1892 tests, couverture 100 %, e2e vert (3 segments), recette SMTP coupé OK ; reste la vérification navigateur. |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état (étape, fichiers
touchés, prochaine étape).

## Contraintes globales

**Valeurs de la spec (à reprendre telles quelles) :**

- Enums `JobType { EMAIL }`, `JobStatus { PENDING RUNNING SUCCEEDED FAILED CANCELLED }` ;
  modèle `Job` **exactement** comme dans la spec (champs, défauts, deux index).
- `ActivityType` gagne `JOB_RETRIED` et `JOB_CANCELLED`.
- Priorité : `high` = **10** (vérification de compte, réinitialisation de mot de passe,
  invitation), `normal` = **0**. Tri de réservation : `priority DESC, runAt ASC`.
- Polling : **2 s** par défaut (`JOB_POLL_INTERVAL_MS`) ; concurrence **5** par défaut
  (`JOB_EMAIL_CONCURRENCY`).
- Backoff après échec : **1 min, 5 min, 30 min, 2 h** ; `maxAttempts` = **5** ; au-delà,
  `FAILED`. Le `html` est conservé tant que le job peut être relancé.
- Succès : `SUCCEEDED`, `completedAt`, `payload.html` **vidé** (`""`) ; `to`, `subject`,
  `kind` et `ctx` sont conservés.
- Orphelin : un job `RUNNING` dont `lockedAt` date de plus de **10 min** repasse en
  `PENDING`.
- Rétention : `SUCCEEDED` et `CANCELLED` de plus de **30 jours** supprimés, **une passe par
  heure** ; `FAILED` conservés.
- `SIGTERM` : le worker termine les envois en cours et ne réserve plus rien.
- Le worker logge sur la sortie standard, **jamais** via `logActivity`.
- `sendSmtpTest` reste **synchrone** (ni ce plan ni le socle ne le touchent).
- Écran : lecture pour tout le staff (`STAFF_OBSERVER` et plus) ; relancer et annuler
  réservés à `STAFF_ADMIN` et plus. Le corps HTML d'un `kind` sensible n'est **jamais**
  affiché ni renvoyé par l'API.
- Relancer : seulement `FAILED` ou `CANCELLED` → `PENDING`, `attempts = 0`,
  `runAt = now()` ; refusé si le `html` est purgé ; log `JOB_RETRIED`. Annuler : seulement
  `PENDING` → `CANCELLED` ; log `JOB_CANCELLED`.

**Périmètre de fichiers (spec 22) :** ce chantier possède `src/lib/jobs/**`,
`src/worker/**`, `src/app/platform/jobs/**`, `src/app/api/platform/jobs/**`, le modèle
`Job` du schéma et les fichiers Docker/Compose. Il **ne modifie ni `src/lib/mail.ts`, ni
les appelants des `send*`, ni `StaffShell`** (le lien « Emails » et la page d'attente
viennent du socle). Fichiers partagés touchés en plus, a minima : `prisma/schema.prisma`
(enum `ActivityType` + nouveaux modèles en fin de fichier), `src/test-setup.ts` (une
ligne), `src/lib/activity-labels.ts` (deux libellés), `Makefile`, `package.json`, les
tests d'envoi existants (task 8).

**Règles projet :**

- Commandes dans le conteneur dev (`make dev` préalable) : `make lint`, `make typecheck`,
  `make test`, `make db-push`, `make db-seed`.
- **Un seul fichier Vitest** :
  - tasks 1 à 6 : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - à partir de la task 7 : `make test FILE=<chemin>` (la cible arrête le worker de dev
    pendant les tests, voir task 7).
- **Un seul fichier E2E** :
  - avant la task 7 : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test <chemin>` ;
  - à partir de la task 7 : `make test-e2e FILE=<chemin>`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur
  (comptes `admin@badge.local` SUPER_ADMIN, `admin2@badge.local` STAFF_ADMIN,
  `support@badge.local` STAFF_SUPPORT, mot de passe `123456`).
- **Couverture 100 %** (lignes, branches, fonctions, statements) sur `src/lib/**` et
  `src/app/api/**` (`vitest.config.ts`, `make test-coverage`). **Pas de mock de Prisma.**
  Le SMTP se remplace par `__mailTesting.setResolveTransporter()` (API de test déjà
  exposée par `mail.ts`), toujours suivi de `__mailTesting.reset()` en `afterEach`.
  `src/worker/index.ts` reste **hors porte** (`include` ne vise que `src/lib` et
  `src/app/api`) : c'est un câblage d'une vingtaine de lignes, sans branche métier. Toute
  logique testable va dans `src/lib/jobs/`. Ne pas étendre `include` à `src/worker`.
- Les tests ne modifient jamais le code de production pour passer : en cas de blocage,
  s'arrêter et demander.
- Server Components par défaut ; `"use client"` seulement pour `JobsPagination` et
  `JobActions`. Les boutons d'action utilisent les primitives C4 du socle (`Button`
  `loading`, `useAsyncAction`, `toastApiError`).
- UI en français avec accents ; code en anglais ; commentaires en français (style des
  fichiers voisins, sans accents dans `src/` là où le fichier n'en met pas).
- Toute route API vérifie le rôle via `withStaffAuth` (`src/lib/with-staff-auth.ts`, qui
  appelle `requireStaff` de `src/lib/auth-guards.ts`) ; toute action sensible appelle
  `logActivity()`. Format d'erreur `{ code, error }` (message français dans `error`).
- **Commit — uniquement sur demande explicite de l'utilisateur.** Une étape « commit »
  du plan n'est pas une demande. Message conventional commit en français ASCII, **sans
  aucun trailer de co-auteur IA**.
- Aucune étape de déploiement, de SSH ni de migration prod : schéma en dev uniquement
  (`make db-push`). Les fichiers prod sont préparés pour la prochaine release, sans plus.
- Avant de déclarer une task terminée : `make lint && make typecheck && make test`.

## Points de vigilance de revue

La spec implique les cinq cas suivants sans les citer. Chacun a son test dans la task
propriétaire.

1. **Action staff concurrente du worker.** Le staff clique « Annuler » au moment où le
   worker réserve le job (`RUNNING`), ou « Relancer » sur un job déjà `PENDING` ou
   `SUCCEEDED`. Les mises à jour d'admin sont **conditionnelles** (`updateMany` avec le
   statut attendu dans le `where`) : un compte de 0 renvoie 409 et ne modifie rien.
   Tests (task 10) : `cancelJob refuses a RUNNING job and leaves it untouched` et
   `retryJob refuses a SUCCEEDED job`.
2. **Relance d'un job dont le `html` est vide.** Le cas n'arrive pas avec le flux normal :
   seul le succès purge, et un job réussi n'est pas relançable. Il peut pourtant venir
   d'une ligne corrompue ou d'une évolution future. Il doit renvoyer
   `JOB_PAYLOAD_PURGED` au lieu d'envoyer un email vide. Test (task 10) :
   `retryJob refuses a FAILED job whose html was purged`.
3. **Fin d'envoi tardive après récupération d'un orphelin.** Un worker lent finit son
   envoi alors que son job a été récupéré, puis réservé par un autre worker. Le passage en
   `SUCCEEDED` / retry est conditionné à `status = RUNNING AND lockedBy = workerId` ; sinon
   le worker logge « verrou perdu » et ne touche à rien. Test (task 4) :
   `does not overwrite a job whose lock was taken over by another worker`.
4. **Payload illisible.** Le JSON n'est pas un objet, ou il lui manque `to`, `subject` ou
   `html`. Le job passe directement en `FAILED`, avec `lastError = "INVALID_PAYLOAD"`, sans
   appel SMTP : réessayer quatre fois ne servirait à rien. Test (task 4) :
   `fails an invalid payload immediately without calling SMTP`.
5. **SMTP qui ne répond jamais.** Le `socketTimeout` par défaut de nodemailer (10 min) égale
   le seuil des orphelins : sans garde-fou, un envoi bloqué serait récupéré et envoyé en
   double. `sendEmailPayload` coupe l'attente à `SEND_TIMEOUT_MS` (2 min) et la compte
   comme un échec ordinaire (retry). Test (task 3) :
   `rejects with SEND_TIMEOUT when the transporter never answers`.

## Structure des fichiers

```
prisma/schema.prisma                         modifier : enums JobType/JobStatus, model Job, ActivityType +2
src/test-setup.ts                            modifier : prisma.job.deleteMany()
src/lib/activity-labels.ts                   modifier : libellés JOB_RETRIED / JOB_CANCELLED
src/lib/jobs/
  constants.ts                               créer : délais, seuils, computeRetryDelayMs()
  config.ts                                  créer : readWorkerConfig(env)
  email-kinds.ts                             créer : SENSITIVE_EMAIL_KINDS, isSensitiveEmailKind()
  email-payload.ts                           créer : EmailJobPayload, parseEmailPayload()
  send-email.ts                              créer : sendEmailPayload()
  process-batch.ts                           créer : claimEmailJobs(), processBatch()
  maintenance.ts                             créer : recoverStaleJobs(), purgeOldJobs()
  worker-loop.ts                             créer : createWorkerLoop()
  enqueue-email.ts                           modifier (socle) : insertion en table
  admin.ts                                   créer : filtres, liste, compteurs, détail, retry, cancel
  __tests__/helpers.ts                       créer : fakeTransport(), createEmailJob(), drainEmailQueue()
  __tests__/*.test.ts                        créer : un fichier par module
src/worker/index.ts                          créer : point d'entrée du worker
src/app/api/platform/jobs/route.ts                   créer : GET liste
src/app/api/platform/jobs/[jobId]/route.ts           créer : GET détail
src/app/api/platform/jobs/[jobId]/retry/route.ts     créer : POST relancer
src/app/api/platform/jobs/[jobId]/cancel/route.ts    créer : POST annuler
src/app/api/platform/jobs/__tests__/jobs-api.test.ts créer
src/app/platform/jobs/page.tsx                       remplacer (page d'attente du socle)
src/app/platform/jobs/[jobId]/page.tsx               créer
src/app/platform/jobs/_components/JobStatusBadge.tsx créer (serveur)
src/app/platform/jobs/_components/JobsPagination.tsx créer (client, enveloppe ui/Pagination)
src/app/platform/jobs/_components/JobActions.tsx     créer (client)
src/app/platform/jobs/_components/__tests__/JobStatusBadge.test.tsx créer
src/lib/__tests__/mail.test.ts               modifier : drainEmailQueue() avant les assertions d'envoi
e2e/helpers/jobs.ts                          créer : createTestEmailJob(), cleanupTestEmailJobs()
e2e/platform/jobs.spec.ts                    créer
docker-compose.dev.yml                       modifier : service worker
docker-compose.yml, docker-compose.preprod.yml  modifier : service worker
Dockerfile                                   modifier : bundle worker.cjs dans l'image runner
package.json / yarn.lock                     modifier : esbuild en devDependency, script build:worker
Makefile                                     modifier : FILE=, arrêt du worker pendant vitest, restart après db-push
deploy.sh, .github/workflows/ci.yml          modifier SEULEMENT après accord explicite (task 9)
docs/v4/features/queue-emails.md             créer
docs/v4/installation.md, docs/v4/README.md, DEPLOYMENT.md  modifier
```

---

## Task 1 — Modèle `Job`, enums, `ActivityType`, reset des tests

**Fichiers :** modifier `prisma/schema.prisma`, `src/test-setup.ts`,
`src/lib/activity-labels.ts` ; créer `src/lib/jobs/__tests__/job-model.test.ts`.

**Interfaces :**
- Consumes : rien.
- Produces : types Prisma `Job`, `JobType`, `JobStatus` ; `ActivityType.JOB_RETRIED`,
  `ActivityType.JOB_CANCELLED` ; `describeActivity("JOB_RETRIED") === "Email relancé"`,
  `describeActivity("JOB_CANCELLED") === "Email annulé"`.

- [ ] Écrire `job-model.test.ts` :
  ```ts
  it("applies the spec defaults on a minimal EMAIL job", async () => {
    const job = await prisma.job.create({ data: { type: "EMAIL", kind: "test.kind", payload: { to: "a@x.test" } } });
    expect(job).toMatchObject({ status: "PENDING", priority: 0, attempts: 0, maxAttempts: 5,
      lockedAt: null, lockedBy: null, lastError: null, completedAt: null, recipient: null });
    expect(job.runAt).toBeInstanceOf(Date);
  });
  it("is wiped by the global test setup", async () => {
    expect(await prisma.job.count()).toBe(0);
  });
  ```
  Ajouter dans `src/lib/__tests__/activity-labels.test.ts` :
  `expect(describeActivity("JOB_RETRIED")).toBe("Email relancé")`, idem `JOB_CANCELLED` →
  `"Email annulé"`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/jobs/__tests__/job-model.test.ts` : **échec attendu** (`prisma.job` n'existe pas, erreur TS/runtime).
- [ ] Ajouter au schéma, **en fin de fichier**, les enums `JobType`, `JobStatus` et le
  modèle `Job` copiés de la spec (commentaires compris). Ajouter `JOB_RETRIED` et
  `JOB_CANCELLED` à la fin de `enum ActivityType`, avec un commentaire `// v4 spec 23`.
- [ ] `src/test-setup.ts` : ajouter `await prisma.job.deleteMany();` en tête du `beforeEach`
  (pas de FK, l'ordre est libre). `activity-labels.ts` : ajouter les deux libellés à
  `DESCRIPTIONS`.
- [ ] `make db-push`, puis relancer le test : **succès attendu**. Relancer aussi
  `src/lib/__tests__/activity-labels.test.ts`.
- [ ] `make lint && make typecheck`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): ajoute le modele Job et les types d'activite JOB_RETRIED / JOB_CANCELLED`.

**Critères d'acceptation :** la table `Job` existe en dev avec les deux index ; le
`beforeEach` global la vide.

## Task 2 — Constantes, backoff, configuration du worker, `kind` sensibles

**Fichiers :** créer `src/lib/jobs/constants.ts`, `src/lib/jobs/config.ts`,
`src/lib/jobs/email-kinds.ts` et leurs tests `constants.test.ts`, `config.test.ts`,
`email-kinds.test.ts`.

**Interfaces :**
- Consumes : rien.
- Produces :
  ```ts
  // constants.ts
  export const RETRY_DELAYS_MS: readonly number[];        // [60_000, 300_000, 1_800_000, 7_200_000]
  export const STALE_LOCK_MS = 600_000;
  export const RETENTION_MS = 30 * 24 * 3_600_000;
  export const PURGE_INTERVAL_MS = 3_600_000;
  export const SEND_TIMEOUT_MS = 120_000;
  export const LAST_ERROR_MAX_LENGTH = 2000;
  export const DEFAULT_POLL_INTERVAL_MS = 2000;
  export const DEFAULT_EMAIL_CONCURRENCY = 5;
  export const EMAIL_PRIORITY_VALUE: Record<"high" | "normal", number>; // { high: 10, normal: 0 }
  // attempts = nombre de tentatives APRÈS l'échec courant (1 pour le premier échec)
  export function computeRetryDelayMs(attempts: number): number;
  // config.ts
  export type WorkerConfig = { pollIntervalMs: number; emailConcurrency: number };
  export function readWorkerConfig(env: NodeJS.ProcessEnv): WorkerConfig;
  // email-kinds.ts
  export const SENSITIVE_EMAIL_KINDS: readonly string[];
  export function isSensitiveEmailKind(kind: string): boolean;
  ```

- [ ] **Relever les `kind` réels** posés par le socle : `grep -n "kind:" src/lib/mail.ts`.
  Les `kind` sensibles sont ceux des fonctions qui portent un jeton dans un lien :
  `sendAccountVerifyEmail`, `sendAccountPasswordReset`, `sendPasswordResetEmail` et
  `sendUserInvitation`. Ce sont aussi exactement les quatre envois `priority: "high"`.
  Recopier leurs valeurs exactes dans `SENSITIVE_EMAIL_KINDS` ; ne pas en inventer. Si
  le socle n'a pas mis `high` sur ces quatre envois, s'arrêter et le signaler.
- [ ] Écrire les tests :
  ```ts
  it.each([[1, 60_000], [2, 300_000], [3, 1_800_000], [4, 7_200_000], [9, 7_200_000]])(
    "computeRetryDelayMs(%i) = %i", (a, ms) => expect(computeRetryDelayMs(a)).toBe(ms));
  it("clamps attempts below 1 to the first delay", () => expect(computeRetryDelayMs(0)).toBe(60_000));
  it("reads defaults when env is empty", () =>
    expect(readWorkerConfig({})).toEqual({ pollIntervalMs: 2000, emailConcurrency: 5 }));
  it("reads valid overrides", () =>
    expect(readWorkerConfig({ JOB_POLL_INTERVAL_MS: "500", JOB_EMAIL_CONCURRENCY: "2" }))
      .toEqual({ pollIntervalMs: 500, emailConcurrency: 2 }));
  it.each(["0", "-3", "abc", "1.5", ""])("falls back to defaults on invalid value %s", (v) =>
    expect(readWorkerConfig({ JOB_POLL_INTERVAL_MS: v, JOB_EMAIL_CONCURRENCY: v }))
      .toEqual({ pollIntervalMs: 2000, emailConcurrency: 5 }));
  it("flags every security kind as sensitive", () => {
    for (const k of SENSITIVE_EMAIL_KINDS) expect(isSensitiveEmailKind(k)).toBe(true);
    expect(SENSITIVE_EMAIL_KINDS).toHaveLength(4);
  });
  it("does not flag a business kind", () => expect(isSensitiveEmailKind("registration.approved")).toBe(false));
  ```
  (Remplacer `"registration.approved"` par le `kind` réel de `sendStatusNotification` s'il
  diffère.)
- [ ] Lancer les trois fichiers : **échec attendu** (modules absents).
- [ ] Implémenter. `readWorkerConfig` n'accepte que des entiers strictement positifs
  (`/^\d+$/` puis `> 0`) ; sinon la valeur par défaut.
- [ ] Relancer : **succès attendu**.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): constantes de la queue, backoff et configuration du worker`.

## Task 3 — Lecture du payload et envoi d'un email de job

**Fichiers :** créer `src/lib/jobs/email-payload.ts`, `src/lib/jobs/send-email.ts`,
`src/lib/jobs/__tests__/helpers.ts`, `email-payload.test.ts`, `send-email.test.ts`.

**Interfaces :**
- Consumes : `resolveTransporter`, `__mailTesting`, `TransportContext`,
  `ResolvedTransport` de `@/lib/mail` ; `SEND_TIMEOUT_MS`.
- Produces :
  ```ts
  // email-payload.ts
  export type EmailJobPayload = { to: string; subject: string; html: string; kind: string; ctx?: TransportContext };
  export function parseEmailPayload(value: Prisma.JsonValue): EmailJobPayload | null;
  // send-email.ts — lève en cas d'échec (contrairement à safeSend de mail.ts, qui avale)
  export async function sendEmailPayload(payload: EmailJobPayload, opts?: { timeoutMs?: number }): Promise<void>;
  // __tests__/helpers.ts (hors couverture)
  export type SentMail = { from: string; to: string; subject: string; html: string };
  export function fakeTransport(opts?: { fail?: Error | ((n: number) => Error | null); hang?: boolean;
    onSend?: (mail: SentMail) => Promise<void> }):
    { sent: SentMail[]; install(): void };   // install() appelle __mailTesting.setResolveTransporter
  export async function createEmailJob(overrides?: Partial<Prisma.JobUncheckedCreateInput>
    & { html?: string; to?: string }): Promise<Job>;
  ```
  `drainEmailQueue()` est ajouté à ce fichier en task 4.

- [ ] Écrire `email-payload.test.ts` :
  `parses a complete payload` (avec et sans `ctx`) ;
  `returns null for a non-object` (`null`, `"x"`, `[]`, `42`) ;
  `returns null when to, subject or html is missing or not a string` (`it.each` sur les trois clés) ;
  `accepts an empty html (purged payload)` → objet retourné avec `html: ""` ;
  `drops a ctx that is not an object` → `ctx` absent du résultat.
- [ ] Écrire `send-email.test.ts` (avec `afterEach(() => __mailTesting.reset())`) :
  - `sends with the resolved from address and the payload fields` : `sent[0]` égale
    `{ from: <from du fakeTransport>, to, subject, html }` ;
  - `resolves the transporter with the payload ctx` : la fonction installée reçoit
    `{ eventId: "e1" }` ;
  - `propagates the SMTP error` : `await expect(sendEmailPayload(p)).rejects.toThrow("SMTP down")` ;
  - `rejects with SEND_TIMEOUT when the transporter never answers` (vigilance 5) :
    `fakeTransport({ hang: true })`, `sendEmailPayload(p, { timeoutMs: 20 })` rejette avec
    un message contenant `"SEND_TIMEOUT"`.
- [ ] Lancer les deux fichiers : **échec attendu**.
- [ ] Implémenter. `sendEmailPayload` : `const t = await resolveTransporter(payload.ctx ?? {})`,
  puis `Promise.race` entre `t.transporter.sendMail({ from: t.from, to, subject, html })` et
  un timer qui rejette `new Error(\`SEND_TIMEOUT after ${timeoutMs} ms\`)`. Le timer est
  nettoyé dans un `finally` (`clearTimeout`).
- [ ] Relancer : **succès attendu**.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): lecture du payload et envoi d'un email de job`.

## Task 4 — Réservation `SKIP LOCKED` et `processBatch()`

**Fichiers :** créer `src/lib/jobs/process-batch.ts`,
`src/lib/jobs/__tests__/process-batch.test.ts` ; compléter `__tests__/helpers.ts`.

**Interfaces :**
- Consumes : `parseEmailPayload`, `sendEmailPayload`, `computeRetryDelayMs`,
  `LAST_ERROR_MAX_LENGTH`, `SEND_TIMEOUT_MS`.
- Produces :
  ```ts
  export type BatchSummary = { claimed: number; succeeded: number; retried: number; failed: number; lockLost: number };
  export async function claimEmailJobs(opts: { workerId: string; limit: number; now: Date }): Promise<Job[]>;
  export async function processBatch(opts: { workerId: string; limit: number; now?: Date; sendTimeoutMs?: number }): Promise<BatchSummary>;
  // helpers.ts
  export async function drainEmailQueue(opts?: { now?: Date }): Promise<BatchSummary>; // processBatch({ workerId: "test", limit: 100, now })
  ```

- [ ] Écrire `process-batch.test.ts`. Tous les tests passent un `now` explicite ;
  `fakeTransport().install()` en `beforeEach`, `__mailTesting.reset()` en `afterEach`.
  - `claims only PENDING jobs whose runAt is due` : un job dû, un job `runAt = now + 1 min`,
    un `RUNNING`, un `FAILED` → seul le premier est réservé ; il est `RUNNING`, avec
    `lockedBy === "w1"` et `lockedAt` égal à `now`.
  - `orders by priority DESC then runAt ASC and respects the limit` : trois jobs (p0 ancien,
    p10 récent, p0 récent), `limit: 2` → ids `[p10, p0 ancien]`.
  - `marks a sent job SUCCEEDED and purges its html` : `status: "SUCCEEDED"`,
    `completedAt === now`, `payload` vaut `{ to, subject, kind, html: "" }` (+ `ctx` si
    présent), `lockedAt`/`lockedBy` remis à `null`, `sent` contient 1 mail avec le html
    d'origine.
  - `schedules a retry with the backoff on failure` : `fakeTransport({ fail: new Error("SMTP down") })`
    → `status: "PENDING"`, `attempts: 1`, `lastError: "SMTP down"`,
    `runAt.getTime() === now.getTime() + 60_000`, `html` conservé.
  - `uses the 4th delay on the 4th failure and FAILED on the 5th` : job `attempts: 3` →
    `runAt = now + 7_200_000` après échec ; job `attempts: 4` → `status: "FAILED"`,
    `attempts: 5`, `html` conservé, `completedAt: null`.
  - `truncates lastError to LAST_ERROR_MAX_LENGTH` : erreur de 5000 caractères →
    `lastError.length === 2000`.
  - `fails an invalid payload immediately without calling SMTP` (vigilance 4) : payload
    `{ to: "a@x.test" }` → `FAILED`, `lastError: "INVALID_PAYLOAD"`, `sent.length === 0`.
  - `does not overwrite a job whose lock was taken over by another worker` (vigilance 3) :
    installer un `fakeTransport` dont l'envoi met à jour la ligne **pendant** l'appel
    (`prisma.job.update({ data: { lockedBy: "w2" } })`, ce qui simule une récupération puis
    une nouvelle réservation par un autre worker) ; après
    `processBatch({ workerId: "w1" })`, la ligne est toujours `RUNNING` / `lockedBy: "w2"`,
    et le résumé vaut `lockLost: 1`.
  - `never sends the same job twice with two concurrent workers` (critère d'acceptation) :
    12 jobs dus ; `await Promise.all([processBatch({ workerId: "a", limit: 5, now }), processBatch({ workerId: "b", limit: 5, now }), processBatch({ workerId: "c", limit: 5, now })])` →
    `sent.length === 12` et `new Set(sent.map((m) => m.to)).size === 12` (un `to` unique
    par job), somme des `claimed` = 12.
  - `returns an empty summary when nothing is due` → tous les compteurs à 0, aucune requête
    d'update (vérifier simplement le résumé).
- [ ] Lancer : **échec attendu**.
- [ ] Implémenter `claimEmailJobs` (algorithme imposé) :
  ```ts
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM \`Job\`
      WHERE type = 'EMAIL' AND status = 'PENDING' AND runAt <= ${now}
      ORDER BY priority DESC, runAt ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.job.updateMany({ where: { id: { in: ids } }, data: { status: "RUNNING", lockedAt: now, lockedBy: workerId } });
    const jobs = await tx.job.findMany({ where: { id: { in: ids } } });
    // conserver l'ordre de la requête de réservation
    return ids.map((id) => jobs.find((j) => j.id === id)!);
  });
  ```
  `limit` est un entier ≥ 1 (validé par `readWorkerConfig`). Si MySQL refuse le `LIMIT`
  paramétré, utiliser `LIMIT ${Prisma.raw(String(limit))}`, jamais une concaténation
  de chaîne brute.
- [ ] Implémenter `processBatch` : réserver, puis traiter les jobs en parallèle
  (`Promise.allSettled`). Pour chaque job : `parseEmailPayload` → `null` = `failJob` immédiat
  (`attempts + 1`, `FAILED`, `INVALID_PAYLOAD`). Sinon, `sendEmailPayload`. En cas de succès,
  `completeJob` ; en cas d'erreur, `retryOrFail`. Ces trois fonctions internes mettent à
  jour par `updateMany({ where: { id, status: "RUNNING", lockedBy: workerId }, ... })` : un
  compte de 0 incrémente `lockLost`. `retryOrFail` : `attempts = job.attempts + 1`. Si
  `attempts >= job.maxAttempts`, alors `FAILED`. Sinon `PENDING`,
  `runAt = now + computeRetryDelayMs(attempts)`, `lockedAt`/`lockedBy` à `null`. Le passage en
  `FAILED` est isolé dans **une seule** fonction interne `failJob` (c'est là que la spec 24
  branchera sa notification `EMAIL_FAILED`).
- [ ] Ajouter `drainEmailQueue()` à `helpers.ts`.
- [ ] Relancer : **succès attendu**. Lancer ensuite le fichier trois fois de suite pour
  écarter un faux vert sur le test de concurrence.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): reservation SKIP LOCKED et traitement d'un lot d'emails`.

## Task 5 — Récupération des orphelins et rétention

**Fichiers :** créer `src/lib/jobs/maintenance.ts`, `__tests__/maintenance.test.ts`.

**Interfaces :**
- Consumes : `STALE_LOCK_MS`, `RETENTION_MS`.
- Produces :
  ```ts
  export async function recoverStaleJobs(now?: Date): Promise<number>; // nombre de jobs remis en PENDING
  export async function purgeOldJobs(now?: Date): Promise<number>;     // nombre de jobs supprimés
  ```

- [ ] Écrire les tests :
  - `requeues RUNNING jobs locked more than 10 minutes ago` : `lockedAt = now - 10 min - 1 s`
    → retour `1`, ligne `PENDING`, `lockedAt`/`lockedBy` à `null`, `attempts` inchangé ;
  - `keeps RUNNING jobs locked less than 10 minutes ago` : `now - 9 min` → `0`, toujours
    `RUNNING` ;
  - `deletes SUCCEEDED and CANCELLED jobs completed more than 30 days ago` : deux jobs
    `completedAt = now - 31 j` → `2`, plus en base ;
  - `keeps recent terminal jobs and every FAILED job` : `SUCCEEDED` à `now - 29 j`, `FAILED`
    avec `updatedAt` ancien et `completedAt: null`, `PENDING` → rien supprimé.
- [ ] Lancer : **échec attendu**.
- [ ] Implémenter avec `updateMany` / `deleteMany`. La rétention se base sur `completedAt`,
  que `cancelJob` (task 10) renseigne aussi.
- [ ] Relancer : **succès attendu**.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): recuperation des jobs orphelins et purge a 30 jours`.

## Task 6 — Boucle du worker et point d'entrée

**Fichiers :** créer `src/lib/jobs/worker-loop.ts`, `__tests__/worker-loop.test.ts`,
`src/worker/index.ts`.

**Interfaces :**
- Consumes : `processBatch`, `recoverStaleJobs`, `purgeOldJobs`, `readWorkerConfig`,
  `PURGE_INTERVAL_MS`.
- Produces :
  ```ts
  export type WorkerLog = (message: string, meta?: Record<string, unknown>) => void;
  export type WorkerDeps = { processBatch: typeof processBatch; recoverStaleJobs: typeof recoverStaleJobs; purgeOldJobs: typeof purgeOldJobs };
  export function createWorkerLoop(opts: {
    workerId: string; config: WorkerConfig; log?: WorkerLog; deps?: Partial<WorkerDeps>;
  }): {
    runOnce(now?: Date): Promise<BatchSummary>; // recover + purge si due + processBatch
    start(): Promise<void>;                      // boucle jusqu'à stop() ; résout quand la boucle est sortie
    stop(): Promise<void>;                       // n'interrompt pas un lot en cours ; résout après lui
  };
  ```
  Les `deps` sont une injection de fonctions (pas un mock de Prisma) : elles servent
  uniquement à tester la robustesse de la boucle.

- [ ] Écrire les tests (vraies fonctions par défaut, `fakeTransport` installé) :
  - `runOnce sends due jobs and returns the summary` : 2 jobs → `succeeded: 2` ;
  - `runOnce purges at most once per PURGE_INTERVAL_MS` : `deps.purgeOldJobs = vi.fn(async () => 0)` ;
    `runOnce(t0)`, `runOnce(t0 + 10 min)`, `runOnce(t0 + 61 min)` → 2 appels ;
  - `runOnce recovers stale jobs before claiming` : job `RUNNING` orphelin → envoyé dans le
    même `runOnce` ;
  - `start keeps looping after a failing tick and logs it` : `deps.processBatch` lève au
    premier appel puis réussit ; `pollIntervalMs: 10` ; après ~50 ms `stop()` → au moins 2
    appels, `log` appelé avec un message contenant `"tick failed"` ;
  - `stop waits for the in-flight batch and claims nothing afterwards` : `deps.processBatch`
    résout après 50 ms ; `stop()` appelé pendant le lot ne résout qu'après ce lot, puis
    `processBatch` n'est plus jamais appelé (vérifier `toHaveBeenCalledTimes(1)` 50 ms plus
    tard) ;
  - `stop interrupts the idle wait immediately` : `pollIntervalMs: 60_000` ; `stop()`
    résout en moins de 200 ms.
- [ ] Lancer : **échec attendu**.
- [ ] Implémenter `createWorkerLoop`. Une attente interruptible : un `setTimeout`
  mémorisé, dont le `resolve` est appelé par `stop()`. Un drapeau `stopping`, une promesse
  `current` du lot en cours. Chaque tick est entouré d'un `try/catch` qui logge
  `"[worker] tick failed"` avec `error.message` ; un lot non vide est loggé par
  `"[worker] batch"` avec le résumé. La date de la dernière purge est gardée dans la closure.
- [ ] Créer `src/worker/index.ts` (câblage seul, sans branche testable) :
  `workerId = \`${os.hostname()}:${process.pid}\``,
  `config = readWorkerConfig(process.env)`, `log = (m, meta) => console.log(m, meta ?? "")`.
  Avec `--once` dans `process.argv` : `await loop.runOnce()`, puis `prisma.$disconnect()`
  et `process.exit(0)`. Sinon, `SIGTERM` et `SIGINT` déclenchent `await loop.stop()`, puis
  `prisma.$disconnect()` et `process.exit(0)` ; enfin `await loop.start()`. Logger au
  démarrage `"[worker] started"` avec `{ workerId, ...config }`.
- [ ] Relancer les tests : **succès attendu**. Vérifier à la main dans le conteneur app :
  `docker compose -f docker-compose.dev.yml exec app yarn tsx src/worker/index.ts --once`
  → sort avec le code 0 et logge `[worker] started`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(worker): boucle du worker d'emails et point d'entree`.

## Task 7 — Service `worker` en dev, script `build:worker`, cibles `make`

**Pourquoi avant la task 8 :** dès que `enqueueEmail` écrit en table, les E2E qui lisent
Mailpit exigent un worker actif (spec, § Worker).

**Fichiers :** modifier `docker-compose.dev.yml`, `Makefile`, `package.json`, `yarn.lock`.

**Interfaces :**
- Consumes : `src/worker/index.ts`.
- Produces : service compose `worker` ; script `yarn build:worker` → `build/worker.cjs` ;
  `make test FILE=…`, `make test-e2e FILE=…`.

- [ ] Ajouter esbuild en dépendance de dev explicite. Il est déjà présent en dépendance
  transitive (0.27.7), mais on ne doit pas en dépendre à ce titre :
  `docker compose -f docker-compose.dev.yml exec app yarn add -D esbuild@^0.27.7`.
- [ ] `package.json`, script :
  `"build:worker": "esbuild src/worker/index.ts --bundle --platform=node --target=node22 --format=cjs --external:@prisma/client --outfile=build/worker.cjs"`.
  esbuild lit les `paths` de `tsconfig.json` (`@/*`). `build/` est déjà ignoré par git et par
  ESLint.
- [ ] Vérifier le bundle dans le conteneur app :
  `docker compose -f docker-compose.dev.yml exec app sh -c "yarn build:worker && node build/worker.cjs --once"`
  → code 0, `[worker] started` dans la sortie. Si l'import d'un module échoue (dépendance
  Next ou native tirée par `mail.ts`), s'arrêter et le signaler : c'est le mode prod qui
  est en jeu.
- [ ] `docker-compose.dev.yml`, service `worker` (même `build` que `app`, mêmes volumes et
  `env_file`) :
  ```yaml
  worker:
    build: { context: ., dockerfile: Dockerfile.dev, secrets: [npm_token] }
    command: ["sh", "-c", "yarn install && yarn prisma generate && exec yarn tsx watch --clear-screen=false src/worker/index.ts"]
    restart: unless-stopped
    volumes: [".:/app", "/app/node_modules"]
    env_file: [docker/compose.dev.env, { path: .env, required: false }]
    environment:
      NPM_TOKEN: ${NPM_TOKEN}
      # Polling court en dev : expectMail (e2e/helpers/mailpit.ts) attend 5 s maximum.
      JOB_POLL_INTERVAL_MS: "500"
    depends_on:
      mysql: { condition: service_healthy }
      mailpit: { condition: service_started }
  ```
- [ ] `Makefile` :
  - variable `FILE ?=` ;
  - `test`, `test-unit` et `test-coverage` arrêtent le worker, lancent Vitest, puis le
    relancent **même en cas d'échec**. Motif : Vitest et le worker partagent la BDD de
    dev ; le worker volerait les jobs créés par les tests. Forme :
    ```make
    test:
    	docker compose -f docker-compose.dev.yml stop worker
    	docker compose -f docker-compose.dev.yml exec app yarn vitest run $(FILE); status=$$?; \
    	docker compose -f docker-compose.dev.yml start worker; exit $$status
    ```
  - `test-e2e` passe `$(FILE)` à `yarn playwright test` (le worker reste actif) ;
  - `db-push` relance le worker après la génération du client
    (`docker compose -f docker-compose.dev.yml restart worker`) : le worker a son propre
    `node_modules`, donc son propre client Prisma.
- [ ] `make dev-build`, puis `docker compose -f docker-compose.dev.yml logs worker` →
  `[worker] started` avec `pollIntervalMs: 500`. Modifier un fichier de `src/lib/jobs` →
  le worker redémarre (tsx watch).
- [ ] `make test` (complet) → vert, et `docker compose -f docker-compose.dev.yml ps worker`
  le montre de nouveau actif. `make test-e2e` → vert : rien ne change encore, car
  `enqueueEmail` envoie toujours en direct.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `chore(worker): service worker en dev, bundle esbuild et cibles make`.

**Critères d'acceptation :** `make test FILE=src/lib/jobs/__tests__/constants.test.ts`
ne lance que ce fichier ; le worker est actif après chaque cible de test.

## Task 8 — `enqueueEmail()` insère en table ; migration des tests d'envoi

**Fichiers :** modifier `src/lib/jobs/enqueue-email.ts` (corps seulement) ; créer ou
remplacer `src/lib/jobs/__tests__/enqueue-email.test.ts` ; modifier
`src/lib/__tests__/mail.test.ts` et tout test qui comptait sur l'envoi immédiat.

**Interfaces :**
- Consumes : contrat C1 (signature **inchangée**) ; `EMAIL_PRIORITY_VALUE` ;
  `drainEmailQueue`, `fakeTransport`.
- Produces :
  ```ts
  export async function enqueueEmail(message: EmailMessage, tx?: Prisma.TransactionClient): Promise<void>;
  // insère { type: "EMAIL", kind, recipient: to, priority: EMAIL_PRIORITY_VALUE[priority ?? "normal"],
  //          payload: { to, subject, html, kind, ctx? } }
  ```

- [ ] Écrire `enqueue-email.test.ts` (remplace celui du socle, qui testait l'envoi direct) :
  - `inserts a PENDING EMAIL job with denormalized fields` : `kind`, `recipient`,
    `priority: 0`, `payload` égal à `{ to, subject, html, kind }`, aucun mail envoyé
    (`fakeTransport().sent.length === 0`) ;
  - `maps priority high to 10` ;
  - `stores ctx in the payload when provided` ;
  - `joins the caller transaction` : `await expect(prisma.$transaction(async (tx) => { await enqueueEmail(msg, tx); throw new Error("rollback"); })).rejects.toThrow("rollback")`
    → `prisma.job.count() === 0` ;
  - `commits with the caller transaction` : même chose sans `throw` → 1 job.
- [ ] Ajouter dans `src/lib/__tests__/mail.test.ts` un bloc
  `describe("security emails are queued as sensitive high priority")`. Il appelle
  `sendAccountVerifyEmail`, `sendAccountPasswordReset`, `sendPasswordResetEmail` et
  `sendUserInvitation` sur un utilisateur créé, puis vérifie pour chaque job
  `isSensitiveEmailKind(job.kind) === true` et `job.priority === 10`. Ce garde-fou protège
  `SENSITIVE_EMAIL_KINDS` si un `kind` change dans `mail.ts`.
- [ ] Lancer `make test FILE=src/lib/jobs/__tests__/enqueue-email.test.ts` : **échec attendu**
  (le socle envoie en direct).
- [ ] Remplacer le corps d'`enqueueEmail` : `const client = tx ?? prisma; await client.job.create({ data })`.
  Supprimer l'import de `resolveTransporter` s'il existait : `enqueue-email.ts` ne doit
  importer que `prisma`, les types Prisma et `TransportContext` (en import de type), afin
  d'éviter un cycle avec `mail.ts`.
- [ ] Relancer : **succès attendu**.
- [ ] Migrer `mail.test.ts` : les `send*` n'appellent plus le transporteur.
  - Assertions sur `sent` : appeler `await drainEmailQueue()` juste après l'appel `send*`.
    Le `mockResolveTransporter` du fichier reste en place, puisque le worker passe par le
    même `resolveTransporter`.
  - Tests « une erreur SMTP est avalée et loggée » : ils deviennent
    `drainEmailQueue()` puis `job.status === "PENDING"`, `attempts === 1` et `lastError`
    renseigné. L'appel `send*` lui-même ne rejette pas.
  - Ne modifier **aucune** assertion de contenu (sujet, html, destinataire) : si l'une
    casse, c'est une régression du code.
- [ ] `make test` (suite complète) → vert. Faire de même pour les autres fichiers qui
  cassent. Seuls ceux qui n'ont **pas** `vi.mock("@/lib/mail")` sont concernés (liste :
  `grep -rLn 'vi.mock("@/lib/mail"' $(grep -rl "send[A-Z]" src --include=*.test.ts)`).
- [ ] `make test-coverage` → 100 % sur `src/lib` et `src/app/api`.
- [ ] `make test-e2e` (suite complète, worker actif) → vert. En cas d'échecs Mailpit,
  vérifier d'abord `docker compose -f docker-compose.dev.yml logs worker`, puis le SMTP de
  la BDD (`make db-seed` le répare).
- [ ] Vérification navigateur (`make db-seed`) : demander une réinitialisation de mot de
  passe depuis `/forgot-password` : la réponse est immédiate et l'email arrive dans Mailpit
  (`http://localhost:8025`) en moins de 2 s. Dans phpMyAdmin, le job est `SUCCEEDED` avec
  `payload.html` vide.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): les emails applicatifs passent par la queue MySQL`.

**Critères d'acceptation (spec) :** une approbation d'inscription répond sans attendre le
SMTP ; l'email arrive via le worker ; le corps de la réinitialisation est purgé après
envoi ; le test SMTP de `/platform/settings` reste immédiat (`e2e/platform/settings.spec.ts`
vert).

## Task 9 — Worker en prod/preprod

**Choix du mode d'exécution : bundle `esbuild` dans l'image runner.**
- La spec impose la **même image** que l'app. L'image `-tools` (stage `builder`) contient
  bien `tsx`, mais c'est une image d'outillage ponctuel. Elle embarque toutes les
  dépendances de dev et les sources, et n'est tirée que pour `init` et `tools`. Y faire
  tourner un service permanent lierait la prod aux devDependencies.
- Passer `tsx` en dépendance de runtime n'aide pas : le runner `standalone` ne contient ni
  `src/` ni le `node_modules` complet.
- Le bundle `build/worker.cjs` (task 7) embarque tout sauf `@prisma/client`, déjà copié dans
  le runner avec `.prisma`. Coût : une ligne `RUN` dans le builder et une ligne `COPY` dans
  le runner. Lancement : `node worker.cjs`, avec l'`entrypoint` surchargé dans compose.
  `node` est alors PID 1 et reçoit directement `SIGTERM`.

**Fichiers :** modifier `Dockerfile`, `docker-compose.yml`, `docker-compose.preprod.yml`,
`deploy.sh` et `.github/workflows/ci.yml`. **L'utilisateur a autorisé ces cinq
modifications le 2026-10-24.** Ce n'est pas un déploiement : aucune release n'est publiée
et aucune commande n'est lancée sur le serveur.

**Interfaces :**
- Consumes : `yarn build:worker`.
- Produces : `/app/worker.cjs` dans l'image runner ; services `worker` en prod et preprod.

- [ ] `Dockerfile`, stage `builder`, après `RUN yarn build` : `RUN yarn build:worker`.
  Stage `runner`, après les `COPY` existants :
  `COPY --from=builder /app/build/worker.cjs ./worker.cjs`.
- [ ] `docker-compose.yml`, service `worker` :
  ```yaml
  worker:
    container_name: badge-worker
    image: ${BADGE_IMAGE:-ghcr.io/tigamadou/badge}:${BADGE_TAG:-prod}
    entrypoint: ["node", "worker.cjs"]
    env_file: [.env.production]
    depends_on:
      init: { condition: service_completed_successfully }
      mysql: { condition: service_healthy }
    # Laisse le temps de finir les envois en cours (SEND_TIMEOUT_MS = 2 min au pire).
    stop_grace_period: 150s
    restart: unless-stopped
  ```
  `docker-compose.preprod.yml` : idem avec `container_name: badge-worker-preprod`,
  `${BADGE_TAG:-preprod}`, `.env.preprod`, réseau `default` seulement (pas de `web`).
- [ ] Vérifier la syntaxe :
  `docker compose -f docker-compose.yml config --quiet` et
  `docker compose -f docker-compose.preprod.yml config --quiet` (ces commandes ne lisent
  que les fichiers, sans rien démarrer. Si un `env_file` absent bloque, le signaler sans
  créer de fichier `.env*`).
- [ ] Vérifier l'image localement (build seulement, rien n'est poussé) :
  `docker build --secret id=npm_token,env=NPM_TOKEN --target runner -t badge-runner-check .`
  puis
  `docker run --rm --network badge_default -e DATABASE_URL=mysql://root:password@mysql:3306/badge --entrypoint node badge-runner-check worker.cjs --once`
  → code 0, `[worker] started`. Supprimer ensuite l'image : `docker image rm badge-runner-check`.
- [ ] **Demander l'accord de l'utilisateur** pour les deux fichiers ci-dessous (CI/CD et
  script de déploiement ne figurent pas dans l'autorisation du 2026-10-24). Sans accord,
  marquer l'étape `[-]` dans les notes de la Progression et le signaler dans la doc
  (task 14).
  - `deploy.sh` : `pull app tools` reste tel quel (le worker utilise l'image `app`) ;
    `up -d --no-deps init app` devient `up -d --no-deps init app worker`. Sans cela, le
    worker n'est jamais créé ni mis à jour au déploiement.
  - `.github/workflows/ci.yml`, job e2e : juste après `yarn start &`, ajouter
    `- run: yarn build:worker && (JOB_POLL_INTERVAL_MS=500 node build/worker.cjs &)`.
    Sinon les E2E Mailpit de la CI échouent.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `chore(worker): service worker en prod et preprod (bundle esbuild dans l'image runner)`.

## Task 10 — Requêtes et actions d'admin

**Fichiers :** créer `src/lib/jobs/admin.ts`, `__tests__/admin.test.ts`.

**Interfaces :**
- Consumes : `isSensitiveEmailKind`, `parseEmailPayload`.
- Produces :
  ```ts
  export const JOB_PAGE_SIZES = [10, 20, 30, 50] as const;   // options de ui/Pagination
  export type JobListFilters = { status?: JobStatus; kind?: string; from?: Date; to?: Date; q?: string; page: number; pageSize: number };
  export function parseJobListFilters(params: URLSearchParams):
    { ok: true; filters: JobListFilters } | { ok: false; code: "INVALID_STATUS" };
  export type JobListItem = { id: string; type: JobType; kind: string; recipient: string | null; status: JobStatus;
    attempts: number; maxAttempts: number; lastError: string | null; createdAt: Date; runAt: Date; completedAt: Date | null };
  export async function listJobs(f: JobListFilters): Promise<{ jobs: JobListItem[]; total: number; page: number; pageSize: number }>;
  export async function listJobKinds(): Promise<string[]>;   // distinct, triés
  export async function getJobCounts(now?: Date): Promise<{ pending: number; failed: number; sentLast24h: number }>;
  export type JobDetail = JobListItem & { priority: number; subject: string | null; lockedAt: Date | null; lockedBy: string | null;
    updatedAt: Date; sensitive: boolean; purged: boolean; previewHtml: string | null; canRetry: boolean; canCancel: boolean };
  export async function getJobDetail(id: string): Promise<JobDetail | null>;
  export type JobActionResult = { ok: true; job: JobDetail }
    | { ok: false; code: "NOT_FOUND" | "JOB_NOT_RETRYABLE" | "JOB_PAYLOAD_PURGED" | "JOB_NOT_CANCELLABLE" };
  export async function retryJob(id: string, now?: Date): Promise<JobActionResult>;
  export async function cancelJob(id: string, now?: Date): Promise<JobActionResult>;
  ```
  Règles : `pending` = `PENDING` + `RUNNING` (pas encore envoyés) ; `failed` = `FAILED` ;
  `sentLast24h` = `SUCCEEDED` avec `completedAt >= now - 24 h`. `from` filtre
  `createdAt >= début du jour` et `to` filtre `createdAt < lendemain 00:00` (jour inclus).
  Une date invalide est ignorée. `q` filtre `recipient contains`. `page` vaut au moins 1.
  `pageSize` hors de `JOB_PAGE_SIZES` vaut 20. Tri : `createdAt desc`. `listJobs` ne
  sélectionne **jamais** `payload`. `previewHtml` vaut `null` si `sensitive` ou `purged`.
  `canRetry` = `FAILED|CANCELLED` et non purgé ; `canCancel` = `PENDING`.

- [ ] Écrire `admin.test.ts` :
  - `parseJobListFilters` : défauts `{ page: 1, pageSize: 20 }` ; `status=FOO` →
    `{ ok: false, code: "INVALID_STATUS" }` ; `page=-3` → 1 ; `pageSize=999` → 20 ;
    `from=pas-une-date` ignoré ; `to=2026-10-24` → `to` = `2026-10-25T00:00` ;
  - `listJobs filters by status, kind, period and recipient and paginates` (25 jobs,
    `pageSize: 10, page: 3` → 5 éléments, `total: 25`) ;
  - `listJobs never returns the payload` : `expect(Object.keys(jobs[0])).not.toContain("payload")` ;
  - `getJobCounts counts pending+running, failed and successes of the last 24 h` (succès à
    23 h comptés, succès à 25 h non comptés) ;
  - `getJobDetail hides the html of a sensitive kind` : `previewHtml: null`,
    `sensitive: true`, `subject` présent, `JSON.stringify(detail)` ne contient pas le html ;
  - `getJobDetail exposes the preview of a business email` ;
  - `getJobDetail returns null for an unknown id` ;
  - `retryJob requeues a FAILED job` : `PENDING`, `attempts: 0`, `runAt === now`,
    `completedAt`, `lockedAt` et `lockedBy` à `null`, `lastError` conservé ; idem pour
    `CANCELLED` ;
  - `retryJob refuses a SUCCEEDED job` (vigilance 1) → `JOB_NOT_RETRYABLE`, et de même
    pour `PENDING` et `RUNNING` ;
  - `retryJob refuses a FAILED job whose html was purged` (vigilance 2) → `JOB_PAYLOAD_PURGED` ;
  - `cancelJob cancels a PENDING job` : `CANCELLED`, `completedAt === now` ;
  - `cancelJob refuses a RUNNING job and leaves it untouched` (vigilance 1) →
    `JOB_NOT_CANCELLABLE`, ligne identique (`toEqual` avant/après) ;
  - `retryJob and cancelJob return NOT_FOUND for an unknown id`.
- [ ] Lancer `make test FILE=src/lib/jobs/__tests__/admin.test.ts` : **échec attendu**.
- [ ] Implémenter. `retryJob` lit le job (`NOT_FOUND`), vérifie le statut puis le payload,
  et fait un `updateMany({ where: { id, status: { in: ["FAILED", "CANCELLED"] } } })`.
  `cancelJob` fait `updateMany({ where: { id, status: "PENDING" } })`. Un compte de 0 renvoie
  le code de refus correspondant.
- [ ] Relancer : **succès attendu**.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(jobs): requetes et actions d'administration des jobs`.

## Task 11 — Routes API `/api/platform/jobs/**`

**Fichiers :** créer les quatre routes listées dans la structure et
`src/app/api/platform/jobs/__tests__/jobs-api.test.ts`.

**Interfaces :**
- Consumes : `withStaffAuth` (`minRole` par défaut `STAFF_OBSERVER` ; `"STAFF_ADMIN"` pour
  les actions) ; fonctions de `admin.ts` ; `logActivity`.
- Produces :
  - `GET /api/platform/jobs?status&kind&from&to&q&page&pageSize` → 200
    `{ jobs, total, page, pageSize, counts }` ; 400 `{ code: "INVALID_STATUS", error: "Statut inconnu." }`.
  - `GET /api/platform/jobs/[jobId]` → 200 `{ job: JobDetail }` ; 404 `{ code: "NOT_FOUND", error: "Job introuvable." }`.
  - `POST /api/platform/jobs/[jobId]/retry` → 200 `{ job }` ; 404 ; 409 `JOB_NOT_RETRYABLE`
    (« Seul un email en échec ou annulé peut être relancé. ») ou `JOB_PAYLOAD_PURGED`
    (« Le contenu de cet email a été purgé : relance impossible. »). Succès :
    `logActivity({ type: "JOB_RETRIED", userId, targetId: jobId, details: { kind }, req })`.
  - `POST /api/platform/jobs/[jobId]/cancel` → 200 `{ job }` ; 404 ; 409
    `JOB_NOT_CANCELLABLE` (« Seul un email en attente peut être annulé. »). Succès : log
    `JOB_CANCELLED`, mêmes champs.

- [ ] Écrire `jobs-api.test.ts` (patron de
  `src/app/api/platform/organizations/[orgId]/owners/__tests__/route.test.ts` :
  `vi.mock("next-auth")`, `makeStaff(role)`) :
  - `401 without session` et `403 for a non-staff user` sur les quatre routes ;
  - `STAFF_OBSERVER can list and read a job` ;
  - `STAFF_SUPPORT gets 403 on retry and cancel and the job is unchanged` (critère
    d'acceptation) ;
  - `STAFF_ADMIN retries a FAILED job and logs JOB_RETRIED` (vérifier la ligne
    `activityLog` : `type`, `targetId`, `details.kind`) ;
  - `STAFF_ADMIN cancels a PENDING job and logs JOB_CANCELLED` ;
  - `409 codes are mapped` (un cas par code) ; `404 on unknown jobId` (trois routes) ;
  - `400 on invalid status filter` ;
  - `never returns the html of a password reset` : créer le job avec un `kind` sensible et
    un html contenant `"token-secret-123"` ; pour le `GET` liste, le `GET` détail et la
    réponse de `retry` (après passage en `FAILED`),
    `expect(await res.text()).not.toContain("token-secret-123")`.
- [ ] Lancer : **échec attendu**.
- [ ] Implémenter les routes : chaque handler parse, appelle `admin.ts` et traduit le
  résultat. Aucune requête Prisma dans les routes, hormis via `admin.ts` et `logActivity`.
- [ ] Relancer, puis `make test-coverage` → 100 %.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(api): routes d'administration des jobs d'email`.

## Task 12 — Écran liste `/platform/jobs`

**Fichiers :** remplacer `src/app/platform/jobs/page.tsx` ; créer
`_components/JobStatusBadge.tsx`, `_components/JobsPagination.tsx`,
`_components/__tests__/JobStatusBadge.test.tsx`.

**Interfaces :**
- Consumes : `listJobs`, `listJobKinds`, `getJobCounts`, `parseJobListFilters`,
  `JOB_PAGE_SIZES` ; `StatGrid`/`StatCard`, `TableFrame`, `EmptyState`, `Pagination`
  (`src/components/ui/`).
- Produces :
  ```ts
  export function JobStatusBadge(props: { status: JobStatus }): JSX.Element;
  // libellés : PENDING « En attente », RUNNING « En cours », SUCCEEDED « Envoyé »,
  //            FAILED « En échec », CANCELLED « Annulé »
  export function JobsPagination(props: { page: number; totalPages: number; total: number; pageSize: number }): JSX.Element | null;
  // "use client" ; enveloppe ui/Pagination ; onPageChange/onPageSizeChange
  // -> router.push(`/platform/jobs?${params}`) en conservant les filtres (pageSize change => page=1)
  ```

- [ ] Écrire `JobStatusBadge.test.tsx` (`renderToStaticMarkup`, comme les tests de
  `src/components/ui/__tests__`) : un `it.each` sur les cinq statuts → libellé attendu.
- [ ] Lancer : **échec attendu** ; implémenter `JobStatusBadge` (pastille arrondie, tons :
  ambre en attente, bleu en cours, émeraude envoyé, rose échec, ardoise annulé) ;
  **succès attendu**.
- [ ] Page (Server Component), à partir de `src/app/platform/activity/page.tsx` :
  - titre « Emails », sous-titre « File d'envoi des emails de la plateforme » ;
  - `StatGrid cols={3}` : « En attente » (icône `clock`), « En échec » (`alert-triangle`),
    « Envoyés (24 h) » (`send`) ;
  - formulaire GET : Statut (select, « Tous » + 5 libellés), Type (select des `kind`
    distincts), Du / Au (`type="date"`), Destinataire (texte `q`), bouton « Filtrer » ;
  - filtre `status` invalide : ignorer le filtre et afficher une `Alert tone="warn"`
    « Statut inconnu : filtre ignoré. » ;
  - `TableFrame` avec les colonnes Date (`toLocaleString("fr-FR")`), Type (`kind`),
    Destinataire, Statut, Tentatives (`attempts/maxAttempts`), Dernière erreur (tronquée à
    80 caractères, texte complet dans `title`), puis le lien chevron vers le détail
    (`aria-label="Voir le détail"`). Sous `md`, masquer Type, Tentatives et Dernière
    erreur (`hidden md:table-cell`) ;
  - liste vide : `EmptyState icon="mail" title="Aucun email"` ;
  - `JobsPagination` sous le tableau.
- [ ] `make db-seed`, se connecter en `admin@badge.local` et déclencher deux emails
  (réinitialisation de mot de passe depuis `/forgot-password`, invitation d'un utilisateur
  depuis `/platform/users/new`). Vérifier `/platform/jobs` à **1280 px** : compteurs, lignes
  « Envoyé », chaque filtre et la pagination (`pageSize` 10). Vérifier à **375 px** :
  `document.documentElement.scrollWidth === innerWidth`, tableau défilant dans
  `TableFrame`.
- [ ] `make lint && make typecheck && make test`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(platform): ecran de suivi des emails /platform/jobs`.

## Task 13 — Écran détail `/platform/jobs/[jobId]`, actions, E2E

**Fichiers :** créer `src/app/platform/jobs/[jobId]/page.tsx`,
`_components/JobActions.tsx`, `e2e/helpers/jobs.ts`, `e2e/platform/jobs.spec.ts`.

**Interfaces :**
- Consumes : `getJobDetail` ; `loadUserContext` + `staffRoleAtLeast` (patron de
  `src/app/platform/users/[userId]/page.tsx`) ; primitives C4 (`Button loading`,
  `useAsyncAction`, `toastApiError`) ; `getDb()` de `e2e/helpers/db.ts` ;
  `loginAsStaff`, helper Mailpit `expectMail`.
- Produces :
  ```ts
  export function JobActions(props: { jobId: string; canRetry: boolean; canCancel: boolean }): JSX.Element | null;
  // POST .../retry ou .../cancel ; succès : toast (« Email relancé. » / « Envoi annulé. ») puis router.refresh()
  // e2e/helpers/jobs.ts
  export async function createTestEmailJob(opts: { to: string; kind: string; status: JobStatus; subject: string; html: string;
    attempts?: number; lastError?: string }): Promise<{ id: string }>;
  export async function cleanupTestEmailJobs(recipientPrefix: string): Promise<void>;
  ```

- [ ] Page détail (Server Component) : `notFound()` si `getJobDetail` renvoie `null`.
  Lien retour « Emails ». Carte de métadonnées : statut, type (`kind`), destinataire,
  sujet, priorité (« Haute » si ≥ 10, sinon « Normale »), tentatives `attempts/maxAttempts`,
  prochain essai (`runAt`), créé le, terminé le, verrou (`lockedBy` / `lockedAt` si
  `RUNNING`). Dernière erreur complète dans un `<pre className="whitespace-pre-wrap break-words">`.
  Contenu :
  - `sensitive` → `Alert tone="info"` « Contenu masqué : cet email contient un lien à usage unique. » ;
  - `purged` (non sensible) → « Contenu purgé après envoi. » ;
  - sinon `<iframe sandbox="" srcDoc={previewHtml} title="Aperçu de l'email" className="h-[60vh] w-full rounded-lg border border-slate-200" />`.
    `sandbox=""` sans valeur bloque scripts, formulaires et navigation.
  - `JobActions` rendu **seulement** si l'utilisateur est `STAFF_ADMIN` ou plus.
- [ ] `JobActions` : « Relancer » si `canRetry`, « Annuler l'envoi » si `canCancel`, chacun
  via `useAsyncAction`. En erreur, `toastApiError(res, "Action impossible.")`, qui lit le
  champ `error` des 409. Rien n'est rendu si les deux booléens sont faux.
- [ ] Écrire `e2e/platform/jobs.spec.ts` (convention `e2e/README.md` : un fichier par
  page, parcours UI sans `page.request`) :
  - `un email déclenché apparaît comme envoyé` : déclencher une réinitialisation de mot
    de passe pour un utilisateur e2e via `/forgot-password`, puis `expectMail`. Se connecter
    en `STAFF_ADMIN` et ouvrir `/platform/jobs?q=<email>` : la ligne est « Envoyé ». Sur le
    détail, le texte « Contenu masqué » est présent et aucun `iframe` n'apparaît.
  - `un email en échec se relance et arrive` : `createTestEmailJob({ status: "FAILED",
    kind: <kind non sensible>, html: "<p>Relance e2e</p>", attempts: 5, lastError: "SMTP down" })`.
    Sur le détail : « SMTP down » visible, l'`iframe` d'aperçu est présent. Clic
    « Relancer » → toast « Email relancé. ». Puis `expectMail({ to, bodyPattern: /Relance e2e/ })`.
    Après rechargement, le statut est « Envoyé ».
  - `un email en attente s'annule` : job `PENDING` avec `runAt` à +1 h, pour que le worker
    ne le prenne pas. Clic « Annuler l'envoi » → statut « Annulé » et bouton « Relancer »
    visible.
  - `le support voit la liste mais aucune action` : `STAFF_SUPPORT` sur le détail d'un job
    `FAILED` → ni « Relancer » ni « Annuler l'envoi ».
  - `afterAll` : `cleanupTestEmailJobs("e2e-jobs-")`.
- [ ] Lancer `make test-e2e FILE=e2e/platform/jobs.spec.ts` : **échec attendu** tant que
  la page détail n'existe pas, puis **succès attendu**. Le relancer deux fois de suite.
- [ ] Vérification navigateur (`make db-seed`), en `admin2@badge.local` puis en
  `support@badge.local`, à 1280 et 375 px : détail d'un job sensible (contenu masqué),
  détail d'un job métier (aperçu dans l'iframe, sans débordement à 375 px), relance et
  annulation avec spinner et toast.
- [ ] **Recette « SMTP coupé » (critère de la spec)** : `docker compose -f docker-compose.dev.yml stop mailpit`.
  Déclencher un email : le job passe en `PENDING` avec `attempts 1` et une erreur
  visible. Pour accélérer la recette, avancer `runAt` à maintenant via phpMyAdmin et
  laisser le worker épuiser les tentatives : le job devient « En échec ». Ensuite
  `docker compose -f docker-compose.dev.yml start mailpit`, clic « Relancer » : l'email
  arrive. Noter le résultat dans la Progression.
- [ ] `make lint && make typecheck && make test`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(platform): detail d'un job d'email, relance et annulation`.

## Task 14 — Documentation

**Fichiers :** créer `docs/v4/features/queue-emails.md` ; modifier
`docs/v4/installation.md`, `docs/v4/README.md`, `DEPLOYMENT.md`.

- [ ] `features/queue-emails.md` : rôle de la queue ; modèle `Job` et statuts ;
  priorités ; cycle de vie (réservation `SKIP LOCKED`, backoff 1 min / 5 min / 30 min /
  2 h, `FAILED` à 5 tentatives, purge du html au succès, orphelins à 10 min, rétention à
  30 j) ; `kind` sensibles et règle d'affichage ; écran `/platform/jobs` et droits ;
  `sendSmtpTest` synchrone ; exécution du worker (dev : service compose ; prod :
  `node worker.cjs` dans l'image runner) et pourquoi ; point d'extension pour la spec 24
  (`failJob`).
- [ ] `installation.md` : service `worker` dans le tableau « Services et URLs (dev) »
  (pas de port) ; variables `JOB_POLL_INTERVAL_MS` (défaut 2000, 500 en dev) et
  `JOB_EMAIL_CONCURRENCY` (défaut 5) ; section Tests : `make test` arrête puis relance le
  worker, `FILE=` pour un seul fichier, E2E dépendant du worker ; diagnostic
  (`docker compose -f docker-compose.dev.yml logs -f worker`) ; `make db-push` relance le
  worker.
- [ ] `DEPLOYMENT.md` : nouveau service `worker` (même image, `entrypoint` `node
  worker.cjs`), arrêt propre (`stop_grace_period`). Indiquer l'état de `deploy.sh` et de la
  CI selon la décision prise en task 9 (si l'accord n'a pas été donné, l'écrire comme
  action restante avant la première release).
- [ ] `docs/v4/README.md` : ligne « Spec 23 — Queue d'emails » sous « Plans à
  implémenter », avec liens vers la spec, le plan et la fiche feature. Ajouter aussi une
  ligne dans « État d'avancement ».
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `docs(v4): queue d'emails, worker et ecran des jobs`.

## Vérification finale

- [ ] `make db-push` (schéma à jour, worker relancé).
- [ ] `make lint` → 0 erreur, 0 warning.
- [ ] `make typecheck` → OK.
- [ ] `make test-coverage` → vert, 100 % sur `src/lib/**` et `src/app/api/**`.
- [ ] `make test-e2e` (suite complète) → vert, worker actif.
- [ ] `make db-seed`, puis navigateur à **375 px** et **1280 px** sur `/platform/jobs` et un
  détail : en `admin2@badge.local` (actions visibles) et en `support@badge.local`
  (aucune action). Sans débordement horizontal à 375 px.
- [ ] Relire chaque critère d'acceptation de la spec et noter, dans la ligne
  « Vérification finale » de la Progression, la preuve correspondante (test ou recette).

---

## Self-review

- **Couverture de la spec :**
  - modèle et enums : T1 ;
  - priorités : T2 et T8 ;
  - insertion dans `tx` : T8 ;
  - worker (polling, concurrence, `SKIP LOCKED`, succès et purge, backoff, `FAILED`,
    orphelins, `SIGTERM`, logs stdout) : T4 à T6 ;
  - rétention : T5 ;
  - service dev avant le branchement : T7 avant T8 ;
  - prod : T9 ;
  - écran (accès, liste, filtres, compteurs, détail, masquage, iframe sandbox) : T10 à T13 ;
  - relance et annulation avec log : T10 et T11 ;
  - API sans payload sensible : T11.

  Critères d'acceptation :
  - réponse immédiate puis Mailpit : T8 ;
  - SMTP coupé, puis relance : recette de la T13 ;
  - deux workers sans doublon : T4 ;
  - `STAFF_SUPPORT` sans action : T11 et T13 ;
  - réinitialisation masquée et purgée : T4, T11 et T13 ;
  - test SMTP immédiat : T8 (E2E settings) ;
  - couverture : T8, T11 et la vérification finale.
- **Cohérence des noms :**
  - `processBatch`, `claimEmailJobs`, `BatchSummary` (avec `lockLost`) : T4, réutilisés en
    T6 ;
  - `drainEmailQueue` : défini en T4, utilisé en T8 ;
  - `SENSITIVE_EMAIL_KINDS` et `isSensitiveEmailKind` : T2, T8 et T10 ;
  - `JobDetail.previewHtml`, `canRetry` et `canCancel` : T10, puis T11 et T13 ;
  - codes `JOB_NOT_RETRYABLE`, `JOB_PAYLOAD_PURGED`, `JOB_NOT_CANCELLABLE`, `NOT_FOUND` et
    `INVALID_STATUS` : identiques en T10 et T11.
- **Proportion :** quatorze tâches, dont six de logique pure ou d'intégration en BDD
  (T2 à T6, T10). Le seul bloc de code imposé est l'algorithme de réservation (T4). Les
  écrans réutilisent les composants existants, sans nouveau composant `ui/`.
