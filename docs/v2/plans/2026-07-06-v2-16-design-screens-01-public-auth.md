# Port des maquettes v2-16 — Espace Public & Authentification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Porter le **contenu** des pages publiques et d'authentification (+ compte participant) a la fidelite des maquettes `template/` du bundle Claude Design, en remplacant le rendu JSX existant par une composition des composants transverses du plan directeur, **sans** modifier la logique metier (data-fetching, server actions, RBAC, validation). Seule exception « new » : la landing marketing publique (`accueil.html`), aujourd'hui absente.

**Architecture:** Reskin de contenu. Chaque page cible conserve integralement sa logique (chargement Prisma, `getServerSession`, redirections, appels `fetch` vers les routes API, `use client` la ou il existe deja) et voit son balisage reconstruit avec les composants du directeur (`AuthCard`, `Alert`, `SuccessRing`, `PasswordMeter`, `RadioCards`, `Checkbox`, `FileBox`/`Dropzone`, `BadgeCard`, `VerifyBanner`, `Timeline`, `KeyValue`, `EmptyState`, `PickCard`/`PickCardDashed`/`OrgLogo`, `StatusBadge`, `Icon`, primitives `ui/`). Aucune nouvelle route (sauf le rendu conditionnel de la landing sur `/`), aucun nouveau helper, aucun `badge.css` importe : utilitaires Tailwind v4 + tokens v2-15.

**Tech Stack:** Next.js 16 (App Router, Server Components par defaut ; `use client` conserve tel quel), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `lucide-react` (via `Icon`), `next-auth`, Prisma 6, `@react-pdf/renderer` (rendu badge, inchange). Verification : `make typecheck`, `make lint`, `make test` (conteneur Docker dev) + controle visuel navigateur (3 viewports).

**Reference visuelle autoritaire :** dossier `template/` a la racine du repo — `accueil.html`, `connexion.html`, `mot-de-passe.html`, `inscription-publique.html`, `confirmation.html`, `apercu-badge.html`, `verification-badge.html`, `participant-dashboard.html`, `participant-inscription.html`, `participant-profil.html`, `selecteur-organisation.html` + `template/assets/badge.css` (valeurs exactes).

**Spec :** [`../specs/2026-07-06-v2-16-design-screens-port.md`](../specs/2026-07-06-v2-16-design-screens-port.md)
**Plan directeur (API des composants — prerequis) :** [`2026-07-06-v2-16-design-screens-00-directeur.md`](2026-07-06-v2-16-design-screens-00-directeur.md)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre. Apres chaque task validee (typecheck + lint + tests verts + revue visuelle OK), passer `[ ]` a `[x]` et dater. Mi-task -> `[~]` + note d'etat (step en cours, fichiers touches, prochaine etape). Abandon -> `[-]` + raison.

Legende : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [x] | 2026-07-06 | Pre-flight OK : directeur implemente (composants presents), typecheck+lint baseline verts. |
| 1  | [x] | 2026-07-06 | Landing `LandingView.tsx` + rendu conditionnel sur `/` (branche authentifiee inchangee). typecheck+lint OK, test 657/657. Revue visuelle = manuelle. |
| 2  | [x] | 2026-07-06 | `/login` reskine (Alert/Spinner/sous-titre/pied/lien mdp oublie) + `AuthCard` enrichi (subtitle/footer). typecheck+lint OK, test 657/657. |
| 3  | [x] | 2026-07-06 | `/forgot-password` reskine (SuccessRing/Alert/Spinner, etat done). Logique anti-enumeration preservee. typecheck+lint OK. |
| 4  | [x] | 2026-07-06 | `/reset-password/[token]` reskine (PasswordMeter + score client, Alert/Spinner/SuccessRing). Validation <6/concordance et POST preserves. typecheck+lint OK. |
| 5  | [x] | 2026-07-06 | `SetupPasswordForm` reskine (Input/Button/Alert/Spinner/PasswordMeter). Titre generique conserve (prenom non charge, YAGNI). Validation+POST preserves. typecheck+lint OK. |
| 6  | [x] | 2026-07-06 | `/verify-email/[token]` bascule sur AuthCard + SuccessRing (succes) / Alert (erreur). `verifyToken`/`resolveBaseUrl` preserves. typecheck+lint OK. |
| 7  | [ ] | | Presentation evenement public `/e/[slug]` (hero + categories + CTA). |
| 8  | [ ] | | Formulaire d'inscription `/e/[slug]/register` (`RadioCards` + `Checkbox`). |
| 9  | [ ] | | Confirmation `/e/[slug]/success` (`SuccessRing` + `FileBox`). |
| 10 | [ ] | | Apercu badge `/badge/[id]` (`BadgeCard` + boutons). |
| 11 | [ ] | | Verification badge `/verify/[badgeId]` (`VerifyBanner`, 3 cas). |
| 12 | [ ] | | Tableau de bord participant `/account` (+ layout, cartes, `EmptyState`). |
| 13 | [ ] | | Detail inscription `/account/registrations/[id]` (`KeyValue`, `Timeline`, `FileBox`). |
| 14 | [ ] | | Profil `/account/profile` (+ `/complete`) (banniere, photo, mot de passe, zone danger). |
| 15 | [ ] | | Selecteur d'organisation `/select` (`PickCard` / `PickCardDashed` / `OrgLogo`). |

---

## Dependance

Ce plan **depend du plan directeur** ([`00-directeur`](2026-07-06-v2-16-design-screens-00-directeur.md), tasks 0.5–21). Tous les composants consommes ci-dessous (`Icon`, `Alert`, `EmptyState`, `SuccessRing`, `Spinner`, `PasswordMeter`, `RadioCards`, `Checkbox`, `FileBox`, `Dropzone`, `Timeline`/`TimelineItem`, `KeyValue`, `BadgeCard`, `VerifyBanner`, `PickCard`/`PickCardDashed`/`OrgLogo`, `CatPill`) sont crees par le directeur. **Implementer ce sous-plan APRES le directeur.** Si une task ci-dessous reclame un composant absent du directeur, l'ajouter d'abord au directeur (et le signaler dans son tracker), pas ici.

Prerequis complementaire : le socle v2-15 (tokens, `AuthCard`, `PublicEventLayout`, primitives `ui/`, `StatusBadge`) reste la base (non commite).

---

## Global Constraints

Voir les **contraintes globales du plan directeur** (accent vert unique `green-600`/`green-700`, plat sauf modales, neutres slate, Inter (`font-sans`) / Montserrat (`font-badge`), `focus-visible` AA, `tabular-nums` pour IDs/dates numeriques, aucune `shadow-*` hors modale). Rappels specifiques a ce lot :

