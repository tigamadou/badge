# Impression pendant l'évènement

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-11-01-35-v4-impression-pendant-l-evenement.md`](../specs/2026-11-01-35-v4-impression-pendant-l-evenement.md).
> Il prolonge les [commandes d'impression et devis](impression-demandes.md) (spec 33) et le
> [paiement des devis](paiements-fedapay.md) (spec 34).

## État actuel

Une commande d'impression de type `ONSITE` (« Pendant l'évènement ») fait imprimer les badges **au
fil de l'eau, à l'accueil**, par un opérateur de la plateforme, pour les participants déjà inscrits
et approuvés. Le participant présente son **QR d'accueil** ; l'opérateur le saisit ou le scanne au
**poste d'impression**, vérifie la fiche et imprime. Chaque impression est journalisée et alimente
un **compteur** borné par un **plafond** (commande + marge). À la clôture, les badges commandés
mais non imprimés deviennent un **crédit** pour l'organisation ; les badges imprimés au-delà de la
commande donnent une **commande complémentaire**.

Il n'y a pas d'inscription ni d'approbation sur place, et aucun pilote d'imprimante : l'impression
reste celle du navigateur (PDF du badge ouvert dans un onglet).

| Écran | Rôle | Droits |
|---|---|---|
| `/platform/settings?tab=onsite-print` (« Impression sur place ») | Templates adaptés, note de l'imprimante, marge par défaut | `STAFF_ADMIN` (onglet masqué sinon) |
| `/event/[eventId]/print/new` | Option « Pendant l'évènement », désactivée si le template n'est pas adapté | Permission `print.request` |
| `/account/registrations/[id]` | Carte « QR d'accueil » d'une inscription approuvée | Le participant |
| `/platform/print/orders/[requestId]` | Bloc compteur, accès au poste, marge, crédit | Lecture : tout le staff ; poste : `STAFF_SUPPORT` ; marge et crédit : `STAFF_ADMIN` |
| `/platform/print/orders/[requestId]/onsite` | Poste d'impression | `STAFF_SUPPORT` minimum |

## Réglages

Onglet « Impression sur place » de `/platform/settings` (`PlatformSettings`, lus par
`getOnsitePrintSettings`) :

| Réglage | Colonne | Détail |
|---|---|---|
| Templates proposés | `onsitePrintTemplateIds` (JSON) | Cases à cocher sur **toutes les versions non archivées** des templates installés (une version est figée : c'est elle qu'un évènement utilise) |
| Imprimante (note) | `onsitePrinterNote` | Texte libre (500 caractères), affiché sur le poste d'impression |
| Marge par défaut (%) | `onsiteDefaultMarginPercent` | Entier de 0 à 100, 10 par défaut ; copiée dans chaque nouvelle commande à l'envoi |

Route : `PATCH /api/platform/settings/onsite-print` (`STAFF_ADMIN`). Le formulaire refuse une marge
hors de 0 à 100 (« Saisir un entier entre 0 et 100. ») avant tout envoi. Le catalogue
`/platform/badge-templates` et les sélecteurs de template affichent le pictogramme « Impression sur
place » sur les templates de la liste.

## Éligibilité du template

Une nouvelle version d'un template n'est **pas** adaptée d'office : l'admin doit l'ajouter à la liste.

- **Assistant** : `GET /api/org/[orgId]/events/[eventId]/print-requests/onsite-eligibility` compare
  le **template effectif** de l'évènement (celui que la commande copiera, repli compris) à la liste.
  Si le template n'y figure pas, l'option « Pendant l'évènement » est désactivée et l'assistant
  affiche « Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place. » avec le
  lien « Changer le modèle de badge » (`/event/[eventId]/settings/badge`). Pendant le chargement
  l'option est aussi désactivée ; une erreur réseau ne la bloque pas (le serveur refuse de toute
  façon). Le type « En amont » n'en dépend jamais.
- **Envoi** : `prepareOnsiteSubmission` refuse un template inadapté (`409 ONSITE_TEMPLATE_UNSUITABLE`)
  et fige la marge par défaut **du moment** dans `PrintRequest.marginPercent`. Une modification
  ultérieure du réglage ne touche pas les commandes déjà envoyées.
- **Changement de template après l'envoi** : si l'organisateur choisit ensuite un template non
  adapté, la commande affiche une alerte des deux côtés (`OnsiteTemplateAlert`) et le staff ne peut
  plus **envoyer son devis** (`assertOnsiteCanAdvance`, dans `sendQuote`). Le template est figé au
  paiement : depuis `PAID`, plus rien n'est bloqué (production, mise à disposition, clôture) ; l'alerte
  reste affichée. Le refus et l'annulation restent permis. Les commandes en amont, complémentaires et les brouillons ne sont pas
  concernés (`onsiteTemplateStatus` vaut `NOT_APPLICABLE`).

## QR d'accueil

Dès l'approbation, le participant reçoit un QR code qui encode **le même lien `/verify/<ID
d'inscription>`** que celui du badge (`registrationVerifyUrl`). Il est fourni pour tout évènement,
qu'une commande sur place existe ou non.

