// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).
import type { PageDocEntry } from "./types";

export const PAGE_DOCS: PageDocEntry[] = [
  {
    "id": "org/activity",
    "route": "/org/[orgId]/activity",
    "space": "org",
    "title": "Journal d'activité",
    "audience": "organisateur",
    "access": "org.activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe journal d'activité garde la trace des actions effectuées dans votre organisation, de la plus récente à la plus ancienne. La liste est paginée.\n\n## Le tableau\n\nColonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature, par exemple une suppression), **Auteur** (adresse e-mail, « — » pour une action système ; colonne masquée sur petit écran) et une flèche pour ouvrir le détail (« Voir le détail »).\n\nUne action marquée **staff** a été effectuée par le staff de la plateforme et non par un membre de l'organisation. S'il n'y en a aucune, l'écran affiche « Aucune activité. »\n"
  },
  {
    "id": "org/activity/detail",
    "route": "/org/[orgId]/activity/[logId]",
    "space": "org",
    "title": "Détail d'une entrée du journal",
    "audience": "organisateur",
    "access": "org.activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche en lecture seule détaille une entrée du journal d'activité de votre organisation. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée qui n'appartient pas à votre organisation est introuvable.\n\n## L'en-tête\n\nLe type de l'action, le numéro « ENTRÉE # », une description en clair et la date et l'heure. Deux boutons :\n- **Copier l'ID** : copie l'identifiant de l'entrée (le bouton affiche « Copié » un instant).\n- **Exporter JSON** : télécharge l'entrée au format JSON.\n\n## Détails de l'action\n\n**Type**, **Auteur** (adresse e-mail, ou « Système »), **Contexte** (l'organisation ou l'évènement concerné) et **Staff** (Oui si l'action vient du staff de la plateforme).\n\n## Modification\n\nLorsque l'action a modifié des valeurs, le bloc **Modification** montre pour chaque champ la valeur avant et après.\n\n## Charge utile brute\n\nLes données techniques de l'évènement, telles qu'enregistrées.\n\n## Colonne latérale\n\n- **Auteur** : nom, rôle éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.\n- **Contexte** : l'organisation, l'évènement éventuel et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.\n"
  },
  {
    "id": "org/events",
    "route": "/org/[orgId]/events",
    "space": "org",
    "title": "Événements",
    "audience": "organisateur",
    "access": "org.events.list",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste tous les évènements de votre organisation, archivés compris, du plus récent au plus ancien. La liste est paginée.\n\n## Le tableau\n\nColonnes : **Titre** (avec son slug, l'identifiant d'URL publique, en dessous ; cliquer ouvre l'espace de l'évènement), **Période**, **Lieu**, **Inscriptions** (nombre d'inscriptions de l'évènement) et **Statut**.\n\nLe statut peut être :\n- **Inscriptions ouvertes** ;\n- **Fermées** : l'évènement n'accepte pas de nouvelles inscriptions ;\n- **Archivé** : la ligne est alors grisée.\n\nS'il n'y a aucun évènement, l'écran affiche « Aucun événement. Créez votre premier événement. »\n\n## Créer un évènement\n\n:::permission org.events.create\nLe bouton **Créer un événement** ouvre l'assistant de création. Il est désactivé, avec une explication, lorsque la création n'est pas possible : si votre abonnement est inactif (un lien « Voir mon abonnement » est alors proposé), ou si la création n'est pas disponible avec votre abonnement.\n:::\n\n## Actions sur une ligne\n\n- **Configurer** : ouvre les paramètres de l'évènement. Ce lien n'apparaît que si vous avez le droit de modifier les paramètres de cet évènement.\n\n:::permission org.events.archive\n- **Archiver** : après confirmation (« Archiver cet événement ? »), l'évènement passe en statut Archivé.\n- **Restaurer** : sur un évènement archivé, le remet en service sans confirmation.\n:::\n"
  },
  {
    "id": "org/events/new",
    "route": "/org/[orgId]/events/new",
    "space": "org",
    "title": "Nouvel événement",
    "audience": "organisateur",
    "access": "org.events.create",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet assistant crée un évènement pour votre organisation en quatre étapes : **Informations**, **Badge**, **Catégories** et **Récapitulatif**. Si votre abonnement ne permet pas la création d'évènement, vous êtes ramené à la liste des évènements.\n\n## Étape 1 : Informations\n\n- **Titre** (obligatoire).\n- **Date** (obligatoire) et **Date de fin (optionnelle)**. La date de fin doit être postérieure ou égale à la date de l'évènement, sinon une erreur s'affiche sur le champ.\n- **Lieu** (obligatoire).\n- **Description (optionnelle)**.\n- **Slug (URL publique)** : suggéré automatiquement à partir du titre tant que vous ne le modifiez pas. Si le slug existe déjà, vous obtenez l'erreur « Ce slug est déjà utilisé » et l'assistant revient à cette étape.\n\nLe bouton **Continuer** reste inactif tant que le titre, la date et le lieu ne sont pas renseignés.\n\n## Étape 2 : Badge\n\nChoisissez le modèle imprimé sur les badges de l'évènement parmi les modèles proposés. Si vous n'en choisissez pas, l'évènement hérite du modèle de l'organisation, ou à défaut de celui de la plateforme (le nom du modèle hérité est indiqué). Vous pourrez le changer plus tard dans les paramètres de l'évènement.\n\n## Étape 3 : Catégories\n\nDeux modes, au choix :\n- **Depuis un modèle** : cochez des modèles de catégories de l'organisation (nom, couleur et numéro affichés). S'il n'y en a pas, l'écran vous invite à en créer dans les modèles de catégories ou à passer en manuel.\n- **Manuelles** : **Ajouter une catégorie**, puis saisissez son nom, choisissez sa couleur (par défaut bleu) et son numéro.\n\n## Étape 4 : Récapitulatif\n\nLe récapitulatif rappelle titre, date, lieu, slug (« (auto) » s'il est vide), modèle de badge et nombre de catégories. Le bouton **Créer l'événement** valide. L'évènement est créé avec les **inscriptions fermées** ; vous les ouvrirez depuis sa page de configuration, où vous êtes redirigé après la création.\n\n## Questions fréquentes\n\n**Pourquoi la création est-elle refusée ?** Un message indique soit que la limite d'évènements du plan est atteinte, soit que votre abonnement n'est pas actif. Dans les deux cas, contactez le support.\n"
  },
  {
    "id": "org/index",
    "route": "/org/[orgId]",
    "space": "org",
    "title": "Tableau de bord",
    "audience": "organisateur",
    "access": "org.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe tableau de bord est la page d'accueil de votre organisation. Il donne une vue d'ensemble : nombre d'évènements, inscriptions du mois, derniers évènements et activité récente. Les blocs affichés dépendent de vos droits : un bloc dont vous n'avez pas le droit n'apparaît pas.\n\n:::permission org.events.list\n## Les indicateurs\n\n- **Événements actifs** : nombre d'évènements non archivés de l'organisation.\n- **Événements archivés** : nombre d'évènements archivés.\n- **Inscriptions ce mois** : inscriptions créées depuis le début du mois en cours, tous évènements de l'organisation confondus.\n:::\n\n:::permission billing.subscription.read\n## Le quota d'évènements\n\nUn quatrième indicateur, **Quota événements**, compare le nombre d'évènements actifs à la limite de votre plan (par exemple « 3 / 10 »). Il affiche « — » si le plan n'a pas de limite d'évènements. Lorsque l'usage dépasse 80 % de la limite, un message d'avertissement apparaît en haut de page : « Un quota dépasse 80 % ». Contactez alors le support si vous prévoyez d'aller plus loin.\n:::\n\n## Derniers événements\n\nLa carte **Derniers événements** liste les cinq évènements non archivés les plus récents, avec leur date et la mention « inscriptions ouvertes » lorsque c'est le cas. Cliquer sur un évènement ouvre son espace. Le lien **Tout voir** mène à la liste complète des évènements. S'il n'y en a aucun, l'écran indique « Aucun événement ».\n\n:::permission org.activity.read\n## Activité récente\n\nLa carte **Activité récente** présente les dix dernières actions enregistrées pour l'organisation, avec leur date et heure. Une action effectuée par le staff de la plateforme est précédée de « Staff · ». Pour le détail complet, ouvrez le journal d'activité.\n:::\n"
  },
  {
    "id": "org/members",
    "route": "/org/[orgId]/members",
    "space": "org",
    "title": "Membres",
    "audience": "organisateur",
    "access": "org.members.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les membres de votre organisation avec leur rôle. Sans le droit de gestion des membres, la liste est en lecture seule.\n\n:::permission org.members.manage\n## Inviter un membre\n\nLa carte **Inviter un membre** envoie un e-mail d'invitation. Renseignez le nom complet, l'adresse e-mail et choisissez le rôle (par défaut Manager lorsqu'il est attribuable), puis cliquez sur **Inviter**. Le sélecteur sépare les rôles système et les rôles personnalisés ; un rôle que vous ne pouvez pas attribuer est grisé avec sa raison. Le message « Invitation envoyée. » confirme l'envoi.\n:::\n\n## Le tableau\n\nColonnes : **Membre** (nom et e-mail), **Rôle** et **Invité le**.\n\n:::permission org.members.manage\nDans la colonne Rôle, le sélecteur permet de changer le rôle d'un membre (« Rôle mis à jour. »). Vous ne pouvez pas modifier votre propre rôle, ni celui d'un autre propriétaire (sauf droit plateforme) : le rôle s'affiche alors en simple étiquette.\n\nLe bouton **Retirer** exclut un membre après confirmation (« Retirer ce membre ? »). Le dernier propriétaire (OWNER) ne peut ni changer de rôle ni être retiré : la mention « Dernier OWNER » le signale.\n:::\n\n:::permission org.members.permissions.manage\nLe lien **Permissions** ouvre l'ajustement des permissions du membre. Il n'est pas proposé pour votre propre ligne, ni pour un autre propriétaire (sauf droit plateforme).\n:::\n"
  },
  {
    "id": "org/members/permissions",
    "route": "/org/[orgId]/members/[userId]/permissions",
    "space": "org",
    "title": "Permissions d'un membre",
    "audience": "organisateur",
    "access": "org.members.permissions.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran ajuste, pour un membre précis, les permissions héritées de son rôle. Les ajustements s'appliquent à l'organisation et à tous ses évènements. Le nom et l'adresse e-mail du membre figurent en en-tête, et le lien **Membres** ramène à la liste.\n\nVous ne pouvez pas ajuster vos propres permissions, ni celles d'un autre propriétaire (sauf droit plateforme) : vous êtes alors renvoyé à la liste des membres.\n\n## Le rôle du membre\n\nLe nom de l'organisation et le rôle du membre sont rappelés au-dessus de la matrice.\n\n## La matrice des permissions\n\nLes permissions sont regroupées par domaine. Pour chacune :\n- le libellé et l'état **Effectif** ou **Non effectif** (résultat après ajustements) ;\n- un sélecteur « Ajustement » à trois valeurs : **Hérité** (comportement du rôle, par défaut), **Ajouté** (accorde la permission) et **Retiré** (la retire).\n\nVous ne pouvez ajouter que des permissions que vous détenez vous-même : les autres affichent « (non détenue) » et ne sont pas sélectionnables.\n\nLe bouton **Enregistrer** applique les ajustements (« Permissions enregistrées. »).\n"
  },
  {
    "id": "org/notifications",
    "route": "/org/[orgId]/notifications",
    "space": "org",
    "title": "Notifications",
    "audience": "organisateur",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les notifications qui vous concernent dans cette organisation, des plus récentes aux plus anciennes.\n\n## Filtrer\n\nDeux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».\n\n## Une notification\n\nChaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.\n\n## Tout marquer comme lu\n\nLe bouton **Tout marquer comme lu** marque comme lues les notifications de cette organisation.\n\n## Parcourir l'historique\n\nSi d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.\n"
  },
  {
    "id": "org/payments",
    "route": "/org/[orgId]/payments",
    "space": "org",
    "title": "Paiements",
    "audience": "organisateur",
    "access": "billing.payments.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les paiements de votre organisation : abonnements et commandes d'impression. Il sert à retrouver un paiement, suivre son statut et ouvrir sa fiche.\n\n## Les filtres\n\nLes filtres sont conservés dans l'adresse de la page : vous pouvez la recharger ou la partager sans perdre le résultat. Un nouveau filtre repart de la première page.\n\n- **Statut** : Tous, En attente, Payé, Refusé, Annulé ou Expiré.\n- **Type** : Tous, Abonnement ou Impression.\n- **Du** / **Au** : période de création du paiement.\n- **Référence FedaPay** : recherche par référence de transaction (par exemple « trx_… »).\n\n**Filtrer** applique les critères ; **Réinitialiser** les efface.\n\n## Le tableau\n\nColonnes : **Date**, **Type**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** (référence FedaPay, « — » si absente) et un lien **Voir** vers la fiche du paiement. S'il n'y a aucun résultat, l'écran affiche « Aucun paiement. » La pagination s'affiche sous le tableau.\n"
  },
  {
    "id": "org/payments/detail",
    "route": "/org/[orgId]/payments/[paymentId]",
    "space": "org",
    "title": "Détail d'un paiement",
    "audience": "organisateur",
    "access": "billing.payments.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche en lecture seule présente un paiement de votre organisation. Le lien **Paiements** en haut ramène à la liste. Un paiement qui n'appartient pas à votre organisation est introuvable.\n\n## Le bloc Paiement\n\nIl affiche : **Montant**, **Devise**, **Statut** (En attente, Payé, Refusé, Annulé ou Expiré), **Type** (Abonnement ou Impression), **Plan** ou **Commande** concerné, **Changement** (Changement immédiat, Renouvellement ou Changement programmé, pour un abonnement), **Créé le**, **Approuvé le**, **Référence FedaPay**, **Identifiant FedaPay** et **Payeur** (nom et e-mail). Une valeur absente s'affiche « — ».\n\n## Le détail de l'abonnement\n\nPour un abonnement, un second bloc **Détail de l'abonnement** apparaît lorsque c'est pertinent : **Prix plein**, **Crédit déduit** (crédit au prorata de la période restante de l'ancien plan), **Montant payé**, et la **Période couverte**.\n\n## Imprimer le reçu\n\nLorsque le paiement a le statut Payé, le bouton **Imprimer le reçu** ouvre le reçu dans un nouvel onglet.\n"
  },
  {
    "id": "org/roles",
    "route": "/org/[orgId]/roles",
    "space": "org",
    "title": "Rôles",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les rôles système communs et les rôles personnalisés de votre organisation. Un rôle regroupe des permissions que vous attribuez ensuite aux membres.\n\n## Les onglets\n\nDeux onglets séparent les niveaux de rôles : **Organisation** (permissions de l'espace organisation) et **Évènement** (permissions à l'intérieur des évènements). Le bouton **Nouveau rôle** crée un rôle du niveau de l'onglet affiché.\n\n## La liste\n\nPour chaque rôle : son nom (cliquable tant qu'il n'est pas archivé), l'étiquette **Système** pour les rôles fournis par la plateforme, l'étiquette **Archivé**, sa description, le nombre de permissions et, lorsqu'il est connu, le nombre de membres qui le portent.\n\nActions :\n- **Dupliquer** : crée un nouveau rôle à partir de celui-ci (possible aussi pour un rôle système).\n- **Modifier** : réservé aux rôles personnalisés non archivés.\n- **Archiver** : archive un rôle personnalisé (« Rôle archivé. »).\n- **Restaurer** : remet en service un rôle archivé (« Rôle restauré. »).\n\nLes rôles système ne se modifient ni ne s'archivent.\n"
  },
  {
    "id": "org/roles/detail",
    "route": "/org/[orgId]/roles/[roleId]",
    "space": "org",
    "title": "Détail d'un rôle",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran affiche le contenu d'un rôle et, pour un rôle personnalisé, permet de le modifier. Le lien **Rôles** en haut ramène à la liste, sur l'onglet correspondant. Le nom et la description du rôle figurent en en-tête.\n\n## Rôle système ou archivé\n\nUn rôle système, ou un rôle archivé, s'affiche en lecture seule : un message l'explique (« Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé. » ou « Ce rôle est archivé : restaurez-le pour le modifier. »), suivi de la matrice des permissions cochées, sans possibilité de changement.\n\n## Rôle personnalisé\n\n- **Nom du rôle** (2 à 60 caractères) et **Description (facultative)** (500 caractères au plus).\n- La matrice des permissions, groupées par domaine : cochez ou décochez. Les permissions que vous ne détenez pas ne peuvent pas être ajoutées (« Vous ne détenez pas cette permission. »), mais celles déjà portées par le rôle restent décochables.\n- **Enregistrer** applique les changements (« Rôle enregistré. ») et ramène à la liste ; **Annuler** revient sans enregistrer.\n\n## Questions fréquentes\n\n**Un rôle introuvable ?** Seuls les rôles système communs et les rôles personnalisés de votre organisation sont accessibles ; tout autre identifiant mène à une page introuvable.\n"
  },
  {
    "id": "org/roles/new",
    "route": "/org/[orgId]/roles/new",
    "space": "org",
    "title": "Nouveau rôle",
    "audience": "organisateur",
    "access": "org.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran crée un rôle personnalisé d'organisation ou d'évènement, selon l'onglet d'où vous venez. Si vous arrivez par **Dupliquer**, le titre devient « Dupliquer un rôle » : la portée et les permissions sont reprises du rôle source, et le nom proposé se termine par « (copie) ».\n\n## Les champs\n\n- **Nom du rôle** : obligatoire, de 2 à 60 caractères.\n- **Description (facultative)** : 500 caractères au plus.\n\n## La matrice des permissions\n\nLes permissions sont regroupées par domaine, chacune avec son libellé et sa description. Cochez celles que le rôle doit accorder. Vous ne pouvez cocher que des permissions que vous détenez vous-même ; les autres sont grisées avec l'indication « Vous ne détenez pas cette permission. ». Lors d'une duplication, seules les permissions que vous pouvez accorder sont reprises.\n\n## Valider\n\n**Créer le rôle** (ou **Créer la copie** pour une duplication) enregistre le rôle (« Rôle créé. ») et vous ramène à la liste. Il reste inactif tant que le nom fait moins de 2 caractères. **Annuler** revient à la liste sans rien enregistrer.\n"
  },
  {
    "id": "org/settings",
    "route": "/org/[orgId]/settings",
    "space": "org",
    "title": "Paramètres de l'organisation",
    "audience": "organisateur",
    "access": "org.update",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran regroupe l'identité, l'adresse et le contact public de votre organisation. Le bouton **Modèle de badge par défaut** en haut mène au choix du modèle de badge de l'organisation.\n\n## Identité\n\n- **Nom**.\n- **Raison sociale**.\n- **Slug** : non modifiable ici, il est géré par le staff uniquement.\n- **Logo** : déposez une image (JPEG, PNG ou WebP, 5 Mo maximum) ou cliquez pour en choisir une. Une fois envoyé, **Retirer** supprime le logo de la fiche.\n\n:::permission org.upload\nL'envoi du logo exige le droit de téléverser les fichiers de l'organisation.\n:::\n\n## Adresse\n\n**Ligne 1**, **Ligne 2**, **Code postal**, **Ville** et **Pays**.\n\n## Administratif\n\n**Numéro fiscal / SIRET** et **Site web** (par exemple https://exemple.fr).\n\n## Contact public\n\n**E-mail de contact** et **Téléphone**.\n\n## Enregistrer\n\nLes modifications ne sont prises en compte qu'au clic sur **Enregistrer** (« Paramètres enregistrés. »). **Annuler** rétablit les valeurs d'origine. Un champ facultatif vidé est effacé.\n"
  },
  {
    "id": "org/settings/badge",
    "route": "/org/[orgId]/settings/badge",
    "space": "org",
    "title": "Modèle de badge",
    "audience": "organisateur",
    "access": "org.badge_settings.update",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran choisit le modèle de badge appliqué par défaut aux évènements de votre organisation. Chaque évènement peut ensuite le remplacer dans ses propres paramètres.\n\n## Le modèle effectif\n\nUn bandeau indique le « Template effectif » et son niveau : **organisation** si vous avez choisi un modèle, **plateforme** si l'organisation hérite du modèle par défaut de la plateforme.\n\nLorsqu'un modèle est choisi pour l'organisation, le bouton **Utiliser le défaut hérité** supprime ce choix et revient au modèle de la plateforme.\n\n## Les modèles proposés\n\nChaque carte montre l'aperçu du modèle, son nom, son format et son nombre de pages, sa description, et une icône d'imprimante lorsqu'il permet l'impression sur place. Le bouton **Sélectionner** retient ce modèle (« Template enregistré. ») ; le modèle retenu est signalé « Sélectionné ». La mention « Hérité à ce niveau » apparaît sur le modèle effectif qui n'a pas été choisi explicitement.\n"
  },
  {
    "id": "org/subscription",
    "route": "/org/[orgId]/subscription",
    "space": "org",
    "title": "Abonnement",
    "audience": "organisateur",
    "access": "billing.subscription.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran présente le plan de votre organisation, ses limites, les plans disponibles et l'historique des paiements.\n\n## Abonnement inactif\n\nSi l'abonnement n'est pas actif, un avertissement l'indique : la création d'évènements et l'accès à certaines pages sont limités, les évènements en cours restent ouverts. Vous pouvez renouveler depuis cet écran ou contacter le support.\n\n## Détails\n\nLe bloc **Détails** affiche le **Plan**, le **Statut**, la **Période** (« Annuel (365 jours) » ou « Mensuel (30 jours) »), le **Début**, la **Fin** (« Sans échéance » le cas échéant), **Actif** (Oui ou Non) et, si un changement a été programmé, la ligne **Changement programmé** avec le plan et la date.\n\n## Changer de plan\n\nLe bloc **Changer de plan** présente chaque plan en vente : nom, prix en FCFA par mois ou par an, limites d'évènements et de participants par évènement (« illimité » si aucune limite), et les mentions « Plan actuel » ou « Programmé ». Pour un changement immédiat avec crédit, le calcul est détaillé : prix plein, moins le crédit de la période restante, égale le montant à payer. Le montant exact est figé à la création du paiement.\n\nUn plan ne peut pas être choisi dans certains cas : abonnement déjà actif (la date de fin et la date à partir de laquelle le renouvellement est possible sont alors indiquées), ou crédit couvrant déjà le plan (contactez le support).\n\n:::permission billing.subscription.pay\nChaque plan a un bouton : **Renouveler** pour le plan actuel, **Passer à ce plan**, ou **Programmer à l'échéance** lorsque le changement prendra effet à la fin de la période en cours. Le bouton ouvre le paiement en ligne FedaPay. Un message d'erreur s'affiche si le paiement ne peut pas démarrer (changement déjà programmé, paiement déjà en cours, paiement en ligne indisponible, plan retiré de la vente).\n:::\n\nSans le droit de payer l'abonnement, l'écran précise que seul le propriétaire de l'organisation peut changer d'abonnement et n'affiche aucun bouton.\n\n## Limites effectives\n\nLe bloc **Limites effectives** indique le nombre d'**Événements** et de **Participants / événement** autorisés (« Illimité » si aucune limite).\n\n## Historique des paiements\n\nLes 20 derniers paiements : **Date**, **Objet**, **Montant**, **Statut**, **Référence**, et un lien **Voir** vers la fiche. Le lien **Voir tous les paiements** mène à la liste complète.\n"
  },
  {
    "id": "org/subscription/return",
    "route": "/org/[orgId]/subscription/return",
    "space": "org",
    "title": "Retour de paiement",
    "audience": "organisateur",
    "access": "billing.subscription.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nVous arrivez sur cet écran après un paiement d'abonnement sur FedaPay. Il indique le résultat du paiement.\n\n## Les résultats possibles\n\n- **Paiement confirmé. Votre abonnement … est actif.** : le plan est actif immédiatement.\n- **Paiement confirmé. Votre abonnement … sera activé le …** : le changement est programmé ; il prend effet à la date indiquée, ou à la fin de la période en cours si aucune date n'est connue.\n- **Paiement en cours de confirmation.** : FedaPay n'a pas encore confirmé. Le lien **Actualiser** recharge l'écran pour vérifier à nouveau.\n- **Le paiement n'a pas abouti. Votre abonnement n'a pas changé.** : aucun changement n'a été appliqué.\n- **Paiement introuvable.** : l'identifiant du paiement ne correspond à aucun paiement de l'organisation.\n\nLe lien **Retour à l'abonnement** ramène à l'écran Abonnement.\n"
  },
  {
    "id": "org/templates",
    "route": "/org/[orgId]/templates",
    "space": "org",
    "title": "Modèles de catégories",
    "audience": "organisateur",
    "access": "org.templates.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran gère les catégories réutilisables de l'organisation, que vous pouvez reprendre lors de la création d'un évènement. Sans le droit de gestion, la liste est en lecture seule.\n\n## Le tableau\n\nColonnes : **N°** (numéro de la catégorie), **Catégorie** (nom sur sa couleur) et **Options**. Les options possibles sont **Neutre** (badge neutre) et **Anonyme** ; « — » indique qu'aucune n'est activée. La liste est triée par numéro puis par nom, et paginée. S'il n'y a rien, l'écran affiche « Aucun modèle ».\n\n:::permission org.templates.manage\n## Ajouter, modifier, supprimer\n\nLe bouton **Ajouter** ouvre la fenêtre « Nouveau modèle ». Le crayon (« Éditer ») ouvre « Modifier le modèle ». La corbeille (« Supprimer ») supprime le modèle après confirmation (« Supprimer ce modèle ? »).\n\nLe formulaire contient :\n- **Nom** (obligatoire) ;\n- **Couleur** (bleu par défaut) ;\n- **Numéro** (de 0 à 999, 0 par défaut) ;\n- **Badge neutre** (désactivé par défaut) ;\n- **Anonyme (pas de photo/nom sur badge)** (désactivé par défaut).\n\n**Créer** (ou **Enregistrer** en modification) valide ; **Annuler** ferme la fenêtre.\n:::\n"
  },
];