- **PRESERVER la logique** : ne toucher ni au data-fetching Prisma, ni aux `getServerSession`/redirections, ni aux appels `fetch` des routes API, ni aux server actions, ni a la validation. Un reskin ne change que le **rendu**. Si un ecran expose une nouvelle affordance UI (ex. compteur de robustesse), la cabler sur des donnees deja disponibles cote client — ne pas inventer d'endpoint.
- **Ne pas exposer de secret** : rien de nouveau ici, mais ne pas afficher de token brut d'invitation / reset dans le JSX (les pages recoivent le token en param et le POSTent — le garder hors du rendu visible).
- **Langue UI** : francais **avec accents** (é, è, à, ç, ê). Voix neutre/administrative, pas d'emoji. Reprendre les libelles exacts des maquettes (« Se connecter », « Envoyer le lien », « Activer mon compte », « Badge valide », etc.).
- **`use client` inchange** : les pages deja client (`login`, `register`, `forgot-password`, `reset-password`, `setup-password`, `RegisterEventForm`, `ProfileForm`, `badge/[id]`) le restent ; les pages serveur (`e/[slug]`, `success`, `verify`, `account*`, `select`, `verify-email`, `setup-password/page`) le restent. Les composants a etat du directeur (`RadioCards`, `Checkbox`, `PasswordMeter`, `Dropzone`) ne s'importent que dans un fichier client.
- **Verification** : `make typecheck && make lint && make test` verts + controle visuel. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur.

---

### Task 0: Pre-flight

**Files:** aucun (verification d'environnement).

- [x] **Step 1: Branche + conteneurs**

Run: `git branch --show-current && make dev`
Expected: `feat/design_implementation` ; conteneurs `app`/`mysql`/`mailpit` up.

- [x] **Step 2: Directeur implemente**

Run: `ls src/components/ui/Icon.tsx src/components/ui/Feedback.tsx src/components/ui/PasswordMeter.tsx src/components/ui/RadioCards.tsx src/components/ui/FileBox.tsx src/components/ui/Timeline.tsx src/components/ui/PickCard.tsx src/components/ui/VerifyBanner.tsx src/components/ui/JournalBlocks.tsx src/components/ui/Labels.tsx src/components/badge/BadgeCard.tsx`
Expected: tous presents. Si absent : **STOP**, implementer le directeur d'abord.

- [x] **Step 3: Baseline verte**

Run: `make typecheck && make lint`
Expected: typecheck OK, lint 0 erreur (warnings preexistants toleres).

---

### Task 1: Landing publique (accueil)

**Nature : NEW.** Seul element non-reskin du lot. `src/app/page.tsx` redirige aujourd'hui l'utilisateur **non connecte** vers `/login` (ligne `if (!session?.user?.id) redirect("/login")`). **Decision** (spec, decision utilisateur) : servir la landing marketing a `/` pour le visiteur **non authentifie** ; l'utilisateur **authentifie** continue de rediriger via `resolveHomeRedirect(ctx, null)` (comportement inchange). Route retenue : rendu conditionnel sur `/` (pas de nouvelle route `/accueil`), pour ne pas casser les liens existants vers `/`.

**Files:**
- Modify: `src/app/page.tsx` (rendre `<LandingView />` quand pas de session au lieu de rediriger vers `/login`)
- Create: `src/components/public/LandingView.tsx` (Server Component, presentational)

**Reference maquette:** `template/accueil.html` — hero (bouclier vert `#36ab58` + « B », titre, sous-titre, CTA « Se connecter »), 3 features (`user-check`, `id-card`, `scan-line`), footer mentions legales.

**Composants:** `Button` (primitive), `Icon` (`arrow-right`, `user-check`, `id-card`, `scan-line`), `next/link`, `next/image` (logo).

- [x] **Step 1: Lire l'existant + preserver la redirection authentifiee**

Lire `src/app/page.tsx` (deja lu : `getServerSession` -> `loadUserContext` -> `resolveHomeRedirect`). Conserver strictement la branche authentifiee. Ne modifier que la branche « pas de session ».

- [x] **Step 2: Reconstruire**

`page.tsx` :
```tsx
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <LandingView />; // <- au lieu de redirect("/login")

  const ctx = await loadUserContext(session.user.id);
  redirect(resolveHomeRedirect(ctx, null));
}
```

`LandingView.tsx` (extrait representatif) :
```tsx
export function LandingView() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center px-8 py-5">
        <Image src="/logo.png" alt="Badge" width={120} height={30} className="h-[30px] w-auto object-contain" />
        <span className="flex-1" />
        <Link href="/login" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Se connecter
        </Link>
      </nav>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center">
        <svg viewBox="0 0 40 40" className="mb-7 h-[72px] w-[72px]" aria-hidden>
          <path d="M20 2.5 L34 7.2 V19 C34 28.4 27.9 34.6 20 37.5 C12.1 34.6 6 28.4 6 19 V7.2 Z" fill="#36ab58" />
          <text x="20" y="27" fontFamily="var(--font-badge)" fontSize="20" fontWeight="700" fill="#fff" textAnchor="middle">B</text>
        </svg>
        <h1 className="max-w-[660px] text-[40px] font-semibold leading-[1.12] tracking-tight text-slate-900">
          La gestion de badges, simple et maîtrisée.
        </h1>
        <p className="mt-3.5 max-w-[520px] text-[17px] leading-relaxed text-slate-500">
          Inscriptions en ligne, modération, génération de badges PDF avec QR code et contrôle
          d&apos;accès par scan — pour vos événements professionnels et institutionnels.
        </p>
        <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700">
          Se connecter <Icon name="arrow-right" size={16} />
        </Link>
        <div className="mt-16 flex flex-wrap justify-center gap-10">
          {[
            { icon: "user-check", t: "Inscription & modération", d: "Collectez et approuvez les inscriptions en ligne." },
            { icon: "id-card", t: "Badges PDF + QR", d: "Générez des badges prêts à imprimer." },
            { icon: "scan-line", t: "Contrôle d'accès", d: "Vérifiez chaque entrée par scan." },
          ].map((f) => (
            <div key={f.t} className="flex max-w-[180px] flex-col items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-green-600">
                <Icon name={f.icon} size={20} />
              </span>
              <span className="text-sm font-semibold text-slate-900">{f.t}</span>
              <span className="text-[13px] leading-snug text-slate-400">{f.d}</span>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-slate-200 px-6 py-6 text-center text-[13px] text-slate-400">
        © 2026 Badge · Plateforme multi-organisation et multi-rôles ·{" "}
        <a href="#" className="text-green-600 hover:underline">Mentions légales</a>
      </footer>
    </div>
  );
}
```
> `arrow-right` doit exister au registre `Icon` (directeur Task 0.5) ; sinon l'y ajouter et le noter dans le tracker du directeur.

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — `/` deconnecte (naviguer en navigation privee ou apres signout) sur 375/768/1440. Verifier : bouclier vert, titre 40px desktop qui reste lisible en mobile (le titre passe en `text-3xl` sous 640px si necessaire), 3 features en ligne desktop / empilees mobile, footer. `/` **connecte** redirige toujours (staff/org). `make test` reste vert.

**Acceptance:** landing fidele a `accueil.html` ; utilisateur connecte redirige exactement comme avant (aucune regression sur `resolveHomeRedirect`).

---

### Task 2: Connexion (/login) + enrichissement AuthCard

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth/AuthCard.tsx` (ajouter `subtitle?` et `footer?` optionnels — partages par les 6 ecrans auth)

**Reference maquette:** `template/connexion.html` — 3 etats : defaut, identifiants incorrects (`Alert` err + inputs bordure rose), connexion en cours (bouton `Spinner` + « Connexion… », champs desactives). Sous-titre « Accédez à votre espace de gestion. », pied « Besoin d'aide ? Contactez votre administrateur ».

**Composants:** `AuthCard` (enrichi), `Input`, `Button`, `Alert` (tone `err`), `Spinner`, `Icon` (`alert-triangle`), `next/link`.

- [x] **Step 1: Lire l'existant** — `login/page.tsx` (client) : `signIn("credentials", { redirect:false })`, `setError("Email ou mot de passe incorrect")`, `router.push("/select")`. Preserver ce flux tel quel ; ne changer que le rendu. Lire `AuthCard.tsx` (title only).

- [x] **Step 2: Enrichir AuthCard puis reconstruire login**

`AuthCard.tsx` — ajouter deux props optionnelles, sous le titre et en pied de carte :
```tsx
type Props = { title: string; subtitle?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode };
// ... apres le <h1>:
{subtitle ? <p className="mb-6 -mt-4 text-center text-sm text-slate-500">{subtitle}</p> : null}
{children}
{footer ? <div className="mt-6 border-t border-slate-100 pt-4 text-center text-[13px] text-slate-400">{footer}</div> : null}
```
> `subtitle`/`footer` optionnels : `/register` et `/register/success` (sans maquette dediee) continuent de fonctionner inchanges et heritent du meme gabarit.

`login/page.tsx` (extrait du rendu cible) :
```tsx
<AuthCard
  title="Connexion"
  subtitle="Accédez à votre espace de gestion."
  footer={<>Besoin d&apos;aide ? <a href="#" className="text-green-600 hover:underline">Contactez votre administrateur</a></>}
>
  <form onSubmit={handleSubmit} className="space-y-4">
    {error && (
      <Alert tone="err">
        <Icon name="alert-triangle" size={16} /> {error}
      </Alert>
    )}
    <Input label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
      error={error ? " " : undefined} placeholder="vous@organisation.fr" required disabled={loading} />
    <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
      error={error ? " " : undefined} placeholder="••••••••" required disabled={loading} />
    <div className="text-right">
      <Link href="/forgot-password" className="text-[13px] text-green-600 hover:underline">Mot de passe oublié ?</Link>
    </div>
    <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading}>
      {loading ? <><Spinner size={16} /> Connexion…</> : "Se connecter"}
    </Button>
  </form>
