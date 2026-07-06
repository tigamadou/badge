# Port des maquettes v2-16 — Plan directeur (composants transverses) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la bibliotheque de composants d'ecran partages (statcards, timeline, quota, minichart, radio-cards, dropzone, stepper, badge-card, scanner, etc.) absents du socle v2-15, pour que les 4 sous-plans d'espace (01-04) composent avec eux au lieu de dupliquer du balisage.

**Architecture:** Chaque classe de `template/assets/badge.css` devient un composant React presentational dans `src/components/ui/` (ou `src/components/badge/` pour le credential), en utilitaires Tailwind v4 sur les tokens v2-15 (marine + vert). Aucun import de `badge.css`. Les composants sont Server-Component-compatibles par defaut ; `"use client"` seulement quand il y a de l'etat (Switch, RadioCards, Stepper, Scanner, Dropzone, ChipFilter).

**Tech Stack:** Next.js 16 (App Router, RSC par defaut), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `lucide-react` (icones), Vitest 4 + `@testing-library/react` (tests de rendu). Verification : `make lint`, `make typecheck`, `make test`, + controle visuel navigateur.

**Reference visuelle autoritaire :** `template/assets/badge.css` (valeurs exactes) + `template/styleguide.html` (vitrine des composants) + les maquettes d'ecran citees par les sous-plans.

**Spec :** [`../specs/2026-07-06-v2-16-design-screens-port.md`](../specs/2026-07-06-v2-16-design-screens-port.md)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre. Apres chaque task validee (lint + typecheck + tests verts + revue visuelle OK), passer `[ ]` a `[x]` et dater. Mi-task -> `[~]` + note d'etat. Abandon -> `[-]` + raison.

Legende : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [x] | 2026-07-06 | Pre-flight OK : branche `feat/design_implementation`, conteneur `badge-app-1` up, typecheck + lint (0 erreur) baseline verts, socle v2-15 present. |
| 0.5| [x] | 2026-07-06 | `Icon` partage (`src/components/ui/Icon.tsx`, 41 icones) + recablage `SidebarNav` (registre centralise). Test rendu node OK, typecheck OK. |
| 1  | [x] | 2026-07-06 | `Card`/`CardHead`/`CardBody` (`src/components/ui/Card.tsx`). Test rendu OK, typecheck OK. |
| 2  | [x] | 2026-07-06 | `StatCard`/`StatGrid` (`src/components/ui/StatCard.tsx`). Test rendu OK, typecheck OK. |
| 3  | [x] | 2026-07-06 | `Timeline`/`TimelineItem` (`src/components/ui/Timeline.tsx`). Test rendu OK, typecheck OK. |
| 4  | [x] | 2026-07-06 | `QuotaBar`/`StorageAlert` (`src/components/ui/QuotaBar.tsx`). Test rendu OK, typecheck OK. |
| 5  | [x] | 2026-07-06 | `MiniChart` (`src/components/ui/MiniChart.tsx`). Test rendu OK, typecheck OK. |
| 6  | [x] | 2026-07-06 | Feedback (`src/components/ui/Feedback.tsx`) : Alert/EmptyState/Spinner/ProgressBar/SuccessRing. Test rendu OK, typecheck OK. |
| 7  | [x] | 2026-07-06 | `Toolbar`/`SearchInput`/`ChipFilter` (`src/components/ui/Toolbar.tsx`, client). Test rendu OK, typecheck OK. |
| 8  | [ ] | | `BatchBar`. |
| 9  | [ ] | | `CatPill` / `CatDot`, `RoleBadge`, `Tag`. |
| 10 | [ ] | | `FormSection`, `Switch`, `Checkbox`. |
| 11 | [ ] | | `RadioCards`. |
| 12 | [ ] | | `FileBox` + `Dropzone`. |
| 13 | [ ] | | `PasswordMeter`. |
| 14 | [ ] | | `Stepper`. |
| 15 | [ ] | | `Tabs` + `Segmented`. |
| 16 | [ ] | | `BadgeCard` + `MiniBadge` (reconciliation V1/V2). |
| 17 | [ ] | | `Scanner` (frame/reticle/laser + result). |
| 18 | [ ] | | `PickCard` / `OrgLogo`. |
| 19 | [ ] | | `PhoneMockup` + `VerifyBanner`. |
| 20 | [ ] | | Blocs journal : `LogType`, `KeyValue`, `Diff`, `Payload`. |
| 21 | [ ] | | Page `/styleguide` (dev-only) + verification directeur. |

---

## Global Constraints

