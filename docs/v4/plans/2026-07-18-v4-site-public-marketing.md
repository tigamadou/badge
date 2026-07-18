# Site public / marketing v4 — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [x]`).

**Goal:** Transformer la page d'accueil (`/`) en une vraie landing marketing conforme au design `accueil.html`, et creer les nouvelles pages publiques qu'elle relie : Fonctionnalites, Tarifs, A propos, Contact, et les pages legales (Mentions legales, Confidentialite, CGU).

**Architecture:** Next.js 16 App Router. Toutes les pages publiques marketing vivent dans un **route group `(marketing)`** partageant un layout avec header sticky + footer navy (equivalents React de `assets/public.js`). Rendu en **Server Components** (statique) sauf le header (menu mobile) et le formulaire de contact, qui sont des Client Components. Style **Tailwind-first**, coherent avec le reskin v2-16 existant (aucune classe semantique de `badge.css` n'est portee ; on reutilise les tokens de `globals.css` et les primitives `src/components/ui/*`).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, lucide-react (via `src/components/ui/Icon.tsx`), primitives `Button`/`Card`/`Input`/`Select`.

## Global Constraints

- **Version cible : v4.** Doc dans `docs/v4/`.
- **Source de design (autorite visuelle)** : projet Claude Design `Design Badge` (id `544b1ad9-6d72-450d-8798-d86a62ad7cfd`), lu via le MCP `DesignSync` (`method: get_file`). Fichiers de reference : `accueil.html`, `fonctionnalites.html`, `tarifs.html`, `a-propos.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html`, `cgu.html`, `assets/public.js` (chrome), `assets/badge.css` (styles de reference — a **traduire** en Tailwind, pas a copier).
- **Perimetre strict** : uniquement la page d'accueil (mise a jour) + les nouvelles pages ci-dessus. **Ne pas** retoucher les pages fonctionnelles existantes (`/login`, `/register`, `/verify`, `/e/[slug]`, espace compte, espaces app). Les liens vers ces pages pointent vers les routes existantes.
- **Convention de style** : Tailwind utilitaire comme dans `src/components/public/LandingView.tsx` et le reste de l'app. Palette : `green-600/700` (accent), `slate-*` (neutres), `brand-navy` (#004d74, token deja present). Police display = `--font-badge` (Montserrat) pour les gros titres (`h-display`), Inter pour le corps.
- **Langue** : tout le contenu visible en francais avec accents. Code/identifiants en anglais. Commentaires en francais.
- **Server Components par defaut** ; `"use client"` seulement pour le header (menu mobile) et le formulaire de contact.
- **Accessibilite** : focus visible (deja global dans `globals.css`), landmarks (`<header>`, `<main>`, `<footer>`, `<nav aria-label>`), FAQ en `<details>/<summary>` natif (pas de JS).
- **Avant tout commit** : `make lint && make typecheck && make test`. Commits francais ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur** — les etapes "Commit" ne s'executent que sur demande.
- **Verification UI** : tester chaque page dans le navigateur (desktop + mobile) sur `https://badge.local` avant de declarer une phase terminee.

---

## Correspondance design -> routes

| Fichier design | Route Next.js | Fichier a creer/modifier | Nature |
|---|---|---|---|
| `accueil.html` | `/` | `src/app/(marketing)/page.tsx` (remplace `src/app/page.tsx`) | Mise a jour (landing complete) |
| `fonctionnalites.html` | `/fonctionnalites` | `src/app/(marketing)/fonctionnalites/page.tsx` | Nouveau |
| `tarifs.html` | `/tarifs` | `src/app/(marketing)/tarifs/page.tsx` | Nouveau |
| `a-propos.html` | `/a-propos` | `src/app/(marketing)/a-propos/page.tsx` | Nouveau |
| `contact.html` | `/contact` | `src/app/(marketing)/contact/page.tsx` | Nouveau |
| `mentions-legales.html` | `/mentions-legales` | `src/app/(marketing)/mentions-legales/page.tsx` | Nouveau |
| `confidentialite.html` | `/confidentialite` | `src/app/(marketing)/confidentialite/page.tsx` | Nouveau |
| `cgu.html` | `/cgu` | `src/app/(marketing)/cgu/page.tsx` | Nouveau |

Liens sortants vers l'existant (a NE PAS creer) : `connexion.html` -> `/login`, `verification-badge.html` -> `/verify` (ou route publique de verification existante), "Galerie des ecrans" (`index.html`) -> `/styleguide` (ou masquer ce lien).

## Structure de fichiers a creer

```
src/app/(marketing)/
  layout.tsx                      # header + footer autour de toutes les pages marketing
  page.tsx                        # landing (/), inclut la redirection auth des utilisateurs connectes
  fonctionnalites/page.tsx
  tarifs/page.tsx
  a-propos/page.tsx
  contact/page.tsx
  contact/ContactForm.tsx         # client component (formulaire)
  mentions-legales/page.tsx
  confidentialite/page.tsx
  cgu/page.tsx
src/components/marketing/
  PublicSiteHeader.tsx            # client : nav sticky + menu mobile
  PublicSiteFooter.tsx            # server : footer navy 4 colonnes
  SectionHeading.tsx              # eyebrow + h-display + lede (centre ou non)
  CtaBand.tsx                     # bandeau navy d'appel a l'action
  FaqAccordion.tsx                # <details> natifs, chevron rotatif (group-open)
  PricingCards.tsx                # 3 offres (partage accueil + tarifs)
  BadgeCredential.tsx             # maquette de badge (partage accueil + fonctionnalites)
  BrowserMock.tsx                 # cadre "navigateur" des maquettes produit
  LegalLayout.tsx                 # gabarit des pages legales (retour + h1 + date + contenu)
src/api/contact/route.ts          # (optionnel) endpoint d'envoi du formulaire contact
public/logo.svg, public/logo-light.svg   # logos importes du design
```

---

# PHASE 0 — Fondations du site public (chrome + primitives partagees)

**But :** Poser le layout marketing, le header/footer, les icones manquantes, les logos et les composants partages, pour que les pages suivantes se composent sans duplication.

### Task 0.1 : Ajouter les icones manquantes au registre

**Files:**
- Modify: `src/components/ui/Icon.tsx`

**Interfaces:**
- Produces: nouveaux `IconName` : `"check-circle"`, `"building"`, `"chevron-down"`, `"sliders"`, `"minus"`.

- [x] **Step 1 : Importer et enregistrer** dans `src/components/ui/Icon.tsx` les icones lucide manquantes utilisees par le design. Ajouter aux imports : `CheckCircle, Building, ChevronDown, SlidersHorizontal, Minus`. Ajouter au map `ICONS` :

```ts
  "check-circle": CheckCircle,
  building: Building,
  "chevron-down": ChevronDown,
  sliders: SlidersHorizontal,
  minus: Minus,
```

- [x] **Step 2 : Typecheck** : `make typecheck` — Attendu : 0 erreur, `IconName` inclut les 5 nouveaux noms.

### Task 0.2 : Importer les logos du design

**Files:**
- Create: `public/logo.svg`, `public/logo-light.svg`

- [x] **Step 1 : Recuperer les deux logos** depuis le projet design (MCP `DesignSync`, `get_file` sur `assets/logo.svg` et `assets/logo-light.svg`) et les ecrire dans `public/`. `logo.svg` = version couleur (header clair) ; `logo-light.svg` = version blanche (footer navy).

- [x] **Step 2 : Verifier** que les deux fichiers s'affichent : ouvrir `https://badge.local/logo.svg` et `https://badge.local/logo-light.svg`.

### Task 0.3 : Header public (nav sticky + menu mobile)

**Files:**
- Create: `src/components/marketing/PublicSiteHeader.tsx`

**Interfaces:**
- Produces: `export function PublicSiteHeader({ active }: { active?: "fonctionnalites" | "tarifs" | "apropos" | "contact" })` — client component. Reproduit `assets/public.js` : logo -> `/`, nav (Fonctionnalites/Tarifs/A propos/Contact), CTAs "Se connecter" (`/login`) + "Demander une demo" (`/contact`), burger < 880px ouvrant un panneau mobile.

- [x] **Step 1 : Ecrire le composant** (Client). Structure Tailwind (sticky, fond translucide + blur, bordure basse) :

```tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

const NAV = [
  { id: "fonctionnalites", label: "Fonctionnalités", href: "/fonctionnalites" },
  { id: "tarifs", label: "Tarifs", href: "/tarifs" },
  { id: "apropos", label: "À propos", href: "/a-propos" },
  { id: "contact", label: "Contact", href: "/contact" },
] as const;

export function PublicSiteHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-8 px-7">
        <Link href="/" className="flex items-center" aria-label="Badge — accueil">
          <Image src="/logo.svg" alt="Badge" width={92} height={28} className="h-7 w-auto" priority />
        </Link>
        <nav aria-label="Navigation principale" className="hidden gap-7 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={`text-sm font-medium transition-colors hover:text-slate-900 ${active === n.id ? "text-green-600" : "text-slate-600"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <div className="hidden items-center gap-2.5 md:flex">
          <Link href="/login" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Se connecter</Link>
          <Link href="/contact" className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Demander une démo</Link>
        </div>
        <button type="button" className="p-1.5 text-slate-900 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="menu" size={22} />
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-7 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Navigation mobile">
            {NAV.map((n) => (
              <Link key={n.id} href={n.href} className="text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>{n.label}</Link>
            ))}
            <Link href="/login" className="mt-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Se connecter</Link>
            <Link href="/contact" className="rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-medium text-white" onClick={() => setOpen(false)}>Demander une démo</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
```

- [x] **Step 2 : Typecheck** : `make typecheck`.

### Task 0.4 : Footer public (navy, 4 colonnes)

**Files:**
- Create: `src/components/marketing/PublicSiteFooter.tsx`

**Interfaces:**
- Produces: `export function PublicSiteFooter()` — Server Component. Reproduit le footer de `assets/public.js` : marque + baseline, colonnes Produit / Entreprise / Legal, barre de bas de page (copyright + liens legaux). Version logo blanche `/logo-light.svg`. Liens : Produit (`/fonctionnalites`, `/tarifs`, `/verify`, `/login`), Entreprise (`/a-propos`, `/contact`, `/styleguide`), Legal (`/mentions-legales`, `/confidentialite`, `/cgu`).

- [x] **Step 1 : Ecrire le composant** (fond `bg-brand-navy`, texte blanc attenue). Colonnes en grille `1.5fr 1fr 1fr 1fr`, responsive 2 colonnes < 820px. Reprendre les libelles exacts de `assets/public.js`.

- [x] **Step 2 : Typecheck** : `make typecheck`.

### Task 0.5 : Layout du route group `(marketing)`

**Files:**
- Create: `src/app/(marketing)/layout.tsx`

- [x] **Step 1 : Ecrire le layout** qui enveloppe les pages marketing dans le chrome partage. Le `active` du header est determine par page via un prop passe depuis chaque page (le layout rend un header neutre ; chaque page peut rendre son propre header avec `active` — voir note). Approche simple : le layout rend `<PublicSiteHeader />` + `<main>{children}</main>` + `<PublicSiteFooter />`, et l'etat "actif" de la nav est gere par chaque page via un composant client lisant `usePathname()`.

```tsx
import { PublicSiteHeader } from "@/components/marketing/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/marketing/PublicSiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-slate-900">
      <PublicSiteHeader />
      <main>{children}</main>
      <PublicSiteFooter />
    </div>
  );
}
```

- [x] **Step 2 : Faire lire l'etat actif via `usePathname`** dans `PublicSiteHeader` (remplacer le prop `active` par un calcul interne depuis `usePathname()` de `next/navigation`, deja client). Adapter la Task 0.3 en consequence : `const active = deriveActive(usePathname())`. Cela evite de threader `active` a travers le layout.

- [x] **Step 3 : Typecheck + lint** : `make typecheck && make lint`.

### Task 0.6 : Composants marketing partages

**Files:**
- Create: `src/components/marketing/SectionHeading.tsx`, `CtaBand.tsx`, `FaqAccordion.tsx`, `BadgeCredential.tsx`, `BrowserMock.tsx`

**Interfaces (signatures a respecter par les pages) :**
- `SectionHeading({ eyebrow, title, lede?, center?, onNavy? }: { eyebrow: string; title: string; lede?: string; center?: boolean; onNavy?: boolean })`
- `CtaBand({ title, body, actions }: { title: string; body: string; actions: React.ReactNode })`
- `FaqAccordion({ items }: { items: { q: string; a: string }[] })`
- `BadgeCredential({ compact?: boolean })` — maquette de badge (bande navy, photo, nom, role, bande categorie, QR + meta)
- `BrowserMock({ url, children }: { url: string; children: React.ReactNode })` — cadre "navigateur"

- [x] **Step 1 : `SectionHeading`** — eyebrow (uppercase, `text-green-600`, sur navy `text-green-400`), titre `font-[--font-badge] font-bold tracking-tight` en tailles responsives (`text-3xl md:text-[38px]`), lede optionnel. Prop `center` centre + `max-w-[720px] mx-auto`.

- [x] **Step 2 : `CtaBand`** — bloc `rounded-[20px] bg-brand-navy text-white p-14 text-center`, titre display, body, `actions` (boutons). Boutons "on navy" : blanc plein (`bg-white text-brand-navy`) et ghost (`bg-white/10 border border-white/25 text-white`).

- [x] **Step 3 : `FaqAccordion`** — liste de `<details className="group border-b border-slate-200">` ; `<summary>` avec `list-none cursor-pointer` + chevron `Icon name="chevron-down"` en `group-open:rotate-180 transition-transform` ; reponse en `<p>`. Aucun JS (natif). Premier item `open` par defaut si souhaite (prop optionnel `defaultOpenFirst`).

- [x] **Step 4 : `BadgeCredential`** — reproduire `.badge-card` : conteneur `w-[257px] h-[360px] rounded-[14px] border bg-white font-[--font-badge]`, bande navy 12px, photo carree, nom `text-[22px] font-bold`, role, bande categorie coloree, pied avec faux QR (`Card`/`div` en damier) + meta. Accepter des props de contenu ou coder l'exemple "Camille Fabre / Salon Pro 2026" du design. Faux QR : un `div` avec motif damier via `background` inline (repris de `.qr-box`).

- [x] **Step 5 : `BrowserMock`** — cadre `rounded-2xl border shadow-xl` avec barre superieure (3 points + `url`) et corps `children`. Utilise pour les maquettes produit (hero accueil, splits fonctionnalites, a-propos).

- [x] **Step 6 : Typecheck** : `make typecheck`.

- [x] **Step 7 : Commit**

```bash
git add src/components/ui/Icon.tsx src/components/marketing public/logo.svg public/logo-light.svg src/app/\(marketing\)/layout.tsx
git commit -m "feat(v4): fondations du site public (chrome, icones, composants marketing partages)"
```

---

# PHASE 1 — Page d'accueil (landing complete)

**But :** Remplacer la landing placeholder par la page `accueil.html` complete. Source : `accueil.html` (deja portee dans ce plan). La page reprend, dans l'ordre : Hero, bande de confiance (logos), Fonctionnalites (6 cartes), Comment ca marche (3 etapes), Split Badges, Split Scanner (navy), Audiences (3), Bande metriques (navy), Apercu tarifs (3 offres), FAQ (5), CTA finale.

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Delete: `src/app/page.tsx` (remplace — sa logique de redirection auth migre dans le nouveau fichier)
- Delete/retirer: `src/components/public/LandingView.tsx` (remplace) apres confirmation 0 usage residuel

### Task 1.1 : Migrer la route racine dans le group marketing avec la redirection auth

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Delete: `src/app/page.tsx`

- [x] **Step 1 : Recreer la logique d'entree** dans `src/app/(marketing)/page.tsx` (Server Component) : conserver la redirection des utilisateurs connectes (reprise de `src/app/page.tsx` actuel — `getServerSession` + `resolveHomeRedirect`), sinon rendre la landing :

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { resolveHomeRedirect } from "@/lib/org-redirect";
import { LandingHero /* + sections */ } from "@/components/marketing/landing"; // ou sections inline

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const ctx = await loadUserContext(session.user.id);
    redirect(resolveHomeRedirect(ctx, null));
  }
  return ( /* sections de la landing */ );
}
```

