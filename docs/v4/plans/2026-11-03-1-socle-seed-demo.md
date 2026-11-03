# Vague 1 — Socle du seed de démo — Plan d'implémentation

> **Exécution :** dossier principal `/Users/amadou/Devs/projects/badge`, branche `feat/seed-demo`.
> Toutes les commandes `make` se lancent dans le conteneur de développement (`make dev` une fois).
> Sous-skill : `superpowers:executing-plans` (ou `superpowers:subagent-driven-development`).
> En exécution automatisée, un commit par tâche est autorisé sur la branche du plan ; sinon aucun
> commit sans demande explicite.

**Objectif :** poser le socle du seed de démo : garde-fou `BADGE_ENV`, seed minimal réduit au
SUPER_ADMIN, cadre démo (contexte, orchestration, stubs de lots), puis comptes, organisations,
évènements, templates, profils et inscriptions à tous les statuts, avec volumes.

**Architecture :** `prisma/seed.ts` devient un simple point d'entrée (`SEED_MODE` = `minimal` |
`demo` | `super-admin`). Le seed minimal vit dans `prisma/seed/minimal.ts`, le seed de démo dans
`prisma/seed/demo/` : un `DemoContext` partagé (faker à graine fixe, dates relatives, stockage sous
`demo/`, registres des entités créées) circule de module en module ; les lots 2a/2b ajouteront
`print.ts`, `billing.ts`, `notifications.ts` (stubs posés ici). Les gros volumes passent par
`createMany` en lots, les cas « vitrine » par les fonctions de `src/lib/**`.

**Tech Stack :** Prisma 6 / MySQL 8, tsx, `@faker-js/faker`, bcryptjs (12 rounds), `src/lib/storage.ts`
(RustFS/S3), `@tigamadou/pdf-engine` (installation des templates), Vitest 4.

**Spec :** [`specs/2026-11-03-37-v4-seed-de-demo.md`](../specs/2026-11-03-37-v4-seed-de-demo.md)
(sections « Précisions » et « Organisation du travail » : elles font autorité)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | `badge-env.ts` et `BADGE_ENV` dans les compose | [x] | 2026-11-03 | 16 tests verts, badge-env.ts 100 %; BADGE_ENV posee dans init/app/worker/tools (prod, preprod) et app/worker (dev); overlay agent herite du dev |
| 2 | Seed minimal réduit, fusion du SUPER_ADMIN, service `init` | [x] | 2026-11-03 | 4 tests verts (minimal.test.ts); seed.ts = point d'entrée SEED_MODE; init prod/preprod -> SEED_MODE=super-admin; seed-super-admin.ts supprimé; démo (`demo`) lève une erreur tant que la Task 3 n'est pas faite; conteneur app dev à recréer pour porter BADGE_ENV=dev |
| 3 | Cadre démo : contexte, orchestration, stubs, nettoyage, fichier de comptes | [x] | 2026-11-03 | 23 tests verts (framework.test.ts); lint/typecheck OK; runDemoSeed + garde-fou, contexte, backdate/parkJobs, putAt + manifeste, cleanupDemoCore (supprime aussi les inscriptions avant la cascade org : Registration->Category RESTRICT), stubs de lots, Makefile/.gitignore; `make db-seed-demo` OK en dev |
| 4 | Réserve d'images et stockage `demo/` | [x] | 2026-11-03 | 27 tests verts (images.test.ts + framework.test.ts); lint/typecheck OK; png.ts (PNG RGB sans dépendance), images.ts (30 photos/12 logos/8 bannières, < 10 Ko), buildImageReserve appelé par createDemoContext ; framework.test.ts ajusté (le préfixe contient désormais les 50 images) |
| 5 | Comptes de tous types | [x] | 2026-11-03 | 6 tests verts (accounts.test.ts), 33 sur prisma/seed/demo; lint/typecheck OK; seedAccounts + pendingOrgMembers/pendingEventMembers ajoutes a DemoRegistry (context.ts); slugs d'org utilises (a reprendre en Task 6) : demo-grosse-org, demo-moyenne-1, demo-petite-1, demo-archivee; organizerAndParticipant a un profil APPROVED et est dans registry.participants; invitations hors registry.staff |
| 6 | Organisations, évènements, catégories, templates de badge | [x] | 2026-11-03 | 8 tests verts (organizations.test.ts), 45 sur prisma/seed; lint/typecheck OK; 12 orgs (demo-grosse-org, demo-moyenne-1..4, demo-petite-1..6, demo-archivee), évènements `<slug-org>-<phase>-<n>` (grosse : 2 past dont le 1er archivé, 1 ongoing, 2 upcoming); catégories numéros 1-3 + 4 (Confidentiel anonyme ou Visiteur neutre) ; templates `demo-standard` / `demo-recto-verso` (org grosse -> recto-verso, moyenne-1 -> standard, évènement ongoing de la grosse -> standard) ; framework.test.ts : seedOrganizationsAndEvents mocké dans le test du fichier de comptes (pas d admin en base) |
| 7 | Profils et inscriptions, volumes | [ ] | | |
| 8 | Vérification, doc d'installation (partie dev) | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables : `prisma/seed.ts`, `prisma/seed/**` (hors `demo/print.ts`, `demo/billing.ts`,
`demo/notifications.ts` une fois créés : ces trois stubs sont créés ici puis appartiennent aux lots
2a/2b), `prisma/seed-super-admin.ts` (supprimé), `src/lib/badge-env.ts` (+ son test),
`src/lib/seed-super-admin.ts` (usage seulement : signature inchangée), `docker-compose.yml`,
`docker-compose.dev.yml`, `docker-compose.preprod.yml`, `docker-compose.agent.yml` (si besoin),
`Makefile` (cibles `db-seed*` et commentaires dev uniquement), `.gitignore` (ligne `.demo/`),
`docs/v4/installation.md` (partie dev), tests associés (`prisma/seed/**/__tests__/`,
`src/lib/__tests__/badge-env*.test.ts`).
**En lecture seule** : `prisma/schema.prisma`, `src/lib/**` hors fichiers ci-dessus,
`src/test/factories.ts`, `src/test-setup.ts`, `deploy.sh`, `scripts/smoke-tests.ts`,
`DEPLOYMENT.md`, `.github/**`, sections préprod de `Makefile`/`installation.md` (lot 2c). Besoin d'y
toucher → s'arrêter et le signaler.