</AuthCard>
```
> Le message d'erreur passe desormais par `Alert` (au-dessus du form) ; passer `error=" "` aux `Input` declenche uniquement la bordure rose (pas de doublon de texte). Conserver le libelle exact du flux existant (« Email ou mot de passe incorrect »).

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — `/login` 375/768/1440 : carte centree, sous-titre, lien « Mot de passe oublié ? » aligne a droite, pied d'aide. Etat erreur (soumettre mauvais identifiants) : `Alert` rouge + bordures roses. Etat chargement : bouton spinner + champs disabled. `make test` reste vert.

**Acceptance:** 3 etats fideles a `connexion.html` ; `signIn` + `router.push("/select")` inchanges.

---

### Task 3: Mot de passe oublie (/forgot-password)

**Files:**
- Modify: `src/app/forgot-password/page.tsx`

**Reference maquette:** `template/mot-de-passe.html` — etat « Mot de passe oublié » (form e-mail + « Envoyer le lien » + lien retour) **et** etat « E-mail envoyé » (`SuccessRing` icone `mail` + confirmation + « Renvoyer l'e-mail » + retour connexion).

**Composants:** `AuthCard`, `Input`, `Button`, `Spinner`, `SuccessRing`, `Icon` (`mail`, `arrow-left`), `next/link`.

- [x] **Step 1: Lire l'existant** — page client, `fetch("/api/auth/forgot-password")`, anti-enumeration (`setDone(true)` uniforme). Preserver `done` (etat succes) et `email`, `error`, `loading`.

- [x] **Step 2: Reconstruire** — mapper `done` sur l'etat SuccessRing :
```tsx
<AuthCard title={done ? "Vérifiez votre boîte mail" : "Mot de passe oublié"}
  subtitle={done ? undefined : "Saisissez votre e-mail pour recevoir un lien de réinitialisation."}
  footer={<Link href="/login" className="inline-flex items-center gap-1 text-green-600 hover:underline"><Icon name="arrow-left" size={13} /> Retour à la connexion</Link>}
>
  {done ? (
    <div className="text-center">
      <SuccessRing><Icon name="mail" size={26} /></SuccessRing>
      <p className="text-sm text-slate-600">
        Si un compte existe pour <b className="text-slate-900">{email}</b>, un lien de réinitialisation a été envoyé.
      </p>
      <Button variant="secondary" className="mt-6 w-full" onClick={() => setDone(false)}>Renvoyer l&apos;e-mail</Button>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@organisation.fr" required disabled={loading} />
      {error && <Alert tone="err">{error}</Alert>}
      <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading}>
        {loading ? <><Spinner size={16} /> Envoi…</> : "Envoyer le lien"}
      </Button>
    </form>
  )}