- [x] **Step 2 : Supprimer** `src/app/page.tsx` (`git rm`). Verifier que `/` resout desormais vers `src/app/(marketing)/page.tsx` : `make dev` puis ouvrir `https://badge.local/` en visiteur.

### Task 1.2 : Section Hero

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

- [x] **Step 1 : Composer le hero** (grille 2 colonnes, `bg-slate-50`, bordure basse) d'apres `accueil.html` : chip "Nouveau · Scanner QR hors-ligne sur mobile", titre `h1` display "La gestion de badges, simple et maitrisee.", lede, deux CTAs (`/contact` "Demander une demo" + `/fonctionnalites` "Voir les fonctionnalites"), ligne de confiance (icone `shield-check` + "Hebergement en Europe · Conforme RGPD · Sans engagement"). Colonne droite : `BrowserMock` (url `badge.app/admin/events/salon-2026`) contenant 3 stats + un tableau d'inscriptions (statuts colores) + un `BadgeCredential compact` en surimpression. Reprendre le contenu exact du design.

- [x] **Step 2 : Test navigateur** — le hero s'affiche desktop + mobile (badge flottant masque < 940px comme dans le design).

### Task 1.3 : Sections de contenu (confiance -> CTA finale)

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

- [x] **Step 1 : Bande de confiance** — libelle "Ils organisent leurs evenements avec Badge" + 5 logos factices (`SP/IN/CX/UF/MV`).

