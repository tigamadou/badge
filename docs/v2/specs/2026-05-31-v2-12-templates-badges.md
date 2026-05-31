# Spec v2-12 — Templates de badges multi-faces

> **Statut** : conception validée — 2026-05-31
> **Type** : nouvelle feature (génération PDF de badge configurable par template)
> **Périmètre** : v2 uniquement
> **Spec maîtresse** : [`docs/v2/specs/2026-05-28-v2-master-design.md`](2026-05-28-v2-master-design.md)
> **Specs liées** :
> - [v2-04 Espace Événement](../features/espace-evenement.md) — la page de réglage du badge est ajoutée aux onglets event-admin
> - [v2-03 Espace Organisation](../features/espace-organisation.md) — l'OrgSettings reçoit le champ `badgeTemplateId`
> - [v2-02 Espace Staff applicatif](../features/espace-staff.md) — le PlatformSettings reçoit le défaut plateforme `badgeTemplateId`
> - [v2-11 Comptes participants](2026-05-31-v2-11-comptes-participants.md) — les données injectées dans le template viennent du snapshot Registration (qui lui-même vient du profil User)

## Contexte et objectifs

En v1, le rendu du badge PDF (`src/lib/badge-pdf.tsx`) est hardcodé : une seule mise en page, une seule face, des dimensions fixes. Si un client veut un badge recto-verso, un format différent, ou un style visuel distinct, il faut modifier le code et casser tous les autres usages.

Pour la v2 multi-tenant, plusieurs orgs partagent la même plateforme avec des besoins visuels différents :

- Orgs corporate : badge format carte CR80 (85,6 × 54 mm) à imprimer sur carte plastique.
- Orgs événementielles grand public : badge A6 ou A7 imprimé sur papier épais, avec face verso (planning, sponsors).
- Orgs avec branding fort : couleurs, polices, dispositions différentes.

Cette spec introduit un **registry de templates de badges** codés dans le code source (composants React-PDF), avec :

- **Sélection par event** via un champ Prisma, avec fallback en cascade `Event → Org → Platform`.
- **Multi-face** : chaque template déclare son nombre de pages PDF (1 = mono-face, 2 = recto/verso, etc.).
- **Format** : chaque template déclare ses dimensions de page (CR80, A6, custom).
- **Données standardisées** : tous les templates reçoivent le même `TemplateContext` (participant, catégorie, event, badge). Pas de custom fields au démarrage.
- **Catalogue ouvert** : tous les templates codés sont disponibles à tous les events (pas de whitelist par org au MVP).
- **Preview PNG statique** : chaque template embarque une image de preview pour la sélection par l'admin.

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Lieu des templates | Dans le code (`src/lib/badge-templates/`) | C'est du code de génération PDF (React-PDF), pas du contenu utilisateur. Le staff dev ajoute un template via PR. Pas d'éditeur visuel en BDD. |
| Niveau de sélection | Par event, avec cascade `Event → Org → Platform` | Cohérent avec le pattern de `resolveSettings()` déjà en place pour SMTP, branding, etc. L'org peut imposer un défaut, l'event peut overrider. |
| Multi-face | Propriété fixe du template (déclarée dans `meta.pages`) | Évite la combinatoire « ce template supporte-t-il le verso ? ». Si on veut le même design en mono et en recto-verso, on crée deux templates. |
| Données injectées | Jeu standard fixe (`TemplateContext`) | YAGNI custom fields. Les besoins courants (photo, nom, catégorie couleur, QR, event meta) couvrent 90% des cas. Si besoin de plus, on étendra le contexte de façon non-breaking. |
| Catalogue | Tous templates disponibles à tous les events | Pas de couche d'autorisation au MVP. Le code détermine ce qui existe. Si plus tard offres premium / templates clients dédiés, on ajoutera une whitelist par org. |
| Fallback | Template par défaut au niveau Platform (`PlatformSettings.badgeTemplateId`) | Aucun event ne se retrouve sans template. La cascade garantit qu'il y a toujours une valeur. Seed initialise à `'default-v1'`. |
| Preview pour l'admin | PNG statique embarqué à côté du template | Performance immédiate, pas de rendu PDF live. Le dev qui ajoute un template fournit la preview en même temps. |
| Format / dimensions | Variable, déclaré par chaque template | Le marché badge a plusieurs standards (CR80, A6, A7, etc.). Imposer un format unique briderait les usages. |
| Versioning des templates | Manuel par convention de nom (`default-v1`, `default-v2`) | Pas de mécanisme automatique. Si un template évolue de façon breaking, on crée `-v2` et on laisse `-v1` actif pour les events déjà configurés. |
| Génération PDF | Server-side via `@react-pdf/renderer` (inchangé v1) | Police Montserrat via Google Fonts conservée (cf. CLAUDE.md projet). |