</AuthCard>
```
> Conserver le message anti-enumeration exact deja present. « Renvoyer » repasse simplement en mode form (pas de nouvel appel automatique).

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — 375/1440, les 2 etats (form / envoye). `make test` vert.

**Acceptance:** 2 etats fideles ; comportement anti-enumeration preserve.

---

### Task 4: Reinitialisation (/reset-password/[token])

**Files:**
- Modify: `src/app/reset-password/[token]/page.tsx`

**Reference maquette:** `template/mot-de-passe.html` — etat « Réinitialisation » : champ mot de passe + `PasswordMeter` (4 barres) + ligne « Robustesse : forte/faible » + confirmation + « Réinitialiser ». Plus l'etat succes existant (« Mot de passe mis à jour »).

**Composants:** `AuthCard`, `Input`, `Button`, `PasswordMeter`, `SuccessRing` (facultatif sur succes), `Icon` (`check`), `Spinner`.

- [x] **Step 1: Lire l'existant** — page client, `use(params)` -> `token`, validation `length < 6` + `password !== confirm`, `fetch("/api/auth/reset-password", { token, password })`, `done`. Preserver la validation et l'appel.

- [x] **Step 2: Reconstruire + score local** — `PasswordMeter` attend un `score: 0..4` : le calculer **cote client** a partir du champ (aucune donnee serveur), via un petit helper local :
```tsx
function pwScore(v: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) s++;
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}
const LABEL = ["très faible", "faible", "moyenne", "correcte", "forte"];
```
Rendu (etat form) :
```tsx
<Input label="Nouveau mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" disabled={loading} />
<PasswordMeter score={pwScore(password)} />
{password && (
  <p className="-mt-1 text-[13px] text-slate-500">
    Robustesse : <b className={pwScore(password) >= 3 ? "text-green-700" : "text-rose-700"}>{LABEL[pwScore(password)]}</b>
  </p>
)}
<Input label="Confirmer le mot de passe" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" disabled={loading} />
```
Etat succes : `SuccessRing` `check` + bouton « Se connecter » (`Button` en `Link` ou `<a>` vers `/login`). Conserver la validation existante et les messages.

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — saisir un mot de passe faible puis fort : le meter et le libelle suivent ; etat succes. 375/1440. `make test` vert.

**Acceptance:** meter + libelle fideles ; validation `< 6` / non-concordance et POST inchanges.

---

### Task 5: Definition a l'invitation (/setup-password)

**Files:**
- Modify: `src/app/setup-password/page.tsx` (Server Component — enveloppe + `InvalidLink`, inchange sur la logique)
- Modify: `src/components/auth/SetupPasswordForm.tsx` (formulaire client — reskin + `PasswordMeter`)

**Reference maquette:** `template/mot-de-passe.html` — etat « Définition à l'invitation » : titre « Bienvenue, {prénom} », texte « invité par {org} en tant que {ROLE} », champ + `PasswordMeter` + « Activer mon compte ».

**Composants:** `AuthCard`, `Input`, `Button`, `PasswordMeter`, `Spinner`.

- [x] **Step 1: Lire l'existant** — `page.tsx` (serveur) valide `inviteToken` en base (`inviteTokenExpiry`, `archived`) et rend `<InvalidLink/>` ou `<SetupPasswordForm token={token} />`. Lire `SetupPasswordForm.tsx` pour connaitre son flux (POST + redirection). **Ne pas** changer la validation serveur ni le flux du form ; seulement le rendu. Le titre « Bienvenue, {prénom} » suppose de disposer du prenom : si `page.tsx` ne le charge pas aujourd'hui, **conserver** le titre generique existant (« Configurer votre mot de passe ») — ne pas ajouter de requete Prisma pour un simple libelle (YAGNI). Noter cet ecart mineur dans le tracker.

- [x] **Step 2: Reconstruire** — reutiliser le meme `pwScore`/`PasswordMeter` que la Task 4 dans `SetupPasswordForm`. Bouton « Activer mon compte » avec `Spinner` en chargement. `InvalidLink` conserve son `AuthCard` (titre « Lien expiré ou invalide »).

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — page avec token valide (via seed/invitation) : form + meter ; token invalide : `InvalidLink`. `make test` vert.

**Acceptance:** form fidele + meter ; validation du token et POST inchanges.

---

### Task 6: Verification e-mail (/verify-email/[token])

**Files:**
- Modify: `src/app/verify-email/[token]/page.tsx`

**Reference maquette:** `template/mot-de-passe.html` — etat « Vérification e-mail » : `SuccessRing` `check`, « Adresse vérifiée », « Se connecter ». Plus le cas erreur existant (« Lien invalide ou expiré »).

**Composants:** `AuthCard`, `SuccessRing`, `Button`/`Link`, `Icon` (`check`), `Alert` (cas erreur, tone `err`).

- [x] **Step 1: Lire l'existant** — Server Component : `verifyToken(token, baseUrl)` (fetch serveur -> `/api/auth/verify-email`), rend succes (avec `alreadyVerified`) ou erreur. Preserver `resolveBaseUrl()` et l'appel. Aujourd'hui la page n'utilise pas `AuthCard` (markup inline) — la basculer sur `AuthCard` pour homogeneiser.

- [x] **Step 2: Reconstruire**
```tsx
return result.ok ? (
  <AuthCard title={result.alreadyVerified ? "Email déjà confirmé" : "Adresse vérifiée"}>
    <div className="text-center">
      <SuccessRing><Icon name="check" size={34} /></SuccessRing>
      <p className="text-sm text-slate-600">Votre adresse e-mail a bien été confirmée. Vous pouvez maintenant vous connecter.</p>
      <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700">Se connecter</Link>
    </div>
  </AuthCard>
) : (
  <AuthCard title="Lien invalide ou expiré">
    <div className="space-y-4 text-center">
      <Alert tone="err">Ce lien de confirmation est invalide ou a expiré.</Alert>
      <div className="flex justify-center gap-4 text-sm">
        <Link href="/register" className="text-green-600 hover:underline">S&apos;inscrire à nouveau</Link>
        <Link href="/login" className="text-green-600 hover:underline">Se connecter</Link>
      </div>
    </div>
  </AuthCard>
);
```

- [x] **Step 3:** `make typecheck` -> OK.
- [x] **Step 4: Controle visuel** — succes (token valide via seed) et erreur (token bidon). 375/1440. `make test` vert.

**Acceptance:** succes + erreur fideles ; `verifyToken` inchange.

---

### Task 7: Presentation evenement public (/e/[slug])

**Files:**
- Modify: `src/app/e/[slug]/page.tsx`
- Modify (si besoin de details visuels) : `src/components/public/PublicEventLayout.tsx` (hero deja marine — n'ajuster que si ecart maquette)

**Reference maquette:** `template/inscription-publique.html` (hero `event-hero` : logo initiales, titre « … — Inscription », meta lieu/date/org) — la partie **hero** ; le **corps** de `/e/[slug]` est la carte de presentation + categories disponibles + CTA (connexion/inscription), pas le formulaire long (qui vit dans la Task 8). Etat « fermé » via `ClosedView` existant.

**Composants:** `PublicEventLayout` (hero), `CatPill` (categories), `Button`/`Link`, `Card`/`CardBody` (directeur Task 1), `Icon`.

- [ ] **Step 1: Lire l'existant** — `loadOrClosed(slug)` -> `PublicEventBundle` (`event`, `categories`, `settings`) ou `ClosedView`. `getServerSession` decide CTA « S'inscrire » (connecte) vs « Se connecter » + « Créer un compte » (avec `callbackUrl`/`next`). Preserver ces branches et les hrefs exacts.

- [ ] **Step 2: Reconstruire le corps** — remplacer les pills neutres actuelles par `CatPill` (pastille couleur categorie) et encapsuler dans `Card`/`CardBody` :
```tsx
<Card>
  <CardBody className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Inscription en ligne</h2>
      <p className="mt-1 text-sm text-slate-600">
        L&apos;inscription nécessite un compte Badge. Vous pourrez consulter vos inscriptions et resoumettre en cas de rejet.
      </p>
    </div>
    {categories.length > 0 && (
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Catégories disponibles :</p>
        <div className="flex flex-wrap gap-4">
          {categories.map((c) => <CatPill key={c.id} color={c.color} label={c.name} />)}
        </div>
      </div>
    )}
    <div className="flex flex-wrap gap-3">
      {session?.user?.id
        ? <Link href={`/e/${slug}/register`} className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">S&apos;inscrire à cet événement</Link>
        : <>
            <Link href={`/login?callbackUrl=/e/${slug}/register`} className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Se connecter pour s&apos;inscrire</Link>
            <Link href={`/register?next=/e/${slug}/register`} className="inline-flex items-center rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">Créer un compte</Link>
          </>}
    </div>
  </CardBody>