## Global Constraints

- **Tests (CLAUDE.md « Règles de test »)** : Vitest sur la base `_test` uniquement (`make test`) ;
  **aucun mock de la base ni de Prisma** (MySQL réel) ; seuls les services externes se mockent
  (renderer via `fakeExporter`, déjà posé par `src/test-setup.ts`) ; données de test préparées avec
  `src/test/factories.ts` (ajouter une fabrique plutôt que dupliquer des `prisma.*.create`) ;
  **ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander ; couverture **100 %** sur `src/lib/**` et `src/app/api/**` (donc sur
  `src/lib/badge-env.ts`). `prisma/seed/**` est hors périmètre de couverture mais testé par
  intégration.
- **Garde-fou** : le seed de démo ne tourne que si `BADGE_ENV` vaut `dev` ou `preprod` ; absent,
  invalide ou `prod` → refus **avant toute écriture**.
- **Aucun appel externe** : pas de FedaPay, pas de SMTP réel, pas de téléchargement d'image ; images
  générées localement.
- **Faker** : `@faker-js/faker` avec graine fixe (`DEMO_FAKER_SEED`), jamais `Math.random()` dans les
  modules (hors `generateId` de `src/lib`, qui l'utilise pour son espaceur).
- **Mot de passe** : `DEMO_PASSWORD = "123456"` pour tous les comptes de démo et `admin@badge.local`
  en dev ; bcryptjs **12 rounds, un seul hachage** par exécution, réutilisé partout.
- **Idempotence** : relancer `SEED_MODE=demo` sans reset redonne le même état (mêmes comptes, mêmes
  comptes par table) ; nettoyage par domaine `@demo.local`, préfixes `demo-` et préfixe de stockage
  `demo/`.
- **Stockage** : tout fichier de démo passe par `src/lib/storage.ts`, sous le préfixe `demo/`, sauf
  les fichiers dont `/api/files` contrôle l'accès selon le préfixe de clé (`print-sheets/`,
  `print-requests/`…) : ils gardent la clé du code, écrits par `storage.putAt` et suivis dans un
  manifeste `demo/_tracked-keys.json` (relu au run suivant, supprimé avec le reste) ;
  réserve d'environ 50 images partagée, pas un fichier par inscrit ; chaque chemin référencé existe.
- **Cohérence métier** : profil validé (`profileStatus = APPROVED` + dernière `ProfileSubmission`
  `APPROVED`) requis pour toute inscription ; `snapshot*` égal au profil ; rejets avec
  `rejectionReasonId` du catalogue (portée `REGISTRATION` ou `BOTH`) et `rejectionReason` = libellé ;
  soft delete (`archived` + `archivedAt`).
- **Seed minimal et prod** : `make db-seed`, `make init`, `make db-reset`, `scripts/agent-stack.sh`
  restent rapides, sans organisation ni évènement ; le chemin prod du service `init` ne change pas
  de comportement.
- Langue : code en anglais, commentaires et libellés de démo en français (accents dans les libellés),
  commits en français ASCII, style conventional commits, sans mention d'IA.

## Contrats figés (consommés par les lots 2a, 2b, 2c)

Toute modification après la vague 1 → amender les plans de lot. Ces blocs sont normatifs.

### `src/lib/badge-env.ts`

```ts
export const BADGE_ENVS = ["dev", "preprod", "prod"] as const;
export type BadgeEnv = (typeof BADGE_ENVS)[number];

export class BadgeEnvError extends Error {}

/** Lit BADGE_ENV (trim + minuscules). Absent ou valeur inconnue → null. */
export function readBadgeEnv(env?: Record<string, string | undefined>): BadgeEnv | null; // défaut process.env

/** Autorise le seed de démo : retourne "dev" | "preprod", sinon lève BadgeEnvError (absent, invalide, prod). */
export function assertDemoSeedAllowed(env?: Record<string, string | undefined>): "dev" | "preprod";
```

`BADGE_ENV` est posée dans `environment:` de chaque service qui exécute du code applicatif
(`app`, `worker`, `init`, tâches ponctuelles/`tools`) : `dev` dans `docker-compose.dev.yml`,
`preprod` dans `docker-compose.preprod.yml`, `prod` dans `docker-compose.yml`. Les tests de fumée
(lot 2c) lisent `readBadgeEnv()`.

### Point d'entrée et seeds

```ts
// prisma/seed.ts  — SEED_MODE : "minimal" (défaut) | "demo" | "super-admin"
//   minimal     → runMinimalSeed()
//   demo        → runMinimalSeed() puis runDemoSeed()   (make db-seed-demo, dev)
//   super-admin → seedSuperAdmin() seul (service compose `init`, prod et préprod : comportement d'avant)
// prisma/seed/constants.ts
export const DEMO_PASSWORD = "123456";
export const DEMO_DOMAIN = "@demo.local";
export const DEMO_SLUG_PREFIX = "demo-";
export const DEMO_STORAGE_PREFIX = "demo/";
export const DEMO_FAKER_SEED = 20261103;
export const DEV_SUPER_ADMIN_EMAIL = "admin@badge.local";
/** Comptes *@badge.local déplacés dans le seed de démo (jamais admin@badge.local). */
export const DEMO_BADGE_LOCAL_EMAILS: readonly string[];
// prisma/seed/minimal.ts
export async function runMinimalSeed(env?: Record<string, string | undefined>): Promise<void>;
// prisma/seed/demo/index.ts
export type DemoSeedOptions = {
  env?: Record<string, string | undefined>; // défaut process.env
  scale?: number;                           // défaut Number(env.DEMO_SCALE ?? 1)
  now?: Date;                               // défaut new Date()
  storagePrefix?: string;                   // défaut DEMO_STORAGE_PREFIX
  accountsFile?: string | null;             // défaut env.DEMO_ACCOUNTS_FILE ?? ".demo/comptes-demo.md" ; null = ne pas écrire
};
export async function runDemoSeed(options?: DemoSeedOptions): Promise<DemoContext>;
```

