# Spec v4 — Impression pendant l'évènement

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : nouvelle fonctionnalité
> **Périmètre** : v4 — paramètres plateforme (onglet « Impression sur place »), assistant de demande d'impression, poste d'impression staff, email d'approbation et compte participant (QR d'accueil)
> **Plan** : à rédiger
> **Chantier** : service d'impression, spec 5 sur 5 — voir aussi les specs
> [31](2026-11-01-31-v4-gabarits-et-planches-d-impression.md),
> [32](2026-11-01-32-v4-catalogue-produits-d-impression.md),
> [33](2026-11-01-33-v4-demandes-d-impression-et-devis.md),
> [34](2026-11-01-34-v4-paiement-des-devis-d-impression.md)

## Contexte

La spec 33 prévoit deux types de demandes d'impression : **en amont** (`ADVANCE`, les badges
sont imprimés avant l'évènement, sur planches) et **pendant l'évènement** (`ONSITE`). Le
second couvre les participants qui arrivent sur place : leurs badges sont imprimés au fil de
l'eau, à l'accueil.

Aujourd'hui, Badge sait déjà imprimer un badge à l'unité (PDF ouvert dans le navigateur) et
exporter un lot pour imprimante à badges (ZIP). Le rôle d'évènement `PRINTER` et la
permission `badge.print` existent. Rien ne distingue un template « adapté » à l'impression
sur place : `InstalledBadgeTemplate` n'a ni catégorie ni type.

## Objectif

Un organisateur peut commander une impression **pendant** son évènement, à condition que son
template de badge s'y prête, et suivre ce qui a été imprimé par rapport à ce qui a été
commandé.

## Décisions (validées par l'utilisateur le 2026-11-01)

1. Deux types d'impression : en amont et **pendant l'évènement**.
2. L'impression pendant l'évènement **exige un template de badge adapté**.
3. **C'est un opérateur de la plateforme qui imprime sur place** (2026-11-01).
4. **Les badges non utilisés ne sont pas remboursés**, ils deviennent un **crédit** pour les
   prochaines demandes de l'organisation (2026-11-01).
5. **Une imprimante sur place** (2026-11-01).
6. **Le template adapté se définit dans les paramètres des impressions sur place**
   (2026-11-01).
7. **Le crédit est un montant en FCFA** (2026-11-01).
8. **Dépassement : on prévoit une marge, et on facture aussi** (2026-11-01) : l'opérateur
   peut imprimer au-delà de la quantité commandée, dans la limite d'une marge, et les badges
   en plus sont facturés.
9. **Le badge à imprimer est trouvé au scan** d'un QR code présenté par le participant
   (2026-11-01).
10. **Pas d'inscription sur place** (2026-11-01) : seuls les participants déjà inscrits et
    approuvés reçoivent un badge.

## Choix de conception (arbitrages de l'agent, à relire)

### Templates adaptés

- **Réglé dans les paramètres de l'impression sur place** (décision 6) : nouvel onglet
  « Impression sur place » de `/platform/settings` (ajouté à `PLATFORM_SETTINGS_TABS`,
  `STAFF_ADMIN`), où l'admin désigne les **templates de badge adaptés** à l'imprimante
  utilisée sur place, choisis parmi les templates installés. Il peut y noter l'imprimante
  (modèle, format de support) à titre d'information.
- Stockage : `PlatformSettings.onsitePrintTemplateIds` (JSON, liste d'identifiants
  `InstalledBadgeTemplate`). Les templates étant figés par version, une nouvelle version d'un
  template n'est adaptée que si l'admin l'ajoute (arbitrage de l'agent).
- Le catalogue des templates (`/platform/badge-templates`, sélecteurs org et évènement)
  affiche un pictogramme « Impression sur place » sur les templates de la liste.
- L'assistant de demande (spec 33) ne propose le type « Pendant l'évènement » que si le
  **template effectif** de l'évènement figure dans la liste des templates adaptés ; sinon il l'affiche désactivé
  avec un lien vers le réglage du template de l'évènement.