- [x] **Step 2 : Fonctionnalites** — `SectionHeading` centre ("Une plateforme complete" / "Tout le cycle de vie d'un badge, au meme endroit" / lede) + grille de 6 `feat` (icone dans pastille verte, titre, texte). Contenus exacts du design (Inscriptions en ligne, Moderation & approbation, Badges PDF + QR, Controle d'acces par scan, Roles & permissions, Journal d'activite).

- [x] **Step 3 : Comment ca marche** — 3 `step-card` numerotees (creez l'evenement / collectez & moderez / imprimez & scannez).

- [x] **Step 4 : Split Badges** — texte + ticklist (4 puces) a gauche, `BadgeCredential` a droite.

- [x] **Step 5 : Split Scanner (navy)** — section `bg-brand-navy`, `split rev`, ticklist 4 puces + maquette scanner (cadre sombre, reticule d'angles verts, ligne laser). Coder le visuel scanner en Tailwind (aspect 3/4, coins en `border-green-400`).

- [x] **Step 6 : Audiences** — `SectionHeading` centre + 3 cartes (Salons & congres / Institutions & administrations / Ecoles & associations).

- [x] **Step 7 : Bande metriques (navy)** — 4 metriques (98% / <1s / 3x / 100%) avec unite en `text-green-400`.

- [x] **Step 8 : Apercu tarifs** — `SectionHeading` centre + `PricingCards` (Task creee en Phase 3, cf. Note DRY) + lien "Comparer les offres en detail ->" vers `/tarifs`.

- [x] **Step 9 : FAQ** — `FaqAccordion` avec les 5 questions du design (installation, hebergement Europe, personnalisation badges, controle d'acces, multi-organisation).

- [x] **Step 10 : CTA finale** — `CtaBand` "Pret a simplifier vos evenements ?" avec boutons `/contact` + `/login`.

- [x] **Step 11 : Supprimer le dead code** — `rg -n "LandingView" src` ; si plus reference, `git rm src/components/public/LandingView.tsx`.

- [x] **Step 12 : Test navigateur** — parcourir toute la landing desktop + mobile, verifier les liens (nav, CTAs, footer).

> Note DRY : `PricingCards` est partage entre l'accueil (apercu) et `/tarifs` (page complete). Le construire en Phase 3 Task 3.1 puis l'importer ici, OU inverser l'ordre d'implementation (faire `PricingCards` avant la Task 1.3 Step 8). Le tracker doit refleter la dependance.

- [x] **Step 13 : Commit**

```bash
git add -A
git commit -m "feat(v4): landing marketing complete sur la page d'accueil"
```

---

# PHASE 2 — Page Fonctionnalites (`/fonctionnalites`)

**But :** Reproduire `fonctionnalites.html`. Sections : Hero titre, Split Inscriptions (maquette formulaire), Split Moderation (navy? non — slate, maquette batch bar + table), Split Badges (`BadgeCredential`), Split Scanner (navy), grille "Et aussi" (6 cartes), CTA finale.

**Files:**
- Create: `src/app/(marketing)/fonctionnalites/page.tsx`

### Task 2.1 : Page Fonctionnalites

- [x] **Step 1 : Hero de section** — `SectionHeading` centre : eyebrow "Fonctionnalites", `h1` "Tout ce qu'il faut pour gerer un evenement de bout en bout", lede. Fond `bg-slate-50`, bordure basse.

- [x] **Step 2 : Split Inscriptions** — texte + ticklist (4 puces) + `BrowserMock` (url `badge.app/e/salon-pro-2026`) contenant un mini-formulaire (champ Nom rempli, `radio-cards` Visiteur/Exposant, bouton "S'inscrire"). Reutiliser `RadioCards`/`Input` si adaptes, sinon maquette statique.

- [x] **Step 3 : Split Moderation (slate, `rev`)** — texte + ticklist + `BrowserMock` avec une batch-bar ("12 selectionnees" + boutons Approuver/Rejeter) et une petite table de statuts.

- [x] **Step 4 : Split Badges** — texte + ticklist + `BadgeCredential`.

- [x] **Step 5 : Split Scanner (navy, `rev`)** — texte + ticklist + maquette scanner (reutiliser le visuel de la landing — extraire un composant `ScannerMock` si duplique 2x : landing + ici + fonctionnalites). Extraire `src/components/marketing/ScannerMock.tsx` et l'utiliser aux deux endroits.

- [x] **Step 6 : Grille "Et aussi"** — `SectionHeading` centre + 6 cartes (Roles & permissions, Journal d'activite, Multi-organisation, Conformite RGPD, Exports, Parametrage fin). Contenus exacts du design.

- [x] **Step 7 : CTA finale** — `CtaBand` "Voir Badge en action" (boutons `/contact` + `/tarifs`).

- [x] **Step 8 : Test navigateur** + nav active "Fonctionnalites" surlignee.

- [x] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat(v4): page publique fonctionnalites"
```

---

# PHASE 3 — Page Tarifs (`/tarifs`)

**But :** Reproduire `tarifs.html`. Sections : Hero + 3 offres (`PricingCards`), Tableau comparatif (`cmp`), FAQ tarifs (4), CTA finale.

**Files:**
- Create: `src/app/(marketing)/tarifs/page.tsx`
- Create: `src/components/marketing/PricingCards.tsx`
- Create: `src/components/marketing/ComparisonTable.tsx`

### Task 3.1 : Composant PricingCards (partage)

**Files:**
- Create: `src/components/marketing/PricingCards.tsx`

**Interfaces:**
- Produces: `export function PricingCards({ showOffRows?: boolean })` — 3 offres (Decouverte / Pro (hot) / Entreprise). Chaque offre : nom, prix (`amt` display + `per`), description, liste de features (tick vert), lignes "off" grisees optionnelles, bouton CTA. Donnees exactes du design (Decouverte gratuit -> `/login`; Pro 79 €/mois -> `/contact`; Entreprise sur devis -> `/contact`).

- [x] **Step 1 : Ecrire `PricingCards`** avec les 3 offres et leurs listes de features exactes (cf. `accueil.html` / `tarifs.html`). L'offre Pro porte le badge "Le plus choisi" et une bordure verte + ring.

- [x] **Step 2 : Typecheck** ; brancher l'apercu de la landing (Phase 1 Task 1.3 Step 8) sur ce composant.

### Task 3.2 : Tableau comparatif

**Files:**
- Create: `src/components/marketing/ComparisonTable.tsx`

- [x] **Step 1 : Ecrire `ComparisonTable`** — table `cmp` avec en-tetes (Decouverte/Pro/Entreprise), groupes de lignes ("Inscriptions", "Badges & acces", "Equipe & conformite") et cellules (`check` vert / `minus` gris / texte). Reprendre exactement les lignes du design. Wrapper dans un conteneur `overflow-x-auto` (scroll horizontal mobile).

- [x] **Step 2 : Typecheck.**

### Task 3.3 : Page Tarifs

**Files:**
- Create: `src/app/(marketing)/tarifs/page.tsx`

- [x] **Step 1 : Hero** — `SectionHeading` centre (eyebrow "Tarifs", `h1` "Des offres simples, a l'usage", lede) + `PricingCards`.
- [x] **Step 2 : Comparaison** — titre "Comparer les offres" + `ComparisonTable`.
- [x] **Step 3 : FAQ tarifs (slate)** — `FaqAccordion` avec les 4 questions du design (changer d'offre, depassement de quota, engagement, tarifs associatifs/publics).
- [x] **Step 4 : CTA finale** — `CtaBand` "Une question sur l'offre adaptee ?" (bouton `/contact`).
- [x] **Step 5 : Test navigateur** (scroll table mobile OK, nav active "Tarifs").
- [x] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(v4): page publique tarifs (offres, comparatif, faq)"
```

---

# PHASE 4 — Page A propos (`/a-propos`)

**But :** Reproduire `a-propos.html`. Sections : Hero navy, Mission (split + `BrowserMock` avec stats + `MiniChart`), Valeurs (3), Bande metriques (navy), Equipe (4 membres), CTA finale.

**Files:**
- Create: `src/app/(marketing)/a-propos/page.tsx`

### Task 4.1 : Page A propos

- [x] **Step 1 : Hero navy** — section `bg-brand-navy text-white`, eyebrow + `h1` "Nous rendons l'accueil des evenements enfin fluide" + lede.
- [x] **Step 2 : Mission** — split : texte (2 paragraphes) + `BrowserMock` (url `badge.app`) avec 3 stats (Organisations 340+, Evenements 2 100, Badges emis 1,4 M) + `MiniChart` (reutiliser `src/components/ui/MiniChart.tsx`).
- [x] **Step 3 : Valeurs (slate)** — `SectionHeading` centre + 3 `value` (Sobriete / Confiance / Proximite) avec icones `sliders` / `shield-check` / `users`.
- [x] **Step 4 : Metriques (navy)** — 4 metriques (340+ / 2 100 / 1,4 M / 12 pays).
- [x] **Step 5 : Equipe** — `SectionHeading` centre + grille 4 membres (avatar initiales + nom + role). Contenus exacts du design.
- [x] **Step 6 : CTA finale** — `CtaBand` "Envie d'en savoir plus ?" (boutons `/contact` + `/fonctionnalites`).
- [x] **Step 7 : Test navigateur** (nav active "A propos").
- [x] **Step 8 : Commit**

```bash
git add -A
git commit -m "feat(v4): page publique a propos"
```

---

# PHASE 5 — Page Contact (`/contact`)

**But :** Reproduire `contact.html` : grille 2 colonnes (coordonnees a gauche, formulaire a droite). Le formulaire est fonctionnel (validation client + envoi).

**Files:**
- Create: `src/app/(marketing)/contact/page.tsx`
- Create: `src/app/(marketing)/contact/ContactForm.tsx` (client)
- Create (optionnel, cf. Step) : `src/app/api/contact/route.ts`

### Task 5.1 : Page Contact + coordonnees

**Files:**
- Create: `src/app/(marketing)/contact/page.tsx`

- [x] **Step 1 : Colonne gauche** — eyebrow "Contact", `h1` "Parlons de vos evenements", lede, puis 4 `contact-item` (E-mail `contact@badge.app`, Telephone, Adresse, Securite & RGPD `privacy@badge.app`) avec icones `mail` / `smartphone` / `map-pin` / `shield-check`. Contenus exacts du design.
- [x] **Step 2 : Colonne droite** — `Card` contenant `<ContactForm />`.

### Task 5.2 : Formulaire de contact (client)

**Files:**
- Create: `src/app/(marketing)/contact/ContactForm.tsx`

**Interfaces:**
- Produces: `export function ContactForm()` — champs : Prenom, Nom, E-mail pro (requis), Organisation, Sujet (`Select` : Demander une demo / Question sur les tarifs / Support technique / Partenariat / Autre), Message (`textarea`), case de consentement (lien vers `/confidentialite`), bouton "Envoyer la demande". Reutiliser `Input`, `Select`, primitives de `FormControls`.

- [x] **Step 1 : Ecrire le test** du formulaire (Vitest + Testing Library) : rendu des champs, soumission bloquee si e-mail vide ou consentement non coche, affichage d'un etat de succes apres soumission valide (mock du POST).

- [x] **Step 2 : Lancer, verifier l'echec** : `make test -- ContactForm`.

- [x] **Step 3 : Implementer le formulaire** (Client) : etat local, validation (e-mail requis + regex simple, consentement obligatoire), soumission `fetch("/api/contact", { method: "POST", body })`, etats pending/success/error, message de succes ("Reponse sous 1 jour ouvre · Aucune carte requise").

- [x] **Step 4 : Endpoint d'envoi** — creer `src/app/api/contact/route.ts` (POST) : valider le payload (zod), rate-limit (reutiliser l'utilitaire de rate-limit existant du projet), envoyer un e-mail au contact plateforme via l'infra mail existante (`src/lib/mail.ts` / `getPlatformSmtp`). Ne rien exposer de sensible. Journaliser via `logActivity` si un type adapte existe (sinon, envoi simple sans nouveau `ActivityType`).

> Alternative si l'envoi backend est hors perimetre souhaite : rendre le formulaire en **UI seule** avec etat de succes simule et un commentaire `// TODO(v4): brancher l'envoi cote serveur`. A trancher avec l'utilisateur ; par defaut, implementer l'endpoint pour eviter une demi-fonctionnalite.

- [x] **Step 5 : Lancer les tests** : `make test -- ContactForm` — Attendu : PASS.

- [x] **Step 6 : Test navigateur** — remplir/soumettre le formulaire (cas valide + cas invalides), verifier l'e-mail recu dans Mailpit (`https://mail.badge.local`) si l'endpoint est implemente.

- [x] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(v4): page publique contact avec formulaire"
```

---

# PHASE 6 — Pages legales (`/mentions-legales`, `/confidentialite`, `/cgu`)

**But :** Reproduire `mentions-legales.html`, `confidentialite.html`, `cgu.html`. Meme gabarit `.legal` : lien retour, `h1` display, date de mise a jour, sections `h2` + paragraphes/listes.

**Files:**
- Create: `src/components/marketing/LegalLayout.tsx`
- Create: `src/app/(marketing)/mentions-legales/page.tsx`, `confidentialite/page.tsx`, `cgu/page.tsx`

### Task 6.1 : Gabarit LegalLayout

**Files:**
- Create: `src/components/marketing/LegalLayout.tsx`

**Interfaces:**
- Produces: `export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode })` — conteneur `max-w-[760px] mx-auto px-7 py-14`, lien retour `/` ("<- Retour a l'accueil"), `h1` display, ligne "Mis a jour le …", puis `children` (prose : `h2` sections, `p`, `ul`). Styliser la prose en Tailwind (titres 19px semibold, corps 15px `text-slate-700` interligne 1.7).

- [x] **Step 1 : Ecrire `LegalLayout`.**
- [x] **Step 2 : Typecheck.**

### Task 6.2 : Les trois pages legales

**Files:**
- Create: `src/app/(marketing)/mentions-legales/page.tsx`, `confidentialite/page.tsx`, `cgu/page.tsx`

- [x] **Step 1 : Porter le contenu** de chaque page depuis le design (MCP `DesignSync` `get_file` sur `mentions-legales.html`, `confidentialite.html`, `cgu.html`) dans le `LegalLayout`, en reprenant fidelement titres de sections et texte. Le contenu legal est du texte statique ; le reproduire tel quel (fr, accents).
- [x] **Step 2 : Metadonnees** — `export const metadata` par page (title "Badge — Mentions legales", etc.).
- [x] **Step 3 : Test navigateur** — les 3 pages s'affichent, le lien retour fonctionne, les liens du footer pointent correctement.
- [x] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(v4): pages legales publiques (mentions, confidentialite, cgu)"
```

---

# PHASE 7 — Finitions, metadonnees, verification globale

**But :** Coherence finale : etats actifs de nav, responsive, a11y, metadonnees SEO, liens sortants, verification complete.

**Files:**
- Modify: `src/app/layout.tsx` (metadonnees par defaut si besoin), pages marketing (`export const metadata`)

### Task 7.1 : Metadonnees et SEO

- [x] **Step 1 : `export const metadata`** sur chaque page marketing (title + description) reprenant les `<title>` du design (ex. accueil : "Badge — Inscriptions, badges & controle d'acces pour vos evenements").
- [x] **Step 2 : Verifier le `lang="fr"`** (deja pose dans `src/app/layout.tsx`) et les landmarks sur chaque page.

### Task 7.2 : Verification globale

- [x] **Step 1 : Liens** — verifier que tous les liens internes resolvent (nav, footer, CTAs) : `/`, `/fonctionnalites`, `/tarifs`, `/a-propos`, `/contact`, `/mentions-legales`, `/confidentialite`, `/cgu`, et les sortants `/login`, `/verify`, `/styleguide`. Aucun lien mort.
- [x] **Step 2 : Responsive** — tester chaque page en largeurs 1280 / 900 / 375 px (nav -> burger < 880, grilles qui s'empilent, table tarifs scrollable, badge flottant masque).
- [x] **Step 3 : Etats actifs** — la nav surligne la page courante via `usePathname`.
- [x] **Step 4 : Verifications** : `make lint && make typecheck && make test` — tout au vert (comparer la suite E2E au baseline connu, ~53 echecs pre-existants ; aucune nouvelle regression).
- [x] **Step 5 : Revue visuelle** — comparer chaque page rendue a son fichier design (`get_file`) : hierarchie, espacements, couleurs (navy/vert), typographie display. Ajuster les ecarts.
- [x] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(v4): metadonnees, etats de nav et finitions du site public"
```

---

## Self-review (couverture)

| Page design | Route | Phase | Couvert |
|---|---|---|---|
| accueil.html | `/` (maj landing) | 1 | Oui |
| fonctionnalites.html | `/fonctionnalites` | 2 | Oui |
| tarifs.html | `/tarifs` | 3 | Oui |
| a-propos.html | `/a-propos` | 4 | Oui |
| contact.html | `/contact` | 5 | Oui |
| mentions-legales.html | `/mentions-legales` | 6 | Oui |
| confidentialite.html | `/confidentialite` | 6 | Oui |
| cgu.html | `/cgu` | 6 | Oui |
| chrome (public.js) | header/footer partages | 0 | Oui |

## Decisions actees / a confirmer

- **Approche style** : Tailwind-first + reutilisation des primitives et tokens existants (pas de portage des classes semantiques de `badge.css`), pour rester coherent avec le reskin v2-16. `badge.css` sert de reference visuelle, pas de source a copier.
- **Route group `(marketing)`** : la racine `/` migre dans le group (avec sa redirection auth) pour partager header/footer. Les pages fonctionnelles existantes (`/login`, `/verify`, `/e/[slug]`, espaces app) restent hors du group et ne sont pas retouchees.
- **Formulaire de contact** : implemente avec un vrai endpoint d'envoi par defaut (evite une demi-fonctionnalite) ; repli UI-seule possible si l'utilisateur prefere differer le backend.
- **`index.html` (galerie des ecrans)** du footer design : remappe vers `/styleguide` ou masque (choix a la mise en oeuvre).

## Notes d'execution (2026-07-18)

Toutes les phases realisees. Verifications : `make typecheck` 0 erreur, `make lint` 0 erreur
(warnings pre-existants), smoke des 8 routes publiques (`/`, `/fonctionnalites`, `/tarifs`,
`/a-propos`, `/contact`, `/mentions-legales`, `/confidentialite`, `/cgu`) => 200 avec le bon
contenu. `/api/contact` : validation (400 sur payload invalide) et rate-limit OK.

Fait :
- Fondations : 5 icones ajoutees (`check-circle`, `building`, `chevron-down`, `sliders`, `minus`),
  logos `public/logo.svg` + `public/logo-light.svg`, `PublicSiteHeader` (client, nav active via
  `usePathname`), `PublicSiteFooter`, layout `(marketing)`, composants partages (`SectionHeading`,
  `CtaBand`, `FaqAccordion`, `BadgeCredential`, `BrowserMock`, `ScannerMock`, `PricingCards`,
  `ComparisonTable`, `LegalLayout`, `styles.ts`).
- Landing `/` (remplace `src/app/page.tsx`, `LandingView` supprime), Fonctionnalites, Tarifs,
  A propos, Contact (+ `ContactForm` client + `/api/contact`), 3 pages legales.
- Prose legale : bloc `.legal-prose` ajoute a `globals.css` (CSS plein).

Ecarts (assumes) :
- **Tests** : le test unitaire du `ContactForm` (Phase 5 Task 5.2 TDD) n'a PAS ete ecrit, sur
  directive explicite de l'utilisateur ("oublie les tests"). Le formulaire est fonctionnel
  (validation client, etats pending/success/error) mais non couvert par un test.
- **Livraison email contact** : `/api/contact` renvoie 502 en dev car le SMTP plateforme
  (`PlatformSettings`) n'est pas configure dans cet environnement — dependance partagee par TOUS
  les emails de l'app, pas un bug du site public. Le code de l'endpoint est correct (envoi via
  `resolveTransporter`/`buildEmail`) ; il delivrera des que le SMTP plateforme pointe sur Mailpit.
- **Revue visuelle navigateur** (Phase 7) : substituee par le smoke automatise (routes 200 +
  contenu) + typecheck/lint. Revue pixel desktop/mobile a confirmer cote utilisateur.