### Ordre d'appel et stubs de lot

`runDemoSeed` : `assertDemoSeedAllowed` → `createDemoContext` → **nettoyage** (inverse :
`cleanupNotificationsAndActivity`, `cleanupBilling`, `cleanupPrint`, puis `cleanupDemoCore`) →
`seedAccounts` → `seedOrganizationsAndEvents` → `seedRegistrations` → `seedPrint` → `seedBilling` →
`seedNotificationsAndActivity` → `parkJobs()` (filet de sécurité) → `flushTrackedKeys()` →
`writeAccountsFile`. Le nettoyage appelle `ctx.storage.clearTracked()` (clés suivies puis préfixe
`demo/`). Chaque lot supprime dans son `cleanupX` tout
ce qu'il crée et qui ne tombe pas en cascade avec les organisations/utilisateurs de démo.

```ts
// prisma/seed/demo/print.ts          (lot 2a)
export async function seedPrint(ctx: DemoContext): Promise<void>;
export async function cleanupPrint(ctx: DemoContext): Promise<void>;
// prisma/seed/demo/billing.ts        (lot 2b)
export async function seedBilling(ctx: DemoContext): Promise<void>;
export async function cleanupBilling(ctx: DemoContext): Promise<void>;
// prisma/seed/demo/notifications.ts  (lot 2b)
export async function seedNotificationsAndActivity(ctx: DemoContext): Promise<void>;
export async function cleanupNotificationsAndActivity(ctx: DemoContext): Promise<void>;
```

Les stubs livrés par le socle sont des fonctions vides (`async () => {}`). Un lot peut créer un
sous-dossier du même nom (`print/`, `billing/`, `notifications/`).

### `prisma/seed/demo/context.ts`

```ts
import type { Faker } from "@faker-js/faker";
import type { EventRole, OrgRole, RegistrationStatus, StaffRole } from "@prisma/client";

export type OrgSize = "huge" | "medium" | "small" | "archived";
export type EventPhase = "past" | "ongoing" | "upcoming";
export type DemoSpecialCase =
  | "blocked" | "unverifiedEmail" | "multiOrg" | "organizerAndParticipant" | "archivedUser"
  | "invitationPending" | "invitationExpired" | "invitationAccepted"
  | "profilePending" | "profileRejected" | "profileIncomplete";

/** Noms de modèles Prisma (camelCase du client) acceptés par backdate. */
export type BackdatableModel =
  | "registration" | "profileSubmission" | "user" | "organization" | "event"
  | "printRequest" | "printRequestMessage" | "printRequestPrint" | "printQuoteLine" | "orgPrintCredit"
  | "printSheetGeneration" | "payment" | "subscription" | "notification" | "activityLog" | "job";

export type DemoUser = { id: string; email: string; name: string };
export type DemoCategory = { id: string; number: number; name: string; anonymous: boolean; neutralBadge: boolean };
export type DemoOrg = {
  id: string; slug: string; name: string; size: OrgSize; archived: boolean; badgeTemplateId: string | null;
};
export type DemoEvent = {
  id: string; slug: string; title: string; orgId: string; phase: EventPhase;
  date: Date; endDate: Date | null; archived: boolean; registrationOpen: boolean;
  badgeTemplateId: string | null; categories: DemoCategory[];
};
export type DemoRegistrationRef = {
  id: string;            // identifiant métier imprimé sur le badge
  userId: string; eventId: string; categoryId: string;
  status: RegistrationStatus; badgePrinted: boolean;
};

export type DemoRegistry = {
  staff: Record<StaffRole, DemoUser[]>;                       // 4 rôles, plusieurs comptes chacun (dont admin@badge.local en SUPER_ADMIN)
  orgMembers: Map<string /* orgId */, Record<OrgRole, DemoUser[]>>;
  eventMembers: Map<string /* eventId */, Record<EventRole, DemoUser[]>>;
  participants: DemoUser[];                                   // profil APPROVED (les seuls inscrits)
  special: Partial<Record<DemoSpecialCase, DemoUser>>;
  orgs: DemoOrg[];
  orgsBySize: Record<OrgSize, DemoOrg[]>;
  events: DemoEvent[];
  eventsByPhase: Record<EventPhase, DemoEvent[]>;
  eventsByOrg: Map<string /* orgId */, DemoEvent[]>;
  registrations: Map<string /* eventId */, Record<RegistrationStatus, DemoRegistrationRef[]>>;
};

export type DemoContext = {
  faker: Faker;                                  // graine DEMO_FAKER_SEED
  scale: number;                                 // 1 = volumes complets ; tests ≈ 0.02
  scaled(n: number, min?: number): number;      // Math.max(min ?? 1, Math.round(n * scale))
  env: "dev" | "preprod";
  passwordHash: string;                          // bcrypt 12 rounds, calculé une fois
  dates: {
    now: Date;                                   // figé à la création du contexte
    daysFromNow(days: number, hour?: number): Date; // hour : heure locale, défaut 9
    daysAgo(days: number, hour?: number): Date;
    between(minDaysAgo: number, maxDaysAgo: number): Date; // via faker, dans le passé
  };
  storage: {
    prefix: string;                              // "demo/" par défaut
    key(...parts: string[]): string;             // prefix + parts.join("/") ; lève si "..", "\\" ou segment vide
    put(key: string, body: Buffer, contentType: string): Promise<string>; // refuse hors préfixe ; via uploadFile
    clear(): Promise<number>;                    // deletePrefix(prefix)
    /** Clé EXACTE hors préfixe demo/ (ex. print-sheets/orders/<id>.pdf, que /api/files autorise selon le
     *  préfixe de clé). Écrit via uploadFile ET appelle trackKey. Lève si la clé est vide, contient ".."
     *  ou "\\", ou commence par "/". */
    putAt(key: string, body: Buffer, contentType: string): Promise<string>;
    /** Enregistre une clé à supprimer au prochain nettoyage (manifeste persisté, voir ci-dessous). */
    trackKey(key: string): void;
    /** Écrit le manifeste (obligatoire en fin de run : appelé par runDemoSeed après tous les modules). */
    flushTrackedKeys(): Promise<void>;
    /** Relit le manifeste du run précédent, supprime ses clés, puis deletePrefix(prefix). Retourne le nombre d'objets supprimés. */
    clearTracked(): Promise<number>;
  };
  /** Réécrit createdAt/updatedAt de lignes déjà créées (les fonctions du domaine écrivent new Date() ;
   *  @updatedAt écrase toute valeur passée à Prisma → UPDATE SQL brut, table et colonnes validées
   *  contre Prisma.dmmf, jamais de nom venant d'ailleurs). updatedAt ignoré si le modèle n'a pas la colonne. */
  backdate(
    model: BackdatableModel,
    ids: string | string[],
    createdAt: Date,
    updatedAt?: Date,            // défaut : createdAt
  ): Promise<void>;
  /** Passe à runAt lointain (défaut daysFromNow(3650)) tous les Job PENDING créés depuis `since`
   *  (défaut dates.now) pour que le worker ne les prenne jamais. Appelable par tout module, plusieurs fois.
   *  Retourne le nombre de jobs reportés. */
  parkJobs(since?: Date, runAt?: Date): Promise<number>;
  images: { photos: string[]; logos: string[]; banners: string[] }; // clés de stockage existantes
  registry: DemoRegistry;
  recordAccount(email: string, role: string, scenario: string): void; // alimente le fichier de comptes
  accounts: Array<{ email: string; role: string; scenario: string }>;
};

export function createDemoContext(options?: DemoSeedOptions): Promise<DemoContext>;
/** Insertion par lots : découpe `rows` en tranches de `size` (défaut 500) et appelle `insert` en séquence. */
export function insertInBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size?: number): Promise<void>;
```

