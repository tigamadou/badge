# Changer la catégorie d'une inscription rejetée — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** lors de la resoumission d'une inscription `REJECTED`, le participant peut
choisir une autre catégorie de l'évènement. L'inscription repasse en `PENDING` dans la
nouvelle catégorie, avec un **nouvel ID métier** qui encode le numéro de cette catégorie.
Sans changement de catégorie, la resoumission se comporte exactement comme aujourd'hui.

**Architecture :** la génération d'ID, aujourd'hui inline dans
`api/events/[slug]/register/route.ts`, passe dans un helper `src/lib/registration-id.ts`
(`allocateRegistrationId(tx, …)`) partagé par `register` et `resubmit`. La route
`resubmit` accepte un corps JSON optionnel `{ categoryId }` validé par Zod. Dans une seule
transaction, elle alloue le nouvel ID et met à jour l'inscription par un `updateMany`
conditionné sur `status: "REJECTED"` : `id`, `categoryId`, snapshot et `PENDING` changent
en une seule écriture. Aucune clé étrangère ne référence `Registration.id`, la clé
primaire peut donc changer. La réponse renvoie le nouvel ID et `ResubmitButton` redirige
vers la nouvelle URL.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 6 / MySQL 8,
Zod, Vitest 4 (environnement `node`, BDD de dev réelle, rendu statique
`renderToStaticMarkup` pour les composants), Playwright (projet `chromium`).

**Spec :** [`docs/v4/specs/2026-10-24-25-v4-categorie-inscription-rejetee.md`](../specs/2026-10-24-25-v4-categorie-inscription-rejetee.md) — coordination : [spec 22](../specs/2026-10-24-22-v4-lot-notifications-coordination.md)

**Branche :** `feat/categorie-inscription-rejetee` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Helper `allocateRegistrationId` (`src/lib/registration-id.ts`) | [x] | 2026-10-24 | 5 tests verts |
| 2 | `register/route.ts` délègue la génération d'ID au helper | [x] | 2026-10-24 | register-event.test.ts vert sans modification |
| 3 | `sendRegistrationResubmitted` mentionne la nouvelle catégorie | [x] | 2026-10-24 | 65 tests mail verts |
| 4 | `resubmit` : corps optionnel et validation de la catégorie | [x] | 2026-10-24 | corps optionnel, INVALID_BODY / INVALID_CATEGORY |
| 5 | `resubmit` : changement de catégorie et d'ID en transaction | [x] | 2026-10-24 | 29 tests registrations verts (concurrence, rollback) |
| 6 | Sélecteur de catégorie et redirection sur `/account/registrations/[id]` | [x] | 2026-10-24 | 3 tests de rendu ; verif navigateur laissee au lead |
| 7 | E2E rejet → changement de catégorie → resoumission | [x] | 2026-10-24 | e2e account-registration 8/8 |
| 8 | Rejet refusé quand le badge est imprimé (route + bouton) | [x] | 2026-10-24 | garde 409 + texte d'aide + e2e registration-detail 13/13 |
| 9 | Documentation (`docs/v4/features/`, `docs/v4/README.md`) | [x] | 2026-10-24 | fiche + README |
| — | Vérification finale (lint, typecheck, test, couverture, e2e, navigateur 375 / 1280) | [~] | 2026-10-24 | lint 0 erreur ; typecheck OK ; make test 1917/1917 (181 fichiers) ; couverture 100 % ; e2e 21/21 (account-registration + registration-detail) ; db-seed refait ; navigateur 375 / 1280 : reste à faire (lead) |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état.

## Contraintes globales

**Valeurs de la spec (à reprendre telles quelles) :**

- Corps de `POST /api/account/registrations/[id]/resubmit` : `{ "categoryId": "…" }`,
  **optionnel**. Corps vide ou absent : accepté, comportement actuel.
- `categoryId` absent ou égal à la catégorie actuelle : comportement actuel inchangé, ID
  inchangé.
- `categoryId` d'une catégorie qui n'appartient pas à l'évènement de l'inscription :
  **400**, code `INVALID_CATEGORY`, aucune modification.
- Inscription non `REJECTED` : **409**, code `INVALID_STATE` (comportement actuel), y
  compris avec un `categoryId`.
- Changement de catégorie, régénération de l'ID et passage en `PENDING` : **une seule
  transaction**.
