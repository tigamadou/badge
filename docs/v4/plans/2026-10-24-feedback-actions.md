# Loader et toast sur toutes les actions — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque bouton qui déclenche une action asynchrone, dans les quatre espaces et
les pages publiques, affiche un loader et se désactive pendant l'exécution. Un double clic
ne part qu'une fois. L'action se termine par un toast de succès ou d'erreur, ou par une
redirection explicite. Les `Alert` éphémères qui doublonnent le toast disparaissent ; les
erreurs de validation restent sous les champs.

**Architecture :** on réutilise les primitives du socle (contrat C4 de la spec 22) :
`sonner` et `<Toaster />` dans `src/app/layout.tsx`, `src/lib/toast.ts`, `Button` avec
`loading`, et le hook `src/hooks/useAsyncAction.ts`. La spec 28 est propriétaire de C4.
Elle les complète par quatre petits ajouts (task 2) : un message d'erreur lisible même
quand l'API renvoie un code, `ActionError`, `Button variant="link"` et
`Modal confirmLoading`. Elle ajoute aussi un composant `ActionButton` pour les actions par
ligne. Elle migre ensuite les composants clients **par espace**. Aucun changement d'API
serveur.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, `sonner` (livré par le
socle), Vitest 4 (environnement `node`, rendu statique `renderToStaticMarkup`), Playwright
(projet `chromium` Desktop Chrome ; viewport 375 px pour les contrôles mobiles).

**Spec :** [`docs/v4/specs/2026-10-24-28-v4-feedback-actions.md`](../specs/2026-10-24-28-v4-feedback-actions.md) — coordination : [spec 22, contrat C4](../specs/2026-10-24-22-v4-lot-notifications-coordination.md)

**Branche :** `feat/feedback-actions` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Inventaire figé et lecture des primitives du socle | [ ] |  |  |
| 2 | Compléments aux primitives (`toast.ts`, `Button`, `Modal`, `ActionButton`, helpers e2e) | [ ] |  |  |
| 3 | `/platform` — organisations, utilisateurs, abonnements | [ ] |  |  |
| 4 | `/platform` — réglages, plans, profils, templates + composants partagés | [ ] |  |  |
| 5 | `/org` | [ ] |  |  |
| 6 | `/event` — inscriptions, scan, listes de blocage | [ ] |  |  |
| 7 | `/event` — catégories, membres, réglages, badges | [ ] |  |  |
| 8 | `/account`, pages publiques et auth | [ ] |  |  |
| 9 | Après fusion de 23 à 27 : conformité des fichiers exclus | [ ] |  |  |
| 10 | Documentation (`features/feedback-actions.md`, `README.md`) | [ ] |  |  |
| — | Vérification finale (lint, typecheck, test, e2e, navigateur 375 / 1280 par espace) | [ ] |  |  |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état (fichier en cours,
étape, prochaine action).

## Contraintes globales

**Règles d'usage (spec 28, à appliquer à chaque fichier) :**

- Toute action asynchrone déclenchée par un bouton passe par `useAsyncAction`. Pour un
  formulaire, on accepte un état `pending` équivalent branché sur `Button loading`. Ce
  plan impose quand même le hook dans les formulaires : sa garde anti double clic évite
  la double soumission.
- Succès : toast court au passé (« Inscription approuvée. »). Pas de toast si l'action
  redirige vers une page qui affiche déjà le résultat.
- Erreur : toast avec le message `error` renvoyé par l'API (déjà en français). Repli :
  « Une erreur est survenue. Réessayez. » (voir la task 2 pour les codes techniques).
- Les **erreurs de validation de formulaire** restent affichées **sous les champs**, sans
  toast à leur place. Un toast d'erreur général s'ajoute seulement si l'erreur n'est pas
  rattachée à un champ.
- Les actions longues existantes (export de lot, `ProgressBar`) gardent leur barre de
  progression. Le bouton de lancement est désactivé pendant l'exécution.
- Les `Alert` d'erreur ou de succès **éphémères** qui doublonnent le toast sont
  supprimées. Les `Alert` **permanentes** restent (bandeaux d'information, état de la
  page, motif de rejet…).
- Accessibilité : `aria-busy` sur le bouton pendant le chargement ; `sonner` annonce les
  toasts via une région `aria-live`.
- Les `confirm()` natifs **restent** : la spec ne demande pas de les remplacer. Les
  `alert()` natifs de fin d'action sont remplacés par des toasts.

**Règles projet :**

- **Périmètre de fichiers (spec 22)** : ne pas toucher aux fichiers possédés par les
  chantiers 23 à 27, ni à `ResubmitButton`, `src/lib/mail.ts`, les sept gabarits,
  `AccountNav.tsx`, les entrées de menu et les pages d'attente (socle). Si un fichier de
  l'inventaire a changé de propriétaire au rebase, s'arrêter et demander.
- **Pas de nouvelle dépendance.** `sonner` vient du socle.
- **Pas de changement d'API serveur** : on ne touche pas aux routes `src/app/api/**`. Les
  codes techniques renvoyés dans `error` sont traités côté client (task 2).
- **UI en français avec accents** (corriger au passage les libellés sans accents, comme
  « Role mis a jour » → « Rôle mis à jour. »). Code et identifiants en anglais.
  Commentaires en français, dans le style du fichier.
- **Server Components par défaut** : aucun nouveau `"use client"` hors `ActionButton`.
- **Tests** : TDD quand un test unitaire existe ou peut exister. La couverture 100 % sur
  `src/lib/**` et `src/app/api/**` doit rester active : `src/lib/toast.ts` est dans le
  périmètre. Pas de mock de Prisma. Le comportement des boutons (double clic, toasts,
  erreur 500) se prouve en **E2E** : Vitest tourne en environnement `node`, sans DOM
  interactif.