</Card>
```
> Le hero (`PublicEventLayout`) est deja au design marine (v2-15). Ajuster uniquement la meta si la maquette montre des icones `map-pin`/`calendar`/`building` — les ajouter via `Icon` dans `PublicEventLayout` en preservant les props existantes.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — `/e/[slug]` connecte vs deconnecte (CTA), etat « fermé ». 375/768/1440. `make test` vert.

**Acceptance:** hero + categories + CTA fideles ; branches session et hrefs inchanges ; `ClosedView` preserve.

---

### Task 8: Formulaire d'inscription (/e/[slug]/register)

**Files:**
- Modify: `src/app/e/[slug]/register/RegisterEventForm.tsx` (client)
- Modify (etats page) : `src/app/e/[slug]/register/page.tsx` (etat « déjà inscrit », redirections profil)

**Reference maquette:** `template/inscription-publique.html` — sections Identité / Catégorie (`radio-cards`) / Pièce d'identité / Uploads (`filebox`+`dropzone`) / reCAPTCHA + consentement + « S'inscrire », **plus** les 2 etats bas de page « Inscriptions fermées » (`lock`) et « Capacité atteinte / liste d'attente » (`users`).

> **Nuance metier importante (a preserver) :** dans l'app v2, l'**identité, la pièce et les uploads** vivent dans le **profil participant** (`/account/profile/complete`, Task 14) — `page.tsx` redirige vers `complete` si `isParticipantProfileComplete` est faux. Le **formulaire d'inscription lui-meme** ne demande donc que la **catégorie** + le **consentement RGPD**. Les sections Identité/Pièce/Uploads de la maquette sont portees dans la Task 14 (profil), **pas** ici. Ne pas ajouter de champs identité/upload a `RegisterEventForm` (ce serait de la logique metier nouvelle — hors-scope). Cabler `RadioCards` sur `categories` et `Checkbox` sur le consentement existant.

**Composants:** `RadioCards`, `Checkbox`, `Button`, `Alert` (err), `Card`/`CardBody`, `Icon` (`lock`, `users`), `Spinner`.

- [ ] **Step 1: Lire l'existant** — `RegisterEventForm` (client) : `categoryId` (radios), `accepted` (checkbox RGPD), POST `/api/events/${slug}/register`, gestion 409 -> redirection detail, succes -> `/e/${slug}/success?id=`. `page.tsx` : redirection profil incomplet, etat `existing` « déjà inscrit ». Preserver strictement.

- [ ] **Step 2: Reconstruire** — remplacer les radios manuelles par `RadioCards` et la checkbox brute par `Checkbox` :
```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  <FormSection title="Catégorie de participation" description="Sélectionnez la catégorie qui vous correspond.">
    <RadioCards
      name="Catégorie"
      value={categoryId || null}
      onChange={setCategoryId}
      options={categories.map((c) => ({ value: c.id, title: c.name, color: c.color }))}
    />
  </FormSection>
  <Checkbox
    checked={accepted}
    onChange={setAccepted}
    label={<>J&apos;accepte que les informations de mon profil (identité, structure, photo, pièce d&apos;identité) soient utilisées pour cette inscription et la production de mon badge.</>}
  />
  {error && <Alert tone="err">{error}</Alert>}
  <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={loading || !categoryId}>
    {loading ? <><Spinner size={16} /> Inscription…</> : "S'inscrire"}
  </Button>
</form>
```
Etats « déjà inscrit » (bloc `existing`) : `Alert` tone `warn` + lien detail. Etats « fermé »/« capacité » : si un jour la page les distingue, utiliser deux `Card` centrees (`Icon` `lock` amber / `users` rose) reprenant `ClosedView` ; sinon laisser `ClosedView` gerer (ne pas inventer l'etat « liste d'attente » s'il n'existe pas cote logique — le porter visuellement seulement si `ClosedView` le supporte deja).

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — form (radio-cards colorees + consentement), etat « déjà inscrit », etat « fermé ». 375/768/1440. Verifier le golden path : selection catégorie -> `S'inscrire` -> redirection success. `make test` vert.

**Acceptance:** `RadioCards`+`Checkbox` fideles ; POST, gestion 409, redirection success et garde « profil incomplet » inchanges.

---

### Task 9: Confirmation (/e/[slug]/success)

**Files:**
- Modify: `src/app/e/[slug]/success/page.tsx`

**Reference maquette:** `template/confirmation.html` — `SuccessRing` `check`, « Inscription enregistrée », 2 texte de confirmation, `divider`, 2 `filebox` recap (Statut : en attente / Catégorie + N° inscription), lien contact.

**Composants:** `PublicEventLayout`, `Card`/`CardBody`, `SuccessRing`, `FileBox`, `Icon` (`check`, `clock`, `id-card`), `Button`/`Link`.

- [ ] **Step 1: Lire l'existant** — Server Component : `event` par slug, `resolvePublicSettings`, `searchParams.id` -> lien detail. Preserver `notFound`, settings, et le lien `/account/registrations/{id}`.

- [ ] **Step 2: Reconstruire**
```tsx
<PublicEventLayout event={event} contact={{ email: settings.contactEmail, phone: settings.contactPhone }}>
  <Card>
    <CardBody className="text-center">
      <SuccessRing><Icon name="check" size={36} /></SuccessRing>
      <h2 className="text-2xl font-semibold text-slate-900">Inscription enregistrée</h2>
      <p className="mx-auto mt-2 max-w-[440px] text-sm text-slate-600">
        Votre inscription a bien été reçue et est en cours de vérification. Un e-mail de confirmation vient de vous être envoyé.
      </p>
      <div className="my-6 border-t border-slate-100" />
      <div className="flex flex-wrap justify-center gap-4 text-left">
        <FileBox icon="clock" title="Statut : en attente" subtitle="Réponse sous 48 h ouvrées" />
        {id && <FileBox icon="id-card" title="Inscription enregistrée" subtitle={`N° ${id}`} />}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {id && <Link href={`/account/registrations/${id}`} className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Voir le détail</Link>}
        <Link href="/account" className="inline-flex items-center rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">Mon compte</Link>
      </div>
    </CardBody>
  </Card>
</PublicEventLayout>
```
> `FileBox` accepte un `subtitle` : y placer la ligne secondaire. Ne pas inventer de N° « joli » (`0241-8837`) — reutiliser l'`id` reel deja passe.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — avec et sans `id`. 375/1440. `make test` vert.

**Acceptance:** SuccessRing + FileBox fideles ; liens detail/compte inchanges.

---

### Task 10: Apercu badge (/badge/[id])

**Files:**
- Modify: `src/app/badge/[id]/page.tsx` (client)

**Reference maquette:** `template/apercu-badge.html` — hero « Votre badge », `badge-card` produit (bande marine, org, photo, nom, rôle, cat-band coloree, QR + meta), boutons « Télécharger le PDF » (`download`) et « Ajouter au mobile » (`smartphone`), note format 100×140 mm.

**Composants:** `BadgeCard` (directeur Task 16), `Button`, `Icon` (`download`, `smartphone`), `Spinner`. Rendu PDF conserve via `BadgeDownload` (dynamic import react-pdf).

- [ ] **Step 1: Lire l'existant** — page client : `fetch('/api/verify/${id}')`, generation QR (`generateQRCodeDataURL`), `imageUrlToDataUrl` pour la photo, etats « Chargement… » / « non valide » / « Génération… ». Rend `BadgePreview` (react-pdf) + `BadgeDownload`. **Preserver** la generation QR + le telechargement PDF (`BadgeDownload`). Le `BadgePreview` react-pdf peut etre remplace visuellement par `BadgeCard` HTML pour l'apercu web (plus fidele a la maquette et plus leger) ; garder `BadgeDownload` pour le PDF reel.