- Nouvel ID : règles de `register/route.ts` (séquentiel de la **nouvelle** catégorie =
  nombre d'inscriptions de l'évènement dans cette catégorie + 1, date de l'évènement,
  jusqu'à 5 nouvelles tentatives en cas de collision).
- `logActivity` `REGISTRATION_RESUBMITTED` : `details.categoryChanged = { from: { id,
  name }, to: { id, name } }` (contrat consommé par la spec 24), et l'ancien et le nouvel ID
  dans `details`.
- `sendRegistrationResubmitted` mentionne la nouvelle catégorie et pointe vers le nouvel
  ID.
- Interface : sélecteur `RadioCards` pré-rempli avec la catégorie actuelle, toutes les
  catégories de l'évènement (nom + pastille de couleur), motif de rejet affiché au-dessus,
  texte d'aide « Votre inscription sera resoumise dans la catégorie *Exposant*. » quand la
  sélection diffère, bouton avec loader et toast (contrat C4 du socle).
- **Hors périmètre** : `rewriteNotificationLinks(oldId, newId, tx)` appartient au
  chantier 24. Ce plan ne l'implémente pas et ne l'appelle pas : le chantier 24 ajoutera
  l'appel dans la transaction de `resubmit` en se rebasant (ordre de fusion 23 → 25 → … → 24).
- **Propriété des fichiers (spec 22)** : ce chantier possède la route `resubmit`,
  `src/app/account/registrations/[id]/**` (hors bloc cover de la spec 26),
  `sendRegistrationResubmitted` dans `mail.ts` et `src/lib/registration-id.ts`. Dans
  `api/events/[slug]/register/route.ts`, il ne touche **que** la génération d'ID. La
  route staff `api/org/[orgId]/events/[eventId]/registrations/route.ts` génère aussi un ID
  (sans retry) : **ne pas la modifier** ici.

**Règles projet :**

- UI, toasts et messages d'erreur en français avec accents ; code et identifiants en
  anglais ; commentaires en français, dans le style ASCII des fichiers touchés.
- Server Components par défaut ; seul `ResubmitButton.tsx` porte `"use client"`.
- Toute action sensible logge via `logActivity()` ; aucune valeur sensible dans les
  réponses API.
- Commandes dans le conteneur de dev (`make dev` démarré) :
  - un fichier Vitest : `docker compose -f docker-compose.dev.yml exec app yarn vitest run '<chemin>'`
    (guillemets simples obligatoires à cause des crochets) ;
  - un fichier E2E : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test '<chemin>'` ;
  - suite complète : `make lint`, `make typecheck`, `make test`, `make test-coverage`,
    `make test-e2e`.
- **`make test` (et tout `vitest run`) vide la BDD de dev** : `make db-seed` avant toute
  vérification navigateur ou E2E.
- Couverture **100 %** (lignes, branches, fonctions, instructions) obligatoire sur
  `src/lib/**` et `src/app/api/**` (`vitest.config.ts`). **Pas de mock de Prisma** : les
  tests tournent sur la BDD de dev ; seuls des `vi.spyOn` ponctuels pour forcer une
  branche d'erreur, comme dans les tests existants.
- Les tests ne modifient jamais le code de production pour passer : en cas de blocage,
  s'arrêter et demander.
- Étapes de commit : « Commit — **uniquement sur demande explicite de l'utilisateur** ».
  Message conventional commit en français ASCII, sans trailer de co-auteur IA.
- Aucune étape de déploiement, de SSH ou de migration prod. Ce chantier ne modifie pas
  `schema.prisma`.

## Points de vigilance de revue

La spec implique ces cas sans les tester. Chacun reçoit un test dans la tâche indiquée.

1. **Double resoumission concurrente** (deux onglets, double clic malgré `useAsyncAction`) :
   les deux requêtes passent le contrôle `status === "REJECTED"` lu hors transaction. Sans
   garde, la seconde fait un `update` sur un ID qui n'existe plus (P2025, 500) ou alloue un
   second ID. Garde : `updateMany` conditionné sur `{ id, status: "REJECTED" }` ; `count
   === 0` → 409 `INVALID_STATE`. Test : `Promise.all` de deux POST → statuts `[200, 409]`,
   une seule inscription pour `(userId, eventId)`, un seul log `REGISTRATION_RESUBMITTED`,
   `sendRegistrationResubmitted` appelé une fois. → **Task 5**.
2. **Catégorie supprimée entre l'affichage et l'envoi** : la catégorie cible n'existe plus.
   Attendu : 400 `INVALID_CATEGORY`, inscription toujours `REJECTED` avec son ID et sa
   catégorie. Test : créer la catégorie, la supprimer, POST avec son id. → **Task 4**.
3. **Corps mal formé** : JSON invalide (`"{"`), `categoryId` non chaîne (`42`) ou chaîne
   vide. Attendu : 400 `INVALID_BODY` sans modification ; un corps vide (`""`) ou `{}`
   reste accepté (200, ID inchangé). → **Task 4**.
4. **Échec au milieu de la transaction** : le nouvel ID entre en collision malgré les
   5 tentatives (toutes les valeurs générées sont prises). Attendu : l'erreur Prisma
   remonte (rethrow, comme `register`), rien n'est modifié (ID, catégorie, statut
   `REJECTED`, snapshot), aucun email, aucun log. Test : `generateId` forcé (mock partiel)
   sur un ID existant pour les 6 appels. → **Task 5**.
5. **Ancienne URL et liens après changement d'ID** : l'ancienne page
   `/account/registrations/<ancienId>` doit renvoyer la page 404, l'email doit pointer vers
   le nouvel ID, et l'interface doit atterrir sur la nouvelle URL (pas sur l'ancienne via
   `router.refresh()`). Tests : lien de l'email → **Task 3** ; URL finale et 404 de
   l'ancienne URL → **Task 7**.

Autres points à garder en tête pendant la revue :

- Depuis la fusion de la spec 23 (fusionnée avant 25), les emails passent par la queue :
  l'assertion mailpit de la Task 7 suppose que le worker tourne en dev. Si ce n'est pas le
  cas, vérifier la ligne `Job` au lieu de mailpit et le noter dans le tracker.
- Le test existant « rethrows a non-AuthError raised while persisting the resubmission »
  espionne `prisma.registration.update` : dans une transaction interactive, l'écriture
  passe par `tx`, pas par `prisma`. Le test doit espionner `prisma.$transaction`
  (`mockRejectedValueOnce(new Error("boom-resubmit"))`). C'est un test, pas du code de
  production : l'adapter est permis.

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/lib/registration-id.ts` | Créer | `allocateRegistrationId(tx, args)` : séquentiel + `generateId` + retry |
| `src/lib/__tests__/registration-id.test.ts` | Créer | tests unitaires/intégration du helper |
| `src/app/api/events/[slug]/register/route.ts` | Modifier | remplace le bloc inline (séquentiel + boucle de retry) par l'appel au helper |
| `src/lib/mail.ts` | Modifier | `sendRegistrationResubmitted(registrationId, options?)` |
| `src/lib/__tests__/mail.test.ts` | Modifier | cas « catégorie changée » dans `describe("sendRegistrationResubmitted")` |
| `src/app/api/account/registrations/[id]/resubmit/route.ts` | Modifier | corps Zod, validation, transaction, nouvel ID, `details` |
| `src/app/api/account/__tests__/registrations.test.ts` | Modifier | nouveaux cas `resubmit` + adaptation du test de rethrow |
| `src/app/account/registrations/[id]/page.tsx` | Modifier | charge les catégories de l'évènement et `categoryId`, passe-les au bouton |
| `src/app/account/registrations/[id]/ResubmitButton.tsx` | Modifier | `RadioCards`, texte d'aide, corps conditionnel, redirection |
| `src/app/account/registrations/[id]/__tests__/ResubmitButton.test.tsx` | Créer | rendu statique initial |
| `e2e/public/account-registration.spec.ts` | Modifier | parcours rejet → changement → resoumission |
| `docs/v4/features/inscriptions-resoumission.md` | Créer | fiche feature |
| `docs/v4/README.md` | Modifier | entrée spec 25 + plan + fiche |

---

## Task 1 — Helper `allocateRegistrationId`

**Fichiers :**
- Créer : `src/lib/registration-id.ts`
- Créer : `src/lib/__tests__/registration-id.test.ts`

**Interfaces :**
- Consumes : `generateId({ categoryNumber, date, sequentialNumber }): string`
  (`src/lib/generate-id.ts`, inchangé) ; `Prisma.TransactionClient` (`@prisma/client`).
- Produces :

```ts
// src/lib/registration-id.ts
export interface AllocateRegistrationIdArgs {
  eventId: string;
  eventDate: Date;          // event.date ; convertie en "YYYY-MM-DD" (toISOString().slice(0, 10))
  categoryId: string;
  categoryNumber: number;   // category.number
}

// Le client global `prisma` est accepté (il est assignable à TransactionClient).
export async function allocateRegistrationId(
  tx: Prisma.TransactionClient,
  args: AllocateRegistrationIdArgs,
): Promise<string>;
```

Algorithme : identique au bloc actuel de `register/route.ts` (lignes 173-195), lu via
`tx`. `sequential = tx.registration.count({ where: { eventId, categoryId } })` ;
premier candidat avec `sequentialNumber: sequential + 1` ; pour `attempt` de 0 à 4, si
`tx.registration.findUnique({ where: { id } })` est nul on s'arrête, sinon on régénère
avec `sequentialNumber: sequential + 1 + attempt + 1`. Après 5 tentatives, on renvoie le
dernier candidat (comportement actuel : la collision remonte ensuite à l'écriture).
En-tête de fichier : commentaire indiquant que le format de l'ID est imprimé sur le badge
et dans le QR code.

- [ ] **Écrire les tests** dans `src/lib/__tests__/registration-id.test.ts`. Mock partiel
  de `@/lib/generate-id` comme dans `src/app/api/events/__tests__/register-event.test.ts`
  (`vi.mock(..., async (importOriginal) => ({ ...actual, generateId: vi.fn(actual.generateId) }))`),
  `vi.mocked(generateId).mockClear()` en `beforeEach`. Données créées avec `prisma`
  (organisation, évènement `date: new Date("2026-12-15")`, catégories `number: 3` et
  `number: 12`).
  - `it("uses the category number and the event date")` : `allocateRegistrationId(prisma, …)`
    sur la catégorie `number: 12` → `id[0] === "2"`, `id[9] === "2"`, `id.slice(1, 7) === "261215"`.
  - `it("counts only registrations of the target category for the sequential")` : 2
    inscriptions dans la catégorie 3, 1 dans la catégorie 12 → `generateId` appelé avec
    `sequentialNumber: 2` pour la catégorie 12 et `id.slice(-3) === "002"`.
  - `it("retries on collision until a free id is found")` : une inscription occupe
    `"collide-1"` ; `generateId` renvoie `"collide-1"` puis `"fresh-2"` → résultat
    `"fresh-2"`, second appel avec `sequentialNumber: sequential + 2`.
  - `it("returns the last candidate after 5 failed retries")` : `"taken"` existe ;
    `generateId` renvoie toujours `"taken"` → résultat `"taken"`, `generateId` appelé
    6 fois.
  - `it("reads through the transaction client")` : dans `prisma.$transaction(async (tx) => …)`,
    créer une inscription `"in-tx-1"` via `tx`, forcer `generateId` à renvoyer
    `"in-tx-1"` puis `"in-tx-2"` → `"in-tx-2"` (la collision n'est visible que dans `tx`).
- [ ] **Lancer** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/lib/__tests__/registration-id.test.ts'`
  → échec attendu : module `@/lib/registration-id` introuvable.
- [ ] **Implémenter** `allocateRegistrationId` avec la signature ci-dessus.
- [ ] **Relancer** la même commande → 5 tests verts.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `refactor: extrait la generation d'ID d'inscription dans registration-id`.

## Task 2 — `register/route.ts` délègue au helper

**Fichiers :**
- Modifier : `src/app/api/events/[slug]/register/route.ts` (seul le bloc « séquentiel +
  `generateId` + boucle de retry » change)

**Interfaces :**
- Consumes : `allocateRegistrationId(prisma, { eventId: event.id, eventDate: event.date, categoryId: category.id, categoryNumber: category.number })`.
- Produces : aucune nouvelle interface ; réponse `201 { id }` inchangée. L'import de
  `generateId` disparaît de la route.

Refactor sans changement de comportement : le test de non-régression existe déjà
(`register-event.test.ts`, dont « retries id generation on collision until a free id is
found (201) »). Le `vi.mock("@/lib/generate-id")` de ce fichier s'applique aussi au helper :
le test doit passer **sans modification**.

- [ ] **Lancer d'abord** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/app/api/events/__tests__/register-event.test.ts'`
  → vert (référence avant refactor).
- [ ] **Remplacer** le bloc par `const id = await allocateRegistrationId(prisma, { … });`
  et retirer la variable `dateIso` et l'import `generateId`.
- [ ] **Relancer** la même commande → vert, sans toucher au test. Puis `make typecheck`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `refactor: la route register utilise allocateRegistrationId`.

## Task 3 — `sendRegistrationResubmitted` mentionne la nouvelle catégorie

**Fichiers :**
- Modifier : `src/lib/mail.ts` (fonction `sendRegistrationResubmitted` uniquement)
- Modifier : `src/lib/__tests__/mail.test.ts` (`describe("sendRegistrationResubmitted")`)

**Interfaces :**
- Consumes : `enqueueEmail(...)` via le corps rebranché par le socle (C1) : ne changer
  ni le `kind` ni la `priority` posés par le socle.
- Produces :

```ts
export async function sendRegistrationResubmitted(
  registrationId: string,
  options?: { previousCategoryName?: string },
): Promise<void>;
```

  Le `select` ajoute `category: { select: { name: true } }`. Si
  `options.previousCategoryName` est fourni, le corps ajoute, après la phrase
  « … a bien été resoumise … », un paragraphe :
  `Votre inscription a été transférée de la catégorie <strong>{ancienne}</strong> vers la catégorie <strong>{nouvelle}</strong>.`
  Les deux noms passent par `escapeText`. Sans `options`, l'email est identique à
  aujourd'hui. Le lien reste `${baseUrl}/account/registrations/${encodeURIComponent(reg.id)}` :
  appelée avec le nouvel ID, la fonction pointe vers la nouvelle URL.

- [ ] **Écrire les tests**, en suivant le mécanisme de capture (`sent`) du `describe`
  existant tel que laissé par le socle :
  - `it("mentions the previous and new category when the category changed")` :
    catégorie actuelle « Exposant », appel avec `{ previousCategoryName: "Presse" }` →
    `html` contient `Presse`, `Exposant` et `transférée de la catégorie`.
  - `it("escapes category names")` : `previousCategoryName: "<b>x</b>"` → `html`
    contient `&lt;b&gt;x&lt;/b&gt;` et pas `<b>x</b>`.
  - `it("links to the registration id it receives")` (vigilance 5) : inscription
    `"NEW-ID-1"` → `html` contient `/account/registrations/NEW-ID-1`.
  - Le test existant « sends a resubmission confirmation with an account link » vérifie
    en plus que `html` **ne contient pas** `transférée`.
- [ ] **Lancer** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/lib/__tests__/mail.test.ts'`
  → échec attendu sur les deux premiers tests (texte absent).
- [ ] **Implémenter** le paramètre `options` et le paragraphe conditionnel.
- [ ] **Relancer** → vert.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(mail): l'email de resoumission mentionne le changement de categorie`.

## Task 4 — `resubmit` : corps optionnel et validation de la catégorie

**Fichiers :**
- Modifier : `src/app/api/account/registrations/[id]/resubmit/route.ts`
- Modifier : `src/app/api/account/__tests__/registrations.test.ts`
  (`describe("POST /api/account/registrations/[id]/resubmit")`)

**Interfaces :**
- Consumes : `z` (`zod`), `prisma.category.findFirst`.
- Produces (dans la route, non exporté) :

```ts
const bodySchema = z.object({ categoryId: z.string().min(1).optional() });
```

  Lecture du corps juste après `requireAuth()` et `params` : `const text = await req.text()` ;
  si `text.trim() === ""` → `{}` ; sinon `JSON.parse` dans un `try` (échec → 400). Puis
  `bodySchema.safeParse` (échec → 400). Réponse d'erreur commune :
  `{ code: "INVALID_BODY", error: "Données invalides." }`, statut 400 (même libellé que
  `register`).

  Le `select` de l'inscription ajoute `categoryId: true`,
  `category: { select: { id: true, name: true } }` et `event: { select: { date: true } }`.
  Après les contrôles 404 / 403 / 409 existants : si `categoryId` est fourni **et**
  différent de `registration.categoryId`, chercher
  `prisma.category.findFirst({ where: { id: categoryId, eventId: registration.eventId }, select: { id: true, name: true, number: true } })` ;
  `null` → 400 `{ code: "INVALID_CATEGORY", error: "Cette catégorie n'appartient pas à l'évènement." }`.
  La catégorie trouvée (`targetCategory`) sert à la Task 5 ; dans cette tâche, la route
  continue sinon comme aujourd'hui.

- [ ] **Écrire les tests** (helpers existants du fichier : `createCompleteUser`,
  `seedEventBundle`, `createRegistration`, `withSession`). Pour envoyer un corps :
  `new NextRequest(url, { method: "POST", body: JSON.stringify({ categoryId }), headers: { "content-type": "application/json" } })`.
  - `it("returns 400 INVALID_CATEGORY for a category of another event, without changes")` :
    deuxième bundle `seedEventBundle("…-other")`, POST avec sa catégorie → 400,
    `code === "INVALID_CATEGORY"`, l'inscription garde son ID, `categoryId` et
    `status === "REJECTED"`, `sendRegistrationResubmitted` non appelé.
  - `it("returns 400 INVALID_CATEGORY when the target category was deleted")` (vigilance 2) :
    créer une catégorie `number: 2` sur l'évènement, la supprimer, POST avec son id → 400
    `INVALID_CATEGORY`, rien de modifié.
  - `it("returns 400 INVALID_BODY on malformed JSON")` (vigilance 3) : `body: "{"` → 400
    `INVALID_BODY`, statut toujours `REJECTED`.
  - `it("returns 400 INVALID_BODY when categoryId is not a non-empty string")` :
    `{ categoryId: 42 }` puis `{ categoryId: "" }` → 400 `INVALID_BODY`.
  - `it("accepts an empty body and an empty object")` : `body: ""` → 200 ; sur une seconde
    inscription rejetée, `body: "{}"` → 200 ; ID et catégorie inchangés.
  - `it("returns 409 INVALID_STATE for a PENDING registration even with a categoryId")` :
    inscription `PENDING`, POST avec une autre catégorie du même évènement → 409, catégorie
    inchangée.
- [ ] **Lancer** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/app/api/account/__tests__/registrations.test.ts'`
  → échec attendu : les cas 400 renvoient 200 (le corps est ignoré aujourd'hui).
- [ ] **Implémenter** la lecture du corps, le schéma et le contrôle `INVALID_CATEGORY`.
- [ ] **Relancer** → vert (tests existants compris).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(account): la resoumission accepte une categorie du meme evenement`.

## Task 5 — `resubmit` : changement de catégorie et d'ID en transaction

**Fichiers :**
- Modifier : `src/app/api/account/registrations/[id]/resubmit/route.ts`
- Modifier : `src/app/api/account/__tests__/registrations.test.ts`

**Interfaces :**
- Consumes : `allocateRegistrationId(tx, { eventId, eventDate, categoryId, categoryNumber })`
  (Task 1) ; `sendRegistrationResubmitted(id, options?)` (Task 3) ; `logActivity` ;
  `targetCategory` (Task 4).
- Produces : réponse `200 { ok: true, id: string }`, où `id` est le nouvel ID si la
  catégorie a changé, sinon l'ID inchangé. Codes d'erreur ajoutés : 409 `INVALID_STATE`
  si l'inscription n'est plus `REJECTED` au moment de l'écriture.

Déroulé à implémenter, après les contrôles de profil existants :

1. `const { newId, count } = await prisma.$transaction(async (tx) => { … })` :
   - `newId = targetCategory ? await allocateRegistrationId(tx, { eventId: registration.eventId, eventDate: registration.event.date, categoryId: targetCategory.id, categoryNumber: targetCategory.number }) : registration.id` ;
   - `tx.registration.updateMany({ where: { id: registration.id, status: "REJECTED" }, data: { ...snapshot, status: "PENDING", rejectionReason: null, rejectionDetails: null, ...(targetCategory ? { id: newId, categoryId: targetCategory.id } : {}) } })`.
     Une seule écriture : changer `id` est permis (aucune FK ne référence
     `Registration.id`, vérifié dans `prisma/schema.prisma`). `updateMany` accepte `id`
     et `categoryId` (entrée « unchecked ») : `make typecheck` le confirme.
   - Commentaire dans la transaction : le chantier 24 y ajoutera
     `rewriteNotificationLinks(registration.id, newId, tx)`.
2. `count === 0` → 409 `{ code: "INVALID_STATE", error: "Seules les inscriptions rejetées peuvent être resoumises." }`
   (même message que le contrôle initial).
3. Après la transaction (contrat C1 : `send*` sans `tx`) :
   `targetCategory ? sendRegistrationResubmitted(newId, { previousCategoryName: registration.category.name }) : sendRegistrationResubmitted(newId)`.
4. `logActivity({ type: "REGISTRATION_RESUBMITTED", userId, targetId: newId, eventId, req, details })`,
   `details` uniquement si la catégorie a changé :

```ts
{
  categoryChanged: {
    from: { id: registration.category.id, name: registration.category.name },
    to: { id: targetCategory.id, name: targetCategory.name },
  },
  idChanged: { from: registration.id, to: newId },
  // Lu par extractDiff() pour l'affichage avant/après du journal d'activité.
  changes: {
    "Catégorie": { from: registration.category.name, to: targetCategory.name },
    "Identifiant": { from: registration.id, to: newId },
  },
}
```

5. `return NextResponse.json({ ok: true, id: newId })`.

- [ ] **Écrire les tests** :
  - `it("changes the category, regenerates the id and sets PENDING in the new category")` :
    catégories `number: 1` (« Presse ») et `number: 2` (« Exposant ») ; inscription rejetée
    `"REG-CAT-OLD"` en « Presse » ; POST `{ categoryId: exposant.id }` → 200,
    `json.id !== "REG-CAT-OLD"`, `json.id[0] === "2"`, `json.id[9] === "2"` ;
    `findUnique({ where: { id: "REG-CAT-OLD" } })` → `null` ; `findUnique({ where: { id: json.id } })`
    → `status === "PENDING"`, `categoryId === exposant.id`, `rejectionReason === null`,
    snapshot réaligné sur le profil.
  - `it("logs old and new category and ids in details")` : log
    `REGISTRATION_RESUBMITTED` avec `targetId === json.id` ; `details.categoryChanged`
    égal à `{ from: { id: presse.id, name: "Presse" }, to: { id: exposant.id, name: "Exposant" } }` ;
    `details.idChanged` égal à `{ from: "REG-CAT-OLD", to: json.id }` ; `extractDiff(details)`
    (`@/lib/activity-labels`) contient la ligne `{ field: "Catégorie", from: "Presse", to: "Exposant" }`.
  - `it("sends the resubmitted mail with the new id and the previous category")` :
    `sendRegistrationResubmitted` appelé avec `(json.id, { previousCategoryName: "Presse" })`.
  - `it("keeps the id and logs no details when categoryId equals the current category")` :
    POST `{ categoryId: registration.categoryId }` → 200, `json.id === reg.id`, log sans
    `details`, mail appelé avec `(reg.id)` seul.
  - Test existant « success: … » : ajouter `expect(json.id).toBe(reg.id)`.
  - `it("concurrent resubmissions: one succeeds, the other gets 409")` (vigilance 1) :
    `Promise.all` de deux POST `{ categoryId: exposant.id }` sur la même inscription →
    statuts triés `[200, 409]` ; `registration.count({ where: { userId, eventId } }) === 1` ;
    un seul log `REGISTRATION_RESUBMITTED` pour l'évènement ; mail appelé une fois.
  - `it("rolls back and rethrows when every generated id collides")` (vigilance 4) : mock
    partiel de `@/lib/generate-id` en tête de fichier (même forme que
    `register-event.test.ts`, implémentation réelle par défaut) ; une inscription d'un
    autre participant occupe `"TAKEN-ID"` ; `generateId` renvoie toujours `"TAKEN-ID"` →
    `POST` rejette (erreur Prisma `P2002`) ; l'inscription d'origine garde son ID, sa
    catégorie, `status === "REJECTED"` et son ancien snapshot ; ni mail ni log.
    Restaurer `generateId` (`mockReset` + implémentation réelle) en `afterEach`.
  - Test existant « rethrows a non-AuthError raised while persisting the resubmission » :
    remplacer l'espion sur `prisma.registration.update` par
    `vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom-resubmit"))`.
- [ ] **Lancer** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/app/api/account/__tests__/registrations.test.ts'`
  → échec attendu : pas de `json.id`, catégorie et ID inchangés, second POST concurrent en 500.
- [ ] **Implémenter** le déroulé ci-dessus.
- [ ] **Relancer** → vert. Puis `make typecheck`.
- [ ] **Couverture** : `make test-coverage` → `resubmit/route.ts` et
  `src/lib/registration-id.ts` à 100 % (lignes, branches, fonctions). Une branche non
  couverte = un test manquant, pas une exclusion.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(account): changement de categorie et nouvel ID a la resoumission`.

## Task 6 — Sélecteur de catégorie et redirection

**Fichiers :**
- Modifier : `src/app/account/registrations/[id]/page.tsx`
- Modifier : `src/app/account/registrations/[id]/ResubmitButton.tsx`
- Créer : `src/app/account/registrations/[id]/__tests__/ResubmitButton.test.tsx`

**Interfaces :**
- Consumes : `RadioCards` (`src/components/ui/RadioCards.tsx`, props `name`, `options: { value, title, color? }[]`, `value`, `onChange`) ;
  `Button` avec `loading` et `useAsyncAction` (`src/hooks/useAsyncAction.ts`), tels que
  livrés par le socle (C4) ; `useRouter` (`next/navigation`).
- Produces :

```tsx
export type ResubmitCategory = { id: string; name: string; color: string };

export default function ResubmitButton(props: {
  registrationId: string;
  currentCategoryId: string;
  categories: ResubmitCategory[];
}): JSX.Element;
```

**Page (`page.tsx`, Server Component) :** le `select` ajoute `categoryId: true` et, dans
`event`, `categories: { select: { id: true, name: true, color: true }, orderBy: { number: "asc" } }`.
Le bloc `REJECTED` garde l'`Alert` du motif en premier. Le paragraphe devient : « Vous
pouvez corriger les informations de votre profil ou choisir une autre catégorie, puis
resoumettre votre inscription. Le snapshot soumis sera réécrit avec les valeurs actuelles
de votre profil. » Le lien « Modifier mon profil » reste. `ResubmitButton` reçoit
`registrationId`, `currentCategoryId={registration.categoryId}` et
`categories={registration.event.categories}`. Ne pas toucher au bloc cover (spec 26).

**Composant (`ResubmitButton.tsx`) :**
- État `selected`, initialisé à `currentCategoryId`.
- Au-dessus du bouton : libellé « Catégorie » puis `RadioCards name="Catégorie"` avec
  `options = categories.map(c => ({ value: c.id, title: c.name, color: c.color }))`.
- Si `selected !== currentCategoryId` : `<p>` « Votre inscription sera resoumise dans la
  catégorie <em>{nom}</em>. »
- Action passée à `useAsyncAction` : `fetch` POST ; corps `JSON.stringify({ categoryId: selected })`
  et en-tête `content-type: application/json` **seulement** si la catégorie a changé, sinon
  aucun corps. Si `!res.ok`, lever l'erreur dans la forme attendue par `useAsyncAction`
  pour que `toastApiError` lise le champ `error` (à vérifier dans le code du socle
  fusionné). Sinon, renvoyer `(await res.json()).id`.
- Options : `success: "Inscription resoumise."`, `error: "Resoumission impossible."`,
  `onSuccess: (id) => id !== registrationId ? router.replace(\`/account/registrations/${encodeURIComponent(id)}\`) : router.refresh()`.
- Bouton `Button loading={pending} onClick={run}`, libellé inchangé
  « Resoumettre mon inscription » (les E2E existants le ciblent).

- [ ] **Écrire les tests** (rendu statique `renderToStaticMarkup`, comme
  `src/components/badge/__tests__/BadgePrintActions.test.tsx` ; mocker `next/navigation`
  avec `useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() })`) :
  - `it("renders one radio per category with the current one checked")` : 3 catégories →
    3 `role="radio"`, un seul `aria-checked="true"`, celui de `currentCategoryId`, et les
    3 noms présents.
  - `it("shows no help text while the current category is selected")` : le HTML ne
    contient pas `sera resoumise dans la catégorie`.
  - `it("keeps the resubmit label")` : contient `Resoumettre mon inscription`.
- [ ] **Lancer** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run 'src/app/account/registrations/[id]/__tests__/ResubmitButton.test.tsx'`
  → échec attendu : aucun `role="radio"` rendu.
- [ ] **Implémenter** la page et le composant.
- [ ] **Relancer** → vert ; `make lint && make typecheck`.
- [ ] **Navigateur** (`make db-seed` d'abord) : avec un participant dont l'inscription est
  rejetée sur un évènement à deux catégories ou plus, à 375 px et à 1280 px. Vérifier le
  motif au-dessus, la catégorie actuelle cochée, le texte d'aide quand on change,
  l'absence de débordement horizontal à 375 px (`document.documentElement.scrollWidth === innerWidth`),
  le loader et le toast au clic, et l'atterrissage sur la nouvelle URL.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(account): choix de la categorie a la resoumission d'une inscription rejetee`.

## Task 7 — E2E rejet → changement de catégorie → resoumission

**Fichiers :**
- Modifier : `e2e/public/account-registration.spec.ts` (nouveau test dans le
  `test.describe("Account resubmit after rejection")` existant)

**Interfaces :**
- Consumes : `createTestUser`, `createTestEvent` (catégorie « Visiteur », `number: 1`),
  `createTestCategory({ eventId, name, number: 2 })`, `createTestRegistration`,
  `rejectRegistration`, `getLatestRegistrationForUser`, `getDb` (`e2e/helpers/db.ts`) ;
  `loginAs` (`e2e/helpers/auth.ts`) ; `mailpit` (`e2e/helpers/mailpit.ts`) ;
  `expectLastActivity` (`e2e/helpers/audit.ts`).
- Produces : test `"le participant change de catégorie en resoumettant une inscription rejetée"`.

- [ ] **Écrire le test** :
  1. Utilisateur `scope: "resubmit-cat"` avec profil ; évènement ; catégorie
     `Exposant-<horodatage>` `number: 2` ; inscription `PENDING` en « Visiteur » ;
     `rejectRegistration(regId, "Mauvaise catégorie")` ; `mailpit.clear()`.
  2. `loginAs`, `goto(/account/registrations/${regId})` ; `getByText(/mauvaise catégorie/i)`
     visible ; `getByRole("radio", { name: /Visiteur/ })` a `aria-checked="true"`.
  3. Clic sur `getByRole("radio", { name: /Exposant/ })` → `getByText(/sera resoumise dans la catégorie/i)` visible.
  4. Clic sur `getByRole("button", { name: /resoumettre mon inscription/i })` →
     `await page.waitForURL((u) => u.pathname.startsWith("/account/registrations/") && !u.pathname.endsWith(regId))`.
  5. BDD : `getLatestRegistrationForUser(user.id)` → `status === "PENDING"`, `id !== regId`,
     `id[0] === "2"` ; `getDb().registration.findUnique({ where: { id: regId } })` → `null` ;
     sa catégorie est `Exposant-…`.
  6. La page affiche le nom `Exposant-…` dans « Catégorie » et le statut en attente.
  7. Vigilance 5 : `const resp = await page.goto(/account/registrations/${regId})` →
     `expect(resp?.status()).toBe(404)` (le projet n'a pas de `not-found.tsx` : page 404
     par défaut de Next.js).
  8. `expectLastActivity({ type: "REGISTRATION_RESUBMITTED", userId: user.id, eventId, targetId: newId })`.
  9. `mailpit.expectMail({ to: user.email, subjectPattern: /resoumise/i, bodyPattern: /Exposant-/, timeoutMs: 8000 })`
     (voir la vigilance sur le worker de la spec 23).
- [ ] **Lancer** (`make db-seed` d'abord) : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test 'e2e/public/account-registration.spec.ts'`
  → vert, tests existants du fichier compris (ils resoumettent sans changer de
  catégorie : l'ID reste le même).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `test(e2e): parcours de changement de categorie a la resoumission`.

## Task 8 — Rejet refusé quand le badge est imprimé

Décision utilisateur du 2026-10-24 (spec 25, « Rejet interdit après impression du
badge ») : une inscription `badgePrinted = true` ne peut plus être rejetée.

**Fichiers :**
- Modifier : `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route.ts`
  (après le contrôle `NOT_FOUND`, avant la lecture du motif)
- Modifier : le composant client qui affiche le bouton « Rejeter » d'une inscription
  côté évènement (le repérer depuis `e2e/event/registration-detail.spec.ts` et
  `src/app/event/[eventId]/registrations/`)
- Test : `src/lib/__tests__/api-event-registrations.test.ts` (suivre ses fixtures)

**Interfaces :**
- Consumes : rien des tâches précédentes.
- Produces : réponse `409 { error: "BADGE_ALREADY_PRINTED" }` de la route `reject`
  (même forme que les autres erreurs de cette route).

- [ ] Ajouter au fichier de test :
  - `it("refuse de rejeter une inscription dont le badge est imprimé")` : inscription
    `APPROVED`, `badgePrinted: true` → `status` 409, `json.error === "BADGE_ALREADY_PRINTED"`,
    et en base `status` reste `APPROVED`, `rejectionReason` reste `null`, aucun
    `ActivityLog` `REGISTRATION_REJECTED` créé.
  - `it("rejette toujours une inscription approuvée non imprimée")` → 200, `status` `REJECTED`.
- [ ] Lancer le fichier → le premier test échoue (200 au lieu de 409).
- [ ] Ajouter la garde dans la route : `if (existing.badgePrinted) return NextResponse.json({ error: "BADGE_ALREADY_PRINTED" }, { status: 409 });`.
- [ ] Relancer → verts ; couverture 100 % de la route tenue.
- [ ] Interface : le bouton « Rejeter » n'est pas rendu quand `badgePrinted` est vrai ;
  un texte d'aide le remplace : « Badge imprimé : cette inscription ne peut plus être
  rejetée. ». Ajouter au test E2E de la Task 7 (ou à `e2e/event/registration-detail.spec.ts`)
  `test("le rejet n'est pas proposé pour un badge imprimé")`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `fix(inscriptions): interdit le rejet d'une inscription dont le badge est imprime`.

## Task 9 — Documentation

**Fichiers :**
- Créer : `docs/v4/features/inscriptions-resoumission.md`
- Modifier : `docs/v4/README.md`

- [ ] **Fiche feature** (français avec accents) : parcours participant (sélecteur, texte
  d'aide, redirection), contrat de `POST /api/account/registrations/[id]/resubmit` (corps
  optionnel, codes `INVALID_BODY` 400, `INVALID_CATEGORY` 400, `INVALID_STATE` 409,
  `PROFILE_INCOMPLETE` 400, `PROFILE_NOT_SUBMITTED` 403, réponse `{ ok, id }`), règle de
  régénération de l'ID (`allocateRegistrationId`, position du chiffre de catégorie :
  1er et 10e caractères), forme de `details` du log, conséquence sur les URL et les
  entrées d'`ActivityLog` antérieures (ancien `targetId` conservé), renvoi vers la spec 24
  pour `rewriteNotificationLinks`.
- [ ] **README v4** : sous « Plans à implémenter », ajouter
  « Spec 25 — Changer la catégorie d'une inscription rejetée · Plan · Feature », dans le
  format des entrées existantes ; sous « Références », ajouter la fiche.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `docs(v4): fiche resoumission avec changement de categorie`.

## Vérification finale

- [ ] `make lint` → 0 erreur, 0 avertissement.
- [ ] `make typecheck` → OK.
- [ ] `make test` → vert ; `make test-coverage` → seuils 100 % respectés.
- [ ] `make db-seed`, puis `make test-e2e` → vert (le fichier
  `e2e/public/account-registration.spec.ts` complet et le reste de la suite).
- [ ] Navigateur à 375 px et à 1280 px : parcours de la Task 6 de bout en bout, plus la
  vue organisateur (`/event/<eventId>/registrations/<nouvelId>`) qui montre l'inscription
  en attente dans la nouvelle catégorie.
- [ ] Mettre à jour la ligne « Vérification finale » du tracker avec les chiffres obtenus.

## Self-review

- **Couverture de la spec** : corps optionnel (T4), `INVALID_CATEGORY` (T4), 409
  inchangé (T4), transaction unique (T5), `details.categoryChanged` (T5), email avec
  nouvelle catégorie (T3), régénération de l'ID par un helper partagé (T1, T2, T5),
  réponse avec le nouvel ID et redirection (T5, T6), `RadioCards` pré-rempli, motif
  au-dessus, texte d'aide et loader/toast C4 (T6), historique ancien/nouveau (T5, T8),
  couverture 100 % (T5) et E2E (T7). `rewriteNotificationLinks` explicitement laissé au
  chantier 24.
- **Cohérence des noms** : `allocateRegistrationId` / `AllocateRegistrationIdArgs`
  (T1, T2, T5) ; `previousCategoryName` (T3, T5) ; `ResubmitCategory`,
  `currentCategoryId` (T6) ; codes `INVALID_BODY`, `INVALID_CATEGORY`, `INVALID_STATE`
  (T4, T5, T8).
- **Proportion** : 8 tâches, dont 2 de pur refactor ou de doc ; pas de modification du
  schéma ni de la route staff.