- La demande copie le template à l'envoi (spec 33). Si l'organisateur change ensuite de
  template pour un template non adapté, la demande `ONSITE` affiche une alerte des deux côtés
  et le staff ne peut plus avancer son statut tant que ce n'est pas réglé.

### La demande sur place

- Pas de liste de badges figée : l'organisateur indique une **quantité estimée** de badges,
  les **jours et horaires** d'impression sur place, le **lieu exact** (adresse, salle) et un
  contact sur place.
- Les lignes du devis portent sur la quantité estimée (support, accessoires) et sur des
  **lignes de service** ajoutées par l'admin (déplacement, présence d'un opérateur,
  location d'imprimante…).
### Identifier le participant (décisions 9 et 10)

- **Constat** (2026-11-01) : le QR code n'existe aujourd'hui que **sur le badge imprimé**
  (lien `/verify/<ID d'inscription>`, `build-context.ts`). L'email d'approbation n'en
  contient pas : sur place, le participant n'aurait rien à présenter.
- **QR d'accueil** : dès l'approbation, le participant reçoit son QR code — **le même lien
  `/verify/<ID>`** que celui du badge — dans l'email d'approbation et sur sa page
  d'inscription (`/account/registrations/[id]`), avec son ID d'inscription en clair. Il le
  présente sur son téléphone ou imprimé. Le QR est fourni pour tout évènement (pas seulement
  ceux qui ont une demande sur place), ce qui reste cohérent avec celui du badge (arbitrage
  de l'agent).
- **Poste d'impression de l'opérateur** : depuis la demande, dans l'espace staff,
  `/platform/print/requests/[requestId]/onsite`. L'opérateur **scanne** le QR avec le
  scanner existant (`QRScanner`, celui du contrôle d'accès) ; à défaut (téléphone déchargé,
  email perdu), il **recherche** par nom, email ou ID d'inscription. La fiche s'affiche :
  photo, nom, catégorie, aperçu du badge ; « Imprimer » ouvre le PDF du badge (comme
  aujourd'hui) et marque le badge imprimé en un geste. Droit : staff `STAFF_SUPPORT` minimum.
- **Contrôles** :
  - le QR ou la recherche doit désigner une inscription **de cet évènement** ; sinon refus
    (« ce QR ne correspond pas à cet évènement ») ;
  - inscription non `APPROVED` : refus, avec son statut affiché ; **aucune inscription ni
    approbation n'est possible depuis le poste** (décision 10) ;
  - badge déjà imprimé : avertissement « déjà imprimé le … » ; l'opérateur peut réimprimer
    (journalisé `reprint`, non compté).
- **Journal d'impressions** `PrintRequestPrint` : `requestId`, `registrationId`,
  `printedById`, `printedAt`, `reprint` (booléen). Chaque impression faite depuis ce poste y
  est rattachée ; elle met aussi à jour `badgePrinted` / `badgePrintedAt` comme l'action
  existante. Le compteur ne lit que ce journal : les impressions faites par l'organisateur
  lui-même ou par une demande en amont n'y entrent pas.
- **Compteur** sur la page de la demande (des deux côtés) : badges imprimés / quantité
  commandée, avec une alerte à 90 % et au dépassement. Une réimpression sur place (badge
  raté) est journalisée `reprint` et ne compte pas (arbitrage de l'agent).

### Crédit des badges non utilisés

- À la clôture d'une demande `ONSITE` (`COMPLETED`), Badge calcule les badges non utilisés :
  quantité commandée − badges imprimés (hors réimpressions), si positif.
- Ils sont versés au **crédit de l'organisation**, **en FCFA** (décision 7) : badges non
  utilisés × prix unitaire de la ligne du support `BADGE` payée (suppléments d'options
  compris ; les accessoires, déjà fournis, n'entrent pas dans le crédit — arbitrage de
  l'agent). Nouveau modèle `OrgPrintCredit` : mouvements datés en FCFA, avec la demande
  d'origine, et solde ; visible par l'organisation et le staff.
- Le crédit est **proposé à l'envoi de la prochaine demande** et appliqué par l'admin dans le
  devis comme une ligne `DISCOUNT` liée au crédit ; le solde baisse au **paiement** de ce
  devis (pas à l'envoi), et revient si la demande est annulée avant paiement.
- Le crédit appliqué ne peut pas dépasser le total du devis ; le reste demeure au solde.

### Marge et dépassement

- **Marge** : un pourcentage par défaut réglé dans l'onglet « Impression sur place »
  (ex. 10 %), copié dans la demande à l'envoi et modifiable par l'admin dans le devis. Plafond
  d'impression = quantité commandée + marge (arrondi à l'unité supérieure).
- Au-delà de la quantité commandée, le poste d'impression continue jusqu'au plafond et
  l'indique (« 12 badges au-delà de la commande, facturés après l'évènement »). Au plafond,
  il **bloque** ; l'admin peut relever la marge de la demande (motif obligatoire, entrée du
  fil, audité) pour continuer. (Interprétation de l'agent : la marge autorise l'impression
  sans bloquer, elle n'est pas offerte. À confirmer.)
- **Facturation du surplus** : à la clôture (`COMPLETED`), si des badges ont été imprimés
  au-delà de la quantité commandée, Badge crée une **demande complémentaire** liée
  (`PrintRequest.parentRequestId`) avec une ligne « Badges supplémentaires » (nombre × même
  prix unitaire que le support payé), directement en `QUOTED`. L'admin peut l'ajuster avant
  envoi ; l'OWNER l'accepte et la paie comme tout devis (spec 34). Le crédit éventuel de
  l'organisation est proposé dessus.
- Surplus et crédit s'excluent : une demande produit soit un crédit (moins de badges que
  commandé), soit une demande complémentaire (plus de badges), soit rien.

## Questions ouvertes (à trancher par l'utilisateur)

1. ~~Quel matériel~~ — réglé : une imprimante sur place ; les templates adaptés sont
   désignés dans les paramètres (décisions 5 et 6).
2. ~~Unité du crédit~~ — réglé : FCFA (décision 7).
3. ~~Dépassement~~ — réglé : marge et facturation (décision 8).
4. Un évènement peut-il combiner une demande **en amont** et une demande **sur place** ?
   (L'agent suppose que oui.)

Réglé le 2026-11-01 : qui imprime (un opérateur de la plateforme), badges non utilisés
(crédit, pas de remboursement), et donc ce que compte le compteur (le journal du poste
d'impression).

## Non-objectifs

- Pilotage direct d'une imprimante (pilote, impression silencieuse) : l'impression reste
  celle du navigateur ou du ZIP existant.
- Inscription ou approbation sur place.
- Facturation en cours d'évènement : le surplus est facturé à la clôture seulement.

## Critères d'acceptation

- Un template absent de la liste des templates adaptés rend le type « Pendant l'évènement » indisponible,
  avec une explication et un lien.
- Une demande `ONSITE` suit le cycle de vie de la spec 33 et se paie comme la spec 34.
- Un participant approuvé reçoit son QR d'accueil par email et le retrouve dans son compte ;
  scanné au poste, il ouvre sa fiche et son badge s'imprime. Un QR d'un autre évènement ou
  d'une inscription non approuvée est refusé.
- Le compteur de la demande ne compte que les impressions du poste de l'opérateur (hors
  réimpressions) et alerte à 90 % puis au dépassement.
- 200 badges commandés à 1 500 FCFA, 170 imprimés : à la clôture, 45 000 FCFA passent au
  crédit de l'organisation ; ce crédit est proposé sur la demande suivante et décompté à son
  paiement.
- 200 badges commandés, marge 10 % : le poste imprime jusqu'à 220 puis bloque ; 212
  imprimés : à la clôture, une demande complémentaire de 12 badges est créée en `QUOTED`.
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**`.
