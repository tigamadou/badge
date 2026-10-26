# Spec v4 — Loader et toast sur toutes les actions

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : harmonisation UX transverse
> **Périmètre** : v4 — tous les composants clients qui déclenchent une action (quatre espaces + pages publiques)
> **Plan** : [`plans/2026-10-24-feedback-actions.md`](../plans/2026-10-24-feedback-actions.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md) — contrat C4
> **Source** : `Todo.md` du 2026-10-24, point 5

## Contexte

Environ 45 composants clients appellent l'API avec `fetch`. Le retour visuel varie :
certains désactivent le bouton, d'autres non ; certains affichent une `Alert`, d'autres
rien. Aucune bibliothèque de toasts n'est installée. On peut cliquer deux fois et
déclencher deux fois l'action.

## Objectif

Sur **toutes** les actions :

- un **loader dans le bouton** pendant l'exécution, bouton **désactivé** (pas de double
  clic) ;
- un **feedback** à la fin : toast de succès ou d'erreur.

## Conception

- Primitives fournies par le socle (contrat C4) : `sonner` + `<Toaster />`,
  `src/lib/toast.ts`, `Button` avec `loading`, hook `useAsyncAction`.
- **Règles d'usage** (à consigner dans `docs/v4/features/feedback-actions.md`) :
  - toute action asynchrone déclenchée par un bouton passe par `useAsyncAction` (ou, pour
    un formulaire, par un état `pending` équivalent branché sur `Button loading`) ;
  - succès : toast court au passé (« Inscription approuvée. ») ; pas de toast si l'action
    redirige vers une page qui affiche déjà le résultat ;
  - erreur : toast avec le message `error` renvoyé par l'API **quand c'est une phrase en
    français**. Beaucoup de routes y renvoient en fait un code (`NOT_FOUND`, `VALIDATION`,
    `ORG_FORBIDDEN`…) ou un message en anglais : ces valeurs sont filtrées côté client
    (`apiErrorMessage` dans `src/lib/toast.ts`), et le toast affiche alors un repli propre
    au composant, ou à défaut « Une erreur est survenue. Réessayez. ». Les routes ne sont
    pas modifiées dans ce lot ;
  - les **erreurs de validation de formulaire** restent affichées **sous les champs** (pas
    de toast à la place) ; un toast d'erreur général s'ajoute seulement si l'erreur n'est
    pas rattachée à un champ ;
  - les actions longues existantes (export de lot, `ProgressBar`) gardent leur barre de
    progression ; le bouton de lancement est désactivé pendant l'exécution.
- Les `Alert` d'erreur ou de succès **éphémères** qui doublonnent le toast sont
  supprimées ; les `Alert` **permanentes** (bandeaux d'information, état de la page)
  restent.
- Accessibilité : `aria-busy` sur le bouton pendant le chargement ; `sonner` annonce les
  toasts via une région `aria-live`.

## Périmètre du balayage

Le constructeur dresse l'**inventaire** des composants clients qui déclenchent une action
(recherche de `fetch(`, `router.refresh`, `onSubmit` dans `src/app` et
`src/components`), le consigne dans le plan, puis les migre **par espace** (`/platform`,
`/org`, `/event`, `/account`, pages publiques et auth).

**Exclusions** (cf. spec 22) : les fichiers possédés par les chantiers 23 à 27, qui
utilisent déjà les primitives. Après la fusion de tous les chantiers, une tâche finale
vérifie leur conformité.

## Critères d'acceptation

- Chaque bouton d'action de l'inventaire affiche un loader et se désactive pendant
  l'exécution ; un double clic rapide ne déclenche qu'une requête.
- Chaque action se termine par un toast (ou une redirection explicite), en succès comme en
  erreur, testé en coupant l'API (erreur 500) sur un échantillon par espace.
- Tests unitaires des composants migrés qui en ont déjà ; E2E existants verts (sélecteurs
  adaptés si une `Alert` est remplacée par un toast).
- Vérification navigateur par espace, à 375 px et 1280 px (les toasts ne masquent pas la
  navigation mobile).