---

## Section 1 — Registry de templates

### 1.1 Structure de fichiers

```
src/lib/badge-templates/
├── index.ts                 # registry + helpers (getTemplate, listTemplates)
├── types.ts                 # types TS : TemplateContext, TemplateMeta, BadgeTemplate
├── default-v1/
│   ├── template.tsx         # composant React-PDF (<Document>)
│   ├── meta.ts              # TemplateMeta
│   └── preview.png          # ~1024x648, copié dans /public au build (ou servi via route dédiée)
├── recto-verso-v1/
│   ├── template.tsx
│   ├── meta.ts
│   └── preview.png
└── ...
```

### 1.2 Types (`types.ts`)

```typescript
export type PageSize = {
  width: string;   // ex: '85.6mm', '105mm'
  height: string;  // ex: '54mm', '148mm'
};

export type TemplateMeta = {
  id: string;                  // ex: 'default-v1' — slug unique, kebab-case
  label: string;               // ex: 'Badge standard'
  description: string;         // 1-2 phrases
  pages: number;               // nombre de Pages PDF (>= 1)
  pageSize: PageSize;          // identique sur toutes les pages du template
  previewSrc: string;          // chemin relatif servi côté UI (ex: '/badge-previews/default-v1.png')
  version: number;             // 1, 2, 3 — incrémenté lors d'un changement breaking
};

export type TemplateContext = {
  participant: {
    firstName: string;
    lastName: string;
    photoDataUrl: string;      // data URL inlinée (Base64)
    structure: string;
  };
  category: {
    name: string;
    color: string;             // hex (ex: '#ff5500')
    neutralBadge: boolean;
    anonymous: boolean;        // si true, le template doit masquer nom/photo
  };
  event: {
    title: string;
    date: Date;
    location: string;
    logoDataUrl: string | null;
  };
  badge: {
    id: string;                // pour le QR
    verifyUrl: string;         // ex: 'https://badge.app/verify/<id>'
    qrCodeDataUrl: string;     // QR pré-rendu en data URL
  };
};

export type BadgeTemplate = {
  meta: TemplateMeta;
  Component: React.ComponentType<{ ctx: TemplateContext }>;
};
```

### 1.3 `index.ts` (registry)

```typescript
import { meta as defaultMeta } from './default-v1/meta';
import DefaultTemplate from './default-v1/template';
import { meta as rvMeta } from './recto-verso-v1/meta';
import RvTemplate from './recto-verso-v1/template';

export const BADGE_TEMPLATES = {
  'default-v1':      { meta: defaultMeta, Component: DefaultTemplate },
  'recto-verso-v1':  { meta: rvMeta,      Component: RvTemplate },
} as const satisfies Record<string, BadgeTemplate>;

export type BadgeTemplateId = keyof typeof BADGE_TEMPLATES;

export function getTemplate(id: string): BadgeTemplate | null {
  return (BADGE_TEMPLATES as Record<string, BadgeTemplate>)[id] ?? null;
}

export function listTemplates(): BadgeTemplate[] {
  return Object.values(BADGE_TEMPLATES);
}
```

### 1.4 Exemple `meta.ts` (`default-v1`)

```typescript
import type { TemplateMeta } from '../types';

export const meta: TemplateMeta = {
  id: 'default-v1',
  label: 'Badge standard',
  description: 'Badge mono-face format carte CR80 paysage, photo à gauche, infos à droite, QR en bas.',
  pages: 1,
  pageSize: { width: '85.6mm', height: '54mm' },
  previewSrc: '/badge-previews/default-v1.png',
  version: 1,
};
```

