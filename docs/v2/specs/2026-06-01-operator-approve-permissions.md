# ADR — Permissions OPERATOR sur approve / reject / print

> **Statut** : proposition (en attente de validation pour intégration au plan v2-14)
> **Date** : 2026-06-01
> **Type** : décision design (suite audit `docs/v2/audit-implementation-2026-06-01.md` §2.4)
> **Périmètre** : v2
> **Specs liées** :
> - [v2-04 Espace Événement](../features/espace-evenement.md) — critère d'acceptation #2 (OPERATOR peut approuver/rejeter/imprimer)
> - [v2-01 Multi-tenancy RBAC](../features/multi-tenancy-rbac.md) — matrice de permissions par rôle

## 1. Contexte

L'audit du 2026-06-01 (§2.4) constate une **contradiction interne** entre trois sources :

| Source | Position |
|---|---|
| `src/lib/auth-helpers.ts:46-51` (`EVENT_PERMISSION_ROLES`) | OPERATOR autorisé sur `registration.approve`, `registration.reject`, `badge.print` |
| Spec `docs/v2/features/espace-evenement.md` critère #2 | OPERATOR peut approuver, rejeter, imprimer |
| Code routes `approve/route.ts`, `reject/route.ts`, `print/route.ts` | `minRole: "ADMIN"` → OPERATOR refusé (403) |
| Test `api-event-registrations.test.ts:248` | Vérifie explicitement que **OPERATOR ne peut pas approuver** (ancre le comportement code) |

Le code et le test divergent de la spec et de la matrice. Cette divergence n'est documentée nulle part comme décision explicite.

### Pourquoi cette divergence existe-t-elle probablement ?

