# Loader et toast sur les actions

> **Statut : livré** — spec [28 — feedback des actions](../specs/2026-10-24-28-v4-feedback-actions.md) · plan [feedback des actions](../plans/2026-10-24-feedback-actions.md) · contrat C4 : [socle du lot](lot-notifications-socle.md).

Chaque bouton qui déclenche une action asynchrone affiche un loader, se désactive pendant
l'exécution (un double clic ne part qu'une fois) et se termine par un toast de succès ou
d'erreur, ou par une redirection explicite. Aucune route API n'est modifiée.

## Primitives

| Primitive | Rôle |
|---|---|
| `src/lib/toast.ts` | `toastSuccess`, `toastError`, `toastApiError(source, fallback)`, `apiErrorMessage`, `ActionError`, `DEFAULT_ERROR_MESSAGE` |
| `src/hooks/useAsyncAction.ts` | `useAsyncAction(action, { success, error, onSuccess })` → `{ run, pending }`. Garde anti double clic par `useRef`. `run(...args)` transmet ses arguments à l'action (actions par ligne). |
| `Button` (`loading`, `variant="link"`) | `loading` désactive, pose `aria-busy` et affiche un spinner sans changer la largeur. `link` : sans fond ni padding, la couleur vient de `className`. |
| `Modal` (`confirmLoading`) | Le bouton de confirmation passe en `loading`. |
| `ActionButton` | Bouton d'action par ligne : loge le hook, prop `confirm` (annulation = ni requête ni toast). |

`<Toaster />` est monté dans le layout racine (`AppToaster`, en bas à droite) : un toast
survit à la navigation client et à la fermeture d'une modale.

### Message d'erreur : `apiErrorMessage`

Beaucoup de routes renvoient un **code** dans `error` (`NOT_FOUND`, `VALIDATION`,
`ORG_FORBIDDEN`, `Unauthorized`…) ou un message anglais. Le toast ne doit jamais l'afficher.
Ordre de priorité :

1. `ActionError` → son message (français, destiné à l'utilisateur) ;
2. `Response` → corps JSON : `message` (chaîne) s'il existe, sinon `error` s'il est lisible
   (contient une espace et n'appartient pas à `NON_USER_FACING_ERRORS`) ;
3. tout le reste (corps HTML d'un 500/502, `TypeError: Failed to fetch`, code technique) →
   le repli du composant, à défaut « Une erreur est survenue. Réessayez. ».

`NON_USER_FACING_ERRORS` (constante privée de `toast.ts`) liste les messages anglais relevés
dans `src/app/api` : `Rate limited`, `Not found`, `Missing orgId`, `Missing orgId or eventId`,
`Last OWNER cannot be removed`, `Bad request`. **Quand une route renvoie un nouveau message
anglais**, l'ajouter à cette liste (et son test dans `toast.test.ts`), ou traiter le cas dans
le composant avec un `ActionError`.

## Règles d'usage

- Toute action asynchrone déclenchée par un bouton passe par `useAsyncAction`.
- Succès : toast court au passé (« Inscription approuvée. »). Pas de toast si l'action
  redirige vers une page qui affiche déjà le résultat.
- Erreur : toast avec le message de l'API quand c'est une phrase lisible, sinon le repli.
- Les **erreurs de validation de formulaire** restent **sous les champs** (prop `error` d'`Input`).
  Un toast d'erreur général s'ajoute seulement si l'erreur n'est pas rattachée à un champ.
- Les actions longues (export de lot, `ProgressBar`) gardent leur barre de progression ; le
  bouton de lancement est désactivé pendant l'exécution.
- Les `Alert` éphémères qui doublonnent le toast sont supprimées ; les `Alert` permanentes
  (bandeaux d'information, état de la page, motif de rejet) restent.
- Les `confirm()` natifs restent ; les `alert()` natifs de fin d'action sont remplacés par des toasts.

## Convention d'échec

Dans l'action passée au hook : `if (!res.ok) throw res;`. Pour un message propre au composant,
`throw new ActionError("Impossible : c'est le dernier OWNER.")`. Le hook attrape l'exception et
appelle `toastApiError(err, options.error)`.

## Motifs

**A — bouton isolé**

```tsx
const archive = useAsyncAction(
  async () => {
    const res = await fetch(`/api/platform/organizations/${org.id}/archive`, { method: "POST" });
    if (!res.ok) throw res;
  },
  { success: "Organisation archivée.", error: "Échec de l'archivage.", onSuccess: () => router.refresh() },
);
<Button loading={archive.pending} onClick={archive.run}>Archiver</Button>
```

**B — formulaire sans erreur par champ** : `onSubmit={(e) => { e.preventDefault(); void save.run(); }}`
et `<Button type="submit" loading={save.pending}>`.

**C — formulaire avec erreurs par champ** : l'action renvoie `{ fieldErrors }` pour les codes
rattachés à un champ (`NUMBER_TAKEN`, `SLUG_TAKEN`…) et lève pour le reste ; `onSuccess` regarde
le résultat, remplit `fieldErrors` ou appelle `toastSuccess`. La validation côté client se fait
avant `run()` (aucune requête). Exemple : `CategoryForm`.

**D — action qui redirige** : un état `navigating` posé dans `onSuccess` avant `router.push`,
combiné à `pending` (`loading={action.pending || navigating}`) : sans lui le bouton redevient
cliquable pendant la navigation. Exemples : `OrgCreationForm`, `EventCreationWizard`, `LoginPage`.

**E — action par ligne** : `ActionButton` (confirm, loader par ligne) ; pour un `<select>` de
rôle, un composant de ligne appelle `useAsyncAction((role) => …)` et `run(role)`. Exemples :
`MembersClient`, `MemberTable`, `PlanManager`.

**F — upload** : l'indicateur en place (« Envoi… ») sert de loader ; une erreur donne un
`toastApiError` avec un repli propre au fichier ; pas de toast de succès (la `FileBox` affiche le fichier).

**G — action longue** : inchangée (`BadgeTemplateInstaller`, ZIP de lot) ; on vérifie que le
bouton est désactivé ou masqué pendant l'exécution.

## Hors migration

- `BadgeTemplateInstaller` (action longue déjà conforme) et `RegistrationTable` (lecture et
  export par navigation).
- `src/components/admin/TeamForm.tsx` n'est importé nulle part : code mort, non migré.
- Les chargements `GET` (listes, modèles chargés à l'ouverture d'une modale, polling de la cloche).

## Tests

- Unitaires : `src/lib/__tests__/toast.test.ts` (100 %), `src/hooks/__tests__/useAsyncAction.test.ts`,
  `Button`, `Modal`, `ActionButton`, `BatchBar`.
- E2E (`e2e/helpers/feedback.ts` : `toast`, `countRequests`, `failWith500Html`, `abortNetwork`) :
  `e2e/transverse/feedback-platform.spec.ts`, `feedback-org.spec.ts`, `feedback-event.spec.ts`,
  `feedback-public.spec.ts` — double clic (une seule requête), 500 HTML, réseau coupé, erreur
  sous le champ sans toast, annulation du `confirm`, toast sur 375 px.
