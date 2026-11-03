# Spec v4 — Commandes d'impression : conversation, planches par commande, stacks d'agents

> **Statut** : proposée — 2026-11-02 — en attente de relecture
> **Type** : refonte fonctionnelle + outillage de développement
> **Périmètre** : v4 — impression (espace `/platform/print`, espace `/event/[eventId]/print`), worker
> de planches, environnement Docker de dev
> **Plans** (exécution par vagues, voir « Organisation du travail ») :
> - Vague 0 : [`plans/2026-11-02-0-stacks-agents.md`](../plans/2026-11-02-0-stacks-agents.md)
>   (règles de test du projet + stacks d'agents)
> - Vague 1 : [`plans/2026-11-02-1-socle-commandes.md`](../plans/2026-11-02-1-socle-commandes.md)
> - Vague 2 (parallèle) : [`plans/2026-11-02-2a-planches-par-commande.md`](../plans/2026-11-02-2a-planches-par-commande.md),
>   [`plans/2026-11-02-2b-commande-staff-conversation.md`](../plans/2026-11-02-2b-commande-staff-conversation.md),
>   [`plans/2026-11-02-2c-commande-organisateur-conversation.md`](../plans/2026-11-02-2c-commande-organisateur-conversation.md)
> **Features existantes** : [`features/impression-demandes.md`](../features/impression-demandes.md),
> [`features/impression-planches.md`](../features/impression-planches.md),
> [`features/catalogue-impression.md`](../features/catalogue-impression.md)

## Contexte

Une « demande d'impression » suit déjà un cycle complet (brouillon → devis → acceptation →
paiement → production → prête → terminée) avec un fil d'échanges (`PrintRequestMessage`,
messages et évènements système, pièces jointes, notification `PRINT_REQUEST_MESSAGE`). Les
planches se génèrent depuis un écran unique, librement par évènement ou rattachées à une
demande, et chaque génération crée une nouvelle ligne. La page d'une demande est un détail
classique, peu adapté à une négociation suivie.

## Décisions (validées par l'utilisateur le 2026-11-02)

### Vocabulaire et navigation

1. **« Demande d'impression » devient « Commande d'impression »** dans toute l'interface (staff
   et organisateur), les e-mails, les notifications et la documentation. Les **URL staff**
   passent de `/platform/print/requests` à `/platform/print/orders` ; les anciennes URL
   redirigent (308). Les URL organisateur (`/event/[eventId]/print/...`) ne contiennent pas le
   mot et restent. Le **modèle Prisma `PrintRequest`, les routes API et les identifiants de
   code ne changent pas** (pas de migration de renommage).
2. **Menu staff** : groupe « Impression » = Commandes, Planches, Gabarits, Catalogue (dans cet
   ordre). Emails, Paramètres et Journal passent dans un groupe « Plateforme ».
3. **Gabarits** : la liste n'affiche que les gabarits (nom, format, marges et espacements,
   miniature sans emplacements) et le bouton de création. Le badge témoin et le « N badges par
   feuille » ne restent que dans l'éditeur.

### Planches

4. Les planches servent aux **commandes validées et payées** : la file de travail contient les
   commandes **`ADVANCE`** au statut **`PAID` ou `IN_PRODUCTION`**. Les commandes sur place
   (`ONSITE`) sont exclues.
5. Sous-pages de « Planches » : **À traiter** (commandes de la file sans planche générée),
   **Générées** (commandes ayant leur planche : télécharger, regénérer), **Génération libre**
   (l'outil actuel, par évènement, conservé tel quel avec son historique).
6. **Une planche par commande**, sauvegardée. La regénérer (même avec un autre gabarit)
   **écrase** la précédente : même ligne `PrintSheetGeneration`, fichier remplacé. Les
   générations libres gardent leur comportement (une ligne par génération).
7. Générer les planches **ne change pas** le statut de la commande (le staff le fait avancer).
8. Dans la page d'une commande (staff), une fois la planche générée : nombre de badges, de
   feuilles et de pages, gabarit utilisé, recto-verso, téléchargement du PDF et **ouverture de
   la planche complète dans une modale**. La génération elle-même se fait dans « Planches ».

### Conversation

9. La page d'une commande devient une **conversation** à trois colonnes : **gauche** = résumé
   actualisé de la commande ; **centre** = fil (messages, évènements, pièces jointes, saisie) ;
   **droite** = devis (éditable côté staff, en lecture côté organisateur) et actions.
   Staff et organisateur ont **deux pages distinctes** (implémentations séparées).
10. **Modifications de prix** : chaque ajout, modification ou retrait de ligne crée un
    évènement **interne au staff** dans le fil ; l'**envoi du devis** crée un message
    récapitulatif **visible de l'organisateur** (lignes modifiées depuis la version précédente,
    total).
