// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).
import type { PageDocEntry } from "./types";

export const PAGE_DOCS: PageDocEntry[] = [
  {
    "id": "account/index",
    "route": "/account",
    "space": "account",
    "title": "Mes inscriptions",
    "audience": "participant",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran est votre page d'accueil de participant. Il vous salue (« Bonjour » suivi de votre nom du compte) et liste toutes vos inscriptions à des évènements, avec leur statut.\n\n## Bandeau « Votre profil est incomplet »\n\nTant que votre profil n'est pas complété, un bandeau d'avertissement vous invite à fournir votre photo, votre pièce d'identité et votre structure, faute de quoi vous ne pouvez pas vous inscrire à un évènement. Le bouton **Compléter mon profil** ouvre le formulaire de complétion. Le bandeau disparaît dès que le profil est complété.\n\n## Mes inscriptions\n\nLes inscriptions sont classées de la plus récente à la plus ancienne. Chaque ligne affiche :\n\n- la bannière de l'évènement, si elle existe (masquée sur petit écran) ;\n- la date de l'évènement (jour et mois) ;\n- le titre de l'évènement, son lieu et la catégorie choisie ;\n- le statut de l'inscription : **En attente**, **Validé** ou **Rejeté** ;\n- pour une inscription rejetée, le motif du rejet (« Motif : … ») lorsqu'il a été renseigné.\n\nCliquer sur une ligne ouvre le détail de l'inscription. Si vous n'avez encore aucune inscription, l'écran affiche « Aucune inscription ».\n\nLorsque la liste dépasse une page, la pagination en bas de liste permet de passer aux pages suivantes.\n\n## Navigation de l'espace\n\nLe bandeau du haut donne accès à **Mes inscriptions**, **Profil**, **Notifications** et **Documentation**, ainsi qu'à la cloche de notifications, au bouton « ? » (cette aide) et à **Se déconnecter**.\n"
  },
  {
    "id": "account/notifications",
    "route": "/account/notifications",
    "space": "account",
    "title": "Notifications",
    "audience": "participant",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les notifications de votre espace participant. La cloche du bandeau du haut en affiche un aperçu ; cette page présente l'historique complet.\n\n## Filtre\n\nDeux onglets permettent de choisir ce qui est affiché :\n\n- **Toutes** : toutes vos notifications ;\n- **Non lues seulement** : uniquement celles que vous n'avez pas encore lues. S'il n'y en a aucune, l'écran affiche « Aucune notification non lue » ; sans aucune notification, « Aucune notification ».\n\n## Liste des notifications\n\nChaque notification affiche son titre, sa date relative et son message. Une notification non lue est signalée par la pastille **Non lue** et un titre en gras. Quand une notification contient un lien (par exemple vers une inscription), le titre ou un mot du message est cliquable ; d'autres liens peuvent apparaître sous le message.\n\n## Tout marquer comme lu\n\nLe bouton **Tout marquer comme lu**, en haut à droite, marque d'un coup toutes les notifications de votre espace comme lues.\n\n## Parcourir les plus anciennes\n\nLes notifications sont chargées par lots. **Notifications plus anciennes** affiche le lot suivant ; **Revenir aux plus récentes** ramène au début de la liste. Le filtre choisi est conservé.\n"
  },
  {
    "id": "account/profile",
    "route": "/account/profile",
    "space": "account",
    "title": "Mon profil",
    "audience": "participant",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran regroupe les informations enregistrées sur votre compte, utilisées pour vos inscriptions et imprimées sur votre badge. Une photo et une pièce d'identité valides sont nécessaires pour vous inscrire à un évènement.\n\n## Résumé du compte\n\nLe cadre du haut rappelle votre **Email** (non modifiable) et le **Nom du compte**, puis l'état de votre profil :\n\n- **Profil incomplet** : complétez tous les champs du formulaire pour pouvoir vous inscrire ;\n- **En cours de vérification** : vos documents sont examinés par la plateforme, vous pourrez vous inscrire une fois le profil validé ;\n- **Profil validé** : vous pouvez vous inscrire aux évènements ;\n- **Documents refusés** : le motif et les précisions éventuelles sont affichés ; corrigez les documents puis enregistrez pour les soumettre à nouveau.\n\n## Identité\n\n- **Prénom** et **Nom** : obligatoires, ils figureront sur votre badge.\n- **Structure (entreprise, école, organisation)** : obligatoire.\n\n## Photo\n\nFormat JPEG, PNG ou WebP, 5 Mo maximum, au format photo d'identité 7:9. Un encadré rappelle les règles : visage de face et centré, fond blanc uni, tête nue (sauf motif religieux) et sans lunettes de soleil, photo nette, bien éclairée, récente, sans filtre ni retouche, minimum de pixels indiqué à l'écran.\n\n- Choisissez un fichier : vous le recadrez dans la fenêtre « Recadrer la photo » avant l'envoi (« Envoi en cours… » s'affiche pendant le transfert).\n- Une fois la photo enregistrée, un aperçu s'affiche et **Recadrer** permet de la recadrer à nouveau.\n\n## Pièce d'identité\n\n- **Type de pièce d'identité** : CNI (valeur par défaut), Passeport, Permis ou Autre.\n- **Numéro de pièce** : obligatoire.\n- Justificatif : fichier JPEG, PNG, WebP ou PDF (5 Mo maximum), avec aperçu une fois envoyé.\n\nToute modification de la photo ou de la pièce d'identité relance la vérification par la plateforme.\n\n## Enregistrer\n\n**Enregistrer** valide le formulaire (« Profil enregistré. »). Les champs laissés vides ne sont pas envoyés, ce qui permet un enregistrement partiel, mais le profil reste incomplet tant que tout n'est pas renseigné. Les boutons sont désactivés pendant l'envoi d'un fichier.\n\n## Historique de mes soumissions\n\nSi vous avez déjà soumis des documents, la liste indique pour chaque soumission son état (**Validé**, **Rejeté** ou **En attente**), le motif et les précisions en cas de rejet, et la date de soumission.\n\n## Questions fréquentes\n\n**Pourquoi ne puis-je pas modifier mon e-mail ?** Il identifie votre compte et n'est pas modifiable depuis cet écran.\n\n**Mon profil a été refusé, que faire ?** Lisez le motif affiché, corrigez la photo ou la pièce, puis cliquez sur **Enregistrer** pour relancer la vérification.\n"
  },
  {
    "id": "account/profile/complete",
    "route": "/account/profile/complete",
    "space": "account",
    "title": "Compléter votre profil",
    "audience": "participant",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nAvant de vous inscrire à un évènement, la plateforme a besoin d'informations obligatoires : identité, structure, photo et pièce d'identité. Elles servent uniquement à vos badges. Cet écran présente le formulaire de profil avec ce message d'introduction.\n\n## Le formulaire\n\nIl est identique à celui de l'écran **Mon profil** :\n\n- **Identité** : **Prénom**, **Nom** et **Structure (entreprise, école, organisation)**, tous obligatoires.\n- **Photo** : JPEG, PNG ou WebP, 5 Mo maximum, format photo d'identité 7:9, avec rappel des règles et recadrage dans « Recadrer la photo ».\n- **Pièce d'identité** : **Type de pièce d'identité** (CNI par défaut, Passeport, Permis, Autre), **Numéro de pièce** et justificatif (JPEG, PNG, WebP ou PDF, 5 Mo maximum).\n\nToute modification de la photo ou de la pièce d'identité relance la vérification par la plateforme.\n\n## Enregistrer\n\n**Enregistrer** sauvegarde le profil puis vous redirige vers la page d'où vous veniez (par exemple l'inscription que vous aviez commencée). Si aucune destination valide n'est fournie, vous revenez à **Mes inscriptions**. Contrairement à l'écran **Mon profil**, aucun message de confirmation n'est affiché : la page d'arrivée montre le résultat.\n\n## Questions fréquentes\n\n**Puis-je enregistrer sans tout remplir ?** Oui, les champs vides sont ignorés, mais votre profil reste incomplet et l'inscription à un évènement reste bloquée.\n"
  },
  {
    "id": "account/registrations/detail",
    "route": "/account/registrations/[id]",
    "space": "account",
    "title": "Détail d'une inscription",
    "audience": "participant",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran présente une de vos inscriptions : l'évènement, son statut, les informations enregistrées au moment de l'inscription et, selon le cas, votre QR d'accueil ou les actions à mener après un rejet. Seul le titulaire de l'inscription y a accès ; sinon vous êtes renvoyé vers **Mes inscriptions**.\n\n## En-tête\n\nLa bannière de l'évènement, le lien **Retour** vers vos inscriptions, le titre, le statut (**En attente**, **Validé** ou **Rejeté**), puis la date et le lieu de l'évènement.\n\n## Messages d'état\n\n- **Inscription en attente de validation du profil** : affiché lorsque l'inscription est en attente et que votre profil n'est pas encore validé. L'organisateur n'examinera l'inscription qu'une fois la vérification de vos pièces terminée ; le lien **Voir mon profil** ouvre votre profil.\n- **Badge imprimé le …** : affiché pour une inscription validée dont le badge a été imprimé.\n\n## QR d'accueil\n\nPour une inscription validée, un QR code est affiché avec l'identifiant de l'inscription. Présentez-le à l'accueil, sur votre téléphone ou imprimé.\n\n## Inscription rejetée\n\nPour une inscription rejetée, l'écran affiche « Inscription rejetée » avec le motif et les précisions éventuelles. Vous pouvez :\n\n- cliquer sur **Modifier mon profil** pour corriger vos informations ;\n- choisir une autre **Catégorie** parmi celles de l'évènement (la catégorie actuelle est présélectionnée ; si vous en changez, un message précise la catégorie dans laquelle l'inscription sera resoumise) ;\n- cliquer sur **Resoumettre mon inscription** (« Inscription resoumise. »). Les informations enregistrées sont alors réécrites avec les valeurs actuelles de votre profil. En cas de changement de catégorie, vous êtes redirigé vers la nouvelle fiche d'inscription.\n\n## Informations enregistrées pour cette inscription\n\nUne copie figée de vos informations au moment de l'inscription : **Catégorie**, **Nom**, **E-mail**, **Structure**, **Pièce** (type et numéro) et **Inscrit le**.\n\n## Pièces fournies\n\nLes aperçus de la **Photo** et de la **Pièce d'identité** jointes à l'inscription.\n\n## Questions fréquentes\n\n**Pourquoi mes informations ne changent-elles pas après modification du profil ?** Cette fiche conserve les valeurs d'origine ; elles ne sont mises à jour qu'en cas de resoumission d'une inscription rejetée.\n"
  },
  {
    "id": "event/activity",
    "route": "/event/[eventId]/activity",
    "space": "event",
    "title": "Journal d'activité",
    "audience": "staff",
    "access": "event.activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe journal d'activité garde la trace des actions réalisées sur cet évènement, de la plus récente à la plus ancienne. La liste est paginée.\n\nSi vous n'avez que le droit de voir votre historique de scans (sans le journal complet de l'évènement), la liste se limite à vos propres scans de badges.\n\n## Le tableau\n\nColonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature), **Auteur** (adresse e-mail, « Système » pour une action automatique ; colonne masquée sur petit écran) et une flèche (« Voir le détail ») pour ouvrir l'entrée.\n\nUne action marquée **staff** a été effectuée par le staff de la plateforme et non par un membre de l'évènement ou de l'organisation. S'il n'y a aucune entrée, l'écran affiche « Aucune activité. »\n"
  },
  {
    "id": "event/activity/detail",
    "route": "/event/[eventId]/activity/[logId]",
    "space": "event",
    "title": "Détail d'une entrée du journal",
    "audience": "staff",
    "access": "event.activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche en lecture seule détaille une entrée du journal d'activité de l'évènement. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée qui n'appartient pas à cet évènement est introuvable ; sans le journal complet, seules vos propres entrées de scan de badge sont accessibles.\n\n## L'en-tête\n\nLe type de l'action, le numéro « ENTRÉE # », une description en clair et la date et l'heure. Deux boutons :\n- **Copier l'ID** : copie l'identifiant de l'entrée (le bouton affiche « Copié » un instant).\n- **Exporter JSON** : télécharge l'entrée au format JSON.\n\n## Détails de l'action\n\n**Type**, **Auteur** (adresse e-mail, ou « Système »), **Contexte** (l'évènement) et **Staff** (Oui si l'action vient du staff de la plateforme).\n\n## Modification\n\nLorsque l'action a modifié des valeurs, le bloc **Modification** montre pour chaque champ la valeur avant et après.\n\n## Charge utile brute\n\nLes données techniques de l'évènement, telles qu'enregistrées.\n\n## Colonne latérale\n\n- **Auteur** : nom, rôle éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.\n- **Contexte** : l'organisation, l'évènement et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.\n"
  },
  {
    "id": "event/badges",
    "route": "/event/[eventId]/badges",
    "space": "event",
    "title": "Badges",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les badges des inscriptions approuvées de l'évènement, pour les consulter, les prévisualiser en lot et les marquer comme imprimés.\n\n## Les filtres\n\n- La zone de recherche (« Rechercher un nom ou un identifiant… ») filtre la liste une fois la saisie terminée.\n- Le sélecteur **Filtrer les badges** propose **Non imprimés** (valeur par défaut), **Imprimés**, **All-access** et **Tous**.\n- Le filtre, la recherche, la page et la taille de page sont conservés dans l'adresse de la page : un rechargement ou un lien partagé retrouve le même affichage.\n\nChanger de filtre ou de recherche abandonne la sélection en cours (message « La sélection a été réinitialisée. »).\n\n## Sélectionner des badges\n\nCochez des lignes, ou cliquez sur **Tout sélectionner (n)** : cela sélectionne tous les badges correspondant au filtre en cours, pas seulement ceux de la page affichée. Le bouton devient **Tout désélectionner** quand tout est déjà sélectionné.\n\nDès qu'au moins un badge est sélectionné, une barre d'actions apparaît :\n- **Aperçu PDF** : ouvre dans un nouvel onglet la page d'impression par lot avec votre sélection (voir « Impression par lot »).\n- **Marquer imprimés** : marque tous les badges sélectionnés comme imprimés (« n badge(s) marqué(s) imprimé(s). »). L'impression elle-même n'est pas lancée : le marquage enregistre seulement qu'ils l'ont été.\n\n## Le tableau\n\nColonnes : une case de sélection, **Nom**, **Catégorie** (numéro et nom ; colonne masquée sur petit écran) et **Badge**. La colonne Badge indique **Imprimé** ou « Non imprimé », avec l'étiquette **ALL ACCESS** si l'accès à toutes les zones a été accordé. Le lien **Voir** ouvre la fiche du badge. S'il n'y a rien à afficher, l'écran indique « Aucun badge. »\n\nSous le tableau, la pagination permet de changer de page et de choisir le nombre de lignes par page.\n"
  },
  {
    "id": "event/badges/detail",
    "route": "/event/[eventId]/badges/[badgeId]",
    "space": "event",
    "title": "Fiche d'un badge",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche présente l'aperçu du badge d'une inscription, permet de le télécharger, de l'imprimer et de le marquer comme imprimé. Le lien **Badges** en haut ramène à la liste. Une inscription qui n'appartient pas à cet évènement est introuvable.\n\n## L'aperçu et les actions\n\nL'aperçu est généré à partir du modèle de badge de l'évènement. Pendant le chargement, « Chargement de l'aperçu… » s'affiche ; en cas d'échec, le bouton « Aperçu indisponible, réessayer » relance le chargement.\n\nSous l'aperçu :\n- **Télécharger** : télécharge le badge en PDF.\n- **Imprimer** : ouvre le PDF dans un nouvel onglet pour l'imprimer.\n- **Marquer imprimé** : enregistre le badge comme imprimé (« Badge marqué imprimé. »). L'état à droite indique « Non imprimé », « Imprimé » ou « Imprimé le » suivi de la date.\n\nUn aperçu, un téléchargement ou une impression ne marquent jamais le badge : seul le bouton **Marquer imprimé** le fait. Ce bouton est désactivé, avec une explication sous les actions, si l'évènement est archivé (« Événement archivé : le marquage est désactivé. ») ou si l'inscription n'est pas approuvée (« Seules les inscriptions approuvées peuvent être marquées imprimées. »).\n\n## Informations\n\nLa carte **Informations** rappelle le **N°** de l'inscription, le **Nom** (« Identité masquée » si la catégorie est anonyme), la **Catégorie** et la mention **ALL ACCESS** (Oui ou Non). Le lien **Voir l'inscription** ouvre la fiche de l'inscription.\n"
  },
  {
    "id": "event/badges/print",
    "route": "/event/[eventId]/badges/print",
    "space": "event",
    "title": "Impression par lot",
    "audience": "staff",
    "access": "badge.print",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran prépare l'impression d'une sélection de badges faite depuis la liste des badges (bouton **Aperçu PDF**). Il s'ouvre dans un nouvel onglet et affiche le nombre de badges à imprimer.\n\nSi la sélection n'est plus disponible (page ouverte directement, ou stockage du navigateur indisponible), l'écran indique « Sélection introuvable : revenez à la liste des badges. » En cas d'échec de chargement : « Le chargement de la sélection a échoué. Rechargez la page. »\n\n## Le lot\n\nSeules les inscriptions approuvées sont retenues. Si certains identifiants de la sélection sont introuvables ou non approuvés, un avertissement l'indique (« n identifiant(s) ignoré(s) : introuvables ou non approuvés. »). Sans aucun badge, l'écran affiche « Aucun badge à imprimer. »\n\nLa carte **Badges du lot** liste chaque badge avec son nom (« Identité masquée » pour une catégorie anonyme), son numéro, sa catégorie et la mention « Imprimé » s'il l'est déjà. Cliquer sur une ligne affiche l'aperçu du badge à droite.\n\n## Les actions\n\n- **Préparer le ZIP** : lance la préparation d'un fichier ZIP contenant un PDF par badge. Pendant la préparation, l'écran affiche « Préparation… » avec le nombre de badges ; vous pouvez recharger la page, le suivi reprend. Si la préparation tarde, un message précise que vous pouvez fermer la page et revenir plus tard. Une fois prêt, le bouton devient **Télécharger le ZIP**. En cas d'échec, le message d'erreur s'affiche.\n- **Marquer imprimés** : marque tous les badges du lot comme imprimés (« n badge(s) marqué(s) imprimé(s). »). Le marquage se fait par paquets ; s'il s'interrompt, le message indique combien de badges ont été marqués, et un nouvel essai ne reprend que le reste. Ce bouton est désactivé si l'évènement est archivé (« Événement archivé : le marquage est désactivé. »).\n\nLe marquage enregistre que les badges ont été imprimés et peut déclencher les notifications et e-mails de badge imprimé prévus pour les participants.\n"
  },
  {
    "id": "event/blocked-documents",
    "route": "/event/[eventId]/blocked-documents",
    "space": "event",
    "title": "Documents bloqués",
    "audience": "staff",
    "access": "registration.block",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette adresse n'affiche pas d'écran propre : les documents bloqués sont gérés dans l'écran **Listes de blocage**, onglet **Documents**. Vous y êtes redirigé automatiquement (vers l'écran Listes de blocage, ouvert sur l'onglet **E-mails** : cliquez sur **Documents** pour accéder à la liste des pièces bloquées).\n\nVoir la documentation de l'écran **Listes de blocage** pour le détail.\n"
  },
  {
    "id": "event/blocked-emails",
    "route": "/event/[eventId]/blocked-emails",
    "space": "event",
    "title": "Listes de blocage",
    "audience": "staff",
    "access": "registration.block",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLes listes de blocage empêchent certaines personnes de s'inscrire à l'évènement : par adresse e-mail, ou par numéro de pièce d'identité. Deux onglets, **E-mails** et **Documents**, portent chacun une pastille avec le nombre d'entrées de la liste. L'onglet actif est conservé dans l'adresse de la page ; chaque liste a sa propre pagination.\n\n## L'onglet E-mails\n\nLe formulaire du haut ajoute une adresse à bloquer :\n- **E-mail à bloquer** (obligatoire) ;\n- **Raison (optionnelle)** ;\n- le bouton **Bloquer** ajoute l'adresse (« E-mail bloqué. »). Si elle l'est déjà, le champ affiche « Cet e-mail est déjà bloqué. »\n\nLe tableau liste les adresses : colonnes **E-mail**, **Raison** (« — » si vide) et **Depuis** (date de l'ajout). L'icône corbeille (« Retirer ») supprime l'adresse de la liste après confirmation (« Retirer cet email de la liste de blocage ? »). S'il n'y a aucune entrée : « Aucun e-mail bloqué. »\n\n## L'onglet Documents\n\nMême principe avec un numéro de pièce :\n- **Numéro de pièce à bloquer** (obligatoire) ;\n- **Raison (optionnelle)** ;\n- **Bloquer** (« Document bloqué. » ; si déjà présent : « Ce document est déjà bloqué. »).\n\nLe tableau a pour colonnes **Document**, **Raison** et **Depuis**. L'icône corbeille retire le document après confirmation (« Retirer ce document de la liste de blocage ? »). S'il n'y en a aucun : « Aucun document bloqué. »\n"
  },
  {
    "id": "event/categories",
    "route": "/event/[eventId]/categories",
    "space": "event",
    "title": "Catégories",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les catégories de participation de l'évènement (par exemple « Participant », « Intervenant »). Chaque inscription appartient à une catégorie, qui détermine l'apparence du badge. Sans le droit de gérer les catégories, la liste est en lecture seule.\n\n## Le tableau\n\nColonnes : **N°** (numéro de la catégorie), **Catégorie** (nom et couleur), **Options**, **Inscriptions** (nombre d'inscriptions dans la catégorie) et une colonne d'actions. La colonne Options affiche **Neutre** et/ou **Anonyme** selon la catégorie, « — » si aucune. Sans catégorie, l'écran affiche « Aucune catégorie » et invite à créer la première. La liste est paginée.\n\n:::permission event.categories.manage\n## Ajouter, importer, modifier, supprimer\n\nEn haut de l'écran :\n- **Ajouter** ouvre la fenêtre **Nouvelle catégorie** ;\n- **Importer un modèle** ouvre **Importer des modèles de catégories** : cochez un ou plusieurs modèles de l'organisation, puis **Importer (n)** (« n modèle(s) importé(s). »). S'il n'y en a aucun : « Aucun modèle disponible pour cette organisation. »\n\nSur chaque ligne, le crayon (« Éditer ») ouvre **Modifier la catégorie** et la corbeille (« Supprimer ») supprime la catégorie.\n\nLe formulaire de catégorie contient :\n- **Nom** (obligatoire, unique dans l'évènement : « Le nom « … » est déjà utilisé dans cet événement. ») ;\n- **Couleur** (bleu par défaut) ;\n- **Numéro** (de 0 à 999, 0 par défaut, unique dans l'évènement : « Le numéro … est déjà utilisé dans cet événement. ») ;\n- **Badge neutre (couleur grise sur le PDF)** : désactivé par défaut ;\n- **Anonyme (pas de nom ni de photo sur le badge)** : désactivé par défaut. Dans les écrans de badges, l'identité de ces participants s'affiche « Identité masquée ».\n\nBoutons **Créer** (« Catégorie créée. ») ou **Enregistrer** (« Catégorie modifiée. »), et **Annuler**.\n\n**Supprimer** une catégorie vide demande confirmation (« Supprimer la catégorie « … » ? ») puis la supprime (« Catégorie supprimée. »). Si la catégorie contient des inscriptions, la fenêtre **Réaffecter les inscriptions de « … »** s'ouvre : choisissez la catégorie de destination dans **Vers :** puis **Réaffecter et supprimer** (« Inscriptions réaffectées, catégorie supprimée. »). Sans autre catégorie disponible, il faut d'abord en créer une.\n:::\n"
  },
  {
    "id": "event/index",
    "route": "/event/[eventId]",
    "space": "event",
    "title": "Tableau de bord",
    "audience": "organisateur",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe tableau de bord est la page d'accueil de l'espace évènement. Son contenu dépend de vos droits : un rôle de lecture voit les chiffres de l'évènement, un opérateur de scan ou de poste sur place voit un tableau de bord réduit. Si votre rôle ne donne accès à aucun de ces contenus, vous êtes envoyé vers la première entrée de votre menu.\n\n## L'en-tête\n\nL'image de couverture de l'évènement, puis son titre et la mention « Tableau de bord de l'événement ».\n\n## Informations de l'événement\n\nLa carte rappelle les dates, le lieu, la description et les catégories de l'évènement. L'étiquette **Inscriptions ouvertes** ou **Inscriptions fermées** indique l'état des inscriptions.\n\n:::permission event.settings.update\n## Images à recadrer\n\nLe bandeau **Images à recadrer** apparaît tant que le logo ou la bannière ne respecte pas le cadre du modèle de badge : la génération des badges est alors bloquée. Il liste chaque image concernée, avec un lien **Recadrer dans les paramètres**.\n:::\n\n## Lien d'inscription public\n\nLa carte **Lien d'inscription public** montre l'adresse de la page d'inscription des participants. **Copier** la copie dans le presse-papiers (le bouton affiche « Copié » un instant) et **Ouvrir** l'ouvre dans un nouvel onglet. Quand les inscriptions sont fermées, la carte précise que la page affiche un message de fermeture.\n\n:::permission scan.check-in\n## Scanner\n\nLe bloc affiche **Mes scans** (le nombre de badges que vous avez scannés sur cet évènement) et le bouton **Ouvrir le scanner**.\n:::\n\n:::permission event.read.aggregated\n## Les chiffres\n\nUne première rangée affiche **En attente**, **Approuvées**, **Rejetées** et **Badges imprimés**. Une seconde affiche **Scans aujourd'hui** et **Scans total** (tous les scans de l'évènement, pas seulement les vôtres).\n:::\n\n:::permission event.read.detailed\n## Quota et dernières inscriptions\n\nAvec les chiffres, la tuile **Quota inscriptions** compare le nombre d'inscriptions en attente ou approuvées au maximum de participants prévu par l'abonnement de l'organisation (« — » si aucune limite n'est connue). Au-delà de 80 %, l'alerte « Le quota d'inscriptions dépasse 80 %. » s'affiche.\n\nLa carte **Dernières inscriptions** liste les dix plus récentes (nom, e-mail, statut, date) ; cliquer sur une ligne ouvre l'inscription, et **Tout voir** ouvre la liste complète. Sans inscription : « Aucune inscription pour le moment ».\n:::\n\n## Tableau de bord opérateur\n\nSi vous ne pouvez lire ni les chiffres agrégés ni les données détaillées, l'écran est réduit à l'image de couverture, au titre **Tableau de bord opérateur**, au bloc de scan (si vous pouvez contrôler l'accès) et, si vous tenez le poste d'impression sur place, à la carte **Poste sur place** avec le bouton **Ouvrir le poste d'impression sur place**.\n"
  },
  {
    "id": "event/members",
    "route": "/event/[eventId]/members",
    "space": "event",
    "title": "Membres",
    "audience": "organisateur",
    "access": "event.members.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste l'équipe de l'évènement et ses rôles : vous pouvez inviter des membres, changer leur rôle et les retirer. La liste est paginée.\n\n## Inviter un membre\n\nLe bouton **Inviter** ouvre la fenêtre **Inviter un membre** :\n- **Email** (obligatoire) ;\n- **Nom (optionnel si l'utilisateur existe)** ;\n- le sélecteur de rôle, parmi les rôles que vous pouvez attribuer (Opérateur par défaut lorsqu'il est attribuable) ; un rôle que vous ne pouvez pas attribuer est grisé avec sa raison.\n\n**Inviter** envoie l'invitation (« Invitation envoyée. »). Si la personne est déjà membre, le champ e-mail affiche « Cet utilisateur est déjà membre de l'événement. »\n\n## Le tableau\n\nColonnes : **Membre** (nom et e-mail), **Rôle**, **Depuis** (date d'ajout) et une colonne d'actions. Sans membre, l'écran affiche « Aucun membre ».\n\n- Le sélecteur de la colonne Rôle change le rôle du membre (« Rôle mis à jour. »). En cas d'échec, la liste se recharge et retrouve la valeur enregistrée (« Échec du changement de rôle. »).\n- La corbeille (« Retirer ») retire le membre après confirmation (« Retirer … ? »), puis affiche « Membre retiré. »\n"
  },
  {
    "id": "event/notifications",
    "route": "/event/[eventId]/notifications",
    "space": "event",
    "title": "Notifications",
    "audience": "staff",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les notifications qui vous concernent dans cet évènement, des plus récentes aux plus anciennes.\n\n## Filtrer\n\nDeux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».\n\n## Une notification\n\nChaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.\n\n## Tout marquer comme lu\n\nLe bouton **Tout marquer comme lu** marque comme lues les notifications de cet évènement.\n\n## Parcourir l'historique\n\nSi d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.\n"
  },
  {
    "id": "event/print",
    "route": "/event/[eventId]/print",
    "space": "event",
    "title": "Impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les commandes d'impression de badges de l'évènement et vous permet d'en créer. Une commande est suivie avec l'équipe Badge : elle passe par un devis, que vous acceptez puis réglez.\n\n## Nouvelle commande\n\nLe bouton **Nouvelle commande** ouvre l'assistant de création. Il n'est pas proposé pour un évènement archivé, ni au staff de la plateforme en consultation (lecture seule).\n\n## Crédit d'impression\n\nLorsque votre organisation a un solde de crédit d'impression ou un historique de mouvements, la carte **Crédit d'impression** affiche le solde en FCFA et la liste des mouvements (crédits gagnés, par exemple pour des badges non utilisés, et crédits appliqués à une commande). Sans solde ni historique, la carte n'apparaît pas.\n\n## Le tableau\n\nColonnes : **Référence** (lien vers la commande), **Type** (« En amont » ou « Pendant l'évènement »), **Badges**, **Total** (en FCFA), **Statut** et **Envoyée le** (« — » tant qu'elle n'est pas envoyée). Une pastille dorée à côté de la référence indique le nombre de messages non lus de l'équipe Badge. S'il n'y a aucune commande : « Aucune commande d'impression pour cet évènement. » La liste est paginée.\n\nLes statuts possibles sont : Brouillon, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée et Annulée.\n"
  },
  {
    "id": "event/print/detail",
    "route": "/event/[eventId]/print/[requestId]",
    "space": "event",
    "title": "Commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette page suit une commande d'impression : son état, ses informations, les échanges avec l'équipe Badge, le devis et les paiements. Le lien **Impression** en haut ramène à la liste. Les actions décrites plus bas ne sont pas proposées au staff de la plateforme en consultation, qui ne peut ni modifier, ni accepter, ni annuler, ni écrire.\n\n## L'en-tête\n\nLe titre « Commande d'impression » suivi de la référence, et son statut (Brouillon, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée ou Annulée). Une commande complémentaire ou principale est reliée par des liens (« Complément de … », « Commande complémentaire … »).\n\nBoutons d'action, selon le statut :\n- **Voir les badges (n)** : pour une commande en amont, liste paginée des badges de la commande (nom, catégorie, statut de l'inscription, imprimé oui/non), avec recherche par nom.\n- **Modifier** : ouvre l'assistant de modification, tant que la commande est un brouillon, envoyée ou en devis et que l'évènement n'est pas archivé.\n- **Accepter le devis vN** : accepte le devis envoyé (« Devis accepté. »). Seul le propriétaire de l'organisation le peut ; sinon le message « Seul le propriétaire de l'organisation peut accepter ce devis. » s'affiche.\n- **Annuler la commande** : disponible jusqu'au statut Devis accepté ; après confirmation (« Voulez-vous vraiment annuler cette commande d'impression ? Les badges réservés seront libérés. »), la commande passe à Annulée. **Garder la commande** referme la fenêtre.\n- **Payer** (avec le montant en FCFA) : une fois le devis accepté, ouvre la page de paiement FedaPay. Seul le propriétaire de l'organisation peut payer. Si un paiement est déjà en cours, la mention « Un paiement est en cours. Vous pouvez le reprendre. » s'affiche. Le bouton n'apparaît pas lorsque le montant est nul : un devis entièrement couvert par le crédit d'impression passe directement à Payée.\n\n## Colonne Infos\n\nLe résumé de la commande : référence, statut, **Type**, **Badges**, puis pour une commande en amont le **Mode de remise**, l'**Adresse de livraison**, le **Contact**, le **Téléphone** et la **Date souhaitée** ; pour une commande sur place le **Lieu d'impression**, le **Contact sur place**, le **Téléphone** et les **Créneaux de présence** ; les **Remarques** et le **Total**.\n\nAu-dessus, selon le cas :\n- une alerte indiquant le crédit d'impression disponible, tant que la commande est envoyée ou en devis ;\n- pour une commande sur place, une alerte si le modèle de badge n'est plus adapté à l'impression sur place (l'équipe Badge ne peut pas avancer la commande), avec le lien **Changer le modèle de badge** ;\n- pour une commande sur place payée, le compteur d'impression (« n / m badges imprimés », plafond et marge, barre de progression et alertes à 90 % de la commande, au-delà de la commande, et à l'atteinte du plafond).\n\n## Colonne Discussion\n\nLes échanges avec l'équipe Badge : vos messages à droite, ceux de l'« Équipe Badge » à gauche, et des évènements automatiques (envoi, devis, changements) au centre. Les nouveaux messages arrivent seuls toutes les 10 secondes ; si vous avez fait défiler vers le haut, le bouton **Nouveaux messages** vous ramène en bas. Sans échange : « Aucun échange pour le moment. »\n\nPour écrire (sauf sur un brouillon) : saisissez le message (« Écrire un message à l'équipe Badge… », 5 000 caractères maximum), éventuellement **Joindre un fichier** (JPEG, PNG, WebP ou PDF) puis **Envoyer**. Ouvrir cette page marque les messages comme lus.\n\n## Colonne Devis\n\nLa carte **Devis vN** (ou **Lignes de la commande** avant le premier devis) affiche le **Total estimé** et le nombre de lignes et de badges. Le prix définitif est fixé par l'équipe Badge dans le devis. La carte **Paiements** liste les paiements (date, objet, montant, statut, référence).\n\nSur écran étroit, les trois colonnes deviennent trois onglets : **Infos**, **Discussion** (par défaut) et **Devis**.\n"
  },
  {
    "id": "event/print/edit",
    "route": "/event/[eventId]/print/[requestId]/edit",
    "space": "event",
    "title": "Modifier une commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'assistant guide la préparation d'une commande d'impression, du choix des badges à l'envoi. Il sert aussi bien à compléter un brouillon qu'à modifier une commande déjà envoyée ou au stade du devis. Le lien en haut (la référence de la commande) ramène à son détail.\n\nLa modification n'est possible que pour une commande au statut Brouillon, Envoyée ou Devis envoyé, sur un évènement non archivé, et pas pour le staff en consultation. Sinon, vous revenez au détail de la commande. Si le chargement échoue : « Impossible de charger la commande. Rechargez la page. »\n\nLe bandeau de progression indique les étapes : **Type**, **Badges** (**Quantité** pour une commande sur place), **Support**, **Accessoires**, **Remise**, **Récapitulatif**. **Suivant** enregistre l'étape et passe à la suivante ; **Précédent** revient en arrière.\n\n## Étape Badges (commande en amont)\n\nChoisissez les badges à imprimer :\n- **Tous les badges disponibles** : toutes les inscriptions approuvées ;\n- **Par catégorie** : cochez une ou plusieurs catégories (le nombre de badges disponibles est indiqué) ;\n- **Sélection manuelle** : cochez les participants un par un, avec une zone de recherche (« Rechercher un participant ou une catégorie »). Un participant déjà inclus dans une autre commande est grisé avec la mention « Déjà dans » suivie de la référence ; la mention « Déjà imprimé » signale un badge déjà imprimé. Seuls les 200 premiers résultats sont affichés : affinez la recherche si besoin.\n\nLe nombre de badges sélectionnés s'affiche en dessous. Il faut en sélectionner au moins un.\n\n## Étape Quantité (commande sur place)\n\nSaisissez le **Nombre de badges à imprimer sur place** (entier d'au moins 1).\n\n## Étape Support\n\nChoisissez le support du badge parmi ceux proposés par l'équipe Badge (carte avec photo, catégorie, prix « À partir de » et délai de fabrication). S'il n'y en a aucun : « Aucun support de badge n'est proposé pour le moment. » Un support déjà choisi qui n'est plus proposé est signalé et sera retiré de la commande.\n\nLe support choisi s'ouvre dans un configurateur : ses options (liste de choix, cases à cocher, couleurs, texte, fichier à téléverser, répartition des quantités) sont expliquées par leurs libellés ; un astérisque marque les options obligatoires et un supplément éventuel est indiqué à côté du choix. Les fichiers acceptés sont JPEG, PNG, WebP ou PDF, 5 Mo maximum. La **Quantité** d'un support est verrouillée : elle est égale au nombre de badges. Un encadré donne le **Prix unitaire estimé** et le **Total estimé** ; ce n'est qu'une estimation, le prix définitif est fixé dans le devis.\n\n## Étape Accessoires\n\nFacultative. Cliquez sur les accessoires souhaités (cordons, porte-badges…) : chacun s'ouvre dans son configurateur. La **Quantité** d'un accessoire ne peut pas dépasser le nombre de badges ; si le nombre de badges change, une quantité égale à l'ancien nombre suit le nouveau. Un message prévient lorsque la quantité est inférieure au nombre de badges.\n\n## Étape Remise\n\nPour une commande **en amont** :\n- **Mode de remise** : **Retrait** (vous récupérez les badges auprès de l'équipe Badge) ou **Livraison** (à l'adresse indiquée, avec **Adresse de livraison**, **Nom du contact** et **Téléphone du contact**) ;\n- **Date souhaitée (facultatif)**.\n\nPour une commande **sur place** :\n- **Lieu d'impression**, **Nom du contact sur place** et **Téléphone du contact** ;\n- **Créneaux de présence** : une date, une heure de début et une heure de fin par créneau ; **Ajouter un créneau** en ajoute un, **Retirer** supprime un créneau. Il faut au moins un créneau complet.\n\nDans les deux cas, **Remarques (facultatif)** (2 000 caractères maximum).\n\n## Étape Récapitulatif\n\nLe tableau reprend chaque ligne (libellé, options, quantité, prix unitaire, total) et le **Total estimé**, suivi du mode de remise ou du lieu sur place. Un message rappelle que le prix définitif est fixé par l'équipe Badge dans le devis. Si votre organisation dispose de crédit d'impression, une phrase indique le montant que l'équipe Badge pourra appliquer au devis.\n\nLe bouton final est **Envoyer la commande** pour un brouillon (« Commande envoyée. »), ou **Enregistrer les modifications** pour une commande déjà envoyée (« Modifications enregistrées. »).\n"
  },
  {
    "id": "event/print/new",
    "route": "/event/[eventId]/print/new",
    "space": "event",
    "title": "Nouvelle commande d'impression",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nPremière étape de l'assistant de commande : le choix du type de commande. Le lien **Impression** en haut ramène à la liste. L'écran n'est pas accessible pour un évènement archivé ni pour le staff en consultation : vous revenez alors à la liste des commandes.\n\n## Type de commande\n\nDeux choix :\n- **En amont** : les badges sont imprimés avant l'évènement, pour les inscriptions choisies.\n- **Pendant l'évènement** : impression sur place, pendant l'évènement.\n\nL'option **Pendant l'évènement** est grisée tant que la disponibilité est en cours de vérification, et lorsque le modèle de badge de l'évènement n'est pas adapté à l'impression sur place. Dans ce cas, le message « Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place. » s'affiche avec le lien **Changer le modèle de badge** vers les paramètres du badge.\n\nLe bouton **Continuer** (actif une fois un type choisi) crée un brouillon de commande et ouvre l'étape suivante de l'assistant (voir la documentation de la modification d'une commande).\n"
  },
  {
    "id": "event/print/onsite",
    "route": "/event/[eventId]/print/onsite",
    "space": "event",
    "title": "Poste sur place",
    "audience": "staff",
    "access": "print.onsite.operate",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les commandes d'impression sur place ouvertes au poste de l'évènement : vous y choisissez celle sur laquelle vous imprimez les badges des participants déjà approuvés. Il ne montre ni prix ni lignes de devis.\n\n## La liste\n\nSeules les commandes sur place au statut Payée, En production ou Prête sont listées, de la plus récente à la plus ancienne. Chaque ligne affiche la référence, le lieu d'impression s'il est connu, le statut, et le lien **Ouvrir le poste** qui ouvre le poste d'impression de la commande.\n\nS'il n'y en a aucune, ou si l'évènement est archivé : « Aucune commande ouverte au poste sur place. »\n"
  },
  {
    "id": "event/print/requestId/onsite",
    "route": "/event/[eventId]/print/[requestId]/onsite",
    "space": "event",
    "title": "Poste d'impression",
    "audience": "staff",
    "access": "print.onsite.operate",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe poste d'impression sert à imprimer sur place le badge d'un participant déjà approuvé. Il identifie le participant, affiche son badge et lance l'impression ; il n'inscrit et n'approuve personne. Le lien **← Commande …** en haut ramène à la liste des commandes du poste. Si l'évènement est archivé ou si la commande n'est plus imprimable, vous revenez à cette liste.\n\n## L'en-tête\n\nLe titre « Poste d'impression · » suivi de la référence, le nom de l'évènement et le lieu d'impression, et, si l'équipe Badge en a renseigné une, la mention « Imprimante : » avec la note correspondante.\n\n## Compteur\n\nLa carte de compteur affiche « n / m badges imprimés » (imprimés sur commandés), le plafond et la marge, une barre de progression et des alertes : « 90 % de la commande atteinte », puis le nombre de badges au-delà de la commande (facturés après l'évènement), puis « Plafond atteint : l'impression est bloquée ».\n\n## Identifier un participant\n\n- **Caméra** : active par défaut, elle lit le QR d'accueil du participant ; **Désactiver la caméra** / **Activer la caméra** la coupe ou la rallume.\n- **Recherche** : saisissez un nom, un e-mail, un identifiant ou le contenu d'un QR (au moins 2 caractères) puis **Rechercher**. Les résultats affichent le nom, l'e-mail et la mention « Déjà imprimé » le cas échéant ; cliquer sur un résultat ouvre sa fiche. « Aucun résultat. » si rien ne correspond.\n\nTant qu'aucune fiche n'est ouverte, l'écran invite à scanner le QR d'accueil d'un participant ou à le rechercher. Un participant refusé s'affiche en alerte, par exemple « Inscription non approuvée (en attente) : le poste n'approuve personne. »\n\n## La fiche et l'impression\n\nLa fiche montre la photo, le nom, l'e-mail, la catégorie et l'aperçu du badge.\n- **Imprimer** : prépare le badge, l'ouvre dans un nouvel onglet pour l'imprimer et l'ajoute au compteur (« Badge envoyé à l'impression »). Le lien **Ouvrir le PDF** permet de le rouvrir. Le bouton est désactivé quand le plafond est atteint (« Plafond atteint : seules les réimpressions restent possibles. »).\n- Si le badge a déjà été imprimé hors du poste, un avertissement précise que cette impression sera comptée.\n- Si le badge a déjà été imprimé à ce poste, la fiche indique « Déjà imprimé le … » et propose **Réimprimer**, qui n'est pas comptée.\n"
  },
  {
    "id": "event/print/return",
    "route": "/event/[eventId]/print/[requestId]/return",
    "space": "event",
    "title": "Retour de paiement",
    "audience": "organisateur",
    "access": "print.request",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nVous arrivez sur cette page en revenant de la page de paiement FedaPay, après le règlement d'un devis d'impression. Elle affiche le résultat du paiement ; seul l'état confirmé par FedaPay fait foi.\n\n## Les résultats possibles\n\n- **Paiement confirmé** : « Paiement confirmé. La commande … est payée ; l'équipe Badge lance la production. »\n- **Paiement reçu** : « Paiement reçu. L'équipe Badge vérifie votre commande et revient vers vous. » (paiement reçu mais non rapproché de la commande) ; ou « Paiement reçu pour un montant inattendu. L'équipe Badge vérifie et vous recontacte. »\n- **Paiement en cours de confirmation** : la page se met à jour dès que FedaPay confirme ; le lien **Actualiser** recharge l'état.\n- **Échec** : « Le paiement n'a pas abouti. Votre devis reste accepté : vous pouvez réessayer. »\n- **Paiement introuvable** : le paiement n'existe pas pour cette commande.\n\nLe lien **Retour à la commande** ramène à la page de la commande.\n"
  },
  {
    "id": "event/registrations",
    "route": "/event/[eventId]/registrations",
    "space": "event",
    "title": "Inscriptions",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les inscriptions de l'évènement pour les consulter et les modérer. Chaque ligne mène à la fiche de l'inscription.\n\n## Rechercher et filtrer\n\n- La zone de recherche (« Rechercher (nom, e-mail, document)… ») filtre la liste une fois la saisie terminée.\n- Le sélecteur **Filtrer par statut** propose **Tous statuts**, **En attente**, **Approuvé** et **Rejeté**.\n- Le bouton **Rafraîchir** recharge la liste.\n\nLe statut, la recherche, la page et la taille de page sont conservés dans l'adresse de la page : un rechargement ou un lien partagé retrouve le même affichage.\n\n:::permission registration.export\n## Exporter\n\nLe bouton **Exporter** télécharge les inscriptions de l'évènement au format CSV.\n:::\n\n:::permission registration.create\n## Créer une inscription\n\nLe bouton **Inscription** ouvre le formulaire d'inscription manuelle.\n:::\n\n## Le tableau\n\nColonnes : **Nom** (lien vers la fiche ; sur petit écran l'e-mail s'affiche sous le nom), **E-mail**, **Catégorie** et **Badge** (colonnes masquées sur petit écran), **Statut** et le lien **Détail**. La colonne Badge affiche **Imprimé** lorsque le badge a été imprimé, « — » sinon. S'il n'y a aucune inscription : « Aucune inscription. »\n\nSous le tableau, la pagination permet de changer de page et de choisir le nombre de lignes par page.\n"
  },
  {
    "id": "event/registrations/detail",
    "route": "/event/[eventId]/registrations/[regId]",
    "space": "event",
    "title": "Fiche d'une inscription",
    "audience": "organisateur",
    "access": "event.read.detailed",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche présente une inscription : l'identité du participant, son statut, ses pièces et les actions de modération. Le lien **Inscriptions** en haut ramène à la liste. Une inscription qui n'appartient pas à cet évènement est introuvable.\n\n## L'en-tête\n\nLe nom du participant, son statut (**En attente**, **Approuvé** ou **Rejeté**) et l'étiquette **ALL ACCESS** si l'accès à toutes les zones est accordé ; en dessous, l'e-mail et la structure.\n\nPour une inscription rejetée, l'encadré **Motif de rejet** donne le motif et, le cas échéant, les détails saisis.\n\nLe tableau d'informations indique :\n- **Catégorie** (nom et numéro) ;\n- **Pièce** (type et numéro) ;\n- **Identité** : état de la vérification du profil par la plateforme (« Vérifiée par la plateforme le … », « Refusée par la plateforme » ou « En attente de vérification par la plateforme ») ;\n- **Inscrit le** ;\n- **Badge imprimé le**, lorsque le badge a été imprimé.\n\n:::permission registration.approve\n## Approuver ou rejeter\n\nPour une inscription **En attente** :\n- **Approuver** approuve l'inscription (« Inscription approuvée. »). Le bouton est désactivé tant que le profil n'est pas validé par la plateforme (« Profil non validé par la plateforme »).\n- **Rejeter / Bloquer** ouvre la fenêtre **Rejeter cette inscription** : choisissez un motif dans la liste (« Sélectionner un motif… », obligatoire), ajoutez si vous le souhaitez des **Détails complémentaires (optionnel)** (2 000 caractères maximum), puis **Rejeter** (« Inscription rejetée. »). **Annuler** referme la fenêtre. Cette fenêtre rejette l'inscription ; pour bloquer l'e-mail ou le document, utilisez les actions avancées.\n\nUne inscription déjà approuvée dont le badge a été imprimé ne peut plus être rejetée.\n:::\n\n:::permission badge.print\n## Marquer le badge imprimé\n\nPour une inscription **Approuvé**, le bouton **Marquer imprimé** enregistre le badge comme imprimé (« Badge marqué imprimé. »). Le bouton **Voir le badge** des actions avancées ouvre la fiche du badge.\n:::\n\n## Pièces fournies\n\nLa carte affiche la **Photo** du participant. La **Pièce d'identité** n'est montrée que si votre accès le permet ; sinon, seule la carte **Photo** est présentée.\n\n## Actions avancées\n\n:::permission registration.all_access\n**Activer ALL ACCESS** accorde l'accès à toutes les zones (« Accès ALL ACCESS accordé. ») ; **Retirer ALL ACCESS** le retire.\n:::\n\n:::permission registration.block\n**Bloquer cet e-mail** et **Bloquer ce document** ajoutent respectivement l'adresse ou le numéro de pièce aux listes de blocage de l'évènement, après confirmation (« E-mail bloqué. », « Document bloqué. »), avec le motif « Bloqué via le détail inscription ».\n:::\n\n:::permission registration.delete\n**Supprimer** supprime définitivement l'inscription après confirmation (« Inscription supprimée. »), puis ramène à la liste.\n:::\n"
  },
  {
    "id": "event/registrations/new",
    "route": "/event/[eventId]/registrations/new",
    "space": "event",
    "title": "Inscription manuelle",
    "audience": "organisateur",
    "access": "registration.create",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran crée directement une inscription pour un participant, sans passer par le lien d'inscription public. Une fois l'inscription créée, la fiche de l'inscription s'ouvre.\n\n## Identité\n\n- **Prénom** et **Nom** (obligatoires) ;\n- **Adresse e-mail** (obligatoire) ;\n- **Structure / organisation** (obligatoire).\n\n## Catégorie\n\nChoisissez la catégorie du participant parmi les catégories de l'évènement, présentées sous la forme « #numéro — nom ». La première est sélectionnée par défaut.\n\n## Pièce d'identité\n\n- **Type** : **CNI** (par défaut), **Passeport**, **Permis de conduire** ou **Autre** ;\n- **Numéro de pièce** (obligatoire) ;\n- **Photo** : déposez un fichier (JPEG, PNG ou WebP, 5 Mo maximum) ; les règles de la photo d'identité s'affichent au-dessus, et la photo est recadrée avant l'envoi (« Recadrer la photo »). Une fois la photo envoyée, **Recadrer** la reprend et **Retirer** la supprime ;\n- **Pièce d'identité** : déposez la pièce (JPEG, PNG, WebP ou PDF, 5 Mo maximum) ; **Retirer** la supprime.\n\n## Créer l'inscription\n\nLe bouton **Créer l'inscription** enregistre l'inscription. Un champ invalide est signalé par « Valeur invalide. » sous le champ. Si la personne est déjà inscrite à l'évènement, le message « Cette personne est déjà inscrite à cet événement. » s'affiche ; en cas d'autre échec : « Échec de l'enregistrement. »\n"
  },
  {
    "id": "event/registrations/overview",
    "route": "/event/[eventId]/registrations/overview",
    "space": "event",
    "title": "Vue d'ensemble des inscriptions",
    "audience": "staff",
    "access": "event.read.aggregated",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran donne la répartition des inscriptions de l'évènement sans aucune donnée nominative : seulement des chiffres. Il est destiné aux rôles qui peuvent lire les chiffres agrégés mais pas le détail des inscriptions.\n\n## Les chiffres par statut\n\nTrois tuiles : **En attente**, **Approuvées** et **Rejetées**.\n\n## Répartition par catégorie\n\nLa carte liste chaque catégorie (numéro et nom) avec le nombre d'inscriptions qu'elle contient. Sans catégorie : « Aucune catégorie. »\n\n## Total comptabilisé\n\nLe nombre d'inscriptions en attente ou approuvées. Les rejets ne sont pas comptabilisés dans le quota d'inscriptions de l'abonnement.\n"
  },
  {
    "id": "event/scan",
    "route": "/event/[eventId]/scan",
    "space": "event",
    "title": "Scanner",
    "audience": "staff",
    "access": "scan.check-in",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe scanner contrôle l'accès à l'évènement en lisant le QR code des badges. Chaque scan est enregistré dans le journal de l'évènement.\n\n## Lire un badge\n\nPar défaut, la caméra est active (« Caméra active ») : présentez le QR code du badge devant elle. Si la caméra ne convient pas, **Saisie manuelle** permet de saisir l'**ID de badge ou contenu QR** puis de cliquer sur **Vérifier** ; **Activer la caméra** revient à la lecture par caméra.\n\n## Le résultat\n\nUn panneau affiche le résultat du dernier scan :\n- **Accès autorisé** : l'inscription est approuvée. Le nom, la catégorie et le statut du participant s'affichent.\n- **Accès refusé** : l'inscription existe mais n'est pas approuvée (le statut est affiché), ou le badge est inconnu (« Badge inconnu. »).\n- **Badge d'un autre événement** : le badge appartient à un autre évènement.\n\nAvant tout scan : « Aucun scan pour le moment. » En cas d'échec de la vérification : « Vérification impossible. Réessayez. »\n\n## Historique de session\n\nLa liste **Historique de session** garde les 10 derniers scans de cette session, avec une pastille verte (autorisé) ou rouge (refusé), le nom ou le motif et l'heure. Elle est vidée au rechargement de la page. Sans scan : « Aucun scan. »\n"
  },
  {
    "id": "event/settings",
    "route": "/event/[eventId]/settings",
    "space": "event",
    "title": "Paramètres de l'évènement",
    "audience": "organisateur",
    "access": "event.settings.update",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran regroupe les informations de l'évènement, ses images, ses consignes de sécurité, l'ouverture des inscriptions et les contacts. Le bouton **Modèle de badge de l'événement** en haut ouvre le choix du modèle de badge.\n\nSans le droit de modifier l'évènement, les champs de la carte **Informations** sont en lecture seule (« Vous pouvez consulter ces informations, pas les modifier. »).\n\n## Informations\n\n- **Titre** (obligatoire) et **Lieu** ;\n- **Date** (obligatoire) et **Date de fin (optionnelle)** : la date de fin doit être postérieure ou égale à la date de l'évènement (« La date de fin doit être postérieure ou égale à la date de l'événement. ») ;\n- **Description (optionnelle)** ;\n- **Logo** et **Bannière** : déposez une image ou cliquez. Un indice rappelle le format attendu par le modèle de badge (rapport largeur/hauteur, exemple de dimensions, minimum) ; les formats acceptés sont JPEG, PNG ou WebP, 5 Mo maximum. Si l'image ne respecte pas le cadre du modèle (ou si elle est en WebP), un outil de recadrage s'ouvre avant l'envoi ; l'original est conservé pour recadrer plus tard. Une fois l'image envoyée, **Recadrer** la reprend et **Retirer** la supprime. Une image non conforme est signalée « À recadrer : … » ;\n- **Consignes de sécurité (optionnelles)** : une consigne par ligne, 30 au plus, 500 caractères chacune ; elles sont imprimées sur les badges dont le modèle affiche les consignes ;\n- **Inscriptions ouvertes** : interrupteur d'ouverture des inscriptions. Il est grisé si vous n'avez pas le droit d'ouvrir ou fermer les inscriptions. Lorsqu'elles sont fermées, la page d'inscription publique affiche un message de fermeture ;\n- le **Slug** de l'évènement est affiché pour information : il n'est modifiable que par le staff.\n\nLe bouton **Enregistrer** valide l'ensemble (« Événement mis à jour. »).\n\n:::permission event.update\n## Options du badge\n\nLorsque le modèle de badge de l'évènement propose des réglages, la carte **Options du badge** les présente, selon leur type : case à cocher, texte, couleur, date, liste (une ligne par élément) ou image (JPEG, PNG ou WebP, 5 Mo maximum). La mention **À renseigner** signale une option encore vide. Elles sont enregistrées avec le bouton **Enregistrer** de la carte Informations ; une valeur refusée affiche « Options du badge : valeur refusée (texte de 500 caractères au plus, 30 lignes au plus). »\n:::\n\n## Contact (surcharges)\n\nDeux champs, **E-mail de contact** et **Téléphone de contact**, remplacent pour cet évènement les contacts de l'organisation. Laissés vides, ils héritent du niveau organisation : la valeur héritée s'affiche en indication dans le champ (« Cascade : … »). Le bouton **Enregistrer** de cette carte valide les contacts (« Paramètres enregistrés. »). Les paramètres d'envoi d'e-mails ne se règlent pas ici : ils sont gérés au niveau de la plateforme.\n"
  },
  {
    "id": "event/settings/badge",
    "route": "/event/[eventId]/settings/badge",
    "space": "event",
    "title": "Modèle de badge",
    "audience": "organisateur",
    "access": "event.settings.update",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran choisit le modèle utilisé pour imprimer les badges de l'évènement. À défaut de choix, l'évènement hérite du modèle de l'organisation, ou à défaut de celui de la plateforme.\n\n## Images à recadrer\n\nSi le logo ou la bannière de l'évènement ne respecte pas le cadre du modèle effectif, le bandeau **Images à recadrer** les liste ; la génération des badges est bloquée tant qu'elles ne sont pas conformes. Le lien **Recadrer dans les paramètres** ouvre les paramètres de l'évènement.\n\n## Modèle effectif\n\nLa ligne « Template effectif » indique l'identifiant du modèle réellement utilisé et le niveau dont il provient (évènement, organisation ou plateforme). Le bouton **Utiliser le défaut hérité** (visible seulement si l'évènement a un modèle propre) retire ce choix pour revenir au modèle de l'organisation ou de la plateforme.\n\n## Les modèles\n\nChaque carte présente un aperçu, le nom du modèle, son format et son nombre de pages, et sa description. Une icône d'imprimante signale un modèle adapté à l'impression sur place (« Impression sur place »). Le modèle choisi pour l'évènement porte la mention **Sélectionné**. Sur les autres cartes, **Sélectionner** enregistre le modèle pour l'évènement (« Template enregistré. »). La mention **Hérité à ce niveau** indique le modèle effectif hérité d'un niveau supérieur.\n\n## Verrouillage\n\nLorsqu'une commande d'impression de l'évènement a été payée, le modèle est verrouillé : un encadré le précise avec la référence de la commande, et les boutons sont désactivés. Il redevient modifiable quand la commande est terminée.\n"
  },
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
  {
    "id": "platform/activity",
    "route": "/platform/activity",
    "space": "platform",
    "title": "Journal d'activité de la plateforme",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe journal d'activité garde la trace de toutes les actions de la plateforme, de la plus récente à la plus ancienne. La liste est paginée (10 entrées par page par défaut, modifiable en bas de page).\n\n## Les filtres\n\nLes filtres s'appliquent au clic sur **Filtrer** :\n- **Type** : un type d'action précis (par exemple une création d'organisation ou une connexion). **Tous** par défaut.\n- **Staff** : **Tous** (par défaut), **Oui** (actions effectuées par le staff de la plateforme) ou **Non**.\n- **Du** et **Au** : bornes de dates.\n- **Org ID** : identifiant d'une organisation, pour ne voir que ses actions.\n- **User ID** : identifiant d'un utilisateur, pour ne voir que ses actions.\n\n## Le tableau\n\nColonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature : création, modification, suppression, connexion, accès ou système), **Auteur** (adresse e-mail, « — » pour une action système ; colonne masquée sur petit écran), **Contexte** (organisation, évènement et cible concernés, lorsqu'ils existent ; colonne masquée sur petit écran) et une flèche (« Voir le détail ») qui ouvre la fiche de l'entrée.\n\nS'il n'y a aucune entrée, l'écran affiche « Aucune entrée. »\n"
  },
  {
    "id": "platform/activity/detail",
    "route": "/platform/activity/[logId]",
    "space": "platform",
    "title": "Détail d'une entrée du journal",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche en lecture seule détaille une entrée du journal d'activité de la plateforme. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée inexistante est introuvable.\n\n## L'en-tête\n\nLe type de l'action, le numéro « ENTRÉE # », une description en clair et la date et l'heure. Deux boutons :\n- **Copier l'ID** : copie l'identifiant de l'entrée (le bouton affiche « Copié » un instant).\n- **Exporter JSON** : télécharge l'entrée au format JSON.\n\n## Détails de l'action\n\n**Type**, **Auteur** (adresse e-mail, ou « Système »), **Contexte** (l'organisation ou l'évènement concerné) et **Staff** (Oui si l'action vient du staff de la plateforme).\n\n## Modification\n\nLorsque l'action a modifié des valeurs, le bloc **Modification** montre pour chaque champ la valeur avant et après.\n\n## Charge utile brute\n\nLes données techniques de l'évènement, telles qu'enregistrées.\n\n## Colonne latérale\n\n- **Auteur** : nom, rôle plateforme éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.\n- **Contexte** : l'organisation (un clic ouvre sa fiche), l'évènement éventuel et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.\n"
  },
  {
    "id": "platform/badge-templates",
    "route": "/platform/badge-templates",
    "space": "platform",
    "title": "Templates de badge",
    "audience": "staff",
    "access": "badge_templates.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les modèles de badge installés sur la plateforme. Chaque installation crée une version figée : les évènements qui utilisent une version antérieure ne sont pas affectés.\n\n:::permission badge_templates.manage\n## Installer un template\n\nLe bloc **Installer un template** accepte une archive ZIP contenant `manifest.json` à la racine et, si besoin, les dossiers `assets/` (JPEG, PNG) et `fonts/` (TTF, OTF). Le bouton **Installer un template** ouvre une fenêtre en deux étapes, **Fichier** puis **Récapitulatif** :\n- **Fichier** : déposez l'archive .zip (ou cliquez pour la choisir ; la taille maximale est indiquée dans la zone de dépôt). Une barre de progression suit l'envoi, puis « Analyse du paquet… ». En cas d'erreur, la liste des problèmes s'affiche et **Choisir un autre fichier** permet de recommencer.\n- **Récapitulatif** : aperçu, nom, famille, nombre de pages et numéro de la prochaine version, puis deux listes dépliables : **Données de badge** (les variables fournies au badge) et **Options du template** (réglées par évènement dans les paramètres de l'évènement). **Installer** lance l'installation (« Installation et rendu d'épreuve… ») ; à la fin, « Template installé (version N) » et **Fermer**.\n\nFermer la fenêtre pendant une opération demande confirmation (« Abandonner l'installation ? »).\n:::\n\n## Le catalogue\n\nChaque ligne montre une vignette, le nom du template (un clic ouvre sa fiche), sa famille et sa version (« famille · vN »), le nombre de pages, les dimensions en pixels et la date d'installation. Une petite icône d'imprimante signale un template proposé pour l'impression sur place. Un badge indique **Disponible** ou **Archivé**. La liste est paginée.\n\nS'il n'y a aucun template installé, l'écran indique que les badges utilisent les modèles livrés avec l'application.\n\n:::permission badge_templates.manage\n## Archiver et restaurer\n\nSur chaque ligne, **Archiver** retire le template du catalogue disponible (« Template archivé. ») et **Restaurer** le remet à disposition (« Template restauré. »).\n:::\n"
  },
  {
    "id": "platform/badge-templates/detail",
    "route": "/platform/badge-templates/[id]",
    "space": "platform",
    "title": "Détail d'un template de badge",
    "audience": "staff",
    "access": "badge_templates.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche présente une version installée d'un template de badge. Le lien **Templates de badge** en haut ramène au catalogue. Elle est en lecture seule : l'archivage se fait depuis le catalogue.\n\n## L'en-tête\n\nLe nom du template, son état (**Disponible** ou **Archivé**), puis sa famille, sa version, son nombre de pages, ses dimensions en pixels, sa date d'installation et sa description si elle existe.\n\n## Aperçu\n\nLe rendu réel du badge, aux dimensions exactes. **Ouvrir en plein écran** l'ouvre dans un nouvel onglet lorsqu'un aperçu est disponible.\n\n## Utilisé par\n\nIndique où cette version est utilisée : **Défaut de la plateforme** (racine de la cascade de choix du modèle), les organisations et les évènements concernés (un clic sur une organisation ouvre sa fiche). Si rien ne l'utilise, l'écran précise que la version peut être archivée sans conséquence.\n\n## Versions de la famille\n\nListe toutes les versions de la même famille avec leur date, la mention « archivée » le cas échéant, « version affichée » pour la version courante, et un lien **Voir** vers les autres.\n\n## Ressources embarquées\n\nLes fichiers fournis par le paquet (images, polices) avec leur taille en ko. Le bloc n'apparaît que s'il y en a.\n\n## Manifeste\n\nLe manifeste du template en JSON. **Télécharger le manifeste** l'enregistre dans un fichier nommé d'après la famille et la version.\n"
  },
  {
    "id": "platform/index",
    "route": "/platform",
    "space": "platform",
    "title": "Tableau de bord de la plateforme",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe tableau de bord donne une vue d'ensemble de la plateforme. Les blocs affichés dépendent de vos droits : un bloc dont vous n'avez pas le droit n'apparaît pas.\n\n## Chiffres clés\n\nVisibles avec le droit de consulter les organisations : **Organisations actives**, **Organisations archivées**, **Événements actifs** et **Inscriptions cumulées**.\n\n## Top organisations\n\nVisible avec le droit de consulter les organisations. Classe, sous « Par inscriptions ce mois-ci », les cinq organisations qui ont reçu le plus d'inscriptions depuis le début du mois, avec une barre proportionnelle et le nombre d'inscriptions. Un clic sur le nom ouvre la fiche de l'organisation ; **Tout voir** ouvre la liste des organisations. S'il n'y a aucune inscription ce mois-ci, l'écran l'indique.\n\n## Activité récente\n\nVisible avec le droit de consulter le journal plateforme. Liste les dix dernières actions ; celles du staff sont marquées « Staff · ». **Tout voir** ouvre le journal d'activité. S'il n'y a rien, l'écran affiche « Aucune activité récente ».\n\n## Impression\n\nCe bloc remplace la vue d'ensemble pour un profil qui ne peut pas consulter les organisations mais peut lire les commandes ou les planches d'impression (l'équipe de production). Il affiche, selon vos droits, **Commandes à traiter** et **Planches à générer**, avec les liens **Ouvrir les commandes** et **Ouvrir les planches**.\n"
  },
  {
    "id": "platform/jobs",
    "route": "/platform/jobs",
    "space": "platform",
    "title": "Emails",
    "audience": "staff",
    "access": "email_jobs.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran montre la file d'envoi des e-mails de la plateforme : ce qui attend, ce qui a échoué et ce qui est parti.\n\n## Les compteurs\n\n- **En attente** : envois pas encore partis.\n- **En échec** : envois qui n'ont pas abouti.\n- **Envoyés (24 h)** : envois réussis sur les dernières 24 heures.\n\n## Les filtres\n\nLes filtres s'appliquent au clic sur **Filtrer** :\n- **Statut** : **Tous** (par défaut), En attente, En cours, Envoyé, En échec ou Annulé. Un statut inconnu est ignoré avec le message « Statut inconnu : filtre ignoré. »\n- **Type** : le type d'e-mail.\n- **Du** et **Au** : bornes de dates.\n- **Destinataire** : recherche sur le destinataire.\n\n## Le tableau\n\nColonnes : **Date**, **Type** (masqué sur petit écran), **Destinataire**, **Statut**, **Tentatives** (essais effectués sur le maximum autorisé, par exemple 1/5 ; masqué sur petit écran), **Dernière erreur** (tronquée, le texte complet s'affiche au survol ; masqué sur petit écran) et une flèche « Voir le détail ». S'il n'y a rien, l'écran affiche « Aucun email ». La liste est paginée.\n"
  },
  {
    "id": "platform/jobs/detail",
    "route": "/platform/jobs/[jobId]",
    "space": "platform",
    "title": "Détail d'un envoi d'e-mail",
    "audience": "staff",
    "access": "email_jobs.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche détaille un envoi de la file d'e-mails. Le lien **Emails** en haut ramène à la liste. Le titre est le sujet de l'e-mail (ou son type à défaut).\n\n## Détail de l'envoi\n\n**Statut**, **Type**, **Destinataire**, **Sujet**, **Priorité** (Haute ou Normale), **Tentatives** (essais sur le maximum), **Prochain essai**, **Créé le** et **Terminé le**. Un envoi en cours affiche aussi son **Verrou**.\n\n:::permission email_jobs.manage\n## Relancer ou annuler\n\nDans l'en-tête du bloc, selon l'état de l'envoi :\n- **Relancer** : disponible pour un envoi en échec ou annulé dont le contenu n'a pas été purgé (« Email relancé. »).\n- **Annuler l'envoi** : disponible tant que l'envoi est en attente (« Envoi annulé. »).\n\nUn envoi qui n'est ni relançable ni annulable n'affiche aucun bouton.\n:::\n\n## Dernière erreur\n\nLe message d'erreur du dernier essai, lorsqu'il y en a un.\n\n## Contenu\n\nAperçu de l'e-mail tel qu'il a été envoyé. Deux cas particuliers : « Contenu masqué : cet email contient un lien à usage unique. » pour les e-mails sensibles, et « Contenu purgé après envoi. » lorsque le contenu a été supprimé.\n"
  },
  {
    "id": "platform/notifications",
    "route": "/platform/notifications",
    "space": "platform",
    "title": "Notifications",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les notifications qui vous concernent sur la plateforme, des plus récentes aux plus anciennes.\n\n## Filtrer\n\nDeux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».\n\n## Une notification\n\nChaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.\n\n## Tout marquer comme lu\n\nLe bouton **Tout marquer comme lu** marque comme lues vos notifications de la plateforme.\n\n## Parcourir l'historique\n\nSi d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.\n"
  },
  {
    "id": "platform/organizations",
    "route": "/platform/organizations",
    "space": "platform",
    "title": "Organisations",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les organisations de la plateforme. La liste est paginée.\n\n## Rechercher et filtrer\n\n- **Rechercher une organisation…** : recherche sur le nom ou le slug.\n- **Afficher les archivées** : par défaut, seules les organisations actives sont listées ; cochez la case pour ne voir que les organisations archivées.\n\nLes filtres s'appliquent au clic sur **Filtrer**.\n\n## Le tableau\n\nColonnes : **Organisation** (logo, nom cliquable et mention « Archivée » le cas échéant), **Slug**, **Membres** et **Événements** (ces trois dernières masquées sur petit écran) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucune organisation. »\n\n:::permission organizations.create\n## Créer une organisation\n\nLe bouton **Créer une organisation** en haut à droite ouvre le formulaire de création.\n:::\n"
  },
  {
    "id": "platform/organizations/activity",
    "route": "/platform/organizations/[orgId]/activity",
    "space": "platform",
    "title": "Journal d'une organisation",
    "audience": "staff",
    "access": "activity.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **Journal** de la fiche d'une organisation liste, en lecture seule, les actions enregistrées pour cette organisation, de la plus récente à la plus ancienne. Le titre indique le nombre total d'entrées. La liste est paginée.\n\n## Le tableau\n\nColonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature), **Auteur** (adresse e-mail, « — » pour une action système ; la mention « (staff) » signale une action du staff de la plateforme) et **Contexte** (évènement et cible concernés). S'il n'y a rien, l'écran affiche « Aucune entrée. »\n\nPour le détail d'une entrée, ouvrez le journal de la plateforme.\n"
  },
  {
    "id": "platform/organizations/detail",
    "route": "/platform/organizations/[orgId]",
    "space": "platform",
    "title": "Fiche d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLa fiche présente une organisation en **supervision, lecture seule** : le staff consulte l'organisation depuis la plateforme, sans entrer dans son espace.\n\n## En-tête et onglets\n\nLe lien **← Organisations** ramène à la liste. Les onglets **Fiche**, **Événements**, **Membres** et **Abonnement** mènent aux pages de supervision ; l'onglet **Journal** n'apparaît que si vous avez le droit de consulter le journal plateforme. Sous le titre : le slug et le nombre d'événements ; une organisation archivée porte la mention « Archivée le … ».\n\n## Chiffres clés\n\n**Événements**, **OWNERs** et **Plan** (« Aucun » sans abonnement).\n\n## Abonnement\n\nUn résumé : jauge **Événements** (utilisés sur le maximum, « ∞ » si illimité), **Statut**, **Période** (Annuel, Mensuel ou « — »), **Participants / event** (« Illimité » sans plafond) et **Actif**. Le lien en haut à droite s'appelle **Gérer** si vous pouvez attribuer un abonnement, **Voir** sinon.\n\n## Informations administratives\n\n**Raison sociale**, **Adresse**, **Identifiant fiscal**, **Site web**, **Contact e-mail** et **Contact téléphone** (« — » quand ils ne sont pas renseignés).\n\n## OWNERs\n\nNom et e-mail des propriétaires ; « Aucun OWNER associé. » s'il n'y en a pas.\n\n## Derniers événements\n\nLes vingt derniers événements (titre, mention « archivé », date et nombre d'inscriptions) ; « Aucun événement. » s'il n'y en a pas.\n\n## Zone de danger\n\nCe bloc n'apparaît que si vous avez au moins l'un des deux droits ci-dessous.\n\n:::permission organizations.archive\n- **Archiver** (« Organisation archivée. ») et, pour une organisation archivée, **Restaurer** (« Organisation restaurée. »).\n:::\n\n:::permission organizations.delete\n- **Supprimer définitivement** : action irréversible. La fenêtre « Supprimer définitivement l'organisation » demande de saisir le slug exact dans **Slug de confirmation** ; sinon « Confirmation invalide : saisissez le slug exact. » Après suppression, vous revenez à la liste.\n:::\n\nSans le droit de suppression, l'écran précise que la suppression définitive est réservée aux super administrateurs.\n"
  },
  {
    "id": "platform/organizations/events",
    "route": "/platform/organizations/[orgId]/events",
    "space": "platform",
    "title": "Événements d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **Événements** de la fiche d'une organisation liste, en lecture seule, ses évènements, du plus récent au plus ancien. Le titre indique le nombre total. La liste est paginée.\n\n## Le tableau\n\nColonnes : **Événement** (titre, avec la mention « archivé » le cas échéant), **Date**, **Inscriptions** (**Ouvertes** ou **Fermées** : l'état des inscriptions, et non leur nombre) et **Inscriptions comptables** (le nombre d'inscriptions qui comptent dans le quota de l'abonnement). S'il n'y a rien, l'écran affiche « Aucun événement. »\n"
  },
  {
    "id": "platform/organizations/members",
    "route": "/platform/organizations/[orgId]/members",
    "space": "platform",
    "title": "Membres d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **Membres** de la fiche d'une organisation liste ses membres, du plus ancien au plus récent. Le titre indique le nombre total. La liste est paginée.\n\n:::permission organizations.members.manage\n## Inviter un membre\n\nLe bloc **Inviter un membre** ajoute un membre sans entrer dans l'organisation :\n- **Nom complet** et **email@exemple.fr** (adresse e-mail) : obligatoires.\n- **Rôle** : un rôle d'organisation que vous avez le droit d'attribuer ; il est proposé par défaut sur le rôle OWNER lorsqu'il est disponible.\n- **Inviter** envoie l'invitation (« Invitation envoyée. ») ; le bouton reste inactif tant qu'aucun rôle n'est choisi. En cas d'échec : « Échec de l'invitation. »\n:::\n\n## Le tableau\n\nColonnes : **Nom**, **E-mail**, **Rôle** (nom du rôle de l'organisation ; « Propriétaire », « Gestionnaire » ou « Auditeur » pour les anciens rôles ; « — » sinon) et **Depuis** (date d'arrivée). S'il n'y a rien, l'écran affiche « Aucun membre. » Cet écran ne permet ni de changer le rôle d'un membre ni de le retirer.\n"
  },
  {
    "id": "platform/organizations/new",
    "route": "/platform/organizations/new",
    "space": "platform",
    "title": "Nouvelle organisation",
    "audience": "staff",
    "access": "organizations.create",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCe formulaire crée une organisation et son premier OWNER. L'abonnement (plan et limites) se gère ensuite depuis la fiche de l'organisation.\n\n## Organisation\n\n- **Nom de l'organisation** : obligatoire.\n- **Slug (généré automatiquement)** : en lecture seule, déduit du nom au fil de la saisie. C'est un aperçu : si ce slug existe déjà, le serveur le complète par un suffixe (-2, -3…).\n\n## OWNER initial\n\nUn utilisateur est créé s'il n'existe pas et reçoit un e-mail d'invitation pour définir son mot de passe.\n- **E-mail du OWNER** : obligatoire.\n- **Nom complet du OWNER (optionnel)**.\n\n## Valider\n\n**Créer l'organisation** reste inactif tant que le nom et l'e-mail ne sont pas renseignés ; une fois créée, vous arrivez sur la fiche de l'organisation. **Annuler** revient à la liste. En cas d'échec : « Erreur à la création. »\n"
  },
  {
    "id": "platform/organizations/subscription",
    "route": "/platform/organizations/[orgId]/subscription",
    "space": "platform",
    "title": "Abonnement d'une organisation",
    "audience": "staff",
    "access": "organizations.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran montre l'abonnement d'une organisation. Le lien **Organisations** en haut ramène à la liste. Sous le titre « Abonnement — nom de l'organisation », la mention « Abonnement de l'organisation (lecture seule) » rappelle que vous ne pouvez rien modifier ; avec le droit d'attribuer un abonnement, elle devient « Assigner un plan et gérer le statut de l'abonnement ».\n\n## Le résumé de l'abonnement\n\nSans abonnement et sans droit de modification, l'écran affiche « Aucun abonnement. » Sinon, un résumé : **Plan**, **Statut**, **Période**, **Fin** (« Sans échéance » si aucune date), **Changement programmé** (plan qui prendra le relais à la fin, lorsqu'il y en a un), **Override max events** et **Override max participants/event** (« — » s'il n'y a pas de surcharge).\n\n:::permission subscriptions.update\n## Modifier l'abonnement\n\nLe bouton **Modifier** (ou le formulaire directement, si l'organisation n'a pas encore d'abonnement) ouvre :\n- **Plan** : parmi les plans non archivés.\n- **Statut** : ACTIVE, EXPIRED ou CANCELLED.\n- **Période** : lecture seule, définie par le plan (« Annuel (365 jours) » ou « Mensuel (30 jours) »). Les dates de début et de fin sont calculées à l'enregistrement.\n- **Override max events** et **Override max participants/event** : surcharges des limites du plan ; laissez vide pour appliquer celles du plan.\n\n**Enregistrer l'abonnement** valide (« Abonnement enregistré. ») ; **Annuler** revient au résumé.\n:::\n\n:::permission payments.read\n## Historique des paiements\n\nLes 50 derniers paiements de l'organisation : **Date**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** et un lien **Voir** vers le détail du paiement. « Aucun paiement. » s'il n'y en a pas.\n:::\n"
  },
  {
    "id": "platform/payments",
    "route": "/platform/payments",
    "space": "platform",
    "title": "Paiements",
    "audience": "staff",
    "access": "payments.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste tous les paiements de la plateforme, abonnements et commandes d'impression, toutes organisations confondues. Il sert à retrouver un paiement, suivre son statut et ouvrir sa fiche. L'écran est en lecture seule.\n\n## Les filtres\n\nLes filtres sont conservés dans l'adresse de la page : vous pouvez la recharger ou la partager sans perdre le résultat. Un nouveau filtre repart de la première page.\n\n- **Organisation** : nom ou identifiant de l'organisation.\n- **Statut** : Tous, En attente, Payé, Refusé, Annulé ou Expiré.\n- **Type** : Tous, Abonnement ou Impression.\n- **Du** / **Au** : période de création du paiement.\n- **Référence FedaPay** : recherche par référence de transaction (par exemple « trx_… »).\n\n**Filtrer** applique les critères ; **Réinitialiser** les efface.\n\n## Le tableau\n\nColonnes : **Date**, **Organisation** (un clic ouvre sa fiche), **Type**, **Objet**, **Montant** (en FCFA), **Statut**, **Référence** (référence FedaPay, « — » si absente) et un lien **Voir** vers la fiche du paiement. S'il n'y a aucun résultat, l'écran affiche « Aucun paiement. » La pagination s'affiche sous le tableau.\n"
  },
  {
    "id": "platform/payments/detail",
    "route": "/platform/payments/[paymentId]",
    "space": "platform",
    "title": "Détail d'un paiement",
    "audience": "staff",
    "access": "payments.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche en lecture seule présente un paiement. Le lien **Paiements** en haut ramène à la liste.\n\n## Le bloc Paiement\n\nIl affiche : **Montant**, **Devise**, **Statut** (En attente, Payé, Refusé, Annulé ou Expiré), **Type** (Abonnement ou Impression), **Plan** ou **Commande** concerné (un clic ouvre la liste des plans ou la commande), **Changement** (Changement immédiat, Renouvellement ou Changement programmé, pour un abonnement), **Créé le**, **Approuvé le**, **Référence FedaPay**, **Identifiant FedaPay**, **Payeur** (nom et e-mail) et **Organisation** (un clic ouvre sa fiche). Une valeur absente s'affiche « — ».\n\n## Le détail de l'abonnement\n\nPour un abonnement, un second bloc **Détail de l'abonnement** apparaît lorsque c'est pertinent : **Prix plein**, **Crédit déduit** (crédit au prorata de la période restante de l'ancien plan), **Montant payé**, et la **Période couverte**.\n\n## Imprimer le reçu\n\nLorsque le paiement a le statut Payé, le bouton **Imprimer le reçu** ouvre le reçu dans un nouvel onglet.\n"
  },
  {
    "id": "platform/plans",
    "route": "/platform/plans",
    "space": "platform",
    "title": "Plans",
    "audience": "staff",
    "access": "plans.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran présente le catalogue des plans d'abonnement : les limites d'évènements et de participants par évènement, le prix et la fiche publique de chaque plan. La liste est paginée. Sans le droit de gérer les plans, vous la consultez seulement.\n\n## Le tableau\n\nColonnes :\n- **Nom** et **Période** (Annuel ou Mensuel).\n- **Max events** et **Max participants/event** : « Illimité » quand il n'y a pas de plafond.\n- **Prix** : montant en FCFA, ou « Non vendu en ligne » lorsqu'aucun prix n'est fixé. Le lien **Modifier le prix** ouvre un champ « Prix (FCFA) » (minimum 100 ; vide = non vendu en ligne) avec **Enregistrer** (« Prix mis à jour. ») et **Annuler**. L'enregistrement n'aboutit qu'avec le droit de gérer les plans.\n- **Public** : « Visible » ou « Masqué », suivi de la position et de « mis en avant » le cas échéant.\n- **Abonnements** : nombre d'abonnements qui utilisent ce plan.\n\nS'il n'y a aucun plan, l'écran affiche « Aucun plan. »\n\n:::permission plans.manage\n## Créer un plan\n\nLe bouton **Nouveau plan** ouvre la fenêtre « Nouveau plan » :\n- **Nom** : obligatoire ; « Ce nom de plan existe déjà. » si le nom est pris.\n- **Période** : **Mensuel (30 jours)** par défaut, ou **Annuel (365 jours)**.\n- **Max events (vide = illimité)** et **Max participants/event** : plafonds ; vide = illimité.\n- **Prix (FCFA) (vide = non vendu en ligne)** : minimum 100.\n- La fiche publique (voir ci-dessous).\n\n**Créer le plan** valide (« Plan créé. ») ; **Annuler** ferme la fenêtre.\n\n## La fiche publique\n\nLe lien **Fiche publique** de chaque ligne ouvre un panneau, aussi présent à la création :\n- **Visible sur /tarifs** : affiche le plan sur la page publique des tarifs. Non coché par défaut.\n- **Mis en avant** : met le plan en valeur sur cette page.\n- **Position (ordre d'affichage)** : de 0 à 9999, 0 par défaut.\n- **Description courte (300 caractères max)** : vide = effacée.\n- **Fonctionnalités (une par ligne, 12 max)** : les lignes vides sont ignorées.\n\n**Enregistrer** valide (« Fiche publique mise à jour. »).\n\n## Archiver et restaurer\n\n**Archiver** retire un plan du catalogue (« Plan archivé. ») ; **Restaurer** le remet (« Plan restauré. »). Un plan archivé n'est plus proposé lors de l'attribution d'un abonnement.\n:::\n"
  },
  {
    "id": "platform/print/catalog",
    "route": "/platform/print/catalog",
    "space": "platform",
    "title": "Catalogue d'impression",
    "audience": "staff",
    "access": "print.catalog.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe catalogue liste les supports de badge et les accessoires proposés aux organisateurs. La liste est paginée.\n\n## Les filtres\n\nDeux sélecteurs se combinent :\n- **Tous**, **Supports de badge** ou **Accessoires** (la famille du produit).\n- **Actifs** (par défaut) ou **Archivés**.\n\n## Le tableau\n\nColonnes : une vignette, **Nom** (un clic sur la ligne ou sur le nom ouvre la fiche), **Catégorie** (à défaut, la famille : « Support de badge » ou « Accessoire »), **À partir de** (prix le plus bas, en FCFA), **Statut** (**Publié**, **Brouillon** ou **Archivé**) et **Options** (nombre d'options). S'il n'y a aucun produit, l'écran affiche « Aucun produit dans le catalogue. »\n\n:::permission print.catalog.manage\n## Créer un produit\n\nLe bouton **Nouveau produit** ouvre une fenêtre :\n- **Famille** : **Support de badge** (par défaut) ou **Accessoire**.\n- **Nom** : obligatoire.\n- **Prix de base (FCFA)** : entier positif ou nul, 0 par défaut.\n\n**Créer** (actif quand le nom et le prix sont valides) crée le produit (« Produit créé. ») et ouvre sa fiche pour le compléter. **Annuler** ferme la fenêtre.\n:::\n"
  },
  {
    "id": "platform/print/catalog/detail",
    "route": "/platform/print/catalog/[productId]",
    "space": "platform",
    "title": "Fiche produit du catalogue",
    "audience": "staff",
    "access": "print.catalog.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche présente un produit du catalogue d'impression : informations, galerie, tarifs dégressifs, options et aperçu. Le lien **← Catalogue** ramène à la liste. Le titre est suivi de l'état du produit : **Publié**, **Brouillon** ou **Archivé**. Les cinq onglets sont **Informations**, **Galerie**, **Tarifs**, **Options** et **Aperçu**.\n\nAvec le seul droit de consulter le catalogue, tous les champs sont en lecture seule. Un produit archivé est également en lecture seule.\n\n## Informations\n\n**Nom** (120 caractères au plus), **Catégorie** (60 au plus), **Description** (5 000 au plus), **Prix de base (FCFA)** (entier positif ou nul), **Quantité minimale** (au moins 1) et **Délai (jours)** (entier ; vide = non précisé).\n\n## Galerie\n\nLa première image est l'image principale. Chaque image porte un **Texte alternatif** (200 caractères au plus). Jusqu'à 10 images, au format JPEG, PNG ou WebP et 5 Mo au plus chacune. « Aucune image. » s'il n'y en a pas.\n\n## Tarifs\n\nPrix unitaire dégressif selon la quantité commandée : chaque palier se lit « À partir de N unités : P FCFA ». Sans palier, le prix de base s'applique.\n\n## Options\n\nLes options que l'organisateur peut choisir sur ce produit. Pour chaque option : **Nom** (80 caractères au plus), **Type** (Choix unique, Choix multiple, Couleur, Répartition de quantité, Texte ou Fichier), **Aide** (300 au plus) et **Obligatoire**. Selon le type :\n- **Texte** et **Fichier** n'ont pas de valeurs : un **Supplément (FCFA)** s'applique à l'option, et pour un texte une **Longueur max (caractères)** entre 1 et 200.\n- Les autres types ont des valeurs, chacune avec un **Libellé** (80 au plus), un **Supplément (FCFA)**, une vignette facultative et, pour **Couleur**, une couleur.\n\nLe type d'une option existante ne se change pas : il faut la retirer et en créer une nouvelle. « Aucune option. » s'il n'y en a pas.\n\n## Aperçu\n\nLa fiche telle que l'organisateur la verra, avec sa configuration. Un brouillon s'aperçoit comme une fiche publiée.\n\n:::permission print.catalog.manage\n## Modifier le produit\n\nCes commandes n'apparaissent que si vous pouvez gérer le catalogue et que le produit n'est pas archivé :\n- **Publié** (interrupteur en haut de la fiche) : publie ou dépublie le produit (« Statut mis à jour. »).\n- **Archiver** : après confirmation (« Archiver ce produit ? »), le produit disparaît de la vitrine ; les commandes d'impression existantes le conservent (« Produit archivé. »).\n- **Informations** : **Enregistrer** (« Produit enregistré. »). Messages de contrôle : « Le nom est requis. », « Le prix de base doit être un entier positif ou nul. », « La quantité minimale doit être au moins 1. »\n- **Galerie** : ajout d'images par dépôt (**Ajouter des images**), **Monter**, **Descendre**, **Retirer**, puis **Enregistrer la galerie** (« Galerie enregistrée. »).\n- **Tarifs** : **Ajouter un palier** (quantité d'au moins 2, prix entier ; deux paliers ne peuvent pas avoir la même quantité), **Retirer**, **Enregistrer les tarifs** (« Tarifs enregistrés. »).\n- **Options** : **Ajouter une option**, **Ajouter une valeur**, **Ajouter une vignette** / **Changer la vignette** / **Retirer la vignette**, **Monter**, **Descendre**, **Retirer**, **Retirer l'option**, puis **Enregistrer les options** (« Options enregistrées. »). Chaque option exige un nom, et un type à valeurs exige au moins une valeur.\n:::\n"
  },
  {
    "id": "platform/print/layouts",
    "route": "/platform/print/layouts",
    "space": "platform",
    "title": "Gabarits d'impression",
    "audience": "staff",
    "access": "print.layouts.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les gabarits d'impression : formats de planche, marges et espacements utilisés pour imprimer les badges. Seuls les gabarits non archivés sont listés. La liste est paginée.\n\n## Les cartes\n\nChaque gabarit s'affiche sous forme de carte : un dessin de la feuille (un clic l'ouvre), le nom, le format en mm avec l'orientation (**Portrait** ou **Paysage**), les marges et l'espacement, et des pastilles : **Retournement** (bord long ou bord court) et **Traits de coupe** s'ils sont activés. Le lien **Voir** ouvre le gabarit en lecture seule.\n\nS'il n'y a aucun gabarit, l'écran affiche « Aucun gabarit » : un gabarit décrit la feuille, ses marges et la façon d'y ranger les badges.\n\n:::permission print.layouts.manage\n## Créer, modifier, archiver\n\n- **Nouveau gabarit** (en haut à droite) et, quand la liste est vide, **Créer le premier gabarit** ouvrent le formulaire de création.\n- Sur chaque carte, **Voir** devient **Modifier**, et **Archiver** retire le gabarit de la liste (« Gabarit archivé. »).\n:::\n"
  },
  {
    "id": "platform/print/layouts/detail",
    "route": "/platform/print/layouts/[layoutId]",
    "space": "platform",
    "title": "Gabarit d'impression",
    "audience": "staff",
    "access": "print.layouts.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran présente un gabarit d'impression avec un aperçu en direct de la planche. Le lien **Gabarits d'impression** en haut ramène à la liste. Un gabarit inexistant ou archivé est introuvable. Avec le seul droit de consulter les gabarits, tous les champs sont en lecture seule et le bouton en haut s'appelle **Retour**.\n\n## Aperçu en direct\n\nÀ gauche, la planche se met à jour à chaque saisie. Le **Template installé** sert de badge témoin (parmi les templates non archivés, avec leurs dimensions et la mention « recto-verso » le cas échéant) ; **Taille libre** permet de saisir **Largeur du badge (mm)** et **Hauteur du badge (mm)** (84 × 120 par défaut). Une pastille indique **Recto-verso** ou **Recto seul**. L'aperçu indique le nombre de badges par feuille, ou « Ce badge ne tient pas dans ce gabarit ». La légende distingue la zone utile, les emplacements et les traits de coupe. Sans dimensions valides : « Saisissez des dimensions valides pour voir l'aperçu. »\n\n## Identité\n\n**Nom** : permet de retrouver le gabarit à la génération. « Ce nom de gabarit existe déjà. » si le nom est pris.\n\n## Feuille\n\n- **Format** : **A3**, **A4**, **SRA3** ou **Libre** (sur mesure). En mode **Libre**, saisissez **Largeur (mm)** et **Hauteur (mm)** ; la largeur doit être inférieure ou égale à la hauteur.\n- **Orientation de la feuille** : **Portrait** ou **Paysage**.\n\n## Marges et espacements\n\nQuatre marges (**Haut**, **Droite**, **Bas**, **Gauche**, en mm) autour de la **Zone utile**. L'interrupteur **Marges identiques** les règle toutes ensemble. **Espace horizontal (mm)** et **Espace vertical (mm)** fixent la distance entre les badges.\n\n## Disposition des badges\n\n**Orientation des badges** : **Automatique** (le plus de badges), **Originale** (sens du template) ou **Pivotée** (tournés de 90°). Faire pivoter les badges peut en placer davantage par feuille.\n\n## Impression\n\nÀ régler selon la presse, en vérifiant sur une planche de contrôle :\n- **Retournement recto verso** : **Bord long** (le plus courant) ou **Bord court** (retournement « calendrier »).\n- **Traits de coupe** : interrupteur.\n\n:::permission print.layouts.manage\n## Enregistrer ou archiver\n\n- **Enregistrer** valide les modifications (« Gabarit mis à jour. ») ; il reste inactif tant que le nom est vide ou que les dimensions sont invalides. **Annuler** revient à la liste sans enregistrer.\n- **Archiver** demande confirmation (« Archiver ce gabarit ? Il ne pourra plus servir à générer des planches. »).\n:::\n"
  },
  {
    "id": "platform/print/layouts/new",
    "route": "/platform/print/layouts/new",
    "space": "platform",
    "title": "Nouveau gabarit d'impression",
    "audience": "staff",
    "access": "print.layouts.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran crée un gabarit d'impression. Il est réservé aux profils qui peuvent gérer les gabarits : les autres sont renvoyés à la liste. Le lien **Gabarits d'impression** en haut ramène à la liste.\n\n## Valeurs par défaut\n\nUn nouveau gabarit démarre au format **A3**, en **Portrait**, avec des marges de 10 mm, des espaces de 0 mm, une orientation de badges **Automatique**, un retournement **Bord long** et les **Traits de coupe** activés.\n\n## Les réglages\n\nLes champs sont ceux de l'éditeur de gabarit :\n- **Nom** (obligatoire) ;\n- **Format** (**A3**, **A4**, **SRA3** ou **Libre** avec **Largeur (mm)** et **Hauteur (mm)**, la largeur devant être inférieure ou égale à la hauteur) et **Orientation de la feuille** ;\n- les quatre marges (avec l'interrupteur **Marges identiques**) et les espaces **horizontal** et **vertical** ;\n- **Orientation des badges** : **Automatique**, **Originale** ou **Pivotée** ;\n- **Retournement recto verso** : **Bord long** ou **Bord court** ; **Traits de coupe**.\n\nÀ gauche, l'**Aperçu en direct** montre la planche avec un badge témoin (**Template installé** ou **Taille libre**).\n\n## Enregistrer\n\n**Enregistrer** reste inactif tant que le nom est vide ou que les dimensions sont invalides ; il crée le gabarit (« Gabarit créé. ») et ramène à la liste. « Ce nom de gabarit existe déjà. » si le nom est pris. **Annuler** revient à la liste.\n"
  },
  {
    "id": "platform/print/orders",
    "route": "/platform/print/orders",
    "space": "platform",
    "title": "Commandes d'impression",
    "audience": "staff",
    "access": "print.requests.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les commandes d'impression demandées par les organisateurs : devis, paiements et production des badges. Les brouillons n'y apparaissent jamais. La liste est paginée.\n\n## Les filtres\n\nLes filtres s'appliquent au clic sur **Filtrer** :\n- **Statut** : **Tous**, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée ou Annulée.\n- **Organisation** : **Toutes**, ou une organisation qui a déjà passé commande.\n- **Type** : **Tous**, **En amont** ou **Pendant l'évènement**.\n- **Souhaitée du** et **au** : période de la date souhaitée (la journée de fin est incluse).\n\n## Le tableau\n\nColonnes : **Référence** (un clic ouvre la commande ; une pastille rouge indique le nombre de messages non lus du fil), **Organisation**, **Évènement**, **Type**, **Badges** (le nombre de badges de la commande, ou la quantité estimée pour une commande sur place), **Total** (en FCFA), **Statut** et **Date souhaitée** (« — » si absente). S'il n'y a rien, l'écran affiche « Aucune commande » (« Aucune commande ne correspond à ces filtres. »).\n"
  },
  {
    "id": "platform/print/orders/detail",
    "route": "/platform/print/orders/[requestId]",
    "space": "platform",
    "title": "Commande d'impression",
    "audience": "staff",
    "access": "print.requests.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette page suit une commande d'impression de bout en bout : résumé, échanges avec l'organisateur, devis et passage d'un statut à l'autre. Le lien **Commandes** en haut ramène à la liste. L'en-tête montre la référence et le statut de la commande. Les boutons proposés dépendent du statut de la commande et de vos droits : un bouton que vous n'avez pas le droit d'utiliser n'est pas affiché. Si la commande est introuvable ou inaccessible, l'écran l'indique.\n\nSur grand écran, la page a trois colonnes (résumé, fil, devis) ; sur petit écran, trois onglets : **Infos**, **Discussion** et **Devis**.\n\n## Les statuts\n\nEnvoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée, Annulée. Le cheminement normal est : Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée.\n\n## Le résumé (colonne **Infos**)\n\nLe statut et le type de commande (**En amont** ou **Pendant l'évènement**), des liens vers la commande principale (« Complément de … ») ou les commandes complémentaires, puis :\n- **Badges** : le nombre de badges (ou la quantité estimée).\n- **Livraison** (commande en amont : Livraison ou Retrait, adresse, contact) ou **Sur place** (lieu et contact).\n- Le volet repliable **Détails** : **Impression** (Recto-verso ou Recto seul), **Template** et format du badge, **Date souhaitée**, **Envoyée le**, **Total du devis**, **Total accepté** et **Remarques**.\n\nPour une commande en amont, le bouton **Voir les badges (N)** en haut de la page ouvre la liste des badges de la commande (**Badges de la commande**, avec recherche par nom, catégorie, statut et marquage « imprimé »).\n\n## Le fil de discussion\n\nLe fil affiche les messages de l'organisateur et de l'équipe, les évènements de la commande (au centre), les cartes de devis et les notes internes (fond ambré, mention « Note interne », invisibles de l'organisateur). Il se met à jour automatiquement et marque les messages comme lus à l'ouverture. « Aucun échange pour le moment. » s'il est vide ; **Nouveaux messages** apparaît quand de nouveaux messages arrivent plus bas.\n\n:::permission print.requests.messages.send\n## Écrire dans le fil\n\nSous le fil, la zone « Écrire à l'organisateur… » permet d'envoyer un message (5 000 caractères au plus) :\n- **Note interne** : cochée, le message devient une note visible du staff seulement (« Note interne, invisible de l'organisateur… »), et le bouton devient **Ajouter la note** ; sinon le bouton est **Envoyer**.\n- **Joindre un fichier** : image JPEG, PNG, WebP ou PDF ; **Retirer** enlève la pièce jointe avant l'envoi.\n:::\n\n## Le devis\n\nLa colonne **Devis** affiche l'**Organisation**, l'**Évènement** et le **Contact** de l'organisation, puis le total estimé avec le nombre de lignes et de badges.\n\n:::permission print.requests.quote.edit\n## Modifier le devis\n\nTant que la commande est **Envoyée** ou **Devis envoyé**, le bouton **Modifier le devis** ouvre le devis, avec les colonnes **Intitulé**, **Qté**, **Prix unitaire** et **Total**. Modifiez une valeur puis quittez le champ pour l'enregistrer ; chaque ligne peut être retirée. **Ajouter une ligne** propose :\n- **Type** : **Produit**, **Service**, **Remise** ou **Ligne libre**.\n- **Produit** (pour le type Produit) : un produit du catalogue, qui préremplit intitulé et prix.\n- **Intitulé** (200 caractères au plus), **Quantité** et **Prix unitaire** (pour une remise : **Montant (FCFA)**, saisi en positif et déduit du total).\n\nDans les autres statuts, le devis est en lecture seule (« Lecture seule dans cet état. »).\n:::\n\n## Faire avancer la commande\n\nLes boutons de statut en haut de la page dépendent du statut actuel :\n\n:::permission print.requests.quote.send\n- **Envoyer le devis** (commande Envoyée) : transmet le devis à l'organisateur (« Devis envoyé. »).\n:::\n\n:::permission print.requests.reject\n- **Refuser** (commande Envoyée ou Devis envoyé) : demande un motif de 3 caractères au moins, transmis à l'organisateur (« Commande refusée. »).\n:::\n\n:::permission print.requests.reopen\n- **Rouvrir le devis** (commande Devis accepté) : repasse la commande en révision (« Devis rouvert. »).\n:::\n\n:::permission print.requests.mark_paid\n- **Marquer payée** (commande Devis accepté) : pour un paiement reçu hors FedaPay (virement, espèces). Un motif de 3 caractères au moins est obligatoire. Refusé si un paiement FedaPay est en cours (« Un paiement FedaPay est en cours sur cette commande. »).\n:::\n\n:::permission print.requests.advance\n- **Passer en production** (commande Payée), **Marquer prête** (En production) et **Terminer** (Prête) pour une commande en amont. Pour une commande en amont qui compte encore des badges non marqués, **Terminer** demande « Marquer les N badges comme imprimés ? » : **Oui** marque ces badges (les participants sont prévenus ; si le marquage échoue, la commande reste terminée), **Non** termine seulement la commande.\n:::\n\n:::permission print.requests.onsite.complete\n- **Terminer** pour une commande sur place (statut Prête) : la clôture verse un crédit ou crée une facture de supplément selon les badges réellement imprimés.\n:::\n\n:::permission print.sheets.generate\n- **Générer les planches** (commande en amont Payée, En production ou Prête) : ouvre l'écran Planches pour cette commande.\n:::\n\n## Planche\n\nLe bloc **Planche** indique l'état (**À générer**, **En cours**, **Prête** ou **Échec**), les chiffres (badges, feuilles, pages, recto-verso ou recto seul, gabarit) et le lien **Gérer dans Planches**. **Télécharger** et **Voir la planche** (aperçu PDF) apparaissent lorsque la planche est prête et que vous pouvez consulter les planches.\n\n:::permission print.requests.credit.apply\n## Crédit d'impression\n\nCe bloc affiche « Crédit disponible de l'organisation » et, le cas échéant, « Crédit appliqué à cette commande », puis le solde de l'organisation « Crédit d'impression » avec l'historique de ses mouvements. Tant que la commande est **Envoyée** ou **Devis envoyé** et que du crédit est disponible, **Appliquer le crédit** (ou **Modifier le crédit** si un crédit est déjà appliqué) ouvre « Appliquer le crédit d'impression » : **Montant (FCFA)** (entier d'au moins 1, plafonné au plus petit du crédit disponible et du total des lignes ; ce maximum est prérempli), puis **Appliquer** (« Crédit de … appliqué. »). Un avertissement s'affiche si le crédit appliqué dépasse le total des autres lignes : le devis ne peut alors pas être envoyé tant que le crédit n'est pas réduit.\n:::\n\n## Impression sur place\n\nPour une commande sur place, une fois payée, le bloc affiche le compteur « N / M badges imprimés » avec sa barre, le plafond et la marge, et un avertissement à 90 % de la commande, au-delà de la commande ou au plafond. Le bouton **Ouvrir le poste d'impression** (commande Payée, En production ou Prête) n'apparaît que si vous avez le droit d'opérer l'impression sur place de l'évènement.\n\n:::permission print.onsite.margin.update\nLa **Marge d'impression** (commande Payée, En production ou Prête) se règle par **Marge (%)** (entier de 0 à 100) et **Motif** (3 caractères au moins, 500 au plus), puis **Enregistrer** (« Marge mise à jour »).\n:::\n\n:::permission payments.read\n## Paiements\n\nLe bloc **Paiements** liste les paiements FedaPay de la commande (**Date**, **Objet**, **Montant**, **Statut**, **Référence**), du plus récent au plus ancien. Il n'apparaît que s'il y a au moins un paiement.\n:::\n"
  },
  {
    "id": "platform/print/orders/onsite",
    "route": "/platform/print/orders/[requestId]/onsite",
    "space": "platform",
    "title": "Poste d'impression sur place",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLe poste d'impression sert, pendant l'évènement, à identifier un participant déjà approuvé et à imprimer son badge. Il n'inscrit et n'approuve personne. Il n'est ouvert que pour une commande sur place payée, en production ou prête : sinon vous revenez à la fiche de la commande. Vous devez aussi avoir le droit d'opérer l'impression sur place de l'évènement ; sans lui, vous êtes renvoyé à la fiche de la commande.\n\n## L'en-tête\n\nLe lien **← Commande** (avec sa référence) ramène à la fiche. Le titre « Poste d'impression · référence » est suivi de l'évènement, du lieu et, s'il est renseigné, de la mention « Imprimante : … ».\n\n## Le compteur\n\nIl affiche « N / M badges imprimés » avec une barre de progression, le plafond et la marge. Un avertissement apparaît à 90 % de la commande, lorsque des badges dépassent la commande (ils sont facturés après l'évènement) et au plafond, où l'impression est bloquée : seules les réimpressions restent possibles.\n\n## Identifier un participant\n\n- **Caméra** : « Caméra active » par défaut ; **Désactiver la caméra** / **Activer la caméra**. Scanner le QR d'accueil d'un participant ouvre sa fiche.\n- **Nom, email, ID ou contenu du QR** : saisissez au moins deux caractères puis **Rechercher**. Si la saisie contient une adresse de vérification de QR, elle est lue comme un QR. Les résultats listent nom et e-mail, avec « Déjà imprimé » le cas échéant ; cliquez sur un résultat pour ouvrir sa fiche. « Aucun résultat. » sinon.\n\nUn refus s'affiche dans un encadré, par exemple « Inscription non approuvée … : le poste n'approuve personne. » Tant qu'aucune fiche n'est ouverte : « Scannez le QR d'accueil d'un participant ou recherchez-le. »\n\n## La fiche du participant\n\nPhoto, nom, e-mail, catégorie et aperçu du badge. Selon l'état :\n- **Imprimer** : lance l'impression. Le badge s'ouvre dans un nouvel onglet (« Badge envoyé à l'impression ») ; **Ouvrir le PDF** le rouvre.\n- Badge déjà imprimé hors du poste : un avertissement précise que cette impression sera comptée.\n- Badge déjà imprimé au poste : **Réimprimer** (non comptée).\n- Au plafond : « Plafond atteint : seules les réimpressions restent possibles. »\n"
  },
  {
    "id": "platform/print/sheets",
    "route": "/platform/print/sheets",
    "space": "platform",
    "title": "Planches d'impression (commande ciblée)",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLes planches d'impression sont des PDF prêts à imprimer : une par commande payée, plus la génération libre. L'en-tête **Planches d'impression** et les onglets **À traiter (N)**, **Générées** et **Génération libre** sont communs à toutes les pages de cette zone.\n\nOuverte sans commande ciblée, cette adresse redirige vers l'onglet **À traiter**. Elle ne s'affiche réellement que lorsqu'elle est ouverte depuis le lien **Générer les planches** d'une commande.\n\n## Depuis une commande\n\n- Si la commande n'est pas une commande en amont payée, en production ou prête, un message l'indique : « Les planches ne peuvent être générées que pour une commande payée, en production ou prête. »\n- Sans le droit de générer des planches, le message « Vous n'avez pas le droit de générer des planches. » s'affiche.\n\n:::permission print.sheets.generate\n## Générer les planches de la commande\n\nLe formulaire **Planches de la commande …** reprend l'organisation, l'évènement et les badges de la commande (dans l'ordre de la commande) ; seul le gabarit est à choisir :\n- **Gabarit** : parmi les gabarits non archivés (« Aucun gabarit : créez-en un dans « Gabarits » avant de générer. » s'il n'y en a pas).\n- Pour un template recto-verso, « Recto-verso imposé (le template a deux pages). »\n- À droite, **Aperçu de la planche** montre la disposition et le nombre de feuilles nécessaires.\n\n**Générer** lance la génération (« Génération lancée. ») et ouvre l'onglet **Générées**.\n:::\n"
  },
  {
    "id": "platform/print/sheets/free",
    "route": "/platform/print/sheets/free",
    "space": "platform",
    "title": "Génération libre de planches",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **Génération libre** produit des planches pour des badges choisis à la main, sans passer par une commande, et conserve l'historique de ces générations. Seules les générations hors commande figurent dans l'historique.\n\n:::permission print.sheets.generate\n## Nouvelle génération\n\nLe formulaire **Nouvelle génération** (« Choisissez les badges à imprimer et le gabarit de planche. ») comprend :\n- **Organisation** puis **Évènement** (avec le nombre d'inscrits approuvés).\n- **Inscriptions à imprimer** : **Tous les approuvés**, **Par catégorie** (une case par catégorie, avec son effectif) ou **Sélection**. En mode **Sélection**, recherchez un nom ou un identifiant, cochez les inscriptions ou utilisez **Tout sélectionner (N)** / **Tout désélectionner** ; la liste est limitée aux 5 000 premières inscriptions (un message l'indique) et affichée par tranches de 200 résultats : affinez la recherche pour voir les autres.\n- **Gabarit** : parmi les gabarits non archivés.\n- **Recto-verso (le template a deux pages)** : case proposée seulement si le template du badge a deux pages ; cochée par défaut.\n\nÀ droite, **Aperçu de la planche** montre la disposition, le nombre de feuilles nécessaires et « N badge(s) sélectionné(s) ». **Générer** (actif quand tout est choisi et qu'au moins un badge est sélectionné) lance la génération (« Génération lancée. »).\n:::\n\n## L'historique\n\nLe tableau **Historique** (« Les 50 dernières générations de planches. ») : **Date**, **Évènement**, **Gabarit**, **Badges**, **Feuilles**, **Statut** (**En attente…**, **Génération en cours…**, **Terminée** ou **Échec** avec son message ; un volet « N badge(s) écarté(s) » liste les badges ignorés), **Auteur**, puis pour une génération terminée **Aperçu** et **Télécharger**. S'il n'y a rien : « Aucune génération. » La liste se rafraîchit toutes les 5 secondes tant qu'une génération est en cours, et est paginée.\n"
  },
  {
    "id": "platform/print/sheets/generated",
    "route": "/platform/print/sheets/generated",
    "space": "platform",
    "title": "Planches générées",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **Générées** liste les commandes qui ont une planche, avec son état et son téléchargement. La liste est paginée ; lorsqu'une génération est en cours, elle se met à jour toutes les 5 secondes et vous prévient quand une planche est prête ou en échec.\n\n## Le tableau\n\nColonnes : **Commande** (un clic ouvre la commande), **Évènement**, **Organisation**, **Badges**, **Recto-verso**, **Payée le**, **État** (**En attente…**, **Génération en cours…**, **Prête** ou **Échec** avec son message), **Gabarit**, **Feuilles / pages**, **Générée le**. Sur une planche prête, **Télécharger** enregistre le PDF et **Voir** l'ouvre en aperçu (« Planche — référence »). S'il n'y a rien, l'écran affiche « Aucune planche générée. »\n\n:::permission print.sheets.generate\n## Regénérer une planche\n\nLe bouton **Regénérer** de chaque ligne ouvre « Regénérer la planche — référence » : choisissez le **Gabarit** puis **Regénérer** (« Regénération lancée. »). La planche actuelle est remplacée. Le bouton est inactif tant qu'une génération est en attente ou en cours.\n:::\n"
  },
  {
    "id": "platform/print/sheets/pending",
    "route": "/platform/print/sheets/pending",
    "space": "platform",
    "title": "Planches à traiter",
    "audience": "staff",
    "access": "print.sheets.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nL'onglet **À traiter** liste les commandes payées dont la planche n'a pas encore été générée. Le compteur de l'onglet donne leur nombre. La liste est paginée ; lorsqu'une génération est en cours, elle se met à jour toutes les 5 secondes et vous prévient quand une planche est prête (« Planche de … prête ») ou en échec.\n\n## Le tableau\n\nColonnes : **Commande** (un clic ouvre la commande), **Évènement**, **Organisation**, **Badges**, **Recto-verso** (Oui lorsque le template a deux pages), **Payée le** et **État** (**En attente…**, **Génération en cours…**, **Prête** ou **Échec** avec son message). S'il n'y a rien, l'écran affiche « Aucune commande à traiter. »\n\n:::permission print.sheets.generate\n## Générer une planche\n\nLe bouton **Générer** de chaque ligne ouvre « Générer la planche — référence » : le nombre de badges, le **Gabarit** à choisir (« Aucun gabarit : créez-en un dans « Gabarits » avant de générer. » s'il n'y en a pas) et un aperçu de la disposition. Pour un template recto-verso, le recto-verso est imposé. **Générer** lance la génération (« Génération lancée. »). Le bouton est inactif tant qu'une génération est en attente ou en cours.\n:::\n"
  },
  {
    "id": "platform/profiles",
    "route": "/platform/profiles",
    "space": "platform",
    "title": "Profils participants",
    "audience": "staff",
    "access": "profiles.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les profils de participants dont la plateforme valide les documents d'identité. Les comptes staff n'y figurent pas. La liste est paginée.\n\n## Les onglets\n\n**En attente** (affiché par défaut), **Rejetés** et **Validés** filtrent les profils par état. Un onglet conserve la recherche en cours.\n\n## La recherche\n\n**Rechercher (nom, e-mail, numéro de pièce)…** puis **Filtrer** : la recherche porte sur le prénom, le nom, l'e-mail et le numéro de pièce.\n\n## Le tableau\n\nColonnes : **Nom** (un clic ouvre la fiche du profil), **E-mail**, **Pièce** (type et numéro), **Statut** (En attente, Validé ou Rejeté) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucun profil dans cet état. »\n"
  },
  {
    "id": "platform/profiles/detail",
    "route": "/platform/profiles/[userId]",
    "space": "platform",
    "title": "Validation d'un profil",
    "audience": "staff",
    "access": "profiles.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette fiche permet d'examiner le profil d'un participant (photo et pièce d'identité) et de consulter l'historique de ses soumissions. Le lien **Profils** en haut ramène à la liste. Un compte staff ou inexistant est introuvable.\n\n## Le profil\n\nL'en-tête donne le nom, l'état du profil (En attente, Validé ou Rejeté), l'e-mail et la structure éventuelle. Le bloc affiche la **Photo** et la **Pièce d'identité** en aperçu, puis le **Type de pièce** et le **Numéro de pièce** (« — » si absents).\n\n:::permission profiles.review\n## Approuver ou rejeter\n\nLorsque la dernière soumission est en attente, deux boutons apparaissent sous le profil :\n- **Approuver** (« Profil approuvé. »). S'il n'y a plus de soumission en attente : « Aucune soumission en attente. »\n- **Rejeter** ouvre un encadré : choisissez un **Motif de rejet** (« Sélectionner un motif… »), ajoutez si besoin des **Détails (optionnel)**, puis **Confirmer le rejet** (« Profil rejeté. »), actif une fois un motif choisi. Un motif qui ne s'applique pas à un profil est refusé (« Ce motif ne s'applique pas à un profil. »).\n:::\n\n## Historique des soumissions\n\nLa liste des soumissions, de la plus récente à la plus ancienne : statut, motif de rejet et détails le cas échéant, date de soumission (« Soumis le … ») et date de décision (« décidé le … »). « Aucune soumission. » s'il n'y en a pas.\n"
  },
  {
    "id": "platform/roles",
    "route": "/platform/roles",
    "space": "platform",
    "title": "Rôles de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les rôles système et les rôles personnalisés. Un rôle regroupe des permissions que vous attribuez ensuite aux comptes. Il est réservé aux profils qui peuvent gérer les rôles de la plateforme : les autres sont renvoyés au tableau de bord.\n\n## Les onglets\n\nTrois onglets séparent les niveaux de rôles : **Plateforme**, **Organisation** et **Évènement**. Seul l'onglet **Plateforme** permet de créer et de gérer des rôles : les deux autres sont consultables, avec le message « Les rôles de ce niveau sont consultables ici. Les rôles personnalisés d'une organisation sont gérés par l'organisation elle-même. »\n\nSur l'onglet **Plateforme**, le bouton **Nouveau rôle** ouvre le formulaire de création.\n\n## La liste\n\nPour chaque rôle : son nom (cliquable tant qu'il n'est pas archivé), l'étiquette **Système** pour les rôles fournis par la plateforme, l'étiquette **Archivé**, sa description, le nombre de permissions et, lorsqu'il est connu, le nombre de membres qui le portent.\n\nActions (onglet **Plateforme** seulement) :\n- **Dupliquer** : crée un nouveau rôle à partir de celui-ci (possible aussi pour un rôle système).\n- **Modifier** : réservé aux rôles personnalisés non archivés.\n- **Archiver** : archive un rôle personnalisé (« Rôle archivé. »).\n- **Restaurer** : remet en service un rôle archivé (« Rôle restauré. »).\n\nLes rôles système ne se modifient ni ne s'archivent.\n"
  },
  {
    "id": "platform/roles/detail",
    "route": "/platform/roles/[roleId]",
    "space": "platform",
    "title": "Détail d'un rôle de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran affiche le contenu d'un rôle et, pour un rôle personnalisé de la plateforme, permet de le modifier. Le lien **Rôles** en haut ramène à la liste. Le nom et la description du rôle figurent en en-tête.\n\n## Rôle en lecture seule\n\nUn rôle système (de n'importe quel niveau), un rôle archivé ou un rôle qui n'est pas de niveau plateforme s'affiche en lecture seule, avec la matrice des permissions cochées. Un message l'explique pour un rôle système (« Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé. ») ou un rôle archivé (« Ce rôle est archivé : restaurez-le pour le modifier. »).\n\n## Rôle personnalisé de la plateforme\n\n- **Nom du rôle** (2 à 60 caractères) et **Description (facultative)** (500 caractères au plus).\n- La matrice des permissions, groupées par domaine : cochez ou décochez. Les permissions que vous ne détenez pas ne peuvent pas être ajoutées (« Vous ne détenez pas cette permission. »), mais celles déjà portées par le rôle restent décochables.\n- **Enregistrer** applique les changements (« Rôle enregistré. ») et ramène à la liste ; **Annuler** revient sans enregistrer.\n\n## Questions fréquentes\n\n**Un rôle introuvable ?** Les rôles système de tous les niveaux et les rôles personnalisés de la plateforme sont accessibles ; tout autre identifiant mène à une page introuvable.\n"
  },
  {
    "id": "platform/roles/new",
    "route": "/platform/roles/new",
    "space": "platform",
    "title": "Nouveau rôle de la plateforme",
    "audience": "staff",
    "access": "platform.roles.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran crée un rôle personnalisé de la plateforme. Si vous arrivez par **Dupliquer**, le titre devient « Dupliquer un rôle » : les permissions sont reprises du rôle source et le nom proposé se termine par « (copie) ».\n\n## Les champs\n\n- **Nom du rôle** : obligatoire, de 2 à 60 caractères.\n- **Description (facultative)** : 500 caractères au plus.\n\n## La matrice des permissions\n\nLes permissions sont regroupées par domaine, chacune avec son libellé et sa description. Cochez celles que le rôle doit accorder. Vous ne pouvez cocher que des permissions que vous détenez vous-même ; les autres sont grisées avec l'indication « Vous ne détenez pas cette permission. ». Lors d'une duplication, seules les permissions que vous pouvez accorder sont reprises.\n\n## Valider\n\n**Créer le rôle** (ou **Créer la copie** pour une duplication) enregistre le rôle (« Rôle créé. ») et vous ramène à la liste. Il reste inactif tant que le nom fait moins de 2 caractères. **Annuler** revient à la liste sans rien enregistrer.\n"
  },
  {
    "id": "platform/settings",
    "route": "/platform/settings",
    "space": "platform",
    "title": "Paramètres de la plateforme",
    "audience": "staff",
    "access": "platform.access",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran regroupe la configuration globale de la plateforme. Un message le rappelle : ces paramètres s'appliquent à toute la plateforme et sont réservés au staff. Il est organisé en onglets ; seuls ceux que vos droits permettent de voir sont affichés, et si aucun onglet ne vous est accessible vous revenez au tableau de bord. Un onglet inconnu ou non autorisé ramène au premier onglet visible. Les adresses de la forme `?tab=` permettent d'ouvrir directement un onglet.\n\n:::permission settings.read\n## Onglet E-mails\n\nLe bloc **Serveur SMTP** (« Configuration d'envoi des e-mails de la plateforme. ») :\n- **Hôte SMTP** et **Port** (587 si le champ est vide ou invalide).\n- **Expéditeur (From)** : une adresse e-mail.\n- **Utilisateur SMTP**.\n- **Mot de passe SMTP** : l'intitulé précise « (rempli — saisir pour remplacer) » lorsqu'un mot de passe existe déjà ; la valeur n'est jamais affichée. Laissé vide, le mot de passe actuel est conservé.\n- **TLS (connexion sécurisée)** : interrupteur.\n- **Afficher les valeurs masquées pendant la saisie** : montre en clair ce que vous tapez dans le champ secret.\n\n**Enregistrer les paramètres** (« Paramètres enregistrés. ») n'apparaît qu'avec le droit de modifier les paramètres. Sans ce droit, le message « Ces paramètres sont affichés en lecture seule : vous n'avez pas le droit de les modifier. » s'affiche et les champs sont inactifs. Avec ce droit mais sans celui de modifier les secrets, le champ « Mot de passe SMTP (réservé au super administrateur) » reste inactif, avec un avertissement.\n\n## Onglet Sécurité\n\nLe bloc **reCAPTCHA** (« Protection anti-spam des formulaires publics. ») :\n- **Activé par défaut** : interrupteur.\n- **Site key**.\n- **Secret key** : même fonctionnement que le mot de passe SMTP (« (rempli — saisir pour remplacer) » ; « (réservé au super administrateur) » sans le droit de modifier les secrets).\n\nL'enregistrement suit les mêmes règles que pour l'onglet E-mails.\n\n## Onglet Abonnements\n\nLe bloc **Droits selon l'abonnement** précise ce qu'une organisation peut faire selon que son abonnement est actif ou non ; les quotas du plan s'appliquent en plus. Un tableau croise chaque droit avec **Abonnement actif** et **Abonnement inactif** :\n- **Créer un évènement** : bouton de création, page et API.\n- **Recevoir des inscriptions** : inscriptions et re-soumissions. Sans abonnement : évènement en cours seulement.\n- **Gérer les évènements en cours** : actions d'écriture de l'espace évènement. Sans abonnement : évènement en cours seulement.\n- **Accéder à l'espace organisation** : membres, réglages, modèles… L'onglet Abonnement et la liste des évènements restent accessibles.\n\n**Enregistrer** (« Droits enregistrés. ») n'est proposé qu'avec le droit de modifier ces droits ; sans lui, les cases sont inactives et l'écran indique « Modification réservée aux administrateurs du staff. »\n:::\n\n:::permission settings.smtp.test\n## Tester l'envoi SMTP\n\nDans l'onglet E-mails, le bloc **Tester l'envoi SMTP** envoie un e-mail de test avec la configuration actuelle. **Destinataire (par défaut : votre e-mail)** est prérempli avec votre adresse ; **Envoyer un e-mail de test** confirme le destinataire (« E-mail de test envoyé à … ») ou affiche le diagnostic de l'échec (« Échec : … »).\n:::\n\n:::permission rejection_reasons.read\n## Onglet Motifs de rejet\n\nLe catalogue des motifs, partagé par la validation des profils et le rejet des inscriptions. Le tableau liste **Libellé**, **Portée** (**Profil**, **Inscription** ou **Les deux**) et **Ordre** ; « Aucun motif. » s'il est vide. Seuls les motifs non archivés sont listés. Avec le droit de gérer les motifs, vous pouvez en ajouter, modifier ou archiver (voir ci-dessous) ; sans lui, la liste est en lecture seule.\n:::\n\n:::permission rejection_reasons.manage\n## Gérer les motifs de rejet\n\n- **Ajouter** : saisissez **Libellé**, **Portée** (**Profil** par défaut) et **Ordre** (0 par défaut, entier positif ou nul), puis **Ajouter** (« Motif créé. »).\n- **Modifier** : la fenêtre « Modifier le motif » reprend ces trois champs (libellé de 200 caractères au plus, obligatoire : « Le libellé est obligatoire. ») ; **Enregistrer** (« Motif modifié. »).\n- **Archiver** : après confirmation (« Le motif « … » ne sera plus proposé lors des refus. Les décisions déjà prises conservent leur libellé. »), le motif est archivé (« Motif archivé. »).\n:::\n\n:::permission settings.badge_template.update\n## Onglet Badge\n\nLe bloc **Template de badge par défaut** (« Racine de la cascade : les organisations et les événements peuvent surcharger ce choix. ») choisit le modèle appliqué quand ni l'organisation ni l'évènement n'en ont choisi un. Un bandeau indique le « Template effectif » (niveau plateforme). Chaque carte montre l'aperçu du modèle, son nom, son format, son nombre de pages, sa description et une icône d'imprimante lorsqu'il permet l'impression sur place. **Sélectionner** retient ce modèle (« Template enregistré. ») ; le modèle retenu est marqué « Sélectionné ». Le choix de la plateforme ne peut pas être retiré, seulement remplacé. Cet onglet n'est visible qu'avec le droit de choisir le template par défaut.\n:::\n\n:::permission settings.onsite_print.update\n## Onglet Impression sur place\n\nLe bloc **Impression sur place** règle les templates que les organisations peuvent choisir pour imprimer leurs badges pendant l'évènement, et les réglages par défaut du poste d'impression :\n- **Templates proposés** : une case par version de template non archivée (nom, version et format en mm) ; « Aucun template installé. » s'il n'y en a pas.\n- **Imprimante (note)** : 500 caractères au plus (par exemple le modèle d'imprimante) ; vide = aucune note.\n- **Marge par défaut (%)** : entier de 0 à 100 (« Saisir un entier entre 0 et 100. » sinon).\n\n**Enregistrer** (« Réglages enregistrés. ») est inactif tant que la marge est invalide.\n:::\n"
  },
  {
    "id": "platform/settings/badge",
    "route": "/platform/settings/badge",
    "space": "platform",
    "title": "Template de badge par défaut",
    "audience": "staff",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCette adresse n'a plus d'écran propre : elle redirige vers l'onglet **Badge** de la page Paramètres de la plateforme, où se choisit le template de badge par défaut. Elle reste valable pour les anciens liens. L'onglet n'est visible qu'avec le droit de choisir le template de badge par défaut ; sans lui, vous arrivez sur le premier onglet des paramètres que vous pouvez voir, ou au tableau de bord.\n"
  },
  {
    "id": "platform/users",
    "route": "/platform/users",
    "space": "platform",
    "title": "Utilisateurs",
    "audience": "staff",
    "access": "users.read",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran liste les comptes staff et clients de la plateforme. La liste est paginée.\n\n## Rechercher et filtrer\n\n- **Rechercher un utilisateur…** : recherche sur le nom ou l'e-mail.\n- Le sélecteur de type : **Tous** (par défaut), **Staff** ou **Clients**.\n- **Archivés** : par défaut, seuls les comptes actifs sont listés ; cochez la case pour ne voir que les comptes archivés.\n\nLes filtres s'appliquent au clic sur **Filtrer**.\n\n## Le tableau\n\nColonnes : **Nom** (initiales, nom cliquable et mention « Archivé » le cas échéant), **E-mail** (masqué sur petit écran), **Type** (le rôle plateforme pour un compte staff, **Client** sinon), **Organisations** (nombre d'appartenances ; masqué sur petit écran) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucun utilisateur. »\n\n## Créer un utilisateur\n\nLe bouton **Créer un utilisateur** ouvre le formulaire de création. Il est affiché à tous, mais le formulaire n'est accessible qu'avec le droit de créer un compte client ou un compte staff : sinon, vous revenez à cette liste.\n"
  },
  {
    "id": "platform/users/detail",
    "route": "/platform/users/[userId]",
    "space": "platform",
    "title": "Fiche d'un utilisateur",
    "audience": "staff",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nLa fiche présente un compte (staff ou client), ses appartenances et son activité récente, et propose quelques actions d'administration. Le lien **Utilisateurs** en haut ramène à la liste. Un compte inexistant est introuvable.\n\n## L'en-tête\n\nInitiales, nom, e-mail, rôle plateforme pour un compte staff, et mention « Archivé » le cas échéant.\n\n:::permission users.permissions.manage\n## Permissions\n\nLe bouton **Permissions** ouvre l'écran d'ajustement des permissions du compte. Il n'est pas proposé sur votre propre compte.\n:::\n\n## Informations\n\n**Type** (« Staff applicatif » ou « Client »), **Créé le** et **Statut** (Actif ou Archivé).\n\n## Organisations et évènements\n\n**Organisations (N)** : chaque organisation du compte (un clic ouvre sa fiche, avec la mention « (archivée) » le cas échéant) et son rôle. « Aucune appartenance organisation. » s'il n'y en a pas.\n**Événements (N)** : chaque évènement du compte et son rôle. « Aucune appartenance événement. » s'il n'y en a pas.\n\n## Actions\n\nLe bloc **Actions** réunit les actions que vos droits permettent :\n\n:::permission users.password.reset\n- **Renvoyer un lien de configuration de mot de passe** (compte non archivé) : régénère le lien d'invitation (« Lien d'invitation régénéré. »).\n:::\n\n:::permission users.staff.assign_role\n- **Rôle plateforme** et **Changer le rôle** (compte staff, autre que le vôtre) : choisissez un rôle parmi ceux que vous pouvez attribuer puis validez (« Rôle mis à jour. ») ; le bouton reste inactif tant que le rôle n'a pas changé.\n:::\n\n:::permission users.archive\n- **Archiver l'utilisateur** (compte non archivé, autre que le vôtre) : archive le compte (« Utilisateur archivé. »).\n:::\n\nSur votre propre compte, un message précise que vous ne pouvez ni l'archiver ni modifier votre propre rôle.\n\n## Journal récent\n\nLes 20 dernières actions réalisées par le compte ou le concernant ; celles du staff sont marquées « Staff · ». « Aucune activité. » s'il n'y en a pas.\n"
  },
  {
    "id": "platform/users/new",
    "route": "/platform/users/new",
    "space": "platform",
    "title": "Nouvel utilisateur",
    "audience": "staff",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCe formulaire crée un compte et envoie une invitation. Il est réservé au staff qui peut créer un compte client ou un compte staff ; sans l'un de ces droits, vous revenez à la liste des utilisateurs.\n\n## Compte\n\n- **Adresse e-mail** : obligatoire. « E-mail déjà utilisé. » si un compte existe déjà.\n- **Nom complet** : obligatoire.\n\n## Type de compte\n\nDeux choix, proposés selon vos droits :\n- **Client** (« Rattaché à une organisation. ») : proposé avec le droit de créer un compte client ; c'est le choix par défaut dans ce cas.\n- **Staff applicatif** (« Administration de la plateforme. ») : proposé avec le droit de créer un compte staff.\n\n## Rôle staff\n\nPour un compte staff, **Rôle staff** liste les rôles plateforme que vous avez le droit d'attribuer ; le rôle Observateur est présélectionné s'il est disponible.\n\n## Lier à une organisation (optionnel)\n\nPour un compte client : **Organisation** (**Aucune** par défaut, parmi les organisations non archivées) puis, si une organisation est choisie, **Rôle dans l'organisation** (parmi les rôles que vous pouvez attribuer dans cette organisation ; le rôle OWNER est présélectionné s'il est disponible).\n\n## Valider\n\nUn message rappelle que l'utilisateur recevra un e-mail avec un lien setup-password valable 24 h. **Créer et inviter** reste inactif tant que l'e-mail et le nom ne sont pas renseignés (et, pour un compte staff, tant qu'aucun rôle n'est choisi) ; une fois le compte créé, vous arrivez sur sa fiche. **Annuler** revient à la liste. En cas d'échec : « Erreur à la création. »\n"
  },
  {
    "id": "platform/users/permissions",
    "route": "/platform/users/[userId]/permissions",
    "space": "platform",
    "title": "Permissions d'un utilisateur",
    "audience": "staff",
    "access": "users.permissions.manage",
    "updatedAt": "2026-11-13",
    "body": "## À quoi sert cet écran\n\nCet écran ajuste les permissions d'un compte par rapport à son rôle : vous pouvez en ajouter ou en retirer. Il n'est pas accessible sur votre propre compte : vous revenez alors à la fiche, comme si vous n'aviez pas le droit. Le lien en haut (le nom du compte) ramène à la fiche. Sous le titre « Permissions de … », l'écran rappelle que « Un retrait l'emporte sur un ajout. » et que vous ne pouvez ajouter que des permissions que vous détenez vous-même ; les permissions réservées aux rôles système ne sont pas ajustables.\n\n## Un bloc par niveau\n\nUn bloc **Plateforme** est suivi d'un bloc par organisation du compte ; chacun rappelle le rôle du compte à ce niveau. Les permissions sont regroupées par domaine. Pour chacune :\n- l'état « Effectif » ou « Non effectif », qui tient compte du rôle et des ajustements ;\n- un sélecteur **Hérité** (le rôle décide), **Ajouté** (accordée en plus ; indisponible, avec la mention « (non détenue) », si vous ne la détenez pas vous-même) ou **Retiré** (retirée même si le rôle l'accorde).\n\n## Enregistrer\n\nChaque bloc a son propre bouton **Enregistrer** (« Permissions enregistrées. »).\n"
  },
];
