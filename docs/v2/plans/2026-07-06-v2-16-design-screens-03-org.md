# Port des maquettes v2-16 — Espace Organisation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Porter le **contenu** des 8 pages de l'espace Organisation (`/admin/[orgId]/*`) a la fidelite des maquettes `template/screens/org-*.html`, en **reskin** : on remplace le rendu JSX en composant avec la bibliotheque transverse (plan directeur) + les primitives v2-15, **sans** creer de logique metier, de route ni de server action. Data-fetching, RBAC, server actions et endpoints API restent strictement inchanges.

**Architecture:** Chaque page conserve son point d'entree serveur (Server Component qui `await params` + `prisma.*`) et, quand elle existe deja, sa frontiere client (`*Client.tsx`, `EventCreationWizard`, `BadgeTemplatePicker`). On ne touche qu'au **rendu** : le balisage `bg-white border rounded`/tables brutes/`<Kpi>` locaux est remplace par les composants du directeur (`Card`, `StatCard`/`StatGrid`, `Table`, `Timeline`, `QuotaBar`/`StorageAlert`, `FormSection`, `Stepper`, `RadioCards`, `Switch`, `CatPill`, `RoleBadge`, `LogType`, `Pagination`, `Modal`, `EmptyState`…). Aucun import de `template/assets/badge.css` : chaque classe de la maquette devient des utilitaires Tailwind v4 sur les tokens v2-15 (marine + vert). Les pages restent Server Components par defaut ; `"use client"` seulement ou l'etat existe deja.

**Tech Stack:** Next.js 16 (App Router, RSC par defaut), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `lucide-react` via le composant partage `Icon`, Prisma 6 (lecture seule ici). Verification : `make typecheck`, `make lint`, `make test` (Vitest, conteneur Docker dev) + controle visuel navigateur 3 viewports.

**Reference visuelle autoritaire :** `template/screens/org-dashboard.html`, `org-events.html`, `org-event-create.html`, `org-members.html`, `org-category-templates.html`, `org-badge-template.html`, `org-settings.html`, `org-log.html` + `template/assets/badge.css` (valeurs exactes).