- [ ] **Step 2: Reconstruire l'apercu web avec `BadgeCard`** — le QR (dataURL) devient une `<img>` dans le slot `qr` :
```tsx
if (!data) return <div className="mt-20 text-center"><Spinner /></div>;
if (!data.valid) return <p className="mt-20 text-center text-rose-600">Badge non valide ou inscription non approuvée.</p>;
if (!qrCodeDataUrl) return <div className="mt-20 text-center"><Spinner /> <span className="ml-2 text-slate-500">Génération du badge…</span></div>;

return (
  <div className="mx-auto mt-10 max-w-[560px] text-center">
    <p className="mb-6 text-sm text-slate-600">Voici votre badge officiel. Présentez-le à l&apos;entrée, imprimé ou sur votre téléphone.</p>
    <div className="mb-7 flex justify-center">
      <BadgeCard
        org={evt.title}
        name={`${reg.firstName} ${reg.lastName}`}
        category={reg.team.name}
        categoryColor={reg.team.color}
        qr={<img src={qrCodeDataUrl} alt="QR code" className="h-full w-full" />}
        meta={<>ID · {reg.id}<br />{evt.date}<br />{evt.location}</>}
        allAccess={reg.allAccessGranted}
      />
    </div>
    <div className="flex flex-wrap justify-center gap-3">
      <BadgeDownload registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} allAccessGranted={reg.allAccessGranted} />
      <Button variant="secondary"><Icon name="smartphone" size={16} /> Ajouter au mobile</Button>
    </div>
    <p className="mt-5 text-[13px] text-slate-400">Format 100 × 140 mm · QR code unique vérifié à l&apos;entrée.</p>
  </div>
);
```
> `BadgeDownload` (bouton « Télécharger le PDF ») reste le composant canonique du PDF — ne pas le remplacer. `smartphone` a ajouter au registre `Icon` si absent. Le passage de `BadgePreview` (react-pdf) a `BadgeCard` (HTML) pour l'**apercu** depend de la reconciliation V1/V2 du directeur (Task 16) : si `BadgeCard` n'est pas encore stabilise, conserver `BadgePreview` en attendant et noter au tracker.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — badge d'une inscription APPROVED+imprimee (via seed) : carte fidele (bande marine, cat-band coloree, QR, ruban all-access si applicable), telechargement PDF fonctionnel. 375/1440. `make test` vert.

**Acceptance:** `BadgeCard` fidele a `apercu-badge.html` ; QR + telechargement PDF inchanges.

---

### Task 11: Verification badge (/verify/[badgeId])

**Files:**
- Modify: `src/components/public/BadgeVerifyView.tsx`
- Modify (si marge/cadre) : `src/app/verify/[badgeId]/page.tsx`

**Reference maquette:** `template/verification-badge.html` — mobile-first, 3 cas : **valide** (`VerifyBanner` vert + card photo/nom/`cat-pill`/meta), **valide anonyme** (nom masqué « Nom masqué » + note anonymat), **non valide** (`VerifyBanner` rouge + « Accès refusé » + code scanné).

**Composants:** `VerifyBanner`, `Card`/`CardBody`, `CatPill`, `KeyValue` (ou lignes `between`), `Icon` (`check`, `x`, `user`, `lock`, `circle-x`).

- [ ] **Step 1: Lire l'existant** — `page.tsx` (serveur) construit `data` : `valid` = `status==="APPROVED" && badgePrinted` ; si `category.anonymous`, `participant` est `undefined` (nom masqué). Passe a `BadgeVerifyView` (presentational). **Preserver** ce calcul et la forme de `data` (union `valid true/false`). Ne modifier que `BadgeVerifyView`.

- [ ] **Step 2: Reconstruire `BadgeVerifyView`** — 3 cas depuis l'union existante :
```tsx
if (!data.valid) {
  return (
    <div className="space-y-4">
      <VerifyBanner valid={false} title="Badge non valide">
        <p className="mt-1 text-sm text-white/85">Ce badge a été révoqué ou n&apos;existe pas.</p>
      </VerifyBanner>
      <Card><CardBody className="text-center">
        <span className="text-rose-600"><Icon name="x" size={44} /></span>
        <p className="mt-3 text-sm font-medium text-slate-900">Accès refusé</p>
        <p className="mt-1 text-[13px] text-slate-400">Ce QR code ne correspond à aucun badge actif. Adressez-vous à l&apos;accueil.</p>
      </CardBody></Card>
    </div>
  );
}
const anonymous = !data.participant; // categorie anonyme -> nom masqué
return (
  <div className="space-y-4">
    <VerifyBanner valid title="Badge valide" />
    <Card><CardBody className="text-center">
      <span className="mx-auto mb-3 flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={anonymous ? "lock" : "user"} size={34} />
      </span>
      {anonymous
        ? <div className="text-base font-semibold italic text-slate-400">Nom masqué</div>
        : <div className="font-badge text-xl font-bold text-slate-900">{data.participant.firstName} {data.participant.lastName}</div>}
      <div className="mt-2.5 flex justify-center"><CatPill color={data.category.color} label={data.category.name} /></div>
      <div className="my-4 border-t border-slate-100" />
      <KeyValue items={[
        { label: "Événement", value: data.event.title },
        { label: "Dates", value: formatEventDate(data.event.date as Date) },
      ]} />
      {anonymous && <p className="mt-3 text-[13px] text-slate-400">La catégorie « {data.category.name} » est anonyme : le nom du porteur n&apos;est pas affiché publiquement.</p>}
    </CardBody></Card>
  </div>
);
```
> Page deja mobile (`max-w-md`). Le `PhoneMockup` du directeur est un cadre **desktop** optionnel — non requis ici (la page reelle est deja pleine largeur mobile). Ne pas l'imposer.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — 3 cas (badge valide nominatif, valide catégorie anonyme, non valide) via seed. **375 px prioritaire** (mobile-first) + 768/1440. `make test` vert.

**Acceptance:** 3 cas fideles ; calcul `valid`/anonymat cote serveur inchange.

---

### Task 12: Tableau de bord participant (/account)