Conventions de nommage figées : organisations `demo-<slug>` (la grosse : `demo-grosse-org`),
évènements `demo-<slug-org>-<slug-évènement>`, comptes `@demo.local` au format
`<rôle>[.<qualificatif>]@demo.local` (ex. `owner.grosse-org@demo.local`, `observer@demo.local`,
`participant.0001@demo.local`), mot de passe commun partout.

---

## Review Focus

- `BADGE_ENV` absent, vide, en majuscules (`PROD`), avec espaces ou inconnu : le seed de démo refuse
  sans écrire (test : compteurs de lignes inchangés après le refus).
- Seed minimal sur serveur sans `SEED_SUPER_ADMIN_*`, ou avec un mot de passe de moins de 6
  caractères, ou avec un email déjà pris par un non-SUPER_ADMIN : message clair, pas de crash silencieux
  (comportement actuel de `seedSuperAdmin` conservé).
- Relance du seed de démo sans reset : mêmes comptes, aucun orphelin (utilisateur `@demo.local`,
  organisation `demo-`, fichier sous `demo/`), `admin@badge.local` conservé et son mot de passe
  remis au mot de passe commun en dev.
- Facteur d'échelle minimal (`0.001`, `0`) : chaque valeur d'enum du domaine (statuts d'inscription,
  profils, rôles) reste représentée (`scaled` a un plancher), aucune division par zéro.
- Grosse organisation à `scale = 1` : identifiants métier uniques malgré plus de 999 inscrits par
  catégorie, `@@unique([userId, eventId])` respecté, durée du seed complet mesurée (quelques minutes
  au plus).