**Spec :** [`../specs/2026-07-06-v2-16-design-screens-port.md`](../specs/2026-07-06-v2-16-design-screens-port.md)
**Plan directeur (composants transverses) :** [`2026-07-06-v2-16-design-screens-00-directeur.md`](2026-07-06-v2-16-design-screens-00-directeur.md)
**Format/ton de reference :** [`2026-06-17-v2-15-design-system-refonte.md`](2026-06-17-v2-15-design-system-refonte.md)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (typecheck + lint + tests verts + revue visuelle 3 viewports OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 1 | [x] | 2026-07-06 | `/admin/[orgId]` reskine (StatGrid + Card derniers events + Timeline). Alerte quota conservee (seuil >80). Storage reel non expose -> alerte pilotee par eventsPct/regsPct (inchangee). typecheck+lint OK. |
| 2 | [x] | 2026-07-06 | `/admin/[orgId]/events` reskine (table rounded-xl, statut non interactif pastilles, lien Configurer). Requete inchangee. Switch inscriptions inline -> non cable (affiche statut), a cabler plus tard. typecheck+lint OK. |
| 3 | [x] | 2026-07-06 | `EventCreationWizard` reskine (Stepper current 0-based + Segmented + Card + Checkbox multi-select + KeyValue recap). Etat/submit/validation/erreurs QUOTA/SLUG preserves. typecheck+lint OK. |
| 4 | [x] | 2026-07-06 | `MembersClient` + `OrgMemberForm` reskines (Card invitation, table RoleBadge/avatar, dernier OWNER verrouille cote affichage). refresh/remove/409 preserves. typecheck+lint OK. |
| 5 | [x] | 2026-07-06 | `TemplatesClient` + `CategoryTemplateForm` reskines (table CatPill/Tag, modal overlay edition avec Switch). refresh/remove/POST/PATCH preserves. Toggles inline table -> concentres dans la modale. typecheck+lint OK. |
| 6 | [x] | 2026-07-06 | `/admin/[orgId]/settings/badge` : head aligne DS ; galerie via BadgeTemplatePicker deja habille (Task 9 staff), heritage via canClearToInherit. Cascade/PATCH inchanges. typecheck+lint OK. |
| 7 | [ ] | | `org-settings.html` -> `/admin/[orgId]/settings` (FormSection Identite/Adresse/Administratif/Contact, FileBox logo, QuotaBar). |
| 8 | [ ] | | `org-log.html` -> `/admin/[orgId]/activity` (Toolbar, Table + LogType, lignes cliquables -> journal-detail, Pagination). |

**Convention de test (reskin)** : ces pages sont un **reskin de rendu**. La verification primaire est le **controle visuel** contre la maquette. Assertion de chaines de classes Tailwind = anti-pattern (fragile, faible valeur, YAGNI). Par task :
1. `make typecheck` — aucune regression de types (les signatures de props/data ne changent pas ; si un composant du directeur impose une prop, l'alimenter depuis la data existante sans requete nouvelle).
2. `make lint` — aucune nouvelle erreur (warnings preexistants toleres).
3. `make test` — la suite Vitest existante reste **verte** ; les tests des composants transverses (directeur) couvrent leur rendu, on ne re-teste pas la page.
4. **Controle visuel navigateur** — ouvrir l'ecran via `http://badge.local` (ou `localhost:3785`) et comparer a la maquette `template/screens/org-*.html`, sur **3 viewports** (375 / 768 / 1440) x etats pertinents (vide / charge / erreur), en tant que OWNER/MANAGER **et** en mode staff (banniere).

---

## Global Constraints

_(Reprises du directeur et de v2-15 — s'appliquent implicitement a chaque task. Voir [directeur — Global Constraints](2026-07-06-v2-16-design-screens-00-directeur.md).)_

- **PRESERVER la logique** : data-fetching Prisma, RBAC (`requireOrgRole`/`hasOrgRole`/`loadUserContext`), server actions, endpoints API (`/api/admin/[orgId]/*`) et payloads **inchanges**. Ce lot ne touche ni `prisma/schema.prisma`, ni `src/app/api/`, ni `src/lib/auth*`. Si une maquette revele une affordance UI (ex. Switch d'ouverture d'inscriptions inline) non encore cablee, la brancher sur l'endpoint **existant** ; si aucun endpoint n'existe, rendre l'affordance en lecture/affichage seul et le **noter** — ne pas inventer de route.
- **PRESERVER la banniere staff** : l'espace org est enveloppe par `OrgShell` (`src/components/admin/OrgShell.tsx`), qui affiche `StaffBanner` (bandeau ambre « Mode staff ») quand `isStaffMode`. Aucune page de ce lot ne rend le shell : ne pas dupliquer, ne pas masquer, ne pas repositionner la banniere. Verifier a chaque revue visuelle que le bandeau reste intact au-dessus du contenu reskine. Le marquage `staffActor` des lignes de journal (audit) reste visible.
- **Langue UI** : francais **avec accents** (é, è, à, ç, ê). Voix neutre/administrative, pas d'emoji. Casse phrase ; majuscules pour en-tetes de table, labels de stat (`uppercase tracking-wider text-xs`) et enums machine (`OWNER`/`MANAGER`/`AUDITOR`, `PENDING`…).
- **Accent unique** : `green-600` hover `green-700`. Etats : succes emerald, attente/staff amber, danger rose, info blue — jamais comme accent.
- **Plat par mandat** : aucune `shadow-*` sauf modales (`shadow-xl`) et segmented control (`shadow-sm`). Profondeur = bordures + contraste.
- **Rayons/bordures** : `rounded-xl` cartes/tables, `rounded-2xl` modales, `rounded-lg` boutons/inputs, `rounded-full` badges statut ; bordures `slate-200` cartes/tables, `slate-300` inputs, `slate-100` separateurs de lignes.
- **Nombres tabulaires** : compteurs, quotas, IDs, montants en `tabular-nums`.
- **Accessibilite AA** : `focus-visible` ring vert (herite du global v2-15) ; statut jamais code par la couleur seule (toujours un libelle).
- **Verification** : `make typecheck && make lint && make test` + controle visuel. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur.

**Prerequis (directeur) — BLOQUANT** : ce sous-plan **compose** avec les composants du plan directeur. Avant de commencer, verifier que les tasks directeur suivantes sont `[x]` :

| Composant requis ici | Task directeur |
|---|---|
| `Icon` (registre lucide partage) | 0.5 |
| `Card` / `CardHead` / `CardBody` | 1 |
| `StatCard` + `StatGrid` | 2 |
| `Timeline` + `TimelineItem` | 3 |
| `QuotaBar` + `StorageAlert` | 4 |
| `Alert` / `EmptyState` | 6 |
| `Toolbar` / `SearchInput` / `ChipFilter` | 7 |
| `CatPill` / `CatDot`, `RoleBadge`, `Tag` | 9 |
| `FormSection`, `Switch`, `Checkbox` | 10 |
| `RadioCards` | 11 |
| `FileBox` + `Dropzone` | 12 |
| `Stepper` | 14 |
| `Tabs` / `Segmented` | 15 |
| `BadgeCard` + `MiniBadge` | 16 |
| `LogType`, `KeyValue`, `Diff`, `Payload` | 20 |

Si l'un manque, **STOP** : implementer d'abord la task directeur correspondante (ou stub minimal note dans le tracker). Ne pas dupliquer le balisage inline pour contourner.

---

## Dependance

- **Plan directeur (composants transverses)** : [`2026-07-06-v2-16-design-screens-00-directeur.md`](2026-07-06-v2-16-design-screens-00-directeur.md) tasks **0.5 a 21** — voir tableau ci-dessus. Ce sous-plan **importe** ces composants, il ne les recree pas.
- **Vue detail de journal** (blocs `LogType` / `KeyValue` / `Diff` / `Payload`, maquette `template/screens/journal-detail.html`) : d'abord specifiee et implementee dans le **sous-plan STAFF** (`2026-07-06-v2-16-design-screens-02-staff.md`) comme vue detail partagee staff/org/event. La **Task 8** de ce sous-plan **reutilise** cette vue au niveau org (route ou modale depuis `/admin/[orgId]/activity`) : ne pas re-specifier les blocs ici. Si le sous-plan staff n'a pas encore livre la vue detail, cabler les lignes cliquables comme affordance (curseur + hover + `role`/chevron) pointant vers la route detail cible et le **noter** dans le tracker (blocage leve quand staff livre).

---

### Task 1: org-dashboard.html -> /admin/[orgId]

Tableau de bord org : alerte quota stockage 82%, grille de 4 StatCard, carte « Derniers evenements » (liste avec Switch actif/archive + compteur), carte « Activite recente » (Timeline).

**Files:**
- Modify: `src/app/admin/[orgId]/page.tsx` (Server Component — data-fetching Prisma **inchange**, seul le JSX de rendu change ; supprimer le helper local `Kpi`).

**Reference maquette:** `template/screens/org-dashboard.html` (page-head + bouton « Creer un evenement », `alert-info` ambre quota 82%, `stat-grid` 4 cartes, `panel-grid` : `card` Derniers evenements avec `list-row`/`switch`/`ds-value` + `card` Activite recente avec `tl`).

**Composants:** `Card`/`CardHead`/`CardBody`, `StatCard`/`StatGrid`, `StorageAlert`, `Timeline`/`TimelineItem`, `Switch` (affichage etat inscriptions), `Tag` (badge « Archive »), `Icon`, `Button` + `Link`, `EmptyState`.

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire `src/app/admin/[orgId]/page.tsx`. **Preserver a l'identique** le bloc `Promise.all` (comptes events actif/archive, `registrationsThisMonth`, `latestEvents`, `recentActivity`, quotas org) et les calculs `eventsPct`/`regsPct`. Ne rien ajouter aux `select` Prisma sauf si un champ deja disponible sur l'objet est necessaire au rendu (ex. `date`, `registrationOpen`, `title` sont deja selectionnes).

- [x] **Step 2: Reconstruire le JSX.** Remplacer le contenu retourne. Page-head + StorageAlert conditionnelle + StatGrid + panel-grid deux colonnes :

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StorageAlert } from "@/components/ui/QuotaBar";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { Switch } from "@/components/ui/FormControls";
import { Tag } from "@/components/ui/Labels";
import { EmptyState } from "@/components/ui/Feedback";

// ... data-fetching Promise.all INCHANGE ...

const storagePct = 82; // TODO tracker: brancher sur le vrai quota stockage si expose ; sinon garder la valeur derivee existante

return (
  <div className="space-y-6">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tableau de bord</h1>
        <p className="mt-0.5 text-sm text-slate-400">Vue d&apos;ensemble</p>
      </div>
      <Link
        href={`/admin/${orgId}/events/new`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        <Icon name="plus" size={16} /> Créer un événement
      </Link>
    </div>

    <StorageAlert pct={storagePct}>
      <Icon name="alert-triangle" size={16} />
      Quota de stockage à <b>{storagePct}%</b>. Archivez d&apos;anciens événements ou contactez le
      staff pour augmenter le quota.
    </StorageAlert>

    <StatGrid cols={4}>
      <StatCard label="Événements" value={eventsActive + eventsArchived} icon="calendar" sub={`${eventsActive} actifs`} />
      <StatCard label="Inscriptions" value={registrationsThisMonth.toLocaleString("fr-FR")} icon="user-check" sub="ce mois" />
      <StatCard label="Membres" value={membersCount} icon="users" />
      <StatCard
        label="Quota events"
        value={org?.quotaMaxEvents != null ? `${eventsActive}/${org.quotaMaxEvents}` : "—"}
        icon="hard-drive"
        delta={eventsPct != null && eventsPct > 80 ? { dir: "up", text: `${eventsPct}%` } : undefined}
      />
    </StatGrid>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHead title="Derniers événements" action={<Link href={`/admin/${orgId}/events`} className="text-[13px] font-medium text-green-600 hover:underline">Tout voir</Link>} />
        <CardBody className="py-2">
          {latestEvents.length === 0 ? (
            <EmptyState icon="calendar" title="Aucun événement pour le moment." />
          ) : (
            latestEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Icon name="calendar" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/${orgId}/events/${e.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">
                    {e.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-400">{new Date(e.date).toLocaleDateString("fr-FR")}</div>
                </div>
                <span className="text-sm font-medium tabular-nums text-slate-900">{e._count?.registrations ?? ""}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Activité récente" />
        <CardBody>
          {recentActivity.length === 0 ? (
            <EmptyState icon="scroll-text" title="Aucune activité récente." />
          ) : (
            <Timeline>
              {recentActivity.map((a) => (
                <TimelineItem
                  key={a.id}
                  tone={a.staffActor ? "warn" : "default"}
                  title={a.type}
                  meta={new Date(a.createdAt).toLocaleString("fr-FR")}
                />
              ))}
            </Timeline>
          )}
        </CardBody>
      </Card>
    </div>
  </div>
);
```

> **Notes de fidelite / preservation.** (a) La maquette affiche un `Switch` actif/archive et un compteur d'inscriptions par ligne. Le compteur exige `_count.registrations` sur `latestEvents` : si absent du `select` existant, l'ajouter au `select` **de la requete deja presente** (pas de nouvelle requete). Sinon, retirer le compteur plutot qu'inventer une valeur. (b) `membersCount` : si non deja recupere, ajouter un `prisma.orgMembership.count` **dans le `Promise.all` existant** (meme batch) ou retirer la StatCard Membres. (c) Le badge staff/audit (`a.staffActor`) reste visible via `tone="warn"` — ne pas le perdre. (d) `storagePct` : la maquette montre 82% en dur ; si le stockage reel n'est pas expose par le modele, conserver l'alerte pilotee par `eventsPct`/`regsPct` (logique existante) et **noter** dans le tracker.

- [x] **Step 3: `make typecheck`** — Expected: OK (aucune signature de page ne change ; `params: Promise<{ orgId }>` conserve).

- [x] **Step 4: Controle visuel + `make test`.** Ouvrir `http://badge.local/admin/[orgId]` (id reel via seed) sur **375 / 768 / 1440**. Verifier : page-head + bouton vert, alerte quota ambre si >80%, 4 StatCard (label uppercase, chiffre `tabular-nums`), 2 cartes cote a cote >=lg / empilees en mobile, Timeline avec dot ambre pour les actions staff. Recharger en **mode staff** : le bandeau ambre `StaffBanner` reste au-dessus. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-dashboard.html` (page-head, alerte quota, 4 stats, 2 panels).
- Data Prisma, calculs de quota et lien « Creer un evenement » **inchanges**.
- Bandeau `StaffBanner` intact en mode staff ; actions staff visibles dans la Timeline.
- `make typecheck && make lint && make test` verts.

---

### Task 2: org-events.html -> /admin/[orgId]/events

Liste des evenements : page-head + bouton Creer, Toolbar (recherche + filtre statut + case « afficher archives »), Table (Evenement / Slug / Date / Lieu / Inscriptions ouvertes = Switch / Inscriptions / actions), lignes archivees en `opacity-60` + Tag « Archive ».

**Files:**
- Modify: `src/app/admin/[orgId]/events/page.tsx` (Server Component, data-fetching **inchange**).
- Optionnel (si la Toolbar interactive est retenue) : `src/app/admin/[orgId]/events/EventsClient.tsx` **(Create)** — enveloppe client de filtrage cote client sur les data deja chargees ; **ne pas** ajouter d'endpoint. Par defaut, garder la page en Server Component et rendre la Toolbar en affichage (chips non fonctionnels marques disabled) si le filtrage n'existe pas encore.

**Reference maquette:** `template/screens/org-events.html` (`toolbar` avec `search-input` + `chip-filter` Statut + `check` « Afficher les archives », `tbl` colonnes, `switch sm on`, `tag` Archive, `row-actions` avec `btn-icon` ouvrir/archiver).

**Composants:** `Table` (primitive v2-15), `Toolbar`/`SearchInput`/`ChipFilter` (si client), `Switch`, `Tag`, `StatusBadge`, `Icon`, `Button`/`Link`, `EmptyState`.

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire la page. Preserver `prisma.event.findMany({ where: { orgId }, orderBy: { date: "desc" }, select: { … _count.registrations } })`. Ne pas filtrer cote serveur autrement qu'aujourd'hui.

- [x] **Step 2: Reconstruire le JSX.** Page-head + Toolbar + table reskinee. Extrait representatif de la ligne :

```tsx
<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
        <th className="px-4 py-3 font-medium">Événement</th>
        <th className="px-4 py-3 font-medium">Slug</th>
        <th className="px-4 py-3 font-medium">Date</th>
        <th className="px-4 py-3 font-medium">Lieu</th>
        <th className="px-4 py-3 font-medium">Inscriptions ouvertes</th>
        <th className="px-4 py-3 font-medium">Inscriptions</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
    <tbody>
      {events.map((e) => (
        <tr key={e.id} className={`border-b border-slate-100 hover:bg-slate-50 ${e.archived ? "opacity-60" : ""}`}>
          <td className="px-4 py-3 font-medium text-slate-900">
            <Link href={`/admin/${orgId}/events/${e.id}`} className="hover:underline">{e.title}</Link>
            {e.archived ? <Tag icon="inbox">Archivé</Tag> : null}
          </td>
          <td className="px-4 py-3 font-mono text-slate-500">{e.slug}</td>
          <td className="px-4 py-3">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
          <td className="px-4 py-3">{e.location}</td>
          <td className="px-4 py-3">
            <StatusBadge status={e.registrationOpen ? "APPROVED" : "PENDING"} label={e.registrationOpen ? "Ouvertes" : "Fermées"} />
          </td>
          <td className="px-4 py-3 tabular-nums">{e._count.registrations}</td>
          <td className="px-4 py-3 text-right">
            <Link href={`/admin/${orgId}/events/${e.id}/settings`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <Icon name="settings" size={16} />
            </Link>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

> **Notes de fidelite / preservation.** (a) La maquette rend l'ouverture d'inscriptions comme un `Switch` interactif inline. Un vrai toggle exige un endpoint : si `PATCH /api/admin/[orgId]/events/[eventId]` (ou equivalent) existe deja, le cabler dans un `EventsClient` client ; sinon, rendre le statut en **`StatusBadge` non interactif** (« Ouvertes » / « Fermees ») — jamais coder l'etat par la couleur seule — et **noter** l'affordance Switch a cabler plus tard. (b) Les chips de filtre / la case « archives » : garder l'affichage ; ne les rendre fonctionnels que s'ils filtrent cote client sur `events` deja charge (pas de requete). Sinon les marquer `disabled` et noter. (c) La colonne action pointe vers la page de configuration existante (« Configurer ») ; conserver la cible actuelle.

- [x] **Step 3: `make typecheck`** — Expected: OK.

- [x] **Step 4: Controle visuel + `make test`.** 3 viewports. Etat **charge** (>=1 event actif + 1 archive en `opacity-60` avec Tag), etat **vide** (`EmptyState` « Aucun evenement »). Table scroll horizontal en mobile (`overflow-x-auto`). Mode staff : bandeau intact. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-events.html` (toolbar, table, ligne archivee attenuee + Tag).
- `findMany` et cibles de navigation **inchangees** ; aucun endpoint cree.
- Statut d'inscriptions rendu avec libelle (jamais couleur seule).
- `make typecheck && make lint && make test` verts.

---

### Task 3: org-event-create.html -> /admin/[orgId]/events/new

Wizard de creation : Stepper 3 etapes (Informations / Categories / Recapitulatif), etape Categories avec Segmented « Depuis un modele » / « Manuelles », select de modele + table apercu (couleur `cat-dot`, N°, Anonyme), navigation Precedent/Continuer.

**Files:**
- Modify: `src/components/admin/EventCreationWizard.tsx` (composant client existant — **preserver** tout l'etat, `submit()`, la validation `step1Valid`, le mapping de payload et l'appel `POST /api/admin/[orgId]/events`).
- Inchange: `src/app/admin/[orgId]/events/new/page.tsx` (fournit `templates` ; aucun changement).

**Reference maquette:** `template/screens/org-event-create.html` (`stepper` avec `step done`/`step on`/`step`, `ds-h2`+`ds-body`, `segmented`, `field` select de modele, `tbl` apercu categories avec `cat-dot`/`mono`/`status-approved` Anonyme, `between` Precedent/Continuer).

**Composants:** `Stepper` (aligne le wizard sur le composant du directeur, Task 14), `Segmented`/`Tabs` (Task 15), `RadioCards` (selection de categories/modele si carte) **ou** `Table` d'apercu + `CatPill`/`CatDot`, `Switch`/`Checkbox`, `Input`/`Select` (primitives), `Button`, `Icon`.

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire `EventCreationWizard.tsx`. **Preserver a l'identique** : `useState` (`step`, `title`, `date`, `location`, `slug`, `slugTouched`, `mode`, `selectedTemplates`, `manualCats`, `submitting`, `err`), `suggestedSlug`, `onTitleChange`, `step1Valid`, `addManualCategory`, `submit()` (endpoint, gestion `QUOTA_EXCEEDED`/`SLUG_TAKEN`, `router.push`). On ne reskine que le rendu.

- [x] **Step 2: Reconstruire le JSX.** Remplacer le `<ol>` d'etapes par `Stepper`, les deux `Button` de mode par `Segmented`, et habiller chaque etape dans une `Card card-pad`. Extrait representatif (Stepper + Segmented + navigation) :

```tsx
import { Stepper } from "@/components/ui/Stepper";
import { Segmented } from "@/components/ui/Tabs";
import { Card, CardBody } from "@/components/ui/Card";

const steps = [
  { label: "Informations" },
  { label: "Catégories" },
  { label: "Récapitulatif" },
];

return (
  <div className="mx-auto max-w-[820px] space-y-4">
    <Link href={`/admin/${orgId}/events`} className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
      <Icon name="arrow-left" size={13} /> Événements
    </Link>
    <h1 className="text-xl font-semibold text-slate-900">Créer un événement</h1>

    <Card>
      <CardBody className="p-6">
        <Stepper steps={steps} current={step - 1} className="mb-6" />

        {err ? <Alert tone="err">{err}</Alert> : null}

        {step === 2 && (
          <>
            <h2 className="text-sm font-semibold text-slate-900">Catégories de participation</h2>
            <p className="mb-4 mt-1 text-[13px] text-slate-400">Importez un modèle ou créez vos catégories manuellement.</p>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as "template" | "manual")}
              options={[
                { value: "template", label: "Depuis un modèle" },
                { value: "manual", label: "Manuelles" },
              ]}
              className="mb-5"
            />
            {/* mode template : Select des modeles + table apercu (cat-dot / N° / Anonyme) — logique selectedTemplates INCHANGEE */}
            {/* mode manual : lignes manualCats + Button addManualCategory — INCHANGE */}
          </>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}>
            <Icon name="arrow-left" size={16} /> Précédent
          </Button>
          {step < 3 ? (
            <Button disabled={step === 1 && !step1Valid()} onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Continuer
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>{submitting ? "Création…" : "Créer l'événement"}</Button>
          )}
        </div>
      </CardBody>
    </Card>
  </div>
);
```

> **Notes de fidelite / preservation.** (a) `Stepper.current` est 0-based : `step` reste 1..3, on passe `current={step - 1}`. Verifier l'API reelle du `Stepper` du directeur (Task 14) et adapter (`current`/`active`/`steps` selon la signature livree ; documenter dans le tracker si differente). (b) Etape 1 (Informations) : garder les `Input` (Titre/Date/Lieu/Slug + aide slug) tels quels, juste dans la `Card`. (c) Etape Categories mode « template » : la maquette montre un `Select` de modele + une table d'apercu ; conserver la selection multiple existante (`selectedTemplates`) — soit en `Checkbox` par ligne (Task 10), soit en table d'apercu ; ne pas restreindre a une selection unique si l'existant est multiple. (d) Etape 3 (Recap) : reskiner en `dl`/`KeyValue`, garder les memes champs. (e) `submit()` et la gestion d'erreurs (`QUOTA_EXCEEDED`, `SLUG_TAKEN`) **inchangees**.

- [x] **Step 3: `make typecheck`** — Expected: OK (le type de `step` reste `1 | 2 | 3`).

- [x] **Step 4: Controle visuel + `make test`.** 3 viewports. Parcours golden path : etape 1 -> validation -> etape 2 (Segmented bascule template/manuel) -> etape 3 -> `Creer` -> redirection settings. Verifier l'etat `done`/`on`/pending du Stepper, l'erreur quota/slug rendue en `Alert`. `make test` vert (les tests existants du wizard, s'il y en a, restent verts).

**Acceptance:**
- Rendu fidele a `org-event-create.html` (Stepper 3 etapes, Segmented, apercu categories, navigation).
- Etat React, `submit()`, endpoint `POST /api/admin/[orgId]/events` et gestion d'erreurs **inchanges**.
- `make typecheck && make lint && make test` verts.

---

### Task 4: org-members.html -> /admin/[orgId]/members

Membres : page-head + bouton Inviter, carte formulaire d'invitation (e-mail + role + Envoyer), Table (Membre avatar / E-mail / Role = RoleBadge ou select inline / Statut / actions), dernier OWNER verrouille, aide « dernier OWNER ».

**Files:**
- Modify: `src/app/admin/[orgId]/members/MembersClient.tsx` (client existant — **preserver** `refresh()`, `remove()`, l'appel `DELETE /api/admin/[orgId]/members/[userId]`, la gestion du 409 « dernier OWNER »).
- Inchange: `src/app/admin/[orgId]/members/page.tsx` (data-fetching).
- Modify (rendu seul, si necessaire): `src/components/admin/OrgMemberForm.tsx` (formulaire d'invitation — **preserver** la logique de POST, habiller les inputs).

**Reference maquette:** `template/screens/org-members.html` (page-head + `btn-primary` Inviter, `card card-pad` form inline `Inviter par e-mail` + `select` Role + `btn-primary` Envoyer, `tbl` avec `avatar sm`, `role-badge`/`role-badge amber`/`role-badge slate`, `status-approved`/`status-pending`, `btn-icon` lock pour dernier OWNER, `trash-2` rose, `help` info).

**Composants:** `Card`/`CardBody`, `RoleBadge`, `StatusBadge`, `Table`, `Input`/`Select`, `Button`, `Icon`, `Alert`/`help`. Modal invitation optionnelle (la maquette utilise un formulaire inline en carte — conserver ce pattern, la Modal n'est pas requise ici).

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire `MembersClient.tsx` + `OrgMemberForm.tsx`. Preserver `useState(members)`, `refresh()`, `remove(userId)` (dont le `confirm` et le 409 -> « Impossible : c'est le dernier OWNER. »), et le POST d'invitation du form.

- [x] **Step 2: Reconstruire le JSX.** Page-head + carte formulaire + table. Extrait representatif (ligne membre + RoleBadge + statut + verrou dernier OWNER) :

```tsx
function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
const roleTone = (r: string) => (r === "OWNER" ? "green" : r === "AUDITOR" ? "amber" : "slate");

<tr key={m.userId} className="border-b border-slate-100 hover:bg-slate-50">
  <td className="px-4 py-3">
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
        {initials(m.name)}
      </span>
      <span className="font-medium text-slate-900">{m.name}</span>
    </div>
  </td>
  <td className="px-4 py-3 text-slate-500">{m.email}</td>
  <td className="px-4 py-3"><RoleBadge tone={roleTone(m.role)}>{m.role}</RoleBadge></td>
  <td className="px-4 py-3">
    <StatusBadge status={m.archived ? "PENDING" : "APPROVED"} label={m.archived ? "Invité" : "Actif"} />
  </td>
  <td className="px-4 py-3 text-right">
    {isLastOwner(m) ? (
      <span title="Dernier OWNER — action verrouillée" className="inline-flex h-8 w-8 items-center justify-center text-slate-300">
        <Icon name="shield" size={16} />
      </span>
    ) : (
      <button onClick={() => remove(m.userId)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50">
        <Icon name="trash-2" size={16} />
      </button>
    )}
  </td>
</tr>
```

> **Notes de fidelite / preservation.** (a) La maquette montre un `role-badge` fige pour l'OWNER et un `select` inline pour changer le role d'un membre : ne cabler le changement de role que si un endpoint `PATCH .../members/[userId]` existe deja ; sinon garder `RoleBadge` en affichage et **noter**. (b) « Dernier OWNER » : deriver `isLastOwner` cote client depuis `members` (compter les `role === "OWNER"`) — c'est de l'affichage ; la garde reelle reste cote serveur (409). Ne pas masquer le message d'erreur 409. (c) Le formulaire d'invitation garde son POST ; l'habiller en carte inline (e-mail flex-1 + Select role 180px + bouton). (d) Aide « dernier OWNER » en `help`/`Alert tone="info"`. (e) Le tri `orderBy: createdAt asc` et le mapping `page.tsx` restent inchanges.

- [x] **Step 3: `make typecheck`** — Expected: OK.

- [x] **Step 4: Controle visuel + `make test`.** 3 viewports. Etats : OWNER seul (verrou visible), plusieurs roles (RoleBadge green/amber/slate), invite en attente (`StatusBadge` « Invite »), tentative de retrait du dernier OWNER -> `Alert` d'erreur (409). Mode staff : bandeau intact ; une suppression en mode staff reste auditee. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-members.html` (form invitation, table avatars + RoleBadge + statut, verrou dernier OWNER, aide).
- `refresh`/`remove`/POST invitation/gestion 409 **inchanges** ; aucun endpoint cree.
- `make typecheck && make lint && make test` verts.

---

### Task 5: org-category-templates.html -> /admin/[orgId]/templates

Modeles de categories reutilisables : page-head + bouton Nouvelle categorie, Table (Categorie / Couleur = CatPill / N° / Anonyme = Switch / ALL ACCESS = Switch / actions edition), Modal d'edition (nom, numero, palette de couleurs, switches ALL ACCESS + Anonyme).

**Files:**
- Modify: `src/app/admin/[orgId]/templates/TemplatesClient.tsx` (client existant — **preserver** `refresh()`, `remove()`, l'ouverture edition/ajout et les endpoints).
- Modify (rendu seul): `src/components/admin/CategoryTemplateForm.tsx` (formulaire — **preserver** POST/PATCH, habiller en contenu de Modal).

**Reference maquette:** `template/screens/org-category-templates.html` (`tbl` avec `cat-pill` (dot + nom couleur), `mono` N°, `switch sm`/`switch sm on` Anonyme et ALL ACCESS, `btn-icon` pencil ; `overlay`/`modal` edition avec `field` Nom, `row-2` Numero + palette `cat-dot` selectionnable, `stack` deux `switch` ALL ACCESS/anonyme, `mf` Annuler/Enregistrer).

**Composants:** `Table`, `CatPill`/`CatDot`, `Switch`, `Modal` (primitive v2-15), `Input`, `Button`, `Icon`, `EmptyState`.

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire `TemplatesClient.tsx` + `CategoryTemplateForm.tsx`. Preserver `useState(templates/editing/adding)`, `refresh()`, `remove(id)` (`confirm` + `DELETE`), et le save du form (POST create / PATCH update).

- [x] **Step 2: Reconstruire le JSX.** Table reskinee + Modal (au lieu du form inline conditionnel, ou en conservant l'inline si plus simple — la maquette privilegie la Modal). Extrait ligne + CatPill :

```tsx
<tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
  <td className="px-4 py-3"><CatPill color={t.color} label={colorName(t.color)} /></td>
  <td className="px-4 py-3 font-mono tabular-nums">{String(t.number).padStart(2, "0")}</td>
  <td className="px-4 py-3"><Switch checked={t.anonymous} onChange={() => {}} /></td>
  <td className="px-4 py-3"><Switch checked={t.neutralBadge} onChange={() => {}} /></td>
  <td className="px-4 py-3 text-right">
    <button onClick={() => setEditing(t)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
      <Icon name="pencil" size={16} />
    </button>
  </td>
</tr>
```

Puis la Modal d'edition, alimentee par `editing`, contenant `CategoryTemplateForm` (ou son contenu) :

```tsx
<Modal open={!!editing || adding} title={editing ? "Modifier la catégorie" : "Nouvelle catégorie"} onClose={() => { setEditing(null); setAdding(false); }}>
  <CategoryTemplateForm orgId={orgId} initial={editing ?? undefined} onSaved={refresh} />
</Modal>
```

> **Notes de fidelite / preservation.** (a) Les `Switch` de la **table** (Anonyme / ALL ACCESS) sont un toggle inline : sans endpoint de patch par ligne, les rendre en **lecture** (checked reflète la data, `onChange` no-op ou desactive) et concentrer l'edition dans la Modal (qui, elle, PATCH via le form existant). Ne pas fabriquer un endpoint. **Noter** l'affordance toggle inline si souhaitee plus tard. (b) La palette de couleurs de la Modal doit correspondre aux couleurs manipulees par le form existant (`t.color`) ; garder l'`Input type="color"` du form si la palette fixe n'est pas cablee. (c) `colorName()` : helper d'affichage local (map hex -> libelle « Indigo »/« Teal »… comme la maquette) — pur presentational, pas de logique metier ; si non trivial, afficher le hex. (d) Verifier la signature `Modal` v2-15 (`open`/`title`/`onClose` vs `onCancel`/`onConfirm`) et adapter.

- [x] **Step 3: `make typecheck`** — Expected: OK.

- [x] **Step 4: Controle visuel + `make test`.** 3 viewports. Etats : liste chargee (CatPill couleurs, N° `01`/`02`…, Switch reflet data), vide (`EmptyState`), ouverture Modal edition (`shadow-xl`, `rounded-2xl`, palette + switches), enregistrement -> `refresh`. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-category-templates.html` (table CatPill + Switch, Modal edition palette + switches).
- `refresh`/`remove`/save du form + endpoints **inchanges**.
- `make typecheck && make lint && make test` verts.

---

### Task 6: org-badge-template.html -> /admin/[orgId]/settings/badge

Template de badge de l'organisation : Switch « Heriter de la plateforme » + aide, galerie de templates (BadgeCard apercu, carte selectionnee marquee « Herite »/selectionnee), selection.

**Files:**
- Modify: `src/app/admin/[orgId]/settings/badge/page.tsx` (Server Component — RBAC `hasOrgRole(ctx, orgId, "MANAGER")`, `resolveBadgeTemplateId`, `listTemplates`, `PATCH url` **inchanges** ; seul le wrapper de titre change legerement).
- Modify: `src/components/admin/BadgeTemplatePicker.tsx` (client existant — **preserver** l'etat de selection, l'appel PATCH `patchUrl`, `canClearToInherit` ; reskiner les cartes avec `BadgeCard`/`MiniBadge`).

**Reference maquette:** `template/screens/org-badge-template.html` (`card card-pad` avec `switch on` « Heriter de la plateforme » + `help`, `tpl-gallery` de `tpl-card`/`tpl-card selected` contenant un `badge-card` scale .46 avec `bc-band`/`bc-top`/`org-logo`/`bc-photo`/`bc-name`/`bc-catband`/`bc-foot`/`bc-qr`, `tp-meta` nom + `status-approved` « Herite »).

**Composants:** `BadgeCard` + `MiniBadge` (Task 16, reconciliation V1/V2), `Switch`, `Card`/`CardBody`, `StatusBadge`, `Icon`, `Alert`/`help`. Reutilise `BadgeTemplatePicker` existant.

**Steps:**

- [x] **Step 1: Lire + preserver.** Relire `page.tsx` + `BadgeTemplatePicker.tsx`. Preserver : redirections RBAC, `resolveBadgeTemplateId`, `effectiveLevel`, la liste `templates` (map de `listTemplates()`), les props passees au picker (`currentValue`, `effectiveId`, `effectiveLevel`, `patchUrl`, `canClearToInherit`) et la logique de PATCH interne du picker.

- [x] **Step 2: Reconstruire le JSX.** Dans `page.tsx`, habiller le titre en page-head DS (le picker reste). Dans `BadgeTemplatePicker.tsx`, remplacer les cartes actuelles par une galerie de `tpl-card` avec apercu `BadgeCard` (ou `MiniBadge` a l'echelle). Extrait de la galerie :

```tsx
<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
  {templates.map((t) => {
    const selected = value === t.id || (value == null && t.id === effectiveId);
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => select(t.id)}
        className={`flex flex-col gap-3 rounded-xl border-[1.5px] p-3 text-left transition-colors ${
          selected ? "border-green-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex justify-center overflow-hidden rounded-lg bg-slate-50 p-3">
          <MiniBadge templateId={t.id} label={t.label} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-900">{t.label}</span>
          {value == null && t.id === effectiveId ? (
            <StatusBadge status="APPROVED" label="Hérité" />
          ) : null}
        </div>
      </button>
    );
  })}
</div>
```

> **Notes de fidelite / preservation.** (a) Le Switch « Heriter de la plateforme » correspond a `canClearToInherit` : `on` = template null (herite). Cabler sur l'action existante du picker qui remet la valeur a null ; ne pas creer d'endpoint. Quand herite, la galerie est attenuee/verrouillee (`opacity-55 pointer-events-none`) comme la maquette. (b) `MiniBadge`/`BadgeCard` (Task 16) : passer les meta du template (`t.previewSrc`/`t.label`) selon l'API livree ; si `MiniBadge` attend une image, utiliser `t.previewSrc`. Adapter aux props reelles et documenter. (c) La selection declenche le PATCH deja implemente dans le picker — **inchange**. (d) RBAC MANAGER-only conserve : ne pas exposer le picker en lecture a un role insuffisant.

- [x] **Step 3: `make typecheck`** — Expected: OK.

- [x] **Step 4: Controle visuel + `make test`.** 3 viewports. Etats : herite (Switch on, galerie attenuee, carte plateforme marquee « Herite »), specifique org (Switch off, selection active bordee vert). Selection -> PATCH -> reflet. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-badge-template.html` (Switch heritage + aide, galerie BadgeCard, carte selectionnee/heritee).
- RBAC, `resolveBadgeTemplateId`, PATCH `patchUrl`, `canClearToInherit` **inchanges** ; reconciliation `BadgeCard` V1/V2 respectee (Task 16).
- `make typecheck && make lint && make test` verts.

---

### Task 7: org-settings.html -> /admin/[orgId]/settings

Parametres org : carte a `FormSection` (Identite avec logo « Changer » via FileBox, Adresse, Administratif, Contact, Quotas en lecture seule avec QuotaBar), boutons Annuler/Enregistrer.

**Files:**
- Modify: `src/app/admin/[orgId]/settings/SettingsClient.tsx` (client existant — **preserver** `useState(org)`, `set()`, `save()` et le `PATCH /api/admin/[orgId]`).
- Inchange: `src/app/admin/[orgId]/settings/page.tsx` (data-fetching).

**Reference maquette:** `template/screens/org-settings.html` (`card card-pad` de `form-section` : Identite (`row-2` Nom/Slug disabled + `filebox` logo « Changer »), Adresse, Administratif (`mono` SIRET/TVA), Contact, Quotas lecture seule avec `quota`/`qbar`/`qfill warn` 82% ; barre d'action `Annuler`/`Enregistrer` bas de page).

**Composants:** `FormSection`, `FileBox` (logo), `QuotaBar`, `Input`/`Select` (primitives), `Card`/`CardBody`, `Button`, `Icon`, `Alert` (message enregistrement).

**Steps:**

- [ ] **Step 1: Lire + preserver.** Relire `SettingsClient.tsx`. Preserver le type `OrgForm`, tous les `set(key, value)`, `save()` (PATCH + gestion `msg`), et les champs envoyes au PATCH.

- [ ] **Step 2: Reconstruire le JSX.** Envelopper dans une `Card` avec `FormSection` par groupe. Extrait representatif (Identite + logo + Quotas lecture seule) :

```tsx
import { FormSection } from "@/components/ui/FormControls";
import { FileBox } from "@/components/ui/FileBox";
import { QuotaBar } from "@/components/ui/QuotaBar";

<Card className="max-w-[760px]">
  <CardBody className="px-6 py-2">
    <FormSection title="Identité">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Nom" value={org.name} onChange={(e) => set("name", e.target.value)} />
        <Input label="Slug" value={org.slug} disabled className="font-mono" />
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-slate-600">Logo</label>
        <FileBox
          thumbUrl={org.logo ?? undefined}
          title={org.logo ? "logo.png" : "Aucun logo"}
          subtitle=""
          action={<Button variant="secondary" onClick={pickLogo}>Changer</Button>}
        />
      </div>
    </FormSection>

    <FormSection title="Adresse">{/* addressLine1/2, postalCode, city, country — set() INCHANGE */}</FormSection>
    <FormSection title="Administratif">{/* taxId (mono), website */}</FormSection>
    <FormSection title="Contact">{/* contactEmail, contactPhone */}</FormSection>

    <FormSection title="Quotas" description="Lecture seule — gérés par le staff">
      <QuotaBar label="Stockage" valueText="8,2 / 10 Go" pct={82} />
      <QuotaBar label="Événements" valueText={`${eventsCount} / ${quotaMaxEvents}`} pct={eventsQuotaPct} />
    </FormSection>
  </CardBody>
</Card>

<div className="mt-5 flex max-w-[760px] justify-end gap-3">
  <Button variant="secondary" onClick={() => setOrg(initialOrg)}>Annuler</Button>
  <Button onClick={save} disabled={saving}><Icon name="check" size={16} /> Enregistrer</Button>
</div>
```

> **Notes de fidelite / preservation.** (a) Les Quotas sont **lecture seule** dans la maquette (geres par le staff) : afficher via `QuotaBar` avec les valeurs de quota deja disponibles cote org si le `select` de `page.tsx` les expose ; sinon, elargir le `select` **existant** (meme requete) pour recuperer `quotaMaxEvents`/`quotaMaxRegistrations` et le `_count` events, ou afficher des placeholders et **noter**. Ne pas rendre ces jauges editables. (b) Le bouton « Changer » du logo : cabler sur l'upload existant (`FileUploadField`/`storage.ts`) si present ; sinon garder le champ URL actuel (`org.logo`) habille en FileBox et **noter**. (c) `Input` v2-15 : verifier s'il supporte une prop `label` ; sinon garder le pattern `label` + `Input` comme aujourd'hui. (d) Le message `msg` de `save()` -> `Alert tone="success"`/`"err"`. (e) « Annuler » = reset vers `initialOrg` (deja en state) — pas de navigation destructive.

- [ ] **Step 3: `make typecheck`** — Expected: OK.

- [ ] **Step 4: Controle visuel + `make test`.** 3 viewports. Etats : charge (4 FormSection + Quotas + FileBox logo), enregistrement OK (`Alert` succes), erreur (`Alert` err). Verifier `max-w-[760px]`, separateurs `slate-100` entre sections, `tabular-nums` sur quotas. Mode staff : bandeau intact. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-settings.html` (FormSection Identite/Adresse/Administratif/Contact/Quotas, FileBox logo, QuotaBar lecture seule).
- `OrgForm`, `set()`, `save()`, PATCH **inchanges** ; quotas non editables.
- `make typecheck && make lint && make test` verts.

---

### Task 8: org-log.html -> /admin/[orgId]/activity

Journal d'activite : page-head + bouton Exporter, Toolbar (recherche + filtres Type/Periode/Membre), Table (Horodatage `mono` / Type = LogType colore / Action / Auteur / Contexte / chevron), **lignes cliquables** vers la vue detail journal, Pagination « 1-6 sur N ».

**Files:**
- Modify: `src/app/admin/[orgId]/activity/page.tsx` (Server Component — data-fetching **inchange** ; peut passer a une frontiere client legere pour la Toolbar/pagination si non deja cablee, sans nouvel endpoint).
- Depend: vue detail journal (sous-plan STAFF) — reutilisee ici (route ou modale).

**Reference maquette:** `template/screens/org-log.html` (page-head + `btn-ghost-sm` Exporter, `toolbar wrap` avec `search-input` + 3 `chip-filter` (Type / 30 derniers jours / Membre), `tbl` avec `mono` horodatage, `log-type` colores (`acces`/`creation`/`systeme`/`suppression`/`modification`) + `ld` dot, ligne `clickable` -> `journal-detail.html`, `chevron-right` slate-400, `pager` « 1-6 sur 312 » + Precedent/Suivant).

**Composants:** `LogType` (Task 20 directeur), `Toolbar`/`SearchInput`/`ChipFilter` (si client), `Table`, `Pagination` (primitive v2-15), `Icon`, `Button`, `EmptyState`.

**Steps:**

- [ ] **Step 1: Lire + preserver.** Relire `page.tsx`. Preserver `prisma.activityLog.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 100, include: { user } })`. Conserver le marquage `staffActor`.

- [ ] **Step 2: Reconstruire le JSX.** Toolbar + table avec `LogType` + lignes cliquables + Pagination. Extrait representatif :

```tsx
<tr
  key={l.id}
  onClick={() => router.push(`/admin/${orgId}/activity/${l.id}`)}
  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
>
  <td className="px-4 py-3 font-mono text-slate-500 tabular-nums">
    {new Date(l.createdAt).toLocaleString("fr-FR")}
  </td>
  <td className="px-4 py-3"><LogType type={l.type} /></td>
  <td className="px-4 py-3 text-slate-900">{describe(l)}</td>
  <td className="px-4 py-3 text-slate-600">
    {l.user?.name ?? l.user?.email ?? "Système"}
    {l.staffActor ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">staff</span> : null}
  </td>
  <td className="px-4 py-3 text-slate-500">{context(l) ?? "—"}</td>
  <td className="px-4 py-3 text-right"><Icon name="chevron-right" size={16} /></td>
</tr>
```

> **Notes de fidelite / preservation.** (a) **Lignes cliquables -> vue detail** : la cible est la vue detail de journal partagee, **livree par le sous-plan STAFF** (`journal-detail.html`). Route org cible suggeree : `/admin/[orgId]/activity/[logId]` **ou** une modale reutilisant les blocs `LogType`/`KeyValue`/`Diff`/`Payload`. Si la vue detail n'est pas encore livree, garder l'affordance (curseur pointer + chevron + hover) et **noter** le blocage (la route detail sera branchee quand staff livre) — ne pas re-specifier les blocs ici. (b) `LogType type={l.type}` : le composant du directeur (Task 20) mappe `ActivityType` -> categorie coloree (acces/creation/systeme/suppression/modification) + libelle FR. Verifier que tous les `ActivityType` du schema sont couverts ; completer le mapping dans `LogType` (directeur), pas ici. (c) `describe(l)`/`context(l)` : helpers presentational locaux derivant l'action lisible et le contexte (event/org) depuis `l.details` — affichage seul, pas de logique metier. (d) Pagination : si la page charge `take: 100` sans pagination serveur, rendre la `Pagination` en cote client sur le tableau charge, ou garder l'info « X sur N » et brancher plus tard ; **noter** si non fonctionnelle. (e) Le staff-actor reste visible (audit).

- [ ] **Step 3: `make typecheck`** — Expected: OK.

- [ ] **Step 4: Controle visuel + `make test`.** 3 viewports. Etats : charge (LogType colores par categorie, horodatage `mono`, chevrons), vide (`EmptyState`), clic sur ligne -> vue detail (ou affordance notee si detail non livre). Mode staff : bandeau intact + lignes `staff` marquees. `make test` vert.

**Acceptance:**
- Rendu fidele a `org-log.html` (toolbar, table LogType, lignes cliquables, pagination).
- `findMany` **inchange** ; aucun endpoint cree ; vue detail **reutilisee** (dependance sous-plan staff, notee si non encore livree).
- Marquage `staffActor` conserve.
- `make typecheck && make lint && make test` verts.

---

## Self-Review (couverture vs maquettes org)

- **Couverture des 8 ecrans** : `org-dashboard` (Task 1), `org-events` (Task 2), `org-event-create` (Task 3), `org-members` (Task 4), `org-category-templates` (Task 5), `org-badge-template` (Task 6), `org-settings` (Task 7), `org-log` (Task 8). Les 8 pages `[ok]` de la spec (section « Espace Organisation ») sont couvertes, une task chacune.
- **Coherence des composants** : chaque page **importe** les composants transverses du directeur (`Card`, `StatCard`/`StatGrid`, `Timeline`, `QuotaBar`/`StorageAlert`, `FormSection`, `FileBox`, `Stepper`, `Segmented`, `RadioCards`, `Switch`, `CatPill`, `RoleBadge`, `Tag`, `LogType`, `BadgeCard`/`MiniBadge`) + les primitives v2-15 (`Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`) ; aucun balisage inline ne duplique un composant existant. Prerequis directeur (tasks 0.5-21) verifie en tete.
- **Banniere staff preservee** : aucune task ne rend le shell ; `OrgShell`/`StaffBanner` restent intacts ; chaque revue visuelle inclut un passage en mode staff. Le marquage `staffActor` reste visible sur dashboard (Timeline) et journal.
- **Logique preservee** : data-fetching Prisma, RBAC, server actions/PATCH/POST/DELETE et endpoints `/api/admin/[orgId]/*` **inchanges** dans les 8 tasks. Aucune route ni logique metier cree ; les affordances non cablees (toggles inline, filtres, pagination serveur, vue detail journal) sont rendues en affichage/lecture et **notees** dans le tracker, jamais inventees.
- **Dependance journal-detail** : Task 8 reutilise la vue detail livree par le sous-plan staff ; blocs `LogType`/`KeyValue`/`Diff`/`Payload` non re-specifies ici.
- **Contraintes DS** : accent vert unique, plat sauf modales/segmented, slate, `tabular-nums` sur stats/quotas/IDs, statut toujours libelle, FR avec accents. Verification `make typecheck && make lint && make test` + controle visuel 3 viewports par task.
- **Point d'attention residuel** : plusieurs affordances de la maquette (Switch d'ouverture d'inscriptions inline en Task 2, toggles Anonyme/ALL ACCESS en table Task 5, filtres/pagination Tasks 2/8) dependent d'endpoints potentiellement absents — a rendre en lecture + noter, a cabler dans un lot ulterieur si l'utilisateur le demande.
</content>
</invoke>