- **Email d'approbation** (`sendStatusNotification`) : bloc « Votre QR d'accueil » avec l'image
  hébergée `/api/public/qr/<ID>` (les clients mail bloquent les images `data:`), l'ID en clair et un
  lien vers « Voir mon inscription ». La route publique ne répond (PNG) que pour une inscription
  `APPROVED` (`404` sinon), est limitée à 300 requêtes par minute et par IP (les proxys d'images des clients mail rejouent
  beaucoup de requêtes ; un `429` porte `Retry-After`, en secondes), et ne contient aucune
  donnée personnelle.
- **Compte participant** : la page `/account/registrations/[id]` affiche la carte « QR d'accueil »
  (image, ID, « À présenter à l'accueil, sur votre téléphone ou imprimé. ») pour une inscription
  approuvée, et rien pour une inscription en attente ou rejetée.

## Poste d'impression

Depuis le détail d'une commande `PAID`, `IN_PRODUCTION` ou `READY`, le bouton « Ouvrir le poste
d'impression » mène à `/platform/print/orders/[requestId]/onsite` (retour à la commande pour les
autres statuts ou un rôle inférieur à `STAFF_SUPPORT`). Le poste affiche la note de l'imprimante, le
compteur, la caméra (désactivable) et un champ « Nom, email, ID ou contenu du QR ».

**Identifier le participant.**

