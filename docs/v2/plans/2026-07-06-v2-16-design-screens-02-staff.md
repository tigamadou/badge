# Port des maquettes v2-16 — Espace Staff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Porter le **contenu** des 10 pages de l'espace Staff a la fidelite des maquettes `template/screens/staff-*.html`, plus creer la **vue detail d'entree de journal** (`journal-detail.html`) cote staff — 1re implementation d'une vue partagee (org/event la reutiliseront). C'est un **reskin** : on remplace le rendu JSX en composant avec la bibliotheque du plan directeur, sans toucher au data-fetching, aux server actions ni au RBAC.

**Architecture:** Chaque `page.tsx` (Server Component) conserve exactement ses requetes Prisma, ses `searchParams`, ses gardes de session et ses composants clients d'action (`OrgDetailActions`, `UserDetailActions`, `OrgCreationForm`, `UserCreationForm`, `PlatformSettingsForm`, `TestSmtpForm`). Seul le balisage de presentation est reconstruit en important les composants transverses (`Card`, `StatGrid`, `Toolbar`, `Timeline`, `QuotaBar`, `RoleBadge`, `FormSection`, `Tabs`, `LogType`, `KeyValue`, `Diff`, `Payload`, etc.). La vue journal-detail est une **nouvelle route** `src/app/staff/activity/[logId]/page.tsx` cablee sur `prisma.activityLog.findUnique`, sans nouvelle logique metier (lecture seule d'une entree existante).

**Tech Stack:** Next.js 16 (App Router, RSC par defaut), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `lucide-react` via le composant `Icon`, Vitest 4 + `@testing-library/react`. Verification : `make typecheck`, `make lint`, `make test` (conteneur Docker dev) + controle visuel navigateur (`http://badge.local`).

**Reference visuelle autoritaire :** `template/screens/staff-*.html` + `template/screens/journal-detail.html` + `template/assets/badge.css`.

**Spec :** [`../specs/2026-07-06-v2-16-design-screens-port.md`](../specs/2026-07-06-v2-16-design-screens-port.md)
**Plan directeur (API des composants) :** [`2026-07-06-v2-16-design-screens-00-directeur.md`](2026-07-06-v2-16-design-screens-00-directeur.md)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre. Apres chaque task validee (typecheck + tests verts + revue visuelle 3 viewports OK), passer `[ ]` a `[x]` et dater. Mi-task -> `[~]` + note d'etat (step en cours, fichiers touches, prochaine etape). Abandon -> `[-]` + raison dans la spec.

Legende : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 1  | [x] | 2026-07-06 | `/staff` reskine (StatGrid + Card top-orgs + Timeline). Icone `archive` ajoutee. Promise.all/topOrgs preserves. typecheck+lint OK. |
| 2  | [x] | 2026-07-06 | `/staff/organizations` + `OrganizationsTable` reskines (toolbar GET habillee, table rounded-xl, OrgLogo, Tag archivee). where/select/take preserves. typecheck+lint OK. |
| 3  | [x] | 2026-07-06 | `OrgCreationForm` reskine (Card + FormSection Organisation/OWNER + Input/Alert/Spinner). Sections Adresse/Contact non ajoutees (pas de champs API - hors-scope). submit/payload preserves. typecheck+lint OK. |
| 4  | [x] | 2026-07-06 | `/staff/organizations/[orgId]` + `OrgDetailActions` reskines (StatGrid/QuotaBar/KeyValue/Card + zone danger rose + Modal de confirmation slug). canDelete/RBAC + API archive/restore/delete preserves. typecheck+lint OK. |
| 5  | [x] | 2026-07-06 | `/staff/users` reskine (toolbar GET habillee, table rounded-xl, avatars initiales, RoleBadge navy/slate, Tag archive). where/select/take preserves. typecheck+lint OK. |
| 6  | [x] | 2026-07-06 | `UserCreationForm` reskine (Card + FormSection + RadioCards type + selects habilles + Alert/Spinner). Gardes canCreateStaff/canCreateTopStaff + submit preserves. typecheck+lint OK. |
| 7  | [x] | 2026-07-06 | `/staff/users/[userId]` + `UserDetailActions` reskines (Card/RoleBadge/KeyValue/Timeline + boutons Button/Alert). Gardes RBAC + mutations preservees. typecheck+lint OK. |
| 8  | [x] | 2026-07-06 | `/staff/settings` + PlatformSettingsForm + TestSmtpForm reskines (Card/FormSection/Input/Switch/Alert). Secrets jamais rendus (*Set booleens), garde canEditSecrets preservee. Branding non ajoute (pas de champs). typecheck+lint OK. |
| 9  | [x] | 2026-07-06 | `BadgeTemplatePicker` reskine (galerie rounded-xl, ring vert, Tag/Alert/Button). data-testid/data-selected E2E preserves, cascade/PATCH intacts. typecheck+lint OK. |
| 10 | [x] | 2026-07-06 | `/staff/activity` reskine (toolbar GET habillee, table LogType, lignes cliquables -> detail, pager GET). helper logKind. where/pagination preserves. typecheck+lint OK. |
| 11 | [x] | 2026-07-06 | Nouvelle route `/staff/activity/[logId]` + composant partage `JournalEntryDetail` + `activity-labels.ts` (logKind/describe/extractDiff) + `JournalEntryActions` (copy/export). Lookups org/event separes (pas de relation). Lecture seule, aucun changement schema. typecheck+lint+test OK. |

---

## Global Constraints

