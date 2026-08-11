# Spec v4 — Parcours court : créer un compte et s'inscrire à un événement

> **Statut** : conception validée — 2026-08-11 — **à implémenter**
> **Type** : révision de parcours + révision d'un arbitrage antérieur
> **Périmètre** : v4
> **Source** : demande utilisateur du 2026-08-11
> **Révise** : [`2026-08-07-08-v4-validation-documents-staff-plateforme.md`](2026-08-07-08-v4-validation-documents-staff-plateforme.md) — le gate d'inscription y était placé en entrée ; il passe en sortie.

## Contexte et objectifs

Un visiteur qui découvre un événement sur `/e/<slug>` sans avoir de compte doit
aujourd'hui franchir **huit étapes et deux attentes bloquantes** avant d'être inscrit.
Deux défauts distincts se cumulent.

**Le fil vers l'événement est perdu trois fois.** `src/app/e/[slug]/page.tsx:107` émet bien
`/register?next=/e/<slug>/register`, mais `src/app/register/page.tsx` ne lit jamais ce
paramètre. Conséquences en chaîne : l'écran de confirmation propose « Retour à la
connexion », l'e-mail de vérification renvoie sur `/login` nu, et la page de vérification
n'a plus aucune trace de l'événement. L'utilisateur doit retrouver la page à la main —
alors même que l'intention était connue dès le premier clic.

**Le gate de profil bloque en amont.** `src/app/e/[slug]/register/page.tsx:64` exige
`profileStatus === "APPROVED"` : le participant qui vient de déposer ses pièces est
redirigé vers `/account/profile?pending=1` et doit attendre l'examen du staff plateforme
avant de pouvoir s'inscrire. Une attente humaine, de durée non bornée, tombe au milieu du
parcours d'un visiteur qui n'a encore rien obtenu.

Objectif : le nouvel arrivant s'inscrit sans quitter son élan, **même si son inscription
reste ensuite en attente de validation**.

## Décisions tranchées

| Sujet | Décision | Pourquoi |
|---|---|---|
| Gate d'inscription | Levé : `PENDING` et `APPROVED` ouvrent le droit de s'inscrire | L'inscription est un acte réversible et sans conséquence tant qu'elle n'est pas approuvée. Rien ne justifie de faire attendre le participant avant de l'enregistrer. Validé le 2026-08-11. |
| Profil `REJECTED` | Reste bloqué | Le participant doit d'abord resoumettre ses pièces, ce qui le repasse en `PENDING` et le débloque immédiatement. Évite d'accumuler des inscriptions non approuvables. |
| Approbation côté organisation | **Inchangée** : exige toujours `APPROVED` | Le gel spécifié au plan 08 devient la seule barrière. La sécurité est préservée : aucun badge n'est émis sans identité vérifiée. |
| Vérification e-mail | Reste bloquante pour le login | Anti-abus : sans elle, n'importe qui inscrit n'importe quelle adresse. La rupture est assumée, mais recollée par `next`. |
| Écrans profil et catégorie | Restent distincts, enchaînés automatiquement | Le paramètre `next` suffit à les enchaîner. Fusionner les deux formulaires coûterait un écran composite sans gain de temps réel pour l'utilisateur. |
| Transport de la destination | Dans l'URL du lien e-mail | Le lien peut être ouvert sur un autre appareil que celui de la création du compte : ni cookie ni session ne survivent. Un champ Prisma dédié coûterait une migration et un état résiduel à nettoyer. |

### Alternatives écartées

| Alternative | Statut | Raison |
|---|---|---|
| Ouvrir la session dès la création du compte, vérification e-mail en simple rappel | Non retenue | Supprimerait la seule barrière anti-abus à l'entrée. Un tiers pourrait créer des comptes sur des adresses qu'il ne contrôle pas et inscrire ces personnes à des événements. |
| Formulaire unique fusionnant profil et choix de catégorie | Non retenue | Le nombre de champs à remplir est identique ; seul le nombre d'écrans change. Coût UI réel, gain de parcours nul. |
| Autoriser aussi `REJECTED` à s'inscrire | Non retenue | Produirait des inscriptions que l'organisation ne pourra jamais approuver, à charge pour elle de les trier. |
| Persister la destination dans un champ `User.pendingNext` | Non retenue | Migration Prisma et état à invalider, pour un résultat identique à un paramètre d'URL. |

## Architecture cible

### Règle de gate

`src/lib/profile-review.ts` est, depuis le plan 08, le seul module autorisé à raisonner sur
`profileStatus`. La règle y prend la forme d'un prédicat pur :

```ts
export function canRegisterToEvent(status: ProfileStatus): boolean {
  return status === "PENDING" || status === "APPROVED";
}
```

Quatre points d'application, qui testent aujourd'hui `!== "APPROVED"` :