11. **Notes internes** : le staff peut écrire un message visible du staff seulement.
12. **Lu / non lu** par utilisateur : pastille de non-lus sur chaque commande des listes (staff
    et organisateur), compteur du menu (« Commandes » staff, « Impression » organisateur) qui
    inclut les commandes ayant des non-lus, et notification pour l'autre partie à chaque
    nouveau message (les notes internes ne notifient pas l'organisateur).
13. **Rafraîchissement** du fil par polling (~10 s, onglet visible uniquement).

### Outillage : règles de test du projet et stacks d'agents

14. **Base de test dédiée pour tout le projet** : `make test` (Vitest) ne tourne plus sur la
    base de dev mais sur une base `badge_test` du même serveur MySQL, créée et mise au schéma
    automatiquement. La base de dev n'est plus jamais vidée par les tests, et le worker n'a plus
    besoin d'être arrêté pendant les tests.
15. **Garde-fou** : la configuration de test refuse de démarrer si la base visée n'est pas une
    base de test (nom finissant par `_test`).
16. **Pas de mock de la base** (règle existante maintenue) : les tests d'intégration gardent un
    vrai MySQL, car ils vérifient des comportements que seul le moteur fournit (`SKIP LOCKED`,
    `FOR UPDATE`, contraintes d'unicité, transactions, cascades). Des **fabriques de données**
    (`@faker-js/faker`) qui écrivent dans la vraie base de test deviennent la manière standard
    de préparer les données des nouveaux tests.
17. **Une stack légère par sous-agent**, dans son worktree : seuls l'**app**, le **worker** et
    **Mailpit** sont propres à l'agent (le code diffère ; la file de jobs et la boîte mail ne se
    partagent pas : les e2e vident Mailpit). Sont **partagés avec la stack principale** : le
    serveur **MySQL** (une base de dev `badge_<lot>` et une base de test `badge_<lot>_test` par
    agent), **RustFS** (un bucket `badge-<lot>` par agent) et le **renderer** (sans état).
    **3 stacks d'agents** au plus. La stack principale doit tourner pendant le travail des
    agents.

## Choix de conception (à relire)

- **Écrasement** : contrainte `@@unique([printRequestId])` sur `PrintSheetGeneration`
  (plusieurs `NULL` restent permis pour la génération libre). Regénérer remet la ligne en
  `PENDING` ; le worker écrit le PDF sous une clé stable `print-sheets/orders/<requestId>.pdf`.
- **Non-lus** : table `PrintRequestRead (requestId, userId, lastReadAt)`. Un message est non lu
  pour un utilisateur s'il est visible de son audience, postérieur à `lastReadAt` et écrit par
  quelqu'un d'autre. Ouvrir la page (et chaque polling) avance `lastReadAt`.
- **Interne** : colonne `PrintRequestMessage.internal` (défaut `false`) ; `listThread(…,
  "ORGANIZER")` l'exclut.
- **Polling** : `GET …/messages?after=<ISO>` renvoie les entrées postérieures.
- **Accès des agents aux services partagés** : MySQL et RustFS par leurs ports publiés sur
  l'hôte (`host.docker.internal:33060` et `:9000`), le renderer par le réseau interne `rendu` de
  la stack principale (réseau externe). Les agents ne rejoignent **pas** le réseau par défaut de
  la stack principale : le Caddy principal résout `app` sur ce réseau et pourrait sinon tomber
  sur l'app d'un agent. Le Mailpit de l'agent a un nom de service distinct.
- **Tests unitaires sans serveur Next** : `make test` s'exécute dans un conteneur éphémère
  (`run --rm`) ; le serveur de dev ne sert qu'aux e2e et au navigateur.
- **Image et cache Yarn partagés** entre la stack principale et les agents.
- **Socle avant parallélisme** : toutes les modifications de schéma, le renommage, le déplacement
  des URL, le menu et les helpers partagés sont dans la vague 1, pour que les lots de la vague 2
  ne touchent ni `schema.prisma` ni les mêmes fichiers.

## Organisation du travail

- Branche d'intégration **`feat/commandes-impression`**, créée depuis `feat/service-impression`.
- **Vague 0** (séquentielle, dossier principal) : stacks d'agents.
- **Vague 1** (séquentielle, dossier principal) : socle commun, commité sur la branche
  d'intégration.
- **Vague 2** (3 sous-agents en parallèle) : chaque lot dans son worktree
  (`feat/commandes-impression-2a|2b|2c`) et sa stack ; fusion dans la branche d'intégration dans
  l'ordre 2a → 2b → 2c, puis vérification complète (`make lint && make typecheck && make test`,
  e2e d'impression, navigateur).
- Propriété des fichiers en vague 2 : chaque plan liste les fichiers qu'il peut modifier ; un
  fichier n'appartient qu'à un lot. Exception : `docs/v4/features/impression-demandes.md`, où
  2b n'écrit que la partie staff et 2c que la partie organisateur ; l'orchestrateur relit le
  document après fusion.
- **Modèle** : les sous-agents qui exécutent les plans (implémentation, revues, corrections)
  tournent sur **Sonnet 5.5** (`model: "sonnet"`), vagues 0 à 2.
- **Automatisation (validée le 2026-11-02)** : la vague 0 s'exécute en interactif avec
  l'utilisateur. Les vagues 1, 2 et la fusion sont pilotées par une **tâche planifiée locale de
  l'application Claude**, relancée **toutes les 15 minutes**. Chaque lancement relit l'état
  (Progression des plans, journal `.superpowers/sdd/<plan>/progress.md`, commits) et reprend à la
  première étape non terminée ; un verrou (`.superpowers/sdd/commandes-impression/run.lock`,
  rafraîchi pendant l'exécution, considéré périmé après 30 min sans mise à jour) empêche deux
  exécutions simultanées. Une limite d'usage interrompt simplement un lancement ; le suivant
  reprend après la réinitialisation.
  - **Commits** : un commit par tâche est autorisé sur `feat/commandes-impression` et ses
    branches de lot (règles de message du projet, sans co-auteur IA).
  - **Conflits de fusion** : résolus par l'agent s'ils ne portent que sur des fichiers de lot
    (docs, tests, composants propres au lot) ; tout conflit dans du code partagé arrête
    l'automatisation et notifie l'utilisateur.
  - **Fin** : une fois tout vérifié, **push** de `feat/commandes-impression` et **ouverture d'une
    PR** vers `development` (sans fusion), puis désactivation de la tâche planifiée et
    notification. Plan : [`plans/2026-11-02-3-fusion-et-pr.md`](../plans/2026-11-02-3-fusion-et-pr.md).
- Ressources : 3 stacks d'agents (≈ 1 Go de RAM chacune, surtout le serveur Next) en plus de la
  stack principale.
- Un lot qui a besoin de modifier un fichier hors de son périmètre s'arrête et le signale ;
  l'orchestrateur tranche (déplacement dans le socle ou lot suivant).

## Hors périmètre

- Renommage du modèle et des routes API (`PrintRequest`, `/print-requests`).
- Temps réel (SSE/WebSocket).
- Planche visible de l'organisateur.
- Correction du nettoyage du seed de démo (`Registration.category` sans cascade) — signalé à
  part.

## Amendement du 2026-11-03

- Le fil ne regroupe plus les modifications de lignes consécutives : chaque modification crée une
  entrée. La mise à jour sur place d'une entrée existante n'était jamais revue par les écrans, qui
  interrogent le fil par date de création (`?after=`) et dédoublonnent par id.
