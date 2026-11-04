# Vague 2 · Lot 2a — Public, authentification, e-mails, paiements — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2b et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2a feat/nouvelle-palette` (le script crée la branche
> `feat/nouvelle-palette-2a`, depuis `feat/nouvelle-palette`, **après** la vague 1). Toutes les
> commandes `make` se lancent **dans le worktree**. Sous-skill :
> `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. En
> exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan, messages en français ASCII, style conventional commits, sans co-auteur IA ; sinon aucun
> commit sans demande explicite de l'utilisateur. Modèle des sous-agents : `sonnet`.
> Commande de test ciblé : `make test FILE=<chemin>` ; e2e ciblé : `make test-e2e FILE=<chemin>`.

**Objectif :** faire passer le site public, les pages publiques d'évènement, l'authentification, les
e-mails transactionnels, les notifications par e-mail, l'e-mail de contact et le reçu de paiement
sur la palette « Deep Navy & Soft Gold », **couleurs uniquement** : aucune structure, aucun texte,
aucune mise en page ne change.

**Architecture :** les classes Tailwind en dur (`green-*`, `emerald-*`, `blue-*`, `sky-*`,
`amber-*`, `bg-brand-navy`, `bg-slate-50/100` de fond de page) sont remplacées **selon leur rôle**
par les couleurs du socle ; le HTML en ligne (`mail.ts`, `notify.ts`, `contact/route.ts`,
`receipt.ts`) lit les constantes `BRAND` de `src/lib/brand-colors.ts` au lieu de valeurs
hexa écrites en dur.

**Tech Stack :** Next.js 16, React 19, Tailwind 4, Vitest 4, Playwright.

**Spec :** [`specs/2026-11-04-39-v4-nouvelle-palette.md`](../specs/2026-11-04-39-v4-nouvelle-palette.md)
— « Décisions », « Lisibilité », « Arbitrages », « Organisation du travail » (lot 2a).

## Contrat du socle (consommé tel quel)

- Couleurs Tailwind : `navy`, `navy-hover`, `gold`, `gold-strong`, `gold-soft`, `turquoise`,
  `turquoise-strong`, `turquoise-soft`, `mist`, `line`, `nav-muted`, `warn`, `warn-soft`
  (`bg-navy`, `text-turquoise-strong`, `border-line`, `ring-navy`…). Valeurs : spec, « Arbitrages ».
- `src/lib/brand-colors.ts` exporte `BRAND` (hexa, clés camelCase : `navy`, `navyHover`,
  `gold`, `goldStrong`, `goldSoft`, `turquoise`, `turquoiseStrong`, `turquoiseSoft`, `mist`,
  `line`, `navMuted`, `warn`, `warnSoft`).
- Composants `src/components/ui/**` (`Button`, `Input`, badges, feedback…) déjà migrés : ne rien
  recolorer à leur place, les utiliser tels quels.
- Les anciennes variables (`--brand-navy`, `--brand-green`, `--accent*`, `--color-brand-navy`)
  existent encore jusqu'à la vague 3 mais **ne doivent plus être utilisées** par ce lot.
- Si une couleur ou une clé attendue manque dans le socle : s'arrêter et le signaler.

### Mapping par rôle (à appliquer partout dans le lot)

| Usage actuel | Nouveau |
|--------------|---------|
| `bg-green-600 hover:bg-green-700 text-white` (bouton principal, lien-bouton, pastille d'onglet active) | `bg-navy hover:bg-navy-hover text-white` |
| `text-green-600`, `text-green-700` sur un lien ou un sur-titre de section | `text-navy` (lien : `hover:underline`) |
| `border-green-600 text-green-700 hover:bg-green-50` (bouton secondaire) | `border-navy text-navy hover:bg-mist` |
| `focus:border-green-600 focus:ring-green-600` | `focus:border-navy focus:ring-navy` |
| `accent-green-600` | `accent-navy` |
| `bg-green-500/15 text-green-700` (pastille d'icône, lien actif de `AccountNav`) | `bg-mist text-navy` |
| même pastille sur fond marine : `bg-green-400/20 text-green-400` | `bg-gold/20 text-gold` (accent premium décoratif, pas une action) |
| `text-green-400` sur fond marine (sur-titre, unités de chiffres clés) | `text-gold` |
| `border-green-400`, `bg-green-400` du viseur de scanner (décor) | `border-turquoise`, `bg-turquoise`, `shadow-[0_0_12px_var(--color-turquoise)]` |
| `bg-green-500/85` (barres du graphique décoratif) | `bg-turquoise` |
| succès : `bg-emerald-50 text-emerald-700`, `text-green-700` sur un message de réussite, coche « Inclus » | `bg-turquoise-soft text-turquoise-strong` ; coche : `text-turquoise-strong` |
| en attente : `bg-amber-50 text-amber-700` (pastille) | `bg-gold-soft text-gold-strong` |
| avertissement : `bg-amber-50 border-amber-200 text-amber-900` | `bg-warn-soft border-warn/30 text-warn` |
| info : `text-sky-700`, `text-blue-600` (liens) | `text-navy` (lien) ; bloc d'information : `bg-mist text-navy` |
| `bg-brand-navy`, `text-brand-navy`, `bg-brand-navy/10` | `bg-navy`, `text-navy`, `bg-navy/10` |
| `bg-slate-50`, `bg-slate-100` de **fond de section ou de page** | `bg-white` (séparation par `border-line` en haut/bas de section) |
| `bg-slate-100` d'**avatar / vignette / puce interne** (initiales, aperçu) | `bg-mist` |
| `bg-slate-50` d'un bandeau interne (barre du navigateur factice, ligne de total) | `bg-mist` |
| `border-slate-100`, `border-slate-200` de séparation de **sections** (pas des cartes) | `border-line` ; les bordures de cartes et de champs restent `slate-200/300` |
| `hover:bg-slate-50` (bouton secondaire) | `hover:bg-mist` |
| texte `slate-*`, rouge/rose d'erreur (`rose-700`, `red-*`) | inchangés |
| bouton blanc sur marine (`styles.ts`), lien blanc `text-white/70` du pied | inchangés ; lien actif de l'en-tête sombre : blanc + `underline decoration-gold decoration-2 underline-offset-8` |

**Exceptions (ne pas toucher)** : couleurs de données des maquettes marketing (`#0ea5e9`,
`#8b5cf6`, `#f59e0b` des catégories factices, QR et fond `#0f172a` / `#1e293b` du scanner et du
badge factice), `rgba(15,23,42,…)` d'ombre. Le garde-fou de la vague 3 ne couvre pas ces hexa
(ce n'est ni `#004d74` ni `#4f46e5`).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|------|----------|--------|------|-------|
| 1 | Vérifier le contrat du socle, état initial (tests et e2e du lot) | [x] | 2026-11-04 | contrat OK, etat initial vert |
| 2 | Composants marketing partagés (`src/components/marketing/**`) | [x] | 2026-11-04 |  |
| 3 | Pages du site public (`src/app/(marketing)/**`) | [x] | 2026-11-04 |  |
| 4 | Pages publiques d'évènement et de vérification (`public`, `e`, `verify`) | [x] | 2026-11-04 |  |
| 5 | Authentification (`auth`, login, register, mots de passe, `select`) | [x] | 2026-11-04 |  |
| 6 | E-mails transactionnels `mail.ts` | [x] | 2026-11-04 |  |
| 7 | Notifications par e-mail, e-mail de contact, `mail-helpers` | [x] | 2026-11-04 |  |
| 8 | Module paiements : composants et reçu HTML | [x] | 2026-11-04 |  |
| 9 | Tests unitaires du lot mis à jour | [x] | 2026-11-04 |  |
| 10 | e2e, contrôle visuel, vérification | [x] | 2026-11-04 | grep vide hors exceptions, typecheck, lint, tests cibles verts ; e2e non lances (consigne) |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Après chaque task
validée : statut `[x]` + date ; en cas d'interruption : `[~]`, date et état précis (step en
cours, fichiers touchés).

## Fichiers du lot (exclusifs)

Source : spec, « Organisation du travail — 2a ». Les `__tests__` associés sont inclus.

- `src/app/(marketing)/**`, `src/components/marketing/**`, `src/components/public/**` (sauf `src/components/public/AccountNav.tsx`, socle)
- `src/app/e/**`, `src/app/login/**`, `src/app/register/**`, `src/app/forgot-password/**`,
  `src/app/reset-password/**`, `src/app/setup-password/**`, `src/app/verify/**`,
  `src/app/verify-email/**`, `src/app/select/**`, `src/components/auth/**`
- `src/lib/mail.ts`, `src/lib/mail-helpers.ts`, `src/lib/notifications/**`,
  `src/app/api/contact/**`, `src/components/payments/**`
- Tests : `src/lib/__tests__/mail*.ts` (tests de `mail.ts` / `mail-helpers.ts`),
  `src/lib/notifications/__tests__/**`, `src/components/{marketing,public,payments}/__tests__/**`,
  `src/app/api/contact/__tests__/**`, tests de pages du lot s'il en existe.
- e2e du lot (mise à jour de sélecteurs uniquement si une couleur ou une classe y est lue) :
  `e2e/public/*.spec.ts`, `e2e/org/payments.spec.ts`, `e2e/platform/payments.spec.ts`.

**Lecture seule (contrats du socle et fichiers des autres lots)** : `src/app/globals.css`,
`src/lib/brand-colors.ts`, `src/components/ui/**`, `src/components/layout/**`, tout le reste de
`src/`. **Besoin d'y toucher → s'arrêter et le signaler.** `src/components/payments/**` est à ce
lot seul : le lot 2c n'y touche pas (il est utilisé par `/org/.../payments`).

## Global Constraints

Règles de test de `CLAUDE.md` (« Règles de test », tous les tests présents et futurs) :

- **Base de test dédiée** : Vitest tourne sur une base dont le nom finit par `_test`
  (`badge_<lot>_test` pour un agent) ; garde-fou dans `src/test-setup.ts`.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent
  (FedaPay, SMTP réel, renderer via `fakeExporter`, session NextAuth).
- **Fabriques** : `src/test/factories.ts` (`@faker-js/faker`, graine fixée par fichier) ; ajouter
  une fabrique plutôt que dupliquer des `prisma.*.create`.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander. Ici, seuls les **tests** qui vérifient du HTML ou des classes
  sont adaptés à la nouvelle palette.
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**` (gate dans `vitest.config.ts`).
- **e2e** (Playwright) : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.
- **Couleurs uniquement** : aucun changement de structure, de texte, de rôle ARIA ni d'ordre du
  DOM (les e2e par rôle/texte doivent tenir sans modification).
- Textes visibles en français avec accents ; code en anglais ; commits en français ASCII.

## Review Focus

- Chaque `green-*` / `emerald-*` / `blue-*` / `sky-*` / `amber-*` / `brand-navy` du lot est
  remplacé **selon son rôle** (tableau de mapping), pas mécaniquement par teinte ; aucun
  `#4f46e5`, `#16a34a`, `#004d74`, `#059669` ne subsiste dans le lot.
- Contraste (spec, « Lisibilité ») : jamais de texte blanc sur turquoise ni d'or en texte sur
  fond blanc ; texte de succès en `turquoise-strong`, « en attente » en `gold-strong`.
- Pages publiques : plus aucun fond `bg-slate-50/100` de page ou de section ; sections séparées
  par `border-line` ; en-tête, pied et bandeau CTA restent marine.
- E-mails et reçu : valeurs issues de `BRAND` (aucun hexa de marque en dur), styles en
  ligne conservés (pas de variable CSS, pas de classe), rendu correct dans Mailpit.
- Exceptions respectées (couleurs de données des maquettes) ; aucun fichier hors lot modifié.
- Aucune régression : mêmes textes, mêmes rôles ARIA, mêmes liens ; e2e du lot verts.

---

### Task 1 : Contrat du socle et état initial

- [ ] Dans le worktree, vérifier que le socle est fusionné : `grep -n "turquoise-strong\|gold-soft\|warn-soft" src/app/globals.css` et que `src/lib/brand-colors.ts` exporte `BRAND` avec les 13 clés (contrat du socle : `export const BRAND = {...} as const`). Sinon : s'arrêter et le signaler.
- [ ] Lancer `make test FILE=src/components/marketing`, `FILE=src/components/payments`, `FILE=src/lib/notifications`, `FILE=src/app/api/contact`, `FILE=src/lib/__tests__/mail.test.ts` et noter l'état initial (tous verts attendus).
- [ ] Repérage : `grep -rnE "green-|emerald-|blue-|sky-|amber-|brand-navy|slate-50|slate-100|#4f46e5|#16a34a|#059669" <fichiers du lot>` ; la liste doit correspondre aux tasks 2 à 8 ; tout fichier du lot non prévu est traité dans la task de sa zone.

### Task 2 : Composants marketing partagés

Fichiers : `src/components/marketing/*.tsx|ts` (hors `PricingCards.tsx`, déjà sans couleur en dur : le vérifier, il délègue à `PricingGrid`).

- [ ] `styles.ts` : bouton principal `bg-green-600 … hover:bg-green-700` → `bg-navy … hover:bg-navy-hover` ; secondaire `border-slate-200 text-slate-700 hover:bg-slate-50` → `border-line text-navy hover:bg-mist` ; les deux variantes sur fond marine (blanc plein et verre) inchangées.
- [ ] `PublicSiteHeader.tsx` : lien actif `text-green-600` → `text-navy` avec repère `underline decoration-gold decoration-2 underline-offset-8` (l'en-tête reste blanc translucide : la spec ne le rend sombre que pour pied et CTA ; garder `bg-white/90`, `border-line`) ; bouton « Se connecter » `border-slate-200 hover:bg-slate-50` → `border-line text-navy hover:bg-mist` ; bouton principal (desktop et menu mobile) `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover` ; séparateur du menu mobile `border-slate-200` → `border-line`.
- [ ] `PublicSiteFooter.tsx` : `bg-brand-navy` → `bg-navy` (liens blancs conservés).
- [ ] `CtaBand.tsx` : `bg-brand-navy` → `bg-navy`. `SectionHeading.tsx` : sur-titre `text-green-600` → `text-navy`, `text-green-400` (sur marine) → `text-gold`. `LegalLayout.tsx` : lien retour `text-green-600` → `text-navy`.
- [ ] `ComparisonTable.tsx` : coche `text-green-600` → `text-turquoise-strong` ; `border-slate-100` de lignes → `border-line` ; ligne `bg-slate-50` (total/titre de groupe) → `bg-mist`.
- [ ] `BrowserMock.tsx` : barre `border-slate-100 bg-slate-50` → `border-line bg-mist`. `FaqAccordion.tsx` : vérifier les séparateurs (`border-*`) → `border-line`. `BadgeCredential.tsx` : liseré `bg-brand-navy` → `bg-navy`, `text-brand-navy` → `text-navy`, pastilles `bg-slate-100` → `bg-mist` (couleur de catégorie, QR et `#0f172a` inchangés). `ScannerMock.tsx` : coins et ligne de balayage `green-400` → `turquoise` (ombre `#4ade80` → `var(--color-turquoise)`).
- [ ] Mettre à jour `src/components/marketing/__tests__/**` si une assertion lit une classe ou une couleur remplacée. `make test FILE=src/components/marketing`.

### Task 3 : Pages du site public

Fichiers : `src/app/(marketing)/{page,fonctionnalites/page,a-propos/page,tarifs/page,contact/page,contact/ContactForm,confidentialite/page,cgu/page,mentions-legales/page,layout}.tsx`.

- [ ] Pour chaque fichier, appliquer le tableau de mapping. Détail non évident :
  - `page.tsx` et `fonctionnalites/page.tsx` : `bg-green-500/15 text-green-700` (pastilles d'icône) → `bg-mist text-navy` ; sur-titres `text-green-600` → `text-navy` ; sur section marine, `text-green-400` et pastilles `bg-green-400/20 text-green-400` → `text-gold` / `bg-gold/20 text-gold` ; statut « approuvé » de la fausse table `bg-emerald-50 text-emerald-700` → `bg-turquoise-soft text-turquoise-strong` ; « en attente » `bg-amber-50 text-amber-700` → `bg-gold-soft text-gold-strong` (refusé en rouge : inchangé) ; `bg-brand-navy` → `bg-navy` ; `bg-brand-navy/10 text-brand-navy` → `bg-navy/10 text-navy` ; le bouton factice « Soumettre » `bg-green-600` → `bg-navy` ; carte de catégorie sélectionnée `border-green-600 bg-emerald-50` → `border-navy bg-mist`.
  - Sections `bg-slate-50` (≈ 8 occurrences sur `page`, `fonctionnalites`, `a-propos`, `tarifs`) → `bg-white` ; leurs `border-b border-slate-200` de section → `border-b border-line` ; comme deux sections blanches contiguës se confondent, ajouter `border-t border-line` à la seconde (traits fins, sans changer les espacements). Cartes `border-slate-200 bg-white` inchangées. Puces d'avatar `bg-slate-100` → `bg-mist`.
  - `a-propos/page.tsx` : barres décoratives `bg-green-500/85` → `bg-turquoise` ; chiffres `text-green-400` → `text-gold`.
  - Lien « Voir tous les tarifs » `text-green-600` → `text-navy`.
  - `tarifs/page.tsx` : les deux sections `bg-slate-50` → `bg-white` avec `border-line` ; plan mis en avant : voir task 8 (`PricingGrid`, or).
  - `contact/ContactForm.tsx` : champ `focus:border-green-600 focus:ring-green-600` → `focus:border-navy focus:ring-navy` ; message de succès `bg-emerald-50 text-green-600` → `bg-turquoise-soft text-turquoise-strong` ; case `accent-green-600` → `accent-navy` ; lien `text-green-600` → `text-navy`. `contact/page.tsx` : sur-titre, pastilles d'icône et survol `hover:text-green-600` → `hover:text-navy`.
  - `layout.tsx` (`bg-white text-slate-900`), pages légales : vérifier, probablement sans changement.
- [ ] `grep -rnE "green-|emerald-|amber-|brand-navy|bg-slate-(50|100)" "src/app/(marketing)"` ne renvoie plus que les exceptions (aucune attendue hors `bg-slate-100` interne converti).

### Task 4 : Pages publiques d'évènement et de vérification

Fichiers : `src/components/public/*`, `src/app/e/**`, `src/app/verify/[badgeId]/page.tsx`.

- [ ] `PublicEventLayout.tsx` : en-tête `bg-brand-navy` → `bg-navy` (pastille de logo `bg-white/10` inchangée) ; pied `border-t bg-white` → `border-t border-line bg-white`.
- [-] `AccountNav.tsx` : **fichier du socle** (tâche 4b, menu clair partagé) — ne pas y toucher.
- [ ] `BadgeVerifyView.tsx` : vignette `bg-slate-100` → `bg-mist`, séparateur `border-slate-100` → `border-line` ; statuts de validité : tout vert/ambre éventuel suit le tableau (succès → turquoise, avertissement → `warn`).
- [ ] `e/[slug]/page.tsx` : boutons `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover` ; bouton secondaire `border-green-600 text-green-700 hover:bg-green-50` → `border-navy text-navy hover:bg-mist`.
- [ ] `e/[slug]/success/page.tsx` : texte `text-sky-700` → `text-navy` ; séparateur `border-slate-100` → `border-line` ; boutons et lien `mailto` comme ci-dessus.
- [ ] `e/[slug]/register/page.tsx` : encart `bg-amber-50 border-amber-200 text-amber-900` : avertissement → `bg-warn-soft border-warn/30 text-warn` ; lien `text-green-700` → `text-navy`. `closed.tsx`, `RegisterEventForm.tsx` : vérifier (`border bg-white` inchangés ; composants `ui` déjà migrés).
- [ ] `verify/[badgeId]/page.tsx` : fond de page éventuel gris → blanc.
- [ ] Tests : `make test FILE=src/components/public`.

### Task 5 : Authentification

Fichiers : `src/components/auth/*`, `src/app/{login,register,forgot-password,reset-password,setup-password,verify-email,select}/**`.

- [ ] `AuthCard.tsx` : fond `bg-slate-50` → `bg-white` ; la carte reste `border-slate-200 bg-white` ; séparateur du pied `border-slate-100` → `border-line` ; mettre à jour le commentaire d'en-tête (« Fond blanc »).
- [ ] `select/page.tsx` : fond `bg-slate-50` → `bg-white`.
- [ ] Liens `text-green-600 hover:underline` → `text-navy hover:underline` : `login/page.tsx` (×2), `register/page.tsx` (×2), `register/success/page.tsx`, `forgot-password/page.tsx`, `verify-email/[token]/page.tsx` (×2).
- [ ] Bouton `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover` : `reset-password/[token]/page.tsx`, `verify-email/[token]/page.tsx` (boutons principaux : marine, pas turquoise).
- [ ] Indicateur de robustesse (`reset-password/[token]/page.tsx`, `SetupPasswordForm.tsx`) : `text-green-700` → `text-turquoise-strong` (réussi) ; `text-rose-700` inchangé. Message « Compte créé. » (`register/page.tsx`) `text-green-700` → `text-turquoise-strong`.
- [ ] `Recaptcha*.tsx`, `LogoutButton.tsx`, `layout.tsx` des pages : vérifier, sans changement attendu.
- [ ] `make typecheck` ; relecture visuelle rapide de `/login` après la task 10.

### Task 6 : E-mails transactionnels (`src/lib/mail.ts`)

- [ ] Importer `BRAND` et remplacer les hexa de marque dans le gabarit commun (≈ lignes 190-210) : fond du corps et du tableau `#f1f5f9` → `BRAND.mist` ; bandeau d'en-tête `#0f172a` → `BRAND.navy` ; bordures `#e2e8f0` → `BRAND.line` (carte, pied, bloc du badge ≈ ligne 325). Les gris de texte (`#334155`, `#64748b`, `#94a3b8`) et le texte blanc restent des valeurs slate (la spec garde `slate` pour le texte).
- [ ] Boutons (vérification d'e-mail ≈ 466, réinitialisation ≈ 506, invitation ≈ 642 et 688, resoumission ≈ 352) : `background-color:#4f46e5` → `${BRAND.navy}` ; texte blanc conservé. Liens (`color:#4f46e5` ≈ 330, 565, 760, 797) → `${BRAND.navy}`.
- [ ] Mots « approuvée » / « validé » (`#059669` ≈ 323, 759) → `${BRAND.turquoiseStrong}` ; « rejetée » / « refusés » (`#e11d48`) inchangés.
- [ ] Conserver l'échappement existant des chaînes interpolées ; les couleurs viennent de constantes internes, jamais d'une entrée utilisateur. `grep -nE "#4f46e5|#059669|#0f172a|#f1f5f9" src/lib/mail.ts` ne renvoie plus rien.
- [ ] Mettre à jour `src/lib/__tests__/mail*.ts` si une assertion lit une couleur (aucune trouvée au repérage : à vérifier) ; `make test FILE=src/lib/__tests__/mail.test.ts` (couverture 100 % de `mail.ts` conservée).

### Task 7 : Notifications par e-mail, contact, helpers

- [ ] `src/lib/notifications/notify.ts` (≈ ligne 39) : bouton `background-color:#16a34a` → `BRAND.navy` (action principale : marine, texte blanc) ; importer la constante.
- [ ] `src/app/api/contact/route.ts` (≈ lignes 56-61) : libellés `color:#64748b` (gris de texte) inchangés ; si le gabarit contient une bordure, un lien ou un fond de marque, utiliser `BRAND.navy` / `line` / `mist`. Le contenu et l'échappement ne changent pas.
- [ ] `src/lib/mail-helpers.ts` et le reste de `src/lib/notifications/**` : vérifier l'absence de couleur de marque (aucune au repérage) ; aucun changement attendu.
- [ ] Tests : `src/lib/notifications/__tests__/**` (`notify.test.ts`) et `src/app/api/contact/__tests__/**` ; adapter toute assertion sur `#16a34a` ou sur le HTML ; `make test FILE=src/lib/notifications` et `FILE=src/app/api/contact` ; couverture 100 % conservée.

### Task 8 : Module paiements — composants et reçu

Fichiers : `src/components/payments/{PricingGrid,PaymentFilters,PaymentsTable,PaymentDetailView,receipt,status}.*`.

- [ ] `PricingGrid.tsx` : carte principale `border-slate-200 bg-white` inchangée ; sélecteur de période actif `bg-green-600 text-white` → `bg-navy text-white` ; **plan mis en avant** : `border-green-600 shadow-[0_0_0_1px_var(--color-green-600,#16a34a)]` → `border-gold shadow-[0_0_0_1px_var(--color-gold)]` ; pastille « Populaire » `bg-green-600 text-white` → `bg-gold text-navy` (marine sur or : 9,4) ; coches des fonctionnalités `text-green-600` → `text-turquoise-strong` ; `border-slate-100` → `border-line`. Le bouton de souscription (`Button` du socle) reste inchangé.
- [ ] `PaymentFilters.tsx` : bouton `bg-green-600 hover:bg-green-700` → `bg-navy hover:bg-navy-hover`.
- [ ] `PaymentsTable.tsx`, `PaymentDetailView.tsx` : liens `text-blue-600` → `text-navy` (×4). `status.ts` : libellés seulement, sans couleur ; vérifier que les pastilles de statut passent par le composant `ui` (réussi turquoise, en attente or) sans classe locale.
- [ ] `receipt.ts` : importer `BRAND` ; fond `body` `#f1f5f9` → `BRAND.mist`, bordures `#e2e8f0` et `#f1f5f9` → `BRAND.line`, bouton `#16a34a` → `BRAND.navy` (texte blanc) ; si un statut « Payé » est coloré en vert, `BRAND.turquoiseStrong`. Le texte `#0f172a` / `#64748b` (slate) et le CSS `@media print` restent. Interpoler via template string dans le `<style>` (valeurs constantes, pas d'entrée utilisateur).
- [ ] Tests : `src/components/payments/__tests__/**` ; adapter les assertions sur classes (`bg-green-600`…) ou sur le HTML du reçu. `make test FILE=src/components/payments`.

### Task 9 : Tests unitaires du lot

- [ ] `grep -rnE "green-|emerald|slate-50|slate-100|4f46e5|16a34a|059669|brand-navy|amber|blue-" src/components/{marketing,public,payments}/__tests__ src/lib/notifications/__tests__ src/app/api/contact/__tests__ src/lib/__tests__/mail*.ts` : adapter chaque assertion de classe ou de couleur à la nouvelle valeur (jamais le code de prod).
- [ ] Ajouter, si absent, une assertion par e-mail testé que le bouton principal utilise `BRAND.navy` (import de la constante, pas d'hexa en dur dans le test), et que le reçu contient `BRAND.navy`.
- [ ] `make test-coverage` : 100 % sur `src/lib/**` et `src/app/api/**` conservé.

### Task 10 : e2e, contrôle visuel, vérification

- [ ] e2e existants du lot (aucune structure ne change : ils doivent passer **sans modification** ; sinon corriger le sélecteur du test, pas la page). Lancer, un fichier à la fois et sans parallélisme sur la même stack :
  - public : `make test-e2e FILE=e2e/public/marketing.spec.ts`, `login.spec.ts`, `register.spec.ts`, `password-reset.spec.ts`, `setup-password.spec.ts`, `select.spec.ts`, `badge-verify.spec.ts`, `event-register.spec.ts`, `event-register-newcomer.spec.ts`, `recaptcha.spec.ts`, `misc.spec.ts` ;
  - paiements : `e2e/org/payments.spec.ts`, `e2e/platform/payments.spec.ts` ;
  - transverse : `e2e/transverse/feedback-public.spec.ts`, `e2e/transverse/responsive.spec.ts`.
  Note : `e2e/public/marketing.spec.ts` lit `div.text-base.font-semibold` (titre de carte de plan) : ne pas retirer ces classes de `PricingGrid`.
- [ ] Contrôle visuel à **375, 1024 et 1280 px** (le menu latéral n'est pas concerné ici ; pages publiques seulement), dans la stack du lot : accueil `/`, `/tarifs` (plan mis en avant en or), une page `/e/<slug>` (inscription ouverte) et `/e/<slug>/register`, `/login` ; relire aussi `/fonctionnalites`, `/contact`, `/forgot-password`. Vérifier : plus de fond gris, sections séparées par un trait, en-tête sobre (lien actif souligné or), pied et bandeau CTA marine, boutons marine texte blanc, aucun texte blanc sur turquoise ni or en texte sur blanc.
- [ ] **E-mails** : déclencher une vérification d'e-mail (`/register`) et une réinitialisation de mot de passe (`/forgot-password`) ; ouvrir les messages dans Mailpit (`localhost:8025` ou `mail.badge.local`, port de la stack du lot) : bandeau marine, bouton marine texte blanc, lien marine, fond `mist`. Idem pour une notification (`notify.ts`) et l'e-mail de contact si accessible.
- [ ] **Reçu** : ouvrir le reçu d'un paiement (`/org/<id>/payments/<id>/receipt`, ou via un paiement du seed démo) : bouton « Imprimer » marine, fond `mist`, bordures `line`, aperçu d'impression sans fond.
- [ ] Documentation : si une doc de `docs/v4/features/` décrit les couleurs du site public ou des e-mails, la mettre à jour dans ce lot ; sinon aucune doc à modifier (la spec fait foi).
- [ ] Dernière vérification : `make lint && make typecheck && make test-coverage`, puis les e2e ci-dessus ; rapporter les sorties dans la progression et passer les tasks à `[x]`.
