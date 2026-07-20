# Fidelite UI des tests E2E — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal:** Rendre les specs Playwright **fideles au parcours utilisateur reel** : un test UI ne tape **jamais** l'API, il declenche chaque action **via l'interface**, traverse le vrai parcours de connexion (`/select` inclus quand l'utilisateur a plusieurs espaces), et **verifie l'URL a chaque etape**. Les gardes 403/erreur actuellement testees en `page.request` sont retirees des specs UI (deja couvertes en integration Vitest) ; les actions metier sans controle UI recoivent d'abord ce controle.

**A executer APRES** le plan [`2026-07-20-03-v4-e2e-reorg-par-page.md`](2026-07-20-03-v4-e2e-reorg-par-page.md) (il raffine les specs par page produites par la reorganisation).

**Architecture:** Trois leviers. (1) Un **contrat « test UI »** strict + un **helper de parcours** (`loginAndEnter`) qui reproduit login -> `/select` (si multi-espaces) -> clic de la carte -> atterrissage, avec verification d'URL. (2) **Deux controles UI manquants** ajoutes cote produit (archive/restore d'un event ; changement de role d'un membre org) pour que ces actions soient declenchables via l'UI. (3) Un **catalogue par fichier** (issu de l'audit des 4 espaces) qui indique, test par test : convertir en UI, retirer (garde couverte Vitest), ou completer (URL + parcours).

**Tech Stack:** Playwright (chromium conteneur + mode UI hote), Prisma 6 (seed via `e2e/helpers/db.ts`), Mailpit, Vitest 4 (integration API — pour combler les gaps avant retrait), React 19 (controles UI a ajouter).

## Global Constraints — Contrat « test UI »

1. **ZERO `page.request.*` dans une spec E2E.** Toute action testee passe par l'UI : `click`, `fill`, `check`, `selectOption`, `setInputFiles`, `getByRole("button")`… Le seed des **pre-conditions** via `e2e/helpers/db.ts` reste autorise ; les **assertions** via lecture DB (`getDb().findUnique`), Mailpit (`mailpit.expectMail`) et audit (`expectLastActivity`) restent autorisees.
2. **Parcours de connexion complet.** Apres login : si l'utilisateur a **≥2 espaces** (ex. `makeEventAdminUser` = OWNER org + ADMIN event), il atterrit sur `/select` et le test **doit cliquer la carte** du bon espace ; s'il a **1 seul** espace, la redirection automatique s'applique. Dans les deux cas, **asserter l'URL d'atterrissage**.
3. **Verifier l'URL a chaque etape.** Apres chaque `goto`, navigation ou action qui change de page : `await expect(page).toHaveURL(<regex>)` (ou `waitForURL`). Une page 404 attendue s'assert via son **rendu** (contenu), pas via `res.status()`.
4. **Naviguer via la nav du shell** quand c'est le parcours reel (liens de `OrgShell`/`EventShell`/`StaffShell`), plutot que par deep-link `goto`, chaque fois que la page de depart le permet.
5. **Chaque action assert sa REPONSE attendue — succes ET echec.** Une action n'est jamais « testee » par son simple declenchement : le test doit asserter le **resultat observable dans l'UI**.
   - **Succes** : feedback UI (toast/message « Enregistre », ligne ajoutee/retiree, tag mis a jour, redirection vers la page attendue) **+** l'effet persistant (DB / Mailpit / audit).
   - **Echec attendu** : le **message d'erreur affiche dans l'UI** (ex. « Ce nom existe deja », « Impossible : dernier OWNER », « Adresse deja utilisee », « Inscriptions completes »), **et** l'absence d'effet (rien cree/modifie en DB). Chaque formulaire/action ayant un cas d'echec metier doit avoir un test qui **declenche cet echec via l'UI** et verifie le message.
6. **Gardes de role & erreurs → assertion UI quand elle est observable.** Si l'interdiction/l'erreur se **manifeste dans l'UI**, on la teste **via l'UI** : bouton/formulaire masque, entree de nav absente, **redirection**, ou **message d'erreur** apres soumission (cf. regle 5). Seuls les codes HTTP purs **non atteignables par l'UI** (403 sur un endpoint sans surface, garde d'un role qui ne voit meme pas la page) sont retires vers l'integration Vitest — jamais laisses en `page.request` dans une spec UI.
7. **Hors-perimetre UI (a conserver a part) :** tests de securite/anti-abus sans parcours UI — rate-limit (`429`), cookie de session efface/falsifie, log `BADGE_SCANNED` de l'endpoint public de scan. Ils restent dans `e2e/transverse/securite.spec.ts` (ou l'integration Vitest), **explicitement etiquetes hors « test UI »**.
8. **Langue** FR (accents) pour l'UI/intitules ; identifiants anglais ; commentaires FR ASCII. **Server Components par defaut** pour les controles UI ajoutes ; `"use client"` seulement si interactivite.
9. **Avant tout commit :** `make lint && make typecheck && make test` (+ run E2E cible). Commits FR ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur.** Regenerer le client Prisma hote apres tout changement de schema.
10. **Ne jamais modifier `src/` pour faire passer un test.** Les controles UI ajoutes (Task 0.2) sont des **features** volontaires, pas des rustines ; le `test.fixme` du bug `RegistrationTable` (mapping snapshot) reste ouvert.

## Definition of Done d'une spec UI

Une spec est conforme quand : (a) **aucun** `page.request` ; (b) chaque test traverse le vrai parcours (login -> select si multi -> page) avec **URL assertee** a chaque transition ; (c) chaque action est declenchee via l'UI ; (d) **chaque action assert sa reponse attendue** — succes (feedback UI + effet DB/mail/audit) ou echec (message d'erreur UI + absence d'effet) ; (e) les gardes de role sont des **assertions UI** (bouton masque / redirection / message), les 403 non observables etant deportes en Vitest ; (f) aucun `test.skip`/`fixme` non justifie par un bug reference.

> **Consequence sur les catalogues ci-dessous** : les erreurs metier qui **s'affichent dans l'UI** (ex. `NAME_TAKEN`, `EMAIL_TAKEN`, `LAST_OWNER`, `EMAIL_BLOCKED`, `DOCUMENT_BLOCKED`, `PARTICIPANT_LIMIT`, rejet sans motif) ne sont **pas** de simples « gardes a retirer » : elles deviennent des **tests d'echec UI** (declencher via le formulaire, asserter le message). Seules les erreurs **sans surface UI** (403 d'un role qui ne voit pas la page, validation d'un champ non expose, scoping cross-org) partent en Vitest.

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 0.1 | Contrat + helper `loginAndEnter` + page de reference | [x] | 2026-07-20 | `e2e/helpers/nav.ts` (`loginAndEnter` : `/select` si multi-espaces, clic de la carte, URL assertee) ; contrat strict dans `e2e/README.md` ; `badges.spec.ts` recode en reference (batch de 3 en parcours UI complet + reponse succes UI/DB/audit), doublon de marquage retire. Verify : 9 passed. NB : `next-env.d.ts` importe `.next/dev/types/routes.d.ts`, ce qui contourne l'`exclude` du tsconfig — si le dev server corrompt cet artefact, le supprimer avant `make typecheck`. |
| 0.2 | Controles UI manquants (archive/restore event, role membre org) | [x] | 2026-07-20 | (A) `EventArchiveActions` : boutons Archiver/Restaurer par ligne sur `/org/[orgId]/events`, masques hors MANAGER+ (garde = etat UI). (B) selecteur de role inline dans `MembersClient`, rendu seulement pour un OWNER, erreur `LAST_OWNER` affichee. Tests UI ajoutes en remplacement des versions API : archive/restore via boutons, changement de role, et **echec** « dernier OWNER » (message + role inchange). Verify : 32 passed (org/members, org/events, event/badges). Helper `loginAndEnter` durci : la redirection auto mono-espace est detectee par timeout au lieu du heading. |
| 0.3 | Combler les gaps d'integration Vitest (avant retrait des gardes) | [x] | 2026-07-20 | Gaps reels combles : `PUT subscription` (STAFF_OBSERVER 403 + `PLAN_NOT_FOUND` 404), `scan/verify` (VIEWER 403, PRINTER 403), `registrations/export` (OPERATOR 403), `checkin` (VIEWER 403). Verification faite avant ecriture : `registrations/print` PENDING (deja couvert par `api-event-badges.test.ts` « ignores non-APPROVED silently ») et `duplicates` (deja couvert par `duplicates.test.ts` + `api-event-registrations`) n'etaient PAS des gaps. Verify : `make test` 1260 passed. |
| 1 | org : convertir / retirer / URL (8 fichiers) | [x] | 2026-07-20 | 8 fichiers : **0 page.request**. Conversions : templates (MANAGER via modale + garde AUDITOR en nav absente), members (invitation masquee hors OWNER, change-role via select, echec dernier OWNER), settings (retour heritage via bouton, MANAGER badge via picker), events (echecs metier via wizard : EVENT_LIMIT message + abonnement inactif = espace bloque + AUDITOR creation echoue). Gardes API pures retirees (couvertes en integration). SLUG_TAKEN non provocable par l'UI (slug auto-suggere) -> reste en integration. Bug d'infra corrige : PlatformSettings.smtp corrompu par un run interrompu -> restaure (mailpit:1025). Verify : org complet 60 passed. |
| 2 | event : convertir / retirer / URL (13 fichiers) | [x] | 2026-07-20 | 13 fichiers **0 page.request**. Conversions UI : badges (impression batch/individuelle), registration-detail (mails approve/reject via boutons), scan/categories deja doublons retires. Gardes API retirees (couvertes integration) ; cas « reapprouver une REJETEE » sans surface UI -> ajoute en integration (api-event-registrations). Parcours complet : `loginAndEnter` (/select si multi-espaces via makeEventAdminUser, redirect auto pour roles event-only) + `toHaveURL` a chaque etape. Seul `loginAs` restant = test « outsider sans espace » (aucun workspace, /select N/A). Verify par fichier (flakes de charge absorbes en run isole) : access/scan/categories/blocklist 16, reg-new/settings/members 13, badges/dashboard 13, registrations 8+1skip, registration-detail 10, activity 3, overview 6. |
| 3 | platform : convertir / retirer / URL (15 fichiers) | [x] | 2026-07-20 | 15 fichiers **0 page.request**. Retire ~25 gardes 403/409/validation (couvertes integration + gaps combles Task 0.3) ; convertit NAME_TAKEN (plans) et Test SMTP (settings) en tests UI ; conserve les nombreux tests deja conformes (archive/restore/suppression via boutons, invitations, filtres via navigation). Verify par lot : activity 7, access/orgs 24, org-new/plans/user-new 7, settings 5. |
| 4 | public / transverse : convertir / retirer / securite (12 fichiers) | [x] | 2026-07-20 | Toutes les specs UI **0 page.request**. Conversions UI : resubmit (account-registration), anti-enumeration (password-reset via formulaire), e-mail bloque (event-register -> echec formulaire). Retraits vers integration : 403/404/409 resubmit, log BADGE_SCANNED, rate-limit 429 register/forgot, participant-limit, document bloque, /api/files (restitution). `e2e/transverse/security.spec.ts` conserve les tests de securite hors-perimetre (cookie efface/falsifie). Verify : account-registration 4, badge-verify/register/account-profile 18, password-reset 5, event-register 7. |
| 5 | Verification globale + doc | [ ] | | |

---

## Task 0.1 : Contrat, helper de parcours, page de reference

**Files:** Create `e2e/helpers/nav.ts` ; Modify `e2e/README.md` ; Reference `e2e/event/badges.spec.ts` (page recodee).

**Interfaces (produces):**
```ts
// e2e/helpers/nav.ts
import { Page, expect } from "@playwright/test";
import { loginAs } from "./auth";

type Workspace =
  | { kind: "org"; id: string }
  | { kind: "event"; id: string }
  | { kind: "platform" };

// Login via le formulaire, puis atterrissage sur l'espace attendu :
// - multi-espaces (>=2) -> /select puis clic de la carte -> URL cible.
// - un seul espace -> redirection auto -> URL cible.
// Verifie l'URL a chaque etape.
export async function loginAndEnter(
  page: Page,
  user: { email: string; password: string },
  ws: Workspace,
): Promise<void> {
  await loginAs(page, user); // remplit /login, soumet, sort de /login
  const target =
    ws.kind === "platform" ? "/platform" : `/${ws.kind}/${ws.id}`;
  if (/\/select$/.test(new URL(page.url()).pathname)) {
    await expect(page).toHaveURL(/\/select$/);
    // La carte /select est un lien href vers l'espace.
    await page.getByRole("link", { name: new RegExp(ws.kind === "platform" ? "plateforme|staff" : ".") })
      .filter({ has: page.locator(`[href="${target}"], [href^="${target}"]`) })
      .first()
      .click();
  }
  await page.waitForURL(new RegExp(`${target.replace(/[/]/g, "\\/")}(\\/|$)`));
  await expect(page).toHaveURL(new RegExp(target.replace(/[/]/g, "\\/")));
}
```
> Ajuster le selecteur de carte a la structure reelle de `src/app/select/page.tsx` (liens vers `/org/[id]` / `/event/[id]` / `/platform`). Un `data-testid="workspace-<kind>-<id>"` sur chaque carte simplifierait le helper — l'ajouter cote page si besoin (petite modif `src/app/select/page.tsx`, autorisee).

- [x] **Step 1 : Ecrire `e2e/helpers/nav.ts`** (helper ci-dessus).
- [x] **Step 2 : Documenter le contrat** dans `e2e/README.md` (les 9 regles + la DoD).
- [x] **Step 3 : Recoder `e2e/event/badges.spec.ts` comme PAGE DE REFERENCE** — convertir l'impression batch en parcours UI complet :

```ts
test("ADMIN imprime un batch de 3 badges (parcours UI)", async ({ page }) => {
  const { orgId, eventId, categoryId } = await createTestEvent({ scope: "print-batch" });
  const admin = await makeEventAdminUser({ scope: "print-batch", eventId, orgId }); // OWNER org + ADMIN event -> 2 espaces
  const regs = [];
  for (let i = 0; i < 3; i++) {
    const p = await createTestUser({ scope: `pb-p${i}`, verified: true, profile: true });
    regs.push(await createTestRegistration({ eventId, userId: p.id, categoryId, status: "APPROVED" }));
  }

  // Parcours : login -> /select -> carte event -> dashboard event
  await loginAndEnter(page, admin, { kind: "event", id: eventId });

  // Nav du shell vers Badges (pas de deep-link)
  await page.getByRole("link", { name: /badges/i }).click();
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}/badges`));

  // Cocher les 3 lignes (filtre "non imprimes" par defaut) + action UI
  for (const r of regs) {
    await page.getByRole("row", { name: new RegExp(r.id) }).getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: /marquer imprim/i }).click();

  // Reponse attendue — SUCCES :
  // (a) feedback UI : le filtre par defaut "non imprimes" ne montre plus ces lignes
  for (const r of regs) {
    await expect(page.getByRole("row", { name: new RegExp(r.id) })).toHaveCount(0);
  }
  // (b) effet persistant : DB + audit
  await expect(async () => {
    const n = await getDb().registration.count({ where: { id: { in: regs.map((r) => r.id) }, badgePrinted: true } });
    expect(n).toBe(3);
  }).toPass();
  await expectLastActivity({ type: "BADGE_BATCH_PRINTED", userId: admin.id, eventId });
});