Hypothèse plausible : pendant l'implémentation de v2-04, la sensibilité de l'action « approuver » (validation finale d'une inscription, impossible à défaire sans audit) a conduit à durcir par précaution. Le test a verrouillé ce comportement. Mais la matrice de permissions et la spec n'ont pas été mises à jour en conséquence.

## 2. Options envisagées

### Option A — Aligner le code sur la matrice / la spec *(retenue)*

- Routes `approve/route.ts`, `reject/route.ts`, `print/route.ts` : passer à `requireEventPermission(...)` au lieu de `minRole: "ADMIN"`.
- `approve` : permission `registration.approve` (ADMIN + OPERATOR).
- `reject` : permission `registration.reject` (ADMIN + OPERATOR).
- `print` (impression unitaire) : permission `badge.print` (ADMIN + OPERATOR + PRINTER).
- Mettre à jour les tests : `OPERATOR can approve (200)`, `OPERATOR can reject (200)`, `PRINTER can print (200)`.

**Pour / contre** :
- ✓ Cohérence : matrice = spec = code = tests.
- ✓ Le rôle OPERATOR retrouve son sens fonctionnel (agent terrain qui approuve, rejette, imprime sur place).
- ✓ Le rôle PRINTER retrouve son sens (impression dédiée).
- ⚠ Toute approbation OPERATOR est désormais possible — risque opérationnel (validation à la légère). **Mitigation** : audit `logActivity` continue de tracer qui approuve, avec `userId` + horodatage.

### Option B — Aligner la spec / la matrice sur le code

- Garder `minRole: "ADMIN"` sur les 3 routes.
- Modifier `EVENT_PERMISSION_ROLES` pour retirer OPERATOR de `registration.approve`, `registration.reject`, `badge.print`.
- Modifier le critère #2 de la spec.
- Conserver les tests « OPERATOR cannot approve (403) ».

**Pour / contre** :
- ✓ Aucune modification de code de production (seulement matrice + tests + doc).
- ✗ Vide le rôle OPERATOR de son sens. Il ne reste qu'avec `registration.checkin` (scan) — alors « OPERATOR » suggère un agent opérationnel plus large.
- ✗ Renomme implicitement OPERATOR en « SCANNER ». Si c'est le besoin métier, faire le renommage explicite.
- ✗ Brise la cohérence avec PRINTER (qui n'aurait alors aucune permission active).

### Option C — Distinguer OPERATOR « junior » / OPERATOR « senior »

- Garder OPERATOR sur scan/checkin uniquement.
- Introduire un nouveau rôle entre OPERATOR et ADMIN (ex. `MODERATOR`) pour approve/reject.
- ✗ Inflation du modèle RBAC. YAGNI au regard du besoin actuel.

## 3. Décision

**Option A retenue** : aligner le code sur la matrice et la spec.

Raisons :
1. La matrice `EVENT_PERMISSION_ROLES` et la spec `espace-evenement.md` sont la **source de vérité métier**. Le code doit refléter la spec, pas l'inverse.
2. Le rôle OPERATOR n'a pas de raison d'être si on l'ampute de approve/reject/print : il devient un simple SCANNER.
3. L'audit `logActivity` (en place, avec `userId`, `eventId`, horodatage, `staffActor` auto-calculé) couvre le risque opérationnel : si un OPERATOR approuve à tort, c'est tracé.
4. Si le besoin de durcissement réapparaît (validation à plusieurs yeux), la bonne réponse est une permission dédiée (ex. `registration.approve.bulk` ADMIN-only) ou un workflow de double validation, pas l'interdiction globale.

## 4. Impact

### 4.1 Routes à modifier
| Route | Avant | Après |
|---|---|---|
| `POST /api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve` | `minRole: "ADMIN"` | `requireEventPermission("registration.approve")` |
| `POST /.../registrations/[regId]/reject` | `minRole: "ADMIN"` | `requireEventPermission("registration.reject")` |
| `POST /.../registrations/[regId]/print` | `minRole: "ADMIN"` | `requireEventPermission("badge.print")` |

### 4.2 Tests à mettre à jour
Dans `src/app/api/__tests__/` :
- `OPERATOR cannot approve (403)` → `OPERATOR can approve (200)` + vérif log `REGISTRATION_APPROVED` avec `userId` = operator.
- Idem reject et print.
- Ajouter : `PRINTER can print (200)` (cas nouveau).
- Conserver : `VIEWER cannot approve (403)`, `VIEWER cannot print (403)`.

### 4.3 UI à vérifier
Les composants client qui conditionnent l'affichage des boutons "Approuver" / "Rejeter" / "Imprimer" doivent autoriser OPERATOR (et PRINTER pour print). À auditer dans :
- `src/components/event/RegistrationDetailActions.tsx` (ou équivalent)
- `src/components/event/BadgeListActions.tsx`
- Page `/admin/[orgId]/events/[eventId]/registrations/[regId]/page.tsx`

### 4.4 Documentation
- Ajouter en bas de `docs/v2/features/espace-evenement.md` une note référençant cet ADR : « cf. ADR 2026-06-01-operator-approve-permissions.md ».
- Aucune autre doc à modifier (matrice déjà cohérente).

## 5. Risque résiduel & mitigation

- **Risque** : un OPERATOR mal formé approuve des inscriptions invalides en masse.
- **Mitigation 1** : audit `ActivityLog` permet de détecter et corriger après coup (rejet + log inverse).
- **Mitigation 2** : possibilité future de bornage : `registration.approve.bulk` (impression batch > 10) réservé ADMIN, sans toucher à l'approbation unitaire.
- **Mitigation 3** : formation des opérateurs (hors scope technique).

## 6. Critères d'acceptation

- [ ] `POST /approve` retourne 200 pour OPERATOR avec membership event valide.
- [ ] `POST /reject` retourne 200 pour OPERATOR.
- [ ] `POST /print` retourne 200 pour OPERATOR et PRINTER ; refuse VIEWER (403).
- [ ] Toute approbation OPERATOR est tracée dans `ActivityLog` avec `userId`, `eventId`, `staffActor = false` (sauf si l'utilisateur est aussi staff).
- [ ] Les boutons UI correspondants sont visibles pour OPERATOR et PRINTER selon leurs permissions.
- [ ] Test unitaire / intégration mis à jour : aucun test ne dit encore que « OPERATOR cannot approve ».