**Files:**
- Modify: `src/app/account/layout.tsx` (barre `acct-top` : logo + onglets + user-chip)
- Modify: `src/app/account/page.tsx` (cartes d'inscription + banniere onboarding + `EmptyState`)

**Reference maquette:** `template/participant-dashboard.html` — barre haute (logo, nav « Mes inscriptions » / « Profil » avec actif vert, user-chip), titre « Bonjour {prénom} », liste `reg-card` (pastille date + titre + meta lieu/catégorie + `status`), etat vide `EmptyState`.

**Composants:** `StatusBadge` (statut inscription), `EmptyState`, `Card`, `Alert` (onboarding), `Icon` (`map-pin`, `tag`, `chevron-right`, `id-card`), `next/link`. La nav active reprend `accent-nav-bg`.

- [ ] **Step 1: Lire l'existant** — `layout.tsx` : garde session, charge `name`/`email`/`participantProfileCompletedAt`, header nav + signout. `page.tsx` : charge `user` + `registrations` (status, rejectionReason, event, category), banniere si profil incomplet, liste ou message vide. **Preserver** requetes, gardes et `STATUS_LABEL`.

- [ ] **Step 2: Reconstruire**

`layout.tsx` header (onglets avec actif) — comme la nav ne connait pas le pathname cote serveur, extraire un petit composant client `AccountNav` (2 liens, `usePathname`) OU garder les liens serveur avec surlignage au hover uniquement. Preferer un mini `AccountNav` client pour l'etat actif fidele :
```tsx
// AccountNav.tsx ("use client")
const items = [{ href: "/account", label: "Mes inscriptions" }, { href: "/account/profile", label: "Profil" }];
// actif: pathname === href (exact pour /account, startsWith pour /account/profile)
```
En-tete : logo, `AccountNav`, user-chip (initiales + nom + signout).

`page.tsx` — carte par inscription + onboarding + vide :
```tsx
{!user?.participantProfileCompletedAt && (
  <Alert tone="warn">
    <div>
      <p className="font-semibold">Votre profil est incomplet.</p>
      <p className="mt-0.5 text-[13px]">Complétez votre profil pour vous inscrire à un événement.</p>
      <Link href="/account/profile/complete" className="mt-2 inline-flex rounded-lg bg-green-600 px-3 py-1.5 text-[13px] font-medium text-white">Compléter mon profil</Link>
    </div>
  </Alert>
)}
{registrations.length === 0 ? (
  <Card><EmptyState icon="id-card" title="Aucune inscription" description="Vos inscriptions à des événements apparaîtront ici." /></Card>
) : (
  <div className="space-y-3">
    {registrations.map((r) => (
      <Link key={r.id} href={`/account/registrations/${r.id}`} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
        <div className="w-14 flex-none rounded-lg border border-slate-200 bg-slate-50 py-2 text-center">
          <div className="text-xl font-bold leading-none text-slate-900 tabular-nums">{fmtDay(r.event.date)}</div>
          <div className="mt-0.5 text-[11px] uppercase text-slate-400">{fmtMonth(r.event.date)}</div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{r.event.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-slate-400">
            <Icon name="map-pin" size={12} /> {r.event.location} · <Icon name="tag" size={12} /> {r.category.name}
          </div>
        </div>
        <StatusBadge status={r.status} />
        <Icon name="chevron-right" size={18} />
      </Link>
    ))}
  </div>
)}
```
> `fmtDay`/`fmtMonth` : petits formatters locaux (`Intl.DateTimeFormat("fr-FR", { day/month })`) — pas de dep. `StatusBadge` (v2-15) porte deja les 3 statuts avec libelle FR ; le reutiliser plutot que recreer un badge.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — compte avec inscriptions (statuts varies) + compte vide (`EmptyState`) + profil incomplet (banniere). 375/768/1440. `make test` vert.

**Acceptance:** barre + cartes + etats fideles ; requetes et gardes inchangees.

---

### Task 13: Detail inscription (/account/registrations/[id])

**Files:**
- Modify: `src/app/account/registrations/[id]/page.tsx`

**Reference maquette:** `template/participant-inscription.html` — back-link, en-tete (titre + meta + `status`), encart motif de rejet (`alert-err` + bouton « Modifier et resoumettre »), 2 colonnes : Récapitulatif (`list-row`/`KeyValue`) + Pièces fournies (`filebox`) | Suivi (`Timeline`).

**Composants:** `Card`/`CardHead`/`CardBody`, `KeyValue`, `CatPill`, `FileBox`, `Timeline`/`TimelineItem`, `Alert` (err), `StatusBadge`, `Icon` (`arrow-left`, `pencil`). `ResubmitButton` existant conserve.

- [ ] **Step 1: Lire l'existant** — charge `registration` (snapshots, status, rejection, event, category), garde `userId !== userId -> redirect("/account")`, `ResubmitButton` si REJECTED. Preserver la garde d'appartenance, les snapshots et `ResubmitButton`.

- [ ] **Step 2: Reconstruire**
```tsx
<div className="space-y-6">
  <Link href="/account" className="inline-flex items-center gap-1 text-[13px] text-green-600 hover:underline"><Icon name="arrow-left" size={13} /> Mes inscriptions</Link>
  <div className="flex items-start justify-between gap-3">
    <div>
      <h1 className="text-[22px] font-semibold text-slate-900">{registration.event.title}</h1>
      <p className="mt-1 text-[13px] text-slate-400">{formatDate(registration.event.date)} · {registration.event.location}</p>
    </div>
    <StatusBadge status={registration.status} />
  </div>

  {registration.status === "REJECTED" && (
    <Alert tone="err">
      <Icon name="alert-triangle" size={18} />
      <div className="flex-1">
        <div className="font-semibold">Inscription rejetée{registration.rejectionReason ? ` — ${registration.rejectionReason}` : ""}</div>
        {registration.rejectionDetails && <div className="mt-0.5 leading-relaxed">{registration.rejectionDetails}</div>}
        <ResubmitButton registrationId={registration.id} />
      </div>
    </Alert>
  )}

  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
    <div className="space-y-6">
      <Card>
        <CardHead title="Récapitulatif" />
        <CardBody>
          <KeyValue items={[
            { label: "Nom complet", value: `${registration.snapshotFirstName} ${registration.snapshotLastName}` },
            { label: "Catégorie", value: <CatPill color={registration.category.color} label={registration.category.name} /> },
            { label: "E-mail", value: registration.snapshotEmail },
            { label: "Structure", value: registration.snapshotStructure },
            { label: "Pièce d'identité", value: `${registration.snapshotIdDocumentType} · ${registration.snapshotIdDocumentNumber}` },
            { label: "Inscrit le", value: formatDate(registration.createdAt) },
          ]} />
        </CardBody>
      </Card>
    </div>
    <Card>
      <CardHead title="Suivi" />
      <CardBody>
        <Timeline>
          {registration.status === "REJECTED" && <TimelineItem tone="danger" title="Inscription rejetée" meta={formatDate(registration.updatedAt)} />}
          {registration.status === "APPROVED" && <TimelineItem tone="ok" title="Inscription approuvée" meta={registration.badgePrintedAt ? formatDate(registration.badgePrintedAt) : ""} />}
          <TimelineItem tone="ok" title="Inscription soumise" meta={formatDate(registration.createdAt)} />
        </Timeline>
      </CardBody>
    </Card>
  </div>
</div>
```
> La maquette montre des `filebox` « Pièces fournies » : les pieces reelles vivent au profil (snapshots ici) ; n'afficher `FileBox` que si des cles de fichier existent dans la selection — sinon ne pas inventer d'aperçu. `Timeline` reconstruit a partir des dates reelles (`createdAt`/`updatedAt`/`badgePrintedAt`), pas de dates fictives.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — inscription REJECTED (encart + timeline danger), APPROVED, PENDING. 375/768/1440. `make test` vert.

**Acceptance:** recap + timeline + encart rejet fideles ; garde d'appartenance et `ResubmitButton` inchanges.

---

### Task 14: Profil (/account/profile + /complete)

**Files:**
- Modify: `src/app/account/profile/page.tsx`
- Modify: `src/app/account/profile/complete/page.tsx`
- Modify: `src/app/account/profile/ProfileForm.tsx` (client — reskin, `FormSection`, `Dropzone`/photo, zone danger)

**Reference maquette:** `template/participant-profil.html` — banniere onboarding (`alert-info` champs manquants), section Identité (photo ronde + « Changer la photo », prénom/nom, e-mail **disabled**, téléphone requis, organisation), section Changer le mot de passe, barre d'actions (« Supprimer mon compte » danger a gauche + Annuler/Enregistrer a droite).

**Composants:** `Card`/`CardBody`, `FormSection`, `Input`, `Button`, `Dropzone`/`FileBox` (photo/pièce — reutilise `FileUploadField` existant), `Alert` (info onboarding), `Icon` (`upload`, `check`).

- [ ] **Step 1: Lire l'existant** — `page.tsx` (serveur) charge le user + rend `ProfileForm initial={...}`. `complete/page.tsx` idem + `redirectTo=safeNext`. `ProfileForm` (client) porte la logique de save + uploads (`FileUploadField`) + validation. **Preserver** `ProfileForm`'s onSubmit, ses champs, `redirectTo`, et la garde e-mail non modifiable. Lire `ProfileForm.tsx` et `FileUploadField.tsx` avant edition.

- [ ] **Step 2: Reconstruire** — envelopper les champs de `ProfileForm` dans `FormSection`, marquer l'e-mail `disabled`, habiller les uploads via `Dropzone`/`FileBox` (le directeur Task 12 recable `FileUploadField` dessus — le reutiliser, ne pas dupliquer). Banniere onboarding via `Alert tone="info"` (page profil) ou texte d'intro (page complete). Zone danger :
```tsx
<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
  <button type="button" className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">Supprimer mon compte</button>
  <div className="flex gap-3">
    <Button variant="secondary" type="button">Annuler</Button>
    <Button type="submit"><Icon name="check" size={16} /> Enregistrer</Button>
  </div>
</div>
```
> « Supprimer mon compte » : ne cabler une action **que si** un endpoint de suppression existe deja ; sinon rendre le bouton (fidélité maquette) et noter au tracker qu'il n'est pas cable (pas de nouvelle logique metier — hors-scope du reskin). L'e-mail reste `disabled` (déjà non modifiable cote logique).

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — `/account/profile` (profil complet vs incomplet -> banniere + champs requis surlignés) et `/account/profile/complete` (redirection `next` apres save preservee). 375/768/1440. `make test` vert (les tests existants de `ProfileForm`/uploads restent verts).

**Acceptance:** sections + photo + zone danger fideles ; save, uploads, e-mail disabled et `redirectTo` inchanges.

---

### Task 15: Selecteur d'organisation (/select)

**Files:**
- Modify: `src/app/select/page.tsx`

**Reference maquette:** `template/selecteur-organisation.html` — barre haute (logo + user-chip), titre « Choisissez une organisation », `card-grid` de `pick-card` (OrgLogo initiales + nom + slug mono + meta « N événements · N inscriptions »), + `pick-card dashed` « Toutes les organisations / Mode staff » (icône `shield`).

**Composants:** `PickCard`, `PickCardDashed`, `OrgLogo`, `Icon` (`shield`), `next/link`.

- [ ] **Step 1: Lire l'existant** — Server Component : charge `orgs` (memberships OWNER/MANAGER/AUDITOR), redirections auto (1 org non-staff -> `/admin/{id}`, 0 org non-staff -> `/profile?message=no-org`, 0 org staff -> `/staff`), rend liste + entree staff si `ctx.isStaff`. **Preserver** exactement ces redirections et le filtre de roles.

- [ ] **Step 2: Reconstruire** — grille `PickCard` + `PickCardDashed` staff :
```tsx
return (
  <div className="min-h-screen bg-slate-50">
    <div className="flex items-center border-b border-slate-200 bg-white px-7 py-4">
      <Image src="/logo.png" alt="Badge" width={112} height={28} className="h-7 w-auto object-contain" />
    </div>
    <div className="mx-auto max-w-[880px] px-6 py-12">
      <div className="mb-9 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Choisissez une organisation</h1>
        <p className="mt-2 text-sm text-slate-600">Sélectionnez l&apos;organisation que vous souhaitez gérer.</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {orgs.map((o) => (
          <PickCard key={o.id} href={`/admin/${o.id}`} logo={<OrgLogo name={o.name} />}
            title={<>{o.name}{o.archived && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px]">Archivée</span>}</>}
            subtitle={<span className="font-mono">{o.slug}</span>} />
        ))}
        {ctx.isStaff && (
          <PickCardDashed href="/staff" icon="shield" label={<><span className="font-semibold text-slate-900">Toutes les organisations</span><span className="text-xs text-slate-400">Mode staff — administration plateforme</span></>} />
        )}
      </div>
    </div>
  </div>
);
```
> Ne pas afficher le compteur « N événements · N inscriptions » de la maquette s'il n'est pas deja charge (ne pas ajouter de requetes d'agregation — YAGNI/hors-scope) ; se limiter au slug. `AuthCard` n'est plus utilise ici (pleine grille), c'est intentionnel et fidele a la maquette.

- [ ] **Step 3:** `make typecheck` -> OK.
- [ ] **Step 4: Controle visuel** — compte multi-orgs (grille), compte staff (carte dashed en plus), org archivee (tag). Verifier les redirections auto (1 org / 0 org) toujours actives. 375/768/1440. `make test` vert.

**Acceptance:** grille `PickCard` fidele ; redirections auto et filtre de roles inchanges.

---

## Self-Review

- **Couverture des 11 ecrans** : `accueil` (T1), `connexion` (T2), `mot-de-passe` 4 etats -> `forgot` (T3) / `reset` (T4) / `setup` (T5) / `verify-email` (T6), `inscription-publique` -> `/e/[slug]` (T7) + `/e/[slug]/register` (T8), `confirmation` (T9), `apercu-badge` (T10), `verification-badge` (T11), `participant-dashboard` (T12), `participant-inscription` (T13), `participant-profil` (T14 + `/complete`), `selecteur-organisation` (T15). **11/11 couverts.**
- **Coherence des noms de composants avec le directeur** : `Icon`, `Alert`, `SuccessRing`, `Spinner`, `EmptyState` (`Feedback.tsx`), `PasswordMeter`, `RadioCards`, `Checkbox`/`FormSection` (`FormControls.tsx`), `FileBox`/`Dropzone`, `Card`/`CardHead`/`CardBody`, `Timeline`/`TimelineItem`, `KeyValue` (`JournalBlocks.tsx`), `CatPill` (`Labels.tsx`), `BadgeCard`, `VerifyBanner`, `PickCard`/`PickCardDashed`/`OrgLogo`. Toutes les signatures consommees correspondent aux **Interfaces** du directeur (memes noms de props). Primitives v2-15 reutilisees : `AuthCard` (enrichi `subtitle`/`footer` en T2), `Input`, `Button`, `StatusBadge`, `PublicEventLayout`.
- **Icones a verifier au registre `Icon`** : `arrow-right` (T1), `smartphone` (T10) — les ajouter au registre du directeur (Task 0.5) si absents, et le noter dans le tracker du directeur.
- **Logique preservee** : aucune task ne modifie une requete Prisma, une redirection, un `fetch`, un server action ou une garde RBAC. Nuances metier explicitees : identité/pièce/uploads restent au **profil** (T14), pas au formulaire d'inscription (T8) ; « liste d'attente » et « supprimer mon compte » ne sont pas cables si l'endpoint n'existe pas (fidélité visuelle sans logique nouvelle).
- **Decision landing** : rendu conditionnel sur `/` (pas de route `/accueil`), branche authentifiee (`resolveHomeRedirect`) inchangee — la seule modification est le remplacement de `redirect("/login")` par `<LandingView />` pour le visiteur non connecte.
</content>
</invoke>