_(Reprises du plan directeur `## Global Constraints` — s'appliquent implicitement a chaque task.)_

- **Langue UI** : francais **avec accents** (é, è, à, ç, ê). Voix neutre/administrative, pas d'emoji. Casse phrase ; majuscules seulement pour en-tetes de table, labels de stat (`uppercase tracking-wider text-xs`) et enums machine (`SUPER_ADMIN`, `PENDING`).
- **Accent unique** : `green-600` hover `green-700`. Etats : succes emerald, attente/staff amber, danger rose, info blue — jamais comme accent.
- **Plat par mandat** : aucune `shadow-*` sauf modales (`shadow-xl`) et segmented control (`shadow-sm`). Profondeur = bordures + contraste.
- **Rayons/bordures** : `rounded-lg` inputs/boutons, `rounded-xl` cartes/tables, `rounded-2xl` modales, `rounded-full` badges de statut ; bordures `slate-200` cartes/tables, `slate-300` inputs, `slate-100` separateurs de lignes.
- **Poids** : 400/500/600 dans le chrome ; 700 reserve au rendu badge (Montserrat, `font-badge`).
- **Nombres tabulaires** : stats, quotas, compteurs, IDs en `tabular-nums`.
- **Accessibilite AA** : `focus-visible` ring vert (herite du global v2-15) ; statut jamais code par la couleur seule (toujours un libelle).
- **PRESERVER integralement** : requetes Prisma, `searchParams`, gardes `getServerSession`/`loadUserContext`/`staffRoleAtLeast`, props des composants clients d'action, server actions/routes API, RBAC (ex. `canDelete = staffRole === "SUPER_ADMIN"`, secrets jamais exposes cote client). **Aucune** nouvelle route sauf Task 11 (lecture seule). **Aucun** nouveau champ/mutation.
- **Verification** : `make typecheck && make lint && make test` + controle visuel. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur.

**Prerequis directeur** : ce sous-plan **suppose implementes** les composants transverses (Tasks 0.5-21 du directeur). Chaque task ci-dessous importe depuis `src/components/ui/*` et `src/components/badge/*` sans les recreer. Si un composant reclame est absent/incomplet, **STOP** et completer d'abord la task correspondante du directeur (ne pas dupliquer de balisage).

---

## Dependance

Ce sous-plan **depend du plan directeur** : il doit etre implemente **apres** les tasks 0.5-21 du directeur (bibliotheque de composants d'ecran + `Icon` + blocs journal). Ordre global de la spec : Directeur -> Public/Auth (01) -> **Staff (02, ce plan)** -> Org (03) -> Event (04).

Icones lucide reclamees par cet espace (verifier leur presence dans le registre `Icon.tsx`, sinon les ajouter au registre au moment ou la task les demande) : `building-2`, `calendar`, `user-check`, `hard-drive`, `trending-up`, `plus`, `search`, `filter`, `chevron-down`, `chevron-right`, `chevron-left`, `external-link`, `trash-2`, `archive`, `archive-restore`, `check`, `check-circle`, `refresh-cw`, `sliders`, `send`, `eye`, `shield`, `download`, `copy`, `arrow-left`, `arrow-right`, `info`, `mail`, `image`, `user`, `tags`, `scroll-text`.

---

### Task 1: staff-dashboard -> `/staff`

Vue d'ensemble plateforme : 4 statcards, carte « Top 5 organisations » (logo + QuotaBar + valeur), carte « Activite recente » en timeline.

**Files:**
- Modify: `src/app/staff/page.tsx`

**Reference maquette:** `template/screens/staff-dashboard.html`

**Composants:** `StatGrid`/`StatCard`, `Card`/`CardHead`/`CardBody`, `QuotaBar`, `Timeline`/`TimelineItem`, `Icon`, `OrgLogo` (de `PickCard.tsx`).

**Steps**

- [x] **Step 1: Lire la page et cartographier la logique a preserver**

Relire `src/app/staff/page.tsx`. **Preserver** integralement le bloc `Promise.all` (`orgsActive`, `orgsArchived`, `eventsActive`, `registrationsTotal`, `topOrgsRaw`, `recentActivity`), la reconstruction `orgCounts`/`topOrgs`, la requete `events` conditionnelle. On ne remplace que le `return (...)` et on supprime les helpers locaux `Kpi` (remplaces par `StatCard`).

- [x] **Step 2: Reconstruire le JSX avec les composants transverses**

Les 4 KPI existants sont conserves (donnees reelles), habilles en `StatCard` avec icone par NOM string. Pour le Top 5, la largeur de `QuotaBar` est relative au max de la liste (`topOrgs[0].count`). La timeline mappe `a.type`/`a.staffActor` sur un `tone` :

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { QuotaBar } from "@/components/ui/QuotaBar";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { OrgLogo } from "@/components/ui/PickCard";

// ... requetes Prisma inchangees ...

const maxTop = topOrgs[0]?.count ?? 1;

return (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Tableau de bord</h1>
      <p className="mt-0.5 text-sm text-slate-400">Vue d'ensemble de la plateforme</p>
    </div>

    <StatGrid cols={4}>
      <StatCard label="Organisations" value={orgsActive} icon="building-2" sub={`${orgsArchived} archivée(s)`} />
      <StatCard label="Événements actifs" value={eventsActive} icon="calendar" />
      <StatCard label="Inscriptions" value={registrationsTotal.toLocaleString("fr-FR")} icon="user-check" />
      <StatCard label="Organisations archivées" value={orgsArchived} icon="archive" />
    </StatGrid>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHead title="Top 5 organisations" subtitle="Par inscriptions ce mois-ci"
          action={<Link href="/staff/organizations" className="text-[13px] font-medium text-green-600 hover:text-green-700">Tout voir</Link>} />
        <CardBody className="space-y-1">
          {topOrgs.length === 0 && <p className="py-4 text-sm text-slate-400">Aucune inscription ce mois-ci.</p>}
          {topOrgs.map((o) => (
            <Link key={o.orgId} href={`/staff/organizations/${o.orgId}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-slate-50">
              <OrgLogo name={o.name} size={32} />
              <span className="flex-1 truncate text-sm font-medium text-slate-900">{o.name}</span>
              <span className="w-[120px]"><QuotaBar label="" valueText="" pct={Math.round((o.count / maxTop) * 100)} /></span>
              <span className="w-14 text-right text-sm tabular-nums text-slate-600">{o.count.toLocaleString("fr-FR")}</span>
            </Link>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Activité récente"
          action={<Link href="/staff/activity" className="text-[13px] font-medium text-green-600 hover:text-green-700">Tout voir</Link>} />
        <CardBody>
          <Timeline>
            {recentActivity.map((a) => (
              <TimelineItem key={a.id}
                tone={a.staffActor ? "warn" : a.type.startsWith("ORG_CREATED") || a.type.endsWith("_CREATED") ? "ok" : "default"}
                title={a.type}
                meta={new Date(a.createdAt).toLocaleString("fr-FR")} />
            ))}
          </Timeline>
        </CardBody>
      </Card>
    </div>
  </div>
);
```

_(Note : `QuotaBar` avec `label`/`valueText` vides sert ici de simple jauge inline ; si le rendu du wrapper `my-3.5` gene l'alignement, envelopper dans un `span` de hauteur controlee. La liste reste 1:1 avec la maquette `list-row` + `qbar`.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK (les helpers `Kpi` supprimes ne sont plus references).

- [x] **Step 4: Controle visuel + tests**

Ouvrir `http://badge.local/staff` en 375 / 768 / 1440 px. Verifier : 4 statcards (grille 2 cols mobile, 4 cols desktop), Top 5 avec logos + jauges vertes + valeurs tabulaires, timeline avec dots colores. `make test` vert.

**Acceptance:** Rendu fidele a `staff-dashboard.html` (statcards, top orgs, timeline) ; toutes les requetes/donnees d'origine intactes ; aucune regression de navigation.

---

### Task 2: staff-orgs -> `/staff/organizations`

Liste des organisations : toolbar (recherche + case archivees + compteur), table (logo + nom + slug mono + OWNERs + events + inscriptions + actions), pagination, badge « Archivée ».

**Files:**
- Modify: `src/app/staff/organizations/page.tsx`
- Modify: `src/components/staff/OrganizationsTable.tsx`

**Reference maquette:** `template/screens/staff-orgs.html`

**Composants:** `Toolbar`/`SearchInput`, `Checkbox`, `Table` (primitive), `Pagination` (primitive), `OrgLogo`, `Tag`, `Icon`, `Button`.

**Steps**

- [x] **Step 1: Lire et preserver la logique**

Relire `page.tsx` (filtres `q`/`archived` via `searchParams`, `where` Prisma, `select` avec `_count`) et `OrganizationsTable.tsx`. **Preserver** le `where`, le `select`, le `take: 100`. La toolbar reste un `<form method="get">` (pas de state client necessaire : conserver le pattern GET pour ne pas introduire de logique). On peut donc garder `SearchInput` **non controle** ou styliser directement l'`<input>` de recherche — privilegier le balisage `Toolbar` habille tout en gardant le formulaire GET (les composants clients `SearchInput`/`Checkbox` ne sont pas indispensables si le form GET suffit ; utiliser un input stylise identique a la maquette).

- [x] **Step 2: Reconstruire le JSX (page + table)**

`page.tsx` — head + toolbar en form GET habille maquette :

```tsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Organisations</h1>
      <p className="mt-0.5 text-sm text-slate-400">Gérer les organisations de la plateforme</p>
    </div>
    <Link href="/staff/organizations/new" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700">
      <Icon name="plus" size={16} /> Créer une organisation
    </Link>
  </div>

  <form method="get" className="flex flex-wrap items-center gap-2.5">
    <div className="relative min-w-[200px] flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" size={16} /></span>
      <input name="q" defaultValue={q ?? ""} placeholder="Rechercher une organisation…"
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" />
    </div>
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-600">
      <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} className="accent-green-600" />
      Afficher les archivées
    </label>
    <button type="submit" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Filtrer</button>
  </form>

  <OrganizationsTable organizations={organizations} />
</div>
```

`OrganizationsTable.tsx` — reconstruire avec `Table`/`OrgLogo`/`Tag`, la ligne archivee en `opacity-60`, actions par icone (lien detail + trash) :

```tsx
<tbody>
  {organizations.map((o) => (
    <tr key={o.id} className={`border-b border-slate-100 hover:bg-slate-50 ${o.archived ? "opacity-60" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <OrgLogo name={o.name} size={30} />
          <Link href={`/staff/organizations/${o.id}`} className="text-sm font-medium text-slate-900 hover:text-green-600">{o.name}</Link>
          {o.archived && <Tag icon="archive">Archivée</Tag>}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-[13px] text-slate-400">{o.slug}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{o._count.memberships}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{o._count.events}</td>
      <td className="px-4 py-3 text-right">
        <Link href={`/staff/organizations/${o.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="chevron-right" size={16} /></Link>
      </td>
    </tr>
  ))}
</tbody>
```

_(La maquette montre 5 colonnes + actions ; adapter aux colonnes reellement disponibles dans le `select` — ne pas inventer de donnee « inscriptions » si le `_count` ne l'expose pas. Si l'inscription totale par org n'est pas requetee, omettre cette colonne plutot que d'ajouter une requete.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/organizations` en 375/768/1440. Verifier : toolbar responsive, table `rounded-xl` en-tete slate-50, logos, slug mono, ligne archivee attenuee + `Tag`. La pagination n'apparait que si l'app pagine reellement (le `take:100` actuel ne pagine pas — ne pas ajouter de faux pager ; si besoin, laisser tel quel). `make test` vert.

**Acceptance:** Toolbar + table fideles a `staff-orgs.html` ; filtres GET `q`/`archived` fonctionnels ; badge archivee present ; aucune requete ajoutee.

---

### Task 3: staff-org-create -> `/staff/organizations/new`

Formulaire de creation en sections (Identite, Adresse, Administratif, Contact, Quotas).

**Files:**
- Modify: `src/app/staff/organizations/new/page.tsx`
- Modify: `src/components/staff/OrgCreationForm.tsx`

**Reference maquette:** `template/screens/staff-org-create.html`

**Composants:** `FormSection`, `Card`/`CardBody`, `Input`/`Select` (primitives), `Dropzone` (logo, si l'upload existe deja — sinon ne pas cabler d'upload nouveau), `Button`, `Icon`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire `OrgCreationForm.tsx` (client). **Preserver** `FormState`, `INITIAL_FORM`, `useState`, `useRouter`, le handler de submit (POST vers l'API existante) et l'ensemble des champs deja pilotes (`name`, `slug`, quotas, `ownerEmail`, `ownerName`). Le port habille les champs existants ; **ne pas** ajouter de champs qui n'ont pas de cible API (ex. SIRET/TVA de la maquette) sauf s'ils existent deja dans le state — sinon les omettre. La `page.tsx` recoit juste le lien retour + titre.

- [x] **Step 2: Reconstruire le JSX**

`page.tsx` :

```tsx
<div className="space-y-4">
  <Link href="/staff/organizations" className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
    <Icon name="arrow-left" size={13} /> Organisations
  </Link>
  <div>
    <h1 className="text-xl font-semibold text-slate-900">Créer une organisation</h1>
    <p className="mt-0.5 text-sm text-slate-400">Renseignez les informations de la nouvelle organisation</p>
  </div>
  <OrgCreationForm />
</div>
```

`OrgCreationForm.tsx` — envelopper les champs existants dans `Card` + `FormSection` (garder handlers/state) ; barre d'action `Annuler` / `Créer l'organisation` :

```tsx
<form onSubmit={handleSubmit} className="max-w-[760px] space-y-5">
  <Card>
    <CardBody className="py-2">
      <FormSection title="Identité">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nom de l'organisation" required value={form.name} onChange={...} />
          <Input label="Slug" required value={form.slug} onChange={...} className="font-mono" />
        </div>
      </FormSection>
      <FormSection title="Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="E-mail du propriétaire" type="email" value={form.ownerEmail} onChange={...} />
          <Input label="Nom du propriétaire" value={form.ownerName} onChange={...} />
        </div>
      </FormSection>
      <FormSection title="Quotas" description="Limites allouées à l'organisation.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Stockage (Mo)" value={form.quotaMaxStorageMB} onChange={...} />
          <Input label="Événements max." value={form.quotaMaxEvents} onChange={...} />
          <Input label="Inscriptions max." value={form.quotaMaxRegistrations} onChange={...} />
        </div>
      </FormSection>
    </CardBody>
  </Card>
  <div className="flex max-w-[760px] items-center justify-between">
    <Button type="button" variant="secondary" onClick={() => router.push("/staff/organizations")}>Annuler</Button>
    <Button type="submit"><Icon name="check" size={16} /> Créer l'organisation</Button>
  </div>
</form>
```

_(Adapter les sections a l'ensemble reel de champs : la maquette liste Adresse/Administratif ; ne les inclure que si le `FormState`/l'API les gerent. Sinon, garder les sections effectivement branchees pour eviter toute demi-implementation.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/organizations/new` en 375/768/1440. Verifier : sections separees par `border-slate-100`, grilles responsives (1 col mobile), barre d'action collee a droite pour le CTA vert. Soumettre le formulaire golden path : la creation fonctionne comme avant. `make test` vert.

**Acceptance:** Sections fideles a `staff-org-create.html` ; state/handlers/POST inchanges ; aucun champ orphelin (sans cible API).

---

### Task 4: staff-org-detail -> `/staff/organizations/[orgId]`

Detail organisation : en-tete (logo + nom + slug mono), CTA « Entrer dans l'organisation », stats, quotas en `QuotaBar`, informations administratives, OWNERs, derniers evenements, actions (archiver / supprimer via `OrgDetailActions` + Modal de confirmation).

**Files:**
- Modify: `src/app/staff/organizations/[orgId]/page.tsx`
- Modify: `src/app/staff/organizations/[orgId]/OrgDetailActions.tsx` (habillage de la zone de danger + `Modal`, si non deja conforme)

**Reference maquette:** `template/screens/staff-org-detail.html`

**Composants:** `Card`/`CardHead`/`CardBody`, `StatGrid`/`StatCard`, `QuotaBar`, `RoleBadge`, `Table`, `KeyValue` (infos administratives), `OrgLogo`, `Button`, `Modal` (primitive), `Icon`, `Tag`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire la `page.tsx` : **preserver** la garde session (`getServerSession` + `loadUserContext`), `canDelete = ctx?.staffRole === "SUPER_ADMIN"`, la requete `findUnique` complete (adresses, taxId, quotas, memberships OWNER, events, `_count`), `notFound()`, et le composant client `OrgDetailActions` avec ses props `{ org, canDelete }`. Les helpers locaux `Card`/`Row`/`fmtQuota`/`formatAddress` sont remplaces (Card -> composant transverse ; Row -> `KeyValue`). **Conserver** `formatAddress` (pure) pour composer une valeur `KeyValue`.

- [x] **Step 2: Reconstruire le JSX**

En-tete + stats + quotas ; la maquette utilise des onglets, mais la page reelle affiche tout en sections empilees — on peut soit garder l'empilement habille, soit introduire `Tabs` (client) autour de blocs statiques. **Recommandation** : garder l'empilement (pas d'etat a introduire) et habiller chaque bloc en `Card`, fidele au contenu de la maquette panneau par panneau. Quotas via `QuotaBar` (pct = used/max) :

```tsx
<div className="space-y-6">
  <Link href="/staff/organizations" className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"><Icon name="arrow-left" size={13} /> Organisations</Link>

  <div className="flex items-start justify-between gap-4">
    <div className="flex items-center gap-4">
      <OrgLogo name={org.name} size={48} />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
        <p className="mt-0.5 font-mono text-[13px] text-slate-400">{org.slug} · {org._count.events} événement(s)</p>
        {org.archived && <Tag icon="archive">Archivée le {org.archivedAt && new Date(org.archivedAt).toLocaleDateString("fr-FR")}</Tag>}
      </div>
    </div>
    <Link href={`/admin/${org.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700">
      <Icon name="external-link" size={16} /> Entrer dans l'organisation
    </Link>
  </div>

  <StatGrid cols={3}>
    <StatCard label="Événements" value={org._count.events} icon="calendar" />
    <StatCard label="OWNERs" value={org._count.memberships} icon="users" />
    <StatCard label="Stockage max" value={org.quotaMaxStorageMB ? `${org.quotaMaxStorageMB} Mo` : "Illimité"} icon="hard-drive" />
  </StatGrid>

  <Card>
    <CardHead title="Quotas" />
    <CardBody>
      {org.quotaMaxStorageMB != null && <QuotaBar label="Stockage" valueText={`${org.quotaMaxStorageMB} Mo`} pct={0} />}
      <QuotaBar label="Événements" valueText={`${org._count.events} / ${org.quotaMaxEvents ?? "∞"}`} pct={org.quotaMaxEvents ? Math.round((org._count.events / org.quotaMaxEvents) * 100) : 0} />
    </CardBody>
  </Card>

  <Card>
    <CardHead title="Informations administratives" />
    <CardBody>
      <KeyValue items={[
        { label: "Raison sociale", value: org.legalName ?? "—" },
        { label: "Adresse", value: formatAddress(org) ?? "—" },
        { label: "Identifiant fiscal", value: org.taxId ?? "—" },
        { label: "Contact e-mail", value: org.contactEmail ?? "—" },
        { label: "Contact téléphone", value: org.contactPhone ?? "—" },
      ]} />
    </CardBody>
  </Card>

  {/* OWNERs + derniers evenements : Table ou Card+list, memes donnees org.memberships / org.events */}

  <OrgDetailActions org={{ id: org.id, slug: org.slug, archived: org.archived }} canDelete={canDelete} />
</div>
```

- [x] **Step 3: Habiller `OrgDetailActions` (zone de danger + Modal)**

Relire `OrgDetailActions.tsx`. **Preserver** les appels API (archive/restore/delete) et la garde `canDelete`. Habiller la zone de danger en `Card` bordure `rose-200`, titre `rose-700`, champ de confirmation de slug + `Button variant="danger"`. La confirmation de suppression definitive passe par la primitive `Modal` (overlay flou + `shadow-xl`). `make typecheck`.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/organizations/[orgId]` en 375/768/1440 avec un org du seed. Verifier : en-tete logo/CTA, statcards, `QuotaBar` avec seuils de couleur, `KeyValue` a 2 colonnes, zone de danger rose, `Modal` de suppression (SUPER_ADMIN uniquement — verifier que le bouton reste absent pour un role inferieur). `make test` vert.

**Acceptance:** Fidele a `staff-org-detail.html` ; `canDelete`/RBAC preserve ; archive/restore/delete fonctionnels ; Modal conforme DS.

---

### Task 5: staff-users -> `/staff/users`

Liste des utilisateurs : toolbar (recherche + segmented Tous/Staff/Clients + archivees), table (avatar + nom + email + RoleBadge + orgs + statut), badge archive.

**Files:**
- Modify: `src/app/staff/users/page.tsx`

**Reference maquette:** `template/screens/staff-users.html`

**Composants:** `Toolbar` (form GET habille), `RoleBadge`, `Table`, `Tag`, `Icon`. _(La maquette montre un `Segmented` ; comme le filtre `type` passe par un `<select>` GET, garder le select habille ou introduire un `Segmented` client relie a la navigation — privilegier le select GET pour ne pas ajouter de logique.)_

**Steps**

- [x] **Step 1: Lire et preserver**

Relire `page.tsx`. **Preserver** `searchParams` (`q`/`type`/`archived`), le `where` Prisma (`isStaff`, `OR` email/name), le `select` avec `_count.orgMemberships`, `take: 100`. On remplace uniquement le balisage.

- [x] **Step 2: Reconstruire le JSX**

Head + toolbar GET, table habillee. `RoleBadge` avec tone selon staff/role :

```tsx
<tbody>
  {users.map((u) => (
    <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 ${u.archived ? "opacity-60" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initials(u.name)}</span>
          <Link href={`/staff/users/${u.id}`} className="text-sm font-medium text-slate-900 hover:text-green-600">{u.name}</Link>
          {u.archived && <Tag icon="archive">Archivé</Tag>}
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-500">{u.email}</td>
      <td className="px-4 py-3">
        {u.isStaff ? <RoleBadge tone="navy">{u.staffRole}</RoleBadge> : <RoleBadge tone="slate">Client</RoleBadge>}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{u._count.orgMemberships}</td>
      <td className="px-4 py-3 text-right"><Link href={`/staff/users/${u.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><Icon name="chevron-right" size={16} /></Link></td>
    </tr>
  ))}
</tbody>
```

_(Definir `initials()` localement ou reutiliser un helper existant ; ne pas rendre le statut par la couleur seule — garder le libelle `Client`/le `Tag` Archivé.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/users` en 375/768/1440. Verifier : toolbar, avatars initiales, `RoleBadge` navy pour staff, ligne archivee attenuee. `make test` vert.

**Acceptance:** Fidele a `staff-users.html` ; filtres GET preserves ; RoleBadge/statut lisibles ; aucune requete ajoutee.

---

### Task 6: staff-user-create -> `/staff/users/new`

Creation d'utilisateur : Compte (email + nom), Type de compte (RadioCards Staff/Client), Role staff (`RoleBadge`/select conditionnel), lier a une organisation (optionnel), CTA « Créer et inviter ».

**Files:**
- Modify: `src/app/staff/users/new/page.tsx`
- Modify: `src/components/staff/UserCreationForm.tsx`

**Reference maquette:** `template/screens/staff-user-create.html`

**Composants:** `Card`/`CardBody`, `FormSection`, `RadioCards` (type de compte), `Input`/`Select`, `RoleBadge`, `Button`, `Icon`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire `page.tsx` (gardes `canCreateStaff`/`canCreateTopStaff`, requete `orgs`) et `UserCreationForm.tsx` (client). **Preserver** l'ensemble : state des champs, submit POST, props `orgs`/`canCreateStaff`/`canCreateTopStaff`, la logique conditionnelle qui masque le role staff aux non-autorises et restreint SUPER_ADMIN a `canCreateTopStaff`. Le port habille sans changer ces regles.

- [x] **Step 2: Reconstruire le JSX**

Type de compte en `RadioCards` (client, relie au state `isStaff`), section role staff conditionnee comme aujourd'hui :

```tsx
<form onSubmit={handleSubmit} className="max-w-[640px] space-y-5">
  <Card>
    <CardBody className="py-2">
      <FormSection title="Compte">
        <Input label="Adresse e-mail" type="email" required value={form.email} onChange={...} />
        <Input label="Nom complet" required value={form.name} onChange={...} />
      </FormSection>

      <FormSection title="Type de compte">
        <RadioCards name="type" value={form.isStaff ? "staff" : "client"}
          onChange={(v) => setIsStaff(v === "staff")}
          options={[
            { value: "staff", title: "Staff", description: "Administration de la plateforme.", color: "#004D74" },
            { value: "client", title: "Client", description: "Rattaché à une organisation.", color: "#16a34a" },
          ]} />
      </FormSection>

      {form.isStaff && canCreateStaff && (
        <FormSection title="Rôle staff">
          <Select label="Rôle" value={form.staffRole} onChange={...}>
            <option value="STAFF_ADMIN">STAFF_ADMIN</option>
            {canCreateTopStaff && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
          </Select>
        </FormSection>
      )}

      {!form.isStaff && (
        <FormSection title="Lier à une organisation (optionnel)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Organisation" value={form.orgId} onChange={...}>
              <option value="">Aucune</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
            <Select label="Rôle dans l'org" value={form.orgRole} onChange={...}>
              <option value="OWNER">OWNER</option><option value="MANAGER">MANAGER</option><option value="AUDITOR">AUDITOR</option>
            </Select>
          </div>
        </FormSection>
      )}
    </CardBody>
  </Card>
  <div className="flex max-w-[640px] items-center justify-between">
    <Button type="button" variant="secondary" onClick={() => router.push("/staff/users")}>Annuler</Button>
    <Button type="submit"><Icon name="send" size={16} /> Créer et inviter</Button>
  </div>
</form>
```

_(Aligner exactement les noms de champs et options sur le `FormState`/l'API reels de `UserCreationForm.tsx` — l'extrait ci-dessus illustre la structure, pas les identifiants definitifs.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/users/new` en 375/768/1440, connecte en STAFF_ADMIN puis SUPER_ADMIN. Verifier : RadioCards a 2 colonnes (selection verte), section role staff qui apparait/disparait selon le type, option SUPER_ADMIN visible seulement pour `canCreateTopStaff`. Soumettre golden path (creation + invitation). `make test` vert.

**Acceptance:** Fidele a `staff-user-create.html` ; RBAC de creation preserve (staff/top-staff) ; RadioCards cable au state existant ; POST inchange.

---

### Task 7: staff-user-detail -> `/staff/users/[userId]`

Detail utilisateur : en-tete (avatar + nom + email + type), actions (reinitialiser mot de passe / archiver via `UserDetailActions`), carte « Appartenances » (org + RoleBadge), carte « Informations ».

**Files:**
- Modify: `src/app/staff/users/[userId]/page.tsx`
- Modify: `src/app/staff/users/[userId]/UserDetailActions.tsx` (habillage boutons, si non conforme)

**Reference maquette:** `template/screens/staff-user-detail.html`

**Composants:** `Card`/`CardHead`/`CardBody`, `RoleBadge`, `KeyValue` (Informations), `Timeline` (journal recent), `Button`, `Icon`, `OrgLogo`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire la `page.tsx`. **Preserver** les gardes (`canAdmin`, `canEditTopRoles`, `canResetPassword`, `isSelf`), la requete `findUnique` (orgMemberships + eventMemberships), `recentActivity`, `notFound()`, et `UserDetailActions` avec toutes ses props. On remplace le balisage des sections.

- [x] **Step 2: Reconstruire le JSX**

En-tete deux colonnes (grid-2col de la maquette). Appartenances org via `Card` + list-row `OrgLogo` + `RoleBadge` ; Informations via `KeyValue` ; journal recent via `Timeline` :

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <Card>
    <CardHead title="Appartenances" subtitle="Organisations et rôles" />
    <CardBody className="space-y-1">
      {user.orgMemberships.length === 0 && <p className="py-3 text-sm text-slate-400">Aucune appartenance.</p>}
      {user.orgMemberships.map((m) => (
        <div key={m.organization.id} className="flex items-center gap-3 py-2">
          <OrgLogo name={m.organization.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{m.organization.name}</div>
            <div className="font-mono text-xs text-slate-400">{m.organization.slug}</div>
          </div>
          <RoleBadge tone={m.role === "OWNER" ? "green" : "slate"}>{m.role}</RoleBadge>
        </div>
      ))}
    </CardBody>
  </Card>

  <Card className="p-6">
    <h3 className="mb-4 text-sm font-semibold text-slate-900">Informations</h3>
    <KeyValue items={[
      { label: "Statut", value: user.archived ? "Archivé" : "Actif" },
      { label: "Type", value: user.isStaff ? "Staff" : "Client" },
      { label: "Créé le", value: new Date(user.createdAt).toLocaleDateString("fr-FR") },
    ]} />
  </Card>
</div>
```

- [x] **Step 3: Habiller `UserDetailActions` + typecheck**

Relire `UserDetailActions.tsx`. **Preserver** les mutations (reset password / archive / role) et leurs gardes. Habiller les boutons en `Button`/`btn-ghost-sm` conformes DS (reinitialiser = secondary, archiver = danger discret). `make typecheck`.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/users/[userId]` en 375/768/1440. Verifier : en-tete avatar, deux cartes cote a cote (empilees en mobile), RoleBadge, `KeyValue`, actions conditionnees par role. `make test` vert.

**Acceptance:** Fidele a `staff-user-detail.html` ; gardes RBAC et actions preservees ; memberships/journal intacts.

---

### Task 8: staff-settings -> `/staff/settings`

Parametres plateforme : alerte info SUPER_ADMIN, carte SMTP (hote/port/user/mot de passe masque + switch TLS + bouton Tester l'envoi + resultat), carte reCAPTCHA (cle site + secret masque), carte Branding (nom + logo).

**Files:**
- Modify: `src/app/staff/settings/page.tsx`
- Modify: `src/components/staff/PlatformSettingsForm.tsx`
- Modify: `src/components/staff/TestSmtpForm.tsx`

**Reference maquette:** `template/screens/staff-settings.html`

**Composants:** `Alert` (info), `Card`/`CardHead`/`CardBody`, `FormSection`, `Input`, `Switch`, `Button`, `Icon`. _(Bouton oeil masque/affiche : logique locale du champ ; ne jamais rendre les secrets — la page passe deja `*Set` booleens.)_

**Steps**

- [x] **Step 1: Lire et preserver**

Relire les 3 fichiers. **Preserver** absolument la construction `safe` de `page.tsx` (secrets **jamais** transmis, seuls `smtpPasswordSet`/`recaptchaSecretKeySet` booleens), la garde `canEditSecrets = staffRole === "SUPER_ADMIN"`, et les submit/handlers de `PlatformSettingsForm`/`TestSmtpForm`. Le port habille sans changer le contrat de props ni exposer de secret.

- [x] **Step 2: Reconstruire le JSX**

`page.tsx` : head + `Alert` info + les deux composants clients (layout 2 colonnes) :

```tsx
<div className="space-y-5">
  <div>
    <h1 className="text-xl font-semibold text-slate-900">Paramètres plateforme</h1>
    <p className="mt-0.5 text-sm text-slate-400">Configuration globale — réservée aux SUPER_ADMIN</p>
  </div>
  {canEditSecrets && (
    <Alert tone="info"><Icon name="shield" size={16} /> Vous êtes connecté en tant que SUPER_ADMIN. Les champs sensibles ci-dessous sont modifiables.</Alert>
  )}
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
    <PlatformSettingsForm initial={safe} canEditSecrets={canEditSecrets} />
    <TestSmtpForm defaultEmail={...} />
  </div>
</div>
```

`PlatformSettingsForm.tsx` — envelopper SMTP / reCAPTCHA / Branding en `Card` + `CardHead` ; champs en `Input` ; TLS en `Switch` (relie au state existant) ; mot de passe masque avec placeholder `••••••••` quand `smtpPasswordSet` et non modifie :

```tsx
<Card>
  <CardHead title="Serveur SMTP" subtitle="Envoi des e-mails transactionnels" />
  <CardBody className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input label="Hôte" className="font-mono" value={form.smtpHost} onChange={...} disabled={!canEditSecrets} />
      <Input label="Port" className="font-mono" value={form.smtpPort} onChange={...} disabled={!canEditSecrets} />
    </div>
    <Input label="Utilisateur" value={form.smtpUser} onChange={...} disabled={!canEditSecrets} />
    <Input label="Mot de passe" type="password" placeholder={initial.smtpPasswordSet ? "••••••••••••" : ""} value={form.smtpPassword} onChange={...} disabled={!canEditSecrets} />
    <Switch checked={form.smtpSecure} onChange={(v) => setField("smtpSecure", v)} label="TLS activé" />
  </CardBody>
</Card>
```

`TestSmtpForm.tsx` — bouton `Tester l'envoi SMTP` + zone de resultat en `Alert` (succes/erreur selon la reponse), inchange fonctionnellement.

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/settings` en 375/768/1440, connecte SUPER_ADMIN puis role inferieur. Verifier : `Alert` info visible pour SUPER_ADMIN uniquement, champs sensibles `disabled` sinon, `Switch` TLS, bouton Tester -> `Alert` de resultat, secrets jamais pre-remplis (placeholder points). `make test` vert.

**Acceptance:** Fidele a `staff-settings.html` ; **aucun secret expose** ; `canEditSecrets` respecte ; test SMTP fonctionnel ; submit inchange.

---

### Task 9: staff-badge-template -> `/staff/settings/badge`

Modele de badge plateforme : apercu du template par defaut (galerie de `BadgeCard`), selection via `BadgeTemplatePicker` existant.

**Files:**
- Modify: `src/app/staff/settings/badge/page.tsx`
- Modify: `src/components/admin/BadgeTemplatePicker.tsx` (habillage de la galerie avec `BadgeCard`/apercu, si non conforme)

**Reference maquette:** `template/screens/staff-badge-template.html`

**Composants:** `BadgeCard` (apercu, `src/components/badge/BadgeCard.tsx`), `Card`, `StatusBadge`/`Tag` (« Défaut »), `Button`, `Icon`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire `page.tsx`. **Preserver** la garde (`staffRoleAtLeast(..., "STAFF_ADMIN")`, redirect), `listTemplates()`, `currentValue`, et le composant `BadgeTemplatePicker` avec ses props (`templates`, `currentValue`, `effectiveId`, `effectiveLevel="platform"`, `patchUrl`, `canClearToInherit={false}`). Le port n'affecte pas la cascade ni le PATCH.

- [x] **Step 2: Reconstruire le JSX**

Head fidele maquette + `BadgeTemplatePicker` habille en galerie `tpl-card` : chaque carte rend un apercu via `BadgeCard` (scale reduit) + nom + `StatusBadge`/`Tag` « Défaut » sur le template actif :

```tsx
<div className="mx-auto max-w-5xl space-y-6">
  <div className="flex items-start justify-between">
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Template de badge plateforme</h1>
      <p className="mt-0.5 text-sm text-slate-400">Modèle par défaut hérité par les organisations.</p>
    </div>
  </div>
  <BadgeTemplatePicker templates={templates} currentValue={currentValue} effectiveId={currentValue} effectiveLevel="platform" patchUrl="/api/staff/settings/badge" canClearToInherit={false} />
</div>
```

Dans `BadgeTemplatePicker`, chaque vignette (preserver le clic de selection + PATCH) :

```tsx
<button onClick={() => select(t.id)} className={`rounded-xl border p-3 text-left transition-colors ${t.id === value ? "border-green-600 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
  <div className="flex justify-center overflow-hidden">
    {/* apercu : soit <img src={t.previewSrc}> existant, soit <BadgeCard .../> maquette a l'echelle */}
  </div>
  <div className="mt-2 flex items-center justify-between">
    <span className="text-[13px] font-medium text-slate-900">{t.label}</span>
    {t.id === value && <StatusBadge>Défaut</StatusBadge>}
  </div>
</button>
```

_(Si `BadgeTemplatePicker` s'appuie deja sur `previewSrc` (images), garder l'image comme apercu et n'ajouter `BadgeCard` que si aucun apercu image n'existe — ne pas casser le rendu PDF ni la selection.)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/settings/badge` en 375/768/1440. Verifier : galerie de cartes, apercu de badge fidele, carte active borde-verte + `StatusBadge` « Défaut », selection qui PATCH sans erreur. `make test` vert.

**Acceptance:** Fidele a `staff-badge-template.html` ; cascade/PATCH template preserves ; garde STAFF_ADMIN respectee.

---

### Task 10: staff-log -> `/staff/activity`

Journal global : head + bouton Exporter, toolbar de filtres (recherche + type + periode + org + user), table (horodatage mono + `LogType` + action + auteur + contexte), lignes cliquables vers la vue detail (Task 11), pagination.

**Files:**
- Modify: `src/app/staff/activity/page.tsx`

**Reference maquette:** `template/screens/staff-log.html`

**Composants:** `Toolbar`/`ChipFilter` (form GET habille), `LogType`, `Table`, `Pagination` (primitive), `Icon`, `Button`.

**Steps**

- [x] **Step 1: Lire et preserver**

Relire `page.tsx`. **Preserver** `TYPES`, le `where` (type/org/user/event/staffActor/plage de dates), la pagination `page`/`pageSize=50`/`total`/`totalPages`, la requete `findMany` avec `user`/`orgId`/`eventId`/`targetId`. On remplace le balisage du form et de la table ; on conserve le `<form method="get">` (filtres serveur).

- [x] **Step 2: Reconstruire le JSX + mapping LogType**

Mapper `ActivityType` -> `kind` de `LogType` (`*_CREATED`->creation, `*_UPDATED`/`*_ROLE_CHANGED`/`*SETTINGS_UPDATED`->modification, `*_DELETED`/`*_ARCHIVED`/`*_REMOVED`->suppression, `USER_LOGIN`->connexion, `BADGE_SCANNED`/`*_PRINTED`/`*_EXPORTED`->acces, sinon systeme). Lignes cliquables via `<Link>` de ligne ou `onClick` navigation vers `/staff/activity/${a.id}` :

```tsx
function logKind(t: ActivityType): "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces" {
  if (t.endsWith("_CREATED") || t.endsWith("_ADDED") || t === "USER_REGISTERED") return "creation";
  if (t.endsWith("_DELETED") || t.endsWith("_ARCHIVED") || t.endsWith("_REMOVED")) return "suppression";
  if (t === "USER_LOGIN") return "connexion";
  if (t.startsWith("BADGE_")) return "acces";
  if (t.endsWith("_UPDATED") || t.endsWith("_ROLE_CHANGED") || t.endsWith("_SET") || t.endsWith("_RESTORED")) return "modification";
  return "systeme";
}
```

```tsx
<tbody>
  {activities.map((a) => (
    <tr key={a.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={undefined}>
      <td className="px-4 py-3 font-mono text-[13px] text-slate-400">{new Date(a.createdAt).toLocaleString("fr-FR")}</td>
      <td className="px-4 py-3"><LogType kind={logKind(a.type)}>{a.type}</LogType></td>
      <td className="px-4 py-3 text-sm text-slate-900">
        <Link href={`/staff/activity/${a.id}`} className="hover:text-green-600">{a.type}{a.staffActor && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">staff</span>}</Link>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-500">{a.user?.email ?? "—"}</td>
      <td className="px-4 py-3 text-[13px] text-slate-400">{a.orgId ? "org" : a.eventId ? "event" : "—"}</td>
      <td className="px-4 py-3 text-right text-slate-400"><Icon name="chevron-right" size={16} /></td>
    </tr>
  ))}
</tbody>
```

Filtres : garder le `<form method="get">` mais l'habiller (input recherche + selects `type`/`staffActor`/dates conformes maquette « chip-filter » — le rendu peut rester des selects GET stylises). Ajouter la `Pagination` (primitive) cablee sur `page`/`totalPages` via query string (le composant existant genere les liens `?page=`).

_(Les lignes doivent etre cliquables tout en gardant le `<td>` action ; utiliser un `<Link>` sur la cellule d'action + curseur pointer sur la ligne, ou un `<Link legacyBehavior>` — eviter d'imbriquer `<a>` dans `<a>`. Le plus simple : rendre l'ID cliquable dans la colonne action et la colonne « action metier ».)_

- [x] **Step 3: Typecheck**

Run: `make typecheck`
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/activity` en 375/768/1440. Verifier : toolbar de filtres, table avec `LogType` colore par categorie, horodatage mono, badge staff amber, `Pagination` verte, clic sur une ligne -> `/staff/activity/[logId]`. `make test` vert.

**Acceptance:** Fidele a `staff-log.html` ; filtres GET + pagination serveur preserves ; lignes cliquables vers la vue detail ; mapping LogType coherent.

---

### Task 11: journal-detail -> nouvelle route `/staff/activity/[logId]`

**1re implementation** de la vue detail d'entree de journal (partagee — les sous-plans org/event la reutiliseront). Route en **lecture seule** : entete (LogType + ID mono + titre + horodatage + boutons Copier l'ID / Exporter JSON), colonne principale (Details en `KeyValue`, Modification en `Diff` si applicable, Charge utile en `Payload`), colonne laterale (Auteur, Contexte, Entrees liees).

**Files:**
- Create: `src/app/staff/activity/[logId]/page.tsx`
- Create (optionnel, si extraction utile pour reutilisation org/event) : `src/components/activity/JournalEntryDetail.tsx` (composant presentational recevant l'entree + le contexte de retour ; les sous-plans org/event l'importeront)

**Reference maquette:** `template/screens/journal-detail.html`

**Composants:** `LogType`, `KeyValue`, `Diff`, `Payload`, `Card`/`CardHead`/`CardBody`, `Timeline`/`TimelineItem` (entrees liees), `RoleBadge`, `Icon`, `Button`, `OrgLogo`.

**Steps**

- [x] **Step 1: Definir la route et la requete (aucune logique metier, lecture seule)**

Nouvelle page Server Component. **Preserver le pattern d'acces staff** des autres pages `/staff/*` (le layout `StaffShell` protege deja l'espace ; ne pas ajouter de nouvelle regle RBAC). Requete `findUnique` sur l'entree :

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function StaffJournalDetailPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const log = await prisma.activityLog.findUnique({
    where: { id: logId },
    select: {
      id: true, type: true, createdAt: true, staffActor: true,
      ipAddress: true, userAgent: true, details: true,
      orgId: true, eventId: true, targetId: true,
      user: { select: { id: true, name: true, email: true, staffRole: true } },
    },
  });
  if (!log) notFound();

  // ActivityLog ne porte PAS de relation organization/event (seulement les scalaires
  // orgId/eventId). Pour afficher les noms dans la colonne « Contexte », faire des
  // lookups separes par id (pattern du dashboard Task 1), sans nouvelle logique metier :
  const [org, event] = await Promise.all([
    log.orgId ? prisma.organization.findUnique({ where: { id: log.orgId }, select: { id: true, name: true, slug: true } }) : null,
    log.eventId ? prisma.event.findUnique({ where: { id: log.eventId }, select: { id: true, title: true, slug: true, orgId: true } }) : null,
  ]);
  // ...
}
```

**Schema `ActivityLog` verifie** (`prisma/schema.prisma` l.359-378) : champs disponibles = `id`, `type` (`ActivityType`), `userId`/`user` (relation `User?`), `orgId`, `eventId`, `targetId`, `details` (`Json?`), `staffActor` (`Boolean`), `ipAddress` (`String?`), `userAgent` (`String?`), `createdAt`. **Il n'existe aucune relation `organization`/`event`** — utiliser les scalaires + lookups ci-dessus. Ne pas inventer de champ ni modifier le schema.

- [x] **Step 2: Reconstruire le JSX (2 colonnes) avec les blocs journal**

Le `Diff` n'est rendu que si `details` contient une forme `{ changes: { <champ>: { from, to } } }` ; sinon on affiche seulement `KeyValue` + `Payload`. `Payload` recoit `JSON.stringify(log.details, null, 2)`. Boutons Copier/Exporter cote client (petit composant client optionnel ou liens no-op fideles a la maquette) :

```tsx
<div className="space-y-6">
  <Link href="/staff/activity" className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600"><Icon name="arrow-left" size={13} /> Journal d'activité</Link>

  <div className="flex items-start justify-between gap-4">
    <div>
      <div className="mb-2 flex items-center gap-3">
        <LogType kind={logKind(log.type)}>{log.type}</LogType>
        <span className="font-mono text-[13px] text-slate-400">ENTRÉE #{log.id}</span>
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{describe(log.type)}</h1>
      <p className="mt-0.5 text-sm text-slate-400">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
    <div className="space-y-6">
      <Card>
        <CardHead title="Détails de l'action" />
        <CardBody>
          <KeyValue items={[
            { label: "Type", value: <LogType kind={logKind(log.type)}>{log.type}</LogType> },
            { label: "Auteur", value: log.user?.email ?? "Système" },
            { label: "Contexte", value: org?.name ?? event?.title ?? "—" },
            { label: "Staff", value: log.staffActor ? "Oui" : "Non" },
          ]} />
        </CardBody>
      </Card>

      {hasDiff(log.details) && (
        <Card>
          <CardHead title="Modification" subtitle="Valeur avant / après" />
          <CardBody><Diff oldValue={<span className="font-mono">{diffFrom}</span>} newValue={<span className="font-mono">{diffTo}</span>} /></CardBody>
        </Card>
      )}

      <Card>
        <CardHead title="Charge utile brute" subtitle="Données techniques de l'événement" />
        <CardBody><Payload json={JSON.stringify(log.details ?? {}, null, 2)} /></CardBody>
      </Card>
    </div>

    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Auteur</h3>
        {/* avatar + nom + email + RoleBadge + IP (si presente) via KeyValue */}
      </Card>
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Contexte</h3>
        {/* liens org/event en filebox-like (OrgLogo + nom) vers /staff/organizations/[id] et l'event */}
      </Card>
    </div>
  </div>
</div>
```

Reutiliser le helper `logKind` de la Task 10 (le factoriser dans un module partage `src/lib/activity-labels.ts` si pratique — sinon dupliquer une fois, factoriser plus tard quand org/event le reclameront).

- [x] **Step 3: Rendre les lignes du journal cliquables (deja fait Task 10) + typecheck**

Verifier que la Task 10 pointe bien vers cette route. `make typecheck`.
Expected: OK.

- [x] **Step 4: Controle visuel + tests**

`http://badge.local/staff/activity/[logId]` (prendre un ID reel via `/staff/activity`) en 375/768/1440. Verifier : entete LogType + ID mono, layout 2 colonnes (empile en mobile), `KeyValue`, `Payload` scrollable horizontalement, colonne laterale Auteur/Contexte, `notFound()` sur un ID inexistant. `make test` vert.

**Acceptance:** Nouvelle route lecture seule fidele a `journal-detail.html` ; aucun changement de schema ni de logique metier ; blocs `LogType`/`KeyValue`/`Diff`/`Payload` du directeur reutilises ; structure factorisable pour org/event.

---

## Self-Review

**Couverture des 10 ecrans + journal-detail :**

1. `staff-dashboard.html` -> `/staff` — Task 1. ✓ (StatGrid, Top 5 + QuotaBar, Timeline)
2. `staff-orgs.html` -> `/staff/organizations` — Task 2. ✓ (Toolbar, Table, Tag archivee)
3. `staff-org-create.html` -> `/staff/organizations/new` — Task 3. ✓ (FormSection)
4. `staff-org-detail.html` -> `/staff/organizations/[orgId]` — Task 4. ✓ (Quotas, KeyValue, danger + Modal)
5. `staff-users.html` -> `/staff/users` — Task 5. ✓ (Toolbar, RoleBadge, Table)
6. `staff-user-create.html` -> `/staff/users/new` — Task 6. ✓ (RadioCards, RoleBadge, lier org)
7. `staff-user-detail.html` -> `/staff/users/[userId]` — Task 7. ✓ (Appartenances, Informations)
8. `staff-settings.html` -> `/staff/settings` — Task 8. ✓ (SMTP + Test, reCAPTCHA, Branding, secrets proteges)
9. `staff-badge-template.html` -> `/staff/settings/badge` — Task 9. ✓ (galerie BadgeCard)
10. `staff-log.html` -> `/staff/activity` — Task 10. ✓ (LogType, lignes cliquables, Pagination)
11. `journal-detail.html` -> `/staff/activity/[logId]` — Task 11. ✓ (**nouvelle route**, LogType/KeyValue/Diff/Payload)

**Coherence des noms de composants (vs directeur) :** tous importes, aucun recree — `StatCard`/`StatGrid` (T2 directeur), `Card`/`CardHead`/`CardBody` (T1), `QuotaBar` (T4), `Timeline`/`TimelineItem` (T3), `Alert`/`EmptyState` (T6), `Toolbar`/`SearchInput`/`ChipFilter` (T7), `RoleBadge`/`Tag` (T9), `FormSection`/`Switch` (T10), `RadioCards` (T11), `Dropzone`/`FileBox` (T12), `Tabs`/`Segmented` (T15), `BadgeCard` (T16), `OrgLogo`/`PickCard` (T18), `LogType`/`KeyValue`/`Diff`/`Payload` (T20), `Icon` (T0.5). Primitives v2-15 : `Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`.

**Point d'attention — route journal-detail :** la vue detail est materialisee en **route dediee** `src/app/staff/activity/[logId]/page.tsx` (plutot qu'une modale) pour permettre le partage d'URL et la reutilisation directe par les sous-plans org (`/admin/[orgId]/activity/[logId]`) et event (`.../activity/[logId]`). Le composant presentational `JournalEntryDetail` (optionnel) est le vecteur de reutilisation ; si cree, il vit dans `src/components/activity/` et recoit l'entree + le lien de retour en props. Le helper de mapping `ActivityType -> LogType.kind` (`logKind`) est defini en Task 10 et reutilise en Task 11 — a factoriser (`src/lib/activity-labels.ts`) des que le sous-plan 03/04 le reclame.

**Garde-fous verifies :** aucune nouvelle logique metier ; aucune modification du schema Prisma, des routes API ni des helpers d'autorisation ; secrets SMTP/reCAPTCHA jamais transmis au client (Task 8) ; `canDelete`/`canEditSecrets`/`canCreateStaff` preserves ; une seule route ajoutee (Task 11, lecture seule).
