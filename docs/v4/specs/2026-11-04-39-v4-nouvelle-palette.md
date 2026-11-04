# Spec v4 — Nouvelle palette « Deep Navy & Soft Gold »

> **Statut** : validée — 2026-11-04 — plans rédigés et relus, en attente du lancement
> **Type** : refonte visuelle (couleurs uniquement)
> **Périmètre** : v4 — site public, pages publiques d'évènement et d'authentification, panel
> (plateforme, organisation, évènement), compte, e-mails, reçu de paiement
> **Plans** (exécution par vagues, voir « Organisation du travail ») :
> - Vague 1 : [`plans/2026-11-04-1-socle-nouvelle-palette.md`](../plans/2026-11-04-1-socle-nouvelle-palette.md)
> - Vague 2 (parallèle) : [`plans/2026-11-04-2a-palette-public-emails.md`](../plans/2026-11-04-2a-palette-public-emails.md),
>   [`plans/2026-11-04-2b-palette-plateforme-impression.md`](../plans/2026-11-04-2b-palette-plateforme-impression.md),
>   [`plans/2026-11-04-2c-palette-org-evenement-compte.md`](../plans/2026-11-04-2c-palette-org-evenement-compte.md)
> - Vague 3 : [`plans/2026-11-04-3-fusion-et-pr-palette.md`](../plans/2026-11-04-3-fusion-et-pr-palette.md)

## Contexte

L'interface utilise un bleu `#004d74` (en-tête et menus) et un vert d'accent `#16a34a`
(boutons, liens, lien actif). Ces couleurs sont surtout écrites en dur : environ 360 classes
Tailwind `green-*` / `emerald-*` (dont ~230 dans `src/components`), la variable
`--color-brand-navy` et quelques valeurs hexadécimales dans le HTML des e-mails, des
notifications et du reçu. Les e-mails transactionnels (`src/lib/mail.ts`) utilisent un
troisième ton, l'indigo `#4f46e5`. Les pages publiques alternent fonds blancs et fonds gris
(`bg-slate-50`/`100`).

L'utilisateur adopte une nouvelle palette et veut, à terme, un design minimaliste. Ce
chantier se limite aux **couleurs** ; l'allègement des écrans viendra plus tard.

## Décisions (validées par l'utilisateur le 2026-11-04)

### Palette

| Rôle | Nom | Valeur |
|------|-----|--------|
| Identité principale | Bleu marine | `#081558` |
| Accent premium | Or doux | `#F4B942` |
| Actions positives | Turquoise | `#16B8A6` |
| Survol, sélection, fonds secondaires | Gris bleuté | `#F5F7FC` |

1. **Le marine remplace** le bleu `#004d74` partout, et le vert d'accent sur les boutons
   principaux, les liens dans le texte et le contour de focus.
2. **Le turquoise remplace** le vert pour les actions positives (Approuver, Valider, Payer…) et
   les états réussis (Approuvé, Payé, Validé, messages de succès).
3. **L'or** sert d'accent premium : repère du lien actif du menu, plan mis en avant sur
   `/tarifs`, mentions « Pro ». Jamais pour une action.
4. **Le rouge des erreurs ne change pas.** Le gris neutre (`slate`) reste la couleur du texte
   courant et des bordures.
4 bis. **« En attente » et avertissement se distinguent nettement.** « En attente » passe à l'or
   (§8). Les avertissements quittent l'ambre, trop proche de l'or, pour un orange franc :
   texte `#C2410C`, fond `#FFF1E6` (classes `orange-700` / `orange-50`). Chaque usage actuel
   d'`amber-*` est classé selon son rôle (statut en attente → or ; avertissement → orange).

### Pages publiques

5. Site public (`(marketing)`), pages publiques d'évènement (`/e/...`), authentification
   (connexion, inscription, mot de passe, vérification) : le bleu actuel devient le marine ;
   **tous les fonds gris deviennent blancs**. Les sections sombres (en-tête, pied de page,
   bandeau d'appel à l'action) restent sombres, en marine.

### Panel et compte (variante B, couleurs seulement)

6. Fond de page **blanc**. Menu latéral **blanc**, séparé du contenu par un trait fin
   (`#EEF1F8`) ; liens en gris bleu (`#5A6285`), lien actif en marine sur fond gris bleuté avec
   un **trait or** à gauche. Le menu mobile suit les mêmes couleurs.
