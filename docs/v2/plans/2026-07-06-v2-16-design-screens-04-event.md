# Port des maquettes v2-16 — Espace Evenement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Porter le **contenu** des 15 pages de l'espace Evenement a la fidelite des maquettes `template/screens/event-*.html`, en composant avec la bibliotheque de composants transverses du plan directeur (StatCard, MiniChart, QuotaBar, Toolbar, BatchBar, RadioCards, FileBox/Dropzone, BadgeCard/MiniBadge, ScannerFrame/ScanResult, Tabs, etc.). Reskin **pur** : aucune nouvelle logique metier ni nouvelle route API, **sauf** la fusion UI des deux listes de blocage (emails + documents) en un seul ecran a onglets. Les data-fetching, server actions, RBAC et les quatre shells par role restent inchanges.

**Architecture:** L'espace Evenement est le plus riche de l'app : 15 ecrans sous `src/app/admin/[orgId]/events/[eventId]/`, servis via un `layout.tsx` qui selectionne le shell effectif (`EventShell` / `EventOperatorShell` / `EventPrinterShell` / `EventViewerShell`) selon `effectiveEventRole(ctx, eventId, orgId)` et affiche la banniere lecture seule pour VIEWER/AUDITOR. On **ne touche pas** au `layout.tsx` ni aux shells : chaque page se contente de remplacer son JSX de contenu par une composition des composants du directeur (Server Components par defaut ; `"use client"` seulement pour les composants a etat deja isoles dans `src/components/event/*`). Chaque classe `template/assets/badge.css` a un equivalent composant issu du directeur ; on ne reimporte jamais `badge.css`.

**Tech Stack:** Next.js 16 (App Router, RSC par defaut), React 19, Tailwind CSS 4 (`@theme` dans `globals.css`, pas de `tailwind.config`), TypeScript 5, `lucide-react` via le composant `Icon` partage (directeur Task 0.5), Vitest 4 + `@testing-library/react`. Verification : `make lint`, `make typecheck`, `make test`, + controle visuel navigateur (3 viewports x etats x roles).

**Reference visuelle autoritaire :** `template/screens/event-*.html` (les 15 ecrans) + `template/assets/badge.css` (valeurs exactes) + `template/styleguide.html`.

**Spec :** [`../specs/2026-07-06-v2-16-design-screens-port.md`](../specs/2026-07-06-v2-16-design-screens-port.md)
**Plan directeur (composants transverses) :** [`2026-07-06-v2-16-design-screens-00-directeur.md`](2026-07-06-v2-16-design-screens-00-directeur.md)

---

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre. Apres chaque task validee (lint + typecheck + tests verts + revue visuelle OK), passer `[ ]` a `[x]` et dater. Mi-task -> `[~]` + note d'etat (step en cours, fichiers touches, prochaine etape). Abandon -> `[-]` + raison (a consigner dans la spec).

Legende : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 1  | [x] | 2026-07-06 | Dashboard evenement reskine (StatGrid 4+3, Card 10 dernieres + StatusBadge, alerte quota). Branche OPERATOR habillee. MiniChart omis (pas de serie 30j). Queries/role preserves. typecheck+lint OK. |
| 2  | [x] | 2026-07-06 | `RegistrationTable` reskine (toolbar habillee, CatPill, StatusBadge ui, table rounded-xl, pager). Handlers/fetch/export preserves. BatchBar non ajoutee (pas de selection/endpoint batch dans la logique). typecheck+lint OK. |
| 3  | [x] | 2026-07-06 | Detail inscription reskine : `RegistrationDetailPanel` (Card/KeyValue/CatPill/StatusBadge/Alert/FileBox), `RegistrationActions` (boutons + modal DS), `RegistrationHistory` (Timeline), page back-link. Tous handlers/server actions preserves. typecheck+lint OK. |
| 4  | [x] | 2026-07-06 | `RegistrationForm` reskine (Card + FormSection Identite/Categorie RadioCards/Piece + Alert/Spinner). Categories sans couleur (select expose id/name/number). State/submit/validation preserves. typecheck+lint OK. |
| 5  | [x] | 2026-07-06 | Vue agregee VIEWER reskine (StatGrid 3 + Card repartition CatPill + total). Queries/role/notFound preserves, non nominatif. typecheck+lint OK. |
| 6  | [x] | 2026-07-06 | `BadgeListTable` reskine (filtre habille, BatchBar + Checkbox, table CatPill/Tag). Selection/batchPrint/openBatchPdf/load preserves. typecheck+lint OK. |
| 7  | [x] | 2026-07-06 | `BadgeBatchPanel` reskine (Card progression Spinner+ProgressBar + grille MiniBadge incrementale, puis PDFViewer). Fetches/QR/BadgeBatchExportV2 preserves. typecheck+lint OK. |
| 8  | [ ] | | Apercu badge (`badges/[badgeId]/page.tsx`) — BadgeCard + panneaux Actions/Informations. |
| 9  | [ ] | | Template badge event (`settings/badge/page.tsx`) — Switch heritage + galerie tpl + BadgeCard. |
| 10 | [ ] | | Categories (`categories/page.tsx`) — Table + CatDot + Switch + Modal edition. |
| 11 | [ ] | | **Fusion blocklists** en onglets (`blocked-emails` hote + Tabs Emails/Documents). |
| 12 | [ ] | | Scanner (`scan/page.tsx`) — ScannerFrame + ScanResult (reskin QRScanner, logica intacte). |
| 13 | [ ] | | Membres (`members/page.tsx`) — Table + RoleBadge + Modal invitation. |
| 14 | [ ] | | Parametres (`settings/page.tsx`) — FormSection + Switch quota + Contact override. |
| 15 | [ ] | | Journal (`activity/page.tsx`) — Table + LogType + Pagination + lignes cliquables -> vue detail. |

