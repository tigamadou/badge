# Badge v2 — Design System

Badge is a **B2B SaaS for event registration & credential management** — organizations
run events, collect attendee registrations, approve/reject them, and issue printable
**badges** (with an on-site QR scanner). The UI is **French (with accents)**, dense,
flat, and utilitarian — closer to an admin console (think Linear / Vercel dashboard
restraint) than a marketing site.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4.
Server Components by default; `"use client"` only when interactivity is required.

> This design system was generated from a written **design spec** (Tailwind class
> contract) — no codebase, Figma, or production screenshots were attached. Tokens here
> mirror the exact Tailwind classes the spec mandates, so static mocks match the app 1:1.

---

## Sources

| Source | Reference | Access |
|---|---|---|
| Design spec | "Design System Prompt — Badge v2" (pasted by user) | embodied in this repo |
| Logo | `/public/logo.png` in the app → referenced as `/logo.png` | **NOT provided** — see Caveats |

There is **no** linked Figma file or GitHub repo for this system. If one exists, attach it
and I'll re-derive tokens from the real source.

---

## The three shells

The app is split into three navigation **shells**. Always identify which one a screen
belongs to before building.

| Shell | Route | Sidebar identity | Nav sections |
|---|---|---|---|
| **Staff** | `/staff/*` | Logo only | Organisations · Utilisateurs staff · Paramètres plateforme · Journal d'activité |
| **Org** | `/admin/[orgId]/*` | Logo + org name | Dashboard · Événements · Membres · Paramètres org |
| **Event** | `/admin/[orgId]/events/[eventId]/*` | Logo + `← [org]` back-link + event name | Dashboard · Inscriptions · Badges · Catégories · Scanner · Membres · Paramètres (ADMIN) · Journal (ADMIN) |

All three share the same brand-navy sidebar (`bg-[#004D74] w-56`), the same white top header
(`h-14`, breadcrumb + user name), and the same `bg-slate-50` main canvas.

---

## CONTENT FUNDAMENTALS

**Language.** French, always with proper accents (é, è, à, ç, ê…). Never anglicise UI
strings. "Créer un événement", "Inscriptions", "Journal d'activité", "Enregistrer".

**Voice.** Neutral, functional, administrative. No marketing fluff, no exclamation
points, no emoji. Labels are nouns ("Membres", "Catégories"); actions are imperative
verbs ("Créer", "Enregistrer", "Approuver", "Supprimer").

**Casing.** Sentence case for everything — page titles, buttons, labels. The **only**
upper-casing is table header cells and stat-card labels (`uppercase tracking-wider`,
small `text-xs`) and machine status enums (`PENDING`, `APPROVED`, `REJECTED`).

**Person.** Impersonal / system voice. Empty states and confirmations address the task,
not "you" or "I" — e.g. "Aucune inscription pour le moment", "Cette action est
irréversible." Avoid first person entirely.

**Status vocabulary.** Registrations move through `PENDING` (Amber, "En attente"),
`APPROVED` (Emerald, "Approuvée"), `REJECTED` (Rose, "Rejetée"). Show the colored
`StatusBadge`; the enum is the source of truth.

**Microcopy examples.**
- Page title: `Inscriptions`
- Primary CTA: `Créer un événement`
- Empty state title: `Aucun événement` · subtitle: `Créez votre premier événement pour commencer.`
- Destructive confirm: `Supprimer l'organisation ?` body `Cette action est irréversible et supprimera tous les événements associés.`
- Inline success: `Modifications enregistrées.`

**Density.** Information-dense but breathable: `text-sm` is the workhorse body size,
`text-xs` for metadata. Generous card padding (`p-6`), tight type.

---

## VISUAL FOUNDATIONS

**Overall vibe.** Flat, cool-toned, professional admin UI. Slate neutrals + a single
brand-green accent + a tight semantic palette. Restraint is the aesthetic: no gradients, no
decorative imagery, no shadows except modals.

**Color.** Built on Tailwind's **slate** ramp for neutrals (50→900), the **brand green**
(`green-600` — derived from the logo shield, `rgb(54, 171, 88)`) as the one interactive
accent, and four semantic pairs (emerald/amber/rose/blue) used only for states. The
sidebar is **brand navy `#004D74`** — the single high-contrast surface. The brand green and
navy come straight from the logo and now drive the UI chrome (accent + sidebar).