- **Commandes** (conteneur dev démarré par `make dev`) :
  - vérifications : `make lint`, `make typecheck`, `make test` ;
  - un seul fichier Vitest : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - E2E complet : `make test-e2e` ;
  - un seul fichier E2E : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test <chemin>`.
- **`make test` vide la BDD de dev**, et un fichier Vitest isolé aussi (`src/test-setup.ts`
  la remet à zéro). Lancer `make db-seed` avant toute vérification navigateur.
- **Vérification navigateur** de chaque task UI avec le navigateur intégré, à 375 × 812
  puis 1280 px : golden path, une erreur provoquée, double clic. Les toasts ne doivent pas
  masquer le bouton « Ouvrir le menu » ni la barre d'en-tête à 375 px.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Une étape « commit » de
  ce plan n'est pas une demande. Message en conventional commit, en français ASCII, sans
  trailer de co-auteur IA (ex. `feat(ui): loader et toast sur les actions de /platform`).
- **Aucune étape de déploiement ni de SSH** : le plan s'arrête à `development` vert en
  local.
- Avant de déclarer une task terminée : `make lint && make typecheck && make test`, puis les
  E2E listés dans la task.

## Points de vigilance de revue

1. **Action qui redirige.** `useAsyncAction` repasse `pending` à `false` dès que l'action
   se termine, donc avant la fin de `router.push`. Sans précaution, le bouton redevient
   cliquable pendant la navigation et une deuxième soumission part. Il faut un état
   `navigating`, posé dans `onSuccess` et combiné avec `pending`. Test : task 3,
   `OrgCreationForm`. Un double clic produit un seul `POST /api/platform/organizations`,
   et le bouton reste `disabled` jusqu'au changement d'URL.
2. **Réponse non JSON ou code technique.** Un 500 Next ou un 502 Caddy renvoie du HTML, et
   la plupart des routes renvoient un code dans `error` (`NOT_FOUND`, `VALIDATION`,
   `ORG_FORBIDDEN`, `Unauthorized`…). Le toast ne doit jamais afficher un code ni planter
   sur `res.json()`. Tests : task 2 (unitaires de `apiErrorMessage`), puis task 4 (E2E :
   `PlatformSettingsForm` reçoit un 500 HTML et affiche le repli).
3. **Erreur réseau sans réponse.** `fetch` rejette avec `TypeError: Failed to fetch`. Le
   toast affiche le repli, jamais le message anglais, et le bouton se réactive. Tests :
   task 2 (unitaire) et task 8 (E2E : `route.abort()` sur `forgot-password`).
4. **Composant démonté avant la fin.** `onSuccess` ferme une modale, et le formulaire qui
   a lancé l'action disparaît : `CategoryForm` dans `CategoryTable`,
   `CategoryImportTemplatesModal`, `MemberInviteForm`. Le toast doit quand même
   s'afficher, sans erreur console. Le toast est global : on l'appelle avant ou dans
   `onSuccess`, jamais dans un effet du composant démonté. Test : task 7. On crée une
   catégorie : la modale se ferme, le toast « Catégorie créée. » s'affiche et
   `page.on("console")` ne relève aucune erreur.
5. **Formulaire avec erreurs par champ.** Une erreur rattachée à un champ s'affiche sous
   ce champ (prop `error` d'`Input`), sans toast. La validation côté client ne lance
   aucune requête. Tests : task 8 (`reset-password` : mots de passe différents → message
   sous « Confirmer », zéro requête, zéro toast) et task 7 (`CategoryForm` : numéro déjà
   pris → message sous « Numéro », zéro toast).

## Inventaire

Relevé le 2026-10-24 sur `development` (`a597ee5`) par recherche de `fetch(`,
`router.refresh`, `onSubmit`, `useTransition`, `signIn(` et `signOut(` dans les fichiers
`"use client"` de `src/app` et `src/components`. **48 fichiers.** Il faut en migrer 45 ;
les 3 autres sont classés « hors migration », avec leur justification. La task 1 rejoue la
recherche après le rebase et signale tout écart.

Légende des motifs actuels : **Alert** = `Alert` éphémère de succès ou d'erreur ;
**inline** = texte d'erreur sous le bouton ou le formulaire ; **natif** = `alert()` ;
**rien** = aucun retour et bouton actif pendant la requête ; **désactivé** = bouton
`disabled` pendant la requête, sans loader.

### `/platform` (13 fichiers + 2 partagés)

| # | Fichier | Actions | Motif actuel |
|---|---|---|---|
| P1 | `src/app/platform/organizations/[orgId]/OrgDetailActions.tsx` | archiver, restaurer, supprimer (modale, redirige) | désactivé + Alert `info` (succès et erreur) |
| P2 | `src/app/platform/users/[userId]/UserDetailActions.tsx` | régénérer le lien, changer le rôle staff, archiver | désactivé + Alert `info`, libellés sans accents |
| P3 | `src/components/platform/PlatformOrgMemberInviteForm.tsx` | inviter (formulaire) | désactivé + Alert `err`, pas de retour de succès |
| P4 | `src/components/staff/OrgCreationForm.tsx` | créer (redirige) | désactivé + Alert `err` |
| P5 | `src/components/staff/UserCreationForm.tsx` | créer (redirige) | désactivé + Alert `err` (« E-mail déjà utilisé » = champ) |
| P6 | `src/components/staff/SubscriptionForm.tsx` | enregistrer l'abonnement | désactivé + texte « Abonnement enregistré. » + erreur inline |
| P7 | `src/components/staff/PlatformSettingsForm.tsx` | enregistrer les réglages | désactivé + Alert `info` éphémère ; Alert `warn` permanente (secrets) **à garder** |
| P8 | `src/components/staff/TestSmtpForm.tsx` | envoyer un e-mail de test | désactivé + Alert `success`/`err` |
| P9 | `src/components/staff/RejectionReasonsManager.tsx` | créer, modifier (modale), archiver (modale) | désactivé + erreurs inline ; « libellé obligatoire » = champ |
| P10 | `src/components/staff/PlanManager.tsx` | créer, archiver/restaurer par ligne | désactivé + erreur inline (« Ce nom de plan existe déjà. » = champ) |
| P11 | `src/components/staff/ProfileReviewPanel.tsx` | approuver, rejeter | désactivé + Alert `err`, pas de retour de succès |
| P12 | `src/components/staff/BadgeTemplateArchiveButton.tsx` | archiver/restaurer | `pending` couvre seulement `router.refresh`, donc double clic possible ; erreur en `span` |
| P13 | `src/components/staff/BadgeTemplateInstaller.tsx` | installer un paquet (modale à étapes, `ProgressBar`) | **hors migration** : action longue déjà conforme (le bouton « Installer » disparaît en phase `installing`, succès et erreurs dans la modale) |
| S1 | `src/components/admin/BadgeTemplatePicker.tsx` (partagé : `/platform`, `/org`, `/event` `settings/badge`, wizard) | choisir le template, revenir à l'hérité | `useTransition` désactive ; Alert `success`/`err` |
| S2 | `src/components/auth/LogoutButton.tsx` (partagé : `StaffShell`, `OrgShell`, `/account`) | se déconnecter (modale) | libellé « Déconnexion… » ; bouton de confirmation **actif**, donc double `signOut` possible |

### `/org` (7 fichiers)

| # | Fichier | Actions | Motif actuel |
|---|---|---|---|
| O1 | `src/app/org/[orgId]/events/EventArchiveActions.tsx` | archiver/restaurer un évènement | désactivé + erreur inline (code `ORG_FORBIDDEN` traduit à la main) |
| O2 | `src/app/org/[orgId]/members/MembersClient.tsx` | changer le rôle (`select`), retirer | `select` désactivé ; retrait : **rien** ; Alert `err` (« dernier OWNER ») |
| O3 | `src/components/admin/OrgMemberForm.tsx` | inviter un membre | désactivé + Alert `err` |
| O4 | `src/app/org/[orgId]/settings/SettingsClient.tsx` | enregistrer, envoyer le logo | désactivé + Alert `success`/`err` |
| O5 | `src/app/org/[orgId]/templates/TemplatesClient.tsx` | supprimer un modèle | **rien** (pas de retour, pas d'erreur gérée) |
| O6 | `src/components/admin/CategoryTemplateForm.tsx` | créer/modifier un modèle (modale) | **rien** (pas de `disabled`) + Alert `err` |
| O7 | `src/components/admin/EventCreationWizard.tsx` | créer l'évènement (redirige) | désactivé + Alert `err` ; slug pris et date de fin = champs |

### `/event` (17 fichiers)

| # | Fichier | Actions | Motif actuel |
|---|---|---|---|
| E1 | `src/components/event/RegistrationActions.tsx` | approuver, rejeter, marquer imprimé | désactivé + Alert `err` ; « marquer imprimé » sans gestion d'erreur |
| E2 | `src/components/event/RegistrationDetailPanel.tsx` | bloquer l'e-mail, bloquer le document, ALL ACCESS, supprimer (redirige) | **natif** (`alert()`) ; ALL ACCESS : **rien** ; suppression désactivée ; Alert `err` du motif de rejet **permanente, à garder** |
| E3 | `src/components/event/RegistrationForm.tsx` | uploads, créer/modifier (redirige) | désactivé + Alert `err` |
| E4 | `src/components/event/QRScanner.tsx` | vérifier un QR (caméra ou saisie manuelle) | saisie désactivée ; la carte de résultat est l'état de la page (**à garder**) ; pas de gestion d'erreur réseau (`busy` reste bloqué) |
| E5 | `src/components/event/BlockedEmailsForm.tsx` | bloquer, retirer par ligne | **rien** + Alert `err` (« déjà bloqué » = champ) |
| E6 | `src/components/event/BlockedDocumentsForm.tsx` | bloquer, retirer par ligne | **rien** + Alert `err` (« déjà bloqué » = champ) |
| E7 | `src/components/event/CategoryTable.tsx` | supprimer par ligne | **natif** (`alert("Échec de la suppression.")`) |
| E8 | `src/components/event/CategoryForm.tsx` | créer/modifier (modale) | **rien** (pas de `disabled`) + Alert `err` ; numéro et nom pris = champs |
| E9 | `src/components/event/CategoryImportTemplatesModal.tsx` | importer des modèles | désactivé + erreur inline |
| E10 | `src/components/event/CategoryReassignModal.tsx` | réaffecter puis supprimer | désactivé + erreur inline |
| E11 | `src/components/event/MemberTable.tsx` | changer le rôle (`select`), retirer | **rien** |
| E12 | `src/components/event/MemberInviteForm.tsx` | inviter | désactivé + erreur inline (« déjà membre » = champ) |
| E13 | `src/components/event/EventSettingsForm.tsx` | enregistrer l'évènement, enregistrer le contact, 3 uploads | **rien** (boutons actifs) + une Alert `msg` partagée, dont le ton est deviné par une regex ; date de fin, consignes et options = champs |
| E14 | `src/components/event/BadgeListTable.tsx` | marquer imprimé le lot sélectionné | **rien** (pas d'erreur gérée) |
| E15 | `src/components/event/BadgeBatchPanel.tsx` | marquer imprimé le lot | désactivé + texte éphémère « N badge(s) marqué(s) imprimé(s). » |
| E16 | `src/components/badge/BadgePrintActions.tsx` | marquer imprimé | désactivé + erreur inline (lit `json.message`) ; la date d'impression est l'état de la page (**à garder**) |
| E17 | `src/components/event/RegistrationTable.tsx` | rafraîchir la liste, export CSV | **hors migration** : la liste est une lecture (pas une action), et l'export est un téléchargement par navigation (`window.location`), dont on ne peut pas observer la fin |

### `/account` (1 fichier, + `LogoutButton` partagé)

| # | Fichier | Actions | Motif actuel |
|---|---|---|---|
| A1 | `src/app/account/profile/ProfileForm.tsx` | upload photo, upload pièce, enregistrer (redirige si `redirectTo`, sinon refresh) | désactivé + « Envoi en cours… » + Alert `err` |

### Pages publiques et auth (7 fichiers)

| # | Fichier | Actions | Motif actuel |
|---|---|---|---|
| U1 | `src/app/(marketing)/contact/ContactForm.tsx` | envoyer le message | désactivé + erreur inline ; écran de remerciement (`done`) |
| U2 | `src/app/e/[slug]/register/RegisterEventForm.tsx` | s'inscrire (redirige) | désactivé + Alert `err` ; consentement = champ |
| U3 | `src/app/login/page.tsx` | se connecter (`signIn`, redirige) | désactivé + Alert `err` + bordure rouge sur les champs |
| U4 | `src/app/register/page.tsx` | créer un compte | désactivé + Alert `err` ; longueur et confirmation du mot de passe = champs ; écran `done` |
| U5 | `src/app/forgot-password/page.tsx` | demander le lien | désactivé + Alert `err` ; écran `done` |
| U6 | `src/app/reset-password/[token]/page.tsx` | changer le mot de passe | désactivé + Alert `err` ; règles de mot de passe = champs ; écran `done` |
| U7 | `src/components/auth/SetupPasswordForm.tsx` | définir le mot de passe (redirige) | désactivé + Alert `err` ; règles de mot de passe = champs |

### Hors migration et exclusions

- **Hors migration (3)** : `BadgeTemplateInstaller` (P13) et `RegistrationTable` (E17),
  justifiés plus haut. `src/components/admin/TeamForm.tsx` n'est importé nulle part :
  c'est du code mort, à signaler à l'utilisateur et à ne pas migrer.
- **Exclus (spec 22)** : `src/app/account/registrations/[id]/ResubmitButton.tsx` (socle,
  chantier 25). Les fichiers que créeront les chantiers 23 à 27 (`src/app/platform/jobs/**`,
  `src/components/notifications/**`, les pages `notifications`, le contrôle de catégorie de
  `src/app/account/registrations/[id]/**`) sont vérifiés en task 9.
- Ne sont pas des actions : `OrgSelector` (navigation `router.push`) et les chargements
  initiaux par `GET` (`refresh()` des listes, modèles chargés à l'ouverture d'une modale).
  On les laisse tels quels. En revanche, l'appel de rafraîchissement **après** une action
  fait partie de l'action.

## Motifs de transformation

Chaque fichier applique un ou plusieurs motifs. Les tasks 3 à 8 citent le motif par sa
lettre.

**Convention d'échec d'une action** (posée en task 2) : dans l'action passée au hook,
`if (!res.ok) throw res;`. Pour un message propre au composant (par ex. 409 « dernier
OWNER »), on lève `throw new ActionError("Impossible : c'est le dernier OWNER.")`. Le hook
attrape l'exception et appelle `toastApiError(err, options.error)`.

**A — bouton isolé.** Avant : `const [busy, setBusy]`, `setMsg(...)`, `<Alert>`. Après :

```tsx
const archive = useAsyncAction(
  async () => {
    const res = await fetch(`/api/platform/organizations/${org.id}/archive`, { method: "POST" });
    if (!res.ok) throw res;
  },
  { success: "Organisation archivée.", error: "Échec de l'archivage.", onSuccess: () => router.refresh() },
);
<Button loading={archive.pending} onClick={archive.run}>Archiver</Button>
```

On supprime l'état `busy`/`msg` et l'`Alert`. Si plusieurs boutons du même bloc ne doivent
pas partir en même temps, chacun reçoit `disabled={autreAction.pending}`.

**B — formulaire sans erreur par champ.** `onSubmit={(e) => { e.preventDefault(); void save.run(); }}`
et `<Button type="submit" loading={save.pending}>`. Les champs restent éditables.

**C — formulaire avec erreurs par champ.** On garde un état `fieldErrors`, typé par
fichier. La validation côté client se fait **avant** `run()` : en cas d'erreur, on remplit
`fieldErrors` et on ne lance aucune requête. Côté serveur, l'action renvoie
`{ fieldErrors }` pour les codes rattachés à un champ (par ex. `NUMBER_TAKEN` →
`{ number: "Le numéro 12 est déjà utilisé dans cet événement." }`). Elle lève une
exception pour le reste. On n'utilise **pas** l'option `success` : `onSuccess` regarde le
résultat, puis remplit `fieldErrors` ou appelle `toastSuccess`. L'erreur s'affiche avec
`<Input error={fieldErrors.number} />`, ou dans un `<p className="mt-1 text-sm text-rose-600">`
sous le contrôle s'il n'utilise pas `Input`.

**D — action qui redirige.** Pas de toast de succès si la page d'arrivée montre le
résultat (fiche créée, inscription créée). On garde un toast si elle ne le montre pas (par
ex. suppression → retour à la liste : « Inscription supprimée. »). Ce toast survit à la
navigation client, puisque `<Toaster />` vit dans le layout racine. `onSuccess` pose
`setNavigating(true)` puis appelle `router.push`. Le bouton reçoit
`loading={action.pending || navigating}` (vigilance 1).

**E — action par ligne.** Chaque ligne a son propre `pending` : on utilise `ActionButton`
(task 2), qui loge le hook dans le bouton. Le `confirm()` natif passe dans la prop
`confirm` : une annulation ne fait rien, ni requête ni toast. Pour un `<select>` de rôle,
on extrait un petit composant de ligne dans le même fichier. Il appelle
`useAsyncAction((role) => …)` avec l'argument transmis par `run(role)` (task 2), et
reçoit `disabled={pending}`.

**F — upload.** On garde l'indicateur en place (« Envoi… » dans `FileBox`, « Envoi en
cours… »), qui sert de loader. Une erreur produit un toast via `toastApiError`, avec un
repli propre au fichier (« Échec de l'envoi du logo. »). Pas de toast de succès : la
`FileBox` affiche le fichier.

**G — action longue avec progression.** Inchangée. On vérifie seulement que le bouton de
lancement est désactivé ou masqué pendant l'exécution.

---

## Task 1 — Inventaire figé et lecture des primitives du socle

**Fichiers :** lecture seule. Ce plan est le seul fichier modifié (section Inventaire,
colonne Notes de la Progression).

- [ ] Rebaser la branche sur `origin/development`, socle fusionné. Vérifier la présence de
  `src/lib/toast.ts`, `src/hooks/useAsyncAction.ts`, `Button` avec `loading`, et
  `<Toaster />` dans `src/app/layout.tsx`.
- [ ] Lire l'implémentation du socle et noter dans la colonne Notes :
  1. comment `useAsyncAction` signale l'échec : il attrape toute exception et appelle
     `toastApiError(err, options.error)` ? ;
  2. si la garde anti double clic repose sur un `useRef`. Un `useState` seul laisse
     passer deux clics dans le même tick. Si c'est un `useState`, la task 2 corrige ;
  3. si `toastApiError` est `async`, puisqu'il lit le corps d'une `Response` ;
  4. si `run` transmet des arguments à l'action ;
  5. la position du `<Toaster />` et la durée par défaut.
- [ ] Rejouer la recherche de l'inventaire :
  `grep -rlE '^"use client"' src/app src/components | xargs grep -lE 'fetch\(|router\.refresh|onSubmit|useTransition|signIn\(|signOut\('`.
  Comparer avec les 48 fichiers ci-dessus. Tout fichier nouveau ou disparu est ajouté ou
  retiré de l'inventaire, avec son espace et son motif. Un fichier nouveau qui appartient à
  23-27 va dans « Exclus ».

**Critères d'acceptation :** l'inventaire du plan correspond au code rebasé. Les cinq
réponses sont consignées. Si l'une d'elles contredit la task 2 (par ex. le hook n'attrape
pas les exceptions), adapter la task 2 avant de continuer.

## Task 2 — Compléments aux primitives

**Fichiers :**
- Modifier : `src/lib/toast.ts`, `src/hooks/useAsyncAction.ts` (seulement si la task 1
  l'exige), `src/components/ui/Button.tsx`, `src/components/ui/Modal.tsx`
- Créer : `src/components/ui/ActionButton.tsx`, `e2e/helpers/feedback.ts`
- Tests : `src/lib/__tests__/toast.test.ts` (créé par le socle, à compléter),
  `src/components/ui/__tests__/Modal.test.tsx`, `src/components/ui/__tests__/Button.test.tsx`
  (créé par le socle, sinon le créer), `src/components/ui/__tests__/ActionButton.test.tsx`

**Interfaces :**

```ts
// src/lib/toast.ts — ajouts
export const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez.";
// Erreur dont le message, en français, est destiné à l'utilisateur.
export class ActionError extends Error {}
// Message à afficher pour une erreur d'action. Ordre de priorité :
// 1. ActionError → son message ;
// 2. Response → corps JSON : `message` (chaîne) s'il existe, sinon `error` s'il est
//    lisible (contient une espace et n'appartient pas à NON_USER_FACING_ERRORS) ;
//    un corps non JSON ou un code (`NOT_FOUND`, `Unauthorized`) donne le repli ;
// 3. toute autre valeur (TypeError réseau, AbortError…) → repli.
export async function apiErrorMessage(source: unknown, fallback?: string): Promise<string>;
// toastApiError délègue à apiErrorMessage (signature C4 inchangée).
```

`NON_USER_FACING_ERRORS` est une constante privée. Elle liste les messages anglais relevés
dans `src/app/api` le 2026-10-24 : `"Rate limited"`, `"Not found"`, `"Missing orgId"`,
`"Missing orgId or eventId"`, `"Last OWNER cannot be removed"`, `"Bad request"`.

```ts
// src/hooks/useAsyncAction.ts — seulement si le socle ne le fait pas déjà
export function useAsyncAction<T, A extends unknown[] = []>(
  action: (...args: A) => Promise<T>,
  options?: { success?: string; error?: string; onSuccess?: (result: T) => void },
): { run: (...args: A) => Promise<void>; pending: boolean };
// Les appels sans argument du socle restent valides. Garde par useRef.
```

```tsx
// src/components/ui/Button.tsx — ajout d'une variante
type Variant = "primary" | "secondary" | "danger" | "link";
// "link" : sans fond ni padding (pas de `px-4 py-2 rounded-lg`), `text-[13px] font-medium
// hover:underline` ; la couleur vient de className (ex. "text-rose-600").

// src/components/ui/Modal.tsx — ajout
confirmLoading?: boolean; // transmis en `loading` au bouton de confirmation

// src/components/ui/ActionButton.tsx — "use client"
export function ActionButton<T>(props: {
  action: () => Promise<T>;
  success?: string;
  error?: string;
  confirm?: string;              // window.confirm avant l'action ; annulation = rien
  onSuccess?: (result: T) => void;
  variant?: "primary" | "secondary" | "danger" | "link";
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  children: ReactNode;
}): JSX.Element;
```

```ts
// e2e/helpers/feedback.ts
export function toast(page: Page, text: string | RegExp): Locator; // [data-sonner-toast] filtré
export function countRequests(page: Page, method: string, urlPart: string): () => number;
export async function failWith500Html(page: Page, urlGlob: string): Promise<void>; // corps text/html
export async function abortNetwork(page: Page, urlGlob: string): Promise<void>;
```

**Étapes :**
- [ ] Tests `toast.test.ts`, écrits d'abord, rouges. `apiErrorMessage` sur : `ActionError` ;
  `Response` 409 `{ message: "Seules les inscriptions approuvées…" }` ; `Response` 400
  `{ error: "Un compte avec cet email existe déjà." }` ; `{ error: "NOT_FOUND" }` →
  repli ; `{ error: "Unauthorized" }` → repli ; `{ error: "Rate limited" }` → repli ;
  corps `<html>` → repli ; `new TypeError("Failed to fetch")` → repli ; repli
  personnalisé ; repli par défaut. On mocke `sonner` (`vi.mock("sonner")`) pour vérifier
  que `toastApiError` appelle `toast.error` avec le bon texte. C'est une bibliothèque
  d'UI, pas une règle métier.
- [ ] Implémenter, puis faire passer. Couverture 100 % sur `toast.ts` :
  `make test-coverage`.
- [ ] `Button.test.tsx` : `variant="link"` ne contient ni `px-4` ni `bg-` ; `loading`
  garde `disabled` et `aria-busy="true"`. `Modal.test.tsx` : `confirmLoading` →
  bouton de confirmation `disabled` et `aria-busy`. Rouges, puis implémenter.
- [ ] `ActionButton.test.tsx` (rendu statique) : libellé, variante, `disabled` transmis,
  `aria-label`. Le comportement (confirm, double clic) est couvert en E2E dès la task 3.
- [ ] Si la task 1 l'a relevé : garde `useRef` et arguments de `run` dans le hook, avec
  ses tests au format choisi par le socle. Vérifier que `ResubmitButton` compile
  toujours sans modification.
- [ ] Écrire `e2e/helpers/feedback.ts`. `countRequests` s'abonne à `page.on("request")`
  et filtre sur la méthode et `url().includes(urlPart)`.

**Critères d'acceptation :** tests unitaires verts, couverture `src/lib` à 100 %,
`make lint && make typecheck` OK. Aucun écran ne change encore.

## Task 3 — `/platform` : organisations, utilisateurs, abonnements

**Fichiers (6) :** P1 `OrgDetailActions.tsx`, P2 `UserDetailActions.tsx`,
P3 `PlatformOrgMemberInviteForm.tsx`, P4 `OrgCreationForm.tsx`, P5 `UserCreationForm.tsx`,
P6 `SubscriptionForm.tsx`.
Créer : `e2e/transverse/feedback-platform.spec.ts`.

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| P1 | A ×2 + D | Archiver → « Organisation archivée. », Restaurer → « Organisation restaurée. » (+ `router.refresh`). Supprimer : `Modal confirmLoading`, puis D vers `/platform/organizations` avec le toast « Organisation supprimée. ». Le contrôle du slug de confirmation reste une erreur de champ dans la modale. Supprimer l'`Alert info`. |
| P2 | A ×3 | « Lien d'invitation régénéré. », « Rôle mis à jour. », « Utilisateur archivé. ». Erreurs : `toastApiError` (le `error` de l'API est déjà utilisé aujourd'hui). Supprimer l'`Alert info`. |
| P3 | B | Succès : « Invitation envoyée. » + `router.refresh` + vider les champs. Supprimer l'`Alert err`. |
| P4 | B + D | Pas de toast de succès (la fiche s'affiche). `SLUG_TAKEN` → champ slug (motif C) si l'API le renvoie, sinon toast. |
| P5 | C + D | 409 « E-mail déjà utilisé. » → sous le champ e-mail ; le reste → toast. Pas de toast de succès. |
| P6 | B | « Abonnement enregistré. » en toast. Supprimer le texte de succès éphémère et l'erreur inline. |

**Tests existants à adapter ou rejouer :**
`e2e/platform/organization-subscription.spec.ts:67` (`getByText("Abonnement enregistré.")` :
le texte est désormais dans le toast. Passer à `toast(page, "Abonnement enregistré.")`
pour éviter une ambiguïté en mode strict). Rejouer `organization-detail.spec.ts`,
`user-detail.spec.ts`, `user-new.spec.ts`, `organization-new.spec.ts`,
`organization-members.spec.ts`, `subscription-flow.spec.ts`.

**Nouveaux E2E (`feedback-platform.spec.ts`) :**
- [ ] **Double clic** (vigilance 1) : `OrgCreationForm` rempli, `dblclick()` sur
  « Créer » → `countRequests(page, "POST", "/api/platform/organizations")() === 1`, bouton
  `disabled` tant que l'URL n'a pas changé.
- [ ] Erreur 500 : `failWith500Html` sur `**/api/platform/organizations/*/archive` → toast
  « Échec de l'archivage. », bouton réactivé.
- [ ] Succès : archiver → toast « Organisation archivée. ».

**Étapes :** écrire les E2E (rouges), migrer les 6 fichiers, adapter les specs existantes,
puis vérifier au navigateur `/platform/organizations/new`, `/platform/organizations/[id]`,
`/platform/users/[id]` et `…/subscription` à 375 et 1280 px.

**Critères d'acceptation :** E2E nouveaux et existants verts. Plus aucune `Alert`
éphémère dans ces 6 fichiers (`grep -n "<Alert" <fichiers>` ne renvoie que des bandeaux
permanents).

## Task 4 — `/platform` : réglages, plans, profils, templates + composants partagés

**Fichiers (8) :** P7 `PlatformSettingsForm.tsx`, P8 `TestSmtpForm.tsx`,
P9 `RejectionReasonsManager.tsx`, P10 `PlanManager.tsx`, P11 `ProfileReviewPanel.tsx`,
P12 `BadgeTemplateArchiveButton.tsx`, S1 `BadgeTemplatePicker.tsx`, S2 `LogoutButton.tsx`.
Contrôle seulement : P13 `BadgeTemplateInstaller.tsx` (motif G).

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| P7 | B | « Paramètres enregistrés. » + `router.refresh`. Garder l'`Alert warn` permanente (secrets non éditables) ; supprimer l'`Alert info` éphémère. |
| P8 | B | « E-mail de test envoyé à {to}. » ; erreur : `ActionError("Échec : " + (message ?? error))` pour garder le diagnostic SMTP. |
| P9 | C + E + modales | Créer : C (libellé vide → champ) + « Motif créé. ». Modifier : C dans la modale + « Motif modifié. ». Archiver : `Modal confirmLoading` + « Motif archivé. ». |
| P10 | C + E | Créer : `NAME_TAKEN` → sous « Nom » ; succès « Plan créé. ». Archiver/restaurer par ligne : `ActionButton variant="link"` → « Plan archivé. » / « Plan restauré. ». |
| P11 | A + B | Approuver → « Profil approuvé. » ; rejeter → « Profil rejeté. » ; `NO_PENDING_SUBMISSION` → `ActionError("Aucune soumission en attente.")`. |
| P12 | A | Le `pending` couvre la requête **et** le refresh. « Template archivé. » / « Template restauré. ». Supprimer le `span` d'erreur. |
| S1 | A | Remplacer `useTransition` par le hook (succès « Template enregistré. » puis `router.refresh`) ; supprimer les deux `Alert`. |
| S2 | A | `Modal confirmLoading={pending}` : le bouton se désactive et un seul `signOut` part. Pas de toast (la page change). |

**Tests existants :** `e2e/platform/plans.spec.ts:106` (« Ce nom de plan existe déjà » :
même texte, désormais sous le champ, assertion inchangée). Rejouer
`e2e/platform/settings.spec.ts` (SMTP, motifs de rejet), `profile-detail.spec.ts`,
`profiles.spec.ts`, `badge-templates.spec.ts`, `e2e/transverse/logout.spec.ts`,
`e2e/org/settings.spec.ts` et `e2e/event/settings.spec.ts` (S1 apparaît sur leurs pages
`settings/badge`).

**Nouveaux E2E (`feedback-platform.spec.ts`) :**
- [ ] Erreur 500 non JSON (vigilance 2) : `failWith500Html` sur `**/api/platform/settings`
  → toast du repli « Une erreur est survenue. Réessayez. » ; aucun texte `<html` ni code
  dans le toast.
- [ ] Double clic : `PlanManager`, archiver une ligne en `dblclick()` → un seul `PATCH`.
- [ ] Déconnexion : double clic sur « Se déconnecter » → la page atterrit sur `/` sans
  erreur.

**Critères d'acceptation :** E2E verts. Vérification navigateur de `/platform/settings`,
`/platform/plans`, `/platform/profiles/[id]`, `/platform/badge-templates` et
`/platform/settings/badge` à 375 et 1280 px. Dans l'installeur, « Installer » disparaît
pendant l'envoi (comportement inchangé).

## Task 5 — `/org`

**Fichiers (7) :** O1 `EventArchiveActions.tsx`, O2 `MembersClient.tsx`, O3 `OrgMemberForm.tsx`,
O4 `SettingsClient.tsx`, O5 `TemplatesClient.tsx`, O6 `CategoryTemplateForm.tsx`,
O7 `EventCreationWizard.tsx`.
Créer : `e2e/transverse/feedback-org.spec.ts`.

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| O1 | E | `ActionButton variant="link" confirm="Archiver cet événement ?"` (pas de confirm pour la restauration) → « Événement archivé. » / « Événement restauré. » + refresh. Supprimer l'erreur inline et la traduction manuelle d'`ORG_FORBIDDEN` (`ActionError("Action non autorisée.")` sur 403). |
| O2 | E | Ligne extraite (`MemberRow`) : `select` de rôle → `run(role)`, « Rôle mis à jour. » ; 409 → `ActionError("Impossible : c'est le dernier OWNER.")`, puis `refresh()` dans les deux cas. Retirer : `ActionButton confirm="Retirer ce membre ?"` → « Membre retiré. ». Supprimer l'`Alert err`. |
| O3 | B | « Invitation envoyée. » ; supprimer l'`Alert err`. |
| O4 | B + F | « Paramètres enregistrés. » ; upload du logo en F ; supprimer l'`Alert`. |
| O5 | E | Supprimer : `ActionButton variant="link" confirm="Supprimer ce modèle ?"` → « Modèle supprimé. » + `refresh()`. |
| O6 | C | `NAME_TAKEN`/`NUMBER_TAKEN` → champs (s'ils sont renvoyés), le reste en toast ; succès « Modèle enregistré. » puis `onSaved` (modale fermée, vigilance 4). |
| O7 | C + D | Slug pris → sous « Slug » ; date de fin → sous « Date de fin » ; limite du plan et abonnement inactif → toast (non rattachés à un champ). Pas de toast de succès. |

**Tests existants :** `e2e/org/members.spec.ts:151` (`/dernier OWNER/` : texte dans le
toast, assertion valable ; passer à `toast(page, /dernier OWNER/i)`) ;
`e2e/org/settings.spec.ts:71` (`/paramètres enregistrés/` → `toast(...)`) ;
`e2e/org/events.spec.ts:189` (`/limite d.événements/` → `toast(...)`) ;
`e2e/org/templates.spec.ts` et `e2e/org/events.spec.ts:155` (le `confirm` natif reste
accepté par `page.on("dialog")`). Rejouer tout `e2e/org/`.

**Nouveaux E2E (`feedback-org.spec.ts`) :**
- [ ] Double clic : `SettingsClient`, `dblclick()` sur « Enregistrer » → un seul
  `PATCH /api/org/{id}`.
- [ ] Erreur 500 : sur `**/api/org/*/templates/*` (DELETE) → toast de repli, la ligne
  reste affichée.
- [ ] Annulation du `confirm` (`dialog.dismiss()`) sur « Supprimer » → aucune requête,
  aucun toast.

**Critères d'acceptation :** E2E verts. Vérification navigateur (Acme avec abonnement
actif, cf. plan responsive) de `/org/[id]/members`, `settings`, `templates`, `events` et
`events/new` à 375 et 1280 px.

## Task 6 — `/event` : inscriptions, scan, listes de blocage

**Fichiers (6) :** E1 `RegistrationActions.tsx`, E2 `RegistrationDetailPanel.tsx`,
E3 `RegistrationForm.tsx`, E4 `QRScanner.tsx`, E5 `BlockedEmailsForm.tsx`,
E6 `BlockedDocumentsForm.tsx`.
Créer : `e2e/transverse/feedback-event.spec.ts`.

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| E1 | A + B | Approuver → « Inscription approuvée. » (`PROFILE_NOT_APPROVED` → `ActionError("Profil non validé par la plateforme.")`) ; Rejeter (formulaire) → « Inscription rejetée. » ; Marquer imprimé → « Badge marqué imprimé. » avec gestion d'erreur (absente aujourd'hui). Les trois s'excluent : `disabled` croisé. Supprimer l'`Alert err`. |
| E2 | A ×3 + D | Bloquer l'e-mail / le document : `confirm` gardé, `alert()` → toasts « E-mail bloqué. » / « Document bloqué. » ; ALL ACCESS → « Accès ALL ACCESS accordé. » / « … retiré. » + refresh ; Supprimer → D vers la liste, toast « Inscription supprimée. ». Garder l'`Alert` du motif de rejet (permanente). |
| E3 | C + D + F | Uploads en F ; erreurs de champs si l'API renvoie des `issues` rattachées à un champ, sinon toast. Pas de toast de succès (la fiche s'affiche). |
| E4 | A (saisie manuelle) | Le hook entoure `verifyPayload` : bouton « Vérifier » en `loading`. Erreur réseau ou réponse non JSON → toast de repli, et `busy` n'est plus bloqué. La carte de résultat reste l'unique retour de succès (pas de toast en doublon). Le scan caméra passe par la même fonction, sans bouton. |
| E5 | C + E | 409 « Cet e-mail est déjà bloqué. » (accents corrigés) → sous le champ ; succès « E-mail bloqué. » ; Retirer : `ActionButton variant="link" confirm=…` → « E-mail retiré de la liste. ». |
| E6 | C + E | idem : « Ce document est déjà bloqué. », « Document bloqué. », « Document retiré de la liste. ». |

**Tests existants :** `e2e/event/registration-detail.spec.ts:124` (`/profil non validé par
la plateforme/` : le texte apparaît aussi dans un `span` permanent de `RegistrationActions`
→ cibler `toast(page, …)` pour éviter la double correspondance) ;
`registration-detail.spec.ts:151-183` (le `page.on("dialog")` accepte aussi les `alert()`
supprimés : rien à changer) ; rejouer `blocklist.spec.ts`, `registrations.spec.ts`,
`registrations-new.spec.ts`, `scan.spec.ts`.

**Nouveaux E2E (`feedback-event.spec.ts`) :**
- [ ] Double clic : « Approuver » en `dblclick()` → un seul `POST …/approve`.
- [ ] Erreur 500 : `failWith500Html` sur `**/block-email` → toast de repli, aucun
  `alert()` natif (`page.on("dialog")` ne voit que le `confirm`).
- [ ] Scan manuel, réseau coupé (`abortNetwork` sur `**/scan/verify`) → toast de repli,
  bouton « Vérifier » réactivé.

**Critères d'acceptation :** E2E verts. Vérification navigateur de
`/event/[id]/registrations/[regId]`, `registrations/new`, `scan` (saisie manuelle) et
`blocklist` à 375 et 1280 px, en ADMIN d'évènement et en mode staff.

## Task 7 — `/event` : catégories, membres, réglages, badges

**Fichiers (10) :** E7 `CategoryTable.tsx`, E8 `CategoryForm.tsx`,
E9 `CategoryImportTemplatesModal.tsx`, E10 `CategoryReassignModal.tsx`, E11 `MemberTable.tsx`,
E12 `MemberInviteForm.tsx`, E13 `EventSettingsForm.tsx`, E14 `BadgeListTable.tsx`,
E15 `BadgeBatchPanel.tsx`, E16 `BadgePrintActions.tsx`.

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| E7 | E | Supprimer : `ActionButton confirm=…` ; `CATEGORY_HAS_REGISTRATIONS` → ouvre la modale de réaffectation (pas de toast) ; succès « Catégorie supprimée. » ; `alert()` supprimé. |
| E8 | C | `NUMBER_TAKEN` → sous « Numéro », `NAME_TAKEN` → sous « Nom » ; succès « Catégorie créée. » / « Catégorie modifiée. » puis `onSaved` (vigilance 4). |
| E9 | B | « {n} modèle(s) importé(s). » puis `onDone`. Le chargement initial en `GET` n'est pas une action : son erreur reste inline dans la modale. |
| E10 | A | « Inscriptions réaffectées, catégorie supprimée. » ; le succès partiel devient `ActionError("Réaffectation effectuée, mais la suppression a été refusée.")`. |
| E11 | E | Ligne extraite : `select` de rôle → `run(role)`, « Rôle mis à jour. » ; Retirer → `ActionButton confirm=…`, « Membre retiré. ». Les deux gèrent l'erreur (absente aujourd'hui). |
| E12 | C | `ALREADY_MEMBER` → sous « E-mail » ; « Invitation envoyée. » puis `onDone`. |
| E13 | B ×2 + C + F ×3 | Une action par formulaire : « Événement mis à jour. » et « Paramètres enregistrés. », chacune avec son `Button loading`. Erreurs de champ : `endDate < date` → sous « Date de fin », `securityInstructions` → sous les consignes, `templateOptions` → sous le bloc options. Uploads en F. Supprimer l'`Alert` partagée et sa regex de ton. |
| E14 | A | « Marquer imprimés » : `loading` + « {n} badge(s) marqué(s) imprimé(s). » + erreur gérée. |
| E15 | A + G | Même message en toast ; supprimer le texte éphémère. Le ZIP et l'aperçu ne changent pas. |
| E16 | A | « Badge marqué imprimé. » ; erreur via `toastApiError` (lit déjà `message`) ; supprimer l'erreur inline ; la date d'impression reste. |

**Tests existants :**
- `src/components/badge/__tests__/BadgePrintActions.test.tsx` et
  `src/components/event/__tests__/BadgeBatchPanel.test.tsx` : rendu statique. Vérifier que
  les assertions sur `disabled` portent toujours sur le bon bouton (le `Button` du socle
  peut changer le balisage). Adapter les sélecteurs sans affaiblir l'assertion.
- `e2e/event/badges.spec.ts:194` (`getByText("1 badge(s) marqué(s) imprimé(s).")` → `toast(...)`).
- `e2e/event/settings.spec.ts:117` (« la date de fin doit être postérieure » : même texte,
  désormais sous le champ ; assertion inchangée).
- Rejouer `categories.spec.ts`, `members.spec.ts`, `settings.spec.ts`, `badges.spec.ts`.

**Nouveaux E2E (`feedback-event.spec.ts`) :**
- [ ] Vigilance 4 : créer une catégorie → la modale se ferme, toast « Catégorie créée. »,
  aucune erreur console (`page.on("console")` filtré sur `error`).
- [ ] Vigilance 5 : numéro déjà pris → message sous « Numéro », `toast(page, /./)` absent.
- [ ] Double clic : `EventSettingsForm` « Enregistrer » → un seul `PATCH`.

**Critères d'acceptation :** tests unitaires et E2E verts. Vérification navigateur de
`/event/[id]/categories`, `members`, `settings`, `badges`, `badges/print` et
`badges/[badgeId]` à 375 et 1280 px.

## Task 8 — `/account`, pages publiques et auth

**Fichiers (8) :** A1 `ProfileForm.tsx`, U1 `ContactForm.tsx`, U2 `RegisterEventForm.tsx`,
U3 `src/app/login/page.tsx`, U4 `src/app/register/page.tsx`, U5 `src/app/forgot-password/page.tsx`,
U6 `src/app/reset-password/[token]/page.tsx`, U7 `SetupPasswordForm.tsx`.
Créer : `e2e/transverse/feedback-public.spec.ts`.

**Transformations :**

| Fichier | Motif | Après |
|---|---|---|
| A1 | B + F + D | Uploads en F (garder « Envoi en cours… » et « Photo enregistrée : … ») ; enregistrer → « Profil enregistré. » si `router.refresh`, D sans toast si `redirectTo`. Supprimer l'`Alert err`. |
| U1 | C | Validation client (e-mail, consentement) gardée en inline sous le formulaire, sans requête ; erreur serveur → toast ; succès = écran de remerciement (pas de toast). |
| U2 | C + D | Consentement manquant et reCAPTCHA indisponible : inline. Erreur API → toast. Redirection sans toast. |
| U3 | C + D | « Email ou mot de passe incorrect » reste **inline** sous le mot de passe : l'erreur est rattachée aux deux champs, qui gardent leur bordure rouge (prop `error`). On supprime seulement l'`Alert` en double. Le hook entoure `signIn`, avec un état `navigating` pendant `router.push`. |
| U4 | C | Longueur → sous « Mot de passe », confirmation → sous « Confirmer » ; erreur API → toast ; succès = écran `done`. |
| U5 | B | Erreur → toast ; succès = écran `done` ; reCAPTCHA indisponible → toast. |
| U6 | C | Comme U4 ; « Lien invalide ou expiré. » → toast ; succès = écran `done`. |
| U7 | C + D | Comme U4 (accents corrigés : « au moins 6 caractères ») ; redirection sans toast. |

**Tests existants :** `e2e/public/login.spec.ts:50-84` et `register.spec.ts:40`
(« email ou mot de passe incorrect » reste inline : assertions inchangées) ;
`account-profile.spec.ts` (« photo enregistrée » et « pièce d'identité enregistrée » sont
des états de `FileBox` : inchangés) ; rejouer `password-reset.spec.ts`,
`setup-password.spec.ts`, `event-register.spec.ts`, `event-register-newcomer.spec.ts`,
`marketing.spec.ts`, `recaptcha.spec.ts`, `account.spec.ts`.

**Nouveaux E2E (`feedback-public.spec.ts`) :**
- [ ] Vigilance 3 : `abortNetwork` sur `**/api/auth/forgot-password` → toast « Une erreur
  est survenue. Réessayez. », bouton réactivé, aucun texte « Failed to fetch ».
- [ ] Vigilance 5 : `reset-password`, mots de passe différents → message sous
  « Confirmer », `countRequests(...)() === 0`, aucun toast.
- [ ] Double clic : `/account/profile` « Enregistrer » → un seul `PATCH`.
- [ ] Mobile : à 375 × 812, un toast d'erreur sur `/account/profile` ne recouvre pas
  l'en-tête. Comparer la `boundingBox()` du toast avec celle du `header`.

**Critères d'acceptation :** E2E verts. Vérification navigateur de `/login`, `/register`,
`/forgot-password`, `/reset-password/[token]`, `/setup-password`, `/contact`,
`/e/[slug]/register` et `/account/profile` à 375 et 1280 px.

## Task 9 — Après fusion de 23 à 27 : conformité des fichiers exclus

**Préalable :** les branches 23, 25, 26, 27 et 24 sont fusionnées dans `development`, et
cette branche est rebasée dessus (ordre de la spec 22 : 28 fusionné en dernier).

- [ ] Rejouer la recherche de la task 1 et lister les fichiers clients apportés par 23 à
  27 : écran des jobs (`src/app/platform/jobs/**`), `NotificationBell` et pages
  `notifications`, contrôle de changement de catégorie de
  `src/app/account/registrations/[id]/**`, `ResubmitButton`.
- [ ] Pour chacun, vérifier les règles d'usage : hook ou `pending` sur `Button loading`,
  toast de succès et d'erreur, pas d'`Alert` éphémère, erreurs de champ sous les champs.
  Consigner le résultat dans la colonne Notes.
- [ ] Un écart **ne se corrige pas** dans ce chantier (fichier d'un autre propriétaire) :
  le signaler à l'utilisateur avec le fichier, la règle et le correctif proposé. Il
  décidera de la suite. Seule exception : le conflit de rebase d'un fichier de
  l'inventaire, à résoudre en gardant les deux changements.
- [ ] Rejouer les E2E des chantiers fusionnés touchés par le rebase.

**Critères d'acceptation :** liste de conformité complète. Écarts signalés, aucun
modifié sans accord.

## Task 10 — Documentation

**Fichiers :**
- Créer : `docs/v4/features/feedback-actions.md`
- Modifier : `docs/v4/README.md`, et `docs/v4/specs/2026-10-24-28-v4-feedback-actions.md`
  (statut « implémentée » seulement après la vérification finale).

- [ ] `features/feedback-actions.md` : primitives (`toast.ts` et `apiErrorMessage`,
  `ActionError`, `useAsyncAction`, `Button loading`/`variant="link"`,
  `Modal confirmLoading`, `ActionButton`). Ensuite, les **règles d'usage** recopiées de la
  spec, les motifs A à G avec un exemple court chacun, la convention `throw res` /
  `ActionError`, la liste `NON_USER_FACING_ERRORS` et la marche à suivre quand une route
  renvoie un nouveau message anglais. Enfin, les helpers e2e
  (`e2e/helpers/feedback.ts`). Style : français avec accents, comme les autres fiches.
- [ ] `docs/v4/README.md` : ajouter la spec 28 dans la liste des specs (liens Plan et
  Feature) et la fiche dans la liste des features.
- [ ] Ajouter `e2e/helpers/feedback.ts` à `e2e/README.md` s'il liste les helpers.

## Vérification finale

- [ ] `make lint` (0 erreur, 0 warning), `make typecheck`, `make test` (couverture via
  `make test-coverage` : seuils 100 % respectés).
- [ ] `make db-seed` (le test a vidé la base), puis `make test-e2e` complet. En cas
  d'échecs en série liés aux e-mails, vérifier d'abord le SMTP de la base de dev
  (`make db-seed` le répare).
- [ ] Navigateur, pour chaque espace (`/platform`, `/org`, `/event`, `/account`, public),
  à 375 × 812 puis 1280 px : une action en succès, une erreur (API coupée via les outils
  réseau ou un compte sans droit) et un double clic. Les toasts ne masquent ni
  « Ouvrir le menu » ni l'en-tête.
- [ ] `grep -rn "alert(" src/app src/components` ne renvoie plus de `alert()` natif dans
  l'inventaire. Lister les `<Alert` restantes des fichiers migrés : chacune est un bandeau
  permanent.
- [ ] Mettre à jour la Progression, puis commit **uniquement sur demande explicite de
  l'utilisateur**.

## Self-review

- **Couverture de la spec** : loader et `disabled` (motifs A à E, tasks 3 à 8) ; double
  clic (un E2E par espace) ; toast ou redirection explicite (motif D) ; erreur 500 par
  espace (tasks 3, 4, 5, 6 ; réseau coupé en 8) ; erreurs de champ (motif C, vigilance 5) ;
  actions longues (motif G : P13, E15) ; `Alert` permanentes gardées (P7, E2) ;
  `aria-busy` (`Button` du socle, testé en task 2) ; 375 / 1280 px (chaque task et
  vérification finale) ; exclusions et conformité finale (task 9) ; doc (task 10).
- **Contradiction spec ↔ code** : la spec affirme que le champ `error` de l'API est
  « déjà en français ». C'est faux pour la grande majorité des réponses d'erreur : elles
  renvoient un code (`NOT_FOUND` à lui seul apparaît 44 fois, puis `VALIDATION`,
  `ORG_FORBIDDEN`, les codes `AuthError`…), et six autres un message anglais. Ce plan choisit de filtrer côté client (task 2,
  `apiErrorMessage`) et de laisser chaque composant donner un repli précis, sans toucher
  aux routes. **Décision à valider par l'utilisateur** avant la task 2. L'alternative est
  de traduire les réponses des routes, mais cela touche de nombreuses routes, dont
  certaines sont modifiées par le chantier 24.
- **Extension du contrat C4** : `run(...args)` (actions par ligne) et la garde `useRef`
  ne sont ajoutés que si le socle ne les fournit pas. La signature à zéro argument reste
  compatible avec `ResubmitButton`.
- **Hors périmètre signalé** : `TeamForm.tsx` est du code mort ; les `confirm()` natifs
  sont conservés.
