# Checklist de tests manuels navigateur — Badge v4

> **Objectif :** verifier a 100% l'application dans un navigateur reel, page par page,
> action par action. Complementaire de la suite automatisee (Vitest + Playwright) :
> cette checklist couvre ce que l'automatisation verifie mal (rendu visuel, camera,
> impressions reelles, ressenti navigation) ET sert de recette complete avant livraison.
>
> **Emplacement volontaire dans `specs/`** (et non `plans/`) : les cases `- [ ]` de ce
> document ne doivent PAS etre comptees par `scripts/run-plans.sh`.
>
> **Convention :** cocher `[x]` apres verification. Chaque item indique l'attendu.
> Tout ecart = ouvrir une entree dans la section "Anomalies" en fin de document.

---

## 0. Pre-requis

- [ ] Stack demarree : `make dev` — app sur `https://badge.local` (cadenas vert, CA Caddy approuvee), Mailpit sur `https://mail.badge.local`, MinIO console sur `localhost:9001`.
- [ ] `http://badge.local` redirige vers HTTPS (308).
- [ ] Base seedee : `make db-seed` — noter les comptes de test disponibles (1 SUPER_ADMIN minimum).
- [ ] Creer via l'app (ou seed) les comptes suivants et noter les identifiants :
  staff : SUPER_ADMIN, STAFF_ADMIN, STAFF_SUPPORT, STAFF_OBSERVER ;
  org : OWNER, MANAGER, AUDITOR ;
  event : ADMIN, OPERATOR, PRINTER, VIEWER (dont 1 membre event SANS membership org) ;
  participant : 1 profil complet, 1 profil incomplet.
- [ ] 1 org avec abonnement ACTIF + limites basses (pour tester les blocages), 1 org sans abonnement.
- [ ] 1 event publie avec categories, 1 event archive, 1 event inscriptions fermees.
- [ ] Navigateurs cibles : Chrome/Edge (principal), Firefox, Safari si dispo. Viewport mobile 390px teste sur les parcours marques (M).

---

## 1. Pages marketing `(marketing)` — 8 pages

Pour CHAQUE page : `/`, `/fonctionnalites`, `/tarifs`, `/a-propos`, `/contact`, `/cgu`, `/mentions-legales`, `/confidentialite` :

- [ ] Rendu complet sans erreur console, textes francais accentues corrects, images chargees.
- [ ] Header : navigation vers les autres pages marketing + CTA connexion/inscription fonctionnels.
- [ ] Footer : liens legaux corrects (CGU, mentions, confidentialite).
- [ ] (M) Affichage mobile : menu, lisibilite, pas de debordement horizontal.

Specifiques :

- [ ] `/` : visiteur non connecte voit la page marketing ; utilisateur connecte est redirige (ou voit un CTA vers son espace) — verifier le comportement attendu.
- [ ] `/contact` : le formulaire (si present) valide les champs, envoie, affiche une confirmation ; email visible dans Mailpit.
- [ ] `/tarifs` : coherence avec les plans du catalogue plateforme.

## 2. Authentification — 7 pages

### `/register` + `/register/success`

- [ ] Inscription golden path : formulaire valide -> page succes -> mail de verification dans Mailpit.
- [ ] Email deja pris -> erreur francaise claire, pas de fuite (pas de distinction verifie/non verifie).
- [ ] Mot de passe < 6 caracteres -> erreur de validation.
- [ ] Champs vides -> erreurs par champ, focus visible.
- [ ] reCAPTCHA actif (si configure) : soumission sans token bloquee.
- [ ] (M) Formulaire utilisable au mobile.

### `/verify-email/[token]`

