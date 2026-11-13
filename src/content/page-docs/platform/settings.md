---
route: /platform/settings
title: Paramètres de la plateforme
audience: staff
access: platform.access
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/settings/page.tsx
  - src/components/admin/BadgeTemplatePicker.tsx
  - src/components/staff/OnsitePrintSettingsForm.tsx
  - src/components/staff/PlatformSettingsForm.tsx
  - src/components/staff/RejectionReasonsManager.tsx
  - src/components/staff/SubscriptionRightsForm.tsx
  - src/components/staff/TestSmtpForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Modal.tsx
  - src/components/ui/TabLinks.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/TemplatePreview.tsx
sourceHash: sha256:495f65d7fd81add3b9664cce90e7fdd763e2b69f7db069f5e7507e9ee1337944
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran regroupe la configuration globale de la plateforme. Un message le rappelle : ces paramètres s'appliquent à toute la plateforme et sont réservés au staff. Il est organisé en onglets ; seuls ceux que vos droits permettent de voir sont affichés, et si aucun onglet ne vous est accessible vous revenez au tableau de bord. Un onglet inconnu ou non autorisé ramène au premier onglet visible. Les adresses de la forme `?tab=` permettent d'ouvrir directement un onglet.

:::permission settings.read
## Onglet E-mails

Le bloc **Serveur SMTP** (« Configuration d'envoi des e-mails de la plateforme. ») :
- **Hôte SMTP** et **Port** (587 si le champ est vide ou invalide).
- **Expéditeur (From)** : une adresse e-mail.
- **Utilisateur SMTP**.
- **Mot de passe SMTP** : l'intitulé précise « (rempli — saisir pour remplacer) » lorsqu'un mot de passe existe déjà ; la valeur n'est jamais affichée. Laissé vide, le mot de passe actuel est conservé.
- **TLS (connexion sécurisée)** : interrupteur.
- **Afficher les valeurs masquées pendant la saisie** : montre en clair ce que vous tapez dans le champ secret.

**Enregistrer les paramètres** (« Paramètres enregistrés. ») n'apparaît qu'avec le droit de modifier les paramètres. Sans ce droit, le message « Ces paramètres sont affichés en lecture seule : vous n'avez pas le droit de les modifier. » s'affiche et les champs sont inactifs. Avec ce droit mais sans celui de modifier les secrets, le champ « Mot de passe SMTP (réservé au super administrateur) » reste inactif, avec un avertissement.

## Onglet Sécurité

Le bloc **reCAPTCHA** (« Protection anti-spam des formulaires publics. ») :
- **Activé par défaut** : interrupteur.
- **Site key**.
- **Secret key** : même fonctionnement que le mot de passe SMTP (« (rempli — saisir pour remplacer) » ; « (réservé au super administrateur) » sans le droit de modifier les secrets).

L'enregistrement suit les mêmes règles que pour l'onglet E-mails.

## Onglet Abonnements

Le bloc **Droits selon l'abonnement** précise ce qu'une organisation peut faire selon que son abonnement est actif ou non ; les quotas du plan s'appliquent en plus. Un tableau croise chaque droit avec **Abonnement actif** et **Abonnement inactif** :
- **Créer un évènement** : bouton de création, page et API.
- **Recevoir des inscriptions** : inscriptions et re-soumissions. Sans abonnement : évènement en cours seulement.
- **Gérer les évènements en cours** : actions d'écriture de l'espace évènement. Sans abonnement : évènement en cours seulement.
- **Accéder à l'espace organisation** : membres, réglages, modèles… L'onglet Abonnement et la liste des évènements restent accessibles.

**Enregistrer** (« Droits enregistrés. ») n'est proposé qu'avec le droit de modifier ces droits ; sans lui, les cases sont inactives et l'écran indique « Modification réservée aux administrateurs du staff. »
:::

:::permission settings.smtp.test
## Tester l'envoi SMTP

Dans l'onglet E-mails, le bloc **Tester l'envoi SMTP** envoie un e-mail de test avec la configuration actuelle. **Destinataire (par défaut : votre e-mail)** est prérempli avec votre adresse ; **Envoyer un e-mail de test** confirme le destinataire (« E-mail de test envoyé à … ») ou affiche le diagnostic de l'échec (« Échec : … »).
:::

:::permission rejection_reasons.read
## Onglet Motifs de rejet

Le catalogue des motifs, partagé par la validation des profils et le rejet des inscriptions. Le tableau liste **Libellé**, **Portée** (**Profil**, **Inscription** ou **Les deux**) et **Ordre** ; « Aucun motif. » s'il est vide. Seuls les motifs non archivés sont listés. Avec le droit de gérer les motifs, vous pouvez en ajouter, modifier ou archiver (voir ci-dessous) ; sans lui, la liste est en lecture seule.
:::

:::permission rejection_reasons.manage
## Gérer les motifs de rejet

- **Ajouter** : saisissez **Libellé**, **Portée** (**Profil** par défaut) et **Ordre** (0 par défaut, entier positif ou nul), puis **Ajouter** (« Motif créé. »).
- **Modifier** : la fenêtre « Modifier le motif » reprend ces trois champs (libellé de 200 caractères au plus, obligatoire : « Le libellé est obligatoire. ») ; **Enregistrer** (« Motif modifié. »).
- **Archiver** : après confirmation (« Le motif « … » ne sera plus proposé lors des refus. Les décisions déjà prises conservent leur libellé. »), le motif est archivé (« Motif archivé. »).
:::

:::permission settings.badge_template.update
## Onglet Badge

Le bloc **Template de badge par défaut** (« Racine de la cascade : les organisations et les événements peuvent surcharger ce choix. ») choisit le modèle appliqué quand ni l'organisation ni l'évènement n'en ont choisi un. Un bandeau indique le « Template effectif » (niveau plateforme). Chaque carte montre l'aperçu du modèle, son nom, son format, son nombre de pages, sa description et une icône d'imprimante lorsqu'il permet l'impression sur place. **Sélectionner** retient ce modèle (« Template enregistré. ») ; le modèle retenu est marqué « Sélectionné ». Le choix de la plateforme ne peut pas être retiré, seulement remplacé. Cet onglet n'est visible qu'avec le droit de choisir le template par défaut.
:::

:::permission settings.onsite_print.update
## Onglet Impression sur place

Le bloc **Impression sur place** règle les templates que les organisations peuvent choisir pour imprimer leurs badges pendant l'évènement, et les réglages par défaut du poste d'impression :
- **Templates proposés** : une case par version de template non archivée (nom, version et format en mm) ; « Aucun template installé. » s'il n'y en a pas.
- **Imprimante (note)** : 500 caractères au plus (par exemple le modèle d'imprimante) ; vide = aucune note.
- **Marge par défaut (%)** : entier de 0 à 100 (« Saisir un entier entre 0 et 100. » sinon).

**Enregistrer** (« Réglages enregistrés. ») est inactif tant que la marge est invalide.
:::