- *Scan* : le composant `QrCamera` (extrait du scanner de contrôle d'accès) décode le QR.
- *Saisie* : une saisie qui contient `/verify/` est lue comme le contenu d'un QR
  (`POST …/onsite/lookup`, `parseRegistrationQr` extrait l'ID, qui peut aussi être saisi seul) ;
  sinon, au moins deux caractères lancent une **recherche** par nom, prénom, email ou début d'ID
  (`GET …/onsite/search`, 20 résultats au plus, `%` et `_` cherchés tels quels).
- *Fiche* : photo, nom, email, catégorie, aperçu du badge, bouton « Imprimer ».

**Refus** (message affiché au-dessus de la fiche ; rien n'est écrit en base) :

| Cas | Code | Message |
|---|---|---|
| Inscription d'un autre évènement | `404 FOREIGN_EVENT` | « Ce QR ne correspond pas à cet évènement. » |
| Inscription inconnue | `404 REGISTRATION_NOT_FOUND` | « Inscription introuvable. » |
| Inscription non approuvée | `409 NOT_APPROVED` | « Inscription non approuvée (en attente) : le poste n'approuve personne. » (ou « refusée ») |
| Commande ni payée, ni en production, ni prête (`loadOnsiteRequest`, recherche, lecture du QR) | `409 REQUEST_NOT_PRINTABLE` (brouillon : `404 NOT_FOUND`) | « Cette commande n'est pas ouverte à l'impression. » (l'écran du poste renvoie à la fiche de la commande) |
| Commande sans ligne de badges | `409 REQUEST_NOT_PRINTABLE` | Pas de repli sur la quantité estimée : sans commande à honorer, le poste n'imprime pas |
| Plafond atteint | `409 CAP_REACHED` | Bouton « Imprimer » désactivé et « Plafond atteint : seules les réimpressions restent possibles. » |

**Impression.** « Imprimer » (`POST …/onsite/print`) ouvre l'onglet du PDF depuis le clic (sinon le
navigateur bloque la fenêtre), crée une ligne de journal `PrintRequestPrint` (`requestId`,
`registrationId`, `printedById`, `printedAt`, `reprint`), passe l'inscription à `badgePrinted` /
`badgePrintedAt` comme l'action existante, puis envoie la notification et l'email « badge imprimé »
(la première impression seulement ; l'échec de l'email ne bloque rien). La transaction prend les
verrous dans l'ordre évènement puis commande : deux postes ne dépassent jamais le plafond.

**Réimpression.** Une impression est une réimpression **seulement si le journal du poste
(`PrintRequestPrint`) contient déjà une impression de cette inscription pour cette commande**
(`printedOnsite` sur la fiche, calculé sous verrou à l'impression). Elle est journalisée avec
`reprint = true`, **ne compte pas** et reste possible au plafond ; la fiche affiche « Déjà imprimé le … »
et ne propose que « Réimprimer ». `badgePrinted` ne sert qu'à l'avertissement « déjà imprimé le … » :
un badge marqué imprimé **ailleurs** (par l'organisateur) affiche l'avertissement « hors du poste :
cette impression sera comptée » ; la confirmation (`confirmReprint`) reste demandée, mais l'impression
est une **première impression** : elle est comptée et bloquée au plafond (`CAP_REACHED`). Si le badge est
imprimé entre le scan et le clic (autre poste), la fiche est rechargée.

## Compteur et marge

Le compteur (`computeOnsiteCounter`, composant `OnsiteCounterCard`, affiché des deux côtés dès le
paiement) ne lit que le journal : `imprimés / commandés`, plafond et marge.

- **Commandé** : la quantité de la ligne produit de badges de la commande (voir « Règles de
  comptage »), à défaut la quantité estimée de la commande.
- **Plafond** = commande + marge, arrondi à l'entier supérieur : 200 badges à 10 % donnent 220.
- **Niveaux** : normal ; **90 % de la commande atteinte** (avertissement) ; **au-delà de la commande**
  (« 12 badges au-delà de la commande, facturés après l'évènement ») ; **plafond atteint**
  (« Plafond atteint (220) : l'impression est bloquée »).
- **Relever la marge** : `STAFF_ADMIN`, sur le détail de la commande, formulaire « Marge d'impression »
  (`PATCH …/onsite/margin`, 0 à 100 %). Le **motif est obligatoire** (3 caractères au moins) ; il
  entre dans le fil (« Marge : 10 % → 20 % (motif) ») et le journal d'activité
  (`PRINT_REQUEST_MARGIN_RAISED`, le nom reste celui de l'énumération même pour une baisse). Une marge
  qui ramènerait le plafond sous le nombre déjà imprimé est refusée
  (`409 MARGIN_BELOW_PRINTED`) ; une marge inchangée n'écrit rien ; une commande terminée ou annulée ne
  se règle plus (`409 REQUEST_LOCKED`).

## Clôture

Le passage de la commande à `COMPLETED` (« Terminée », par le staff) appelle `closeOnsiteInTx` **dans
la même transaction** : si la clôture échoue, la commande reste `READY` et peut être clôturée de
nouveau. Elle est idempotente (un résultat déjà produit est relu, jamais recréé) et ne concerne que
les commandes sur place **sans parent** (une commande complémentaire ne produit ni crédit ni surplus).
Les deux issues s'excluent :

| Situation | Issue |
|---|---|
| Imprimés < commandés | **Crédit** : `(commandés − imprimés) × prix unitaire effectif`, versé à l'organisation (mouvement `EARNED`, entrée « badges non utilisés » au fil). 200 commandés à 1 500 FCFA, 170 imprimés : 45 000 FCFA |
| Imprimés > commandés | **Commande complémentaire** liée (`parentRequestId`), créée directement en `QUOTED` : une ligne « Badges supplémentaires » (surplus × prix unitaire effectif, quantité verrouillée), marge à 0. 200 commandés, 212 imprimés : 12 badges |
| Imprimés = commandés, ligne gratuite ou absente | Rien |

**Prix unitaire effectif.** `unitPrice × min(1, (total accepté + crédit dépensé) / somme des lignes
positives actives)`, arrondi à l'entier (`effectiveUnitPrice`) : une remise du staff n'est pas recréditée
comme si les badges avaient été payés plein tarif (remise de −150 000 sur 200 × 1 500, rien imprimé :
crédit de 150 000, pas 300 000). Le crédit dépensé est la valeur absolue du mouvement `SPENT` de la
commande. Sans total accepté, le prix de la ligne est conservé ; un prix effectif arrondi à 0 ne donne
ni crédit ni surplus.

L'admin peut ajuster la commande complémentaire avant envoi (crédit compris) ; l'OWNER l'accepte et la
paie comme tout devis, mais **l'organisateur ne peut ni l'annuler ni la modifier** (`409 REQUEST_LOCKED`) :
c'est une quantité ferme issue du journal. Le staff garde le refus. La clôture elle-même
(`COMPLETED` sur une commande sur place) exige `STAFF_ADMIN` (`403 STAFF_FORBIDDEN` pour `STAFF_SUPPORT`) ;
les journaux et notifications d'après commit ne la défont jamais en cas d'échec. Des liens croisés (`RelatedRequestLinks`) relient la commande, son complément et son parent des
deux côtés. Le surplus n'est donc facturé qu'à la clôture, jamais en cours d'évènement. Une commande
en amont et une commande sur place peuvent coexister sur un même évènement (aucun contrôle ajouté).

## Crédit d'impression

Le crédit est un montant en **FCFA** par organisation (`OrgPrintCredit`) : des mouvements `EARNED`
(positifs, à la clôture) et `SPENT` (négatifs, au paiement). Le **solde** est leur somme ; le
**disponible** en retire les crédits déjà réservés par des devis en cours. Un seul mouvement `EARNED`
et un seul `SPENT` par commande (contrainte unique `[requestId, kind]`) ; le mouvement survit à la
suppression de la commande (`requestId` passe à `NULL`). La carte « Crédit d'impression » (solde et
mouvements) s'affiche côté organisation et côté staff.

- **Proposition** : l'assistant (récapitulatif) indique le crédit disponible de l'organisation ;
  l'équipe Badge l'applique.
- **Application** : `STAFF_ADMIN`, bouton « Appliquer le crédit » (ou « Modifier le crédit ») sur une
  commande `SUBMITTED` ou `QUOTED` (`POST …/credit`). Le dialogue propose le plus grand montant
  applicable (`min(disponible, total hors crédit)`). Le crédit devient une ligne `DISCOUNT`
  « Crédit d'impression » (`usesOrgCredit`), verrouillée pour l'organisateur
  (`CREDIT_LINE_LOCKED`) ; la commande repasse `SUBMITTED` si elle était `QUOTED`. Refus :
  `CREDIT_INSUFFICIENT` (au-delà du disponible), `CREDIT_EXCEEDS_TOTAL` (au-delà du total des autres
  lignes), `REQUEST_LOCKED` (autre statut). Si l'organisateur baisse ensuite ses quantités sous le
  crédit appliqué, l'avertissement s'affiche et l'envoi du devis est refusé (`NEGATIVE_TOTAL`).
- **Dépense au paiement** : le solde ne baisse **qu'au paiement** du devis (`markPaid`, en ligne ou
  hors ligne : mouvement `SPENT`, entrée « Crédit d'impression décompté »). Avant, le crédit est
  seulement *réservé* : il n'est plus disponible pour une autre commande.
- **Retour à l'annulation** : une commande annulée ou refusée avant paiement ne réserve plus rien ;
  le crédit redevient disponible sans mouvement. Une commande payée ne se rembourse pas.
- Le crédit appliqué ne dépasse jamais le total du devis ; le reste demeure au solde.

## Règles de comptage

1. **Seule la première ligne de badges d'un devis compte** pour le compteur, le crédit et le surplus.
   C'est la première ligne produit `BADGE` active ; les autres lignes de badges et les accessoires
   sont ignorés (`findOrderedBadgeLine`). Le crédit et le surplus utilisent le prix unitaire de cette
   ligne (suppléments d'options compris).
2. **Une réimpression est une impression déjà faite AU POSTE pour cette commande** (journal
   `PrintRequestPrint`). Un badge marqué imprimé par l'organisateur ou par une commande en amont puis
   imprimé au poste pour la première fois est **compté** et bloqué au plafond : sinon l'organisateur
   marquerait tout « imprimé » pour obtenir des badges hors compteur et un crédit. Le compteur lit le
   journal du poste, premières impressions seulement.
3. **Ordre des lignes** : à position égale, la ligne de badges retenue est la première par identifiant.

## Droits

| Action | Rôle minimal |
|---|---|
| Réglages de l'onglet « Impression sur place » | `STAFF_ADMIN` |
| Poste : recherche, lecture du QR, impression, réimpression | `STAFF_SUPPORT` |
| Relever ou baisser la marge, appliquer le crédit | `STAFF_ADMIN` |
| Lire la commande, le compteur et le crédit | Tout le staff ; côté organisateur, `print.request` |
| Envoyer une commande sur place | `print.request` (template adapté requis) |

## Fichiers du code

| Chemin | Contenu |
|---|---|
| `src/lib/print-requests/onsite.ts` | `OnsiteError`, éligibilité, accroche d'envoi, statut du template |
| `src/lib/print-requests/onsite-counter.ts` | Compteur, plafond, ligne de badges commandée |
| `src/lib/print-requests/onsite-station.ts`, `onsite-station-view.ts` | Recherche, lecture du QR, impression, marge ; libellés et refus du poste |
| `src/lib/print-requests/close-onsite.ts` | Clôture : crédit ou commande complémentaire |
| `src/lib/print-requests/org-credit.ts`, `credit-view.ts` | Crédit : solde, application, dépense ; libellés |
| `src/lib/registration-qr.ts`, `src/app/api/public/qr/[registrationId]/route.ts` | QR d'accueil |
| `src/components/staff/OnsitePrintSettingsForm.tsx` | Onglet des réglages |
| `src/components/staff/print/Onsite*.tsx`, `RequestCreditPanel.tsx`, `ApplyCreditDialog.tsx` | Poste, bloc de la commande, marge, crédit (staff) |
| `src/components/print/Onsite*.tsx`, `OrgPrintCreditCard.tsx`, `RelatedRequestLinks.tsx` | Compteur, alerte, crédit, liens (communs) |
| `e2e/platform/print-request-onsite.spec.ts` | Poste, refus, plafond, marge |
| `e2e/platform/settings.spec.ts`, `e2e/event/print-new.spec.ts` | Réglages, assistant |
| `e2e/public/account-registration.spec.ts`, `e2e/event/registration-detail.spec.ts` | QR d'accueil (compte, email) |

## Limites connues

- Le poste ne pilote aucune imprimante : l'opérateur imprime le PDF depuis le navigateur. Une seule
  imprimante sur place est prévue.
- Pas d'inscription ni d'approbation sur place : seuls les participants déjà approuvés sont servis.
- Le surplus n'est facturé qu'à la clôture ; le crédit n'est pas remboursable.
- Les e2e ne couvrent pas la caméra : le contenu du QR est saisi dans le champ de recherche. La
  clôture et le crédit sont couverts par les tests unitaires et d'intégration.
- Un badge imprimé ailleurs puis imprimé au poste consomme du stock réel : il est compté (voir « Règles de comptage »).
- L'énumération d'activité garde le nom `PRINT_REQUEST_MARGIN_RAISED` pour tout changement de marge.