- [ ] Token valide -> compte active, CTA login fonctionne.
- [ ] Token deja consomme -> reste sur la vue succes (pas d'erreur).
- [ ] Token expire/invalide -> message d'expiration + relance possible.

### `/login`

- [ ] Golden path -> redirection selon profil : staff -> `/platform` ou `/select`, membre org -> `/select` ou son org, participant -> `/account`.
- [ ] Mauvais mot de passe -> erreur francaise, pas d'indication "email existe".
- [ ] Email non verifie -> refus avec message explicite.
- [ ] Compte archive -> refus.
- [ ] `callbackUrl` : acceder a une URL protegee deconnecte -> login -> retour sur l'URL demandee.

### `/forgot-password` + `/reset-password/[token]`

- [ ] Golden path : demande -> mail Mailpit -> reset -> login avec le nouveau mot de passe.
- [ ] Email inconnu -> meme message de succes (anti-enumeration), aucun mail.
- [ ] Token expire -> erreur francaise, possibilite de redemander.
- [ ] 6 demandes rapides -> rate-limit (message 429).

### `/setup-password`

- [ ] Invitation (org/event/staff) -> mail -> definition du mot de passe -> login OK.
- [ ] Token invalide/expire -> vue dediee.
- [ ] Compte archive -> refus.

## 3. Selecteur de workspace `/select`

- [ ] Utilisateur multi-casquettes (org A + event org B + staff) : les 3 espaces proposes, chaque carte mene au bon workspace.
- [ ] Utilisateur mono-role : redirection directe (pas d'ecran inutile) — verifier le comportement attendu.
- [ ] Participant pur : redirige vers `/account`.
- [ ] Retour a `/select` possible depuis chaque espace (lien/menu).

## 4. Compte participant `/account` — 4 pages

### `/account` (dashboard)

- [ ] Liste des inscriptions par statut (PENDING/APPROVED/REJECTED) avec liens detail.
- [ ] Etat vide (nouveau compte) : message d'invite correct.
- [ ] Nom d'utilisateur avec caracteres speciaux affiche echappe (pas d'HTML interprete).

### `/account/profile`

- [ ] Edition de chaque champ -> sauvegarde -> reload -> persistance.
- [ ] Upload photo (JPEG/PNG/WebP) -> preview -> servie apres reload (MinIO).
- [ ] Upload document PDF -> visible/telechargeable.
- [ ] Fichier > 5 Mo -> refus avec message.
- [ ] Fichier .txt -> refus (type non autorise).

### `/account/profile/complete`

- [ ] Participant au profil incomplet redirige ici depuis une inscription event.
- [ ] Completion pas-a-pas : champs requis, uploads, validation finale -> retour au flux d'inscription.

### `/account/registrations/[id]`

- [ ] Detail PENDING : statut affiche, pas de badge.
- [ ] Detail APPROVED : badge telechargeable (PDF s'ouvre, QR present, photo visible).
- [ ] Detail REJECTED : motif affiche + bouton resoumettre -> statut repasse PENDING + mail Mailpit.
- [ ] Resoumission d'une inscription non rejetee : bouton absent.
- [ ] Acceder a l'inscription d'un autre user par URL -> 404/403.

## 5. Public evenement et badge — 4 pages

### `/e/[slug]`

- [ ] Rendu avec branding event (logo, couleurs, contacts en cascade Event -> Org).
- [ ] Slug inconnu -> 404.
- [ ] Event archive ou inscriptions fermees -> message fermeture, pas de formulaire.
- [ ] Non connecte -> CTA login/register avec retour au flux apres auth.
- [ ] Deja inscrit -> notice + lien vers le detail dans `/account`.

### `/e/[slug]/register` + `/e/[slug]/success`

- [ ] Golden path connecte + profil complet : choix categorie -> soumission -> page succes.
- [ ] Profil incomplet -> redirection `/account/profile/complete` puis retour.
- [ ] Email bloque (BlockedEmail event) -> refus avec message neutre.
- [ ] Limite participants de l'abonnement atteinte -> refus explicite.
- [ ] (M) Formulaire complet au mobile.

### `/verify/[badgeId]`

- [ ] Badge APPROVED nominatif : nom, categorie, statut valide.
- [ ] Badge APPROVED anonyme : identite masquee.
- [ ] Badge PENDING/REJECTED : affiche invalide.
- [ ] Id inconnu -> 404.
- [ ] QR d'un badge PDF telecharge (depuis `/account` ou l'espace event) scanne avec un telephone -> pointe bien vers `/verify/[badgeId]`.

## 6. Espace organisation `/org/[orgId]` — 10 pages

Tester en OWNER, puis repasser les points marques (R) en MANAGER et AUDITOR.

### Dashboard `/org/[orgId]`

- [ ] KPI coherents (events, inscriptions), liens rapides fonctionnels.
- [ ] (R) MANAGER : pas d'acces parametres org ; AUDITOR : lecture seule partout (aucun bouton d'action).

### `/org/[orgId]/events` + `/events/new`

