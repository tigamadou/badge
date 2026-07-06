# Refonte design system (marine + vert) -- Implementation Plan

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (lint + typecheck + tests verts + verification visuelle OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [x] | 2026-06-17 | Pre-flight : branche `feat/design_implementation`, conteneurs up, typecheck baseline propre. |
| 1  | [x] | 2026-06-17 | `globals.css` tokens DS + `@theme` (`bg-brand-navy`, Inter), `layout.tsx` Inter+Montserrat, `lang="fr"`. Revue OK. |
| 2  | [x] | 2026-06-17 | `lucide-react@1.20.0` installe (peer deps React 19 OK), 12 icones nav verifiees. |
| 3  | [x] | 2026-06-17 | `SidebarNav.tsx` client : etat actif (rail vert + green-500/15), groupes. **Corrige (Task 16)** : icone passee par NOM string + registre interne (une fonction ne traverse pas la frontiere RSC). |
| 4  | [x] | 2026-06-17 | `StaffShell` marine + SidebarNav + header role-badge. Props inchangees. Revue OK. |
| 5  | [x] | 2026-06-17 | `OrgShell` marine + nom org + OrgSelector + StaffBanner. Props inchangees. Revue OK. |
| 6  | [x] | 2026-06-17 | `EventShell` marine + back-link + groupe Administration + role-badge vert. Props inchangees. Revue OK. |
| 7  | [x] | 2026-06-17 | `Button` primaire vert + focus-visible ring. Edition directe. |
| 8  | [x] | 2026-06-17 | `Input`+`Select` border slate-300 + focus ring vert + err rose-600. Edition directe. |
| 9  | [x] | 2026-06-17 | `Modal` overlay black/40 backdrop-blur + rounded-2xl shadow-xl + header/body/footer. Edition directe. |
| 10 | [x] | 2026-06-17 | `Table` thead slate-50 + hover ; `Pagination` page active verte + focus. Edition directe. |
| 11 | [x] | 2026-06-17 | `StatusBadge` deja conforme (amber/emerald/rose + label) : aucun changement. |
| 12 | [x] | 2026-06-17 | `AuthCard` partage (7 pages auth centralisees) + hero marine `PublicEventLayout`. Logique metier intacte (revue). Fixes DRY M1/M2/M4. |
| 13 | [x] | 2026-06-17 | `indigo-*` -> `green-*` sur 8 fichiers vivants (perl). 0 indigo hors legacy. |
| 14 | [x] | 2026-06-17 | `gray-*` -> `slate-*` (40 fichiers), `blue-600/700` accent -> vert (17 fichiers), dropzone RegistrationForm. Paires info blue-50/200 preservees. |
| 15 | [x] | 2026-06-17 | Legacy v1 `AdminShell`/`Sidebar`/`Header` supprimes (code mort, accord utilisateur). 0 indigo dans tout src. |
| 16 | [x] | 2026-06-17 | typecheck OK, lint 0 erreur (25 warnings preexistants), Vitest 606/606. Revue whole-branch : Ready, logique metier clean. Fix M1 (3 shells de role -> marine). doc maj. E2E : voir note. |

**Derniere session** : 2026-06-17, plan **integralement implemente** (16/16 [x]).
**Bug notable (Task 16)** : `SidebarNav` (client) recevait les icones Lucide (fonctions) depuis les shells (Server Components) -> erreur runtime RSC "Functions cannot be passed to Client Components", crash de tous les shells. Resolu : noms d'icones (strings) + registre interne. Detecte par l'E2E (invisible au typecheck/lint et a la revue de diff).
**E2E** : aucune regression deterministe apres correctifs. Verifie par comparaison de runs complets baseline (53 echecs) vs refonte + preuve de flakiness (2 runs du meme code -> sets d'echecs differents). Les ~53 echecs residuels sont **preexistants** : env mail/SMTP casse (`getaddrinfo ENOTFOUND smtp.*.test`), flakiness BDD (workers paralleles + reset BDD global `beforeEach`), bugs app connus. Unique regression introduite (3 assertions de texte setup-password apres correction d'accent) -> corrigee (regex test tolerante a l'accent).
**Commit** : **non effectue** (consigne utilisateur) -- modifications dans l'arbre de travail, pretes pour le commit utilisateur.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapter l'application Badge v2 existante au design system genere depuis Claude Design (sidebar marine `#004D74`, accent vert `green-600`, neutres slate, plat sans ombre sauf modales, Inter pour l'UI + Montserrat pour les badges), par une **migration reelle des classes** (pas de remap implicite), en commencant par les fondations + le chrome (shells, header, primitives) pour que l'essentiel de l'app herite du nouveau look, puis un balayage des usages residuels.

**Architecture:** Le design medium est du HTML/CSS prototype ; on le **recree** en React/Tailwind v4 dans le code existant. Les tokens DS sont declares en variables CSS dans `globals.css` (mirroir de `colors_and_type.css` + `badge.css` du bundle) et une couleur de marque non-standard (`--color-brand-navy: #004D74`) est exposee via `@theme` pour donner les utilitaires `bg-brand-navy`/`text-brand-navy`. Les trois shells partagent un composant client `SidebarNav` (etat actif via `usePathname`). Les primitives partagees (`Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`) portent l'accent vert ; comme la majeure partie des pages compose avec ces primitives + les shells, migrer ces ~10 fichiers fait basculer l'essentiel de l'app. Un balayage final convertit les `indigo-*` et neutres residuels restes en classes brutes dans les pages.

**Tech Stack:** Next.js 16 (App Router, Server Components par defaut), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `next/font/google` (Inter + Montserrat), `lucide-react` (nouvelle dep, icones nav). Verification : `make lint`, `make typecheck`, `make test`, plus controle visuel navigateur (golden path).

**Source design:** bundle Claude Design `design-badge/` -- README + `colors_and_type.css` + `assets/badge.css` + `ui_kits/badge-app/kit.css` + `assets/shell.js` + 44 ecrans HTML. Decisions de l'utilisateur (transcript) : palette **DS marine + vert** (pas le bleu electrique du brief), **Inter (UI) + Montserrat (badges)**, migration **reelle** des classes.

## Global Constraints

- **Langue UI** : francais avec accents (é, è, à, ç, ê). Voix neutre/administrative, pas de marketing, pas d'emoji. Casse phrase ; majuscules seulement pour en-tetes de table, labels de stat (`uppercase tracking-wider text-xs`) et enums machine (`PENDING`/`APPROVED`/`REJECTED`).
- **Accent unique** : `green-600` (`#16a34a`) hover `green-700` ; nav active = texte `green-400` + fond `green-500/15` + rail gauche `border-l-2 border-green-400`.
- **Sidebar** : marine `#004D74`, largeur `w-56` (14rem), header blanc `h-14`, canvas `bg-slate-50`.
- **Plat par mandat** : aucune `shadow-*` sur elements ordinaires ; seule exception = modales (`shadow-xl`). Profondeur = bordures + contraste sidebar/canvas.
- **Rayons** : `rounded-lg` (boutons/inputs), `rounded-xl` (cartes/tables), `rounded-2xl` (modales), `rounded-full` (status badges).
- **Bordures** : `slate-200` cartes/tables, `slate-300` inputs, `slate-100` separateurs de lignes.
- **Poids de police** : 400/500/600 uniquement dans le chrome (jamais 700 sauf rendu badge Montserrat).
- **Accessibilite AA** : focus clavier toujours visible (`focus-visible` ring vert 2px offset 2px) ; statut jamais code par la couleur seule (le `StatusBadge` porte toujours un libelle texte).
- **Transparence/blur** : exactement deux usages -- fond nav active (`green-500/15`) et overlay modale (`bg-black/40 backdrop-blur-sm`).
- **Semantiques d'etat** : success emerald, warning amber, danger rose, info blue -- reserves aux etats, jamais comme accent.
- **Polices** : Inter = UI (defaut `--font-sans`) ; Montserrat = badges uniquement (`--font-badge`, ne plus l'appliquer globalement). Acces sortant `fonts.googleapis.com` a preserver.
- **Verification avant "fini"** : `make lint && make typecheck && make test` (conteneur Docker dev), puis controle visuel navigateur. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur. Branche `feat/design_implementation`.

---

## File Structure

**Fichiers a creer :**

- `src/components/admin/SidebarNav.tsx` -- composant client generique : rend une liste d'entrees de nav (lien + icone) ou de groupes, avec detection de l'item actif via `usePathname`. Partage par les trois shells.

**Fichiers a modifier (chrome + fondations) :**

- `src/app/globals.css` -- ajouter les tokens DS (variables CSS) + bloc `@theme` (font Inter, `--color-brand-navy`) + regle focus-visible globale.
- `src/app/layout.tsx` -- charger Inter (defaut UI) et Montserrat (badge) via `next/font/google`, exposer `--font-inter` / `--font-montserrat`.
- `src/components/staff/StaffShell.tsx` -- sidebar marine + logo + nav icones + header fil d'Ariane.
- `src/components/admin/OrgShell.tsx` -- sidebar marine + nom org + org-selector + bandeau staff.
- `src/components/event/EventShell.tsx` -- sidebar marine + back-link + nom event + groupe Administration + role-badge.
- `src/components/admin/StaffBanner.tsx` -- harmoniser bandeau ambre (relire avant edit).
- `src/components/ui/Button.tsx` -- variante primaire verte + focus-visible.
- `src/components/ui/Input.tsx` -- border slate-300, focus ring vert.
- `src/components/ui/Select.tsx` -- idem Input.
- `src/components/ui/Modal.tsx` -- overlay black/40 backdrop-blur, rounded-2xl shadow-xl.
- `src/components/ui/Table.tsx` -- en-tete slate-50, dividers slate-100 (ajustements mineurs).
- `src/components/ui/Pagination.tsx` -- page active verte, focus vert.
- `src/components/ui/StatusBadge.tsx` -- verification (deja proche).
- `src/components/public/*` -- carte auth centree + hero event (relire avant edit).

**Fichiers a balayer (Task 13/14, classes brutes residuelles) :** les 22 fichiers contenant `indigo-` + ceux avec `gray-8/9` ou `blue-600` utilises comme accent. Liste exacte produite par grep au debut de chaque task de balayage.

**A NE PAS toucher (sauf decision Task 15) :** `src/components/admin/AdminShell.tsx`, `src/components/admin/Sidebar.tsx`, `src/components/admin/Header.tsx` -- legacy v1, non importes par aucune page (verifie : seul `AdminShell` se reference lui-meme).

---

## Note sur la nature des tests

Cette refonte est une **migration visuelle** (classes CSS/Tailwind, structure de chrome). Ecrire des tests unitaires qui assertent des chaines de classes Tailwind est a faible valeur et fragile (YAGNI). La verification de chaque task repose donc sur :

1. **`make typecheck`** -- aucune regression de types (les signatures de props changent dans certaines tasks).
2. **`make lint`** -- aucune nouvelle erreur (warnings preexistants toleres).
3. **`make test`** -- la suite Vitest existante reste verte (aucun test ne doit casser).
4. **Controle visuel navigateur** -- ouvrir l'ecran concerne via `http://badge.local` (ou `localhost:3000`) et comparer a l'ecran HTML de reference du bundle. C'est la verification primaire.

Les tests E2E Playwright existants (selecteurs par texte/role, pas par classe) ne doivent pas casser ; les lancer en Task 16.

---

## Phase 0 -- Pre-flight

### Task 0 : Etat de depart

**Files:** aucun (verification seule).

- [ ] **Step 1 : Verifier la branche et l'arbre git propre**

Run:
```bash
cd /Users/amadou/Devs/projects/badge && git status --short && git branch --show-current
```
Expected : branche `feat/design_implementation`, arbre propre (ou seulement le present plan non commite).

- [ ] **Step 2 : Demarrer l'environnement de dev**

Run:
```bash
make dev
```
Expected : conteneurs `app`/`mysql`/`mailpit`/`caddy` up. App joignable sur `http://localhost:3000`.

- [ ] **Step 3 : Snapshot visuel "avant"**

Ouvrir et observer (pas de capture obligatoire, juste memoriser le look actuel) : `/login`, un dashboard staff `/staff`, un dashboard org `/admin/[orgId]`. Noter : accent indigo, sidebars slate-900/gray-900, police Montserrat partout.

- [ ] **Step 4 : Confirmer la baseline verte**

Run:
```bash
make typecheck && make lint && make test
```
Expected : typecheck OK, lint sans erreur (warnings preexistants OK), tests verts. C'est la baseline a preserver.

---

## Phase 1 -- Fondations (tokens + polices)

### Task 1 : Tokens DS + polices dans `globals.css` et `layout.tsx`

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces : variables CSS `--brand-navy`, `--accent`, `--accent-hover`, `--font-badge`, etc. + utilitaires Tailwind `bg-brand-navy` / `text-brand-navy` (via `@theme`). `--font-sans` = Inter ; `--font-badge` = Montserrat. Consommees par les shells (Task 4-6) et le rendu badge.

- [ ] **Step 1 : Reecrire `globals.css`**

Remplacer integralement le contenu par :

```css
@import "tailwindcss";

/* ============================================================
   Badge v2 — Design tokens (mirroir du bundle Claude Design :
   colors_and_type.css + assets/badge.css). Migration reelle :
   l'accent est green-600, la sidebar marine #004D74.
   ============================================================ */

@theme {
  /* Police UI par defaut = Inter ; Montserrat reserve aux badges. */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  /* Couleur de marque non couverte par la palette Tailwind. */
  --color-brand-navy: #004d74;
}

:root {
  /* Marque (logo) */
  --brand-navy: #004d74;
  --brand-green: rgb(54, 171, 88);

  /* Accent interactif (= Tailwind green-600 / 700) */
  --accent: #16a34a;
  --accent-hover: #15803d;
  --accent-nav: #4ade80; /* green-400 : texte nav active */
  --accent-nav-bg: rgba(34, 197, 94, 0.15); /* green-500/15 */

  /* Police badge (rendu credential uniquement) */
  --font-badge: var(--font-montserrat), var(--font-sans);

  /* Layout */
  --sidebar-w: 14rem; /* w-56 */
  --header-h: 3.5rem; /* h-14 */
}

/* Accessibilite AA : focus clavier toujours visible. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2 : Charger Inter + Montserrat dans `layout.tsx`**

Remplacer le contenu par :

```tsx
import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Badge Bénin",
  description: "Badge Bénin",
  icons: {
    icon: "/icon.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
```

> Note : `lang` passe de `en` a `fr` (l'UI est francaise -- coherence accessibilite/SEO).

- [ ] **Step 3 : Verifier le typecheck + build de la couche style**

Run:
```bash
make typecheck
```
Expected : PASS (aucune erreur de type ; `next/font` Inter/Montserrat resolus).

- [ ] **Step 4 : Verification visuelle**

Ouvrir `http://localhost:3000/login`. Expected : la police de l'UI est desormais **Inter** (plus fine/neutre que Montserrat). Aucune regression de layout. Si une page utilise explicitement `font-[family]` Montserrat hors badge, la noter pour Task 13/14.

---

## Phase 1bis -- Dependance icones

### Task 2 : Ajouter `lucide-react`

**Files:**
- Modify: `package.json` (via `yarn`)

**Interfaces:**
- Produces : import `{ LayoutDashboard, Users, Settings, ... } from "lucide-react"`. Consomme par `SidebarNav` (Task 3) et les shells.

> **Decision (flagged)** : le DS standardise sur Lucide (stroke 1.5, `currentColor`, taille 16/18/20). `lucide-react` est la lib de reference pour la stack Next + React 19, tree-shakeable. C'est une nouvelle dependance applicative (pas une modif d'infra) ; si l'utilisateur prefere une autre lib d'icones deja presente, l'adapter ici.

- [ ] **Step 1 : Installer**

Run:
```bash
cd /Users/amadou/Devs/projects/badge && yarn add lucide-react
```
Expected : `lucide-react` ajoute aux `dependencies` de `package.json`, `yarn.lock` mis a jour.

- [ ] **Step 2 : Verifier l'import dans le conteneur**

Run:
```bash
make typecheck
```
Expected : PASS (le paquet resout). Si le conteneur ne voit pas la dep, relancer `make dev` pour reinstaller dans l'image.

---

## Phase 2 -- Chrome (shells + nav)

### Task 3 : `SidebarNav` (composant client generique avec etat actif)

**Files:**
- Create: `src/components/admin/SidebarNav.tsx`

**Interfaces:**
- Produces :
  ```ts
  type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean };
  type NavGroup = { group: string };
  export type NavEntry = NavLink | NavGroup;
  export function SidebarNav({ items }: { items: NavEntry[] }): JSX.Element;
  ```
  `exact: true` -> item actif uniquement si `pathname === href` (pour les racines dashboard, dont le href est prefixe de toutes les sous-routes). Sinon actif si `pathname === href` ou `pathname.startsWith(href + "/")`. Consomme par Tasks 4-6.

- [ ] **Step 1 : Creer le composant**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};
export type NavGroup = { group: string };
export type NavEntry = NavLink | NavGroup;

function isActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(link.href + "/");
}

export function SidebarNav({ items }: { items: NavEntry[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item, i) => {
        if ("group" in item) {
          return (
            <div
              key={`g-${i}`}
              className="px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/45"
            >
              {item.group}
            </div>
          );
        }
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm transition-colors ${
              active
                ? "border-green-400 bg-green-500/15 font-medium text-green-400"
                : "border-transparent text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} strokeWidth={1.5} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run:
```bash
make typecheck
```
Expected : PASS.

---

### Task 4 : `StaffShell` au design marine

**Files:**
- Modify: `src/components/staff/StaffShell.tsx`

**Interfaces:**
- Consumes : `SidebarNav` (Task 3), icones `lucide-react`.
- Produces : meme signature de props (`user`, `children`) -- aucun appelant a modifier.

- [ ] **Step 1 : Reecrire le composant**

```tsx
import Link from "next/link";
import type { StaffRole } from "@prisma/client";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";
import { SidebarNav, type NavEntry } from "@/components/admin/SidebarNav";

const NAV: NavEntry[] = [
  { href: "/staff", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/staff/organizations", label: "Organisations", icon: Building2 },
  { href: "/staff/users", label: "Utilisateurs", icon: Users },
  { href: "/staff/settings", label: "Paramètres", icon: Settings },
  { href: "/staff/activity", label: "Journal", icon: ScrollText },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super administrateur",
  STAFF_ADMIN: "Administrateur",
  STAFF_SUPPORT: "Support",
  STAFF_OBSERVER: "Observateur",
};

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StaffShell({
  user,
  children,
}: {
  user: { name: string; email: string; staffRole: StaffRole };
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="mb-3 px-2 text-base font-semibold text-white">Badge</div>
        <SidebarNav items={NAV} />
        <div className="mt-auto pt-2">
          <Link
            href="/api/auth/signout"
            prefetch={false}
            className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
            Déconnexion
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center gap-3 border-b border-slate-200 bg-white px-5">
          <nav className="flex flex-1 items-center gap-2 text-sm">
            <span className="text-slate-400">Staff</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-navy">
            {ROLE_LABEL[user.staffRole]}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{user.name}</span>
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {initials(user.name)}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck + lint**

Run:
```bash
make typecheck && make lint
```
Expected : PASS.

- [ ] **Step 3 : Verification visuelle**

Ouvrir `http://localhost:3000/staff`. Expected : sidebar marine `#004D74`, item "Tableau de bord" actif (texte vert + rail gauche vert + fond translucide), icones Lucide a gauche, header blanc avec role-badge marine + initiales. Naviguer vers `/staff/organizations` -> l'item actif suit la route.

---

### Task 5 : `OrgShell` au design marine

**Files:**
- Modify: `src/components/admin/OrgShell.tsx`

**Interfaces:**
- Consumes : `SidebarNav` (Task 3), `OrgSelector`, `StaffBanner` (existants).
- Produces : meme signature de props.

- [ ] **Step 1 : Reecrire le composant**

```tsx
import { Settings, LayoutDashboard, Calendar, Users, Tags, ScrollText } from "lucide-react";
import { OrgSelector } from "./OrgSelector";
import { StaffBanner } from "./StaffBanner";
import { SidebarNav, type NavEntry } from "./SidebarNav";

type Org = { id: string; name: string; slug: string };

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function OrgShell({
  org,
  user,
  orgs,
  isStaffMode,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  isStaffMode: boolean;
  children: React.ReactNode;
}) {
  const nav: NavEntry[] = [
    { href: `/admin/${org.id}`, label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { href: `/admin/${org.id}/events`, label: "Événements", icon: Calendar },
    { href: `/admin/${org.id}/members`, label: "Membres", icon: Users },
    { href: `/admin/${org.id}/templates`, label: "Modèles catégories", icon: Tags },
    { href: `/admin/${org.id}/settings`, label: "Paramètres", icon: Settings },
    { href: `/admin/${org.id}/activity`, label: "Journal", icon: ScrollText },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="mb-1 px-2 text-base font-semibold text-white">Badge</div>
        <div className="mb-3 px-2 text-sm font-medium text-white/80">{org.name}</div>
        <SidebarNav items={nav} />
        <div className="mt-auto pt-2 px-2 text-xs text-slate-400 truncate">{user.email}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {isStaffMode && <StaffBanner orgName={org.name} />}
        <header className="flex h-14 flex-none items-center gap-3 border-b border-slate-200 bg-white px-5">
          <nav className="flex flex-1 items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">{org.name}</span>
          </nav>
          <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {initials(user.name)}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
```

> Si `OrgSelector` porte un style indigo, il sera traite au balayage Task 13. Le bouton conserve son comportement.

- [ ] **Step 2 : Typecheck + lint**

Run:
```bash
make typecheck && make lint
```
Expected : PASS.

- [ ] **Step 3 : Verification visuelle**

Ouvrir `http://localhost:3000/admin/[orgId]` (remplacer par un id reel via le seed). Expected : sidebar marine avec "Badge" + nom org, nav active verte, header avec nom org + selecteur d'org + initiales. Si `isStaffMode`, bandeau ambre en haut.

---

### Task 6 : `EventShell` au design marine

**Files:**
- Modify: `src/components/event/EventShell.tsx`

**Interfaces:**
- Consumes : `SidebarNav` (Task 3).
- Produces : meme signature de props.

- [ ] **Step 1 : Reecrire le composant**

```tsx
import Link from "next/link";
import { ArrowLeft, LayoutDashboard, UserCheck, IdCard, Tags, Users, ScanLine, Settings, ScrollText } from "lucide-react";
import type { EffectiveEventRole } from "@/types/auth";
import { SidebarNav, type NavEntry } from "@/components/admin/SidebarNav";

type Event = { id: string; title: string; slug: string; date: Date; archived: boolean; registrationOpen: boolean };
type Org = { id: string; name: string };

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function EventShell({
  org,
  event,
  effectiveRole,
  isStaffMode,
  user,
  children,
}: {
  org: Org;
  event: Event;
  effectiveRole: Exclude<EffectiveEventRole, null>;
  isStaffMode: boolean;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const base = `/admin/${org.id}/events/${event.id}`;
  const nav: NavEntry[] = [
    { href: base, label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { href: `${base}/registrations`, label: "Inscriptions", icon: UserCheck },
    { href: `${base}/badges`, label: "Badges", icon: IdCard },
    { href: `${base}/categories`, label: "Catégories", icon: Tags },
    { href: `${base}/scan`, label: "Scanner", icon: ScanLine },
    { href: `${base}/members`, label: "Membres", icon: Users },
    { group: "Administration" },
    { href: `${base}/settings`, label: "Paramètres", icon: Settings },
    { href: `${base}/activity`, label: "Journal", icon: ScrollText },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="mb-3 px-2 text-base font-semibold text-white">Badge</div>
        <div className="mb-3 px-2">
          <Link
            href={`/admin/${org.id}/events`}
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft size={13} strokeWidth={1.5} /> {org.name}
          </Link>
          <div className="text-sm font-semibold text-white">{event.title}</div>
        </div>
        <SidebarNav items={nav} />
        <div className="mt-auto pt-2 px-2 text-xs text-slate-400 truncate">{user.email}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {isStaffMode && (
          <div className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700">
            <strong className="font-semibold">Mode staff</strong> — vos actions sont auditées et visibles par le OWNER.
          </div>
        )}
        <header className="flex h-14 flex-none items-center gap-3 border-b border-slate-200 bg-white px-5">
          <nav className="flex flex-1 items-center gap-2 text-sm">
            <span className="text-slate-400">{org.name}</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-700">{event.title}</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-700">
            {effectiveRole}
          </span>
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {initials(user.name)}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck + lint**

Run:
```bash
make typecheck && make lint
```
Expected : PASS.

- [ ] **Step 3 : Verification visuelle**

Ouvrir un event `http://localhost:3000/admin/[orgId]/events/[eventId]`. Expected : sidebar marine avec back-link `← [org]`, titre event, nav avec separateur de groupe "Administration" avant Parametres/Journal, header avec fil `org / event` + role-badge vert. Verifier que l'item actif suit chaque sous-route (inscriptions, badges, scan...).

---

## Phase 3 -- Primitives partagees

### Task 7 : `Button`

**Files:**
- Modify: `src/components/ui/Button.tsx`

**Interfaces:**
- Produces : meme API (`variant: "primary" | "secondary" | "danger"`), accent vert. Aucun appelant a changer.

- [ ] **Step 1 : Migrer les variantes**

Dans `variantClasses`, remplacer la ligne `primary` :

```tsx
const variantClasses: Record<Variant, string> = {
  primary: "bg-green-600 text-white hover:bg-green-700",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
```

Et ajouter le focus-visible accessible a la classe de base (conserver le reste) :

```tsx
className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${variantClasses[variant]} ${className}`}
```

- [ ] **Step 2 : Typecheck + lint**

Run:
```bash
make typecheck && make lint
```
Expected : PASS.

- [ ] **Step 3 : Verification visuelle**

Recharger `/login` : le bouton "Se connecter" est vert (`green-600`), hover plus fonce, focus clavier visible (ring vert).

---

### Task 8 : `Input` + `Select`

**Files:**
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Select.tsx`

**Interfaces:**
- Produces : memes API. Bordure `slate-300` (= `--border-input` du DS), focus `ring-green-500`.

- [ ] **Step 1 : `Input` -- migrer la classe du champ**

Remplacer la `className` du `<input>` :

```tsx
className={`w-full px-3 py-2 border rounded-lg text-sm ${
  error ? "border-rose-400" : "border-slate-300"
} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
```

Et le message d'erreur en `text-rose-600` (au lieu de `text-rose-500`) pour matcher `--danger-fg` :

```tsx
{error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
```

- [ ] **Step 2 : `Select` -- meme migration**

Remplacer la `className` du `<select>` :

```tsx
className={`w-full px-3 py-2 border rounded-lg text-sm ${
  error ? "border-rose-400" : "border-slate-300"
} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
```

Et le message d'erreur en `text-rose-600`.

- [ ] **Step 3 : Typecheck + lint + visuel**

Run:
```bash
make typecheck && make lint
```
Expected : PASS. Visuel : focus d'un champ login -> ring vert, bordure transparente.

---

### Task 9 : `Modal`

**Files:**
- Modify: `src/components/ui/Modal.tsx`

**Interfaces:**
- Produces : meme API. Overlay `bg-black/40 backdrop-blur-sm`, panneau `rounded-2xl shadow-xl`.

- [ ] **Step 1 : Migrer overlay + panneau**

Remplacer le wrapper et la carte :

```tsx
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-200 px-6 py-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="px-6 py-5 text-sm text-slate-600">{children}</div>
      <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
);
```

> Conforme au DS : overlay = seule transparence + blur autorise, modale = seule `shadow-*` autorisee, `rounded-2xl`, structure header/body/footer.

- [ ] **Step 2 : Typecheck + lint + visuel**

Run:
```bash
make typecheck && make lint
```
Expected : PASS. Visuel : declencher une suppression (ex. detail org/event) -> overlay sombre floute, modale arrondie avec ombre, header/footer separes.

---

### Task 10 : `Table` + `Pagination`

**Files:**
- Modify: `src/components/ui/Table.tsx`
- Modify: `src/components/ui/Pagination.tsx`

**Interfaces:**
- Produces : memes API. Table en-tete `bg-slate-50` plein, dividers `slate-100`. Pagination page active `bg-green-600`, focus vert.

- [ ] **Step 1 : `Table` -- en-tete plein slate-50**

Remplacer la `<tr>` du `<thead>` :

```tsx
<tr className="border-b border-slate-200 bg-slate-50">
```

(le reste -- `th` uppercase tracking-wider, `td` px-4 py-3, hover `bg-slate-50/50` -> mettre `hover:bg-slate-50` plein -- est conforme.)

Remplacer la ligne `<tr>` du `tbody` :

```tsx
<tr key={keyExtractor(item)} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
```

- [ ] **Step 2 : `Pagination` -- page active verte + focus**

Remplacer la classe du bouton numero de page (cas actif) :

```tsx
className={`px-3 py-1.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
  p === page
    ? "bg-green-600 text-white cursor-pointer"
    : "text-slate-600 hover:bg-slate-100 cursor-pointer"
}`}
```

Et migrer le `focus:ring-indigo-500` du `<select>` de taille de page en `focus:ring-green-500`.

- [ ] **Step 3 : Typecheck + lint + visuel**

Run:
```bash
make typecheck && make lint
```
Expected : PASS. Visuel : une liste paginee (ex. `/staff/organizations`) -> page active verte, en-tete de table gris plein, hover de ligne gris.

---

### Task 11 : `StatusBadge` + alertes

**Files:**
- Modify: `src/components/ui/StatusBadge.tsx` (verification, probablement deja conforme)

**Interfaces:**
- Produces : meme API. Pairs semantiques amber/emerald/rose, libelle texte present (AA).

- [ ] **Step 1 : Verifier la conformite**

Le composant actuel (`PENDING` amber, `APPROVED` emerald, `REJECTED` rose, `rounded-full text-xs`) est deja conforme au DS. Verifier que les libelles francais sont presents (statut non code par la couleur seule). Aucune modif d'accent necessaire ici -- ne pas introduire de vert.

> Si un audit montre des alertes/bannieres ad-hoc avec `indigo`/`blue` comme accent ailleurs, elles seront captees au balayage Task 13/14.

- [ ] **Step 2 : Typecheck**

Run:
```bash
make typecheck
```
Expected : PASS (aucun changement attendu, ou changement cosmetique mineur).

---

## Phase 4 -- Coquilles publiques / auth

### Task 12 : Carte auth centree + hero event public

**Files:**
- Modify: `src/components/public/*` (relire le repertoire avant edit -- 3 fichiers)
- Modify: pages auth `src/app/login`, `src/app/register`, `src/app/forgot-password`, `src/app/reset-password/[token]`, `src/app/setup-password`, `src/app/verify-email/[token]`, `src/app/select` (relire chacune avant edit)
- Modify: `src/app/e/[slug]` (en-tete event public)

**Interfaces:**
- Produces : layout centre conforme au DS (`auth-card` : carte blanche `max-w-[400px] rounded-2xl border border-slate-200 p-8` sur fond `bg-slate-50`), hero event marine sur l'inscription publique.

> Cette task est plus exploratoire : relire chaque page avant edit (structure variable). Appliquer le gabarit DS sans changer la logique (formulaires, server actions, validation). Le but : fond `bg-slate-50`, carte centree arrondie `rounded-2xl`, logo en haut, titres `text-[22px] font-semibold text-slate-900`, liens `text-green-600`.

- [ ] **Step 1 : Relire les pages publiques/auth**

Run:
```bash
ls src/components/public/ && ls src/app/login src/app/register src/app/forgot-password src/app/select 2>/dev/null
```
Puis lire chaque `page.tsx`/composant concerne avant de le modifier.

- [ ] **Step 2 : Appliquer le gabarit `auth-card`**

Pour chaque ecran d'auth, envelopper le contenu dans :

```tsx
<div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 py-10">
  <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8">
    {/* logo + titre + formulaire existant (boutons/inputs deja migres) */}
  </div>
</div>
```

Migrer les liens `text-indigo-600` -> `text-green-600` (capte aussi par Task 13 si oubli).

- [ ] **Step 3 : Hero event sur `/e/[slug]`**

Ajouter une banniere d'en-tete marine au-dessus du formulaire d'inscription publique :

```tsx
<div className="bg-brand-navy py-7 text-white">
  <div className="mx-auto flex max-w-[720px] items-center gap-4 px-5">
    <div className="flex h-13 w-13 flex-none items-center justify-center rounded-xl bg-white/12 font-bold">
      {/* initiales org ou logo */}
    </div>
    <div>
      <h1 className="text-[22px] font-semibold">{event.title}</h1>
      <div className="mt-1 flex flex-wrap gap-4 text-sm text-white/75">
        {/* lieu · date */}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4 : Typecheck + lint + visuel**

Run:
```bash
make typecheck && make lint
```
Expected : PASS. Visuel : `/login` et `/register` = carte centree arrondie sur fond gris ; `/e/[slug]` = hero marine au-dessus du formulaire.

---

## Phase 5 -- Balayage des classes residuelles

### Task 13 : Balayage accent `indigo-*` -> `green-*`

**Files:**
- Modify: les fichiers listes par le grep ci-dessous (hors composants deja migres Tasks 4-12).

- [ ] **Step 1 : Lister les occurrences restantes**

Run:
```bash
cd /Users/amadou/Devs/projects/badge && grep -rn "indigo-" src/ --include="*.tsx" --include="*.ts"
```
Expected : liste des occurrences restantes (les primitives/shells migres ne doivent plus apparaitre).

- [ ] **Step 2 : Convertir par equivalence de teinte**

Pour chaque occurrence, remplacer `indigo-N` par `green-N` a teinte egale (`bg-indigo-600` -> `bg-green-600`, `text-indigo-600` -> `text-green-600`, `hover:bg-indigo-700` -> `hover:bg-green-700`, `ring-indigo-500` -> `ring-green-500`, `border-indigo-400` -> `border-green-400`, `bg-indigo-500/15` -> `bg-green-500/15`, `text-indigo-400` -> `text-green-400`). Editer fichier par fichier (relecture du contexte avant chaque edit ; ne pas faire un `sed` aveugle sur tout l'arbre).

- [ ] **Step 3 : Verifier qu'il ne reste plus d'indigo**

Run:
```bash
grep -rn "indigo-" src/ --include="*.tsx" --include="*.ts" | wc -l
```
Expected : `0`.

- [ ] **Step 4 : Typecheck + lint + tests**

Run:
```bash
make typecheck && make lint && make test
```
Expected : PASS / suite verte.

---

### Task 14 : Balayage neutres + tri du bleu

**Files:**
- Modify: fichiers avec `gray-8/9` sidebar/neutre residuel et `blue-600` utilise comme accent.

- [ ] **Step 1 : Lister les neutres `gray-*` (standardiser sur `slate-*`)**

Run:
```bash
grep -rn "gray-[0-9]" src/ --include="*.tsx" | grep -v "node_modules"
```
Convertir les `gray-N` neutres en `slate-N` equivalents pour homogeneiser (le DS standardise sur slate). Les anciennes sidebars `bg-gray-900` des shells sont deja remplacees par `bg-brand-navy` (Tasks 4-6) -- ne rester que des usages de contenu.

- [ ] **Step 2 : Trier les `blue-*`**

Run:
```bash
grep -rn "blue-600\|blue-700" src/ --include="*.tsx"
```
Regle : `blue-*` est une **semantique d'info uniquement** dans le DS. Si un `blue-600` sert d'**accent/lien/bouton** -> le convertir en `green-600`. S'il sert d'**etat d'information** (alerte info, badge info) -> le conserver (paire `blue-50`/`blue-200`/`blue-700`). Decider au cas par cas en lisant le contexte.

- [ ] **Step 3 : Typecheck + lint + tests**

Run:
```bash
make typecheck && make lint && make test
```
Expected : PASS / suite verte.

---

### Task 15 : Sort du legacy v1 (decision utilisateur)

**Files:**
- Potentiellement supprimer : `src/components/admin/AdminShell.tsx`, `src/components/admin/Sidebar.tsx`, `src/components/admin/Header.tsx`.

- [ ] **Step 1 : Confirmer qu'ils sont morts**

Run:
```bash
grep -rn "AdminShell\|components/admin/Sidebar\|components/admin/Header" src/ --include="*.tsx" --include="*.ts" | grep -v "admin/AdminShell.tsx\|admin/Sidebar.tsx\|admin/Header.tsx"
```
Expected : aucune correspondance hors des trois fichiers eux-memes -> ils sont du code mort v1.

- [ ] **Step 2 : Demander a l'utilisateur**

**BLOQUANT** : ne pas supprimer de fichiers sans accord. Demander : "Les composants v1 `AdminShell`/`Sidebar`/`Header` sont du code mort. Les supprimer, ou les migrer au look marine pour reference ?" Selon la reponse : supprimer (avec `git rm` apres accord) ou migrer l'accent (indigo -> vert, sidebar -> marine) comme les shells v2.

---

## Phase 6 -- Verification finale

### Task 16 : Verifs globales + doc

**Files:**
- Modify: `docs/v2/architecture.md` (ou section design) -- consigner la refonte (accent vert, sidebar marine, Inter+Montserrat, lucide-react).
- Update: ce plan (`## Progression` -> toutes tasks `[x]`).

- [ ] **Step 1 : Suite complete**

Run:
```bash
make lint && make typecheck && make test
```
Expected : lint sans erreur, typecheck OK, Vitest vert.

- [ ] **Step 2 : E2E Playwright (selecteurs texte/role -- ne doivent pas casser)**

Run:
```bash
make test-e2e
```
Expected : suite E2E verte (les selecteurs ne dependent pas des classes de couleur). Si un test casse sur une classe, investiguer la cause racine (pas de contournement).

- [ ] **Step 3 : Parcours visuel golden path**

Ouvrir et verifier la coherence (marine + vert, Inter, plat) :
- `/login`, `/register` (carte centree)
- `/e/[slug]` (hero marine)
- `/staff` + `/staff/organizations` (StaffShell, nav active)
- `/admin/[orgId]` + `/admin/[orgId]/events` (OrgShell, selecteur org)
- `/admin/[orgId]/events/[eventId]` + sous-routes (EventShell, groupe Administration, role-badge)
- Une modale de suppression (overlay flou + shadow-xl)
- Une liste paginee (en-tete table gris, page active verte)

- [ ] **Step 4 : Confirmer l'absence d'accent residuel**

Run:
```bash
grep -rn "indigo-" src/ --include="*.tsx" --include="*.ts" | wc -l
```
Expected : `0`.

- [ ] **Step 5 : Mettre a jour la doc + le tracker**

Documenter la refonte dans `docs/v2/architecture.md` et passer toutes les lignes de `## Progression` a `[x]` avec la date.

---

## Self-Review (couverture vs design system)

- **Palette marine + vert** : tokens (Task 1), shells (Tasks 4-6), primitives (Tasks 7-10), balayage (Tasks 13-14). ✓
- **Inter (UI) + Montserrat (badges)** : Task 1 (layout + globals). Le rendu PDF badge (`@react-pdf/renderer`) gere deja Montserrat via `src/lib/badge-templates/fonts.ts` -- inchange. ✓
- **Trois shells (Staff/Org/Event)** : Tasks 4/5/6, avec identites de sidebar distinctes (logo seul / +org / +back-link+event) et groupe Administration. ✓
- **Nav active (rail vert + fond green-500/15)** : `SidebarNav` Task 3. ✓
- **Header h-14 + fil d'Ariane + avatar** : Tasks 4-6. ✓
- **Bandeaux staff (ambre) / readonly** : OrgShell + EventShell (Tasks 5/6) ; le `StaffBanner` existant est reutilise. ✓
- **Primitives (Button/Input/Select/Modal/Table/Pagination/StatusBadge)** : Tasks 7-11. ✓
- **Plat sauf modale** : Modal Task 9 (seule `shadow-xl`). ✓
- **Focus AA visible** : regle globale Task 1 + ring sur Button/Pagination. ✓
- **Public/auth centre + hero event** : Task 12. ✓
- **Statut non code par couleur seule** : StatusBadge garde son libelle (Task 11). ✓
- **Lucide icones** : Task 2 + SidebarNav. ✓

**Hors-scope explicite (a planifier separement si souhaite)** : reconstruction detaillee ecran-par-ecran des 44 maquettes (scanner QR plein format, grille de vignettes batch, mini-graphique 30 jours, radio-cards de categorie, dropzones, stepper wizard). Le present plan etablit les fondations + le chrome + les primitives pour que l'app herite du look ; les composants specialises d'ecran sont une extension ulterieure.