7. Bouton principal plein **marine**, texte blanc. Bouton d'action positive plein **turquoise**,
   texte **marine** (le blanc sur turquoise n'est pas lisible).
8. Les pastilles de statut gardent leur forme ; réussi = fond turquoise pâle, texte turquoise
   foncé ; en attente = fond or pâle, texte or foncé.
9. **La structure ne change pas** : cartes, icônes, contenus, mises en page et espacements
   restent tels quels.

### E-mails et documents HTML

10. Les e-mails (`src/lib/mail.ts`, `src/lib/notifications/notify.ts`, `src/app/api/contact`)
    et le reçu de paiement (`src/components/payments/receipt.ts`) passent sur la palette :
    bouton marine, liens marine, succès turquoise foncé. Ils gardent leurs valeurs hexa en
    ligne (les clients mail ne lisent pas les variables CSS), centralisées dans une constante
    partagée.

### Lisibilité (contraintes de contraste, WCAG AA)

| Couple | Ratio | Usage permis |
|--------|-------|--------------|
| blanc sur marine | 16,7 | tout |
| marine sur turquoise | 6,7 | texte de bouton |
| blanc sur turquoise | 2,5 | **interdit** pour du texte |
| marine sur or | 9,4 | texte de bouton ou de badge |
| or sur blanc | 1,8 | **interdit** pour du texte ; trait, point, fond seulement |
| turquoise foncé `#0E7C70` sur blanc | 5,1 | texte de succès |
| or foncé `#8A5A00` sur blanc | 5,9 | texte « en attente » |
| orange `#C2410C` sur `#FFF1E6` | 4,7 | texte d'avertissement |
| gris bleu `#5A6285` sur blanc | 6,0 | liens du menu |

## Choix de conception

- **Variables centrales** dans `src/app/globals.css` (`@theme`) : `navy`, `gold`, `turquoise`,
  `mist` (gris bleuté) et leurs déclinaisons (`navy-hover`, `turquoise-strong`,
  `turquoise-soft`, `gold-strong`, `gold-soft`, `line`, `nav-muted`), exposées comme couleurs
  Tailwind (`bg-navy`, `text-turquoise-strong`…). Les anciennes variables (`--brand-navy`,
  `--brand-green`, `--accent*`, `--color-brand-navy`) sont supprimées après migration.
- **Remplacement des classes en dur** : chaque `green-*` / `emerald-*` / bleu de marque est
  remplacé selon son **rôle** (bouton principal → marine ; succès → turquoise ; lien → marine),
  pas mécaniquement par teinte. Un test de garde-fou (lecture des sources) échoue si une classe
  `green-*`, `emerald-*` ou la valeur `#004d74` réapparaît dans `src/` hors exceptions listées.
- **Exceptions** : données métier colorées (couleurs de catégories, couleurs du catalogue
  d'impression, couleurs choisies par l'utilisateur), templates de badges et moteur PDF,
  seeds — non concernés.
- **Référence visuelle** : la page `/styleguide` est mise à jour en premier et sert de
  contrôle.

## Arbitrages (choix de l'agent, à relire)

- **Valeurs dérivées** : `navy-hover` `#121F6E`, `turquoise-strong` `#0E7C70` (texte de succès
  et survol du bouton turquoise), `turquoise-soft` `#E3F7F4`, `gold-strong` `#8A5A00`,
  `gold-soft` `#FFF4DC`, avertissement `#C2410C` sur `#FFF1E6`, `line` `#EEF1F8`, `nav-muted` `#5A6285`. Bouton désactivé : opacité
  actuelle conservée. Bouton secondaire : bordure `line`/`slate-300`, texte marine. Bouton
  destructif : rouge inchangé. Focus : contour marine partout, or sur fond marine.
- **Marine ou turquoise pour une action** : le bouton principal d'une page ou d'un formulaire
  (Enregistrer, Créer, Envoyer, Payer) est marine. Le turquoise est réservé aux décisions
  positives sur un élément existant (Approuver, Valider, Accepter le devis, Marquer payé) et aux
  états réussis.
- **Autres bleus** (`blue-*`, `sky-*`, `indigo-*` en classes, indigo des e-mails) : les liens et
  accents passent au marine ; les blocs « information » passent en fond `mist`, texte marine.
  Les `teal-*` passent en turquoise. Le garde-fou couvre aussi `amber-`, `blue-`, `sky-`,
  `indigo-`, `teal-`, `#004d74` et `#4f46e5`, ainsi que les anciennes variables (`--brand-navy`,
  `--brand-green`, `--accent`).
- **Fonds** : dans le panel, le fond de page passe en blanc ; les cartes gardent leur bordure
  actuelle (pas d'ombre ajoutée) ; les zones internes en `bg-slate-50`/`100` (en-têtes de
  tableau, encarts) passent en `mist`. Sur les pages publiques, toutes les zones grises passent
  en blanc, les sections se séparent par un trait fin `line`.
- **Menu latéral clair** : nom de la marque en marine, avatar et badges de rôle en `mist` texte
  marine, déconnexion en `nav-muted`. Le bandeau staff (`banner`) reste une bande marine, texte
  blanc, pour signaler l'espace staff.
- **Liens sur fond marine** (site public) : blancs ; lien actif souligné d'un trait or.
- **Garde-fou** : test Vitest `src/__tests__/palette-guard.test.ts` qui lit `src/**/*.{ts,tsx,css}`
  hors `__tests__`, avec exceptions par chemin : `src/lib/badge-templates/**`,
  `src/components/staff/print/SheetPreview.tsx` (couleurs de planches), et les champs de
  couleur saisis par l'utilisateur (sélecteurs de couleur de catégorie/catalogue). Les seeds
  (`prisma/`) ne sont pas lus. Les tests existants qui vérifient des classes en dur
  (`Labels.test`, `BatchBar.test`…) sont mis à jour.

## Organisation du travail

Chantier `nouvelle-palette`, branche d'intégration **`feat/nouvelle-palette`** (depuis
`development`). Méthode : skill `chantier`. Sous-agents sur Sonnet (`model: "sonnet"`).