- Clés suivies hors `demo/` (`putAt`) : un run interrompu avant `flushTrackedKeys` ne doit pas
  laisser de fichiers que le nettoyage ne retrouvera jamais (écrire le manifeste aussi en cas
  d'échec : `try/finally` dans `runDemoSeed`), et le nettoyage ne supprime que des clés du manifeste.
- Jobs : aucun `Job` `PENDING` de démo ne reste avec un `runAt` proche à la fin du seed (le worker
  de dev ne doit envoyer aucun email de démo).
- Organisation archivée : ses évènements, membres et inscriptions restent lisibles et cohérents
  (aucune inscription ouverte, aucun rôle d'évènement orphelin).

---

### Task 1: `badge-env.ts` et `BADGE_ENV` dans les compose

**Files:**
- Create: `src/lib/badge-env.ts`
- Test: `src/lib/__tests__/badge-env.test.ts`, `src/lib/__tests__/badge-env-compose.test.ts`
- Modify: `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.preprod.yml` (et
  `docker-compose.agent.yml` si les services de l'overlay ne l'héritent pas)

**Interfaces:**
- Produces: l'API `badge-env.ts` du bloc « Contrats figés ».

- [ ] **Step 1: Écrire les tests (échouent)** — `badge-env.test.ts` : `readBadgeEnv({BADGE_ENV:"dev"})
  === "dev"`, `" Preprod "` → `"preprod"`, `"PROD"` → `"prod"`, absent/`""`/`"staging"` → `null` ;
  `assertDemoSeedAllowed` retourne `"dev"` et `"preprod"` ; lève `BadgeEnvError` pour `prod`, absent,
  `"staging"` (message citant la valeur lue). `badge-env-compose.test.ts` : lit les trois fichiers
  compose en texte, vérifie que chacun contient `BADGE_ENV:` avec la seule valeur attendue (`prod` /
  `dev` / `preprod`) et qu'aucune autre valeur n'y figure.
- [ ] **Step 2: Lancer** `make test FILE=src/lib/__tests__/badge-env.test.ts` — Attendu : FAIL (module absent).
- [ ] **Step 3: Implémenter** `src/lib/badge-env.ts` (signatures du contrat, 100 % de couverture).
- [ ] **Step 4: Poser `BADGE_ENV`** dans l'`environment:` de chaque service exécutant du code applicatif
  de chaque compose (`init`, `app`, `worker`, tâches ponctuelles/`tools` ; compose dev : `app` et
  `worker`). Valeurs : `dev`, `preprod`, `prod`. Aucune autre modification de ces fichiers.
- [ ] **Step 5: Lancer** les deux fichiers de test — Attendu : PASS ; `make test-coverage` ne signale
  rien sous 100 % pour `badge-env.ts`.
- [ ] **Step 6: Commit** — `feat(seed): garde-fou BADGE_ENV (dev, preprod, prod) dans les compose`

### Task 2: Seed minimal réduit, fusion du SUPER_ADMIN, service `init`

**Files:**
- Create: `prisma/seed/constants.ts`, `prisma/seed/minimal.ts`, `prisma/seed/__tests__/minimal.test.ts`
- Modify: `prisma/seed.ts` (point d'entrée), `docker-compose.yml`, `docker-compose.preprod.yml`
  (commande du service `init`), `Makefile` (commentaire de `db-seed`/`init` si cité)
- Delete: `prisma/seed-super-admin.ts`

**Interfaces:**
- Consumes: `seedSuperAdmin(env)` de `src/lib/seed-super-admin.ts` (inchangé), `readBadgeEnv`.
- Produces: `runMinimalSeed(env?)`, constantes de `constants.ts` (bloc « Contrats figés »).

- [ ] **Step 1: Écrire le test (échoue)** — `minimal.test.ts` sur la base `_test` : après
  `runMinimalSeed({BADGE_ENV:"dev"})` : `PlatformSettings` singleton, plans `free` et `Standard`, 9
  motifs de rejet, gabarit « A3 standard », 5 accessoires publiés, templates de référence installés,
  `badgeTemplateId` valide, **un seul `User`** : `admin@badge.local`, `SUPER_ADMIN`, mot de passe
  vérifié par `compare("123456", …)`. Deuxième appel : mêmes compteurs (idempotent) et mot de passe
  remis à `123456` si modifié. Avec `{BADGE_ENV:"preprod", SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD}` :
  le SUPER_ADMIN est celui des variables, pas `admin@badge.local`. Sans variables en `preprod` : aucun
  utilisateur créé, pas d'exception. Aucun `Organization`/`Event` dans tous les cas.
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/__tests__/minimal.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Extraire** de l'actuel `prisma/seed.ts` toutes les données de référence
  (`PlatformSettings` + SMTP vers Mailpit, plans, motifs de rejet, gabarit A3, accessoires, templates
  de référence + repointage `badgeTemplateId`) dans `runMinimalSeed` (code déplacé tel quel, client
  Prisma partagé de `src/lib/prisma`). `ensureReferenceTemplates` a besoin d'un `installedById` :
  créer d'abord le SUPER_ADMIN (dev : upsert de `DEV_SUPER_ADMIN_EMAIL` avec `DEMO_PASSWORD` haché 12
  rounds ; hors dev : `seedSuperAdmin(env)`), puis passer son identifiant ; si aucun SUPER_ADMIN
  n'existe (cas « skipped »), utiliser l'identifiant fixe `"seed"` (champ nu sans relation).
- [ ] **Step 4: Réécrire `prisma/seed.ts`** : lecture de `SEED_MODE`, appel de `runMinimalSeed()`,
  `runDemoSeed()` (import dynamique, absent tant que la Task 3 n'est pas faite : `demo` lève une
  erreur explicite), ou `seedSuperAdmin()` seul pour `super-admin` (messages d'avant). Supprimer le
  code de démo hérité (PRNG maison, tableaux, comptes) : il est remplacé par les Tasks 5 à 7 ; les
  comptes `*@badge.local` et `participant*@` y sont reconstitués.
- [ ] **Step 5: Mettre à jour `init`** (prod et préprod) : `npx prisma db push --accept-data-loss &&
  SEED_MODE=super-admin npx tsx prisma/seed.ts` à la place de `npx tsx prisma/seed-super-admin.ts` ;
  supprimer `prisma/seed-super-admin.ts`. Vérifier que `prisma/seed/**` est bien copié dans l'image
  `tools` (le `COPY . .` du stage builder, `Dockerfile` : lecture seule) ; sinon le signaler.
- [ ] **Step 6: Lancer** le test — Attendu : PASS. Puis `make db-seed` en dev : base ne contenant que
  `admin@badge.local`.
- [ ] **Step 7: Commit** — `refactor(seed): seed minimal reduit au SUPER_ADMIN, fusion de seed-super-admin`

### Task 3: Cadre démo — contexte, orchestration, stubs, nettoyage, fichier de comptes

**Files:**
- Create: `prisma/seed/demo/context.ts`, `prisma/seed/demo/index.ts`, `prisma/seed/demo/cleanup.ts`,
  `prisma/seed/demo/accounts-file.ts`, stubs `prisma/seed/demo/print.ts`, `billing.ts`,
  `notifications.ts`, modules vides `accounts.ts`, `organizations.ts`, `registrations.ts` (exportant
  `seedAccounts`, `seedOrganizationsAndEvents`, `seedRegistrations`, tous `(ctx: DemoContext) => Promise<void>`)
- Test: `prisma/seed/demo/__tests__/framework.test.ts`
- Modify: `prisma/seed.ts` (branche `demo`), `Makefile` (`db-seed-demo`, commentaire), `.gitignore`
  (`.demo/`)

**Interfaces:**
- Consumes: `assertDemoSeedAllowed`, `DEMO_*` (Tasks 1-2).
- Produces: tout le bloc `context.ts`, `runDemoSeed`, `cleanupDemoCore(ctx)`,
  `writeAccountsFile(ctx, path)` (écrit un tableau Markdown email · rôle · cas + rappel du mot de
  passe commun, crée le dossier).

- [ ] **Step 1: Écrire les tests (échouent)** — (a) `runDemoSeed({env:{BADGE_ENV:"prod"}})`, env vide
  et `"staging"` rejettent avec `BadgeEnvError` et le nombre d'`User`/`Organization` est inchangé ;
  (b) avec `{BADGE_ENV:"dev"}, scale 0.02, accountsFile: null` : résout, retourne un contexte dont
  `scaled(1000, 1) >= 1`, `dates.daysAgo(3) < dates.now < dates.daysFromNow(3)`, `storage.key("a","b")
  === "demo/a/b"`, `storage.key("..", "x")` lève, `storage.put("autre/x", …)` lève ; (c) deux
  `createDemoContext` successifs produisent la même première valeur de `faker.person.firstName()` ;
  (d) un stub de lot espionné via les exports (ordre d'appel enregistré) : `seedAccounts` →
  `seedOrganizationsAndEvents` → `seedRegistrations` → `seedPrint` → `seedBilling` →
  `seedNotificationsAndActivity` ; les cleanup précèdent les seed ; (e) `insertInBatches` découpe
  1 250 lignes en tranches de 500, 500, 250 ; (f) `writeAccountsFile` produit un fichier listant les
  comptes enregistrés par `recordAccount` (dossier temporaire) ; (g) `cleanupDemoCore` supprime
  organisations `demo-%`, utilisateurs `@demo.local` et `DEMO_BADGE_LOCAL_EMAILS`, motifs/plans
  intacts, `admin@badge.local` intact, `ctx.storage.clearTracked()` appelé (préfixe de test isolé,
  `storagePrefix: "demo/_test/"`) ; (h) `storage.putAt("print-sheets/orders/x.pdf", …)` écrit à la clé
  exacte et `putAt("../x")`/`putAt("/x")` lèvent ; après `flushTrackedKeys`, un nouveau contexte
  (même préfixe) dont `clearTracked()` supprime l'objet `print-sheets/orders/x.pdf` ET les objets du
  préfixe ; (i) `backdate("registration", id, d)` change `createdAt` et `updatedAt` (relus en base),
  refuse un modèle hors liste ; (j) `parkJobs()` : un `Job` `PENDING` créé après `dates.now` voit
  `runAt` > `now + 3000 jours`, un `Job` `DONE` et un `Job` antérieur à `since` restent inchangés,
  retourne le nombre reporté ; (k) `runDemoSeed` appelle `parkJobs` et `flushTrackedKeys` après les
  trois lots.
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/demo/__tests__/framework.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Implémenter** `context.ts` (signatures du contrat ; `registry` initialisé vide avec
  toutes les clés d'enum présentes ; `passwordHash` = `hash(DEMO_PASSWORD, 12)` une fois ; `faker`
  = instance seedée par `DEMO_FAKER_SEED`, locale `fr`), `index.ts` (ordre figé du bloc « Ordre
  d'appel », garde-fou en première instruction, journal de durée par étape), `cleanup.ts` (ordre FK :
  `ActivityLog` des orgs/évènements/utilisateurs de démo, organisations `demo-%` (cascade),
  `InstalledBadgeTemplate` de famille `demo-%` + `deletePrefix("badge-templates/<id>/")`,
  utilisateurs de démo, puis stockage), stubs des trois lots (fonctions vides) et des trois modules
  de comptes/orgs/inscriptions. Brancher `SEED_MODE=demo` dans `prisma/seed.ts` ; `make db-seed-demo`
  garde `-e SEED_MODE=demo` et son commentaire est réécrit (voir Task 8).
- [ ] **Step 4: Lancer** le test — Attendu : PASS.
- [ ] **Step 5: Commit** — `feat(seed): cadre du seed de demo (contexte, orchestration, stubs de lots)`

### Task 4: Réserve d'images et stockage `demo/`

**Files:**
- Create: `prisma/seed/demo/images.ts`, `prisma/seed/demo/png.ts`
- Test: `prisma/seed/demo/__tests__/images.test.ts`
- Modify: `prisma/seed/demo/context.ts` (appel de `buildImageReserve` dans `createDemoContext`)

**Interfaces:**
- Consumes: `ctx.storage` (Task 3), `uploadFile`/`getFile` de `src/lib/storage.ts`.
- Produces: `encodePng(width, height, rgb: (x: number, y: number) => [number, number, number]): Buffer`
  (PNG valide sans dépendance : en-tête, `IDAT` via `zlib.deflateSync`, CRC32 via `zlib.crc32`) et
  `buildImageReserve(ctx: Pick<DemoContext, "faker" | "storage">): Promise<DemoContext["images"]>`
  (clés `demo/images/photo-NN.png` ×30, `logo-NN.png` ×12, `banner-NN.png` ×8 ; 64×64 pour les
  photos, 96×96 pour les logos, 320×96 pour les bannières ; < 10 Ko chacune ; dégradés/motifs
  déterministes issus de la graine faker). Types MIME `image/png` (accepté par `storage.ts`).

- [ ] **Step 1: Écrire les tests (échouent)** — `encodePng(2,2,…)` commence par la signature PNG
  `89 50 4E 47 0D 0A 1A 0A` ; `buildImageReserve` retourne 30/12/8 clés ; chaque clé commence par le
  préfixe et `getFile(key)` rend un corps non vide de type `image/png` de moins de 5 Mo
  (`MAX_UPLOAD_BYTES`) ; deux appels avec la même graine produisent des octets identiques ; un second
  appel n'ajoute aucun objet (`listPrefix` identique : réécriture, pas de doublon).
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/demo/__tests__/images.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Implémenter** `png.ts` et `images.ts` (écriture séquentielle par `ctx.storage.put`).
- [ ] **Step 4: Lancer** le test — Attendu : PASS.
- [ ] **Step 5: Commit** — `feat(seed): reserve d'images generees sous demo/`

### Task 5: Comptes de tous types

**Files:**
- Create/Modify: `prisma/seed/demo/accounts.ts` (remplace le stub de la Task 3)
- Test: `prisma/seed/demo/__tests__/accounts.test.ts`

**Interfaces:**
- Consumes: `DemoContext`, `ctx.registry`, `ctx.recordAccount`, `ctx.passwordHash`.
- Produces: `seedAccounts(ctx)` remplit `registry.staff`, `registry.special` (clés
  `invitationPending|Expired|Accepted`, `blocked`, `unverifiedEmail`, `archivedUser`) et les
  utilisateurs « porteurs de rôle » dont les rattachements (`OrgMembership`, `EventMembership`) sont
  créés par la Task 6 une fois organisations et évènements connus. Contrat intermédiaire figé :
  `registry.pendingOrgMembers: Array<{ user: DemoUser; role: OrgRole; orgSlug: string }>` et
  `registry.pendingEventMembers: Array<{ user: DemoUser; role: EventRole; orgSlug: string; phase: EventPhase | "any" }>`
  (champs ajoutés à `DemoRegistry`, tableaux vides par défaut, consommés puis laissés tels quels).

- [ ] **Step 1: Écrire les tests (échouent)** — après `seedAccounts` (échelle 0.02) :
  - Staff : 4 `StaffRole` présents, au moins 2 comptes par rôle sauf `SUPER_ADMIN` (`admin@badge.local`
    conservé tel quel, mot de passe `123456`), `admin2@`, `support@`, `observer@badge.local` recréés,
    tous `emailVerifiedAt` renseigné, et des comptes `@demo.local` supplémentaires
    (`staff-admin.2@demo.local`, `support.2@demo.local`, `observer@demo.local`…).
  - Cas particuliers dans `registry.special` : invitation en attente (`inviteToken` non nul,
    `inviteTokenExpiry` futur, pas de `emailVerifiedAt`), expirée (expiry passé), acceptée (token nul,
    vérifiée, `lastLoginAt` renseigné) ; compte `blocked` avec `blockedReason` ; email non vérifié
    (`emailVerifiedAt` nul, `emailVerifyToken` renseigné) ; compte `archived` avec `archivedAt`.
  - `pendingOrgMembers` couvre `OWNER`, `MANAGER`, `AUDITOR`, avec **deux owners** pour la grosse
    organisation, un utilisateur présent dans **deux organisations** (`special.multiOrg`) et un
    organisateur **également participant** (`special.organizerAndParticipant`) ;
    `pendingEventMembers` couvre `ADMIN`, `OPERATOR`, `PRINTER`, `VIEWER`.
  - Tous les mots de passe vérifient `compare("123456", hash)` ; tous les comptes sont enregistrés par
    `recordAccount` avec un cas lisible ; emails au format `<rôle>[.<qualificatif>]@demo.local`.
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/demo/__tests__/accounts.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Implémenter** `seedAccounts` : jetons d'invitation en hexadécimal brut (comme
  `src/lib/mail.ts`, qui ne les hache pas) ; création par `createMany` avec le hachage unique ;
  noms via faker `fr`.
- [ ] **Step 4: Lancer** le test — Attendu : PASS.
- [ ] **Step 5: Commit** — `feat(seed): comptes de demo (staff, roles, invitations, cas particuliers)`

### Task 6: Organisations, évènements, catégories, templates de badge

**Files:**
- Create/Modify: `prisma/seed/demo/organizations.ts` (remplace le stub), `prisma/seed/demo/templates.ts`
- Test: `prisma/seed/demo/__tests__/organizations.test.ts`

**Interfaces:**
- Consumes: `registry.pendingOrgMembers`, `registry.pendingEventMembers` (Task 5), `ctx.images`,
  `installTemplate` de `src/lib/badge-templates/install.ts`, `parseManifest`.
- Produces: `seedOrganizationsAndEvents(ctx)` remplit `registry.orgs/orgsBySize/events/eventsByPhase/eventsByOrg`
  et crée `OrgMembership`/`EventMembership`; `installDemoTemplate(ctx, args: { family: string; label: string; source: "default" | "recto-verso" }): Promise<string>`
  (lit `prisma/badge-templates/<source>/` — manifeste + `bindings.json` —, remplace `family`/`label`,
  appelle `installTemplate`, retourne l'identifiant installé).

- [ ] **Step 1: Écrire les tests (échouent)** — à `scale = 0.02` : 12 organisations (1 `huge`
  `demo-grosse-org`, 4 `medium`, 6 `small`, 1 `archived` avec `archived`/`archivedAt`), logos choisis
  dans `ctx.images.logos` (fichier existant via `getFile`) ; la grosse organisation a plusieurs
  évènements, chaque organisation active a des évènements dans au moins deux phases et au moins un
  `past`/`ongoing`/`upcoming` existe globalement ; dates relatives à `ctx.dates.now` (passé < now,
  ongoing : `date <= now <= endDate`, à venir > now) ; `registrationOpen` vrai pour `ongoing` et
  `upcoming`, faux pour `past` et pour tout l'archivé ; évènements archivés dans la phase `past` ; 2 à 4
  catégories par évènement dont au moins une « normale », numéros uniques et de chiffre des unités
  distinct, une catégorie `anonymous` et une `neutralBadge` quelque part ; `CategoryTemplate` par
  organisation ; `BlockedEmail`/`BlockedDocument` sur des évènements actifs ; `EventSettings` sur une
  partie des évènements ; `banner`/`logo`/`description`/`endDate`/`securityInstructions` renseignés sur
  certains ; au moins un `badgeTemplateId` d'organisation et un d'évènement pointant des
  `InstalledBadgeTemplate` de famille `demo-%` ; toutes les entrées `pendingOrgMembers` et
  `pendingEventMembers` sont matérialisées (`OrgMembership`/`EventMembership`, jamais deux fois le même
  couple ; `EventMembership` seulement sur des évènements d'organisations non archivées).
  `installDemoTemplate` : deux appels avec des familles différentes créent deux lignes distinctes.
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/demo/__tests__/organizations.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Implémenter**. Organisations et slugs fixes dans une table de données du module
  (tailles : huge ×1, medium ×4, small ×6, archived ×1) ; nombre d'évènements par taille :
  huge 5 (dont 1 `ongoing` à 3 200 inscrits visés), medium 2 à 3, small 1 à 2, archived 1 passé ;
  utiliser `ctx.scaled` uniquement pour les volumes d'inscriptions (Task 7), pas pour la structure.
  Les évènements passent par `prisma.event.create` (cas vitrine) ; catégories/membres par
  `createMany`.
- [ ] **Step 4: Lancer** le test — Attendu : PASS.
- [ ] **Step 5: Commit** — `feat(seed): organisations, evenements, categories et templates de demo`

### Task 7: Profils et inscriptions, volumes

**Files:**
- Create/Modify: `prisma/seed/demo/registrations.ts` (remplace le stub), `prisma/seed/demo/participants.ts`
- Test: `prisma/seed/demo/__tests__/registrations.test.ts`

**Interfaces:**
- Consumes: `registry.events/orgs`, `ctx.images.photos`, catalogue `RejectionReason` (seed minimal),
  `insertInBatches`, `generateId` de `src/lib/generate-id.ts`.
- Produces: `seedRegistrations(ctx)` remplit `registry.participants` et `registry.registrations`
  (toutes les inscriptions créées, par évènement et statut) ; `seedParticipants(ctx, count: number): Promise<DemoUser[]>`
  (utilisateurs `participant.NNNN@demo.local` avec profil complet, `ProfileSubmission` cohérentes).

- [ ] **Step 1: Écrire les tests (échouent)** — à `scale = 0.02` (plancher garantissant tous les cas) :
  - Profils : les quatre `ProfileStatus` existent ; pour chaque utilisateur avec soumission, la
    dernière `ProfileSubmission` a le statut de `User.profileStatus` ; `APPROVED` ⇒ photo, pièce,
    `participantProfileCompletedAt` renseignés et fichiers existants (`getFile`) ; `REJECTED` ⇒
    `rejectionReasonId` du catalogue (portée `PROFILE` ou `BOTH`), `rejectionReasonLabel` = libellé,
    `reviewedById` d'un staff ; `INCOMPLETE` ⇒ aucune soumission ; certains approuvés ont une
    soumission antérieure `REJECTED` (resoumission) ; `participant@`, `profil-attente@`,
    `profil-rejete@badge.local` recréés (APPROVED / PENDING / REJECTED) et enregistrés.
  - Inscriptions : les trois `RegistrationStatus` présents ; **aucune inscription d'un utilisateur dont
    le profil n'est pas `APPROVED`** ; `snapshot*` identiques au profil de l'utilisateur ;
    `REJECTED` ⇒ `rejectionReasonId` non nul, portée `REGISTRATION` ou `BOTH`, `rejectionReason` =
    libellé du catalogue, `rejectionDetails` renseigné ; `badgePrinted` vrai seulement si `APPROVED`
    (avec `badgePrintedAt`), faux pour au moins une `APPROVED` ; `allAccessGranted` sur certaines
    `APPROVED` ; identifiants métier uniques ; aucune inscription sur évènement archivé en cours
    d'ouverture ni sur l'organisation archivée sauf évènement passé ; `registry.registrations` égal au
    contenu de la base (comptes par évènement et statut).
  - Volumes : à `scale = 1` (test marqué lent, `it.skipIf(!process.env.DEMO_FULL_SCALE_TEST)`) la
    grosse organisation dépasse 3 000 inscrits sur son évènement en cours, le total est entre 5 000 et
    8 000, les moyennes ont plusieurs centaines d'inscrits.
- [ ] **Step 2: Lancer** `make test FILE=prisma/seed/demo/__tests__/registrations.test.ts` — Attendu : FAIL.
- [ ] **Step 3: Implémenter**. Réserve de participants dimensionnée sur `ctx.scaled(4500)` (chaque
  participant s'inscrit à 1 à 3 évènements) ; répartition de statuts propre à la phase de
  l'évènement (`past` : surtout `APPROVED` et imprimés ; `ongoing`/`upcoming` : mélange avec
  `PENDING`) ; photos et pièces tirées de la réserve ; identifiants métier : un compteur de séquence
  par `(évènement, catégorie)`, catégories à chiffre des unités distinct ; insertion en lots de 500
  par `createMany` (`skipDuplicates` interdit : une collision doit échouer) ; `ProfileSubmission`
  en `createMany` ; cas « vitrine » (le participant historique, la resoumission) via
  `src/lib/profile-review.ts` si une fonction publique convient, sinon écritures directes cohérentes.
- [ ] **Step 4: Lancer** le test — Attendu : PASS.
- [ ] **Step 5: Commit** — `feat(seed): profils et inscriptions de demo a tous les statuts, avec volumes`

### Task 8: Vérification, doc d'installation (partie dev)

**Files:**
- Modify: `docs/v4/installation.md` (partie dev uniquement : comptes du seed, mot de passe commun,
  seed minimal vs démo, `BADGE_ENV`, fichier de comptes), `Makefile` (commentaires `db-seed*`,
  ligne d'aide de `make init` : « admin@badge.local, mot de passe 123456 »), `docs/v4/features/politique-tests.md`
  (seulement si elle cite le seed : corriger la mention)
- Test: couverture (aucun nouveau test)

- [ ] **Step 1: Réécrire la doc** : le seed minimal ne crée plus que `admin@badge.local` (dev) ;
  `make db-seed-demo` crée les comptes de démo (liste des motifs d'emails, mot de passe `123456`,
  fichier `.demo/comptes-demo.md`), volumes et durée mesurée (Step 3), `DEMO_SCALE`,
  `DEMO_ACCOUNTS_FILE`, garde-fou `BADGE_ENV`. Ne pas toucher aux sections préprod (lot 2c).
- [ ] **Step 2: Vérifier** `make lint && make typecheck && make test-coverage` — Attendu : tout vert,
  couverture 100 % sur `src/lib/**` et `src/app/api/**`.
- [ ] **Step 3: Bout en bout en dev** (sans `make db-reset`, cible à risque) : `make db-seed`, puis
  `time make db-seed-demo` sur la base de dev actuelle (le nettoyage de démo est idempotent) ; noter la durée
  (objectif : quelques minutes) et les comptes de tables (organisations ≈ 12, inscriptions 5 000 à
  8 000, grosse organisation > 3 000 sur un évènement).
- [ ] **Step 4: Idempotence** : relancer `make db-seed-demo` sans reset ; mêmes comptes de tables
  (hors `ActivityLog`/`Job` alimentés par les lots), aucun orphelin sous `demo/`.
- [ ] **Step 5: Connexion** : ouvrir `https://badge.local` (ou `localhost:3785`) et se connecter avec
  `admin@badge.local` puis `owner.grosse-org@demo.local` (mot de passe commun) ; vérifier que la
  liste des inscriptions de la grosse organisation se pagine et que les photos s'affichent.
- [ ] **Step 6: Reporter** dans `## Progression` les statuts, dates et notes (durée mesurée, volumes).
- [ ] **Step 7: Commit** — `docs(seed): installation dev du seed de demo, comptes et mot de passe commun`