// Exemple de test d'ECHEC via l'UI (regle 5) — a decliner partout ou un echec
// metier a une surface UI. Ici : retrograder le dernier OWNER d'une org.
test("Retrograder le dernier OWNER affiche une erreur (parcours UI)", async ({ page }) => {
  const { orgId, owner } = await createTestOrgWithOwner({ scope: "last-owner" });
  await loginAndEnter(page, owner, { kind: "org", id: orgId });
  await page.getByRole("link", { name: /membres/i }).click();
  await expect(page).toHaveURL(new RegExp(`/org/${orgId}/members`));
  // Tenter le changement de role via le select inline (Task 0.2.B)
  await page.getByRole("row", { name: new RegExp(owner.email) })
    .getByRole("combobox").selectOption("MANAGER");
  // Reponse attendue — ECHEC : message d'erreur affiche + role inchange en DB
  await expect(page.getByText(/dernier OWNER/i)).toBeVisible();
  const m = await getDb().orgMembership.findFirst({ where: { orgId, userId: owner.id } });
  expect(m?.role).toBe("OWNER");
});
```

- [x] **Step 4 : Lancer la reference.** Run (conteneur) : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/event/badges.spec.ts`. Ajuster les libelles reels (checkbox par ligne, bouton) SANS toucher `src/` (hors Task 0.2).
- [x] **Step 5 : Commit** (si demande) : `test(v4): contrat e2e UI + helper de parcours + reference badges`.