- **Vague 1 — socle** (dossier principal) : tout ce que les lots consomment.
  - `src/app/globals.css` : variables et couleurs Tailwind (`navy`, `navy-hover`, `gold`,
    `gold-strong`, `gold-soft`, `turquoise`, `turquoise-strong`, `turquoise-soft`, `mist`,
    `line`, `nav-muted`, `warn`, `warn-soft`), focus, `.legal-prose`. Les anciennes variables
    restent définies jusqu'à la fusion (les lots en dépendent encore) ; la vague 3 les supprime.
  - `src/lib/brand-colors.ts` : constantes hexa pour le HTML en ligne (e-mails, reçu).
  - `src/components/ui/**` (boutons, badges de statut, feedback, labels, onglets, pagination…),
    `src/components/layout/**` (AppShell, MobileNav, UserAvatar), `src/components/staff/StaffShell.tsx`,
    `src/components/platform/PlatformOrgShell.tsx`, et toute la navigation partagée :
    `src/components/admin/SidebarNav.tsx` (utilisé par StaffShell et OrgShell),
    `src/components/admin/OrgShell.tsx`, `src/components/event/Event{,Viewer,Operator,Printer}Shell.tsx`,
    `src/components/public/AccountNav.tsx` : menu latéral clair, fond blanc.
  - `src/app/styleguide/**` : référence visuelle mise à jour.
  - Contrat : les lots n'utilisent que les couleurs du socle et les composants `ui` ; ils ne
    modifient ni `globals.css` ni `src/components/ui|layout`.
- **Vague 2 — lots** (parallèles, fichiers exclusifs, tests associés inclus) :
  - **2a — public, authentification, e-mails, paiements** : `src/app/(marketing)/**`,
    `src/components/marketing/**`, `src/components/public/**`, `src/app/e/**`, `src/app/login/**`,
    `src/app/register/**`, `src/app/forgot-password/**`, `src/app/reset-password/**`,
    `src/app/setup-password/**`, `src/app/verify/**`, `src/app/verify-email/**`,
    `src/app/select/**`, `src/components/auth/**`, `src/lib/mail.ts`, `src/lib/mail-helpers.ts`,
    `src/lib/notifications/**`, `src/app/api/contact/**`, `src/components/payments/**`.
  - **2b — espace plateforme et impression** : `src/app/platform/**`, `src/components/staff/**`
    (sauf `StaffShell.tsx`), `src/components/print/**`, `src/components/platform/**` (sauf
    `PlatformOrgShell.tsx`), `src/components/notifications/**`.
  - **2c — organisation, évènement, compte** : `src/app/org/**`, `src/app/event/**`,
    `src/app/account/**`, `src/components/event/**`, `src/components/admin/**`,
    `src/components/badge/**`, et tout autre dossier de `src/components/**` non attribué
    ci-dessus.