- [ ] Liste des events avec statuts ; etat vide correct.
- [ ] Wizard creation 4 etapes : infos -> badge (tuiles avec apercu, heritage par defaut) -> categories (import templates + ajout manuel) -> confirmation.
- [ ] Slug deja pris -> erreur claire a l'etape 1.
- [ ] Limite events de l'abonnement atteinte -> creation bloquee avec message.
- [ ] Archivage d'un event depuis la liste -> confirmation -> disparait des actifs ; restauration inverse.
- [ ] (R) AUDITOR : boutons creation/archivage absents.

### `/org/[orgId]/members`

- [ ] Invitation nouvel utilisateur avec choix du role (OWNER/MANAGER/AUDITOR) -> mail setup-password recu.
- [ ] Invitation d'un email deja utilisateur -> membership ajoute sans nouveau compte.
- [ ] Changement de role d'un membre -> reflete immediatement.
- [ ] Retrait d'un membre -> confirme + disparait.
- [ ] Dernier OWNER : retrait et retrogradation refuses avec message.
- [ ] (R) MANAGER/AUDITOR : pas d'invitation possible.

### `/org/[orgId]/templates`

- [ ] Creation, edition, suppression d'un template de categories.
- [ ] Template utilise ensuite dans le wizard event (import).

### `/org/[orgId]/subscription`

- [ ] Plan courant, dates, limites affichees ; overrides visibles le cas echeant.
- [ ] Barres de progression conso events/participants ; alerte visuelle > 80%.
- [ ] Org sans abonnement : message et comportement attendus.

### `/org/[orgId]/settings` + `/settings/badge`

- [ ] Edition infos org (nom, adresse, contacts, logo upload MinIO) -> persistance.
- [ ] Choix template badge org -> apercu ; reset -> heritage plateforme.
- [ ] (R) MANAGER : selon spec, badge autorise mais pas les infos org ; AUDITOR : rien.

### `/org/[orgId]/activity` + `/activity/[logId]`

- [ ] Journal liste les actions du jour de test (creations, invitations...).
- [ ] Filtres par type ; pagination si > 50.
- [ ] Detail d'un log complet ; aucune donnee sensible (hash, secrets).

## 7. Espace evenement `/event/[eventId]` — 17 pages

Tester en ADMIN, puis repasser les points marques (R) en OPERATOR, PRINTER, VIEWER.
Inclure 1 passage avec le compte membre event SANS membership org (doit acceder directement).

### Dashboard `/event/[eventId]`

- [ ] KPI (inscrits, approuves, scannes) coherents.
- [ ] (R) OPERATOR : vue "mes scans" + acces scanner ; PRINTER : acces badges ; VIEWER : KPI agreges sans details nominatifs.

### `/event/[eventId]/registrations` (+ `/new`, `/[regId]`, `/overview`)

- [ ] Liste : recherche par nom/email, filtre statut, filtre categorie, tri, pagination — chaque combinaison au moins une fois.
- [ ] Etat vide (aucun resultat) correct.
- [ ] Creation manuelle `/new` : formulaire complet, uploads, statut initial correct.
- [ ] Detail `/[regId]` : toutes les infos, documents consultables.
- [ ] Approve -> statut APPROVED + mail Mailpit + badge genere.
- [ ] Approve une 2eme fois -> pas de 2eme mail (idempotent).
- [ ] Reject avec motif -> statut REJECTED + mail avec motif.
- [ ] Doublons : 2 inscriptions proches -> encart doublons visible sur la fiche.
- [ ] All-access : toggle -> reflete sur le badge.
- [ ] Check-in direct depuis la fiche -> compteur scans + journal.
- [ ] Blocage email depuis la fiche -> present dans blocked-emails.
- [ ] Blocage document depuis la fiche -> present dans blocked-documents.
- [ ] Suppression d'une inscription -> confirmation -> disparue.
- [ ] Export CSV -> fichier telecharge, colonnes et accents corrects (ouvrir dans un tableur).
- [ ] `/overview` : agregats corrects par categorie/statut.
- [ ] (R) OPERATOR : pas de creation/suppression/export ; VIEWER : lecture seule ; PRINTER : pas d'acces au detail nominatif.

### `/event/[eventId]/badges` (+ `/[badgeId]`, `/print`)