### 1.5 Exemple `template.tsx` (squelette `default-v1`)

```typescript
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import type { TemplateContext } from '../types';

export default function DefaultBadgeTemplate({ ctx }: { ctx: TemplateContext }) {
  return (
    <Document>
      <Page size={{ width: 85.6 * 2.83465, height: 54 * 2.83465 }}>
        {/* contenu : photo, nom, catégorie, QR — détaillé dans le plan d'implémentation */}
      </Page>
    </Document>
  );
}
```

(Note : `@react-pdf/renderer` veut des dimensions en points ; on convertit mm → pt côté template via constante locale.)

### 1.6 Preview PNG

- Chaque template embarque sa preview à côté de son code (`default-v1/preview.png`).
- Au build (ou via script `scripts/copy-badge-previews.ts` lancé par `prebuild`), les PNG sont copiés dans `public/badge-previews/` pour être servis statiquement.
- L'admin event voit la preview via `<img src={template.meta.previewSrc} />`.
- La preview doit montrer le rendu avec des données factices réalistes (nom plausible, photo placeholder, QR factice).

---

## Section 2 — Évolutions du modèle Prisma

### 2.1 `Event`

Ajout du champ :

```prisma
model Event {
  // ... champs existants
  badgeTemplateId String?   // null => fallback OrgSettings, puis PlatformSettings
}
```

### 2.2 `OrgSettings`

Ajout :

```prisma
model OrgSettings {
  // ... champs existants (smtp*, recaptcha*, branding*)
  badgeTemplateId String?
}
```

### 2.3 `PlatformSettings`

Ajout (NOT NULL avec défaut) :

```prisma
model PlatformSettings {
  // ... champs existants
  badgeTemplateId String  @default("default-v1")
}
```

### 2.4 Pas de FK BDD

Le `badgeTemplateId` est une string libre, pas une FK Prisma vers une table `BadgeTemplate`. Validation runtime via `getTemplate(id)` : si null, log warning + fallback Platform default + alerte staff. Détection au démarrage de l'app via `scripts/validate-badge-templates.ts` (lancé en CI) qui scanne toutes les valeurs persistées et vérifie qu'elles correspondent à un templateId du registry.

### 2.5 Migration au moment du dev v2

Aucune migration de données — la v2 part de zéro (décision spec maîtresse). Le seed initialise `PlatformSettings.badgeTemplateId = 'default-v1'`.

---

## Section 3 — Résolution en cascade

Le helper `resolveSettings(eventId?, orgId?)` (lib/settings.ts, défini en v2 master) est étendu pour inclure `badgeTemplateId` dans la cascade :

```typescript
function resolveBadgeTemplateId(
  event: Event | null,
  orgSettings: OrgSettings | null,
  platformSettings: PlatformSettings,
): string {
  return event?.badgeTemplateId
      ?? orgSettings?.badgeTemplateId
      ?? platformSettings.badgeTemplateId;  // garantie NOT NULL
}
```

Aucun cas où la cascade renvoie null. Si la valeur résolue ne match aucun templateId du registry, le code de génération PDF log l'erreur et fallback explicitement sur `'default-v1'` (template garanti présent dans le registry).

---

## Section 4 — UX pour la sélection du template

### 4.1 Côté event admin

Page `/admin/[orgId]/events/[eventId]/settings/badge` :

- Liste de cartes des templates disponibles (récupérés via `listTemplates()`).
- Chaque carte affiche : preview PNG, label, description, format (`pageSize`), nombre de faces (`pages`).
- Carte « sélectionnée » mise en évidence visuellement.
- Bouton « Utiliser le défaut de l'organisation » → set `Event.badgeTemplateId = null`.
- Indication en bas de page : « Template effectif : `<label>` (défini au niveau `<event | org | platform>`) ».

### 4.2 Côté org admin

Page `/admin/[orgId]/settings/badge` : idem, mais modifie `OrgSettings.badgeTemplateId`. Option « Utiliser le défaut plateforme » pour clear.