- **Vague 3 — fusion et PR** : ordre 2a → 2b → 2c ; suppression des anciennes variables ; test
  garde-fou `src/__tests__/palette-guard.test.ts` ; vérification complète et contrôle visuel ;
  push et PR vers `development` (sans fusion).
- Exceptions jamais modifiées : `src/lib/badge-templates/**`,
  `src/components/staff/print/SheetPreview.tsx` (couleurs de planches), couleurs de données
  (catégories, catalogue, seeds, fixtures e2e).

### Table de contrôle

| Paire | Partagé | Verdict |
|-------|---------|---------|
| socle → 2a/2b/2c | couleurs Tailwind, composants `ui`, shells | contrat figé par le socle |
| 2a ↔ 2c | `src/components/payments/**` utilisé dans `/org/.../payments` | à 2a seul ; 2c n'y touche pas |
| 2b ↔ 2c | `src/components/notifications/**` | à 2b seul |
| 2a ↔ fusion | anciennes variables CSS | supprimées en vague 3 seulement |
| socle ↔ 2c | `SidebarNav`, `OrgShell`, shells d'évènement | navigation partagée → socle ; 2c n'y touche pas |
| socle ↔ 2a | `src/components/public/AccountNav.tsx` | navigation → socle ; 2a n'y touche pas |
| socle → 2a | `src/lib/brand-colors.ts` | export `BRAND` (+ type `BrandColor`), clés camelCase |

### Journal des arbitrages (relecture croisée des plans, 2026-11-04)

- Navigation regroupée dans le socle (homogénéité du menu clair) ; tâche 1 du lot 2c abandonnée.
- Contrat `brand-colors.ts` : l'export s'appelle `BRAND` (le plan 2a disait `BRAND_COLORS`, corrigé).
- `Button` gagne une variante `positive` (turquoise, texte marine) ; `RoleBadge` gagne un ton `warn`.
- Focus or sur fond marine via `data-surface="navy"`.
- En-tête du site public : déjà blanc, il le reste ; lien actif marine souligné or. Pied de page et
  bandeau d'appel à l'action en marine.
- Pastilles neutres `bg-slate-100` conservées (le `mist` est trop pâle pour une pastille).
- Bandeau staff d'`EventShell` : de l'ambre à une bande marine.
- Repères de l'éditeur de gabarits (zone utile, emplacements) : marine et turquoise.
- Séries neutres des mini-graphiques en marine ; quota sain en turquoise ; puce « système » du
  journal en or.
- Garde-fou : test local du socle (`src/components/ui/__tests__/palette-socle.test.ts`) dès la
  vague 1, test global (`src/__tests__/palette-guard.test.ts`) en vague 3. Le nettoyage des restes
  en vague 3 est l'objet même du chantier (pas une modification de prod pour faire passer un test).
- Vague 1 (socle) : `sidebar-classes.ts` porte les classes du menu clair (liens, groupes, compteur,
  bandeau) pour tous les shells ; `Button` gagne `positive` (ActionButton aussi) ; `RoleBadge` garde
  `green` (turquoise) et `amber` (or) et gagne `warn` ; `data-surface="navy"` pour le focus or ;
  `MiniChart` et la progression en marine (séries neutres) ; `QuotaBar` sain en turquoise,
  >= 75 % en `warn` ; bloc « Après » du `Diff` du journal en turquoise pâle ; `AccountNav`,
  `SidebarNav`, `OrgShell` et shells d'évènement migrés par le socle.

## Hors périmètre

- Allègement des écrans (icônes, informations secondaires, regroupements, suppression des
  cartes) : chantier ultérieur.
- Templates de badges, moteur `@tigamadou/pdf-engine`, planches d'impression.
- Mode sombre.
- Logo et favicon.

## Vérification

- `make lint && make typecheck && make test` verts ; le test de garde-fou des couleurs vert.
- e2e existants verts (aucune structure ne change ; les sélecteurs par rôle/texte tiennent).
- Contrôle visuel à 375, 1024 et 1280 px : accueil, `/tarifs`, une page `/e/...`, connexion,
  un écran de chaque espace (plateforme, organisation, évènement, compte), un e-mail dans
  Mailpit, le reçu.