- [ ] Galerie des badges APPROVED avec photos.
- [ ] Detail badge : apercu fidele au template (cascade Event > Org > Platform).
- [ ] Impression individuelle -> PDF correct (recto/verso si template multi-faces).
- [ ] `/print` batch : selection multiple -> un PDF combine -> inscriptions marquees imprimees.
- [ ] Badge PENDING non imprimable (absent ou refuse).
- [ ] (R) PRINTER : ce module accessible ; VIEWER : lecture seule/absent selon spec.

### `/event/[eventId]/categories`

- [ ] Creation (modale), edition, suppression.
- [ ] Numero deja pris -> erreur.
- [ ] Suppression d'une categorie avec inscriptions -> refus explicite.
- [ ] Import depuis templates org -> categories ajoutees.

### `/event/[eventId]/blocked-emails` + `/blocked-documents`

- [ ] Listes correctes apres blocages effectues plus haut.
- [ ] Deblocage -> l'email/document peut se reinscrire.
- [ ] Ajout manuel direct depuis la page (si formulaire present).

### `/event/[eventId]/members`

- [ ] Invitation aux 4 roles event -> mail recu ; membre existant ajoute sans nouveau compte.
- [ ] Retrait d'un membre.
- [ ] (R) seuls ADMIN (et org OWNER/MANAGER, staff) peuvent inviter.

### `/event/[eventId]/scan`

- [ ] Autorisation camera demandee ; scan d'un vrai QR badge a l'ecran/telephone -> resultat.
- [ ] Saisie manuelle d'un id : APPROVED -> succes ; deja scanne -> "deja scanne" ; PENDING/inconnu -> invalide.
- [ ] (M) Scanner utilisable au mobile (usage reel terrain).
- [ ] (R) PRINTER et VIEWER : pas d'acces scan.

### `/event/[eventId]/settings` + `/settings/badge`

- [ ] Edition titre/lieu/dates/ouverture inscriptions -> reflete sur `/e/[slug]`.
- [ ] Override contact -> reflete sur la page publique et les mails.
- [ ] Template badge event -> apercu ; reset -> heritage org/plateforme.
- [ ] Archivage de l'event ici (org OWNER requis) -> page publique fermee, espace en lecture seule ; restauration inverse.

### `/event/[eventId]/activity` + `/activity/[logId]`

- [ ] Toutes les actions du test presentes (approve, reject, scan, print, blocages).
- [ ] (R) OPERATOR : ne voit que ses scans ; VIEWER : pas de donnees nominatives dans les details.

## 8. Espace plateforme `/platform` — 16 pages

Tester en SUPER_ADMIN, puis repasser les points marques (R) en STAFF_ADMIN, STAFF_SUPPORT, STAFF_OBSERVER.

### Dashboard `/platform`

- [ ] KPI globaux (orgs, events, users) coherents.

### `/platform/organizations` (+ `/new`, `/[orgId]` et sous-pages events/members/activity/subscription)

- [ ] Liste + recherche ; etat vide si applicable.
- [ ] Creation org avec invitation OWNER -> mail recu ; slug auto en cas de collision.
- [ ] Detail org : onglets events / members / activity / subscription accessibles en supervision.
- [ ] Ajout/retrait d'un OWNER depuis le detail ; dernier owner protege.
- [ ] Assignation d'un abonnement (plan + dates + overrides) -> visible cote org.
- [ ] Abonnement expire -> cote org : creation event/inscription bloquee ; re-ACTIVE -> debloquee.
- [ ] Archivage org -> OWNERS ne peuvent plus y acceder ; restauration inverse.
- [ ] Hard delete (SUPER_ADMIN uniquement) avec confirmation forte.
- [ ] Banniere "mode supervision" visible quand le staff navigue dans un espace org/event.
- [ ] (R) STAFF_OBSERVER : lecture seule (boutons absents ou refus) ; STAFF_SUPPORT : pas de creation d'org.

### `/platform/users` (+ `/new`, `/[userId]`)

- [ ] Creation user client (avec membership org optionnel) et user staff (choix du role).
- [ ] STAFF_ADMIN ne peut pas creer un SUPER_ADMIN.
- [ ] Reset password -> mail recu.
- [ ] Archivage d'un user -> ne peut plus se connecter.
- [ ] Dernier SUPER_ADMIN : archivage/retrogradation refuses.
- [ ] Modification de son propre role -> refusee.
- [ ] Promotion STAFF_SUPPORT -> STAFF_ADMIN par SUPER_ADMIN.