### 4.3 Côté staff applicatif

Page `/staff/settings/badge` : modifie `PlatformSettings.badgeTemplateId`. Pas d'option « hériter » (c'est la racine de la cascade).

### 4.4 RBAC

- Event-level : `requireEventPermission(eventId, 'event:settings:update')`.
- Org-level : `requireOrgRole(orgId, ['OWNER', 'MANAGER'])`.
- Platform-level : `requireStaff(['SUPER_ADMIN', 'STAFF_ADMIN'])`.

---

## Section 5 — Génération PDF

### 5.1 Route existante (v2-04)

Le rendu PDF du badge est déjà spécifié dans v2-04 (route `/api/admin/registrations/[id]/badge`). Cette spec en modifie l'implémentation :

```typescript
// pseudo-code
const registration = await loadRegistrationWithEventAndCategory(id);
const settings = await resolveSettings(registration.eventId, registration.event.orgId);
const templateId = settings.badgeTemplateId;  // déjà résolu en cascade

const template = getTemplate(templateId) ?? getTemplate('default-v1')!;

const ctx: TemplateContext = await buildTemplateContext(registration, template);
const stream = await renderToStream(<template.Component ctx={ctx} />);
return new Response(stream, { headers: { 'Content-Type': 'application/pdf', ... } });
```

### 5.2 `buildTemplateContext()`

Helper `src/lib/badge-templates/build-context.ts` :

- Charge la photo (`snapshotPhoto`) en data URL via `image-to-dataurl.ts` (helper existant).
- Charge le logo event (`event.logo`) en data URL si non-null.
- Génère le QR code via `qrcode.ts` (helper existant).
- Compose `TemplateContext` strict.

### 5.3 Multi-face

Aucune logique spéciale côté route ou helper : le template décide combien de `<Page>` rendre dans son `<Document>`. Le caller streame simplement le résultat.

### 5.4 Polices

Toutes les polices utilisées par les templates sont déclarées via `Font.register()` au niveau du module (chargement Google Fonts pour Montserrat, cf. CLAUDE.md garde-fou existant). Les templates utilisent ces polices ; pas de Font.register dans chaque template (évite les re-déclarations).

---

## Section 6 — Validation et tests

### 6.1 Test unitaire du registry

`src/lib/badge-templates/__tests__/registry.test.ts` :

- Chaque template :
  - a une preview PNG existante sur le disque (test fait un `fs.existsSync(meta.previewSrc)` après normalisation),
  - `meta.pages >= 1`,
  - `meta.id` correspond exactement à la clé du registry,
  - `meta.version >= 1`,
  - `meta.pageSize.width` et `meta.pageSize.height` matchent le pattern `/^\d+(\.\d+)?(mm|pt|in)$/`.
- `listTemplates().length >= 1`.
- `getTemplate('unknown')` retourne null.
- `getTemplate('default-v1')` retourne un objet avec `meta` et `Component`.

### 6.2 Test d'intégration de rendu

`src/lib/badge-templates/__tests__/render.test.ts` :

- Pour chaque template, appelle `renderToBuffer(<Component ctx={fakeCtx} />)` et vérifie :
  - le buffer n'est pas vide,
  - les premiers octets correspondent à `%PDF-`,
  - le nombre de pages PDF rendues matche `meta.pages` (via lib de parsing PDF léger ou regex sur le buffer).

### 6.3 Script CI `scripts/validate-badge-templates.ts`

Lancé en CI (job `unit` du workflow v3-03) : récupère toutes les valeurs `badgeTemplateId` persistées (`Event`, `OrgSettings`, `PlatformSettings`) et vérifie qu'elles existent dans le registry. Échec si une valeur orpheline est trouvée.

Note : ce script suppose l'accès à la BDD de test, donc tourne après `prisma db push`.

### 6.4 Test E2E (workflow Playwright)

`e2e/badge-template-selection.spec.ts` :

- Login admin event.
- Navigate `/admin/[orgId]/events/[eventId]/settings/badge`.
- Choisir un template autre que le défaut.
- Sauvegarde.
- Recharger la page : le template choisi est marqué comme sélectionné.
- (Optionnel) Générer un badge et télécharger le PDF, vérifier qu'il fait au moins X octets.