> Toutes les tasks suivantes appliquent ce gabarit. Pour chaque fichier : (a) convertir les tests « A CONVERTIR », (b) retirer les « GARDE API » (apres Task 0.3), (c) ajouter parcours `/select` + `toHaveURL` aux « MANQUE URL », (d) run vert, (e) commit si demande.

---

## Task 0.2 : Controles UI manquants (features)

Deux actions metier existent en API mais n'ont aucun controle UI ; on les ajoute pour pouvoir les tester en UI.

**A. Archiver / Restaurer un evenement** (depuis l'espace org).
- **Files:** Modify `src/app/org/[orgId]/events/page.tsx` (ou une page detail event dediee) + creer un petit client `EventArchiveActions.tsx`.
- Ajouter, par ligne d'evenement (ou sur la page settings de l'event), un bouton **« Archiver »** (event actif) / **« Restaurer »** (event archive) avec confirmation, appelant `POST /api/org/[orgId]/events/[eventId]/archive` | `/restore` (routes existantes), puis `router.refresh()`. Respecter le role : action reservee a MANAGER+ (les routes gardent deja).
- [x] Step A1 : ajouter le controle + cablage aux routes existantes.
- [x] Step A2 : verif navigateur (archiver -> tag « Archive » ; restaurer -> retour actif).