**Typography.** No custom webfont. Tailwind's default **system sans stack**
(`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto…`). Weights are limited to
400 / 500 / 600 — never bold/700 in UI chrome. Scale tops out at `text-2xl` (stat values)
and `text-xl` (page titles); most text is `text-sm`.

**Spacing.** Tailwind's 4px base. Cards `p-6`, stat cards `p-5`, table cells `px-4 py-3`,
buttons `px-4 py-2`, inputs `px-3 py-2`. Dashboard grids `gap-4` (stats) / `gap-6` (panels).

**Backgrounds.** Solid fills only — `slate-50` app canvas, white surfaces, brand-navy
`#004D74` sidebar. **No** images, gradients, textures, or patterns anywhere.

**Borders.** Hairline `1px`. `slate-200` around cards/tables, `slate-300` around inputs,
`slate-100` for table row dividers (`divide-y divide-slate-100`).

**Corner radii.** `rounded-lg` (8px) for buttons & inputs, `rounded-xl` (12px) for cards
& tables, `rounded-2xl` (16px) for modals, `rounded-full` for status badges.

**Shadows / elevation.** Deliberately **flat** — `shadow-*` is banned on plain elements.
The single exception is modals (`shadow-xl`). Depth comes from borders and the
dark-sidebar / light-canvas contrast, not shadow.

**Cards.** White, `rounded-xl`, `1px slate-200` border, `p-6`, **no shadow**. Header
variant adds a `px-6 py-4 border-b` strip above a `p-6` body.

**Hover states.** Buttons darken one step (`green-600 → green-700`,
`slate-100 → slate-200`, `rose-600 → rose-700`). Table rows get a subtle `hover:bg-slate-50`
fill; sidebar nav items get a translucent-white fill on the navy. No scale,
no shadow on hover.

**Active / press.** Active nav item: green text + `green-500/15` fill + a
`border-l-2 border-green-400` rail. Inputs on focus: `ring-2 ring-green-500` with
`border-transparent`. No shrink/scale press animation.

**Transparency & blur.** Used in exactly two places: the active-nav fill
(`green-500/15`) and the modal overlay (`bg-black/40 backdrop-blur-sm`). Otherwise
surfaces are fully opaque.

**Animation.** Minimal. Color transitions on hover/focus; no bounces, parallax, or
elaborate motion. This is a tool, not a showcase.

**Imagery.** None by default. The only graphic asset is the logo. Avatars (if any) are
initials in a slate circle, not photos.

---

## ICONOGRAPHY

The spec doesn't bundle an icon set, but the Next.js + Tailwind stack and the visual
language (thin 1.5px strokes, no fills) point squarely at **Lucide** — the de-facto icon
library for this stack. This system therefore standardises on **Lucide** (via CDN for
mocks: `lucide@latest`), `1.5` stroke, `currentColor`, sized `16`/`20`/`24`.

- **No emoji.** Ever. The UI is professional/administrative.
- **No unicode glyph icons**, except the single `←` back-arrow in the Event shell sidebar
  and `/` breadcrumb separators (these are typographic, not icons).
- Empty-state icons are large (`w-12 h-12`), `slate-300`, stroke style.
- Status is communicated by colored `StatusBadge` text, **not** icons.

If the production app uses a different set (e.g. Heroicons, a custom sprite), swap the CDN
link and re-document here. **Flagged substitution:** Lucide is an inferred default, not a
confirmed choice.

---

## VISUAL CAVEATS & FLAGGED SUBSTITUTIONS

1. **Logo is a stand-in.** `assets/logo.svg` (+ `logo-light.svg` for the dark sidebar) is
   an SVG **recreation** from the written description (green `#4CAF50` shield with white
   "B", navy `#1a3a5c` "adge" wordmark). Drop the real `logo.png` into `assets/` and
   point references at it.
2. **Icon set inferred** (Lucide) — see Iconography.
3. **No font files** — system stack by design, nothing to source.

---

## INDEX — what's in this repo

| Path | What |
|---|---|
| `README.md` | This file — context, content & visual foundations, iconography |
| `colors_and_type.css` | All design tokens (base palette + semantic vars + type roles) |
| `SKILL.md` | Agent-Skill manifest for reuse in Claude Code |
| `assets/logo.svg` · `logo-light.svg` | Brand logo stand-ins (replace with real `logo.png`) |
| `preview/` | Design-system preview cards (colors, type, spacing, components) |
| `ui_kits/badge-app/` | High-fidelity UI kit: the three shells + reusable components + interactive `index.html` |

No slides were provided, so `slides/` is intentionally absent.