---

## Section 7 — Impacts sur les autres specs v2

| Spec | Impact | Action |
|---|---|---|
| `v2-04 espace-evenement.md` | Ajout onglet « Badge » dans les réglages event. Mise à jour route `/api/admin/registrations/[id]/badge` pour utiliser le registry. | Patch. |
| `v2-03 espace-organisation.md` | Ajout réglage « Template badge par défaut » dans OrgSettings UI. | Patch. |
| `v2-02 espace-staff.md` | Ajout réglage « Template badge par défaut plateforme » dans PlatformSettings UI. | Patch. |
| `v2-01 multi-tenancy-rbac.md` | Pas d'impact direct ; mais mentionner `event:settings:update` couvre la modification du template. | Vérification. |
| `v2-11 comptes-participants.md` (spec sœur) | Les snapshots Registration (photo, nom, etc.) sont les sources de données pour `TemplateContext`. Aucun changement de contrat. | Aucun. |

---

## Section 8 — Critères d'acceptation de l'implémentation

L'implémentation de cette spec est considérée terminée quand :

1. Le dossier `src/lib/badge-templates/` existe avec au moins 2 templates : `default-v1` (1 face CR80) et `recto-verso-v1` (2 faces, format au choix raisonnable).
2. Chaque template a une `preview.png` valide servie via `/badge-previews/[id].png`.
3. Les types `TemplateMeta`, `TemplateContext`, `BadgeTemplate` sont définis et exportés.
4. Le registry `BADGE_TEMPLATES` + helpers `getTemplate`, `listTemplates` fonctionnent et sont testés.
5. Le schéma Prisma reflète les ajouts §2 (`Event.badgeTemplateId`, `OrgSettings.badgeTemplateId`, `PlatformSettings.badgeTemplateId`).
6. `resolveSettings()` (ou un helper dédié `resolveBadgeTemplateId()`) renvoie toujours une valeur non-null.
7. La route `/api/admin/registrations/[id]/badge` utilise le registry, génère un PDF dont le nombre de pages matche `meta.pages` du template résolu.
8. Les pages `/admin/[orgId]/events/[eventId]/settings/badge`, `/admin/[orgId]/settings/badge`, `/staff/settings/badge` permettent la sélection et indiquent le template effectif.
9. Le script `scripts/validate-badge-templates.ts` existe et tourne en CI.
10. Les sous-specs `v2-02`, `v2-03`, `v2-04` sont mises à jour.
11. Le seed initialise `PlatformSettings.badgeTemplateId = 'default-v1'`.

---

## Section 9 — Hors périmètre (YAGNI explicite)

- **Éditeur visuel WYSIWYG de templates** côté UI : énorme chantier, pas de besoin business démontré.
- **Custom fields par event injectés dans le badge** : nécessite un sous-système complet (UI de définition, validation, persistence). À spec dédiée si demande.
- **Templates par catégorie** au sein d'un event (un badge VIP visuellement distinct du badge standard) : à reconsidérer une fois plusieurs clients réels sur la plateforme.
- **Templates premium / paywalled** (offres tarifaires) : pas avant un vrai modèle commercial.
- **Versioning automatique** des templates (rollback, A/B test) : versioning manuel par convention de nom suffit.
- **Génération multi-pages combinée** (plusieurs badges sur une même feuille A4 pour impression économique) : utile pour certains usages mais nécessite une logique de pagination distincte. À spec dédiée si besoin.
- **Templates client-spécifiques** chargés depuis une source externe (S3, CMS) : sécurité et maintenance trop lourdes pour le gain.
- **Rendu côté client** (preview live dans le navigateur) : `@react-pdf/renderer` peut le faire, mais coût bundle élevé. Le preview PNG figé suffit pour le MVP.
- **Whitelist de templates par org** : ajoutée plus tard si besoin de filtrer le catalogue.
- **Internationalisation des templates** (date, formats locaux) : tous les templates sont en français pour le MVP (langue projet par défaut). Si multi-langue, ajouter `locale` au `TemplateContext`.