**Convention de test (reskin)** : chaque page est validee par (a) `make typecheck` vert, (b) `make test` vert (les tests existants — de rendu et E2E — ne dependent pas des classes de couleur ; s'ils cassent sur un texte/role, corriger la cause racine, pas contourner), (c) controle visuel contre la maquette sur 3 viewports (375 / 768 / 1440) x etats (vide / charge / erreur) x roles pertinents. Les composants a etat vivent deja dans `src/components/event/*` et portent leurs propres tests d'interaction ; on habille leur JSX sans toucher la logique.

---

## Global Constraints

_(Reprises du directeur — s'appliquent implicitement a chaque task. Voir la section `## Global Constraints` du plan directeur pour le detail complet.)_

- **Reskin strict** : preserver integralement le data-fetching (`prisma`, `loadUserContext`, `effectiveEventRole`), les server actions, la RBAC (`notFound()` / `redirect()` selon role), les snapshots d'inscription. On remplace **uniquement** le JSX de rendu. Exception unique : Task 11 (fusion UI blocklists, sans toucher les deux API).
- **Shells par role preserves** : ne **pas** modifier `layout.tsx` ni `EventShell` / `EventOperatorShell` / `EventPrinterShell` / `EventViewerShell`. Chaque page rend seulement son contenu ; le shell est injecte par le layout. La variante OPERATOR du dashboard (bloc `if (role === "OPERATOR")` dans `page.tsx`) et la variante OPERATOR du journal (`where.userId` + `type: "BADGE_SCANNED"`) doivent rester fonctionnelles.
- **Banniere lecture seule** : le rendu VIEWER/AUDITOR (banniere + shell reduit) est gere par les shells — ne rien casser. La page `registrations/overview` est la variante VIEWER de la liste (donnees **non nominatives**, agregees) ; ne jamais y exposer nom/email individuels.
- **Langue UI** : francais **avec accents** (é, è, à, ç, î...). Voix neutre/administrative, pas d'emoji.
- **Accent unique** : `green-600` hover `green-700`. Etats : succes emerald, attente/staff amber, danger rose, info blue — jamais comme accent.
- **Plat par mandat** : aucune `shadow-*` sauf modales (`shadow-xl`) et segmented control (`shadow-sm`). Profondeur = bordures + contraste.
- **Rayons / bordures / poids** : `rounded-lg` (boutons/inputs), `rounded-xl` (cartes/tables), `rounded-2xl` (modales), `rounded-full` (badges statut) ; `border-slate-200/300/100` ; 700 reserve au rendu badge (`font-badge`, Montserrat).
- **Nombres tabulaires** : stats, quotas, IDs, compteurs en `tabular-nums`.
- **Accessibilite AA** : `focus-visible` ring vert (global v2-15) ; statut jamais code par la couleur seule (toujours un libelle).
- **Verification** : `make lint && make typecheck && make test` (conteneur Docker dev) + controle visuel. L'evidence avant l'affirmation.
- **Git** : aucun commit sans demande explicite de l'utilisateur.

**Prerequis** : le plan directeur (Tasks 0.5–21) doit etre **complet** — tous les composants transverses existent et sont testes. Le socle v2-15 (tokens, shells, primitives `ui/`) reste la base non commitee.

---

## Dependance

- **Plan directeur (Tasks 0.5–21)** : bibliotheque de composants transverses. Ce sous-plan **consomme** ces composants et ne doit **pas** demarrer avant leur completion. Correspondance des composants requis :
  - `Icon` (0.5), `Card`/`CardHead`/`CardBody` (1), `StatCard`/`StatGrid` (2), `Timeline`/`TimelineItem` (3), `QuotaBar`/`StorageAlert` (4), `MiniChart` (5), `Alert`/`EmptyState`/`Spinner`/`ProgressBar`/`SuccessRing` (6), `Toolbar`/`SearchInput`/`ChipFilter` (7), `BatchBar`/`BatchButton` (8), `CatPill`/`CatDot`/`RoleBadge`/`Tag` (9), `FormSection`/`Switch`/`Checkbox` (10), `RadioCards` (11), `FileBox`/`Dropzone` (12), `Tabs`/`Segmented` (15), `BadgeCard`/`MiniBadge` (16), `Scanner` frame/`ScanResult` (17), blocs journal `LogType`/`KeyValue`/`Diff`/`Payload` (20).
  - Primitives v2-15 : `Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `StatusBadge`.
- **Vue detail journal (`journal-detail.html`)** : la vue detail d'entree de journal (avant/apres, payload, auteur, contexte) est **creee dans le sous-plan Staff (02)** — elle est partagee staff/org/event. La Task 15 de ce sous-plan **reutilise** cette vue (route/composant partage) pour rendre les lignes du journal cliquables. Si le sous-plan 02 n'a pas encore livre cette vue, la Task 15 s'arrete apres le reskin de la table + LogType + Pagination et note la reutilisation en `[~]`.
- **Sous-plans 01 (Public/Auth) et 03 (Org)** : pas de dependance bloquante ; ils partagent la meme bibliotheque directeur mais leurs ecrans sont disjoints.

---

### Task 1: Dashboard evenement

Tableau de bord : bandeau titre + actions (Scanner / Inscription), 5 statcards colorees, MiniChart 30 jours + Card "Controle d'acces" (QuotaBar), table des 10 dernieres inscriptions. La variante OPERATOR (KPI "Mes scans" + bouton scanner) est preservee telle quelle.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/page.tsx`
- Reference: `template/screens/event-dashboard.html`

**Reference maquette:** en-tete `page-head` (h1 "Tableau de bord" + sous-titre event/dates + `btn-secondary` Scanner + `btn-primary` Inscription) ; `stat-grid g5` (Total, Approuvées vert, En attente amber, Rejetées rose, Badges imprimés) ; `panel-grid 1.5fr/1fr` : Card "Inscriptions — 30 derniers jours" (`minichart` + labels de dates) et Card "Controle d'acces" (2 `quota` : Scans + Quota inscriptions avec `qfill warn`, + `alert alert-info` sur les variantes par role) ; Card "10 dernieres inscriptions" (`tbl` : nom, `cat-pill` + `cat-dot`, `status`, meta relative).

**Composants:** `StatGrid`/`StatCard`, `Card`/`CardHead`/`CardBody`, `MiniChart`, `QuotaBar`, `Alert`, `CatPill`, `StatusBadge`, `Table`, `Button`/`Link`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** `page.tsx`. Conserver **intact** : `getServerSession`, `loadUserContext`, la garde `event.orgId !== orgId`, `effectiveEventRole`, le bloc `if (role === "OPERATOR")` (dashboard operateur), le `Promise.all` de 8 comptages (`pending`/`approved`/`rejected`/`badgesPrinted`/`scansToday`/`scansTotal`/`latest`/`quota30d`) et le calcul `quotaPct`. Ne rien changer aux requetes.
- [x] **Step 2: Reconstruire le JSX du dashboard admin** (branche apres le bloc OPERATOR). Remplacer les `<Kpi>` maison et la `<ul>` par les composants directeur. La grille passe a `g5` (5 cartes). Les dates de labels du MiniChart et l'`alert-info` de variantes par role sont statiques dans la maquette ; pour la donnee reelle, alimenter `MiniChart` avec une serie 30 jours si disponible, sinon garder la serie derivee du comptage existant (ne pas ajouter de requete). Extrait representatif (fidele a la maquette, cable a la data existante) :

```tsx
<div className="space-y-6">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord</h1>
      <p className="mt-0.5 text-sm text-slate-400">{event.title}</p>
    </div>
    <div className="flex gap-2">
      <Link href={`/admin/${orgId}/events/${eventId}/scan`} className="btn-secondary">
        <Icon name="scan-line" size={16} /> Scanner
      </Link>
      <Link href={`/admin/${orgId}/events/${eventId}/registrations/new`} className="btn-primary">
        <Icon name="plus" size={16} /> Inscription
      </Link>
    </div>
  </div>

  <StatGrid cols={5}>
    <StatCard label="Total" value={pending + approved + rejected} icon="users" sub="inscriptions" />
    <StatCard label="Approuvées" value={approved} icon="check" />
    <StatCard label="En attente" value={pending} icon="clock" />
    <StatCard label="Rejetées" value={rejected} icon="x" />
    <StatCard label="Badges imprimés" value={badgesPrinted} icon="id-card" sub={`sur ${approved}`} />
  </StatGrid>

  <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
    <Card>
      <CardHead title="Inscriptions — 30 derniers jours" subtitle="Volume quotidien" />
      <CardBody>
        <MiniChart values={last30dSeries} ariaLabel="Inscriptions sur 30 jours" />
      </CardBody>
    </Card>
    <Card>
      <CardHead title="Contrôle d'accès" />
      <CardBody>
        <QuotaBar label="Scans effectués" valueText={`${scansTotal}`} pct={/* selon capacite */ 0} />
        {quotaMax != null && (
          <QuotaBar label="Quota inscriptions" valueText={`${quota30d} / ${quotaMax}`} pct={quotaPct ?? 0} />
        )}
      </CardBody>
    </Card>
  </div>

  <Card>
    <CardHead title="10 dernières inscriptions"
      action={<Link href={`/admin/${orgId}/events/${eventId}/registrations`} className="text-sm text-green-600 hover:underline">Tout voir</Link>} />
    {/* Table des `latest` : nom snapshot, CatPill, StatusBadge, date relative */}
  </Card>
</div>
```

- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-dashboard.html` sur 375/768/1440. Verifier : g5 responsive (2 cols mobile), couleurs des valeurs (emerald/amber/rose), MiniChart aligne en bas, QuotaBar `warn` amber >= 75 %. Etat vide : `latest` = 0 -> `EmptyState`. Role OPERATOR : la variante allegee s'affiche toujours.
- [x] **Step 5:** `make test` — Expected: vert (aucune regression sur les tests dashboard/E2E).

**Acceptance:** dashboard admin fidele a la maquette (5 statcards, MiniChart, 2 QuotaBar, table 10 lignes) ; variante OPERATOR intacte ; data et RBAC inchangees ; typecheck + tests verts.

---

### Task 2: Liste des inscriptions (ecran le plus dense)

Ecran le plus dense de l'app : toolbar (recherche + 3 ChipFilter Statut/Categorie/Tri + Exporter), BatchBar (Approuver/Imprimer/Exporter) qui apparait a la selection, table avec Checkbox de ligne, CatPill, StatusBadge, Pagination. Toute la logique de tri/filtre/selection/pagination vit deja dans `RegistrationTable` (client) — on habille son rendu.

**Files:**
- Modify: `src/components/event/RegistrationTable.tsx` (reskin du rendu ; logique preservee)
- Modify (marginal): `src/app/admin/[orgId]/events/[eventId]/registrations/page.tsx` (titre `page-head` seulement)
- Reference: `template/screens/event-inscriptions.html`

**Reference maquette:** `page-head` (h1 "Inscriptions" + sous-titre compteur + `btn-primary` Inscription) ; `toolbar wrap` (`search-input` avec `ico search`, `chip-filter` Statut/Categorie/Tri avec `chevron-down`, `spacer`, `btn-ghost-sm` Exporter `download`) ; `batch-bar` (`cnt` compteur + `spacer` + `bb-btn` Approuver `check` / Imprimer `printer` / Exporter) ; `tbl` avec `check box` d'en-tete + par ligne, `cell-name`, `cat-pill`+`cat-dot`, `status`, meta ; pagination en pied.

**Composants:** `Toolbar`/`SearchInput`/`ChipFilter`, `BatchBar`/`BatchButton`, `Checkbox`, `CatPill`, `StatusBadge`, `Table`, `Pagination`, `Button`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** `RegistrationTable.tsx` — cartographier l'etat existant (query de recherche, filtres statut/categorie, tri, set des IDs selectionnes, page courante, appels server actions Approuver/Imprimer/Exporter). **Ne changer aucun handler ni fetch.**
- [x] **Step 2: Reconstruire le JSX** : entete via `Toolbar` + `SearchInput` (branche sur l'etat recherche existant) + trois `ChipFilter` (Statut / Categorie / Tri, options tirees des filtres existants) + bouton Exporter. Rendre `BatchBar count={selected.size}` avec `BatchButton` Approuver/Imprimer/Exporter cables sur les actions existantes. Table : en-tete avec `Checkbox` "tout selectionner", lignes avec `Checkbox` de selection, `CatPill`, `StatusBadge`, meta. `Pagination` en pied branche sur la page existante. Extrait representatif :

```tsx
<Toolbar>
  <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un participant…" />
  <ChipFilter label="Statut" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
  <ChipFilter label="Catégorie" value={catFilter} onChange={setCatFilter} options={catOptions} />
  <ChipFilter label="Tri" value={sort} onChange={setSort} options={SORT_OPTIONS} />
  <span className="flex-1" />
  <Button variant="ghost" size="sm" onClick={exportCsv}><Icon name="download" size={14} /> Exporter</Button>
</Toolbar>

<BatchBar count={selected.size}>
  <BatchButton icon="check" onClick={approveSelected}>Approuver</BatchButton>
  <BatchButton icon="printer" onClick={printSelected}>Imprimer</BatchButton>
  <BatchButton icon="download" onClick={exportSelected}>Exporter</BatchButton>
</BatchBar>

<Table>{/* thead avec Checkbox all + rows: Checkbox, cell-name, CatPill, StatusBadge, meta */}</Table>
<Pagination page={page} total={pageCount} onChange={setPage} />
```

- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-inscriptions.html` sur 375/768/1440. Verifier : toolbar wrap sur mobile, BatchBar marine apparait/masque selon selection, checkbox "tout selectionner" coherente, CatPill/StatusBadge fideles, Pagination active verte. Etats : vide (`EmptyState` "Aucune inscription"), charge, erreur d'action (Alert).
- [x] **Step 5:** `make test` — Expected: vert (tests d'interaction de `RegistrationTable` intacts).

**Acceptance:** liste fidele (toolbar + filtres + BatchBar + table + pagination) ; selection multiple, approbation/impression/export par lot toujours fonctionnels ; aucune requete ni action modifiee ; typecheck + tests verts.

---

### Task 3: Detail d'une inscription

Fiche : bandeau titre + StatusBadge + barre d'actions (Approuver / Rejeter-Bloquer / Renvoyer / Copier / Supprimer), Card "Informations" (KeyValue), Card "Pieces fournies" (FileBox par document), Timeline d'historique. Actions et historique vivent dans `RegistrationDetailPanel` / `RegistrationActions` / `RegistrationHistory`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/registrations/[regId]/page.tsx`
- Modify: `src/components/event/RegistrationDetailPanel.tsx`, `RegistrationActions.tsx`, `RegistrationHistory.tsx` (reskin rendu)
- Reference: `template/screens/event-inscription-detail.html`

**Reference maquette:** `link arrow-left` retour ; `page-head` (h1 nom + `status status-pending`) ; `card card-pad` barre d'actions (`btn-primary btn-sm` Approuver `check`, `btn-danger btn-sm` Rejeter `x`, `btn-ghost-sm` Bloquer `ban`, Renvoyer `send`, Copier `copy`, `spacer`, `btn-icon` Supprimer `trash-2`) ; `grid-2col` : Card "Informations" (`row-2` de `field`) + Card "Pieces fournies" (FileBox) ; Timeline d'historique.

**Composants:** `Card`/`CardHead`/`CardBody`, `KeyValue`, `FileBox`, `Timeline`/`TimelineItem`, `StatusBadge`, `Button`, `Tag`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** la page + les 3 composants. Conserver : chargement de l'inscription (snapshots), `RegistrationActions` (server actions approve/reject/block/resend/delete), `RegistrationHistory` (logs). Ne changer aucun appel.
- [x] **Step 2: Reconstruire le JSX** : lien retour, `page-head` avec `StatusBadge`, barre d'actions habillee de `Button` (variants primary/danger/ghost + `btn-icon`), `grid-2col` avec Card "Informations" (liste `KeyValue` des champs snapshot + categorie via `CatPill`) et Card "Pièces fournies" (un `FileBox` par document uploade, `thumbUrl` si image, action de telechargement). `Timeline` alimentee par les logs de `RegistrationHistory` (tone `ok`/`warn`/`danger` selon type). Extrait representatif :

```tsx
<Card>
  <CardHead title="Pièces fournies" />
  <CardBody className="space-y-2.5">
    {documents.map((d) => (
      <FileBox key={d.id} icon="file" title={d.originalName} subtitle={formatSize(d.size)}
        thumbUrl={d.isImage ? d.url : undefined}
        action={<Button variant="ghost" size="sm" onClick={() => download(d)}><Icon name="download" size={14} /></Button>} />
    ))}
  </CardBody>
</Card>
```

- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-inscription-detail.html` sur 375/768/1440. Verifier : grid-2col empile en mobile, FileBox tronque les noms longs, Timeline avec dots colores, barre d'actions selon statut (Approuver masque si deja approuvee). Etats : sans pieces (message), avec pieces, action en erreur (Alert).
- [x] **Step 5:** `make test` — Expected: vert.

**Acceptance:** fiche fidele (actions + Informations + Pieces + Timeline) ; toutes les server actions (approuver/rejeter/bloquer/renvoyer/supprimer) fonctionnelles ; typecheck + tests verts.

---

### Task 4: Inscription manuelle

Formulaire d'inscription cote staff : FormSection "Identite" (champs), FormSection "Categorie" (RadioCards colorees), zone documents (Dropzone/FileBox). Logica dans `RegistrationForm`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/registrations/new/page.tsx`
- Modify: `src/components/event/RegistrationForm.tsx` (reskin ; validation et submit preserves)
- Reference: `template/screens/event-inscription-create.html`

**Reference maquette:** `link arrow-left` ; `page-head` (h1 "Inscription manuelle") ; `card card-pad` avec `form-section` "Identite" (`row-2` de `field` avec `req`), `form-section` "Categorie" (`radio-cards` -> `radio-card sel` avec `swatch`, `rc-t`, `rc-check check-circle`), zone documents Dropzone.

**Composants:** `Card`/`CardBody`, `FormSection`, `Input` (primitive), `RadioCards`, `Dropzone`/`FileBox`, `Button`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** `RegistrationForm.tsx` : state des champs, validation, `onSubmit` (server action de creation), upload des pieces (reutilise `FileUploadField`). Ne rien changer.
- [x] **Step 2: Reconstruire le JSX** : `FormSection` "Identité" avec les `Input` existants ; `FormSection` "Catégorie" rendue via `RadioCards` (options = categories de l'event, `color` = hex categorie, valeur branchee sur l'etat existant) ; zone documents via `Dropzone` (habille l'upload existant — ne pas reinventer) + `FileBox` par fichier depose. Bouton de soumission `Button` primary. Extrait representatif :

```tsx
<FormSection title="Catégorie" description="Sélectionnez la catégorie du participant.">
  <RadioCards
    name="categoryId"
    value={categoryId}
    onChange={setCategoryId}
    options={categories.map((c) => ({ value: c.id, title: c.name, color: c.color }))}
  />
</FormSection>
```

- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-inscription-create.html` sur 375/768/1440. Verifier : RadioCards responsive (auto-fill), option selectionnee bordure verte + check, Dropzone hover vert, FileBox apres depot. Etats : erreurs de validation (messages sous champs), depot invalide (type/taille), submit en cours (bouton disabled).
- [x] **Step 5:** `make test` — Expected: vert.

**Acceptance:** formulaire fidele (Identite + RadioCards + Dropzone) ; validation, upload et creation preserves ; typecheck + tests verts.

---

### Task 5: Vue agregee (variante VIEWER)

Variante role VIEWER de la liste : **donnees non nominatives**, repartition par categorie, stats agregees. Servie via le `EventViewerShell` (banniere lecture seule geree par le shell).

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/registrations/overview/page.tsx`
- Reference: `template/screens/event-inscriptions-viewer.html`

**Reference maquette:** `page-head` (h1 "Vue agrégée") ; `stat-grid` de `statcard` (Total, Approuvées, En attente, Rejetées) ; Card "Répartition par catégorie" avec `tbl` : `cat-pill`+`cat-dot`, comptes, `status` agreges — **aucun nom ni email**.

**Composants:** `StatGrid`/`StatCard`, `Card`/`CardHead`/`CardBody`, `Table`, `CatPill`, `StatusBadge`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** la page : requetes d'agregation (counts par categorie/statut). Verifier qu'aucune donnee nominative n'est chargee ; **ne pas** en ajouter. Conserver la garde de role.
- [x] **Step 2: Reconstruire le JSX** : `StatGrid cols={4}` avec les totaux agreges, puis Card "Répartition par catégorie" avec une `Table` (une ligne par categorie : `CatPill`, effectif, `StatusBadge` de repartition). Aucun champ `snapshotFirstName`/`snapshotEmail` dans le rendu.
- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-inscriptions-viewer.html` sur 375/768/1440 en role VIEWER. Verifier : banniere lecture seule presente (shell), statcards, table de repartition, **zero donnee nominative**. Etat vide (aucune inscription -> EmptyState).
- [x] **Step 5:** `make test` — Expected: vert.

**Acceptance:** vue agregee fidele, strictement non nominative ; banniere lecture seule intacte ; typecheck + tests verts.

---

### Task 6: Liste des badges

Table des badges avec toolbar (recherche + ChipFilter Categorie/Impression), Checkbox de ligne, lien vers l'impression batch. Logica dans `BadgeListTable`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/badges/page.tsx`
- Modify: `src/components/event/BadgeListTable.tsx` (reskin)
- Reference: `template/screens/event-badges.html`

**Reference maquette:** `page-head` (h1 "Badges" + `btn-secondary` Exporter `download` + `btn-primary` Imprimer `printer`) ; `toolbar wrap` (`search-input`, `chip-filter` Categorie/Impression, `spacer`, `ds-meta` info `info`) ; `tbl` : `cell-name`, `cat-pill`+`cat-dot`, `switch track sm on` (etat imprime), `status`.

**Composants:** `Toolbar`/`SearchInput`/`ChipFilter`, `Checkbox`, `CatPill`, `StatusBadge`, `Table`, `Button`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** `BadgeListTable.tsx` : filtres, selection, lien vers `badges/print`. Ne rien changer aux handlers.
- [x] **Step 2: Reconstruire le JSX** : `page-head` avec boutons Exporter/Imprimer, `Toolbar` + `SearchInput` + `ChipFilter` (Categorie, Statut d'impression), `Table` avec `Checkbox` de ligne, `CatPill`, `StatusBadge`, colonne "imprime". Le bouton Imprimer pointe vers `badges/print`.
- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-badges.html` sur 375/768/1440. Verifier : toolbar, table, selection, lien impression. Etat vide (EmptyState).
- [x] **Step 5:** `make test` — Expected: vert.

**Acceptance:** liste badges fidele ; selection + lien impression intacts ; typecheck + tests verts.

---

### Task 7: Impression batch

Ecran d'impression par lot (role PRINTER via `EventPrinterShell`) : Card de progression (Spinner + ProgressBar "8/12"), toolbar "Tout selectionner", grille de MiniBadge. Logica dans `BadgeBatchPanel`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/badges/print/page.tsx`
- Modify: `src/components/event/BadgeBatchPanel.tsx` (reskin)
- Reference: `template/screens/event-badge-batch.html`

**Reference maquette:** `link arrow-left` ; `page-head` (h1 "Impression batch") ; `card card-pad` progression (`between` : `spinner` + `ds-value` + `ds-meta mono` "8/12" ; `progress`) ; `toolbar` ("Tout selectionner" `check`, `spacer`, `btn-secondary` Exporter `download`, `btn-primary` Imprimer `printer`) ; `grid-thumbs` de `badge-thumb sel` (`chk box on`, `prev` = `mini-badge` : `mb-band`, `mb-body`, `mb-ph`, `mb-nm`, `mb-cat`, `cap`).

**Composants:** `Card`/`CardBody`, `Spinner`, `ProgressBar`, `Toolbar`, `Checkbox`, `MiniBadge`, `Button`, `Icon`.

**Steps:**
- [x] **Step 1: Lire et preserver** `BadgeBatchPanel.tsx` : etat de selection, progression d'impression, appels d'impression. Ne rien changer.
- [x] **Step 2: Reconstruire le JSX** : Card de progression avec `Spinner` (pendant impression) + `ProgressBar pct={done/total*100}` + compteur `mono` "8/12" ; `Toolbar` avec `Checkbox` "Tout selectionner" + boutons Exporter/Imprimer ; grille responsive de `MiniBadge` (chacun avec un `Checkbox` de selection en overlay). Extrait representatif :

```tsx
<Card>
  <CardBody className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {printing && <Spinner size={24} />}
      <span className="text-sm font-medium text-slate-900">Impression en cours…</span>
    </div>
    <span className="tabular-nums text-sm text-slate-400">{done}/{total}</span>
  </CardBody>
  <CardBody><ProgressBar pct={total ? (done / total) * 100 : 0} /></CardBody>
</Card>

<div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
  {badges.map((b) => (
    <label key={b.id} className="relative">
      <Checkbox checked={selected.has(b.id)} onChange={() => toggle(b.id)} label="" />
      <MiniBadge name={b.name} category={b.categoryName} color={b.color} />
    </label>
  ))}
</div>
```

- [x] **Step 3:** `make typecheck` — Expected: OK.
- [x] **Step 4: Controle visuel** contre `event-badge-batch.html` sur 375/768/1440 en role PRINTER. Verifier : progression, grille de MiniBadge (colonnes responsives), selection visible, `EventPrinterShell` intact. Etats : rien a imprimer (EmptyState), impression en cours (Spinner + ProgressBar), terminee (SuccessRing optionnel).
- [x] **Step 5:** `make test` — Expected: vert.

**Acceptance:** ecran batch fidele (progression + grille MiniBadge) ; selection et impression preserves ; shell PRINTER intact ; typecheck + tests verts.

---

### Task 8: Apercu d'un badge

Apercu d'un badge unique : `BadgeCard` (100x140 mm) + panneaux Actions (Imprimer/Telecharger + Switch) et Informations (KeyValue).

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/badges/[badgeId]/page.tsx`
- Reference: `template/screens/event-badge-preview.html`

**Reference maquette:** `link arrow-left` ; `page-head` (h1 "Aperçu du badge") ; `grid-2col` : Card avec `badge-card` (`bc-band`, `bc-top` org-logo + `bc-org`, `bc-photo`, `bc-name`, `bc-role`, `bc-catband`, `bc-foot` avec `qr-box bc-qr` + `bc-meta`) et `stack` de Card "Actions" (`switch track on` + `btn-primary` Imprimer `printer` + `btn-secondary` Telecharger `download`) + Card "Informations".

**Composants:** `BadgeCard`, `Card`/`CardHead`/`CardBody`, `Switch`, `KeyValue`, `Button`, `Icon`.

**Steps:**
- [ ] **Step 1: Lire et preserver** la page : chargement du badge (snapshot, categorie, QR, org logo), actions d'impression/telechargement. **Reconcilier les doublons badge V1/V2** en utilisant le `BadgeCard` canonique du directeur (Task 16).
- [ ] **Step 2: Reconstruire le JSX** : `grid-2col` avec `BadgeCard` (props = snapshot + categorie + QR + logo org) a gauche, et a droite un `stack` de Card "Actions" (Switch d'un reglage existant, boutons Imprimer/Telecharger cables) + Card "Informations" (`KeyValue`).
- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-badge-preview.html` sur 375/768/1440. Verifier : BadgeCard aux bonnes proportions (Montserrat `font-badge`), QR net, panneaux Actions/Informations. Empilement mobile.
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** apercu fidele (BadgeCard canonique + Actions + Informations) ; impression/telechargement preserves ; typecheck + tests verts.

---

### Task 9: Template de badge (evenement)

Configuration du template de badge au niveau event : Switch "Heriter de l'organisation", galerie de `tpl-card`, apercus `BadgeCard`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/settings/badge/page.tsx`
- Reference: `template/screens/event-badge-template.html`

**Reference maquette:** `page-head` (h1 "Template de badge") ; `card card-pad` avec `switch track` "Heriter de l'organisation" + `help` ; `tpl-gallery` de `tpl-card` (/`tpl-card selected`) avec `tp-prev` (= `badge-card` apercu) + `tp-meta` (`tp-nm` + `tag`).

**Composants:** `Card`/`CardBody`, `Switch`, `BadgeCard`, `Tag`, `Button`, `Icon`.

**Steps:**
- [ ] **Step 1: Lire et preserver** la page : resolution du template (`resolveBadgeTemplateId` cascade Event -> Org -> Platform), etat "heriter", selection du template, server action de sauvegarde. Ne rien changer a la cascade.
- [ ] **Step 2: Reconstruire le JSX** : Card avec `Switch` "Hériter de l'organisation" (branche sur l'etat existant ; desactive la galerie quand actif) + texte d'aide ; galerie de `tpl-card` (grille), chaque carte avec un apercu `BadgeCard` reduit + nom + `Tag`, l'active marquee `selected`. Extrait representatif :

```tsx
<Card>
  <CardBody className="space-y-4">
    <Switch checked={inherit} onChange={setInherit} label="Hériter du template de l'organisation" />
    {!inherit && (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {templates.map((t) => (
          <button key={t.id} onClick={() => setTemplateId(t.id)}
            className={`rounded-xl border-[1.5px] p-3 text-left ${t.id === templateId ? "border-green-600 bg-emerald-50" : "border-slate-200"}`}>
            <BadgeCard preview {...t.previewProps} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{t.name}</span>
              {t.id === templateId && <Tag icon="check">Actif</Tag>}
            </div>
          </button>
        ))}
      </div>
    )}
  </CardBody>
</Card>
```

- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-badge-template.html` sur 375/768/1440. Verifier : Switch desactive/masque la galerie, apercus BadgeCard, carte active bordure verte + Tag. Etat herite (galerie grisee) vs surcharge.
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** ecran template fidele ; cascade de resolution et sauvegarde preservees ; typecheck + tests verts.

---

### Task 10: Categories

Table des categories (nom, `CatDot`, statut anonyme via Switch) + Modal d'edition (nom, couleur, anonyme). Logica dans `CategoryTable` / `CategoryForm`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/categories/page.tsx`
- Modify: `src/components/event/CategoryTable.tsx`, `CategoryForm.tsx` (reskin)
- Reference: `template/screens/event-categories.html`

**Reference maquette:** `page-head` (h1 "Catégories" + `btn-secondary` Modeles `tags` + `btn-primary` Nouvelle `plus`) ; `tbl` : `cell-name` + `cat-pill`/`cat-dot`, `mono` (slug/count), `switch track sm` (anonyme), `row-actions` `btn-icon` `pencil` ; Modal d'edition (nom, couleur, switch anonyme).

**Composants:** `Table`, `CatPill`/`CatDot`, `Switch`, `Modal`, `Input`, `FormSection`, `Button`, `Icon`.

**Steps:**
- [ ] **Step 1: Lire et preserver** `CategoryTable.tsx` / `CategoryForm.tsx` : CRUD categories, toggle anonyme, import de modeles (`CategoryImportTemplatesModal`), reassignation (`CategoryReassignModal`). Ne rien changer.
- [ ] **Step 2: Reconstruire le JSX** : `page-head` avec boutons Modeles/Nouvelle ; `Table` (nom + `CatDot` couleur, count `mono`, `Switch` anonyme cable sur l'action existante, `btn-icon` crayon d'edition) ; `Modal` d'edition habillant `CategoryForm` (Input nom, sélecteur couleur, `Switch` anonyme).
- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-categories.html` sur 375/768/1440. Verifier : table, CatDot couleurs, Switch anonyme, Modal (overlay flou + shadow-xl). Etats : liste vide (EmptyState), edition, reassignation avant suppression.
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** categories fideles (table + Switch + Modal) ; CRUD, import modeles, reassignation preserves ; typecheck + tests verts.

---

### Task 11: Fusion des listes de blocage en onglets

**FUSION UI** de `blocked-emails` + `blocked-documents` en **un seul ecran a onglets** (composant `Tabs` du directeur). Les **deux API** (`blocked-emails`, `blocked-documents`) et les deux composants (`BlockedEmailsForm`, `BlockedDocumentsForm`) restent **inchanges** ; c'est un regroupement de rendu.

**Point de decision d'URL (a valider avec l'utilisateur avant de coder) :**
- **Option recommandee** : conserver `blocked-emails/page.tsx` comme **hote des onglets** (URL canonique `.../blocked-emails`), y charger les **deux** jeux de donnees (`blockedEmail` + `blockedDocument`), et faire pointer la nav de l'`EventShell` vers cette route unique. `blocked-documents/page.tsx` devient soit un **redirect** vers `blocked-emails`, soit un lien mort supprime de la nav (mais route conservee pour compat). Avantage : pas de nouvelle route, pas de casse de liens existants.
- **Option alternative** : nouvelle route `.../blocklists/page.tsx` hote des onglets + redirects depuis `blocked-emails` et `blocked-documents`. Plus propre semantiquement mais introduit une route (borderline vs "aucune nouvelle route" de la spec).
- **Defaut si non tranche** : Option recommandee (hote = `blocked-emails`). Noter le choix dans le tracker.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/blocked-emails/page.tsx` (devient l'hote des onglets — charge les 2 jeux de donnees)
- Modify: `src/app/admin/[orgId]/events/[eventId]/blocked-documents/page.tsx` (redirect vers `blocked-emails`, ou conserve selon decision)
- Modify: `src/components/event/EventShell.tsx` **seulement** si la nav duplique les deux entrees (fusionner en une entree "Listes de blocage") — sinon ne pas toucher au shell
- Modify (optionnel): `BlockedEmailsForm.tsx`, `BlockedDocumentsForm.tsx` (reskin du rendu interne : tbl + form)
- Reference: `template/screens/event-blocklists.html`

**Reference maquette:** `page-head` (h1 "Listes de blocage") ; `tabs` avec `tab active` (E-mails + `tag` compteur) et `tab` (Documents + `tag` compteur) ; sous chaque onglet un `tbl-wrap`/`tbl` : `cell-name mono` (email ou numero de piece), `cell-meta` (motif/date), `row-actions` `btn-icon` `trash-2` ; formulaire d'ajout au-dessus de la table.

**Composants:** `Tabs`, `Table`, `Tag`, `FormSection`/`Input`, `Button`, `Icon`, `Alert`/`EmptyState`.

**Steps:**
- [ ] **Step 1: Valider la decision d'URL** (voir ci-dessus) avec l'utilisateur. Consigner le choix dans le tracker avant de coder.
- [ ] **Step 2: Lire et preserver** les deux pages + les deux forms. Conserver **intactes** les requetes `prisma.blockedEmail.findMany` et `prisma.blockedDocument.findMany`, ainsi que les server actions d'ajout/suppression de chaque form. Aucune API modifiee.
- [ ] **Step 3: Reconstruire l'hote** `blocked-emails/page.tsx` : charger **les deux** listes, rendre un `page-head` "Listes de blocage" puis un `Tabs` a deux panneaux. Onglet "E-mails" -> `BlockedEmailsForm` (initial = emails) ; onglet "Documents" -> `BlockedDocumentsForm` (initial = documents). Chaque libelle d'onglet porte un `Tag` compteur. Extrait representatif :

```tsx
export default async function BlockedListsPage({ params }) {
  const { orgId, eventId } = await params;
  const [emails, documents] = await Promise.all([
    prisma.blockedEmail.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } }),
    prisma.blockedDocument.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Listes de blocage</h1>
      <Tabs
        tabs={[
          { id: "emails", label: <>E-mails <Tag>{emails.length}</Tag></>,
            content: <BlockedEmailsForm orgId={orgId} eventId={eventId} initial={serialize(emails)} /> },
          { id: "docs", label: <>Documents <Tag>{documents.length}</Tag></>,
            content: <BlockedDocumentsForm orgId={orgId} eventId={eventId} initial={serialize(documents)} /> },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 4: Gerer `blocked-documents/page.tsx`** selon la decision : `redirect(\`/admin/${orgId}/events/${eventId}/blocked-emails\`)` (option recommandee). Mettre a jour la nav du shell si elle listait deux entrees (une seule entree "Listes de blocage").
- [ ] **Step 5: Reskin interne** des deux forms (tbl + formulaire d'ajout) avec `Table`, `Input`, `Button`, `btn-icon` corbeille, `EmptyState` par onglet.
- [ ] **Step 6:** `make typecheck` — Expected: OK.
- [ ] **Step 7: Controle visuel** contre `event-blocklists.html` sur 375/768/1440. Verifier : `Tabs` fonctionnels (panneau visible/masque, ARIA `role="tab"`/`tabpanel`), compteurs, tables, suppression sur chaque onglet, redirect de l'ancienne route. Etats vides par onglet.
- [ ] **Step 8:** `make test` — Expected: vert (les tests des deux forms restent valides ; ajuster tout test qui pointait l'ancienne page `blocked-documents` s'il verifie l'URL — cause racine, pas contournement).

**Acceptance:** un seul ecran a onglets E-mails/Documents fidele a la maquette ; **les deux API inchangees** ; ajout/suppression fonctionnels sur chaque onglet ; redirect de l'ancienne route ; nav du shill coherente ; decision d'URL consignee ; typecheck + tests verts.

---

### Task 12: Scanner

Reskin du scanner QR plein cadre : `ScannerFrame` (reticle + laser) + `ScanResult` (valide/invalide), saisie manuelle de secours, historique de session. **Ne toucher aucune logique camera** de `QRScanner`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/scan/page.tsx` (titre seulement)
- Modify: `src/components/event/QRScanner.tsx` (reskin du rendu ; logique `html5-qrcode` et verification intactes)
- Reference: `template/screens/event-scanner.html`

**Reference maquette:** `page-head` (h1 "Scanner" + `tag` avec `dot ok` etat camera) ; `grid-2col` : `card card-pad` avec `scan-frame` (`grid-bg`, `scan-reticle` coins `tl/tr/bl/br`, `scan-laser` anime) ; `stack` de `scan-result valid` (`sr-ic check`, `sr-t`, mini badge du participant : `bc-photo`, `cat-pill`) + `card card-pad` saisie manuelle (`input-group` : `input mono` + `btn-secondary search`) + historique de session.

**Composants:** `Card`/`CardBody`, `ScannerFrame`, `ScanResult`, `SuccessRing`, `CatPill`, `Tag`, `Input`, `Button`, `Timeline` (historique de session), `Icon`.

**Steps:**
- [ ] **Step 1: Lire et preserver** `QRScanner.tsx` : initialisation `html5-qrcode`, gestion permissions camera, callback de scan, appel de verification (server action), gestion des resultats, historique de session en state. **Ne changer aucune de ces mecaniques.**
- [ ] **Step 2: Reconstruire le JSX** : `page-head` avec `Tag` d'etat camera (`dot ok`/rouge) ; `grid-2col` avec `ScannerFrame` (habille le `<div id="reader">` de `html5-qrcode` — le container conserve son id/ref) a gauche, et a droite : `ScanResult` (valid/invalid selon le dernier scan, avec mini apercu participant + `CatPill`), Card de saisie manuelle (`Input mono` + `Button` "Vérifier" cable sur le meme handler de verification), et un historique de session (Timeline des scans). Extrait representatif :

```tsx
<div className="grid gap-6 lg:grid-cols-2">
  <Card>
    <CardBody>
      <ScannerFrame>
        <div id="qr-reader" ref={readerRef} />{/* container html5-qrcode inchange */}
      </ScannerFrame>
    </CardBody>
  </Card>
  <div className="space-y-4">
    {lastScan && <ScanResult valid={lastScan.valid} name={lastScan.name} category={lastScan.category} />}
    <Card>
      <CardBody className="flex gap-2">
        <Input className="font-mono" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Code du badge" />
        <Button variant="secondary" onClick={() => verify(manualCode)}><Icon name="search" size={16} /> Vérifier</Button>
      </CardBody>
    </Card>
    <Timeline>{session.map((s) => <TimelineItem key={s.id} tone={s.valid ? "ok" : "danger"} title={s.name} meta={s.time} />)}</Timeline>
  </div>
</div>
```

- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-scanner.html` sur 375/768/1440 (roles OPERATOR + STAFF/ADMIN). Verifier : `ScannerFrame` (reticle coins + laser anime), `ScanResult` valid (emerald) vs invalid (rose), saisie manuelle, historique. **Tester la camera reellement** (autorisation, scan d'un QR de test, resultat) — ne pas affirmer sans preuve. Etat sans permission camera (message + saisie manuelle disponible).
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** scanner fidele (frame + result + saisie manuelle + historique) ; logique camera et verification intactes, testees en navigateur ; typecheck + tests verts.

---

### Task 13: Membres de l'evenement

Table des membres (avatar, nom, `RoleBadge`, actions) + Modal/formulaire d'invitation. Logica dans `MemberTable` / `MemberInviteForm`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/members/page.tsx`
- Modify: `src/components/event/MemberTable.tsx`, `MemberInviteForm.tsx` (reskin)
- Reference: `template/screens/event-members.html`

**Reference maquette:** `page-head` (h1 "Membres de l'événement") ; `card card-pad` d'invitation (`ds-label`, `flex gap12 wrap` : `input` email + `select-wrap` role + `btn-primary` Inviter `user-plus`) ; `tbl` : `avatar sm` + `cell-name`, `cell-meta`, `role-badge`, `row-actions`.

**Composants:** `Card`/`CardBody`, `Table`, `RoleBadge`, `Input`/`Select`, `Button`, `Modal` (si invitation en modale), `Icon`, `EmptyState`.

**Steps:**
- [ ] **Step 1: Lire et preserver** `MemberTable.tsx` / `MemberInviteForm.tsx` : liste des membres/roles effectifs, invitation (server action), changement de role, retrait, gardes `assertNotLastOwner`. Ne rien changer.
- [ ] **Step 2: Reconstruire le JSX** : Card d'invitation (`Input` email + `Select` role + `Button` Inviter), puis `Table` des membres (avatar initiales, nom + email, `RoleBadge` du role, actions changer role/retirer). Respecter le rendu de la maquette (avatar sm).
- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-members.html` sur 375/768/1440. Verifier : formulaire d'invitation wrap sur mobile, RoleBadge par tonalite (OWNER/ADMIN navy, OPERATOR green, etc.), actions. Etats : erreur d'invitation (Alert), liste vide.
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** membres fideles (invitation + table + RoleBadge) ; invitation/changement de role/retrait preserves ; typecheck + tests verts.

---

### Task 14: Parametres de l'evenement

Formulaire de reglages : FormSection "Informations", FormSection "Inscriptions" (ouverture + quota via Switch), FormSection "Contact (override)", lien vers les Listes de blocage. Logica dans `EventSettingsForm`.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/settings/page.tsx`
- Modify: `src/components/event/EventSettingsForm.tsx` (reskin)
- Reference: `template/screens/event-settings.html`

**Reference maquette:** `page-head` (h1 "Paramètres") ; `card card-pad` avec `form-section` "Informations" (`field` titre, `row-2` slug `mono` + date, lieu...), `form-section` "Inscriptions" (`between` : libelle + `switch track on` ouverture ; quota), `form-section` "Contact (override)" (`desc` + `row-2` email/telephone), lien vers Listes de blocage.

**Composants:** `Card`/`CardBody`, `FormSection`, `Switch`, `Input`, `Button`, `Icon`, `Alert`.

**Steps:**
- [ ] **Step 1: Lire et preserver** `EventSettingsForm.tsx` : chargement des reglages event, `registrationOpen`, quota, override contact (cascade `resolveSettings`), server action de sauvegarde. Ne rien changer a la cascade ni au submit.
- [ ] **Step 2: Reconstruire le JSX** : trois `FormSection` (Informations / Inscriptions / Contact override) habillant les `Input` existants ; `Switch` pour l'ouverture des inscriptions (branche sur `registrationOpen`) ; lien vers `blocked-emails` (hote des Listes de blocage — voir Task 11). Extrait representatif :

```tsx
<FormSection title="Inscriptions" description="Contrôle l'ouverture du formulaire public et le quota.">
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-600">Inscriptions ouvertes</span>
    <Switch checked={registrationOpen} onChange={setRegistrationOpen} label="Inscriptions ouvertes" />
  </div>
  <Input type="number" label="Quota d'inscriptions" value={quota} onChange={...} />
</FormSection>
```

- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-settings.html` sur 375/768/1440. Verifier : sections separees par bordures, Switch ouverture, override contact, lien blocklists. Etats : sauvegarde OK (Alert success), erreur validation.
- [ ] **Step 5:** `make test` — Expected: vert.

**Acceptance:** parametres fideles (3 FormSection + Switch + lien blocklists) ; cascade contact et sauvegarde preservees ; typecheck + tests verts.

---

### Task 15: Journal d'activite

Table du journal (type via `LogType`, auteur, cible, date) + Toolbar de filtres + Pagination ; **lignes cliquables** vers la vue detail d'entree de journal (reutilisee du sous-plan Staff 02). La variante OPERATOR (mes scans uniquement) est preservee.

**Files:**
- Modify: `src/app/admin/[orgId]/events/[eventId]/activity/page.tsx`
- Reference: `template/screens/event-log.html`
- Reuse: vue detail journal (`journal-detail.html`) livree par le sous-plan Staff (02)

**Reference maquette:** `page-head` (h1 "Journal d'activité" + `btn-ghost-sm` Exporter `download`) ; `toolbar wrap` (`search-input` + `chip-filter` Type `filter` / Periode `calendar` / Utilisateur `user`) ; `tbl` avec lignes `clickable` : `cell-meta mono` (horodatage), `log-type acces` (badge de type colore), `ld` (description), `cell-meta`, `chevron-right`.

**Composants:** `Toolbar`/`SearchInput`/`ChipFilter`, `Table`, `LogType`, `Pagination`, `Button`, `Icon`, `EmptyState`.

**Steps:**
- [ ] **Step 1: Lire et preserver** `activity/page.tsx` : garde de role (`STAFF`/`ADMIN`/`OPERATOR`), le `where` conditionnel OPERATOR (`userId` + `type: "BADGE_SCANNED"`), la requete `activityLog.findMany` (take 100). Ne rien changer aux requetes.
- [ ] **Step 2: Reconstruire le JSX** : `page-head` + bouton Exporter ; `Toolbar` avec `SearchInput` + `ChipFilter` (Type / Periode / Utilisateur) — cablage cote client si filtrage local, sinon presentation seule si le filtrage n'existe pas encore (ne pas inventer de requete). `Table` avec lignes cliquables : `LogType` (mappe `l.type` -> tonalite/libelle), auteur (`l.user`), cible, badge `staff` ambre si `l.staffActor`, date. `Pagination`. Chaque ligne pointe vers la vue detail journal (route partagee du sous-plan 02) via l'`id` du log.
- [ ] **Step 3:** `make typecheck` — Expected: OK.
- [ ] **Step 4: Controle visuel** contre `event-log.html` sur 375/768/1440 (roles ADMIN + OPERATOR). Verifier : `LogType` colore par famille, lignes cliquables (hover + chevron), Pagination, variante OPERATOR (uniquement ses scans). Etat vide (EmptyState "Aucune activité").
- [ ] **Step 5:** `make test` — Expected: vert. Si la vue detail journal du sous-plan 02 n'est pas encore disponible, laisser la ligne cliquable pointer vers une route existante ou differer le lien et passer la task en `[~]` avec note.

**Acceptance:** journal fidele (Toolbar + table LogType + Pagination) ; lignes cliquables vers la vue detail journal partagee ; variante OPERATOR intacte ; typecheck + tests verts.

---

## Self-Review

- **Couverture des 15 ecrans** : dashboard (T1), inscriptions liste (T2), detail (T3), creation (T4), vue agregee VIEWER (T5), badges liste (T6), impression batch (T7), apercu badge (T8), template badge (T9), categories (T10), blocklists fusionnees (T11), scanner (T12), membres (T13), parametres (T14), journal (T15). Les 15 ecrans de la correspondance spec sont couverts, un par task. ✓
- **Coherence composants (reutilisation directeur)** : chaque task consomme la bibliotheque directeur (`StatCard`/`MiniChart`/`QuotaBar` T1 ; `Toolbar`/`ChipFilter`/`BatchBar` T2/T6/T15 ; `Timeline`/`FileBox` T3/T12 ; `RadioCards`/`Dropzone` T4 ; `BadgeCard`/`MiniBadge` T7/T8/T9 ; `Tabs` T11 ; `ScannerFrame`/`ScanResult` T12 ; `RoleBadge` T13 ; `Switch`/`FormSection` T9/T14 ; `LogType` T15). Aucun re-balisage duplique ; `badge.css` jamais importe. La dependance directeur est declaree en tete. ✓
- **Shells & banniere par role preserves** : `layout.tsx` et les 4 shells ne sont pas modifies (sauf, dans T11, la nav qui fusionne deux entrees en une). Variantes OPERATOR (dashboard T1, journal T15) et VIEWER (overview T5, non nominatif ; banniere lecture seule) preservees et explicitement verifiees en revue visuelle. Ecrans PRINTER (T7) testes sous `EventPrinterShell`. ✓
- **Fusion blocklists coherente** : T11 fusionne l'UI en onglets `Tabs` avec un hote unique (`blocked-emails` recommande) + redirect de l'ancienne route, **sans toucher les deux API** (`blockedEmail`/`blockedDocument` charges cote hote, forms et server actions intacts). Point de decision d'URL explicite et a valider avant de coder. ✓
- **Scanner** : T12 reskine `QRScanner` (frame + result + saisie manuelle + historique) sans toucher la logique `html5-qrcode` ni la verification ; exigence de test camera reel en navigateur. ✓
- **Reskin strict** : aucune task n'ajoute de route (hors redirect T11) ni de logique metier ; data/RBAC/server actions preserves ; steps imposent `make typecheck` + controle visuel 3 viewports x etats x roles + `make test` vert. FR avec accents dans tout l'UI. ✓