| Fichier | Rôle |
|---|---|
| `src/app/e/[slug]/register/page.tsx:64` | Redirection vers `/account/profile?pending=1` |
| `src/app/api/events/[slug]/register/route.ts:91` | Inscription publique |
| `src/app/api/account/registrations/[id]/resubmit/route.ts:65` | Resoumission d'inscription |
| `src/app/api/org/[orgId]/events/[eventId]/registrations/route.ts:135` | Création par le staff |

`…/registrations/[regId]/approve/route.ts:28` **n'est pas touché** : son 409 sur profil non
approuvé est exactement ce qui rend le gate amont superflu.

Le code d'erreur `PROFILE_NOT_APPROVED` devient impropre — il couvre désormais
`INCOMPLETE` et `REJECTED`, pas l'absence d'approbation. Il est renommé
`PROFILE_NOT_SUBMITTED`, avec son message français et le mapping de
`src/components/event/RegistrationActions.tsx:43`.

### Continuité de la destination

La destination voyage dans l'URL, de bout en bout :

```
/e/<slug>
  └─ « Créer un compte »      → /register?next=/e/<slug>/register
       └─ POST /api/auth/register { …, next }
            └─ e-mail          → /verify-email/<token>?next=/e/<slug>/register
                 └─ « Continuer mon inscription » → /login?callbackUrl=/e/<slug>/register
                      └─ gate profil → /account/profile/complete?next=/e/<slug>/register
                           └─ ProfileForm redirectTo → /e/<slug>/register
```

Les deux dernières flèches fonctionnent déjà. Les trois premières sont à câbler.

Toute lecture de `next` passe par un helper partagé `safeInternalPath(value): string | null`,
qui n'accepte qu'un chemin commençant par `/` et refuse les URL absolues et les
`//host` protocol-relative. Le motif existe déjà, dupliqué, à
`src/app/account/profile/complete/page.tsx:31` ; il aura quatre appelants.

### Messages d'attente

Quand `profileStatus === "PENDING"`, la page de succès `/e/<slug>/success` et le détail
`/account/registrations/[id]` indiquent que les pièces sont en cours de vérification et que
l'inscription sera examinée ensuite. Le bandeau de statut de
`src/app/account/profile/page.tsx` est réutilisé — pas de nouveau composant.

## Sécurité

Le déplacement du gate ne relâche aucune garantie : aucun badge ne peut être émis sans
profil `APPROVED`, puisque l'approbation de l'inscription reste verrouillée. Ce qui change,
c'est uniquement le moment où le participant apprend qu'il doit attendre — après avoir été
enregistré, plutôt qu'avant.

Le paramètre `next` est une entrée utilisateur : il traverse une URL publique et se
retrouve dans un e-mail. `safeInternalPath()` est donc une validation de frontière au sens
strict, et le rejet doit être silencieux (repli sur la destination par défaut), jamais une
erreur exposant la valeur reçue.

## Tests

**Unitaires** — le seuil de couverture reste à 100 % sur `src/lib/**` et `src/app/api/**` :

- `canRegisterToEvent` sur les quatre statuts.
- `safeInternalPath` : chemin interne accepté ; `https://evil.example`, `//evil.example` et
  chaîne vide refusés.
- Routes touchées : `PENDING` → succès, `REJECTED` → 403, `INCOMPLETE` → 403.
- `POST /api/auth/register` : `next` interne propagé jusqu'au lien de l'e-mail, `next`
  externe ignoré sans erreur.
- Non-régression : `approve` renvoie toujours 409 tant que le profil n'est pas `APPROVED`.

**E2E** — le parcours complet d'un nouvel arrivant n'est aujourd'hui couvert qu'en
fragments : `event-register.spec.ts:20` vérifie seulement que le bouton « Créer un compte »
est visible, et tous les autres tests créent l'utilisateur directement en base via
`createTestUser()`, avec `profileStatus = "APPROVED"` par défaut (`e2e/helpers/db.ts:135`).

Nouveau `e2e/public/event-register-newcomer.spec.ts`, deux tests :

1. `/e/<slug>` → « Créer un compte » → formulaire → lien récupéré via
   `e2e/helpers/mailpit.ts` → vérification → login → profil complété avec les fixtures
   `awa-photo.jpg` et `awa-cni.pdf` → catégorie → `/success`. Assertions en base :
   inscription `PENDING`, `profileStatus = PENDING`.
2. Le staff approuve le profil depuis `/platform/profiles/<userId>`, puis l'organisation
   peut approuver l'inscription — et ne le pouvait pas à l'étape précédente.

Toutes les briques nécessaires existent (helpers `mailpit`, `db`, `auth`, fixtures) : il
s'agit de câblage, pas de nouvel outillage.

## Documentation impactée

- `docs/v4/features/validation-profils.md` — la description du gate.
- `docs/v4/architecture.md` — le parcours d'inscription.
- `docs/v4/specs/2026-08-07-08-…md` — note de révision datée sur les lignes 24-25 : le gate
  d'entrée y était un arbitrage explicite, révisé ici en connaissance de cause.