**B. Changer le role d'un membre org** (inline).
- **Files:** Modify `src/app/org/[orgId]/members/MembersClient.tsx`.
- Remplacer le `RoleBadge` en lecture seule par un `<select>` de role (OWNER/MANAGER/AUDITOR) pour les OWNERs connectes, appelant `PATCH /api/org/[orgId]/members/[userId]` (route existante) ; garder le badge en lecture seule pour les non-OWNER. Preserver le garde-fou dernier OWNER (deja API : 409 LAST_OWNER — l'UI doit afficher l'erreur).
- [x] Step B1 : selecteur de role inline + cablage + gestion d'erreur UI (message sur 409).
- [x] Step B2 : verif navigateur (changement de role OWNER->MANAGER reflete ; retrograder le dernier OWNER -> message d'erreur, pas de crash).

- [x] **Step 3 : lint + typecheck** apres A et B. Commit (si demande) : `feat(v4): controles UI archive/restore event + role membre org`.

> Ces deux controles debloquent les conversions : org `events.spec.ts:217` (archive/restore) et `members.spec.ts:169`/event `members.spec.ts:169` (change-role).

---

## Task 0.3 : Combler les gaps d'integration Vitest (avant tout retrait)

Certaines gardes retirees de l'E2E ne sont PAS encore couvertes en integration. Les ecrire d'abord (sinon perte de couverture). Chaque test : golden path deja existant, on ajoute le cas manquant.

- [x] **platform** — `PUT /api/platform/organizations/[orgId]/subscription` : ajouter `STAFF_OBSERVER -> 403` et `planId inexistant -> 404 PLAN_NOT_FOUND` (fichier `.../subscription/__tests__/route.test.ts`).
- [x] **event** — `registrations/print` : `PENDING ignore silencieusement` (creer `__tests__/route.test.ts` si absent).
- [x] **event** — `registrations/[regId]/checkin` : golden + `403` par role (creer `__tests__`).
- [x] **event** — `registrations/[regId]/duplicates` : golden (expose les doublons) + `403` (creer `__tests__`).
- [x] **event** — `registrations/export` : `OPERATOR -> 403` (ajouter au `__tests__` existant qui ne teste que le happy path).
- [x] **event** — `scan/verify` : `VIEWER -> 403` et `PRINTER -> 403` explicites (ajouter a `api-event-scan.test.ts`).
- [x] **Verify** : `make test` vert ; ces cas passent. Commit (si demande) : `test(v4): integration gardes manquantes (subscription/print/checkin/duplicates/export/scan)`.

---

## Phase 1 — Espace ORG (`e2e/org/`, 71 tests)

Pour chaque fichier, appliquer le catalogue (issu de l'audit). **Systemique a tous les fichiers :** ajouter `loginAndEnter` (users mono-org -> redirect auto vers `/org/[id]`, a asserter) + `toHaveURL` apres chaque `goto`/action ; naviguer via `OrgShell` quand possible.

| Fichier | A CONVERTIR (action -> UI) | GARDE A RETIRER (couvert Vitest) |
|---|---|---|
| access.spec.ts | L60 staff edite l'org **depuis `/platform/organizations/[id]`** (formulaire) | L107 (GET 200) |
| activity.spec.ts | — | L58 (GET 200) |
| dashboard.spec.ts | — (deja conforme) | — |
| subscription.spec.ts | — (deja conforme) | — |
| events.spec.ts | L217 archive/restore **via boutons** (Task 0.2.A) | L119, L136, L154, L173, L204 ; L183 -> garder la partie UI (wizard atteignable), retirer le POST 403 |
| members.spec.ts | L169 change-role **via select inline** (Task 0.2.B) | L138, L152, L188, L203, L218 (garder L126 : bouton masque = etat UI) |
| settings.spec.ts | L105 badge reset-null **via bouton « defaut herite »** ; L163 MANAGER badge **via UI** | L124, L134, L178 ; L145 -> garder partie UI (form visible MANAGER), retirer PATCH 403 |
| templates.spec.ts | L135 MANAGER cree **via modale UI** | L146, L157, L170 |

- [x] Task 1.x : traiter chaque fichier (convertir, retirer, ajouter URL/parcours), run vert par fichier, commit si demande.

---

## Phase 2 — Espace EVENT (`e2e/event/`, 116 tests) — le plus impacte

**Systemique :** `makeEventAdminUser` = 2 espaces -> `loginAndEnter(..., {kind:"event"})` (passe par `/select`) ; membres event-only -> redirect auto (a asserter). Naviguer via `EventShell`/shells de role.

| Fichier | A CONVERTIR (action -> UI) | GARDE A RETIRER |
|---|---|---|
| access.spec.ts | — (redirections a asserter) | L71, L86, L101, L116 |
| activity.spec.ts | — | L31, L62, L104, L129, L154 |
| badges.spec.ts | L91, L130 -> liste badges (cocher + « Marquer imprimes ») [reference Task 0.1] | L30, L53, L173(*), L203 |
| blocklist.spec.ts | — (L45/L87 deja UI, ajouter URL) | L133 |
| categories.spec.ts | L26/L63/L108/L131 = **doublons** des modales L187/215/238/258 -> retirer l'API, garder l'UI | L48, L157 |
| dashboard.spec.ts | — | — |
| members.spec.ts | L24, L80 invitation **via formulaire UI** ; L116 retrait **via bouton** | L192 |
| registration-detail.spec.ts | L291/L308 mails (chainer sur approve/reject UI L60/L80) ; L353 approuver une rejetee **via bouton** ; L368 doublons **affiches dans la page** | L179, L206, L217, L244, L323 |
| registrations-new.spec.ts | — | L106, L119 |
| registrations-overview.spec.ts | — (ajouter URL/parcours) | — |
| registrations.spec.ts | L154 export **via bouton + `waitForEvent("download")`** | L167(*) |
| scan.spec.ts | L24/L63 = doublons de la saisie manuelle L269/305 -> retirer l'API ; L103 PENDING **via saisie manuelle** | L143, L184, L212(*), L250, L345(*), L362(*) |
| settings.spec.ts | L24/L68 infos+contact **via formulaire** ; L103/L133 badge **via picker** (doublon L212) | L169 |

`(*)` = retirer **seulement apres** le gap Vitest correspondant (Task 0.3).

- [x] Task 2.x : traiter chaque fichier, run vert, commit si demande. — Fait 2026-07-20 (13 fichiers, 0 page.request, loginAndEnter + toHaveURL).

---

## Phase 3 — Espace PLATFORM (`e2e/platform/`, 105 tests)

**Systemique :** `loginAsStaff` -> `/platform` (staff = 1 cible platform, +eventuelles orgs ; verifier l'atterrissage) ; `toHaveURL` apres navigations.

| Fichier | A CONVERTIR | GARDE A RETIRER |
|---|---|---|
| access.spec.ts | — | L34, L51 |
| activity.spec.ts | L32 filtre type -> deja double par UI L182 (retirer) ; L59/L95 -> retirer (couvert Vitest) | L134 |
| dashboard.spec.ts | — | — |
| organization-detail.spec.ts | — (archive/restore/suppression **deja en boutons** — exemplaires) | L108, L120 (+ ajouter tests UI « bouton masque pour OBSERVER ») |
| organization-members.spec.ts | — (invitation deja UI) | L78, L100, L116, L127, L139 (table read-only : retrait = API-only -> Vitest) |
| organization-new.spec.ts | — | L74, L111 ; L99 -> garder « formulaire visible OBSERVER », retirer POST 403 |
| organization-subscription.spec.ts | — | L110(*), L121(*) |
| organization-supervision.spec.ts | — | — |
| organizations-list.spec.ts | — | — |
| plans.spec.ts | L94 NAME_TAKEN **via re-soumission du formulaire** (message d'erreur UI) | L111 |
| settings.spec.ts | L32 SMTP, L87 smtpPassword (SUPER_ADMIN), L109 **TestSmtpForm**, L148 badge picker (cas nominal) | L133, L225 ; L148 cas `UNKNOWN_TEMPLATE` -> retirer |
| subscription-flow.spec.ts | — (exemplaire) | — |
| user-detail.spec.ts | — (change-role/reset/archive deja UI) | L99, L108, L118, L126 (+ tests UI « bouton/option masque ») |
| user-new.spec.ts | L100 EMAIL_TAKEN **via formulaire** (erreur UI) | L111, L126 |
| users-list.spec.ts | L68 case « Archives » **via checkbox + Filtrer** (au lieu de query directe) | — |

`(*)` = apres gap Vitest (Task 0.3).

- [x] Task 3.x : traiter chaque fichier, run vert, commit si demande. — Fait 2026-07-20 (15 fichiers, 0 page.request).

---

## Phase 4 — PUBLIC / TRANSVERSE (`e2e/public/`, `e2e/transverse/`, 71 tests)

Deja majoritairement conforme. **Securite hors-perimetre** (regle 6) : deplacer/regrouper dans `e2e/transverse/securite.spec.ts`.

| Fichier | A CONVERTIR | RETIRER / DEPLACER |
|---|---|---|
| account-registration.spec.ts | L137 resubmit **via bouton** (audit) | L112, L168, L188 -> integration |
| event-register.spec.ts | L105 EMAIL_BLOCKED, L182 DOCUMENT_BLOCKED **via formulaire** (si message UI ; sinon retirer) | L98-102 (portion API), L120 (429) -> integration |
| password-reset.spec.ts | L64/L82 anti-enum **via formulaire forgot** (message generique + Mailpit 0) | L113 (429) -> securite |
| register.spec.ts | — | L113 (429) -> securite |
| badge-verify.spec.ts | — | L95 (log BADGE_SCANNED endpoint) -> integration |
| account-profile.spec.ts | — (verifs `/api/files` = check download, tolere) | — |
| security.spec.ts (transverse) | — | conserver (cookie efface/falsifie = securite) |

- [x] Task 4.x : traiter chaque fichier ; securite conservee dans transverse/security.spec.ts (hors-perimetre). — Fait 2026-07-20 (0 page.request dans les specs UI).

---

## Task 5 : Verification globale + documentation

- [ ] **Step 1 : Aucune `page.request` residuelle dans les specs UI.** Run : `grep -rn "page.request" e2e/ | grep -v "e2e/transverse/securite.spec.ts"` -> attendu : **vide** (seule la spec securite en conserve). Sinon traiter.
- [ ] **Step 2 : Aucun deep-link non verifie.** Verifier (echantillon) que chaque `page.goto` de page applicative est suivi d'un `toHaveURL`, et que les logins passent par `loginAndEnter`.
- [ ] **Step 3 : lint + typecheck.** `make lint && make typecheck`.
- [ ] **Step 4 : Suite E2E complete** (stack fraiche, vrai exit code) :
`make test-e2e > .plan-logs/fidelite-e2e.log 2>&1; echo "EXIT=$?"` puis lire `EXIT` et le resume. Attendu : 0 echec (hors flakes de baseline absorbes par `retries:1`). En cas d'echec 404 systematique : redemarrer la stack (`make dev`) — compilation dev perimee, cf. plan bugs.
- [ ] **Step 5 : Suite Vitest complete** (les gaps combles) : `docker compose -f docker-compose.dev.yml exec -T app yarn vitest run` -> 0 echec.
- [ ] **Step 6 : Documenter** dans `docs/v4/features/politique-tests.md` le contrat « test UI » (jamais d'API, parcours `/select`, verif URL) et la separation E2E-UI / integration-API / securite.
- [ ] **Step 7 : Tracker** (statuts `[x]`, dates). Conserver ce plan.
- [ ] **Step 8 : Commit** (si demande) : `test(v4): fidelite UI des specs e2e (parcours complet, zero API)`.

---

## Auto-revue (couverture de la demande)

- **Jamais d'API dans un test UI** -> contrat regle 1 + Task 5.1 (grep zero `page.request`) + catalogues « GARDE A RETIRER ». ✅
- **Parcours UI complet + `/select` si multi-espaces** -> regle 2 + helper `loginAndEnter` (Task 0.1) + systemique Phases 1-4. ✅
- **Verifier l'URL a chaque etape** -> regle 3 + colonnes « MANQUE URL » traitees par fichier + Task 5.2. ✅
- **Actions sans UI** -> Task 0.2 cree les controles (archive/restore event, role membre org) avant conversion. ✅
- **Gardes 403** -> retirees apres comblement des gaps Vitest (Task 0.3), ou remplacees par assertion UI (bouton masque/redirect). ✅
- **Securite (rate-limit, cookie)** -> conservee hors-perimetre en `transverse/securite`. ✅
- **Pas de perte de couverture** -> gaps Vitest combles avant retrait ; catalogue verifie route par route dans l'audit. ✅