_(Reprises de v2-15 — s'appliquent implicitement a chaque task.)_

- **Langue UI** : francais avec accents. Voix neutre/administrative, pas d'emoji.
- **Accent unique** : `green-600` hover `green-700`. Etats : succes emerald, attente/staff amber, danger rose, info blue — jamais comme accent.
- **Plat par mandat** : aucune `shadow-*` sauf modales (`shadow-xl`) et segmented control (`shadow-sm`). Profondeur = bordures + contraste.
- **Rayons** : `rounded-lg` (boutons/inputs), `rounded-xl` (cartes/tables), `rounded-2xl` (modales), `rounded-full` (badges de statut).
- **Bordures** : `border-slate-200` cartes/tables, `border-slate-300` inputs, `border-slate-100` separateurs de lignes.
- **Poids** : 400/500/600 dans le chrome ; 700 reserve au rendu badge (Montserrat, `font-badge`).
- **Accessibilite AA** : `focus-visible` ring vert (herite du global v2-15) ; statut jamais code par la couleur seule (toujours un libelle).
- **Marine** : `bg-brand-navy` (`#004D74`) — utilitaire deja expose via `@theme`.
- **Polices** : Inter (`font-sans`, defaut) ; Montserrat (`font-badge`) reserve au credential.
- **Nombres tabulaires** : stats/quotas/IDs en `tabular-nums`.
- **Verification** : `make lint && make typecheck && make test` (conteneur Docker dev) + controle visuel. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur.

**Convention de test (reskin)** : les composants presentational sont valides par (a) un test de rendu Vitest verifiant la presence des elements/textes/classes cles, (b) `make typecheck`, (c) controle visuel contre la maquette. Les composants a etat controle (Switch, RadioCards, Stepper, Tabs, Dropzone) sont rendus dans chaque etat (via leurs props) pour couvrir les variantes.

> **Adaptation (constat a l'execution, 2026-07-06)** : la repo n'a **pas** de stack DOM de test (ni `@testing-library/react`, ni jsdom/happy-dom) et son Vitest tourne en `environment: "node"` avec une politique de tests integration/node (cf. `vitest.config.ts`, `CLAUDE.md` §4). Plutot que d'introduire une nouvelle stack de test (RTL+jsdom) au milieu du lot, les tests de rendu utilisent **`renderToStaticMarkup` de `react-dom/server`** (env node, aucune dependance ajoutee) et assertent sur le HTML produit. Les exemples de tests RTL/`@testing-library` ecrits dans les tasks ci-dessous sont donc a transposer en assertions `renderToStaticMarkup` (rendre le composant dans chaque etat de prop et verifier le markup). La revue visuelle navigateur reste une etape **manuelle** (a faire par un humain / quand un navigateur est disponible) : elle n'est pas simulee ni affirmee automatiquement.

**Convention d'emplacement** : composants transverses dans `src/components/ui/` sauf `BadgeCard`/`MiniBadge` (`src/components/badge/`) et `Scanner` (`src/components/event/`, aligne sur `QRScanner` existant). Un fichier par composant (ou cluster proche), export nomme.

---

### Task 0: Pre-flight

**Files:** aucun (verification d'environnement).

- [x] **Step 1: Verifier la branche et les conteneurs**

Run: `git branch --show-current && make dev`
Expected: `feat/design_implementation` ; conteneurs `app`/`mysql`/`mailpit` up.

- [x] **Step 2: Baseline verte**

Run: `make typecheck && make lint`
Expected: typecheck OK, lint 0 erreur (warnings preexistants tolerees).

- [x] **Step 3: Confirmer le socle v2-15 present**

Run: `ls src/components/ui/ src/components/staff/StaffShell.tsx src/components/admin/OrgShell.tsx src/components/event/EventShell.tsx src/components/auth/AuthCard.tsx`
Expected: primitives `Button/Input/Select/Modal/Table/Pagination/StatusBadge` + les 3 shells + AuthCard presents. Si absent : STOP (le socle v2-15 est prerequis).

---

### Task 0.5: Icon (registre lucide partage)

v2-15 n'expose **pas** de composant `Icon` : le registre (~10 icones) est interne a `src/components/admin/SidebarNav.tsx` (Record `ICONS` non exporte). Presque tous les composants du directeur rendent une icone par NOM string (contrainte RSC v2-15 : ne pas passer de fonction a travers la frontiere client). On cree donc un composant `Icon` partage, utilisable en Server **et** Client Components (il rend `<LucideIcon/>`, ce qui est autorise en RSC ; c'est le *passage* d'une fonction en prop qui est interdit, pas le rendu).

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Modify: `src/components/admin/SidebarNav.tsx` (importer `IconName` + le registre depuis `Icon.tsx` au lieu de le dupliquer)
- Test: `src/components/ui/__tests__/Icon.test.tsx`

**Interfaces:**
- Produces:
  - `type IconName = string` litteral union des cles du registre.
  - `Icon({ name, size? }: { name: IconName; size?: number }): JSX.Element` — rend l'icone lucide correspondante avec `strokeWidth={1.5}` et `currentColor`. Si `name` absent du registre : rend `null` (jamais de crash) — a signaler en dev.
  - `ICON_NAMES: IconName[]` (pour la page styleguide).

- [x] **Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { Icon } from "../Icon";

test("Icon rend un svg pour un nom connu et rien pour un inconnu", () => {
  const { container, rerender } = render(<Icon name="building-2" size={18} />);
  expect(container.querySelector("svg")).toBeTruthy();
  rerender(<Icon name="ce-nom-nexiste-pas" size={18} />);
  expect(container.querySelector("svg")).toBeFalsy();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Icon.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import {
  LayoutDashboard, Building2, Users, Settings, ScrollText, Calendar, Tags, UserCheck, IdCard, ScanLine,
  LogOut, ArrowLeft, TrendingUp, TrendingDown, HardDrive, Search, UploadCloud, Check, X, File, Inbox,
  ShieldCheck, ShieldX, Shield, Eye, Menu, ChevronsUpDown, Plus, Download, Printer, Trash2, Pencil,
  Mail, AlertTriangle, Clock, MapPin, ArrowRight, ChevronRight, ExternalLink, Send, Smartphone,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  "layout-dashboard": LayoutDashboard, "building-2": Building2, users: Users, settings: Settings,
  "scroll-text": ScrollText, calendar: Calendar, tags: Tags, "user-check": UserCheck, "id-card": IdCard,
  "scan-line": ScanLine, "log-out": LogOut, "arrow-left": ArrowLeft, "trending-up": TrendingUp,
  "trending-down": TrendingDown, "hard-drive": HardDrive, search: Search, "upload-cloud": UploadCloud,
  check: Check, x: X, file: File, inbox: Inbox, "shield-check": ShieldCheck, "shield-x": ShieldX,
  shield: Shield, eye: Eye, menu: Menu, "chevrons-up-down": ChevronsUpDown, plus: Plus, download: Download,
  printer: Printer, "trash-2": Trash2, pencil: Pencil, mail: Mail, "alert-triangle": AlertTriangle,
  clock: Clock, "map-pin": MapPin, "arrow-right": ArrowRight, "chevron-right": ChevronRight,
  "external-link": ExternalLink, send: Send, smartphone: Smartphone,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={1.5} />;
}
```

_(Ajouter au registre toute icone reclamee par un ecran des sous-plans mais absente ci-dessus, au moment ou le sous-plan la demande.)_

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Icon.test.tsx`
Expected: PASS.

- [x] **Step 5: Recabler SidebarNav sur le registre partage + verifier**

Modifier `SidebarNav.tsx` pour importer `IconName` depuis `../ui/Icon` (supprimer le `ICONS` local duplique ; conserver `LucideIcon` uniquement si encore utilise). `make typecheck && yarn vitest run src/components/admin`.
Expected: OK, aucun shell casse (les 3 shells passent toujours des noms string valides).

---

### Task 1: Card / CardHead / CardBody

Bloc de contenu blanc, borde, radius-xl, sans ombre. Reference : `.card`, `.card-head`, `.card-pad` (badge.css). Base de la plupart des panels.

**Files:**
- Create: `src/components/ui/Card.tsx`
- Test: `src/components/ui/__tests__/Card.test.tsx`

**Interfaces:**
- Produces:
  - `Card({ children, className? }: { children: ReactNode; className?: string }): JSX.Element`
  - `CardHead({ title, subtitle?, action? }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }): JSX.Element`
  - `CardBody({ children, className? }: { children: ReactNode; className?: string }): JSX.Element`

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { Card, CardHead, CardBody } from "../Card";

test("Card rend un titre, un sous-titre, une action et un corps", () => {
  render(
    <Card>
      <CardHead title="Top 5 organisations" subtitle="Par inscriptions" action={<button>Voir</button>} />
      <CardBody>contenu</CardBody>
    </Card>,
  );
  expect(screen.getByText("Top 5 organisations")).toBeInTheDocument();
  expect(screen.getByText("Par inscriptions")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Voir" })).toBeInTheDocument();
  expect(screen.getByText("contenu")).toBeInTheDocument();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `make test -- src/components/ui/__tests__/Card.test.tsx` (ou `yarn vitest run src/components/ui/__tests__/Card.test.tsx`)
Expected: FAIL — module `../Card` introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Card.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 2: StatCard + StatGrid

KPI card (label uppercase, gros chiffre, sous-texte, delta up/down + icone). Reference : `.statcard`, `.stat-grid`, `.delta` (badge.css lignes 132-141, 17-22 du staff-dashboard).

**Files:**
- Create: `src/components/ui/StatCard.tsx`
- Test: `src/components/ui/__tests__/StatCard.test.tsx`

**Interfaces:**
- Consumes: `lucide-react` (icones passees par NOM string, jamais comme fonction — cf. bug RSC v2-15 Task 16).
- Produces:
  - `StatGrid({ cols, children }: { cols: 3 | 4 | 5; children: ReactNode }): JSX.Element`
  - `StatCard({ label, value, icon, sub?, delta? }: { label: string; value: ReactNode; icon: IconName; sub?: ReactNode; delta?: { dir: "up" | "down"; text: string } }): JSX.Element`
  - `type IconName = string` (nom lucide, ex. `"building-2"`) — reutiliser le registre d'icones introduit par `SidebarNav` en v2-15 ; si l'API du registre differe, adapter l'import ici et le documenter dans les notes du tracker.

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { StatCard, StatGrid } from "../StatCard";

test("StatCard affiche label, valeur, sous-texte et delta up", () => {
  render(
    <StatGrid cols={4}>
      <StatCard label="Organisations" value="24" icon="building-2" sub="ce mois" delta={{ dir: "up", text: "+2" }} />
    </StatGrid>,
  );
  expect(screen.getByText("Organisations")).toBeInTheDocument();
  expect(screen.getByText("24")).toBeInTheDocument();
  expect(screen.getByText("+2")).toBeInTheDocument();
  expect(screen.getByText("ce mois")).toBeInTheDocument();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/StatCard.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon"; // registre d'icones v2-15 ; sinon importer depuis SidebarNav

export function StatGrid({ cols, children }: { cols: 3 | 4 | 5; children: ReactNode }) {
  const colClass = cols === 5 ? "lg:grid-cols-5" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return <div className={`grid grid-cols-2 gap-4 ${colClass}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  icon,
  sub,
  delta,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  sub?: ReactNode;
  delta?: { dir: "up" | "down"; text: string };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-[13px] text-slate-400">
        {delta ? (
          <span
            className={`mr-1 inline-flex items-center gap-1 font-medium ${
              delta.dir === "up" ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            <Icon name={delta.dir === "up" ? "trending-up" : "trending-down"} size={12} />
            {delta.text}
          </span>
        ) : null}
        {sub}
      </p>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/StatCard.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck + revue visuelle**

Run: `make typecheck`
Expected: OK. Comparer a `template/screens/staff-dashboard.html` (4 statcards) : label uppercase, chiffre `text-2xl`, delta vert.

---

### Task 3: Timeline + TimelineItem

Fil d'activite vertical (rail + dots colores). Reference : `.tl`, `.tl-item`, `.tl-dot` (badge.css 209-220).

**Files:**
- Create: `src/components/ui/Timeline.tsx`
- Test: `src/components/ui/__tests__/Timeline.test.tsx`

**Interfaces:**
- Produces:
  - `Timeline({ children }): JSX.Element`
  - `TimelineItem({ tone?, title, meta }: { tone?: "default" | "ok" | "warn" | "danger"; title: ReactNode; meta: ReactNode }): JSX.Element`

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { Timeline, TimelineItem } from "../Timeline";

test("Timeline rend des items avec titre et meta", () => {
  render(
    <Timeline>
      <TimelineItem tone="ok" title="Organisation creee" meta="Marie Dubois · il y a 2 h" />
    </Timeline>,
  );
  expect(screen.getByText("Organisation creee")).toBeInTheDocument();
  expect(screen.getByText("Marie Dubois · il y a 2 h")).toBeInTheDocument();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Timeline.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

const DOT: Record<string, string> = {
  default: "border-slate-300 bg-white",
  ok: "border-green-600 bg-green-600",
  warn: "border-amber-700 bg-white",
  danger: "border-rose-600 bg-white",
};

export function Timeline({ children }: { children: ReactNode }) {
  return (
    <div className="relative pl-[26px] before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200">
      {children}
    </div>
  );
}

export function TimelineItem({
  tone = "default",
  title,
  meta,
}: {
  tone?: "default" | "ok" | "warn" | "danger";
  title: ReactNode;
  meta: ReactNode;
}) {
  return (
    <div className="relative pb-5 last:pb-0">
      <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full border-2 ${DOT[tone]}`} />
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="mt-0.5 text-xs text-slate-400">{meta}</div>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Timeline.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 4: QuotaBar + StorageAlert

Jauge de quota (label + valeur tabulaire + barre coloree seuils) et alerte stockage. Reference : `.quota`, `.qbar`, `.qfill` (badge.css 143-151) + alerte org-dashboard.

**Files:**
- Create: `src/components/ui/QuotaBar.tsx`
- Test: `src/components/ui/__tests__/QuotaBar.test.tsx`

**Interfaces:**
- Produces:
  - `QuotaBar({ label, valueText, pct }: { label: ReactNode; valueText: ReactNode; pct: number }): JSX.Element` — `pct` 0-100 ; seuils : `>= 90` danger (rose), `>= 75` warn (amber), sinon vert.
  - `StorageAlert({ pct, children }: { pct: number; children: ReactNode }): JSX.Element` — bandeau amber si `pct >= 75`.

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { QuotaBar } from "../QuotaBar";

test("QuotaBar clamp la largeur et expose la valeur", () => {
  render(<QuotaBar label="Stockage" valueText="18,4 / 200 Go" pct={120} />);
  expect(screen.getByText("Stockage")).toBeInTheDocument();
  const fill = screen.getByTestId("quota-fill");
  expect(fill).toHaveStyle({ width: "100%" }); // clamp a 100
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/QuotaBar.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

function fillTone(pct: number) {
  if (pct >= 90) return "bg-rose-600";
  if (pct >= 75) return "bg-amber-700";
  return "bg-green-600";
}

export function QuotaBar({ label, valueText, pct }: { label: ReactNode; valueText: ReactNode; pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="my-3.5">
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums text-slate-900">{valueText}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div data-testid="quota-fill" className={`h-full rounded-full ${fillTone(pct)}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export function StorageAlert({ pct, children }: { pct: number; children: ReactNode }) {
  if (pct < 75) return null;
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-700">
      {children}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/QuotaBar.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 5: MiniChart

Sparkline 30 jours (barres verticales). Reference : `.minichart` (badge.css 359-362).

**Files:**
- Create: `src/components/ui/MiniChart.tsx`
- Test: `src/components/ui/__tests__/MiniChart.test.tsx`

**Interfaces:**
- Produces: `MiniChart({ values, ariaLabel }: { values: number[]; ariaLabel: string }): JSX.Element` — normalise sur le max, hauteur 120px.

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MiniChart } from "../MiniChart";

test("MiniChart rend une barre par valeur avec un label accessible", () => {
  render(<MiniChart values={[2, 4, 8, 0]} ariaLabel="Inscriptions sur 30 jours" />);
  const chart = screen.getByRole("img", { name: "Inscriptions sur 30 jours" });
  expect(chart.querySelectorAll("i")).toHaveLength(4);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/MiniChart.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
export function MiniChart({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={ariaLabel} className="flex h-[120px] items-end gap-[3px]">
      {values.map((v, i) => (
        <i
          key={i}
          className="min-h-[3px] flex-1 rounded-t-[3px] bg-green-500 opacity-85 hover:bg-green-600 hover:opacity-100"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/MiniChart.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 6: Alert, EmptyState, Spinner, ProgressBar, SuccessRing

Cluster feedback. Reference : `.alert`, `.empty`/`.center-state`, `.spinner`, `.progress`, `.success-ring` (badge.css 236-237, 355-377).

**Files:**
- Create: `src/components/ui/Feedback.tsx`
- Test: `src/components/ui/__tests__/Feedback.test.tsx`

**Interfaces:**
- Produces:
  - `Alert({ tone, children }: { tone: "info" | "err" | "warn" | "success"; children: ReactNode }): JSX.Element`
  - `EmptyState({ icon, title, description?, action? }: { icon: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode }): JSX.Element`
  - `Spinner({ size? }: { size?: number }): JSX.Element`
  - `ProgressBar({ pct }: { pct: number }): JSX.Element`
  - `SuccessRing({ children }: { children: ReactNode }): JSX.Element`

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { Alert, EmptyState, ProgressBar } from "../Feedback";

test("Alert err a le role alert ; EmptyState montre titre ; ProgressBar clampe", () => {
  render(<Alert tone="err">Identifiants incorrects</Alert>);
  expect(screen.getByRole("alert")).toHaveTextContent("Identifiants incorrects");

  render(<EmptyState icon="inbox" title="Aucune inscription" />);
  expect(screen.getByText("Aucune inscription")).toBeInTheDocument();

  render(<ProgressBar pct={150} />);
  expect(screen.getByTestId("progress-fill")).toHaveStyle({ width: "100%" });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Feedback.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const ALERT: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  err: "border-rose-200 bg-rose-50 text-rose-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function Alert({ tone, children }: { tone: "info" | "err" | "warn" | "success"; children: ReactNode }) {
  return (
    <div role="alert" className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px] ${ALERT[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      <span className="text-slate-300">
        <Icon name={icon} size={40} />
      </span>
      <div className="text-sm font-medium text-slate-900">{title}</div>
      {description ? <div className="max-w-sm text-[13px] text-slate-400">{description}</div> : null}
      {action}
    </div>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className="inline-block animate-spin rounded-full border-[3px] border-slate-200 border-t-green-600"
      style={{ width: size, height: size }}
    />
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div data-testid="progress-fill" className="h-full rounded-full bg-green-600" style={{ width: `${w}%` }} />
    </div>
  );
}

export function SuccessRing({ children }: { children: ReactNode }) {
  return (
    <span className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-50 text-green-600">
      {children}
    </span>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Feedback.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 7: Toolbar + SearchInput + ChipFilter

Barre d'outils de liste (recherche + filtres chips). Reference : `.toolbar`, `.search-input`, `.chip-filter` + toolbar `event-inscriptions.html`. `ChipFilter` porte de l'etat -> `"use client"`.

**Files:**
- Create: `src/components/ui/Toolbar.tsx`
- Test: `src/components/ui/__tests__/Toolbar.test.tsx`

**Interfaces:**
- Produces:
  - `Toolbar({ children }): JSX.Element` — flex wrap, gap.
  - `SearchInput({ value, onChange, placeholder? }: { value: string; onChange: (v: string) => void; placeholder?: string }): JSX.Element` (client).
  - `ChipFilter({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): JSX.Element` (client) — select stylise en chip.

- [x] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SearchInput } from "../Toolbar";

test("SearchInput remonte la saisie", async () => {
  function Harness() {
    const [v, setV] = useState("");
    return <SearchInput value={v} onChange={setV} placeholder="Rechercher" />;
  }
  render(<Harness />);
  await userEvent.type(screen.getByPlaceholderText("Rechercher"), "abc");
  expect(screen.getByPlaceholderText("Rechercher")).toHaveValue("abc");
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Toolbar.test.tsx`
Expected: FAIL — module introuvable.

- [x] **Step 3: Write minimal implementation**

```tsx
"use client";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2.5">{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}

export function ChipFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium text-slate-900 outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Toolbar.test.tsx`
Expected: PASS.

- [x] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 8: BatchBar

Barre d'actions par lot (fond marine, compteur + actions). Reference : `.batch-bar` (badge.css 264-271).

**Files:**
- Create: `src/components/ui/BatchBar.tsx`
- Test: `src/components/ui/__tests__/BatchBar.test.tsx`

**Interfaces:**
- Produces:
  - `BatchBar({ count, children }: { count: number; children: ReactNode }): JSX.Element` — masque si `count === 0`.
  - `BatchButton({ icon?, children, onClick }: { icon?: IconName; children: ReactNode; onClick: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { BatchBar, BatchButton } from "../BatchBar";

test("BatchBar masque a 0, affiche compteur et actions sinon", () => {
  const { rerender } = render(<BatchBar count={0}><span>x</span></BatchBar>);
  expect(screen.queryByText("x")).not.toBeInTheDocument();
  rerender(
    <BatchBar count={3}>
      <BatchButton onClick={() => {}}>Approuver</BatchButton>
    </BatchBar>,
  );
  expect(screen.getByText(/3/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Approuver" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/BatchBar.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function BatchBar({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg bg-brand-navy px-4 py-2.5 text-sm text-white">
      <span className="font-semibold tabular-nums">{count} selectionnee(s)</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function BatchButton({ icon, children, onClick }: { icon?: IconName; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.14] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/[0.24]"
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/BatchBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 9: CatPill / CatDot, RoleBadge, Tag

Etiquettes. Reference : `.cat-pill`/`.cat-dot` (154-156), `.role-badge` (27-34), `.tag` (392).

**Files:**
- Create: `src/components/ui/Labels.tsx`
- Test: `src/components/ui/__tests__/Labels.test.tsx`

**Interfaces:**
- Produces:
  - `CatPill({ color, label, count? }: { color: string; label: ReactNode; count?: number }): JSX.Element` — `color` = valeur hex de la categorie.
  - `RoleBadge({ tone?, children }: { tone?: "green" | "navy" | "amber" | "slate"; children: ReactNode }): JSX.Element`
  - `Tag({ icon?, children }: { icon?: IconName; children: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { CatPill, RoleBadge, Tag } from "../Labels";

test("etiquettes rendent leur libelle", () => {
  render(<CatPill color="#16a34a" label="Exposant" count={128} />);
  expect(screen.getByText("Exposant")).toBeInTheDocument();
  expect(screen.getByText("128")).toBeInTheDocument();
  render(<RoleBadge tone="navy">SUPER_ADMIN</RoleBadge>);
  expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  render(<Tag>actif</Tag>);
  expect(screen.getByText("actif")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Labels.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function CatPill({ color, label, count }: { color: string; label: ReactNode; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-900">
      <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />
      {label}
      {count != null ? <span className="text-[11px] tabular-nums text-slate-400">{count}</span> : null}
    </span>
  );
}

const ROLE: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  navy: "bg-brand-navy/10 text-brand-navy",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
};

export function RoleBadge({ tone = "green", children }: { tone?: "green" | "navy" | "amber" | "slate"; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${ROLE[tone]}`}>
      {children}
    </span>
  );
}

export function Tag({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Labels.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 10: FormSection, Switch, Checkbox

Blocs de formulaire. Reference : `.form-section` (88-93), `.switch`/`.track` (102-110), `.check`/`.box` (95-100). `Switch`/`Checkbox` controles -> `"use client"`.

**Files:**
- Create: `src/components/ui/FormControls.tsx`
- Test: `src/components/ui/__tests__/FormControls.test.tsx`

**Interfaces:**
- Produces:
  - `FormSection({ title, description?, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }): JSX.Element`
  - `Switch({ checked, onChange, label? }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }): JSX.Element`
  - `Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Switch } from "../FormControls";

test("Switch bascule et expose aria-checked", async () => {
  function Harness() {
    const [on, setOn] = useState(false);
    return <Switch checked={on} onChange={setOn} label="Inscriptions ouvertes" />;
  }
  render(<Harness />);
  const sw = screen.getByRole("switch", { name: "Inscriptions ouvertes" });
  expect(sw).toHaveAttribute("aria-checked", "false");
  await userEvent.click(sw);
  expect(sw).toHaveAttribute("aria-checked", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/FormControls.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function FormSection({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 py-6 first:pt-0 last:border-b-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mb-4 mt-1 text-[13px] text-slate-400">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-slate-600"
    >
      <span className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${checked ? "bg-green-600" : "bg-slate-300"}`}>
        <span className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
      {label}
    </button>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded border ${checked ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white"}`}
      >
        {checked ? <Icon name="check" size={12} /> : null}
      </button>
      {label}
    </label>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/FormControls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 11: RadioCards

Selection de categorie en cartes radio colorees. Reference : `.radio-cards`/`.radio-card` (158-168). Client (etat de selection).

**Files:**
- Create: `src/components/ui/RadioCards.tsx`
- Test: `src/components/ui/__tests__/RadioCards.test.tsx`

**Interfaces:**
- Produces: `RadioCards({ name, options, value, onChange }: { name: string; options: { value: string; title: ReactNode; description?: ReactNode; color?: string }[]; value: string | null; onChange: (v: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { RadioCards } from "../RadioCards";

test("RadioCards selectionne une option au clic", async () => {
  function Harness() {
    const [v, setV] = useState<string | null>(null);
    return (
      <RadioCards
        name="cat"
        value={v}
        onChange={setV}
        options={[
          { value: "expo", title: "Exposant", color: "#16a34a" },
          { value: "press", title: "Presse", color: "#dc2626" },
        ]}
      />
    );
  }
  render(<Harness />);
  const expo = screen.getByRole("radio", { name: /Exposant/ });
  await userEvent.click(expo);
  expect(expo).toHaveAttribute("aria-checked", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/RadioCards.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function RadioCards({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; title: ReactNode; description?: ReactNode; color?: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={sel}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`relative flex items-start gap-3 rounded-xl border-[1.5px] p-4 text-left transition-colors ${
              sel ? "border-green-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {o.color ? <span className="mt-0.5 h-3.5 w-3.5 flex-none rounded" style={{ background: o.color }} /> : null}
            <span>
              <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
              {o.description ? <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{o.description}</span> : null}
            </span>
            {sel ? (
              <span className="absolute right-3 top-3 text-green-600">
                <Icon name="check" size={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/RadioCards.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 12: FileBox + Dropzone

Affichage d'un fichier depose + zone de depot. Reference : `.filebox` (177-180), `.dropzone` (170-176). Reutiliser la logique d'upload existante de `src/components/public/FileUploadField.tsx` (ne pas reinventer l'upload — habiller). Dropzone client.

**Files:**
- Create: `src/components/ui/FileBox.tsx`
- Modify: `src/components/public/FileUploadField.tsx` (extraire le visuel vers `Dropzone`/`FileBox`, garder la logique)
- Test: `src/components/ui/__tests__/FileBox.test.tsx`

**Interfaces:**
- Produces:
  - `FileBox({ icon?, title, subtitle?, thumbUrl?, action? }: { icon?: IconName; title: ReactNode; subtitle?: ReactNode; thumbUrl?: string; action?: ReactNode }): JSX.Element`
  - `Dropzone({ onFiles, title, subtitle, accept? }: { onFiles: (files: FileList) => void; title: ReactNode; subtitle: ReactNode; accept?: string }): JSX.Element` (client)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { FileBox } from "../FileBox";

test("FileBox affiche titre et sous-titre", () => {
  render(<FileBox icon="file" title="cni.pdf" subtitle="240 Ko" />);
  expect(screen.getByText("cni.pdf")).toBeInTheDocument();
  expect(screen.getByText("240 Ko")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/FileBox.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

export function FileBox({
  icon = "file",
  title,
  subtitle,
  thumbUrl,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  thumbUrl?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-500">
        {thumbUrl ? <img src={thumbUrl} alt="" className="h-full w-full object-cover" /> : <Icon name={icon} size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Dropzone({
  onFiles,
  title,
  subtitle,
  accept,
}: {
  onFiles: (files: FileList) => void;
  title: ReactNode;
  subtitle: ReactNode;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-xl border-[1.5px] border-dashed p-7 text-center transition-colors ${
        drag ? "border-green-600 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-green-600 hover:bg-emerald-50"
      }`}
    >
      <span className="mb-2 inline-flex text-slate-400">
        <Icon name="upload-cloud" size={24} />
      </span>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/FileBox.test.tsx`
Expected: PASS.

- [ ] **Step 5: Recabler FileUploadField sur Dropzone/FileBox sans changer sa logique, puis typecheck + tests**

Run: `make typecheck && yarn vitest run src/components/public`
Expected: OK ; les tests existants de `FileUploadField` (s'il y en a) restent verts. Revue visuelle : la dropzone d'inscription publique reprend le visuel maquette.

---

### Task 13: PasswordMeter

Jauge de robustesse de mot de passe. Reference : `.pw-meter`/`.pw-bar` (112-118). Client (derive du champ).

**Files:**
- Create: `src/components/ui/PasswordMeter.tsx`
- Test: `src/components/ui/__tests__/PasswordMeter.test.tsx`

**Interfaces:**
- Produces: `PasswordMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }): JSX.Element` — 4 barres, couleur croissante rose->amber->green.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { PasswordMeter } from "../PasswordMeter";

test("PasswordMeter allume `score` barres", () => {
  render(<PasswordMeter score={3} />);
  const bars = screen.getByTestId("pw-meter").querySelectorAll("[data-on='true']");
  expect(bars).toHaveLength(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/PasswordMeter.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
const FILL = ["bg-rose-600", "bg-rose-600", "bg-amber-700", "bg-green-500", "bg-green-600"];

export function PasswordMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div data-testid="pw-meter" className="my-2.5 flex gap-1.5">
      {[1, 2, 3, 4].map((i) => {
        const on = i <= score;
        return <span key={i} data-on={on} className={`h-1 flex-1 rounded-full ${on ? FILL[score] : "bg-slate-200"}`} />;
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/PasswordMeter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 14: Stepper

Fil d'etapes du wizard. Reference : `.stepper`/`.step` (222-233). Aligner `src/components/admin/EventCreationWizard.tsx` dessus (Task du sous-plan 03 consommera).

**Files:**
- Create: `src/components/ui/Stepper.tsx`
- Test: `src/components/ui/__tests__/Stepper.test.tsx`

**Interfaces:**
- Produces: `Stepper({ steps, current }: { steps: string[]; current: number }): JSX.Element` — `current` 0-indexed ; etapes < current = done, = current = on.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { Stepper } from "../Stepper";

test("Stepper marque l'etape courante", () => {
  render(<Stepper steps={["Informations", "Categories"]} current={1} />);
  expect(screen.getByText("Informations")).toBeInTheDocument();
  expect(screen.getByText("Categories").closest("[data-state]")).toHaveAttribute("data-state", "on");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Stepper.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Fragment } from "react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-7 flex items-center">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "on" : "todo";
        return (
          <Fragment key={label}>
            <div data-state={state} className="flex items-center gap-2.5">
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${
                  state === "on" ? "bg-green-600 text-white" : state === "done" ? "bg-emerald-50 text-green-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm font-medium max-[720px]:hidden ${state === "todo" ? "text-slate-400" : state === "done" ? "text-slate-600" : "text-slate-900"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? <span className="mx-3.5 h-0.5 w-12 bg-slate-200 max-[720px]:mx-2 max-[720px]:w-6" /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Stepper.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 15: Tabs + Segmented

Navigation intra-page (onglets soulignes + controle segmente). Reference : `.tabs`/`.tab` (125-130), `.segmented` (120-123). Sert notamment aux blocklists fusionnees (sous-plan 04). Client.

**Files:**
- Create: `src/components/ui/Tabs.tsx`
- Test: `src/components/ui/__tests__/Tabs.test.tsx`

**Interfaces:**
- Produces:
  - `Tabs({ tabs, value, onChange }: { tabs: { value: string; label: ReactNode }[]; value: string; onChange: (v: string) => void }): JSX.Element` (client)
  - `Segmented({ options, value, onChange }: { options: { value: string; label: ReactNode }[]; value: string; onChange: (v: string) => void }): JSX.Element` (client)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Tabs } from "../Tabs";

test("Tabs change l'onglet actif", async () => {
  function Harness() {
    const [v, setV] = useState("emails");
    return (
      <Tabs value={v} onChange={setV} tabs={[{ value: "emails", label: "E-mails" }, { value: "docs", label: "Documents" }]} />
    );
  }
  render(<Harness />);
  const docs = screen.getByRole("tab", { name: "Documents" });
  await userEvent.click(docs);
  expect(docs).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/Tabs.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import type { ReactNode } from "react";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium ${
              on ? "border-green-600 text-green-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-[9px] bg-slate-100 p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/Tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 16: BadgeCard + MiniBadge (reconciliation V1/V2)

Credential produit (~100x140mm) + vignette pour la grille batch. Reference : `.badge-card` (182-207), `.mini-badge`, `.qr-box` (204-207). **Reconcilier les doublons** `src/components/badge/*V2` : identifier le canonique, aligner `BadgeCard` sur la maquette `apercu-badge.html`, marquer/supprimer le mort (accord utilisateur requis avant suppression).

**Files:**
- Create: `src/components/badge/BadgeCard.tsx` (ou aligner l'existant canonique)
- Create: `src/components/badge/MiniBadge.tsx`
- Test: `src/components/badge/__tests__/BadgeCard.test.tsx`
- Modify: doublons `*V2` — note de reconciliation dans le tracker

**Interfaces:**
- Produces:
  - `BadgeCard({ org, name, role?, category, categoryColor, qr, meta, allAccess? }: { org: ReactNode; name: ReactNode; role?: ReactNode; category: ReactNode; categoryColor: string; qr: ReactNode; meta: ReactNode; allAccess?: boolean }): JSX.Element`
  - `MiniBadge({ name, category, categoryColor, state }: { name: ReactNode; category: ReactNode; categoryColor: string; state: "pending" | "generating" | "done" }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { BadgeCard } from "../BadgeCard";

test("BadgeCard affiche nom, org, categorie et bandeau all-access", () => {
  render(
    <BadgeCard org="Salon Tech" name="Yanis Bernard" category="EXPOSANT" categoryColor="#16a34a" qr={<svg />} meta="ID 4821" allAccess />,
  );
  expect(screen.getByText("Yanis Bernard")).toBeInTheDocument();
  expect(screen.getByText("Salon Tech")).toBeInTheDocument();
  expect(screen.getByText("EXPOSANT")).toBeInTheDocument();
  expect(screen.getByText(/all.?access/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/badge/__tests__/BadgeCard.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

export function BadgeCard({
  org,
  name,
  role,
  category,
  categoryColor,
  qr,
  meta,
  allAccess,
}: {
  org: ReactNode;
  name: ReactNode;
  role?: ReactNode;
  category: ReactNode;
  categoryColor: string;
  qr: ReactNode;
  meta: ReactNode;
  allAccess?: boolean;
}) {
  return (
    <div className="relative flex h-[360px] w-[257px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white font-badge">
      <div className="h-3 bg-brand-navy" />
      <div className="px-5 pt-4.5 text-xs font-semibold tracking-wide text-slate-600">{org}</div>
      <div className="mx-auto my-4 flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400" />
      <div className="px-4 text-center text-[22px] font-bold leading-tight text-slate-900">{name}</div>
      {role ? <div className="mt-1 text-center text-[13px] font-medium text-slate-600">{role}</div> : null}
      <div className="mx-5 mt-3.5 rounded-lg px-3 py-1.5 text-center text-[13px] font-bold uppercase tracking-wider text-white" style={{ background: categoryColor }}>
        {category}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 py-4">
        <div className="h-16 w-16 flex-none">{qr}</div>
        <div className="text-[10px] leading-tight text-slate-400">{meta}</div>
      </div>
      {allAccess ? (
        <div className="absolute right-[-34px] top-[30px] rotate-45 bg-rose-600 px-10 py-1 text-[10px] font-bold tracking-widest text-white">
          ALL ACCESS
        </div>
      ) : null}
    </div>
  );
}
```
_(MiniBadge : vignette compacte reprenant `bc-band` + nom + `cat-dot` + icone d'etat check/spinner — meme palette.)_

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/badge/__tests__/BadgeCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Reconciliation V1/V2 + typecheck**

Noter dans le tracker quel composant `*V2` devient canonique et lesquels sont morts (suppression = accord utilisateur explicite). `make typecheck`.
Expected: OK. Revue visuelle contre `apercu-badge.html`.

---

### Task 17: Scanner (frame/reticle/laser + result)

Habillage plein ecran du scanner QR. Reference : `.scan-frame`/`.scan-reticle`/`.scan-laser`/`.scan-result` (273-295). **Reskin** de `src/components/event/QRScanner.tsx` : ne pas toucher la logique camera/decodage html5-qrcode, envelopper le flux dans le cadre + reticule et rendre le resultat via `ScanResult`.

**Files:**
- Create: `src/components/event/ScannerFrame.tsx` (cadre + reticule + laser + `ScanResult`)
- Modify: `src/components/event/QRScanner.tsx` (composition visuelle uniquement)
- Test: `src/components/event/__tests__/ScannerFrame.test.tsx`

**Interfaces:**
- Produces:
  - `ScannerFrame({ children }: { children: ReactNode }): JSX.Element` — cadre sombre + reticule vert + laser (le flux camera est passe en `children`).
  - `ScanResult({ valid, title, children }: { valid: boolean; title: ReactNode; children?: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { ScanResult } from "../ScannerFrame";

test("ScanResult valide/invalide", () => {
  render(<ScanResult valid title="Acces autorise" />);
  expect(screen.getByText("Acces autorise")).toBeInTheDocument();
  render(<ScanResult valid={false} title="Badge revoque" />);
  expect(screen.getByText("Badge revoque")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/event/__tests__/ScannerFrame.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

export function ScannerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex aspect-[3/4] max-w-[360px] items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
      {children}
      <div className="relative aspect-square w-[62%]">
        <span className="absolute left-0 top-0 h-[30px] w-[30px] rounded-tl-xl border-l-[3px] border-t-[3px] border-green-400" />
        <span className="absolute right-0 top-0 h-[30px] w-[30px] rounded-tr-xl border-r-[3px] border-t-[3px] border-green-400" />
        <span className="absolute bottom-0 left-0 h-[30px] w-[30px] rounded-bl-xl border-b-[3px] border-l-[3px] border-green-400" />
        <span className="absolute bottom-0 right-0 h-[30px] w-[30px] rounded-br-xl border-b-[3px] border-r-[3px] border-green-400" />
      </div>
      <span className="absolute left-[8%] right-[8%] top-1/2 h-0.5 bg-green-400 shadow-[0_0_12px] shadow-green-400" />
    </div>
  );
}

export function ScanResult({ valid, title, children }: { valid: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-6 text-center ${valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <span className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-white ${valid ? "bg-green-600" : "bg-rose-600"}`}>
        <Icon name={valid ? "check" : "x"} size={26} />
      </span>
      <div className={`mb-0.5 mt-3 text-lg font-bold ${valid ? "text-emerald-700" : "text-rose-700"}`}>{title}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/event/__tests__/ScannerFrame.test.tsx`
Expected: PASS.

- [ ] **Step 5: Composer dans QRScanner + typecheck**

Run: `make typecheck && yarn vitest run src/components/event`
Expected: OK. Revue visuelle contre `event-scanner.html` (cadre + reticule + resultat).

---

### Task 18: PickCard + OrgLogo

Selecteur d'organisation (grille de cartes) + logo initiales. Reference : `.pick-card`/`.card-grid`/`.org-logo` (249-256).

**Files:**
- Create: `src/components/ui/PickCard.tsx`
- Test: `src/components/ui/__tests__/PickCard.test.tsx`

**Interfaces:**
- Produces:
  - `OrgLogo({ name, size? }: { name: string; size?: number }): JSX.Element` — initiales sur fond slate, texte marine.
  - `PickCard({ href, logo, title, subtitle?, meta? }: { href: string; logo: ReactNode; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode }): JSX.Element`
  - `PickCardDashed({ href, icon, label }: { href: string; icon: IconName; label: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { OrgLogo, PickCard } from "../PickCard";

test("OrgLogo derive les initiales ; PickCard est un lien", () => {
  render(<OrgLogo name="Universite Forum" />);
  expect(screen.getByText("UF")).toBeInTheDocument();
  render(<PickCard href="/admin/1" logo={<span />} title="Salon Tech" meta="3 evenements" />);
  expect(screen.getByRole("link", { name: /Salon Tech/ })).toHaveAttribute("href", "/admin/1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/PickCard.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function OrgLogo({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[10px] bg-slate-100 font-bold text-brand-navy"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function PickCard({
  href,
  logo,
  title,
  subtitle,
  meta,
}: {
  href: string;
  logo: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Link href={href} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-green-600">
      {logo}
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div> : null}
      </div>
      {meta ? <div className="text-xs text-slate-400">{meta}</div> : null}
    </Link>
  );
}

export function PickCardDashed({ href, icon, label }: { href: string; icon: IconName; label: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-slate-600 transition-colors hover:border-green-600"
    >
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/PickCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 19: PhoneMockup + VerifyBanner

Cadre mobile + bandeau de resultat de verification publique. Reference : `.phone`/`.pscreen` (312-316), `.verify-banner` (348-353).

**Files:**
- Create: `src/components/ui/VerifyBanner.tsx` (banner + `PhoneMockup`)
- Test: `src/components/ui/__tests__/VerifyBanner.test.tsx`

**Interfaces:**
- Produces:
  - `VerifyBanner({ valid, title, children? }: { valid: boolean; title: ReactNode; children?: ReactNode }): JSX.Element`
  - `PhoneMockup({ children }: { children: ReactNode }): JSX.Element` — cadre optionnel (desktop) ; a ne pas rendre en < 640px reel (la page verif est deja mobile).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { VerifyBanner } from "../VerifyBanner";

test("VerifyBanner reflete l'etat", () => {
  render(<VerifyBanner valid title="Badge valide" />);
  expect(screen.getByText("Badge valide")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/VerifyBanner.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function VerifyBanner({ valid, title, children }: { valid: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl px-6 py-7 text-center text-white ${valid ? "bg-green-600" : "bg-rose-600"}`}>
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
        <Icon name={valid ? "shield-check" : "shield-x"} size={26} />
      </span>
      <div className="text-2xl font-bold">{title}</div>
      {children}
    </div>
  );
}

export function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[420px] sm:w-[360px] sm:overflow-hidden sm:rounded-[40px] sm:border-[10px] sm:border-slate-900">
      <div className="bg-slate-50">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/VerifyBanner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 20: Blocs journal — LogType, KeyValue, Diff, Payload

Composants de la vue detail de journal. Reference : `.log-type` (318-326), `.kv` (330-335), `.diff` (337-344), `.payload` (346).

**Files:**
- Create: `src/components/ui/JournalBlocks.tsx`
- Test: `src/components/ui/__tests__/JournalBlocks.test.tsx`

**Interfaces:**
- Produces:
  - `LogType({ kind, children }: { kind: "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces"; children: ReactNode }): JSX.Element`
  - `KeyValue({ items }: { items: { label: ReactNode; value: ReactNode }[] }): JSX.Element`
  - `Diff({ oldValue, newValue }: { oldValue: ReactNode; newValue: ReactNode }): JSX.Element`
  - `Payload({ json }: { json: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { KeyValue, Diff, LogType } from "../JournalBlocks";

test("blocs journal rendent leur contenu", () => {
  render(<LogType kind="modification">Modification</LogType>);
  expect(screen.getByText("Modification")).toBeInTheDocument();
  render(<KeyValue items={[{ label: "Auteur", value: "Marie Dubois" }]} />);
  expect(screen.getByText("Auteur")).toBeInTheDocument();
  expect(screen.getByText("Marie Dubois")).toBeInTheDocument();
  render(<Diff oldValue="Presse" newValue="Presse (anonyme)" />);
  expect(screen.getByText("Presse")).toBeInTheDocument();
  expect(screen.getByText("Presse (anonyme)")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/components/ui/__tests__/JournalBlocks.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

const LOG: Record<string, string> = {
  creation: "bg-emerald-50 text-emerald-700",
  modification: "bg-indigo-500/10 text-indigo-600",
  suppression: "bg-rose-50 text-rose-700",
  systeme: "bg-amber-50 text-amber-700",
  connexion: "bg-slate-100 text-slate-600",
  acces: "bg-brand-navy/10 text-brand-navy",
};

export function LogType({
  kind,
  children,
}: {
  kind: "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces";
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${LOG[kind]}`}>
      {children}
    </span>
  );
}

export function KeyValue({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[160px_1fr]">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="border-b border-slate-100 py-2.5 text-[13px] text-slate-400">{it.label}</dt>
          <dd className="border-b border-slate-100 py-2.5 text-sm text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Diff({ oldValue, newValue }: { oldValue: ReactNode; newValue: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px]">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Avant</div>
        {oldValue}
      </div>
      <span className="justify-self-center text-slate-400">&rarr;</span>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px]">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Apres</div>
        {newValue}
      </div>
    </div>
  );
}

export function Payload({ json }: { json: string }) {
  return <pre className="overflow-x-auto whitespace-pre rounded-[10px] bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200">{json}</pre>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/components/ui/__tests__/JournalBlocks.test.tsx`
Expected: PASS. _(Note : le fond `modification` utilise `indigo-500/10` uniquement comme couleur de categorie de log, pas comme accent d'action — conforme a la contrainte "accent vert unique".)_

- [ ] **Step 5: Typecheck**

Run: `make typecheck`
Expected: OK.

---

### Task 21: Page /styleguide (dev-only) + verification directeur

Vitrine vivante reproduisant `template/styleguide.html`, et verification globale du directeur.

**Files:**
- Create: `src/app/styleguide/page.tsx` (rend un exemple de chaque composant des tasks 1-20)

- [ ] **Step 1: Composer la page styleguide**

Rendre au moins un exemple de chaque composant (Card, StatGrid, Timeline, QuotaBar, MiniChart, Alert, EmptyState, BatchBar, CatPill, RoleBadge, Tag, Switch, Checkbox, RadioCards, Dropzone, PasswordMeter, Stepper, Tabs, Segmented, BadgeCard, ScannerFrame, PickCard, VerifyBanner, LogType, KeyValue, Diff, Payload).

- [ ] **Step 2: Verifier chaque composant visuellement**

Ouvrir `/styleguide` dans le navigateur (via `make dev`, `http://badge.local/styleguide`) et comparer a `template/styleguide.html`. Corriger tout ecart de couleur/rayon/espacement.

- [ ] **Step 3: Suite complete verte**

Run: `make lint && make typecheck && make test`
Expected: lint 0 erreur, typecheck OK, tous les tests verts (nouveaux tests des tasks 1-20 inclus).

- [ ] **Step 4: Mettre a jour le tracker**

Passer les tasks 0-21 a `[x]` avec la date, noter la reconciliation V1/V2 (Task 16) et toute adaptation du registre d'icones (Task 2).

---

## Self-Review (a executer apres redaction des 4 sous-plans)

1. **Couverture** : chaque composant transverse cite par un sous-plan existe dans une task ci-dessus. Si un sous-plan reclame un composant absent, l'ajouter ici.
2. **Coherence de types** : les signatures exportees (Interfaces) sont celles importees par les sous-plans (memes noms de props).
3. **Registre d'icones** : le composant `Icon` partage est cree en **Task 0.5** (v2-15 n'en fournit pas — le registre etait interne a `SidebarNav`). Tous les composants importent `{ Icon, IconName }` depuis `src/components/ui/Icon.tsx`. Toute icone manquante s'ajoute au registre au moment ou un ecran la reclame.