### `/platform/plans`

- [ ] Creation d'un plan (limites, prix indicatif), edition, archivage/suppression.
- [ ] Plan utilise par une org : comportement a la suppression (protection attendue).

### `/platform/settings` + `/settings/badge`

- [ ] Configuration SMTP -> bouton test -> mail de test dans Mailpit.
- [ ] Rechargement : mot de passe SMTP jamais re-affiche.
- [ ] reCAPTCHA : cles configurables, cle secrete jamais re-affichee.
- [ ] Template badge plateforme par defaut -> herite par orgs/events sans override.

### `/platform/activity` + `/activity/[logId]`

- [ ] Journal global : filtres type + staffActor, pagination > 50.
- [ ] Toutes les actions staff du test tracees avec staffActor=true.

### Blocklists globales (pages ou module correspondant)

- [ ] Ajout email/document bloque globalement -> effet sur une inscription puis deblocage.

## 9. Tests transverses

### Navigation et session

- [ ] Sidebar de chaque espace : chaque lien mene a la bonne page, etat actif correct, liens masques selon role.
- [ ] Logout via la modal dans CHAQUE espace (platform, org, event, account) : annuler = aucune action ; confirmer = deconnecte + retour `/` ; pas de page NextAuth brute.
- [ ] Session expiree/cookie supprime -> prochaine action renvoie au login (pas d'erreur brute).
- [ ] Navigation arriere apres logout -> pas de contenu protege affiche.

### RBAC par URL directe (echantillon minimum)

- [ ] Participant -> `/platform`, `/org/[orgId]`, `/event/[eventId]` -> refus (redirect/403/404).
- [ ] AUDITOR -> action POST via un formulaire d'une page ouverte en 2e onglet -> refus propre.
- [ ] Membre event-only -> son event OK, l'org parente refusee, un autre event refuse.
- [ ] Staff -> partout, avec banniere supervision.
- [ ] Org/event inconnus dans l'URL -> 404 identique que l'id existe ou non (pas de fuite).

### Robustesse navigateur

- [ ] Double-clic rapide sur les boutons de soumission critiques (approve, invite, create) -> pas de doublon.
- [ ] Reload (F5) sur chaque type de page profonde (detail registration, wizard etape 2, modale ouverte) -> etat coherent.
- [ ] Deux onglets : action dans l'un (ex. archive event), navigation dans l'autre -> erreurs gerees proprement.
- [ ] Erreurs console : zero erreur JS sur le parcours complet (warnings tolores et notes).

### Emails (Mailpit, pour chaque mail recu)

- [ ] Expediteur (fromLabel) et branding conformes a la cascade Event -> Org.
- [ ] Liens des mails pointent vers `https://badge.local` et fonctionnent.
- [ ] Contenu francais accentue correct, pas de variable non substituee.
- [ ] Mails concernes : verification email, invitation (org, event, staff), reset password, approbation, rejet (avec motif), resoumission, test SMTP.

### Uploads / MinIO

- [ ] Chaque champ d'upload de l'app (photo profil, document profil, logo org, logo event, uploads inscription manuelle) teste avec : JPEG, PNG, WebP, PDF, fichier > 5 Mo (refus), .txt (refus).
- [ ] Fichiers visibles apres reload et presents dans le bucket (console MinIO).
- [ ] Document d'un user inaccessible par un autre user (URL directe du fichier).

### Responsive (M) — viewport 390px

- [ ] Marketing, login/register, `/e/[slug]` + formulaire d'inscription, `/account`, liste registrations, scanner : utilisables sans debordement.

### Accessibilite minimale

- [ ] Parcours login + inscription publique entierement au clavier (tab, entree).
- [ ] Focus visible sur les elements interactifs ; modales fermables a Echap.
- [ ] Labels presents sur tous les champs de formulaire testes.

---

## 10. Anomalies relevees

| # | Page/parcours | Constat | Attendu | Gravite | Statut |
|---|---|---|---|---|---|
| 1 | | | | | |

---

*Document cree le 2026-07-22. A rejouer integralement avant chaque livraison majeure ; les sections 1-8 peuvent etre reparties entre testeurs, la section 9 se joue en dernier.*
